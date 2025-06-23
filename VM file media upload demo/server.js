const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const os = require('os');
const app = express();
const PORT = 8080;

const UPLOAD_DIR = path.join(__dirname, 'media');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Upload directory created: ${UPLOAD_DIR}`);
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// GET /?filename=somefile.mp4 - Download file
app.get('/', (req, res) => {
  const filename = req.query.filename;
  
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename query parameter' });
  }

  // Sanitize filename to prevent path traversal
  const sanitizedFilename = path.basename(filename);
  const filepath = path.join(UPLOAD_DIR, sanitizedFilename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    // Get file stats
    const stats = fs.statSync(filepath);
    const fileSize = stats.size;

    // Set appropriate headers
    const mimeType = getMimeType(sanitizedFilename);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests for video streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);
      
      const stream = fs.createReadStream(filepath, { start, end });
      stream.pipe(res);
    } else {
      // Send entire file
      const stream = fs.createReadStream(filepath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /upload - Upload file
app.post('/upload', (req, res) => {
  try {
    const { name, data } = req.body;
    
    if (!name || !data) {
      return res.status(400).json({ error: 'Missing name or data fields' });
    }

    // Sanitize filename
    const sanitizedName = path.basename(name);
    const filePath = path.join(UPLOAD_DIR, sanitizedName);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'File already exists' });
    }

    // Decode base64 data
    let buffer;
    try {
      buffer = Buffer.from(data, 'base64');
    } catch (error) {
      return res.status(400).json({ error: 'Invalid base64 data' });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);
    
    console.log(`File uploaded successfully: ${sanitizedName} (${buffer.length} bytes)`);
    res.json({ 
      message: 'Upload successful', 
      filename: sanitizedName,
      size: buffer.length 
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /list - List all files
app.get('/list', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    
    // Get file details
    const fileDetails = files.map(filename => {
      const filepath = path.join(UPLOAD_DIR, filename);
      const stats = fs.statSync(filepath);
      
      return {
        name: filename,
        size: stats.size,
        modified: stats.mtime,
        type: getMimeType(filename)
      };
    });

    res.json({ 
      files: files, // Keep simple array for backward compatibility
      details: fileDetails,
      count: files.length 
    });
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ error: 'Error reading directory' });
  }
});

// DELETE /delete/:filename - Delete file
app.delete('/delete/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const sanitizedFilename = path.basename(filename);
    const filepath = path.join(UPLOAD_DIR, sanitizedFilename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filepath);
    console.log(`File deleted: ${sanitizedFilename}`);
    res.json({ message: 'File deleted successfully', filename: sanitizedFilename });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// GET /info/:filename - Get file info
app.get('/info/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const sanitizedFilename = path.basename(filename);
    const filepath = path.join(UPLOAD_DIR, sanitizedFilename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filepath);
    res.json({
      name: sanitizedFilename,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      type: getMimeType(sanitizedFilename)
    });
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// GET /status - Server status
app.get('/status', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const totalSize = files.reduce((acc, filename) => {
      const filepath = path.join(UPLOAD_DIR, filename);
      const stats = fs.statSync(filepath);
      return acc + stats.size;
    }, 0);

    res.json({
      status: 'running',
      uptime: process.uptime(),
      filesCount: files.length,
      totalSize: totalSize,
      uploadDir: UPLOAD_DIR
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Helper function to get MIME type
function getMimeType(filename) {
  const extension = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Media Server running on http://0.0.0.0:${PORT}`);
  console.log(`Upload directory: ${UPLOAD_DIR}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /?filename=<file>  - Download file`);
  console.log(`  POST /upload            - Upload file`);
  console.log(`  GET  /list              - List files`);
  console.log(`  GET  /info/<filename>   - Get file info`);
  console.log(`  DELETE /delete/<filename> - Delete file`);
  console.log(`  GET  /status            - Server status`);
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => !item.internal && item.family === "IPv4")
    .map((item) => item.address);

  console.log(`Server running on port ${PORT}`);
  console.log("Available on:");
  addresses.forEach((addr) => console.log(`http://${addr}:${PORT}`));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});