// Announcement model and controller
import pool from "../config/datebase.js";

const Announcement = {
  create: async (title, body, authorId) => {
    console.log("Body of announcement at backend", body);
    const result = await pool.query(
      'INSERT INTO "announcements" ("title", "body", "authorId") VALUES ($1, $2, $3) RETURNING *',
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
      console.log("Query result:", result.rows);
      return result.rows;
    } catch (error) {
      console.error("Database query failed:", error);
      throw error;
    }
  },

  updateLikes: async (id, type) => {
    const column = type === 'like' ? 'likes' : 'dislikes';
    await pool.query(`UPDATE "announcements" SET "${column}" = "${column}" + 1 WHERE "id" = $1`, [id]);
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, body } = req.body;
    const authorId = req.user.userId; // Get authorId from authenticated user
    const announcement = await Announcement.create(title, body, authorId);
    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    console.log("at backend getAnnouncements");
    const announcements = await Announcement.getAll();
    console.log("all announcements", announcements);
    res.status(200).json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
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