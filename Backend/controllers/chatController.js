// controllers/chatController.js
import pool from "../config/datebase.js";

const chatController = {
  // Fetch all users for chat room creation
  async getChatUsers(req, res) {
    try {
      // console.log("request got ",req);
      // Get the authenticated user's ID from the token
      const authenticatedUserId = req.user.userId;

      // Fetch all approved users except the authenticated user
      const result = await pool.query(
        `SELECT id, full_name, mobile_number 
         FROM users 
         WHERE is_approved = TRUE AND id != $1 
         ORDER BY full_name`,
        [authenticatedUserId]
      );
      // console.log("approved users are ",result.rows);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching chat users:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  // Create a new chat room
  async createChatRoom(req, res) {
    const client = await pool.connect();

    try {
      // Start a transaction
      await client.query('BEGIN');

      // Get data from request
      const { room_name, room_description, is_group, user_ids } = req.body;
      const createdBy = req.user.id;

      // Insert new chat room
      const roomResult = await client.query(
        `INSERT INTO chat_rooms 
         (room_name, room_description, is_group, created_by) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [room_name, room_description || null, is_group || false, createdBy]
      );

      const roomId = roomResult.rows[0].id;

      // Add users to the room
      const userInsertPromises = user_ids.map(userId => 
        client.query(
          `INSERT INTO chat_room_users 
           (room_id, user_id, is_admin, can_send_message) 
           VALUES ($1, $2, $3, $4)`,
          [roomId, userId, userId === createdBy, true]
        )
      );

      // Also add the creator to the room
      await Promise.all(userInsertPromises);

      // Commit the transaction
      await client.query('COMMIT');

      res.status(201).json({ 
        id: roomId, 
        room_name, 
        room_description, 
        is_group 
      });
    } catch (error) {
      // Rollback the transaction in case of error
      await client.query('ROLLBACK');
      console.error('Error creating chat room:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    } finally {
      client.release();
    }
  },

  // Fetch chat rooms for a user
  async getChatRooms(req, res) {
    try {
      console.log("request got ",req.user);
      const userId = req.user.userId;

      // Fetch rooms where the user is a member
      const result = await pool.query(
        `SELECT cr.id, cr.room_name, cr.room_description, cr.is_group
         FROM chat_rooms cr
         JOIN chat_room_users cru ON cr.id = cru.room_id
         WHERE cru.user_id = $1
         ORDER BY cr.created_on DESC`,
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
};

export default chatController;