// Announcement model and controller
import pool from "../config/database.js";

const Announcement = {
  create: async (title, body, authorId, status = 'published') => {
    // console.log("Body of announcement at backend", body);
    const result = await pool.query(
      'INSERT INTO "announcements" ("title", "body", "authorId", "status", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *',
      [title, body, authorId, status]
    );
    return result.rows[0];
  },

  createDraft: async (authorId) => {
    const result = await pool.query(
      'INSERT INTO "announcements" ("title", "body", "authorId", "status", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *',
      ['', '', authorId, 'draft']
    );
    return result.rows[0];
  },

  updateDraft: async (id, title, body, authorId) => {
    const result = await pool.query(
      'UPDATE "announcements" SET "title" = $1, "body" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $3 AND "authorId" = $4 AND "status" = $5 RETURNING *',
      [title, body, id, authorId, 'draft']
    );
    return result.rows[0];
  },

  publishDraft: async (id, title, body, authorId) => {
    const result = await pool.query(
      'UPDATE "announcements" SET "title" = $1, "body" = $2, "status" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $4 AND "authorId" = $5 RETURNING *',
      [title, body, 'published', id, authorId]
    );
    return result.rows[0];
  },

  getDraftsByAuthor: async (authorId) => {
    const result = await pool.query(
      'SELECT * FROM "announcements" WHERE "authorId" = $1 AND "status" = $2 ORDER BY "updatedAt" DESC',
      [authorId, 'draft']
    );
    return result.rows;
  },

  deleteDraft: async (id, authorId) => {
    const result = await pool.query(
      'DELETE FROM "announcements" WHERE "id" = $1 AND "authorId" = $2 AND "status" = $3 RETURNING *',
      [id, authorId, 'draft']
    );
    return result.rows[0];
  },

  removeEmptyDraft: async (id, authorId) => {
    const result = await pool.query(
      'DELETE FROM "announcements" WHERE "id" = $1 AND "authorId" = $2 AND "status" = $3 AND ("title" = $4 OR "title" IS NULL) AND ("body" = $5 OR "body" IS NULL) RETURNING *',
      [id, authorId, 'draft', '', '']
    );
    return result.rows[0];
  },

  getAll: async () => {
    try {
      const result = await pool.query(`
        SELECT a.*, u."fullName" as "authorName" 
        FROM "announcements" a
        LEFT JOIN "users" u ON a."authorId" = u."userId"
        WHERE a."status" = 'published'
        ORDER BY a."createdAt" DESC
      `);
      console.log("Published announcements count:", result.rows.length);
      console.log("Query result:", result.rows);
      return result.rows;
    } catch (error) {
      console.error("Database query failed:", error);
      throw error;
    }
  },

  getAllDebug: async () => {
    try {
      const result = await pool.query(`
        SELECT a.*, u."fullName" as "authorName" 
        FROM "announcements" a
        LEFT JOIN "users" u ON a."authorId" = u."userId"
        ORDER BY a."createdAt" DESC
      `);
      console.log("ALL announcements (debug):", result.rows.length);
      console.log("Debug query result:", result.rows);
      return result.rows;
    } catch (error) {
      console.error("Debug query failed:", error);
      throw error;
    }
  },

  toggleLike: async (id, userId) => {
    try {
      // First get current likes
      const result = await pool.query('SELECT "likes" FROM "announcements" WHERE "id" = $1', [id]);
      if (result.rows.length === 0) {
        throw new Error('Announcement not found');
      }
      
      const currentLikes = result.rows[0].likes || [];
      const userIndex = currentLikes.indexOf(userId);
      
      let newLikes;
      let action;
      
      if (userIndex > -1) {
        // User already liked, remove like
        newLikes = currentLikes.filter(id => id !== userId);
        action = 'unliked';
      } else {
        // User hasn't liked, add like
        newLikes = [...currentLikes, userId];
        action = 'liked';
      }
      
      // Update the likes array
      await pool.query('UPDATE "announcements" SET "likes" = $1 WHERE "id" = $2', [newLikes, id]);
      
      return { action, likesCount: newLikes.length };
    } catch (error) {
      console.error("Error toggling like:", error);
      throw error;
    }
  },

  markAsRead: async (id, userId) => {
    try {
      // Get current readBy array
      const result = await pool.query('SELECT "readBy" FROM "announcements" WHERE "id" = $1', [id]);
      if (result.rows.length === 0) {
        throw new Error('Announcement not found');
      }
      
      const currentReadBy = result.rows[0].readBy || [];
      
      // Check if user has already read this announcement
      const existingRead = currentReadBy.find(read => read.userId === userId);
      
      if (!existingRead) {
        // Add new read entry with timestamp
        const newReadEntry = {
          userId: userId,
          readAt: new Date().toISOString()
        };
        
        const updatedReadBy = [...currentReadBy, newReadEntry];
        
        // Update the readBy array
        await pool.query('UPDATE "announcements" SET "readBy" = $1 WHERE "id" = $2', [JSON.stringify(updatedReadBy), id]);
        
        return { success: true, readCount: updatedReadBy.length };
      }
      
      return { success: true, readCount: currentReadBy.length };
    } catch (error) {
      console.error("Error marking as read:", error);
      throw error;
    }
  },

  getLikedUsers: async (id) => {
    try {
      const result = await pool.query(`
        SELECT a."likes", 
               array_agg(u."fullName") as "likedUserNames",
               array_agg(u."userId") as "likedUserIds"
        FROM "announcements" a
        LEFT JOIN "users" u ON u."userId" = ANY(a."likes")
        WHERE a."id" = $1
        GROUP BY a."id", a."likes"
      `, [id]);
      
      if (result.rows.length === 0) {
        return { likes: [], likedUsers: [] };
      }
      
      const row = result.rows[0];
      const likedUsers = [];
      
      if (row.likedUserIds && row.likedUserNames) {
        for (let i = 0; i < row.likedUserIds.length; i++) {
          if (row.likedUserIds[i]) {
            likedUsers.push({
              userId: row.likedUserIds[i],
              fullName: row.likedUserNames[i]
            });
          }
        }
      }
      
      return {
        likes: row.likes || [],
        likedUsers: likedUsers
      };
    } catch (error) {
      console.error("Error getting liked users:", error);
      throw error;
    }
  },

  getReadUsers: async (id) => {
    try {
      const result = await pool.query('SELECT "readBy" FROM "announcements" WHERE "id" = $1', [id]);
      
      if (result.rows.length === 0) {
        return { readBy: [], readUsers: [] };
      }
      
      const readBy = result.rows[0].readBy || [];
      
      if (readBy.length === 0) {
        return { readBy: [], readUsers: [] };
      }
      
      // Get user details for those who read
      const userIds = readBy.map(read => read.userId);
      const userResult = await pool.query(
        'SELECT "userId", "fullName" FROM "users" WHERE "userId" = ANY($1)',
        [userIds]
      );
      
      const readUsers = readBy.map(read => {
        const user = userResult.rows.find(u => u.userId === read.userId);
        return {
          userId: read.userId,
          fullName: user ? user.fullName : 'Unknown User',
          readAt: read.readAt
        };
      });
      
      return { readBy, readUsers };
    } catch (error) {
      console.error("Error getting read users:", error);
      throw error;
    }
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, body, authorId, status = 'published' } = req.body;
    const announcement = await Announcement.create(title, body, authorId, status);
    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    console.log("at backend getAnnouncements");
    const announcements = await Announcement.getAll();
    // console.log("all announcements", announcements);
    res.status(200).json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

export const getAnnouncementsDebug = async (req, res) => {
  try {
    console.log("DEBUG: Getting all announcements regardless of status");
    const announcements = await Announcement.getAllDebug();
    res.status(200).json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch debug announcements' });
  }
};

export const updateLikes = async (req, res) => {
  try {
    const { id, type } = req.body; // type: 'like' or 'dislike'
    await Announcement.updateLikes(id, type);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update likes/dislikes' });
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
    const result = await Announcement.getLikedUsers(id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting liked users:", error);
    res.status(500).json({ error: 'Failed to get liked users' });
  }
};

export const getReadUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Announcement.getReadUsers(id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting read users:", error);
    res.status(500).json({ error: 'Failed to get read users' });
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("id get to delete", id);
    // Implement actual deletion logic
    await pool.query('DELETE FROM "announcements" WHERE "id" = $1', [id]);
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
};

// Add this to your controller
export const updateAnnouncementController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body } = req.body;
    
    // Update the announcement
    const result = await pool.query(
      'UPDATE "announcements" SET "title" = $1, "body" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $3 RETURNING *',
      [title, body, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
};

// New draft-related controllers
export const createDraftController = async (req, res) => {
  try {
    const { authorId } = req.body;
    const draft = await Announcement.createDraft(authorId);
    res.status(201).json(draft);
  } catch (error) {
    console.error('Error creating draft:', error);
    res.status(500).json({ error: 'Failed to create draft' });
  }
};

export const updateDraftController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, authorId } = req.body;
    const draft = await Announcement.updateDraft(id, title, body, authorId);
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found or not authorized' });
    }
    
    res.status(200).json(draft);
  } catch (error) {
    console.error('Error updating draft:', error);
    res.status(500).json({ error: 'Failed to update draft' });
  }
};

