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

    // Get file content (for serving files)
    getFile: async (req, res) => {
        try {
            const { folderName, fileName } = req.params;
            
            const filePath = path.join(process.cwd(), 'media', 'chat', folderName, fileName);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: "File not found" });
            }

            // Get file stats
            const stats = fs.statSync(filePath);
            const mimeType = getMimeType(fileName);
            
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', stats.size);
            
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
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.mp4': 'video/mp4',
        '.avi': 'video/avi',
        '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/m4a'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

export default VmMediaController;