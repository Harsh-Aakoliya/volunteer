// Chat Controller
import pool from "../config/datebase.js";

const chatController = {
  async getChatUsers(req, res) {
    try {
      const authenticatedUserId = req.user.userId;

      const result = await pool.query(
        `SELECT "userId", "fullName", "mobileNumber" 
         FROM "users" 
         WHERE "isApproved" = TRUE AND "userId" != $1 
         ORDER BY "fullName"`,
        [authenticatedUserId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching chat users:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

// Chat Controller - Updated createChatRoom function
async createChatRoom(req, res) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { roomName, roomDescription, isGroup, userIds } = req.body;
    const createdBy = req.user.userId;

    console.log("Creating room with:", {
      roomName,
      roomDescription,
      isGroup,
      userIds,
      createdBy
    });

    // Validate that createdBy exists
    if (!createdBy) {
      throw new Error("Creator ID is missing");
    }

    // Validate userIds array
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error("No valid user IDs provided");
    }

    // Filter out any empty or invalid userIds
    const validUserIds = userIds.filter(id => id && typeof id === 'string' && id.trim() !== '');

    if (validUserIds.length === 0) {
      throw new Error("No valid user IDs provided after filtering");
    }

    // Check if all userIds exist in the users table
    const userCheckResult = await client.query(
      `SELECT "userId" FROM "users" WHERE "userId" = ANY($1)`,
      [validUserIds]
    );

    const foundUserIds = userCheckResult.rows.map(row => row.userId);
    const missingUserIds = validUserIds.filter(id => !foundUserIds.includes(id));

    if (missingUserIds.length > 0) {
      throw new Error(`Some user IDs do not exist: ${missingUserIds.join(', ')}`);
    }

    // Insert the chat room
    const roomResult = await client.query(
      `INSERT INTO chatrooms 
       ("roomName", "roomDescription", "isGroup", "createdBy") 
       VALUES ($1, $2, $3, $4) 
       RETURNING "roomId"`,
      [roomName, roomDescription || null, isGroup || false, createdBy]
    );

    const roomId = roomResult.rows[0].roomId;

    // Add users to the room
    const userInsertPromises = validUserIds.map(userId => 
      client.query(
        `INSERT INTO chatroomusers 
         ("roomId", "userId", "isAdmin", "canSendMessage") 
         VALUES ($1, $2, $3, $4)`,
        [roomId, userId, userId === createdBy, true]
      )
    );

    // Make sure creator is also added to the room if not already in the list
    if (!validUserIds.includes(createdBy)) {
      userInsertPromises.push(
        client.query(
          `INSERT INTO chatroomusers 
           ("roomId", "userId", "isAdmin", "canSendMessage") 
           VALUES ($1, $2, $3, $4)`,
          [roomId, createdBy, true, true]
        )
      );
    }

    await Promise.all(userInsertPromises);
    await client.query('COMMIT');

    res.status(201).json({ 
      id: roomId, 
      roomName, 
      roomDescription, 
      isGroup 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating chat room:', error);
    res.status(500).json({ 
      message: "Failed to create chat room", 
      error: error.message 
    });
  } finally {
    client.release();
  }
},

  async getChatRooms(req, res) {
    try {
      console.log("request got ", req.user);
      const userId = req.user.userId;

      const result = await pool.query(
        `SELECT cr."roomId" as id, cr."roomName", cr."roomDescription", cr."isGroup"
         FROM chatrooms cr
         JOIN chatroomusers cru ON cr."roomId" = cru."roomId"
         WHERE cru."userId" = $1
         ORDER BY cr."createdOn" DESC`,
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