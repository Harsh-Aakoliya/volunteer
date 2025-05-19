// Create router and configure multe
import express from "express";
const router = express.Router();
import mediaController from "../controllers/mediaController.js";

import multer from "multer";


// Temp upload directory
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});
// Route for file uploads
router.post("/",upload.array("files"), mediaController.uploadMedia);

export default router;