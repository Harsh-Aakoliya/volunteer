
import pool from "../config/database.js";

import express from "express";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import {apiKeys} from "../api_keys/apiKeys.js" 

const upload = multer({ 
    dest: "uploads/",
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });
  
  // Folder IDs for each media type
  const FOLDER_IDS = {
    image: "1cUcnknmbI6Aj-98jgJXBr4LL_yP4tUe9",
    audio: "1Bgt3FIC5YmMg7Gds_2nfKO5rUgDzFels",
    video: "1hrlnO0JEaDhu_PS9MPrG373iGIDe1smM"
  };

  

// Google Drive API scope
const SCOPE = ["https://www.googleapis.com/auth/drive"];


/**
 * Authorize with Google Drive API
 * @returns {Promise<JWT>} Authorized JWT client
 */
async function authorize() {
  const jwtClient = new google.auth.JWT(
    apiKeys.client_email,
    null,
    apiKeys.private_key,
    SCOPE
  );
  await jwtClient.authorize();
  return jwtClient;
}

/**
 * Upload a file to Google Drive and get direct access URL
 * @param {string} filePath Path to the file
 * @param {string} fileName Original file name
 * @param {string} mimeType File's MIME type
 * @param {JWT} auth Authorized JWT client
 * @returns {Promise<Object>} File info including direct URL
 */
async function uploadToDrive(filePath, fileName, mimeType, auth) {
  const drive = google.drive({ version: "v3", auth });

  // Determine the folder based on file type
  let folderId = "";
  if (mimeType.startsWith("image/")) {
    folderId = FOLDER_IDS.image;
  } else if (mimeType.startsWith("audio/")) {
    folderId = FOLDER_IDS.audio;
  } else if (mimeType.startsWith("video/")) {
    folderId = FOLDER_IDS.video;
  } else {
    throw new Error("Unsupported file type");
  }

  // File metadata for Drive
  const fileMetadata = {
    name: fileName,
    parents: [folderId]
  };

  // Upload file to Drive
  const media = {
    mimeType,
    body: fs.createReadStream(filePath)
  };

  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id,webContentLink"
    });
    
    // Make the file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    // Get direct download URL that can be used in <img>, <audio>, <video> tags
    const directUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
    
    return {
      id: response.data.id,
      name: fileName,
      url: directUrl,
      mimeType: mimeType
    };
  } catch (error) {
    console.error("Drive upload error:", error);
    throw error;
  }
}

const client = await pool.connect();
const mediaController = {
  async uploadMedia (req, res) {
    console.log("req.files",req.files);
    console.log("req.body",req.body);
    const {userId, roomId} = req.body;
    // console.log("request got to upload files",req);
    try {
        if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files were uploaded" });
        }
        
        const auth = await authorize();
        const uploadResults = [];
        
        // Process each uploaded file
        for (const file of req.files) {
        try {
            const result = await uploadToDrive(
            file.path,
            file.originalname,
            file.mimetype,
            auth
            );
            uploadResults.push(result);
        } catch (err) {
            console.error(`Error uploading ${file.originalname}:`, err);
        } finally {
            // Clean up temporary file
            if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            }
        }
        }
        console.log("userId",userId);
        console.log("roomId",roomId);
        console.log("uploadResults ", uploadResults); 
        // uploadResults [
        //   {
        //     id: '1gW0HqIPBt-86OmyBBXIljQl8CFcxEngb',
        //     name: 'india-has-been-removed-from-cursors-student-program-v0-zfvxsxjucxze1.jpg',       
        //     url: 'https://drive.google.com/uc?export=view&id=1gW0HqIPBt-86OmyBBXIljQl8CFcxEngb',    
        //     mimeType: 'image/jpeg'
        //   },
        //   {
        //     id: '1ecS9E6MtkswGa6oyvbv2YK-CzsKr3kAM',
        //     name: '21-gun-salute-25444.mp3',
        //     url: 'https://drive.google.com/uc?export=view&id=1ecS9E6MtkswGa6oyvbv2YK-CzsKr3kAM',    
        //     mimeType: 'audio/mpeg'
        //   },
        //   {
        //     id: '1lzLXPdFZL14jkPHraK4HxvbXVReHD52A',
        //     name: 'file_example_MP4_480_1_5MG.mp4',
        //     url: 'https://drive.google.com/uc?export=view&id=1lzLXPdFZL14jkPHraK4HxvbXVReHD52A',    
        //     mimeType: 'video/mp4'
        //   }
        // ]

        // insert into media table
        const media=[]
        for (const result of uploadResults) {
          const temp = await client.query(
            `INSERT INTO media ("senderId", "roomId", "driveUrlObject", "messageId") VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, roomId, result, null]
          );
          media.push(temp.rows[0]); // Add inserted row data to array
        }

        console.log("media", media);

        
        res.json({ uploaded: uploadResults, media: media });
    } catch (error) {
        console.error("Upload handler error:", error);
        res.status(500).json({ 
        message: "Upload failed", 
        error: error.message 
        });
    }
    }
}

export default mediaController;