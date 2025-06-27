// Announcement model and controller
import pool from "../config/database.js";

const Announcement = {
  create: async (title, body, authorId) => {
    const result = await pool.query(
      'INSERT INTO "announcements" ("title", "body", "authorId", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
      [title, body, authorId]
    );
    return result.rows[0];
  },

  getAll: async () => {
    try {
      const result = await pool.query(`
        SELECT a.*, u."fullName" as "authorName" 
        FROM "announcements" a
        LEFT JOIN "users" u ON a."authorId" = u."userId"
        ORDER BY a."createdAt" DESC
      `);
      return result.rows;
    } catch (error) {
      console.error("Database query failed:", error);
      throw error;
    }
  },

  toggleLike: async (announcementId, userId) => {
    try {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Get current announcement and user details
        const announcementResult = await client.query(
          'SELECT "likedBy" FROM "announcements" WHERE "id" = $1',
          [announcementId]
        );
        
        if (announcementResult.rows.length === 0) {
          throw new Error('Announcement not found');
        }
        
        const userResult = await client.query(
          'SELECT "fullName" FROM "users" WHERE "userId" = $1',
          [userId]
        );
        
        if (userResult.rows.length === 0) {
          throw new Error('User not found');
        }
        
        const currentLikedBy = announcementResult.rows[0].likedBy || [];
        const userFullName = userResult.rows[0].fullName;
        
        // Check if user already liked
        const existingLikeIndex = currentLikedBy.findIndex(like => like.userId === userId);
        
        let newLikedBy;
        let action;
        
        if (existingLikeIndex > -1) {
          // User already liked, remove like
          newLikedBy = currentLikedBy.filter(like => like.userId !== userId);
          action = 'unliked';
        } else {
          // User hasn't liked, add like
          newLikedBy = [...currentLikedBy, {
            userId: userId,
            fullName: userFullName,
            likedAt: new Date().toISOString()
          }];
          action = 'liked';
        }
        
        // Update the likedBy array
        await client.query(
          'UPDATE "announcements" SET "likedBy" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2',
          [JSON.stringify(newLikedBy), announcementId]
        );
        
        await client.query('COMMIT');
        
        return { action, likesCount: newLikedBy.length };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      throw error;
    }
  },

  markAsRead: async (announcementId, userId) => {
    try {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Get current announcement and user details
        const announcementResult = await client.query(
          'SELECT "readBy" FROM "announcements" WHERE "id" = $1',
          [announcementId]
        );
        
        if (announcementResult.rows.length === 0) {
          throw new Error('Announcement not found');
        }
        
        const userResult = await client.query(
          'SELECT "fullName" FROM "users" WHERE "userId" = $1',
          [userId]
        );
        
        if (userResult.rows.length === 0) {
          throw new Error('User not found');
        }
        
        const currentReadBy = announcementResult.rows[0].readBy || [];
        const userFullName = userResult.rows[0].fullName;
        
        // Check if user has already read this announcement
        const existingRead = currentReadBy.find(read => read.userId === userId);
        
        if (!existingRead) {
          // Add new read entry with timestamp
          const newReadEntry = {
            userId: userId,
            fullName: userFullName,
            readAt: new Date().toISOString()
          };
          
          const updatedReadBy = [...currentReadBy, newReadEntry];
          
          // Update the readBy array
          await client.query(
            'UPDATE "announcements" SET "readBy" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2',
            [JSON.stringify(updatedReadBy), announcementId]
          );
          
          await client.query('COMMIT');
          return { success: true, readCount: updatedReadBy.length, wasNew: true };
        }
        
        await client.query('COMMIT');
        return { success: true, readCount: currentReadBy.length, wasNew: false };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error marking as read:", error);
      throw error;
    }
  },

  getLikedUsers: async (announcementId, requestingUserId) => {
    try {
      // First check if the requesting user is the author
      const authResult = await pool.query(
        'SELECT "authorId" FROM "announcements" WHERE "id" = $1',
        [announcementId]
      );
      
      if (authResult.rows.length === 0) {
        throw new Error('Announcement not found');
      }
      
      const authorId = authResult.rows[0].authorId;
      if (authorId !== requestingUserId) {
        throw new Error('Unauthorized: Only author can view liked users');
      }
      
      // Get liked users
      const result = await pool.query(
        'SELECT "likedBy" FROM "announcements" WHERE "id" = $1',
        [announcementId]
      );
      
      const likedBy = result.rows[0]?.likedBy || [];
      return { likedUsers: likedBy };
    } catch (error) {
      console.error("Error getting liked users:", error);
      throw error;
    }
  },

  getReadUsers: async (announcementId, requestingUserId) => {
    try {
      // First check if the requesting user is the author
      const authResult = await pool.query(
        'SELECT "authorId" FROM "announcements" WHERE "id" = $1',
        [announcementId]
      );
      
      if (authResult.rows.length === 0) {
        throw new Error('Announcement not found');
      }
      
      const authorId = authResult.rows[0].authorId;
      if (authorId !== requestingUserId) {
        throw new Error('Unauthorized: Only author can view read users');
      }
      
      // Get read users
      const result = await pool.query(
        'SELECT "readBy" FROM "announcements" WHERE "id" = $1',
        [announcementId]
      );
      
      const readBy = result.rows[0]?.readBy || [];
      return { readUsers: readBy };
    } catch (error) {
      console.error("Error getting read users:", error);
      throw error;
    }
  },

  update: async (id, title, body) => {
    const result = await pool.query(
      'UPDATE "announcements" SET "title" = $1, "body" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $3 RETURNING *',
      [title, body, id]
    );
    return result.rows[0];
  },

  delete: async (id) => {
    const result = await pool.query(
      'DELETE FROM "announcements" WHERE "id" = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }
};

// Controller functions
export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, authorId } = req.body;
    const announcement = await Announcement.create(title, body, authorId);
    res.status(201).json(announcement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.getAll();
    res.status(200).json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

export const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const result = await Announcement.toggleLike(id, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const result = await Announcement.markAsRead(id, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error marking as read:", error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

export const getLikedUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // Get from query params for authorization
    
    const result = await Announcement.getLikedUsers(id, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting liked users:", error);
    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get liked users' });
    }
  }
};

export const getReadUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // Get from query params for authorization
    
    const result = await Announcement.getReadUsers(id, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting read users:", error);
    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get read users' });
    }
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body } = req.body;
    
    const result = await Announcement.update(id, title, body);
    
    if (!result) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await Announcement.delete(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    res.status(200).json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
};