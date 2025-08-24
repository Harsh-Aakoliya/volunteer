// Announcement model and controller
import pool from "../config/database.js";
import path from "path";
const defaultCoverImage=path.join(process.cwd(), 'media',"defaultcoverimage.png");

const Announcement = {
  create: async (title, body, authorId, status = 'published', recipientUserIds = []) => {
    // console.log("Body of announcement at backend", body);
    const result = await pool.query(
      'INSERT INTO "announcements" ("title", "body", "authorId", "status", "updatedAt", "recipientUserIds") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5) RETURNING *',
      [title, body, authorId, status, recipientUserIds]
    );
    return result.rows[0];
  },
  
  createDraft: async (authorId, recipientUserIds = []) => {
    // console.log(path.join(process.cwd()));
    // console.log("defaultCoverImage", defaultCoverImage);
    const result = await pool.query(
      'INSERT INTO "announcements" ("title", "body", "authorId", "status", "updatedAt", "recipientUserIds") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5) RETURNING *',
      ['', '', authorId, 'draft', recipientUserIds]
    );
    return result.rows[0];
  },
  uploadCoverImage: async (req, res) => {
    try {
        const { files, announcementId } = req.body;
        
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: "No files provided" });
        }

        if (!announcementId) {
            return res.status(400).json({ error: "Announcement ID is required" });
        }

        // Import fs module
        const fs = await import('fs');
        
        const UPLOAD_DIR = path.join(process.cwd(), 'media', 'announcement', `${announcementId}`);
        
        if (!fs.default.existsSync(UPLOAD_DIR)) {
            fs.default.mkdirSync(UPLOAD_DIR, { recursive: true });
        }

        const uploadedFiles = [];
        const file = files[0]; // Only take the first file for cover image
        
        if (!file.fileData || !file.name || !file.mimeType) {
            return res.status(400).json({ error: "Invalid file data" });
        }

        // Check if it's an image
        if (!file.mimeType.startsWith('image/')) {
            return res.status(400).json({ error: "Only image files are allowed for cover image" });
        }

        // Always save as .jpg for consistency
        const fileName = `coverimage.jpg`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        try {
            // Remove existing cover image if it exists
            if (fs.default.existsSync(filePath)) {
                fs.default.unlinkSync(filePath);
            }

            // Convert base64 to buffer and write file
            const buffer = Buffer.from(file.fileData, 'base64');
            fs.default.writeFileSync(filePath, buffer);

            // Update the announcement's hasCoverImage flag
            await pool.query(
                'UPDATE "announcements" SET "hasCoverImage" = TRUE WHERE "id" = $1',
                [announcementId]
            );

            uploadedFiles.push({
                originalName: file.name,
                fileName: fileName,
                mimeType: file.mimeType,
                size: buffer.length,
                url: `${process.env.API_URL || 'http://localhost:3000'}/media/announcement/${announcementId}/${fileName}`,
                caption: ""
            });

            res.json({
                success: true,
                uploadedFiles,
                message: "Cover image uploaded successfully"
            });

        } catch (writeError) {
            console.error(`Error writing file ${file.name}:`, writeError);
            res.status(500).json({ error: "Failed to write file" });
        }

    } catch (error) {
        console.error("Error uploading cover image:", error);
        res.status(500).json({ error: "Failed to upload cover image", details: error.message });
    }
},

  updateDraft: async (id, title, body, authorId, recipientUserIds = []) => {
    const result = await pool.query(
      'UPDATE "announcements" SET "title" = $1, "body" = $2, "recipientUserIds" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $4 AND "authorId" = $5 AND "status" = $6 RETURNING *',
      [title, body, recipientUserIds, id, authorId, 'draft']
    );
    return result.rows[0];
  },

  publishDraft: async (id, title, body, authorId, recipientUserIds = []) => {
    // First get the original createdAt timestamp
    const originalResult = await pool.query(
      'SELECT "createdAt" FROM "announcements" WHERE "id" = $1 AND "authorId" = $2',
      [id, authorId]
    );
    
    if (originalResult.rows.length === 0) {
      throw new Error('Draft not found');
    }
    
    const originalCreatedAt = originalResult.rows[0].createdAt;
    
    // Update the draft to published while preserving the original createdAt
    const result = await pool.query(
      'UPDATE "announcements" SET "title" = $1, "body" = $2, "recipientUserIds" = $3, "status" = $4, "createdAt" = $5, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $6 AND "authorId" = $7 RETURNING *',
      [title, body, recipientUserIds, 'published', originalCreatedAt, id, authorId]
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
      // console.log("Published announcements count:", result.rows.length);
      // console.log("Query result:", result.rows);
      return result.rows;
    } catch (error) {
      console.error("Database query failed:", error);
      throw error;
    }
  },

  getByDepartment: async (departmentName) => {
    try {
      // Get announcements for a department by finding all announcements 
      // where any user from that department is in the recipient list
      const result = await pool.query(`
        SELECT DISTINCT a.*, u."fullName" as "authorName" 
        FROM "announcements" a
        LEFT JOIN "users" u ON a."authorId" = u."userId"
        WHERE a."status" = 'published' 
        AND EXISTS (
          SELECT 1 FROM "users" dept_users 
          WHERE dept_users."department" = $1 
          AND dept_users."userId" = ANY(a."recipientUserIds")
        )
        ORDER BY a."createdAt" DESC
      `, [departmentName]);
      return result.rows;
    } catch (error) {
      console.error("Database query failed:", error);
      throw error;
    }
  },

  getByUserId: async (userId) => {
    try {
      const result = await pool.query(`
        SELECT a.*, u."fullName" as "authorName" 
        FROM "announcements" a
        LEFT JOIN "users" u ON a."authorId" = u."userId"
        WHERE a."status" = 'published' AND $1 = ANY(a."recipientUserIds")
        ORDER BY a."createdAt" DESC
      `, [userId]);
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
      // console.log("ALL announcements (debug):", result.rows.length);
      // console.log("Debug query result:", result.rows);
      return result.rows;
    } catch (error) {
      console.error("Debug query failed:", error);
      throw error;
    }
  },

  toggleLike: async (id, userId) => {
    try {
      // First get current likedBy array and user details
      const result = await pool.query('SELECT "likedBy" FROM "announcements" WHERE "id" = $1', [id]);
      if (result.rows.length === 0) {
        throw new Error('Announcement not found');
      }
      
      const currentLikedBy = result.rows[0].likedBy || [];
      const existingLikeIndex = currentLikedBy.findIndex(like => like.userId === userId);
      
      let newLikedBy;
      let action;
      let wasNew = false;
      
      if (existingLikeIndex > -1) {
        // User already liked, remove like
        newLikedBy = currentLikedBy.filter(like => like.userId !== userId);
        action = 'unliked';
      } else {
        // User hasn't liked, add like with user details
        const userResult = await pool.query('SELECT "fullName" FROM "users" WHERE "userId" = $1', [userId]);
        const userName = userResult.rows[0]?.fullName || 'Unknown User';
        
        const newLike = {
          userId: userId,
          fullName: userName,
          likedAt: new Date().toISOString()
        };
        
        newLikedBy = [...currentLikedBy, newLike];
        action = 'liked';
        wasNew = true;
      }
      
      // Update the likedBy array
      await pool.query('UPDATE "announcements" SET "likedBy" = $1 WHERE "id" = $2', [JSON.stringify(newLikedBy), id]);
      
      return { action, likesCount: newLikedBy.length, wasNew };
    } catch (error) {
      console.error("Error toggling like:", error);
      throw error;
    }
  },

  markAsRead: async (id, userId) => {
    try {
      // Get current readBy array and user details
      const result = await pool.query('SELECT "readBy" FROM "announcements" WHERE "id" = $1', [id]);
      if (result.rows.length === 0) {
        throw new Error('Announcement not found');
      }
      
      const currentReadBy = result.rows[0].readBy || [];
      
      // Check if user has already read this announcement
      const existingRead = currentReadBy.find(read => read.userId === userId);
      
      if (!existingRead) {
        // Get user details
        const userResult = await pool.query('SELECT "fullName" FROM "users" WHERE "userId" = $1', [userId]);
        const userName = userResult.rows[0]?.fullName || 'Unknown User';
        
        // Add new read entry with timestamp and user details
        const newReadEntry = {
          userId: userId,
          fullName: userName,  
          readAt: new Date().toISOString()
        };
        
        const updatedReadBy = [...currentReadBy, newReadEntry];
        
        // Update the readBy array
        await pool.query('UPDATE "announcements" SET "readBy" = $1 WHERE "id" = $2', [JSON.stringify(updatedReadBy), id]);
        
        return { success: true, readCount: updatedReadBy.length, wasNew: true };
      }
      
      return { success: true, readCount: currentReadBy.length, wasNew: false };
    } catch (error) {
      console.error("Error marking as read:", error);
      throw error;
    }
  },

  getLikedUsers: async (id) => {
    try {
      const result = await pool.query('SELECT "likedBy" FROM "announcements" WHERE "id" = $1', [id]);
      
      if (result.rows.length === 0) {
        return { likedBy: [], likedUsers: [] };
      }
      
      const likedBy = result.rows[0].likedBy || [];
      
      return {
        likedBy: likedBy,
        likedUsers: likedBy
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
    const { title, body, authorId, status = 'published', recipientUserIds = [] } = req.body;
    
    // Check if user has permission to create announcements
    const userResult = await pool.query('SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1', [authorId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Only HODs and Karyalay users can create announcements' });
    }
    
    const announcement = await Announcement.create(title, body, authorId, status, recipientUserIds);
    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const { department } = req.query;
    let announcements;
    
    if (department) {
      announcements = await Announcement.getByDepartment(department);
    } else {
      announcements = await Announcement.getAll();
    }
    
    res.status(200).json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

export const getAnnouncementsDebug = async (req, res) => {
  try {
    // console.log("DEBUG: Getting all announcements regardless of status");
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
    const { title, body, recipientUserIds = [] } = req.body;
    
    // Update the announcement
    const result = await pool.query(
      'UPDATE "announcements" SET "title" = $1, "body" = $2, "recipientUserIds" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $4 RETURNING *',
      [title, body, recipientUserIds, id]
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
    const { authorId, recipientUserIds = [] } = req.body;
    
    // Check if user has permission to create announcements
    const userResult = await pool.query('SELECT "isAdmin", "department" FROM "users" WHERE "userId" = $1', [authorId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Only HODs and Karyalay users can create announcements' });
    }
    
    // Start with empty recipient list - user will select recipients in Step 3
    const draft = await Announcement.createDraft(authorId, recipientUserIds);
    res.status(201).json(draft);
  } catch (error) {
    console.error('Error creating draft:', error);
    res.status(500).json({ error: 'Failed to create draft' });
  }
};

export const updateDraftController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, authorId, recipientUserIds = [] } = req.body;
    const draft = await Announcement.updateDraft(id, title, body, authorId, recipientUserIds);
    
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
    const { title, body, authorId, recipientUserIds = [] } = req.body;
    const announcement = await Announcement.publishDraft(id, title, body, authorId, recipientUserIds);
    
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

// Cover image upload controller
export const uploadCoverImageController = async (req, res) => {
  try {
    return await Announcement.uploadCoverImage(req, res);
  } catch (error) {
    console.error('Error uploading cover image:', error);
    res.status(500).json({ error: 'Failed to upload cover image' });
  }
};

// Announcement media upload controller
export const uploadAnnouncementMediaController = async (req, res) => {
  try {
    const { id } = req.params;
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    // Import fs and crypto modules
    const fs = await import('fs');
    const crypto = await import('crypto');
    
    const UPLOAD_DIR = path.join(process.cwd(), 'media', 'announcement', `${id}`, 'media');
    
    if (!fs.default.existsSync(UPLOAD_DIR)) {
      fs.default.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const uploadedFiles = [];
    
    for (const file of files) {
      if (!file.fileData || !file.name || !file.mimeType) {
        console.error("Invalid file data:", file);
        continue;
      }

      // Generate unique filename to avoid conflicts
      const fileExtension = path.extname(file.name);
      const baseName = path.basename(file.name, fileExtension);
      const uniqueId = crypto.default.randomBytes(8).toString('hex');
      const fileName = `${baseName}_${uniqueId}${fileExtension}`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      try {
        // Convert base64 to buffer and write file
        const buffer = Buffer.from(file.fileData, 'base64');
        fs.default.writeFileSync(filePath, buffer);

        uploadedFiles.push({
          id: uniqueId,
          originalName: file.name,
          fileName: fileName,
          mimeType: file.mimeType,
          size: buffer.length,
          url: `${process.env.API_URL || 'http://localhost:3000'}/media/announcement/${id}/media/${fileName}`
        });

      } catch (writeError) {
        console.error(`Error writing file ${file.name}:`, writeError);
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No files were successfully uploaded" });
    }

    res.json({
      success: true,
      uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`
    });

  } catch (error) {
    console.error("Error uploading announcement media:", error);
    res.status(500).json({ error: "Failed to upload media files", details: error.message });
  }
};

// Get announcement media files controller
export const getAnnouncementMediaController = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Import fs module
    const fs = await import('fs');
    
    const MEDIA_DIR = path.join(process.cwd(), 'media', 'announcement', `${id}`, 'media');
    
    if (!fs.default.existsSync(MEDIA_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.default.readdirSync(MEDIA_DIR);
    const mediaFiles = [];

    for (const fileName of files) {
      const filePath = path.join(MEDIA_DIR, fileName);
      const stats = fs.default.statSync(filePath);
      
      // Try to determine MIME type based on file extension
      const ext = path.extname(fileName).toLowerCase();
      let mimeType = 'application/octet-stream';
      
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        mimeType = `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`;
      } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv'].includes(ext)) {
        mimeType = `video/${ext.slice(1)}`;
      } else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
        mimeType = `audio/${ext.slice(1)}`;
      }

      // Extract unique ID from filename (assuming format: basename_uniqueId.ext)
      const fileBaseName = path.basename(fileName, path.extname(fileName));
      const uniqueId = fileBaseName.includes('_') ? fileBaseName.split('_').pop() : fileName;

             // Try to extract original name from filename pattern (basename_uniqueid.ext)
       let originalName = fileName;
       if (fileBaseName.includes('_')) {
         const parts = fileBaseName.split('_');
         if (parts.length >= 2) {
           parts.pop(); // Remove the unique ID part
           originalName = parts.join('_') + path.extname(fileName);
         }
       }

       mediaFiles.push({
         id: uniqueId,
         fileName: fileName,
         originalName: originalName,
         mimeType: mimeType,
         size: stats.size,
         url: `${process.env.API_URL || 'http://localhost:3000'}/media/announcement/${id}/media/${fileName}`
       });
    }

    res.json({ success: true, files: mediaFiles });

  } catch (error) {
    console.error("Error getting announcement media:", error);
    res.status(500).json({ error: "Failed to get media files", details: error.message });
  }
};

// Delete announcement media file controller
export const deleteAnnouncementMediaController = async (req, res) => {
  try {
    const { id, fileName } = req.params;
    
    // Import fs module
    const fs = await import('fs');
    
    const filePath = path.join(process.cwd(), 'media', 'announcement', `${id}`, 'media', fileName);
    
    if (!fs.default.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete the file
    fs.default.unlinkSync(filePath);

    res.json({
      success: true,
      message: "File deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting announcement media:", error);
    res.status(500).json({ error: "Failed to delete media file", details: error.message });
  }
};

// Get announcement details with recipients for editing
export const getAnnouncementDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get announcement with recipient details
    const result = await pool.query(`
      SELECT a.*, u."fullName" as "authorName",
             COALESCE(a."recipientUserIds", '{}') as "recipientUserIds"
      FROM "announcements" a
      LEFT JOIN "users" u ON a."authorId" = u."userId"
      WHERE a."id" = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    const announcement = result.rows[0];
    
    // Get recipient user details
    const recipientUserIds = announcement.recipientUserIds || [];
    let recipients = [];
    
    if (recipientUserIds.length > 0) {
      const recipientsResult = await pool.query(`
        SELECT "userId", "fullName", "department"
        FROM "users"
        WHERE "userId" = ANY($1)
      `, [recipientUserIds]);
      recipients = recipientsResult.rows;
    }
    
    res.status(200).json({
      ...announcement,
      recipients: recipients,
      // For backward compatibility, derive department tags from recipients
      departmentTags: [...new Set(recipients.map(r => r.department).filter(Boolean))]
    });
  } catch (error) {
    console.error('Error getting announcement details:', error);
    res.status(500).json({ error: 'Failed to get announcement details' });
  }
};

// Get all departments controller
export const getAllDepartmentsController = async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT "departmentName" FROM "departments" ORDER BY "departmentName"');
    const departments = result.rows.map(row => row.departmentName);
    res.status(200).json(departments);
  } catch (error) {
    console.error('Error getting departments:', error);
    res.status(500).json({ error: 'Failed to get departments' });
  }
};