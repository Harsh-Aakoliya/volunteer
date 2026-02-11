import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';
import pool from "../config/database.js";
import { compressFile, compressBuffer, isImage, isVideo } from "../utils/compressMedia.js";

const VmMediaController = {  
    // Upload files to temporary folder
    uploadFiles: async (req, res) => {
        try {
            // console.log("req.body ",req.body);
            const { files, tempFolderId } = req.body;
            
            if (!files || !Array.isArray(files) || files.length === 0) {
                return res.status(400).json({ error: "No files provided" });
            }

            // Create temp folder if not exists or use existing one
            let folderId = tempFolderId;
            if (!folderId) {
                folderId = uuidv4();
            }

            const UPLOAD_DIR = path.join(process.cwd(), 'media', 'chat', `temp_${folderId}`);
            
            if (!fs.existsSync(UPLOAD_DIR)) {
                fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            }

            const uploadedFiles = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                if (!file.fileData || !file.name || !file.mimeType) {
                    continue;
                }

                // Generate unique filename to avoid conflicts
                const fileId = uuidv4();
                const fileExtension = path.extname(file.name);
                const fileName = `${fileId}${fileExtension}`;
                const filePath = path.join(UPLOAD_DIR, fileName);
                console.log("filePath ",filePath);
                // console.log("file.fileData ",file.fileData);
                try {
                    // Convert base64 to buffer
                    let buffer = Buffer.from(file.fileData, 'base64');
                    let finalFileName = fileName;
                    let finalMimeType = file.mimeType;
                    let finalSize = buffer.length;

                    // Compress images before storing (skip audio)
                    if (file.mimeType !== 'audio/mp4' && (isImage(file.mimeType) || isVideo(file.mimeType))) {
                        try {
                            const compressed = await compressBuffer(buffer, file.mimeType, file.name);
                            if (compressed.buffer && !compressed.skipped) {
                                buffer = compressed.buffer;
                                finalSize = compressed.size;
                                finalMimeType = compressed.mimeType;
                                if (compressed.extension) {
                                    finalFileName = `${fileId}${compressed.extension}`;
                                }
                            }
                        } catch (compErr) {
                            console.warn("Compression failed, using original:", compErr.message);
                        }
                    }

                    if (file.mimeType === 'audio/mp4') {
                        fs.writeFileSync(`./atemp.mp3`, buffer);
                    } else {
                        const finalPath = path.join(UPLOAD_DIR, finalFileName);
                        fs.writeFileSync(finalPath, buffer);
                    }
                    uploadedFiles.push({
                        id: fileId,
                        originalName: file.name,
                        fileName: finalFileName,
                        mimeType: finalMimeType,
                        size: finalSize,
                        url: `temp_${folderId}/${finalFileName}`,
                        caption: ""
                    });
                    console.log("uploadedFiles ",uploadedFiles);
                } catch (writeError) {
                    console.error(`Error writing file ${file.name}:`, writeError);
                }
            }

            res.json({
                success: true,
                tempFolderId: folderId,
                uploadedFiles,
                message: `${uploadedFiles.length} files uploaded successfully`
            });

        } catch (error) {
            console.error("Error uploading files:", error);
            res.status(500).json({ error: "Failed to upload files", details: error.message });
        }
    },
    
    // Delete specific file from temporary folder
    deleteFile: async (req, res) => {
        try {
            const { tempFolderId, fileName } = req.params;
            
            if (!tempFolderId || !fileName) {
                return res.status(400).json({ error: "tempFolderId and fileName are required" });
            }

            const filePath = path.join(process.cwd(), 'media', 'chat', `temp_${tempFolderId}`, fileName);
            
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                res.json({ success: true, message: "File deleted successfully" });
            } else {
                res.status(404).json({ error: "File not found" });
            }

        } catch (error) {
            console.error("Error deleting file:", error);
            res.status(500).json({ error: "Failed to delete file", details: error.message });
        }
    },

    // Delete entire temporary folder
    deleteTempFolder: async (req, res) => {
        try {
            const { tempFolderId } = req.params;
            
            if (!tempFolderId) {
                return res.status(400).json({ error: "tempFolderId is required" });
            }

            const folderPath = path.join(process.cwd(), 'media', 'chat', `temp_${tempFolderId}`);
            
            if (fs.existsSync(folderPath)) {
                fs.rmSync(folderPath, { recursive: true, force: true });
                res.json({ success: true, message: "Temporary folder deleted successfully" });
            } else {
                res.json({ success: true, message: "Folder does not exist" });
            }

        } catch (error) {
            console.error("Error deleting temp folder:", error);
            res.status(500).json({ error: "Failed to delete folder", details: error.message });
        }
    },
    // Move files from temp to permanent location and create DB entries
    moveToChat: async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { tempFolderId, roomId, senderId, filesWithCaptions, caption } = req.body;
            
            if (!tempFolderId || !roomId || !senderId || !filesWithCaptions) {
                return res.status(400).json({ error: "Missing required parameters" });
            }

            // Use caption from request body, or empty string if not provided
            const messageText = caption || "";

            // First create the chat message entry with the caption as messageText
            const messageResult = await client.query(
                `INSERT INTO chatmessages ("roomId", "senderId", "messageText", "messageType")
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [roomId, senderId, messageText, "media"]
            );

            const messageId = messageResult.rows[0].id;
            const createdAt = messageResult.rows[0].createdAt;
            
            // Create permanent folder name
            const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
            const permanentFolderName = `${timestamp}_${roomId}_${senderId}_${messageId}`;
            
            const tempFolderPath = path.join(process.cwd(), 'media', 'chat', `temp_${tempFolderId}`);
            const permanentFolderPath = path.join(process.cwd(), 'media', 'chat', permanentFolderName);

            // Create permanent folder
            if (!fs.existsSync(permanentFolderPath)) {
                fs.mkdirSync(permanentFolderPath, { recursive: true });
            }

            // Move files and create driveUrlObject
            const driveUrlObject = [];
            
            for (const fileInfo of filesWithCaptions) {
                let tempFilePath = path.join(tempFolderPath, fileInfo.fileName);
                let fileName = fileInfo.fileName;
                let fileSize = fileInfo.size || 0;
                let mimeType = fileInfo.mimeType || "";

                if (fs.existsSync(tempFilePath)) {
                    try {
                        const compResult = await compressFile(tempFilePath, mimeType);
                        if (compResult.success && compResult.fileName) {
                            fileName = compResult.fileName;
                            fileSize = compResult.size;
                            if (compResult.mimeType) mimeType = compResult.mimeType;
                            tempFilePath = path.join(tempFolderPath, fileName);
                        }
                    } catch (compErr) {
                        console.warn("Compression failed for", fileName, compErr.message);
                    }

                    const permanentFilePath = path.join(permanentFolderPath, fileName);
                    fs.renameSync(tempFilePath, permanentFilePath);

                    driveUrlObject.push({
                        url: `${permanentFolderName}/${fileName}`,
                        filename: fileName,
                        originalName: fileInfo.originalName || fileInfo.fileName,
                        caption: fileInfo.caption || "",
                        mimeType,
                        size: fileSize
                    });
                }
            }

            // Create media entry
            const mediaResult = await client.query(
                `INSERT INTO media ("roomId", "senderId", "createdAt", "messageId", "driveUrlObject")
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [roomId, senderId, createdAt, messageId, JSON.stringify(driveUrlObject)]
            );

            const mediaId = mediaResult.rows[0].id;

            // Update chat message with mediaFilesId
            await client.query(
                `UPDATE chatmessages SET "mediaFilesId" = $1 WHERE "id" = $2`,
                [mediaId, messageId]
            );

            // Delete temp folder
            if (fs.existsSync(tempFolderPath)) {
                fs.rmSync(tempFolderPath, { recursive: true, force: true });
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                messageId,
                mediaId,
                permanentFolderName,
                driveUrlObject,
                messageText: messageText, // Return the actual caption/message text
                createdAt: createdAt
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error moving files to chat:", error);
            res.status(500).json({ error: "Failed to move files to chat", details: error.message });
        } finally {
            client.release();
        }
    },
    uploadFilesMultipart: async (req, res) => {
        try {
            console.log("uploadFilesMultipart - req.files:", req.files?.length || 0);
            console.log("uploadFilesMultipart - req.body:", req.body);
            
            // Multer puts files in req.files when using upload.array()
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: "No files provided" });
            }

            // Generate temp folder ID
            const tempFolderId = req.body.tempFolderId || uuidv4();
            const TARGET_DIR = path.join(process.cwd(), 'media', 'chat', `temp_${tempFolderId}`);

            if (!fs.existsSync(TARGET_DIR)) {
                fs.mkdirSync(TARGET_DIR, { recursive: true });
            }

            const uploadedFiles = [];

            for (const file of req.files) {
                try {
                    const fileId = uuidv4();
                    let fileExtension = path.extname(file.originalname) || (file.mimetype?.includes('video') ? '.mp4' : '.jpg');
                    let fileName = `${fileId}${fileExtension}`;
                    let targetPath = path.join(TARGET_DIR, fileName);
                    let fileSize = file.size;
                    let mimeType = file.mimetype;

                    if (fs.existsSync(file.path)) {
                        fs.renameSync(file.path, targetPath);

                        // Compress before storing in temp
                        try {
                            const compResult = await compressFile(targetPath, mimeType);
                            if (compResult.success && compResult.fileName) {
                                fileName = compResult.fileName;
                                fileSize = compResult.size;
                                if (compResult.mimeType) mimeType = compResult.mimeType;
                                targetPath = path.join(TARGET_DIR, fileName);
                            }
                        } catch (compErr) {
                            console.warn("Compression failed for", file.originalname, compErr.message);
                        }
                    } else {
                        console.error(`File not found at multer path: ${file.path}`);
                        continue;
                    }

                    uploadedFiles.push({
                        id: fileId,
                        originalName: file.originalname,
                        fileName,
                        mimeType,
                        size: fileSize,
                        url: `temp_${tempFolderId}/${fileName}`,
                        caption: ""
                    });
                } catch (fileError) {
                    console.error(`Error processing file ${file.originalname}:`, fileError);
                    // Continue with other files even if one fails
                }
            }

            if (uploadedFiles.length === 0) {
                // Cleanup if no files were successfully uploaded
                if (fs.existsSync(TARGET_DIR)) {
                    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
                }
                return res.status(400).json({ error: "Failed to process any files" });
            }

            res.json({
                success: true,
                tempFolderId: tempFolderId,
                uploadedFiles,
                message: `${uploadedFiles.length} files uploaded via multipart successfully`
            });

        } catch (error) {
            console.error("Error in multipart upload:", error);
            console.error("Error stack:", error.stack);
            
            // Cleanup uploaded files if error
            if (req.files) {
                req.files.forEach(f => {
                    if (f.path && fs.existsSync(f.path)) {
                        try {
                            fs.unlinkSync(f.path);
                        } catch (e) {
                            console.error("Error cleaning up file:", e);
                        }
                    }
                });
            }
            
            res.status(500).json({ 
                error: "Failed to upload files", 
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    // NEW: Handle Camera Upload (Single File -> Chat Direct)
    moveToChatCamera: async (req, res) => {
        const client = await pool.connect();
        try {
            // 1. Validate Request
            if (!req.file) {
                return res.status(400).json({ error: "No media file provided." });
            }
            
            const { roomId, senderId, caption, duration } = req.body;
            
            if (!roomId || !senderId) {
                // Cleanup temp file
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: "Missing roomId or senderId" });
            }

            await client.query('BEGIN');

            // 2. Create Chat Message with caption as messageText
            const messageText = caption || "";
            const messageResult = await client.query(
                `INSERT INTO chatmessages ("roomId", "senderId", "messageText", "messageType")
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [roomId, senderId, messageText, "media"]
            );

            const messageId = messageResult.rows[0].id;
            const createdAt = messageResult.rows[0].createdAt;

            // 3. Prepare Permanent Folder
            const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
            const permanentFolderName = `${timestamp}_${roomId}_${senderId}_${messageId}`;
            const permanentFolderPath = path.join(process.cwd(), 'media', 'chat', permanentFolderName);

            if (!fs.existsSync(permanentFolderPath)) {
                fs.mkdirSync(permanentFolderPath, { recursive: true });
            }

            // 4. Move and compress file
            const originalName = req.file.originalname;
            const safeFileName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const targetPath = path.join(permanentFolderPath, safeFileName);

            fs.renameSync(req.file.path, targetPath);

            let finalFileName = safeFileName;
            let finalSize = req.file.size;
            let finalMime = req.file.mimetype;

            try {
                const compResult = await compressFile(targetPath, req.file.mimetype);
                if (compResult.success && compResult.fileName) {
                    finalFileName = compResult.fileName;
                    finalSize = compResult.size;
                    if (compResult.mimeType) finalMime = compResult.mimeType;
                }
            } catch (compErr) {
                console.warn("Compression failed for camera upload:", compErr.message);
            }

            // 5. Create Drive Object
            const driveUrlObject = [{
                url: `${permanentFolderName}/${finalFileName}`,
                filename: finalFileName,
                originalName: originalName,
                caption: caption || "",
                mimeType: finalMime,
                size: finalSize,
                duration: duration ? parseInt(duration) : 0
            }];

            // 6. Create Media Entry
            const mediaResult = await client.query(
                `INSERT INTO media ("roomId", "senderId", "createdAt", "messageId", "driveUrlObject")
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [roomId, senderId, createdAt, messageId, JSON.stringify(driveUrlObject)]
            );

            const mediaId = mediaResult.rows[0].id;

            // 7. Update Chat Message
            await client.query(
                `UPDATE chatmessages SET "mediaFilesId" = $1 WHERE "id" = $2`,
                [mediaId, messageId]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                messageId,
                mediaId,
                messageText: messageText, // Return the actual caption/message text
                createdAt: createdAt
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error in camera upload:", error);
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            res.status(500).json({ error: "Failed to upload camera media", details: error.message });
        } finally {
            client.release();
        }
    },

    // Get media files by media ID
    getMediaById: async (req, res) => {
        try {
            const { mediaId } = req.params;
            
            if (!mediaId) {
                return res.status(400).json({ error: "mediaId is required" });
            }

            console.log(`Fetching media for ID: ${mediaId}`);

            const result = await pool.query(
                'SELECT * FROM media WHERE "id" = $1',
                [mediaId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Media not found" });
            }

            const mediaRecord = result.rows[0];
            const driveUrlObject = mediaRecord.driveUrlObject || [];

            console.log(`Found media with ${driveUrlObject.length} files`);

            res.json({
                success: true,
                media: {
                    id: mediaRecord.id,
                    roomId: mediaRecord.roomId,
                    senderId: mediaRecord.senderId,
                    createdAt: mediaRecord.createdAt,
                    messageId: mediaRecord.messageId,
                    files: driveUrlObject
                }
            });

        } catch (error) {
            console.error("Error fetching media:", error);
            res.status(500).json({ error: "Failed to fetch media", details: error.message });
        }
    },

    // Move files to chat with announcement support
    moveToChatAnnouncement: async (req, res) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { tempFolderId, roomId, senderId, filesWithCaptions, messageText, messageType } = req.body;
            
            if (!tempFolderId || !roomId || !senderId || !filesWithCaptions || !messageText) {
                return res.status(400).json({ error: "Missing required parameters" });
            }

            // Create the chat message entry with announcement type
            const messageResult = await client.query(
                `INSERT INTO chatmessages ("roomId", "senderId", "messageText", "messageType")
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [roomId, senderId, messageText, messageType || "announcement"]
            );

            const messageId = messageResult.rows[0].id;
            const createdAt = messageResult.rows[0].createdAt;
            
            // Create permanent folder name
            const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
            const permanentFolderName = `${timestamp}_${roomId}_${senderId}_${messageId}`;
            
            const tempFolderPath = path.join(process.cwd(), 'media', 'chat', `temp_${tempFolderId}`);
            const permanentFolderPath = path.join(process.cwd(), 'media', 'chat', permanentFolderName);

            // Create permanent folder
            if (!fs.existsSync(permanentFolderPath)) {
                fs.mkdirSync(permanentFolderPath, { recursive: true });
            }

            // Move files and create driveUrlObject
            const driveUrlObject = [];
            
            for (const fileInfo of filesWithCaptions) {
                let tempFilePath = path.join(tempFolderPath, fileInfo.fileName);
                let fileName = fileInfo.fileName;
                let fileSize = fileInfo.size || 0;
                let mimeType = fileInfo.mimeType || "";

                if (fs.existsSync(tempFilePath)) {
                    try {
                        const compResult = await compressFile(tempFilePath, mimeType);
                        if (compResult.success && compResult.fileName) {
                            fileName = compResult.fileName;
                            fileSize = compResult.size;
                            if (compResult.mimeType) mimeType = compResult.mimeType;
                            tempFilePath = path.join(tempFolderPath, fileName);
                        }
                    } catch (compErr) {
                        console.warn("Compression failed for", fileName, compErr.message);
                    }

                    const permanentFilePath = path.join(permanentFolderPath, fileName);
                    fs.renameSync(tempFilePath, permanentFilePath);

                    driveUrlObject.push({
                        url: `${permanentFolderName}/${fileName}`,
                        filename: fileName,
                        originalName: fileInfo.originalName || fileInfo.fileName,
                        caption: fileInfo.caption || "",
                        mimeType,
                        size: fileSize
                    });
                }
            }

            // Create media entry
            const mediaResult = await client.query(
                `INSERT INTO media ("roomId", "senderId", "createdAt", "messageId", "driveUrlObject")
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [roomId, senderId, createdAt, messageId, JSON.stringify(driveUrlObject)]
            );

            const mediaId = mediaResult.rows[0].id;

            // Update chat message with mediaFilesId
            await client.query(
                `UPDATE chatmessages SET "mediaFilesId" = $1 WHERE "id" = $2`,
                [mediaId, messageId]
            );

            // Delete temp folder
            if (fs.existsSync(tempFolderPath)) {
                fs.rmSync(tempFolderPath, { recursive: true, force: true });
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                messageId,
                mediaId,
                createdAt,
                permanentFolderName,
                driveUrlObject,
                message: "Announcement with media sent successfully"
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error moving announcement files to chat:", error);
            res.status(500).json({ error: "Failed to send announcement", details: error.message });
        } finally {
            client.release();
        }
    }
};
export default VmMediaController;