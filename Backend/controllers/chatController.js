// Chat Controller
import { stringify } from "postcss";
import pool from "../config/database.js";
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
  async getChatRoomDetails(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);

      // First check if user is a member of this room
      const memberCheck = await pool.query(
        `SELECT 1 FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2`,
        [roomIdInt, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You are not a member of this chat room" 
        });
      }

      // Get room details
      const roomResult = await pool.query(
        `SELECT cr."roomId", cr."roomName", cr."roomDescription", cr."isGroup", cr."createdOn",
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

      // Get recent messages with mediaFiles
      const messagesResult = await pool.query(
        `SELECT m."id", m."messageText",m."messageType", m."mediaFilesId",m."pollId",m."tableId", m."createdAt", 
                u."userId" as "senderId", u."fullName" as "senderName"
        FROM chatmessages m
        JOIN "users" u ON m."senderId" = u."userId"
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
        `SELECT 1 FROM chatroomusers 
        WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
        [roomIdInt, userId]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ 
          message: "You don't have permission to add members to this room" 
        });
      }

      // Check if room exists
      const roomCheck = await client.query(
        `SELECT 1 FROM chatrooms WHERE "roomId" = $1`,
        [roomIdInt]
      );

      if (roomCheck.rows.length === 0) {
        return res.status(404).json({ message: "Chat room not found" });
      }

      // Check if all userIds exist
      const userCheckResult = await client.query(
        `SELECT "userId" FROM "users" WHERE "userId" = ANY($1)`,
        [userIds]
      );

      const foundUserIds = userCheckResult.rows.map(row => row.userId);
      const missingUserIds = userIds.filter(id => !foundUserIds.includes(id));

      if (missingUserIds.length > 0) {
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
          VALUES ($1, $2, FALSE, TRUE)`,
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
      let { messageText, mediaFiles, messageType, mediaFilesId,pollId,tableId } = req.body; // Also receive mediaFiles
      console.log("Message text",messageText);
      console.log("Media files",mediaFiles);
      console.log("Message type",messageType);
      console.log("Media files id",mediaFilesId);
      console.log("Poll id is ",pollId);
      console.log("Table id is ",tableId);
      if(!mediaFilesId) mediaFilesId=null;
      if(!pollId) pollId=null;
      if(!tableId) tableId=null;
      const senderId = req.user.userId;

      // const messageType="text"
      // if(mediaFiles) messageType="media";
      
      // Convert roomId to integer
      const roomIdInt = parseInt(roomId, 10);
      
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

        //store caption in media table
        if (mediaFiles) {
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

        

        //first insert the basic message
        let result = await pool.query(
          `INSERT INTO chatmessages ("roomId", "senderId", "messageText","messageType")
          VALUES ($1, $2, $3,$4)
          RETURNING *`,
          [roomIdInt, senderId, messageText,messageType]
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
      
      // Emit all messages to all users in the room
      if (io) {
        // Emit each message individually
        for (const message of messagesWithSender) {
          io.to(`room-${roomIdInt}`).emit('newMessage', {
            id: message.id,
            roomId: roomIdInt.toString(),
            messageText: message.messageText,
            messageType: messageType,
            mediaFilesId: mediaFilesId,
            pollId:pollId,
            tableId:tableId,
            createdAt: message.createdAt,
            sender: {
              userId: senderId,
              userName: senderName
            }
          });
          setTimeout(() => {
            console.log("message sent");
          }, 3000);
        }
        
        // Note: roomUpdate is now handled by socket.js to ensure proper unread count management
      }
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
  }
};
export default chatController;