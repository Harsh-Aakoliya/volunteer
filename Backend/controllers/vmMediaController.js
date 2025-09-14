import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';
import pool from "../config/database.js";

const VmMediaController = {  
    createFolder: async (req, res) => {
        const { folderName } = req.body;
        if (!folderName) {
            return res.status(400).json({ error: "folderName is required" });
        }
        
        const UPLOAD_DIR = path.join(process.cwd(), 'media');
        const folderPath = path.join(UPLOAD_DIR, String(folderName));
    
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`Upload directory created: ${folderPath}`);
        }
    
        res.json({ message: "Folder created successfully" });
    },

    // Upload files to temporary folder
    uploadFiles: async (req, res) => {
        try {
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

                try {
                    // Convert base64 to buffer and write file
                    const buffer = Buffer.from(file.fileData, 'base64');
                    fs.writeFileSync(filePath, buffer);

                    uploadedFiles.push({
                        id: fileId,
                        originalName: file.name,
                        fileName: fileName,
                        mimeType: file.mimeType,
                        size: buffer.length,
                        url: `temp_${folderId}/${fileName}`,
                        caption: ""
                    });
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

    // Get files from temporary folder
    getTempFiles: async (req, res) => {
        try {
            const { tempFolderId } = req.params;
            
            if (!tempFolderId) {
                return res.status(400).json({ error: "tempFolderId is required" });
            }

            const UPLOAD_DIR = path.join(process.cwd(), 'media', 'chat', `temp_${tempFolderId}`);
            
            if (!fs.existsSync(UPLOAD_DIR)) {
                return res.json({ files: [] });
            }

            const files = fs.readdirSync(UPLOAD_DIR);
            const fileDetails = files.map(fileName => {
                const filePath = path.join(UPLOAD_DIR, fileName);
                const stats = fs.statSync(filePath);
                
                return {
                    id: path.parse(fileName).name,
                    fileName: fileName,
                    originalName: fileName,
                    size: stats.size,
                    url: `temp_${tempFolderId}/${fileName}`,
                    caption: ""
                };
            });

            res.json({ files: fileDetails });

        } catch (error) {
            console.error("Error getting temp files:", error);
            res.status(500).json({ error: "Failed to get files", details: error.message });
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

            const { tempFolderId, roomId, senderId, filesWithCaptions } = req.body;
            
            if (!tempFolderId || !roomId || !senderId || !filesWithCaptions) {
                return res.status(400).json({ error: "Missing required parameters" });
            }

            // First create the chat message entry
            const messageResult = await client.query(
                `INSERT INTO chatmessages ("roomId", "senderId", "messageText", "messageType")
                VALUES ($1, $2, $3, $4)
                RETURNING *`,
                [roomId, senderId, "", "media"]
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
                const tempFilePath = path.join(tempFolderPath, fileInfo.fileName);
                const permanentFilePath = path.join(permanentFolderPath, fileInfo.fileName);
                
                if (fs.existsSync(tempFilePath)) {
                    // Move file
                    fs.renameSync(tempFilePath, permanentFilePath);
                    
                    // Add to driveUrlObject
                    driveUrlObject.push({
                        url: `${permanentFolderName}/${fileInfo.fileName}`,
                        filename: fileInfo.fileName,
                        originalName: fileInfo.originalName || fileInfo.fileName,
                        caption: fileInfo.caption || "",
                        mimeType: fileInfo.mimeType || "",
                        size: fileInfo.size || 0
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
                message: "Files moved to chat successfully"
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error moving files to chat:", error);
            res.status(500).json({ error: "Failed to move files to chat", details: error.message });
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

    // Get file content (for serving files)
    getFile: async (req, res) => {
        try {
            console.log("=== FILE REQUEST DEBUG ===");
            console.log("Full request URL:", req.url);
            console.log("Request params:", req.params);
            console.log("Request headers:", req.headers);
            
            const { folderName, fileName } = req.params;
            
            console.log(`Parsed params - folderName: "${folderName}", fileName: "${fileName}"`);
            
            if (!folderName || !fileName) {
                console.log("Missing folderName or fileName parameters");
                return res.status(400).json({ error: "folderName and fileName are required" });
            }
            
            const filePath = path.join(process.cwd(), 'media', 'chat', folderName, fileName);
            
            console.log(`Constructed file path: ${filePath}`);
            console.log(`File exists: ${fs.existsSync(filePath)}`);
            
            if (!fs.existsSync(filePath)) {
                console.log(`File not found at: ${filePath}`);
                // List directory contents for debugging
                const dirPath = path.join(process.cwd(), 'media', 'chat', folderName);
                if (fs.existsSync(dirPath)) {
                    const files = fs.readdirSync(dirPath);
                    console.log(`Directory contents: ${files.join(', ')}`);
                } else {
                    console.log(`Directory does not exist: ${dirPath}`);
                }
                return res.status(404).json({ error: "File not found" });
            }

            // Get file stats
            const stats = fs.statSync(filePath);
            const mimeType = getMimeType(fileName);
            
            console.log(`Serving file - MIME: ${mimeType}, size: ${stats.size} bytes`);
            
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
            
            // Add headers for better audio/video streaming support
            if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Headers', 'Range');
            }
            
            // Stream the file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);

        } catch (error) {
            console.error("Error serving file:", error);
            res.status(500).json({ error: "Failed to serve file", details: error.message });
        }
    }
};

// Helper function to get MIME type
function getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
        // Images
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        
        // Videos
        '.mp4': 'video/mp4',
        '.avi': 'video/avi',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.3gp': 'video/3gpp',
        '.m4v': 'video/mp4',
        
        // Audio
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/m4a',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.wma': 'audio/x-ms-wma',
        '.opus': 'audio/opus',
        '.amr': 'audio/amr'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

export default VmMediaController;