export const publishDraftController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, authorId } = req.body;
    const announcement = await Announcement.publishDraft(id, title, body, authorId);
    
    if (!announcement) {
      return res.status(404).json({ error: 'Draft not found or not authorized' });
    }
    
    res.status(200).json(announcement);
  } catch (error) {
    console.error('Error publishing draft:', error);
    res.status(500).json({ error: 'Failed to publish draft' });
  }
};

export const getDraftsController = async (req, res) => {
  try {
    const { authorId } = req.params;
    const drafts = await Announcement.getDraftsByAuthor(authorId);
    res.status(200).json(drafts);
  } catch (error) {
    console.error('Error getting drafts:', error);
    res.status(500).json({ error: 'Failed to get drafts' });
  }
};

export const deleteDraftController = async (req, res) => {
  try {
    const { id } = req.params;
    const { authorId } = req.body;
    const deletedDraft = await Announcement.deleteDraft(id, authorId);
    
    if (!deletedDraft) {
      return res.status(404).json({ error: 'Draft not found or not authorized' });
    }
    
    res.status(200).json({ message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
};

export const removeEmptyDraftController = async (req, res) => {
  try {
    const { id } = req.params;
    const { authorId } = req.body;
    const removedDraft = await Announcement.removeEmptyDraft(id, authorId);
    
    if (!removedDraft) {
      return res.status(404).json({ error: 'Empty draft not found or not authorized' });
    }
    
    res.status(200).json({ message: 'Empty draft removed successfully' });
  } catch (error) {
    console.error('Error removing empty draft:', error);
    res.status(500).json({ error: 'Failed to remove empty draft' });
  }
};