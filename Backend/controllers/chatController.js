// Chat Controller
import pool from "../config/database.js";
import fs from "fs";
import path from "path";

const chatController = {
    async getChatUsers(req, res) {
        try {
            const authenticatedUserId = Number(req.user.userId) || 0;

            // Get all users except current user
            const result = await pool.query(
                `SELECT "seid" as "userId", "sevakname" as "fullName", "mobileno" as "mobileNumber", "usertype" as "role"
                 FROM "SevakMaster"
                 WHERE "seid" != $1::integer
                 ORDER BY "sevakname"`,
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
            const userId = Number(req.user.userId) || 0;

            const result = await pool.query(
                `SELECT cr."roomId" as id, cr."roomName", cr."isactive", cr."createdby", cr."createdon",
                        cru."isAdmin", cru."canSendMessage"
                 FROM chatrooms cr
                          JOIN chatroomusers cru ON cr."roomId" = cru."roomId"
                 WHERE cru."userId" = $1::integer and cr."isactive" = 1
                 ORDER BY cr."createdon" DESC`,
                [userId]
            );

            // Get last message and unread count for each room
            const roomsWithDetails = await Promise.all(
                result.rows.map(async (room) => {
                    // Get last message
                    const lastMsgResult = await pool.query(
                        `SELECT m.id, m."messageText", m."messageType", m."createdAt",
                                m."mediaFilesId", m."pollId", m."tableId",
                                sm.seid::text as "senderId", sm.sevakname as "senderName"
                         FROM chatmessages m
                                  JOIN "SevakMaster" sm ON m."senderId"::integer = sm.seid
                         WHERE m."roomId" = $1 AND m."isScheduled" = FALSE
                         ORDER BY m."createdAt" DESC
                             LIMIT 1`,
                        [room.id]
                    );

                    // Get unread count
                    const unreadResult = await pool.query(
                        `SELECT COUNT(*) as count
                         FROM chatmessages m
                         WHERE m."roomId" = $1
                           AND m."senderId"::integer != $2
                           AND m."isScheduled" = FALSE
                           AND NOT EXISTS (
                             SELECT 1 FROM messagereadstatus mrs
                             WHERE mrs."messageId" = m.id AND mrs."userId" = $2::text
                             )`,
                        [room.id, userId]
                    );

                    const lastMessage = lastMsgResult.rows[0] ? {
                        id: lastMsgResult.rows[0].id,
                        messageText: lastMsgResult.rows[0].messageText,
                        messageType: lastMsgResult.rows[0].messageType || 'text',
                        createdAt: lastMsgResult.rows[0].createdAt,
                        roomId: room.id.toString(),
                        sender: {
                            userId: lastMsgResult.rows[0].senderId,
                            userName: lastMsgResult.rows[0].senderName,
                        },
                        mediaFilesId: lastMsgResult.rows[0].mediaFilesId,
                        pollId: lastMsgResult.rows[0].pollId,
                        tableId: lastMsgResult.rows[0].tableId,
                    } : null;

                    return {
                        ...room,
                        // Normalize canSendMessage to boolean
                        canSendMessage: room.canSendMessage === true || room.canSendMessage === 1,
                        isAdmin: room.isAdmin === true || room.isAdmin === 1,
                        lastMessage,
                        unreadCount: parseInt(unreadResult.rows[0]?.count || '0', 10),
                    };
                })
            );

            res.json(roomsWithDetails);
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
            const createdBy = Number(req.user.userId) || 0;

            console.log("Creating room with:", {
                roomName,
                roomDescription,
                isGroup,
                userIds,
                createdBy
            });

            // Check if user has permission to create rooms (only master or admin)
            const userRole = req.user.role;
            if (userRole !== 'master' && userRole !== 'admin') {
                return res.status(403).json({
                    message: "Only master and admin users can create chat rooms"
                });
            }

            userIds = new Set(userIds);
            userIds = Array.from(userIds);

            // Validate that createdBy exists
            if (!createdBy) {
                throw new Error("Creator ID is missing");
            }

            // Validate userIds array
            if (!userIds || userIds.length === 0) {
                throw new Error("No valid user IDs provided");
            }

            // Filter out any empty or invalid userIds
            const validUserIds = Array.from(userIds).map((id) => Number(id)).filter((id) => Number.isFinite(id));

            if (validUserIds.length === 0) {
                throw new Error("No valid user IDs provided after filtering");
            }

            // Get current user's information
            const currentUserResult = await client.query(
                `SELECT "seid", "usertype" FROM "SevakMaster" WHERE "seid" = $1`,
                [createdBy]
            );

            if (currentUserResult.rows.length === 0) {
                throw new Error("Creator user not found");
            }

            // Check if all userIds exist
            const userCheckResult = await client.query(
                `SELECT "seid" FROM "SevakMaster" WHERE "seid" = ANY($1::int[])`,
                [validUserIds]
            );

            const foundUserIds = userCheckResult.rows.map(row => Number(row.seid));
            const missingUserIds = validUserIds.filter(id => !foundUserIds.includes(id));

            if (missingUserIds.length > 0) {
                throw new Error(`Some user IDs do not exist: ${missingUserIds.join(', ')}`);
            }

            // Insert the chat room
            const roomResult = await client.query(
                `INSERT INTO chatrooms
                     ("roomName", "isactive", "createdon", "createdby")
                 VALUES ($1, $2, NOW() AT TIME ZONE 'UTC', $3)
                     RETURNING "roomId", "roomName", "isactive", "createdon", "createdby"`,
                [roomName, 1, createdBy]
            );

            const roomId = roomResult.rows[0].roomId;

            // Add users to the room
            const userInsertPromises = validUserIds.map(userId => {
                const isAdmin = userId === createdBy;
                return client.query(
                    `INSERT INTO chatroomusers
                     ("roomId", "userId", "isAdmin", "canSendMessage", "joinedAt", createdby)
                     VALUES ($1, $2, $3, $4, NOW() AT TIME ZONE 'UTC', $5)`,
                    [roomId, userId, isAdmin, isAdmin, createdBy]
                );
            });

            // Make sure creator is also added to the room if not already in the list
            if (!validUserIds.includes(createdBy)) {
                userInsertPromises.push(
                    client.query(
                        `INSERT INTO chatroomusers
                         ("roomId", "userId", "isAdmin", "canSendMessage", "joinedAt", createdby)
                         VALUES ($1, $2, $3, $4, NOW() AT TIME ZONE 'UTC', $5)`,
                        [roomId, createdBy, true, true, createdBy] // Creator is always admin and can send messages
                    )
                );
            }

            await Promise.all(userInsertPromises);
            await client.query('COMMIT');

            res.status(201).json({
                id: roomId,
                roomName: roomResult.rows[0].roomName,
                roomDescription: null,
                isGroup: true,
                isactive: roomResult.rows[0].isactive,
                createdBy: roomResult.rows[0].createdby,
                createdOn: roomResult.rows[0].createdon
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
            const userId = Number(req.user.userId) || 0;
            console.log("userId", userId);
            console.log("roomId", roomId);

            // Convert roomId to integer
            const roomIdInt = parseInt(roomId, 10);

            const result = await pool.query(
                `SELECT "seid", "canlogin" FROM "SevakMaster" WHERE "seid" = $1 and canlogin = 1`,
                [userId]
            );
            console.log("result in getChatRoomDetails", result.rows);

            if (result.rows.length === 0 || result.rows[0].canlogin !== 1) {
                return res.json({
                    isrestricted: true,
                    message: "You are not authorized to access this chat room"
                });
            }

            // First check if user is a member of this room
            const memberCheck = await pool.query(
                `SELECT * FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2`,
                [roomIdInt, userId]
            );
            console.log("member check in getChatRoomDetails", memberCheck.rows);

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({
                    message: "You are not a member of this chat room"
                });
            }

            // Get room details
            const roomResult = await pool.query(
                `SELECT "roomId", "roomName"
                 FROM chatrooms WHERE "roomId" = $1`,
                [roomIdInt]
            );
            console.log("room result in getChatRoomDetails", roomResult.rows);

            if (roomResult.rows.length === 0) {
                return res.status(404).json({ message: "Chat room not found" });
            }

            // Get room members
            const membersResult = await pool.query(
                `SELECT sm."seid" as "userId", sm."sevakname" as "fullName",
                        cru."isAdmin", cru."canSendMessage"
                 FROM chatroomusers cru
                          JOIN "SevakMaster" sm ON cru."userId" = sm."seid"
                 WHERE cru."roomId" = $1
                 ORDER BY cru."isAdmin" DESC, sm."sevakname"`,
                [roomIdInt]
            );
            console.log("members result in getChatRoomDetails", membersResult.rows);

            // Get recent messages with mediaFiles, edit information, and reply information
            const messagesResult = await pool.query(
                `SELECT m."id", m."messageText", m."messageType", m."mediaFilesId", m."pollId", m."tableId",
                        m."createdAt",
                        m."isEdited",
                        m."editedAt",
                        m."editedBy", m."replyMessageId",
                        sm."seid" as "senderId", sm."sevakname" as "senderName",
                        e."sevakname" as "editorName",
                        rm."messageText" as "replyMessageText", rm."messageType" as "replyMessageType",
                        ru."sevakname" as "replySenderName"
                 FROM chatmessages m
                          JOIN "SevakMaster" sm ON m."senderId"::integer = sm."seid"
                LEFT JOIN "SevakMaster" e ON m."editedBy"::integer = e."seid"
                     LEFT JOIN chatmessages rm ON m."replyMessageId" = rm."id"
                     LEFT JOIN "SevakMaster" ru ON rm."senderId"::integer = ru."seid"
                 WHERE m."roomId" = $1
                 ORDER BY m."createdAt" DESC`,
                [roomIdInt]
            );
            // console.log("messages result in getChatRoomDetails", messagesResult.rows);

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

            // Get current user's permissions from memberCheck (already fetched above)
            const currentUserMembership = memberCheck.rows[0];
            const isAdmin = currentUserMembership.isAdmin === true || currentUserMembership.isAdmin === 1;
            const canSendMessage = currentUserMembership.canSendMessage === true || currentUserMembership.canSendMessage === 1;

            // Combine all data into a single response
            const roomRow = roomResult.rows[0];
            const roomDetails = {
                roomId: roomRow.roomId,
                roomName: roomRow.roomName,
                isAdmin: isAdmin,
                canSendMessage: canSendMessage,
                members: membersResult.rows.map(m => ({
                    ...m,
                    // Normalize boolean fields for members too
                    isAdmin: m.isAdmin === true || m.isAdmin === 1,
                    canSendMessage: m.canSendMessage === true || m.canSendMessage === 1,
                })),
                messages: messagesResult.rows.reverse() // Return in chronological order
            };

            // console.log("room details in getChatRoomDetails", roomDetails);
            res.json(roomDetails);
        } catch (error) {
            console.error('Error fetching chat room details:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    },

    // Add and Remove room members in one operation
    async updateRoomMembers(req, res) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { roomId } = req.params;
            const { memberUserIds } = req.body; // Array of userIds who should be members
            const userId = Number(req.user.userId) || 0;

            const roomIdInt = parseInt(roomId, 10);
            const memberIdsInt = (memberUserIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id));

            console.log("Updating room members:", {
                roomId: roomIdInt,
                memberUserIds: memberIdsInt,
                requestingUser: userId
            });

            // Check if user is an admin of this room
            const adminCheck = await client.query(
                `SELECT * FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
                [roomIdInt, userId]
            );

            if (adminCheck.rows.length === 0) {
                return res.status(403).json({
                    message: "Only group admins can manage room members"
                });
            }

            // Get current members
            const currentMembersResult = await client.query(
                `SELECT "userId", "isAdmin" FROM chatroomusers WHERE "roomId" = $1`,
                [roomIdInt]
            );

            const currentMemberIds = currentMembersResult.rows.map(row => Number(row.userId));
            const currentAdmins = currentMembersResult.rows.filter(row => row.isAdmin).map(row => Number(row.userId));

            // Ensure requesting admin cannot remove themselves
            if (!memberIdsInt.includes(userId)) {
                return res.status(400).json({
                    message: "You cannot remove yourself from the room"
                });
            }

            // Ensure all admins remain in the room
            const missingAdmins = currentAdmins.filter(adminId => !memberIdsInt.includes(adminId));
            if (missingAdmins.length > 0) {
                return res.status(400).json({
                    message: "Cannot remove admin users. Please demote them first or use the leave room option."
                });
            }

            // Check if all new userIds exist
            const userCheckResult = await client.query(
                `SELECT "seid" FROM "SevakMaster" WHERE "seid" = ANY($1::int[])`,
                [memberIdsInt]
            );

            const foundUserIds = userCheckResult.rows.map(row => Number(row.seid));
            const missingUserIds = memberIdsInt.filter(id => !foundUserIds.includes(id));

            if (missingUserIds.length > 0) {
                return res.status(400).json({
                    message: `Some user IDs do not exist: ${missingUserIds.join(', ')}`
                });
            }

            // Determine who to add and who to remove
            const toAdd = memberIdsInt.filter(id => !currentMemberIds.includes(id));
            const toRemove = currentMemberIds.filter(id => !memberIdsInt.includes(id));

            console.log("Members to add:", toAdd);
            console.log("Members to remove:", toRemove);

            // Add new members
            for (const memberId of toAdd) {
                await client.query(
                    `INSERT INTO chatroomusers ("roomId", "userId", "isAdmin", "canSendMessage", "joinedAt", createdby)
                     VALUES ($1, $2, FALSE, FALSE, NOW() AT TIME ZONE 'UTC', $3)`,
                    [roomIdInt, memberId, userId]
                );
            }

            // Remove members
            for (const memberId of toRemove) {
                await client.query(
                    `DELETE FROM chatroomusers
                     WHERE "roomId" = $1 AND "userId" = $2`,
                    [roomIdInt, memberId]
                );
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: "Room members updated successfully",
                added: toAdd,
                removed: toRemove
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating room members:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        } finally {
            client.release();
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

            // Check if user is a group admin of this room
            const adminCheck = await client.query(
                `SELECT 1 FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
                [roomIdInt, userId]
            );

            if (adminCheck.rows.length === 0) {
                return res.status(403).json({
                    message: "Only group admins can delete this room"
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
            console.log("req body ", req.body);

            let { messageText, mediaFiles, messageType, mediaFilesId, pollId, tableId, replyMessageId, scheduledAt, isForward, forwardSourcePollId, forwardSourceMediaId } = req.body; // Also receive mediaFiles, replyMessageId, scheduledAt, and forward clone hints

            console.log("Message text", messageText);
            console.log("Media files", mediaFiles);
            console.log("Message type", messageType);
            console.log("Media files id", mediaFilesId);
            console.log("Poll id is ", pollId);
            console.log("Table id is ", tableId);
            console.log("Reply message id is ", replyMessageId);
            console.log("Scheduled at is ", scheduledAt);

            if (!mediaFilesId) mediaFilesId = null;
            if (!pollId) pollId = null;
            if (!tableId) tableId = null;
            if (!replyMessageId) replyMessageId = null;
            if (!scheduledAt) scheduledAt = null;
            if (!isForward) isForward = false;

            const senderId = Number(req.user.userId) || 0;
            console.log(typeof (req.user.userId));

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
            // if (!isGroupAdmin) {
            //   return res.status(403).json({
            //     message: "Only group admins can send messages in this room"
            //   });
            // }

            // When forwarding poll: create a new poll row for this room and use its id (so votes don't sync across groups)
            let sourceMediaIdForForward = null;
            if (isForward && (messageType === "poll") && (forwardSourcePollId != null || pollId != null)) {
                const sourcePollId = forwardSourcePollId != null ? forwardSourcePollId : pollId;
                const pollRes = await pool.query(`SELECT "question", "options", "isMultipleChoiceAllowed", "pollEndTime" FROM poll WHERE "id" = $1`, [sourcePollId]);

                if (pollRes.rows.length > 0) {
                    const row = pollRes.rows[0];
                    const opts = typeof row.options === "string" ? row.options : JSON.stringify(row.options);
                    const newPollRes = await pool.query(
                        `INSERT INTO poll ("question", "options", "isMultipleChoiceAllowed", "pollEndTime", "roomId", "createdBy", "createdAt", "votes")
                         VALUES ($1, $2::jsonb, $3, $4, $5, $6, NOW() AT TIME ZONE 'UTC', '{}'::jsonb)
                             RETURNING id`,
                        [row.question, opts, row.isMultipleChoiceAllowed || false, row.pollEndTime || new Date(Date.now() + 24 * 60 * 60 * 1000), roomIdInt, String(senderId)]
                    );
                    pollId = newPollRes.rows[0].id;
                    mediaFilesId = null;
                    tableId = null;
                }
            }

            // When forwarding media: we will clone media after inserting the message; do not send original mediaFilesId
            if (isForward && (messageType === "media") && (forwardSourceMediaId != null || mediaFilesId != null)) {
                sourceMediaIdForForward = forwardSourceMediaId != null ? forwardSourceMediaId : mediaFilesId;
                mediaFilesId = null;
                pollId = null;
                tableId = null;
            }

            let newMessages = [];

            //store caption in media table (for old media upload system)
            if (mediaFiles && messageType !== "media" && !(isForward && messageType === "media")) {
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
            let result;
            if (scheduledAt) {
                // For scheduled messages, use the scheduledAt time as createdAt
                result = await pool.query(
                    `INSERT INTO chatmessages ("roomId", "senderId", "messageText","messageType", "replyMessageId", "createdAt", "isScheduled")
                     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                         RETURNING *`,
                    [roomIdInt, senderId, messageText, messageType, replyMessageId, scheduledAt]
                );
            } else {
                // For immediate messages, use current time
                result = await pool.query(
                    `INSERT INTO chatmessages ("roomId", "senderId", "messageText","messageType", "replyMessageId", "createdAt", "isScheduled")
                     VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'UTC', FALSE)
                         RETURNING *`,
                    [roomIdInt, senderId, messageText, messageType, replyMessageId]
                );
            }
            let newMessage = result.rows[0];

            //then insert the media files id
            if (mediaFiles || pollId || tableId) {
                console.log("table id here is ", tableId);
                const here = await pool.query(
                    `UPDATE chatmessages SET "mediaFilesId" = $1, "pollId" = $2, "tableId" = $3 WHERE "id" = $4
                        Returning *
                    `,
                    [mediaFilesId, pollId, tableId, result.rows[0].id]
                );
                // console.log()
                console.log("new message after updating is", here.rows[0]);
                newMessage = here.rows[0];
                console.log("new message;asdljf;alsdjf", newMessage);
            }

            // When forwarding media: clone source media (new folder + new media row) and set message's mediaFilesId
            if (sourceMediaIdForForward != null && newMessage.id) {
                const mediaBase = path.join(process.cwd(), "media", "chat");
                const srcMediaRes = await pool.query(
                    `SELECT "roomId", "senderId", "createdAt", "driveUrlObject" FROM media WHERE "id" = $1`,
                    [sourceMediaIdForForward]
                );

                if (srcMediaRes.rows.length > 0) {
                    const src = srcMediaRes.rows[0];
                    let driveUrlObject = src.driveUrlObject;

                    if (typeof driveUrlObject === "string") driveUrlObject = JSON.parse(driveUrlObject);

                    if (Array.isArray(driveUrlObject) && driveUrlObject.length > 0) {
                        const createdAt = newMessage.createdAt || new Date();
                        const ts = new Date(createdAt).toISOString().replace(/[:.]/g, "-");
                        const permanentFolderName = `${ts}_${roomIdInt}_${senderId}_${newMessage.id}`;
                        const destDir = path.join(mediaBase, permanentFolderName);

                        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

                        const newDriveUrlObject = [];
                        for (const item of driveUrlObject) {
                            const filename = item.filename || (item.url && item.url.split("/").pop()) || `file_${Date.now()}`;
                            const srcPath = path.join(mediaBase, String(item.url || "").replace(/^\//, ""));

                            if (fs.existsSync(srcPath)) {
                                const destPath = path.join(destDir, filename);
                                fs.copyFileSync(srcPath, destPath);
                                newDriveUrlObject.push({
                                    url: `${permanentFolderName}/${filename}`,
                                    filename: filename,
                                    originalName: item.originalName || filename,
                                    caption: item.caption || "",
                                    mimeType: item.mimeType || "",
                                    size: item.size || 0
                                });
                            }
                        }

                        if (newDriveUrlObject.length > 0) {
                            const mediaInsert = await pool.query(
                                `INSERT INTO media ("roomId", "senderId", "createdAt", "messageId", "driveUrlObject")
                                 VALUES ($1, $2, $3, $4, $5)
                                     RETURNING id`,
                                [roomIdInt, senderId, createdAt, newMessage.id, JSON.stringify(newDriveUrlObject)]
                            );
                            const newMediaId = mediaInsert.rows[0].id;
                            await pool.query(
                                `UPDATE chatmessages SET "mediaFilesId" = $1 WHERE "id" = $2`,
                                [newMediaId, newMessage.id]
                            );
                            newMessage.mediaFilesId = newMediaId;
                            mediaFilesId = newMediaId;
                        }
                    }
                }
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
            console.log("new messagess", newMessages);

            // Get sender information
            const senderResult = await pool.query(
                `SELECT "sevakname" as "fullName" FROM "SevakMaster" WHERE "seid" = $1`,
                [senderId]
            );

            const senderName = senderResult.rows[0]?.fullName || 'Unknown User';

            // Add sender name to all messages
            const messagesWithSender = newMessages.map(msg => ({
                ...msg,
                senderName
            }));

            // Handle scheduled vs immediate messages differently
            if (scheduledAt) {
                // For scheduled messages, just return success without sending via socket
                console.log("Scheduled message created", messagesWithSender);
                res.status(201).json({
                    success: true,
                    message: "Message scheduled successfully",
                    scheduledMessage: messagesWithSender.length === 1 ? messagesWithSender[0] : messagesWithSender,
                    scheduledAt: scheduledAt
                });
            } else {
                // For immediate messages, proceed with normal flow
                // Get the io instance and other app data
                const io = req.app.get('io');
                const lastMessageByRoom = req.app.get('lastMessageByRoom');
                const unreadMessagesByUser = req.app.get('unreadMessagesByUser');

                // If multiple messages were created, use the last one as the last message for the room
                const lastMessage = messagesWithSender[messagesWithSender.length - 1];

                // --------------------------------------------------
                // Mark message as read for sender immediately
                // --------------------------------------------------
                try {
                    const senderIdStr = String(senderId);
                    for (const msg of messagesWithSender) {
                        // Mark each message as read for the sender
                        await pool.query(
                            `INSERT INTO messagereadstatus ("messageId", "userId", "roomId", "readAt")
                             VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC')
                                 ON CONFLICT ("messageId", "userId") 
                             DO UPDATE SET "readAt" = NOW() AT TIME ZONE 'UTC'`,
                            [msg.id, senderIdStr, roomIdInt]
                        );
                    }
                    console.log(`✅ [SendMessage] Marked ${messagesWithSender.length} message(s) as read for sender ${senderIdStr}`);
                } catch (readError) {
                    // Don't fail the whole request if read marking fails
                    console.error('Error marking message as read for sender:', readError);
                }

                // Update last message for this room
                if (lastMessageByRoom) {
                    lastMessageByRoom[roomIdInt] = {
                        id: lastMessage.id,
                        messageText: lastMessage.messageText,
                        createdAt: lastMessage.createdAt,
                        messageType: messageType,
                        mediaFilesId: mediaFilesId,
                        pollId: pollId,
                        tableId: tableId,
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
                // Online users in room will be marked as read in socket.js sendMessage handler
                console.log("Message with sender", messagesWithSender);

                // Return all created messages or just the last message
                // Depending on the use case, you might want to return all or just the last one
                res.status(201).json(messagesWithSender.length === 1 ? messagesWithSender[0] : messagesWithSender);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    },

    // Get scheduled messages for a room
    async getScheduledMessages(req, res) {
        try {
            const { roomId } = req.params;
            const roomIdInt = parseInt(roomId, 10);
            const userId = req.user.userId;

            // Check if user is a member of this room
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

            // Get scheduled messages for this room
            const result = await pool.query(
                `SELECT cm.*, sm.sevakname as "senderName"
                 FROM chatmessages cm
                          JOIN "SevakMaster" sm ON cm."senderId"::integer = sm.seid
                 WHERE cm."roomId" = $1 AND cm."isScheduled" = TRUE AND cm."createdAt" > NOW() AT TIME ZONE 'UTC'
                 ORDER BY cm."createdAt" ASC`,
                [roomIdInt]
            );

            res.status(200).json({
                success: true,
                scheduledMessages: result.rows
            });
        } catch (error) {
            console.error('Error fetching scheduled messages:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    },

    // Send scheduled message when time comes (called by scheduler)
    async sendScheduledMessage(messageId) {
        try {
            // Get the scheduled message
            const result = await pool.query(
                `SELECT cm.*, sm.sevakname as "senderName"
                 FROM chatmessages cm
                          JOIN "SevakMaster" sm ON cm."senderId"::integer = sm.seid
                 WHERE cm."id" = $1 AND cm."isScheduled" = TRUE`,
                [messageId]
            );

            if (result.rows.length === 0) {
                console.log('Scheduled message not found or already sent');
                return;
            }

            const message = result.rows[0];

            // Update the message to mark it as sent (no longer scheduled)
            await pool.query(
                `UPDATE chatmessages SET "isScheduled" = FALSE WHERE "id" = $1`,
                [messageId]
            );

            // Get the io instance and other app data
            const io = global.io; // We'll need to make io globally available
            const lastMessageByRoom = global.lastMessageByRoom;
            const unreadMessagesByUser = global.unreadMessagesByUser;

            // Update last message for this room
            if (lastMessageByRoom) {
                lastMessageByRoom[message.roomId] = {
                    id: message.id,
                    messageText: message.messageText,
                    createdAt: message.createdAt,
                    messageType: message.messageType,
                    mediaFilesId: message.mediaFilesId,
                    pollId: message.pollId,
                    tableId: message.tableId,
                    replyMessageId: message.replyMessageId,
                    sender: {
                        userId: message.senderId,
                        userName: message.senderName
                    }
                };
            }

            // Get all members of the room
            const membersResult = await pool.query(
                `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1`,
                [message.roomId]
            );

            const memberIds = membersResult.rows.map(row => row.userId);

            // Emit the message to all room members
            if (io) {
                io.to(`room_${message.roomId}`).emit('newMessage', {
                    id: message.id,
                    roomId: message.roomId,
                    messageText: message.messageText,
                    messageType: message.messageType,
                    createdAt: message.createdAt,
                    mediaFilesId: message.mediaFilesId,
                    pollId: message.pollId,
                    tableId: message.tableId,
                    replyMessageId: message.replyMessageId,
                    sender: {
                        userId: message.senderId,
                        userName: message.senderName
                    }
                });

                // Update unread counts for all members except sender
                memberIds.forEach(memberId => {
                    if (memberId !== message.senderId) {
                        if (!unreadMessagesByUser[memberId]) {
                            unreadMessagesByUser[memberId] = {};
                        }
                        if (!unreadMessagesByUser[memberId][message.roomId]) {
                            unreadMessagesByUser[memberId][message.roomId] = 0;
                        }
                        unreadMessagesByUser[memberId][message.roomId]++;
                    }
                });

                // Emit unread count updates
                memberIds.forEach(memberId => {
                    if (memberId !== message.senderId) {
                        io.to(`user_${memberId}`).emit('unreadCountUpdate', {
                            roomId: message.roomId,
                            unreadCount: unreadMessagesByUser[memberId][message.roomId]
                        });
                    }
                });
            }

            console.log(`Scheduled message ${messageId} sent successfully`);
        } catch (error) {
            console.error('Error sending scheduled message:', error);
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
            console.log("updatedMessage", updatedMessage);

            // Get sender information
            const senderResult = await pool.query(
                `SELECT "sevakname" as "fullName" FROM "SevakMaster" WHERE "seid" = $1`,
                [Number(message.senderId)]
            );

            const senderName = senderResult.rows[0]?.fullName || 'Unknown User';

            // Get editor information (if different from sender)
            let editorName = null;
            if (message.senderId !== userId) {
                const editorResult = await pool.query(
                    `SELECT "sevakname" as "fullName" FROM "SevakMaster" WHERE "seid" = $1`,
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
                // Check if this was the last message
                const isLastMessage = lastMessageByRoom &&
                    lastMessageByRoom[roomIdInt] &&
                    lastMessageByRoom[roomIdInt].id === messageIdInt;

                io.to(`room_${roomIdInt}`).emit('messageEdited', {
                    roomId: roomIdInt.toString(),
                    messageId: messageIdInt,
                    messageText: messageText.trim(),
                    isEdited: true,
                    editedAt: updatedMessage.editedAt,
                    editedBy: userId,
                    editorName: editorName,
                    senderId: message.senderId,
                    senderName: senderName,
                    isLastMessage: isLastMessage  // NEW: flag to indicate if this was the last message
                });

                // Also emit roomUpdate if this was the last message so room list updates
                if (isLastMessage) {
                    // Get all members of the room
                    const membersResult = await pool.query(
                        `SELECT "userId" FROM chatroomusers WHERE "roomId" = $1`,
                        [roomIdInt]
                    );

                    const memberIds = membersResult.rows.map(row => row.userId.toString());

                    // Emit room update to all members
                    memberIds.forEach(memberId => {
                        global.emitToUser(memberId, 'roomUpdate', {
                            roomId: roomIdInt.toString(),
                            lastMessage: lastMessageByRoom[roomIdInt],
                            unreadCount: unreadMessagesByUser[memberId]?.[roomIdInt] || 0
                        });
                    });
                }

                console.log(`Message edit event sent to room_${roomIdInt}`);
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
            // if (!isGroupAdmin) {
            //   return res.status(403).json({
            //     message: "Only group admins can delete messages in this room"
            //   });
            // }

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
            console.log("messageIds and roomId", messageIds, roomIdInt);
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
                    `SELECT m.*, sm.sevakname as "senderName",
                            m."createdAt"
                     FROM chatmessages m
                              JOIN "SevakMaster" sm ON m."senderId"::integer = sm.seid
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
            // memberIds.forEach((memberId) => {
            //   if (unreadMessagesByUser[memberId] && unreadMessagesByUser[memberId][roomIdInt]) {
            //     // Count how many deleted messages were unread for this user
            //     let unreadDeletedCount = 0;
            //     deletedMessages.forEach(deletedMsg => {
            //       // If message was sent by someone else, it was potentially unread
            //       if (deletedMsg.senderId !== memberId) {
            //         unreadDeletedCount++;
            //       }
            //     });

            //     // Decrease unread count, but don't go below 0
            //     const currentUnread = unreadMessagesByUser[memberId][roomIdInt];
            //     unreadMessagesByUser[memberId][roomIdInt] = Math.max(0, currentUnread - unreadDeletedCount);
            //   }
            // });

            await client.query('COMMIT');

            if (io) {
                // Calculate per-user unread changes
                const userUnreadChanges = {};
                memberIds.forEach(memberId => {
                    const memberIdStr = memberId.toString();
                    // Only decrease unread for messages not sent by this user
                    let unreadDecrease = 0;
                    deletedMessages.forEach(msg => {
                        if (msg.senderId.toString() !== memberIdStr) {
                            unreadDecrease++;
                        }
                    });

                    // Get current unread count
                    const currentUnread = unreadMessagesByUser[memberIdStr]?.[roomIdInt] || 0;
                    const newUnread = Math.max(0, currentUnread - unreadDecrease);

                    // Update in-memory state
                    if (unreadMessagesByUser[memberIdStr]) {
                        unreadMessagesByUser[memberIdStr][roomIdInt] = newUnread;
                    }

                    userUnreadChanges[memberIdStr] = {
                        decrease: unreadDecrease,
                        newCount: newUnread
                    };
                });

                // Emit message deletion to all users in the room with new last message info
                io.to(`room_${roomIdInt}`).emit('messagesDeleted', {
                    roomId: roomIdInt.toString(),
                    messageIds: messageIds,
                    deletedBy: userId,
                    newLastMessage: newLastMessage,
                    wasLastMessageDeleted: needToUpdateLastMessage
                });

                // Emit individual room updates with correct unread counts per user
                memberIds.forEach(memberId => {
                    const memberIdStr = memberId.toString();
                    global.emitToUser(memberIdStr, 'roomUpdate', {
                        roomId: roomIdInt.toString(),
                        lastMessage: newLastMessage,
                        unreadCount: userUnreadChanges[memberIdStr]?.newCount || 0
                    });
                });
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

            // Get all room members (including sender - sender should show as read)
            const membersResult = await pool.query(
                `SELECT sm.seid::text as "userId", sm.sevakname as "fullName"
                 FROM chatroomusers cru
                          JOIN "SevakMaster" sm ON cru."userId" = sm.seid
                 WHERE cru."roomId" = $1`,
                [roomId]
            );

            // Get read status for each member (including sender)
            const readStatusResult = await pool.query(
                `SELECT mrs."userId", mrs."readAt" as "readAt", sm.sevakname as "fullName"
                 FROM messagereadstatus mrs
                          JOIN "SevakMaster" sm ON mrs."userId" = sm.seid::text
                 WHERE mrs."messageId" = $1`,
                [messageIdInt]
            );

            const readBy = readStatusResult.rows.map(row => ({
                userId: row.userId,
                fullName: row.fullName,
                readAt: row.readAt
            }));

            // Find unread members (those who haven't read the message yet)
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
            const userIdRaw = req.user.userId;
            const userId = Number(userIdRaw) || 0;
            const userIdStr = String(userIdRaw);

            console.log("messageId to mark as read", messageId);
            console.log("userId", userId);

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
            console.log("messageResult", messageResult.rows);

            if (messageResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Message not found"
                });
            }

            const message = messageResult.rows[0];
            const roomId = message.roomId;
            const senderId = Number(message.senderId);

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

            // If not sender: insert read status. If sender (e.g. after forwarding own message): skip insert but still sync unread.
            if (senderId !== userId) {
                const alreadyRead = await pool.query(
                    `SELECT 1 FROM messagereadstatus WHERE "messageId" = $1 AND "userId" = $2`,
                    [messageIdInt, userId.toString()]
                );

                if (alreadyRead.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO messagereadstatus ("messageId", "userId", "roomId", "readAt")
                         VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC')
                             ON CONFLICT ("messageId", "userId") 
                         DO UPDATE SET "readAt" = NOW() AT TIME ZONE 'UTC'`,
                        [messageIdInt, userId.toString(), roomId]
                    );
                }
            }

            // --------------------------------------------------
            // Always sync in-memory unread + emit roomUpdate (including when sender marks own message, e.g. after forward)
            // --------------------------------------------------
            try {
                // unreadMessagesByUser is an alias to socket unreadCounts (see socket.js)
                const unreadMessagesByUser = req.app.get('unreadMessagesByUser');
                const lastMessageByRoom = req.app.get('lastMessageByRoom');

                // Best-effort: clear unread count for this room for this user.
                // This is slightly aggressive (per-room instead of per-message) but
                // guarantees badges are cleared once the user starts reading.
                if (unreadMessagesByUser) {
                    if (!unreadMessagesByUser[userIdStr]) {
                        unreadMessagesByUser[userIdStr] = {};
                    }
                    unreadMessagesByUser[userIdStr][roomId] = 0;
                }

                // Emit a roomUpdate only to this user so their rooms list reflects
                // the cleared unread counter immediately.
                if (global.emitToUser) {
                    const lastMessage = lastMessageByRoom ? lastMessageByRoom[roomId] : null;

                    global.emitToUser(userIdStr, 'roomUpdate', {
                        roomId: roomId.toString(),
                        lastMessage,
                        unreadCount: 0,
                    });
                }
            } catch (syncError) {
                // Never break the main flow for socket/unread sync issues
                console.error('Error syncing unread state after markMessageAsRead:', syncError);
            }

            res.json({
                success: true,
                message: "Message marked as read"
            });
        } catch (error) {
            console.error('Error marking message as read:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    },

    // Mark all messages in a room as read for current user
    async markAllMessagesAsRead(req, res) {
        try {
            const { roomId } = req.params;
            const userIdRaw = req.user.userId;
            const userIdStr = String(userIdRaw);

            const roomIdInt = parseInt(roomId, 10);
            if (isNaN(roomIdInt)) {
                return res.status(400).json({
                    message: "Invalid room ID"
                });
            }

            // Ensure user is a member of the room
            const memberCheck = await pool.query(
                `SELECT 1 FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2`,
                [roomIdInt, userIdStr]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({
                    message: "You are not a member of this chat room"
                });
            }

            // Insert read status for all messages in this room that:
            // - are not sent by this user
            // - and are not already marked as read by this user
            await pool.query(
                `INSERT INTO messagereadstatus ("messageId", "userId", "roomId", "readAt")
                 SELECT m."id", $2, m."roomId", NOW() AT TIME ZONE 'UTC'
                 FROM chatmessages m
                 WHERE m."roomId" = $1
                   AND m."senderId" != $2
                   AND NOT EXISTS (
                     SELECT 1 FROM messagereadstatus mr
                     WHERE mr."messageId" = m."id"
                   AND mr."userId" = $2
                     )`,
                [roomIdInt, userIdStr]
            );

            // --------------------------------------------------
            // Sync in-memory unread counters + notify via socket
            // --------------------------------------------------
            try {
                // unreadMessagesByUser is an alias to socket unreadCounts (see socket.js)
                const unreadMessagesByUser = req.app.get('unreadMessagesByUser');
                const lastMessageByRoom = req.app.get('lastMessageByRoom');

                if (unreadMessagesByUser) {
                    if (!unreadMessagesByUser[userIdStr]) {
                        unreadMessagesByUser[userIdStr] = {};
                    }
                    unreadMessagesByUser[userIdStr][roomIdInt] = 0;
                }

                if (global.emitToUser) {
                    const lastMessage = lastMessageByRoom ? lastMessageByRoom[roomIdInt] : null;

                    global.emitToUser(userIdStr, 'roomUpdate', {
                        roomId: roomIdInt.toString(),
                        lastMessage,
                        unreadCount: 0,
                    });
                }
            } catch (syncError) {
                // Keep this best-effort: DB is the source of truth for read state
                console.error('Error syncing unread state after markAllMessagesAsRead:', syncError);
            }

            return res.json({
                success: true,
                message: "All messages marked as read"
            });
        } catch (error) {
            console.error("Error marking all messages as read:", error);
            return res.status(500).json({ message: "Server error", error: error.message });
        }
    },

    // Assign/Remove Group Admins
    async updateGroupAdmins(req, res) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { roomId } = req.params;
            const { adminUserIds } = req.body; // Array of userIds who should be admins
            const userId = req.user.userId;

            const roomIdInt = parseInt(roomId, 10);

            console.log('Updating group admins:', { roomId: roomIdInt, adminUserIds, requestingUser: userId });

            // Check if requesting user is an admin of this room
            const adminCheck = await client.query(
                `SELECT 1 FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
                [roomIdInt, userId]
            );

            if (adminCheck.rows.length === 0) {
                return res.status(403).json({
                    message: "Only group admins can manage admin roles"
                });
            }

            // Get all current members
            const membersResult = await client.query(
                `SELECT "userId", "isAdmin" FROM chatroomusers WHERE "roomId" = $1`,
                [roomIdInt]
            );

            const currentMembers = membersResult.rows;

            // Ensure at least one admin is selected
            if (!adminUserIds || adminUserIds.length === 0) {
                return res.status(400).json({
                    message: "Room must have at least one admin"
                });
            }

            // Update admin status for all members
            for (const member of currentMembers) {
                const shouldBeAdmin = adminUserIds.includes(member.userId);

                if (member.isAdmin !== shouldBeAdmin) {
                    await client.query(
                        `UPDATE chatroomusers
                         SET "isAdmin" = $1, "canSendMessage" = $2
                         WHERE "roomId" = $3 AND "userId" = $4`,
                        [shouldBeAdmin, shouldBeAdmin, roomIdInt, member.userId]
                    );
                }
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: "Group admins updated successfully"
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating group admins:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        } finally {
            client.release();
        }
    },

    // Update messaging permissions for members
    async updateMessagingPermissions(req, res) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { roomId } = req.params;
            const { allowedUserIds } = req.body; // Array of userIds who can send messages
            const userId = req.user.userId;

            const roomIdInt = parseInt(roomId, 10);

            console.log('Updating messaging permissions:', { roomId: roomIdInt, allowedUserIds, requestingUser: userId });

            // Check if requesting user is an admin of this room
            const adminCheck = await client.query(
                `SELECT 1 FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2 AND "isAdmin" = TRUE`,
                [roomIdInt, userId]
            );

            if (adminCheck.rows.length === 0) {
                return res.status(403).json({
                    message: "Only group admins can manage messaging permissions"
                });
            }

            // Get all current members
            const membersResult = await client.query(
                `SELECT "userId", "isAdmin" FROM chatroomusers WHERE "roomId" = $1`,
                [roomIdInt]
            );

            const currentMembers = membersResult.rows;

            // Update messaging permissions for all non-admin members
            for (const member of currentMembers) {
                // Admins always have messaging permission
                if (member.isAdmin) {
                    continue;
                }

                const canSendMessage = allowedUserIds.includes(member.userId);

                await client.query(
                    `UPDATE chatroomusers
                     SET "canSendMessage" = $1
                     WHERE "roomId" = $2 AND "userId" = $3`,
                    [canSendMessage, roomIdInt, member.userId]
                );
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: "Messaging permissions updated successfully"
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error updating messaging permissions:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        } finally {
            client.release();
        }
    },

    // Leave room (user removes themselves)
    async leaveRoom(req, res) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { roomId } = req.params;
            const userId = req.user.userId;

            const roomIdInt = parseInt(roomId, 10);

            console.log('User leaving room:', { roomId: roomIdInt, userId });

            // Check if user is a member
            const memberCheck = await client.query(
                `SELECT "isAdmin" FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2`,
                [roomIdInt, userId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(404).json({
                    message: "You are not a member of this room"
                });
            }

            const isUserAdmin = memberCheck.rows[0].isAdmin;

            // If user is admin, check if there are other admins
            if (isUserAdmin) {
                const adminsResult = await client.query(
                    `SELECT COUNT(*) as "adminCount" FROM chatroomusers
                     WHERE "roomId" = $1 AND "isAdmin" = TRUE`,
                    [roomIdInt]
                );

                const adminCount = parseInt(adminsResult.rows[0].adminCount);

                if (adminCount <= 1) {
                    return res.status(400).json({
                        message: "Cannot leave room. You are the only admin. Please assign another admin first or delete the room."
                    });
                }
            }

            // Remove user from room
            await client.query(
                `DELETE FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2`,
                [roomIdInt, userId]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                message: "Successfully left the room"
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error leaving room:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        } finally {
            client.release();
        }
    },

    // Get new messages after a timestamp (for sync)
    async getNewMessages(req, res) {
        try {
            const { roomId } = req.params;
            const { afterTimestamp, limit = 50 } = req.query;
            const userId = req.user.userId;

            // Convert roomId to integer
            const roomIdInt = parseInt(roomId, 10);

            // Check if user is a member of this room
            const memberCheck = await pool.query(
                `SELECT * FROM chatroomusers
                 WHERE "roomId" = $1 AND "userId" = $2`,
                [roomIdInt, userId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({
                    message: "You are not a member of this chat room"
                });
            }

            // Build query for messages after timestamp
            let query = `
                SELECT m."id", m."messageText", m."messageType", m."mediaFilesId", m."pollId", m."tableId",
                       m."createdAt",
                       m."isEdited",
                       m."editedAt",
                       m."editedBy", m."replyMessageId",
                       sm.seid::text as "senderId", sm.sevakname as "senderName",
                       e.sevakname as "editorName",
                       rm."messageText" as "replyMessageText", rm."messageType" as "replyMessageType",
                       ru.sevakname as "replySenderName"
                FROM chatmessages m
                         JOIN "SevakMaster" sm ON m."senderId"::integer = sm.seid
                LEFT JOIN "SevakMaster" e ON m."editedBy"::integer = e.seid
                    LEFT JOIN chatmessages rm ON m."replyMessageId" = rm."id"
                    LEFT JOIN "SevakMaster" ru ON rm."senderId"::integer = ru.seid
                WHERE m."roomId" = $1
            `;

            const params = [roomIdInt];

            if (afterTimestamp) {
                query += ` AND m."createdAt" > $2`;
                params.push(afterTimestamp);
                query += ` ORDER BY m."createdAt" ASC LIMIT $${params.length + 1}`;
            } else {
                query += ` ORDER BY m."createdAt" DESC LIMIT $2`;
            }

            params.push(parseInt(limit, 10));

            const messagesResult = await pool.query(query, params);

            // If afterTimestamp is provided, return in chronological order, otherwise reverse
            const messages = afterTimestamp
                ? messagesResult.rows
                : messagesResult.rows.reverse();

            res.json({
                messages,
                count: messages.length
            });
        } catch (error) {
            console.error('Error fetching new messages:', error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
};

export default chatController;