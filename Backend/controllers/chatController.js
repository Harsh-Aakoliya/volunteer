// Chat Controller
// import { stringify } from "postcss";
import pool from "../config/database.js";
const chatController = {
  async getChatUsers(req, res) {
    try {
      const authenticatedUserId = req.user.userId;

      // Get current user's information to check department and admin status
      const currentUserResult = await pool.query(
        `SELECT "isAdmin", "departments", "departmentIds" FROM "users" WHERE "userId" = $1`,
        [authenticatedUserId]
      );

      if (currentUserResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentUser = currentUserResult.rows[0];
      const isKaryalay = currentUser.isAdmin && currentUser.departments && currentUser.departments.includes("Karyalay");
      
      let query;
      let params;

      if (isKaryalay) {
        // Karyalay admin can see all users from all departments
        query = `SELECT "userId", "fullName", "mobileNumber", "departments" 
                 FROM "users" 
                 WHERE "isApproved" = TRUE AND "userId" != $1 
                 ORDER BY "fullName"`;
        params = [authenticatedUserId];
      } else if (currentUser.isAdmin) {
        // HOD can see users from departments they are HOD of
        const hodDepartmentsResult = await pool.query(`
          SELECT "departmentId" FROM "departments" WHERE $1 = ANY("hodList")
        `, [authenticatedUserId]);
        
        if (hodDepartmentsResult.rows.length === 0) {
          return res.status(403).json({ message: 'User is not HOD of any department' });
        }
        
        const hodDepartmentIds = hodDepartmentsResult.rows.map(row => row.departmentId);
        
        query = `SELECT "userId", "fullName", "mobileNumber", "departments" 
                 FROM "users" 
                 WHERE "isApproved" = TRUE AND "userId" != $1 
                 AND ("departmentIds" && $2 OR EXISTS (
                   SELECT 1 FROM "departments" d 
                   WHERE d."departmentId" = ANY($2) 
                   AND $1 = ANY(d."userList")
                 ))
                 ORDER BY "fullName"`;
        params = [authenticatedUserId, hodDepartmentIds];
      } else {
        // Regular users can see all users (existing behavior for non-admin users)
        query = `SELECT "userId", "fullName", "mobileNumber", "departments" 
                 FROM "users" 
                 WHERE "isApproved" = TRUE AND "userId" != $1 
                 ORDER BY "fullName"`;
        params = [authenticatedUserId];
      }

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching chat users:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
  async getChatRooms(req, res) {
    try {
      console.log("request got ", req.user);
      const userId = req.user.userId;
      
      const result = await pool.query(
        `SELECT cr."roomId" as id, cr."roomName", cr."roomDescription", cr."isGroup", 
                cr."createdBy", cr."createdOn", cru."isAdmin", 
                CASE WHEN cru."isAdmin" = TRUE THEN TRUE ELSE FALSE END as "canSendMessage"
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
  // Chat Controller - Updated createChatRoom function
  async createChatRoom(req, res) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let { roomName, roomDescription, isGroup, userIds } = req.body;
      const createdBy = req.user.userId;

      console.log("Creating room with:", {
        roomName,
        roomDescription,
        isGroup,
        userIds,
        createdBy
      });
      userIds=new Set(userIds);
      userIds=Array.from(userIds);

      // Validate that createdBy exists
      if (!createdBy) {
        throw new Error("Creator ID is missing");
      }

      // Validate userIds array
      if (!userIds || userIds.length === 0) {
        throw new Error("No valid user IDs provided");
      }

      // Filter out any empty or invalid userIds
      const validUserIds = Array.from(userIds);

      if (validUserIds.length === 0) {
        throw new Error("No valid user IDs provided after filtering");
      }

      // Get current user's department and admin status for access control
      const currentUserResult = await client.query(
        `SELECT "isAdmin", "departments" FROM "users" WHERE "userId" = $1`,
        [createdBy]
      );

      if (currentUserResult.rows.length === 0) {
        throw new Error("Creator user not found");
      }

      const currentUser = currentUserResult.rows[0];

      // Check if all userIds exist and validate department access
      let userCheckQuery;
      let userCheckParams;

      if (currentUser.isAdmin && currentUser.departments.includes("Karyalay")) {
        // Karyalay admin can add users from any department
        userCheckQuery = `SELECT "userId", "departments" FROM "users" WHERE "userId" = ANY($1)`;
        userCheckParams = [validUserIds];
      } else if (currentUser.isAdmin && !currentUser.departments.includes("Karyalay")) {
        // HOD can only add users from their own department
        userCheckQuery = `SELECT "userId", "departments" FROM "users" WHERE "userId" = ANY($1) AND "departments" && $2`;
        userCheckParams = [validUserIds, currentUser.departments];
      } else {
        // Regular users can add any user (existing behavior)
        userCheckQuery = `SELECT "userId", "departments" FROM "users" WHERE "userId" = ANY($1)`;
        userCheckParams = [validUserIds];
      }

      const userCheckResult = await client.query(userCheckQuery, userCheckParams);

      const foundUserIds = userCheckResult.rows.map(row => row.userId);
      const missingUserIds = validUserIds.filter(id => !foundUserIds.includes(id));

      if (missingUserIds.length > 0) {
        // Provide specific error message for department access restrictions
          if (currentUser.isAdmin && !currentUser.departments.includes("Karyalay")) {
          throw new Error(`You can only add users from your department (${currentUser.departments}). Some selected users are not from your department or don't exist: ${missingUserIds.join(', ')}`);
        }
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
      const userInsertPromises = validUserIds.map(userId => {
        const isAdmin = userId === createdBy;
        return client.query(
          `INSERT INTO chatroomusers 
          ("roomId", "userId", "isAdmin", "canSendMessage") 
          VALUES ($1, $2, $3, $4)`,
          [roomId, userId, isAdmin, isAdmin] // canSendMessage = isAdmin (only admins can send messages)
        );
      });

      // Make sure creator is also added to the room if not already in the list
      if (!validUserIds.includes(createdBy)) {
        userInsertPromises.push(
          client.query(
            `INSERT INTO chatroomusers 
            ("roomId", "userId", "isAdmin", "canSendMessage") 
            VALUES ($1, $2, $3, $4)`,
            [roomId, createdBy, true, true] // Creator is always admin and can send messages
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
  async getChatRoomDetails(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);

      // First check if user is a member of this room
      const memberCheck = await pool.query(
        `SELECT * FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, userId]
      );
      console.log(memberCheck.rows);

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You are not a member of this chat room" 
        });
      }

      // Get room details
      const roomResult = await pool.query(
        `SELECT cr."roomId", cr."roomName", cr."roomDescription", cr."isGroup", 
                cr."createdOn",
                u."fullName" as "creatorName", cr."createdBy" = $2 as "isCreator"
        FROM chatrooms cr
        JOIN "users" u ON cr."createdBy" = u."userId"
        WHERE cr."roomId" = $1`,
        [roomIdInt, userId]
      );

      if (roomResult.rows.length === 0) {
        return res.status(404).json({ message: "Chat room not found" });
      }

      // Get room members
      const membersResult = await pool.query(
        `SELECT u."userId", u."fullName", u."mobileNumber", cru."isAdmin", cru."canSendMessage"
        FROM chatroomusers cru
        JOIN "users" u ON cru."userId" = u."userId"
        WHERE cru."roomId" = $1
        ORDER BY cru."isAdmin" DESC, u."fullName"`,
        [roomIdInt]
      );

      // Get recent messages with mediaFiles, edit information, and reply information
      const messagesResult = await pool.query(
        `SELECT m."id", m."messageText", m."messageType", m."mediaFilesId", m."pollId", m."tableId", 
                m."createdAt", 
                m."isEdited", 
                m."editedAt", 
                m."editedBy", m."replyMessageId",
                u."userId" as "senderId", u."fullName" as "senderName",
                e."fullName" as "editorName",
                rm."messageText" as "replyMessageText", rm."messageType" as "replyMessageType",
                ru."fullName" as "replySenderName"
        FROM chatmessages m
        JOIN "users" u ON m."senderId" = u."userId"
        LEFT JOIN "users" e ON m."editedBy" = e."userId"
        LEFT JOIN chatmessages rm ON m."replyMessageId" = rm."id"
        LEFT JOIN "users" ru ON rm."senderId" = ru."userId"
        WHERE m."roomId" = $1
        ORDER BY m."createdAt" DESC
        LIMIT 20`,
        [roomIdInt]
      );
      
      // Parse mediaFiles for each message if it exists
      // for (const message of messagesResult.rows) {
      //   if (message.mediaFilesId) {
      //     try {
      //       message.mediaFiles = JSON.parse(message.mediaFiles);
      //     } catch (err) {
      //       console.error('Error parsing mediaFiles:', err);
      //       message.mediaFiles = [];
      //     }
      //   }
      // }

      // Check if current user is admin
      const isAdminResult = await pool.query(
        `SELECT "isAdmin" FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, userId]
      );
      
      const isAdmin = isAdminResult.rows.length > 0 ? isAdminResult.rows[0].isAdmin : false;

      // Combine all data into a single response
      const roomDetails = {
        ...roomResult.rows[0],
        isAdmin,
        members: membersResult.rows,
        messages: messagesResult.rows.reverse() // Return in chronological order
      };

      res.json(roomDetails);
    } catch (error) {
      console.error('Error fetching chat room details:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
  // Update room details
  async updateChatRoom(req, res) {
    try {
      const { roomId } = req.params;
      const { roomName, roomDescription } = req.body;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);

      // Check if user is an admin of this room
      const adminCheck = await pool.query(
        `SELECT 1 FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
        [roomIdInt, userId]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You don't have permission to update this room" 
        });
      }

      // Update room details
      await pool.query(
        `UPDATE chatrooms 
        SET "roomName" = $1, "roomDescription" = $2
        WHERE "roomId" = $3`,
        [roomName, roomDescription, roomIdInt]
      );

      res.json({ 
        message: "Room updated successfully",
        roomId: roomIdInt,
        roomName,
        roomDescription
      });
    } catch (error) {
      console.error('Error updating chat room:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
  // Update the addRoomMembers function in your chatController.js
  async addRoomMembers(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { roomId } = req.params;
      const { userIds } = req.body;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);
      
      console.log("Adding members to room:", {
        roomId: roomIdInt,
        userIds,
        requestingUser: userId
      });

      // Check if user is an admin of this room
      const adminCheck = await client.query(
        `SELECT * FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
        [roomIdInt, userId]
      );
      console.log(adminCheck.rows);

      if (adminCheck.rows.length === 0) {
        console.log("Admin check failed");
        return res.status(403).json({ 
          message: "You don't have permission to add members to this room" 
        });
      }

      // Check if room exists
      const roomCheck = await client.query(
        `SELECT * FROM chatrooms WHERE "roomId" = $1`,
        [roomIdInt]
      );

      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ message: "Chat room not found" });
      }

      // Get current user's department and admin status for access control
      const currentUserResult = await client.query(
        `SELECT "isAdmin", "departments" FROM "users" WHERE "userId" = $1`,
        [userId]
      );

      if (currentUserResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentUser = currentUserResult.rows[0];

      // Check if all userIds exist and validate department access
      let userCheckQuery;
      let userCheckParams;

      if (currentUser.isAdmin && currentUser.departments.includes("Karyalay")) {
        // Karyalay admin can add users from any department
        userCheckQuery = `SELECT "userId", "departments" FROM "users" WHERE "userId" = ANY($1)`;
        userCheckParams = [userIds];
      } else if (currentUser.isAdmin && !currentUser.departments.includes("Karyalay")) {
        // HOD can only add users from their own department
        userCheckQuery = `SELECT "userId", "departments" FROM "users" WHERE "userId" = ANY($1) AND "departments" && $2`;
        userCheckParams = [userIds, currentUser.departments];
      } else {
        // Regular users can add any user (existing behavior)
        userCheckQuery = `SELECT "userId", "departments" FROM "users" WHERE "userId" = ANY($1)`;
        userCheckParams = [userIds];
      }

      const userCheckResult = await client.query(userCheckQuery, userCheckParams);

      const foundUserIds = userCheckResult.rows.map(row => row.userId);
      const missingUserIds = userIds.filter(id => !foundUserIds.includes(id));

      if (missingUserIds.length > 0) {
        // Provide specific error message for department access restrictions
        if (currentUser.isAdmin && !currentUser.departments.includes("Karyalay")) {
          console.log("Admin check failed here1");
          return res.status(403).json({ 
            message: `You can only add users from your department (${currentUser.departments.join(', ')}). Some selected users are not from your department or don't exist.`,
            invalidUserIds: missingUserIds
          });
        }
        return res.status(400).json({
          message: `Some user IDs do not exist: ${missingUserIds.join(', ')}`
        });
      }

      // Check which users are already members
      const existingMembersResult = await client.query(
        `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1 AND "userId" = ANY($2)`,
        [roomIdInt, userIds]
      );

      const existingMemberIds = existingMembersResult.rows.map(row => row.userId);
      const newMemberIds = userIds.filter(id => !existingMemberIds.includes(id));

      if (newMemberIds.length === 0) {
        return res.status(400).json({
          message: "All specified users are already members of this room"
        });
      }

      console.log("Adding new members:", newMemberIds);

      // Add new members
      const insertPromises = newMemberIds.map(memberId => 
        client.query(
          `INSERT INTO chatroomusers ("roomId", "userId", "isAdmin", "canSendMessage")
          VALUES ($1, $2, FALSE, FALSE)`,
          [roomIdInt, memberId]
        )
      );

      await Promise.all(insertPromises);
      await client.query('COMMIT');

      res.status(201).json({
        message: "Members added successfully",
        addedMembers: newMemberIds,
        alreadyMembers: existingMemberIds
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding room members:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    } finally {
      client.release();
    }
  },
  // Update member permissions
  async updateRoomMember(req, res) {
    try {
      const { roomId, memberId } = req.params;
      const { isAdmin } = req.body;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);

      // Check if user is an admin of this room
      const adminCheck = await pool.query(
        `SELECT 1 FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
        [roomIdInt, userId]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You don't have permission to update member permissions" 
        });
      }

      // Check if the member exists in the room
      const memberCheck = await pool.query(
        `SELECT 1 FROM chatroomusers WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, memberId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(404).json({ message: "Member not found in this room" });
      }

      // Update member permissions
      await pool.query(
        `UPDATE chatroomusers 
        SET "isAdmin" = $1
        WHERE "roomId" = $2 AND "userId" = $3`,
        [isAdmin, roomIdInt, memberId]
      );

      res.json({ 
        message: "Member permissions updated successfully",
        roomId: roomIdInt,
        memberId,
        isAdmin
      });
    } catch (error) {
      console.error('Error updating room member:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
  // Remove a member from a room
  async removeRoomMember(req, res) {
    try {
      const { roomId, memberId } = req.params;
      let userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);
      console.log("Removing member:", {
        roomId: roomIdInt,
        memberId,
        requestingUser: userId
      });

      // First, let's check what members are actually in the room
      const allMembersQuery = await pool.query(
        `SELECT * FROM chatroomusers WHERE "roomId" = $1`,
        [roomIdInt]
      );
      console.log("All members in room:", allMembersQuery.rows);

      // Check if user is an admin of this room or is removing themselves
      if (userId !== memberId) {
        const adminCheck = await pool.query(
          `SELECT 1 FROM chatroomusers 
          WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
          [roomIdInt, userId]
        );
        
        if (adminCheck.rows.length === 0) {
          return res.status(403).json({ 
            message: "You don't have permission to remove this member" 
          });
        }
      }

      // Try different approaches to find the member
      
      // 1. Exact match
      const exactMatchQuery = await pool.query(
        `SELECT * FROM chatroomusers WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, memberId]
      );
      console.log("Exact match result:", exactMatchQuery.rows);
      
      // 2. Case-insensitive match
      const caseInsensitiveQuery = await pool.query(
        `SELECT * FROM chatroomusers WHERE "roomId" = $1 AND LOWER("userId") = LOWER($2)`,
        [roomIdInt, memberId]
      );
      console.log("Case insensitive result:", caseInsensitiveQuery.rows);
      
      // 3. Trimmed match
      const trimmedQuery = await pool.query(
        `SELECT * FROM chatroomusers WHERE "roomId" = $1 AND TRIM("userId") = TRIM($2)`,
        [roomIdInt, memberId]
      );
      console.log("Trimmed result:", trimmedQuery.rows);
      
      // 4. Using LIKE
      const likeQuery = await pool.query(
        `SELECT * FROM chatroomusers WHERE "roomId" = $1 AND "userId" LIKE $2`,
        [roomIdInt, memberId]
      );
      console.log("LIKE result:", likeQuery.rows);

      // Determine which approach found the member
      let memberExists = false;
      let memberRow = null;
      
      if (exactMatchQuery.rows.length > 0) {
        memberExists = true;
        memberRow = exactMatchQuery.rows[0];
        console.log("Found member with exact match");
      } else if (caseInsensitiveQuery.rows.length > 0) {
        memberExists = true;
        memberRow = caseInsensitiveQuery.rows[0];
        console.log("Found member with case-insensitive match");
      } else if (trimmedQuery.rows.length > 0) {
        memberExists = true;
        memberRow = trimmedQuery.rows[0];
        console.log("Found member with trimmed match");
      } else if (likeQuery.rows.length > 0) {
        memberExists = true;
        memberRow = likeQuery.rows[0];
        console.log("Found member with LIKE match");
      }

      if (!memberExists) {
        return res.status(404).json({ 
          message: "Member not found in this room" 
        });
      }

      // Use the actual userId from the database for the DELETE operation
      const actualUserId = memberRow.userId;
      
      console.log("Removing member with userId:", actualUserId);

      // Remove the member
      const deleteResult = await pool.query(
        `DELETE FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2
        RETURNING *`,
        [roomIdInt, actualUserId]
      );
      
      console.log("Delete result:", deleteResult.rows);

      if (deleteResult.rows.length === 0) {
        return res.status(500).json({ 
          message: "Failed to remove member" 
        });
      }

      res.json({ 
        message: "Member removed successfully",
        roomId: roomIdInt,
        memberId: actualUserId
      });
    } catch (error) {
      console.error('Error removing room member:', error);
      res.status(500).json({ 
        message: "Server error", 
        error: error.message 
      });
    }
  },
  // Delete a room
  async deleteChatRoom(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { roomId } = req.params;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);

      // Check if user is the creator of this room
      const creatorCheck = await client.query(
        `SELECT 1 FROM chatrooms 
        WHERE "roomId" = $1 AND "createdBy" = $2`,
        [roomIdInt, userId]
      );

      if (creatorCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "Only the room creator can delete this room" 
        });
      }

      // Delete all messages in the room
      await client.query(
        `DELETE FROM chatmessages WHERE "roomId" = $1`,
        [roomIdInt]
      );

      // Delete all user associations
      await client.query(
        `DELETE FROM chatroomusers WHERE "roomId" = $1`,
        [roomIdInt]
      );

      // Delete the room itself
      await client.query(
        `DELETE FROM chatrooms WHERE "roomId" = $1`,
        [roomIdInt]
      );

      await client.query('COMMIT');

      res.json({ 
        message: "Room deleted successfully",
        roomId: roomIdInt
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting chat room:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    } finally {
      client.release();
    }
  },
  async updateRoomSettings(req, res) {
    try {
      const { roomId } = req.params;
      const { roomName, roomDescription } = req.body;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);

      // Check if user is an admin of this room
      const adminCheck = await pool.query(
        `SELECT 1 FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
        [roomIdInt, userId]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You don't have permission to update room settings" 
        });
      }

      // Update room details
      await pool.query(
        `UPDATE chatrooms 
        SET "roomName" = $1, "roomDescription" = $2
        WHERE "roomId" = $3`,
        [roomName, roomDescription, roomIdInt]
      );

      res.json({ 
        message: "Room settings updated successfully",
        roomId: roomIdInt,
        roomName,
        roomDescription
      });
    } catch (error) {
      console.error('Error updating room settings:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
  async sendMessage(req, res) {
    try {
      const { roomId } = req.params;
      console.log("req body ",req.body);
      let { messageText, mediaFiles, messageType, mediaFilesId,pollId,tableId, replyMessageId } = req.body; // Also receive mediaFiles and replyMessageId
      console.log("Message text",messageText);
      console.log("Media files",mediaFiles);
      console.log("Message type",messageType);
      console.log("Media files id",mediaFilesId);
      console.log("Poll id is ",pollId);
      console.log("Table id is ",tableId);
      console.log("Reply message id is ",replyMessageId);
      if(!mediaFilesId) mediaFilesId=null;
      if(!pollId) pollId=null;
      if(!tableId) tableId=null;
      if(!replyMessageId) replyMessageId=null;
      const senderId = req.user.userId;

      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);
      
      // Check if user is a group admin of this room before allowing message sending
      const groupAdminCheck = await pool.query(
        `SELECT "isAdmin" FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, senderId]
      );

      if (groupAdminCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You are not a member of this chat room" 
        });
      }

      const isGroupAdmin = groupAdminCheck.rows[0].isAdmin;
      if (!isGroupAdmin) {
        return res.status(403).json({ 
          message: "Only group admins can send messages in this room" 
        });
      }
      
      let newMessages = [];

      // If we have mediaFiles with optional message property,
      // each becomes a separate message
      // if (mediaFiles && mediaFiles.length > 0) {
      //   // Begin transaction for multiple inserts
      //   const client = await pool.connect();
      //   try {
      //     await client.query('BEGIN');

      //     // Process each media file as a separate message
      //     for (const mediaFile of mediaFiles) {
      //       // Use the message from the media file or empty string if not provided
      //       const msgText = mediaFile.message || "";
      //       // Remove the message property from mediaFile to avoid duplication
      //       const { message, ...mediaFileWithoutMessage } = mediaFile;
            
      //       // Insert the message with a single media file
      //       const result = await client.query(
      //         `INSERT INTO chatmessages ("roomId", "senderId", "messageText", "mediaFiles")
      //          VALUES ($1, $2, $3, $4)
      //          RETURNING *`,
      //         [
      //           roomIdInt, 
      //           senderId, 
      //           msgText, 
      //           JSON.stringify([mediaFileWithoutMessage])
      //         ]
      //       );

      //       const newMessage = result.rows[0];
            
      //       // Parse mediaFiles
      //       if (newMessage.mediaFiles) {
      //         try {
      //           newMessage.mediaFiles = JSON.parse(newMessage.mediaFiles);
      //         } catch (err) {
      //           console.error('Error parsing mediaFiles:', err);
      //           newMessage.mediaFiles = [];
      //         }
      //       }
            
      //       newMessages.push(newMessage);
      //     }

      //     await client.query('COMMIT');
      //   } catch (error) {
      //     await client.query('ROLLBACK');
      //     throw error;
      //   } finally {
      //     client.release();
      //   }
      // } else {
        // Traditional single message without media files or with all media files in one message

        //store caption in media table (for old media upload system)
        if (mediaFiles && messageType !== "media") {
          // Step 1: Get current driveUrlObject array from DB
          const { rows } = await pool.query(
            `SELECT "driveUrlObject" FROM media WHERE id = $1`,
            [mediaFilesId]
          );

          if (rows.length === 0) {
            throw new Error('Media row not found');
          }

          let driveUrlObject = rows[0].driveUrlObject;

          // Step 2: Update captions by matching IDs
          driveUrlObject = driveUrlObject.map((item) => {
            const match = mediaFiles.find((mf) => mf.id === item.id);
            if (match) {
              return { ...item, caption: match.caption };
            }
            return item;
          });

          // Step 3: Save updated JSONB array back to DB
          await pool.query(
            `UPDATE media SET "driveUrlObject" = $1 WHERE id = $2`,
            [JSON.stringify(driveUrlObject), mediaFilesId]
          );

        }
        
        // For VM media, the media entry and message are already created by vmMediaController
        // So we don't need to update anything here

        

        //first insert the basic message
        let result = await pool.query(
          `INSERT INTO chatmessages ("roomId", "senderId", "messageText","messageType", "replyMessageId", "createdAt")
          VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'UTC')
          RETURNING *`,
          [roomIdInt, senderId, messageText, messageType, replyMessageId]
        );
        let newMessage = result.rows[0];

        //then insert the media files id
        if(mediaFiles || pollId || tableId){
          console.log("table id here is ",tableId);
          const here = await pool.query(
            `UPDATE chatmessages SET "mediaFilesId" = $1, "pollId" = $2, "tableId" = $3 WHERE "id" = $4
            Returning *
            `,
            [mediaFilesId,pollId,tableId, result.rows[0].id]
          );
          // console.log()
          console.log("new message after updating is",here.rows[0]);
          newMessage=here.rows[0];
          console.log("new message;asdljf;alsdjf",newMessage);
        }
        
        // Parse mediaFiles if exists
        // if (newMessage.mediaFiles) {
        //   try {
        //     newMessage.mediaFiles = JSON.parse(newMessage.mediaFiles);
        //   } catch (err) {
        //     console.error('Error parsing mediaFiles:', err);
        //     newMessage.mediaFiles = [];
        //   }
        // }
        
        newMessages.push(newMessage);
      // }
      console.log("new messagess",newMessages);
      
      // Get sender information
      const senderResult = await pool.query(
        `SELECT "fullName" FROM users WHERE "userId" = $1`,
        [senderId]
      );
      
      const senderName = senderResult.rows[0]?.fullName || 'Unknown User';
      
      // Add sender name to all messages
      const messagesWithSender = newMessages.map(msg => ({
        ...msg,
        senderName
      }));
      
      // Get the io instance and other app data
      const io = req.app.get('io');
      const lastMessageByRoom = req.app.get('lastMessageByRoom');
      const unreadMessagesByUser = req.app.get('unreadMessagesByUser');
      
      // If multiple messages were created, use the last one as the last message for the room
      const lastMessage = messagesWithSender[messagesWithSender.length - 1];
      
      // Update last message for this room
      if (lastMessageByRoom) {
        lastMessageByRoom[roomIdInt] = {
          id: lastMessage.id,
          messageText: lastMessage.messageText,
          createdAt: lastMessage.createdAt,
          messageType: messageType,
          mediaFilesId: mediaFilesId,
          pollId:pollId,
          tableId:tableId,
          replyMessageId: replyMessageId,
          sender: {
            userId: senderId,
            userName: senderName
          }
        };
      }
      
      // Get all members of the room
      const membersResult = await pool.query(
        `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1`,
        [roomIdInt]
      );
      
      const memberIds = membersResult.rows.map(row => row.userId);
      
      // Note: Unread count is now handled by socket.js to avoid double counting
      
      // Note: Message emission is now handled by socket.js to avoid duplicates
      // The socket.js file handles the newMessage emission when sendMessage event is received
      console.log("Message with sender",messagesWithSender);
      // Return all created messages or just the last message
      // Depending on the use case, you might want to return all or just the last one
      res.status(201).json(messagesWithSender.length === 1 ? messagesWithSender[0] : messagesWithSender);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
  // Add a new function to get online users for a room
  async getRoomOnlineUsers(req, res) {
    try {
      const { roomId } = req.params;
      const roomIdInt = parseInt(roomId, 10);
      
      // Get the io instance and online users
      const io = req.app.get('io');
      const onlineUsersByRoom = req.app.get('onlineUsersByRoom') || {};
      
      // Get online users for this room
      const onlineUsers = Array.from(onlineUsersByRoom[roomIdInt] || []);
      
      // Get all members of the room
      const membersResult = await pool.query(
        `SELECT u."userId", u."fullName", cru."isAdmin" 
        FROM chatroomusers cru
        JOIN "users" u ON cru."userId" = u."userId"
        WHERE cru."roomId" = $1`,
        [roomIdInt]
      );
      
      // Mark which members are online
      const members = membersResult.rows.map(member => ({
        ...member,
        isOnline: onlineUsers.includes(member.userId)
      }));
      
      res.json({
        roomId: roomIdInt,
        onlineUsers,
        totalMembers: membersResult.rows.length,
        members
      });
    } catch (error) {
      console.error('Error getting room online users:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  // Edit message function
  async editMessage(req, res) {
    try {
      const { roomId, messageId } = req.params;
      const { messageText } = req.body;
      const userId = req.user.userId;
      
      // Convert IDs to appropriate types
      const roomIdInt = parseInt(roomId, 10);
      
      // Handle both string and number message IDs
      let messageIdInt;
      if (typeof messageId === 'string') {
        // Check if it's a temporary message ID (starts with 'temp-')
        if (messageId.startsWith('temp-')) {
          return res.status(400).json({ 
            message: "Cannot edit temporary message" 
          });
        }
        messageIdInt = parseInt(messageId, 10);
      } else {
        messageIdInt = messageId;
      }
      
      // Validate that we have valid numbers
      if (isNaN(roomIdInt) || isNaN(messageIdInt)) {
        console.error('Invalid IDs:', { roomId, messageId, roomIdInt, messageIdInt });
        return res.status(400).json({ 
          message: `Invalid room ID (${roomId}) or message ID (${messageId})` 
        });
      }
      
      console.log('Editing message:', { roomId: roomIdInt, messageId: messageIdInt, messageText, userId });

      // Validate input
      if (!messageText || !messageText.trim()) {
        return res.status(400).json({ 
          message: "Message text cannot be empty" 
        });
      }

      // Check if user is a member of this room and get their admin status
      const memberCheck = await pool.query(
        `SELECT "isAdmin" FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You are not a member of this chat room" 
        });
      }

      const isGroupAdmin = memberCheck.rows[0].isAdmin;

      // Get the message to edit
      const messageResult = await pool.query(
        `SELECT "id", "senderId", "messageText", "messageType", "createdAt" 
        FROM chatmessages 
        WHERE "id" = $1 AND "roomId" = $2`,
        [messageIdInt, roomIdInt]
      );

      if (messageResult.rows.length === 0) {
        return res.status(404).json({
          message: "Message not found"
        });
      }

      const message = messageResult.rows[0];

      // Check if message is editable (only text messages can be edited)
      if (message.messageType !== 'text') {
        return res.status(400).json({
          message: "Only text messages can be edited"
        });
      }

      // Check permissions: user can edit their own messages OR group admin can edit any message
      if (message.senderId !== userId && !isGroupAdmin) {
        return res.status(403).json({
          message: "You can only edit your own messages"
        });
      }

      // Check if message text is actually different
      if (message.messageText === messageText.trim()) {
        return res.status(400).json({
          message: "No changes detected"
        });
      }

      // Update the message
      const updateResult = await pool.query(
        `UPDATE chatmessages 
        SET "messageText" = $1, "isEdited" = TRUE, "editedAt" = NOW() AT TIME ZONE 'UTC', "editedBy" = $2
        WHERE "id" = $3 AND "roomId" = $4
        RETURNING *`,
        [messageText.trim(), userId, messageIdInt, roomIdInt]
      );

      const updatedMessage = updateResult.rows[0];
      console.log("updatedMessage",updatedMessage);

      // Get sender information
      const senderResult = await pool.query(
        `SELECT "fullName" FROM users WHERE "userId" = $1`,
        [message.senderId]
      );
      
      const senderName = senderResult.rows[0]?.fullName || 'Unknown User';

      // Get editor information (if different from sender)
      let editorName = null;
      if (message.senderId !== userId) {
        const editorResult = await pool.query(
          `SELECT "fullName" FROM users WHERE "userId" = $1`,
          [userId]
        );
        editorName = editorResult.rows[0]?.fullName || 'Unknown User';
      }

      // Create the response message object
      const responseMessage = {
        ...updatedMessage,
        senderName,
        editorName
      };

      // Get the io instance for real-time updates
      const io = req.app.get('io');
      const lastMessageByRoom = req.app.get('lastMessageByRoom');

      // Update last message if this was the last message
      if (lastMessageByRoom && lastMessageByRoom[roomIdInt] && lastMessageByRoom[roomIdInt].id === messageIdInt) {
        lastMessageByRoom[roomIdInt] = {
          ...lastMessageByRoom[roomIdInt],
          messageText: messageText.trim(),
          isEdited: true,
          editedAt: updatedMessage.editedAt,
          editedBy: userId
        };
      }

      // Emit message edit event to all users in the room
      if (io) {
        io.to(`room-${roomIdInt}`).emit('messageEdited', {
          roomId: roomIdInt.toString(),
          messageId: messageIdInt,
          messageText: messageText.trim(),
          isEdited: true,
          editedAt: updatedMessage.editedAt,
          editedBy: userId,
          editorName: editorName,
          senderId: message.senderId,
          senderName: senderName
        });

        console.log(`Message edit event sent to room ${roomIdInt}`);
      }

      res.json({
        message: "Message edited successfully",
        editedMessage: responseMessage
      });

    } catch (error) {
      console.error('Error editing message:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  // Helper function to send room updates to all members for message deletion
  async sendRoomUpdateToMembersForDeletion(roomId, messageObj, memberIds, io, unreadMessagesByUser) {
    try {
      const allConnectedSockets = await io.fetchSockets();
      const userSocketMap = new Map();
      
      allConnectedSockets.forEach(socket => {
        if (socket.data?.userId) {
          if (!userSocketMap.has(socket.data.userId)) {
            userSocketMap.set(socket.data.userId, []);
          }
          userSocketMap.get(socket.data.userId).push(socket);
        }
      });

      memberIds.forEach(memberId => {
        const memberSockets = userSocketMap.get(memberId) || [];
        const unreadCount = unreadMessagesByUser[memberId]?.[roomId] || 0;
        
        memberSockets.forEach(memberSocket => {
          // Send last message update
          memberSocket.emit("lastMessage", {
            lastMessageByRoom: {
              [roomId]: messageObj
            }
          });

          // Send room update with unread count
          memberSocket.emit("roomUpdate", {
            roomId,
            lastMessage: messageObj,
            unreadCount: unreadCount
          });
        });
      });
    } catch (error) {
      console.error("Error sending room updates for deletion:", error);
    }
  },

  // Delete messages function
  async deleteMessages(req, res) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { roomId } = req.params;
      const { messageIds } = req.body;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);
      
      console.log('Deleting messages:', { roomId: roomIdInt, messageIds, userId });

      // Check if user is a member of this room and get their admin status
      const memberCheck = await client.query(
        `SELECT "isAdmin" FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You are not a member of this chat room" 
        });
      }

      const isGroupAdmin = memberCheck.rows[0].isAdmin;

      // Only allow group admins to delete messages
      if (!isGroupAdmin) {
        return res.status(403).json({
          message: "Only group admins can delete messages in this room"
        });
      }

      // Get the messages to validate existence
      const messagesToDelete = await client.query(
        `SELECT "id", "senderId", "messageText", "messageType", "createdAt" 
        FROM chatmessages 
        WHERE "id" = ANY($1) AND "roomId" = $2`,
        [messageIds, roomIdInt]
      );

      if (messagesToDelete.rows.length === 0) {
        return res.status(404).json({
          message: "No messages found to delete"
        });
      }

      // Group admins can delete any message in their room
      // Note: Removed the individual message permission check since group admins should be able to delete any message

      // Before deleting messages, we need to handle foreign key constraints
      // First, delete any associated media records that reference these messages
      console.log("Checking for associated media records...");
      
      // Get all media records that reference these messages
      const associatedMediaResult = await client.query(
        `SELECT id FROM media WHERE "messageId" = ANY($1)`,
        [messageIds]
      );
      
      const mediaIdsToDelete = associatedMediaResult.rows.map(row => row.id);
      
      if (mediaIdsToDelete.length > 0) {
        console.log("Found associated media records:", mediaIdsToDelete);
        
        // Step 1: Break the circular foreign key dependency by setting mediaFilesId to NULL
        // in chatmessages table first
        console.log("Breaking foreign key references in chatmessages...");
        await client.query(
          `UPDATE chatmessages SET "mediaFilesId" = NULL 
           WHERE "id" = ANY($1) AND "mediaFilesId" = ANY($2)`,
          [messageIds, mediaIdsToDelete]
        );
        
        // Step 2: Now we can safely delete the media records
        console.log("Deleting associated media records:", mediaIdsToDelete);
        await client.query(
          `DELETE FROM media WHERE id = ANY($1)`,
          [mediaIdsToDelete]
        );
        
        console.log(`Deleted ${mediaIdsToDelete.length} associated media records`);
      }

      // Delete the messages
      console.log("messageIds and roomId",messageIds,roomIdInt);
      const deleteResult = await client.query(
        `DELETE FROM chatmessages 
        WHERE "id" = ANY($1) AND "roomId" = $2
        RETURNING *`,
        [messageIds, roomIdInt]
      );

      const deletedMessages = deleteResult.rows;
      console.log('Deleted messages:', deletedMessages.length);

      // Get the io instance and other app data
      const io = req.app.get('io');
      const lastMessageByRoom = req.app.get('lastMessageByRoom');
      const unreadMessagesByUser = req.app.get('unreadMessagesByUser');

      // Check if we deleted the last message for this room
      let needToUpdateLastMessage = false;
      const currentLastMessage = lastMessageByRoom[roomIdInt];
      
      if (currentLastMessage && messageIds.includes(currentLastMessage.id)) {
        needToUpdateLastMessage = true;
      }

      // Get new last message if needed
      let newLastMessage = null;
      if (needToUpdateLastMessage) {
        const newLastMessageResult = await client.query(
          `SELECT m.*, u."fullName" as "senderName",
                  m."createdAt"
          FROM chatmessages m 
          JOIN "users" u ON m."senderId" = u."userId"
          WHERE m."roomId" = $1 
          ORDER BY m."createdAt" DESC 
          LIMIT 1`,
          [roomIdInt]
        );

        if (newLastMessageResult.rows.length > 0) {
          const lastMsg = newLastMessageResult.rows[0];
          newLastMessage = {
            id: lastMsg.id,
            messageText: lastMsg.messageText,
            messageType: lastMsg.messageType || 'text',
            createdAt: lastMsg.createdAt,
            sender: {
              userId: lastMsg.senderId,
              userName: lastMsg.senderName || 'Unknown'
            },
            mediaFilesId: lastMsg.mediaFilesId || null,
            pollId: lastMsg.pollId || null,
            tableId: lastMsg.tableId || null,
            roomId: roomIdInt.toString()
          };
          
          // Update last message cache
          lastMessageByRoom[roomIdInt] = newLastMessage;
        } else {
          // No messages left in room
          delete lastMessageByRoom[roomIdInt];
        }
      }

      // Get all members of the room for unread count updates
      const membersResult = await client.query(
        `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1`,
        [roomIdInt]
      );
      
      const memberIds = membersResult.rows.map(row => row.userId);

      // Update unread counts by decreasing count for deleted messages
      memberIds.forEach((memberId) => {
        if (unreadMessagesByUser[memberId] && unreadMessagesByUser[memberId][roomIdInt]) {
          // Count how many deleted messages were unread for this user
          let unreadDeletedCount = 0;
          deletedMessages.forEach(deletedMsg => {
            // If message was sent by someone else, it was potentially unread
            if (deletedMsg.senderId !== memberId) {
              unreadDeletedCount++;
            }
          });
          
          // Decrease unread count, but don't go below 0
          const currentUnread = unreadMessagesByUser[memberId][roomIdInt];
          unreadMessagesByUser[memberId][roomIdInt] = Math.max(0, currentUnread - unreadDeletedCount);
        }
      });

      await client.query('COMMIT');

      // Emit deletion events to all users in the room
      if (io) {
        // Emit message deletion to all users in the room
        io.to(`room-${roomIdInt}`).emit('messagesDeleted', {
          roomId: roomIdInt.toString(),
          messageIds: messageIds,
          deletedBy: userId
        });

        // If last message was updated, emit updates to all room members
        if (needToUpdateLastMessage) {
          await chatController.sendRoomUpdateToMembersForDeletion(roomIdInt, newLastMessage, memberIds, io, unreadMessagesByUser);
        }
      }

      res.json({
        message: "Messages deleted successfully",
        deletedCount: deletedMessages.length,
        newLastMessage: newLastMessage
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting messages:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    } finally {
      client.release();
    }
  },

  // Get message read status
  async getMessageReadStatus(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.userId;
      
      // Convert messageId to integer
      const messageIdInt = parseInt(messageId, 10);
      
      if (isNaN(messageIdInt)) {
        return res.status(400).json({ 
          message: "Invalid message ID" 
        });
      }

      // Get message details and room information
      const messageResult = await pool.query(
        `SELECT m."id", m."roomId", m."senderId", m."messageText", m."createdAt"
         FROM chatmessages m
         WHERE m."id" = $1`,
        [messageIdInt]
      );

      if (messageResult.rows.length === 0) {
        return res.status(404).json({ 
          message: "Message not found" 
        });
      }

      const message = messageResult.rows[0];
      const roomId = message.roomId;

      // Check if user is a member of this room
      const memberCheck = await pool.query(
        `SELECT 1 FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You are not a member of this chat room" 
        });
      }

      // Get all room members
      const membersResult = await pool.query(
        `SELECT u."userId", u."fullName"
         FROM chatroomusers cru
         JOIN "users" u ON cru."userId" = u."userId"
         WHERE cru."roomId" = $1 AND cru."userId" != $2`,
        [roomId, message.senderId] // Exclude sender from read status
      );

      // Get read status for each member
      const readStatusResult = await pool.query(
        `SELECT mrs."userId", mrs."readAt" as "readAt", u."fullName"
         FROM messagereadstatus mrs
         JOIN "users" u ON mrs."userId" = u."userId"
         WHERE mrs."messageId" = $1`,
        [messageIdInt]
      );

      const readBy = readStatusResult.rows.map(row => ({
        userId: row.userId,
        fullName: row.fullName,
        readAt: row.readAt
      }));

      // Find unread members
      const readUserIds = readStatusResult.rows.map(row => row.userId);
      const unreadBy = membersResult.rows
        .filter(member => !readUserIds.includes(member.userId))
        .map(member => ({
          userId: member.userId,
          fullName: member.fullName
        }));

      res.json({
        success: true,
        data: {
          readBy,
          unreadBy
        }
      });

    } catch (error) {
      console.error('Error fetching message read status:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  // Mark message as read
  async markMessageAsRead(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.userId;
      
      // Convert messageId to integer
      const messageIdInt = parseInt(messageId, 10);
      
      if (isNaN(messageIdInt)) {
        return res.status(400).json({ 
          message: "Invalid message ID" 
        });
      }

      // Get message details
      const messageResult = await pool.query(
        `SELECT m."id", m."roomId", m."senderId"
         FROM chatmessages m
         WHERE m."id" = $1`,
        [messageIdInt]
      );

      if (messageResult.rows.length === 0) {
        return res.status(404).json({ 
          message: "Message not found" 
        });
      }

      const message = messageResult.rows[0];
      const roomId = message.roomId;

      // Check if user is a member of this room
      const memberCheck = await pool.query(
        `SELECT 1 FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You are not a member of this chat room" 
        });
      }

      // Don't allow sender to mark their own message as read
      if (message.senderId === userId) {
        return res.status(400).json({ 
          message: "You cannot mark your own message as read" 
        });
      }

      // Insert or update read status
      await pool.query(
        `INSERT INTO messagereadstatus ("messageId", "userId", "roomId", "readAt")
         VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC')
         ON CONFLICT ("messageId", "userId") 
         DO UPDATE SET "readAt" = NOW() AT TIME ZONE 'UTC'`,
        [messageIdInt, userId, roomId]
      );

      res.json({
        success: true,
        message: "Message marked as read"
      });

    } catch (error) {
      console.error('Error marking message as read:', error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
};
export default chatController;