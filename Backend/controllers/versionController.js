import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get current version from version.json
export const getCurrentVersion = async (req, res) => {
  console.log("getCurrentVersion");
  try {
    const versionPath = path.join(__dirname, '..', 'apkdistribution', 'version.json');
    
    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Version file not found' 
      });
    }

    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    res.json({
      success: true,
      currentVersion: versionData.currentenduserversion
    });
  } catch (error) {
    console.error('Error reading version file:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error reading version information' 
    });
  }
};

// Download APK file
export const downloadAPK = async (req, res) => {
  try {
    const { version } = req.params;
    
    if (!version) {
      return res.status(400).json({ 
        success: false, 
        message: 'Version parameter is required' 
      });
    }

    const apkDirectory = path.join(__dirname, '..', 'apkdistribution', version);
    const apkFiles = fs.readdirSync(apkDirectory).filter(file => file.endsWith('.apk'));
    
    if (apkFiles.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'APK file not found for this version' 
      });
    }

    const apkFileName = apkFiles[0]; // Get the first APK file
    const apkFilePath = path.join(apkDirectory, apkFileName);
    
    if (!fs.existsSync(apkFilePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'APK file not found' 
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${apkFileName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(apkFilePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading APK:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error downloading APK file' 
    });
  }
};

// Update version (for admin use)
export const updateVersion = async (req, res) => {
  try {
    const { currentenduserversion } = req.body;
    
    if (!currentenduserversion) {
      return res.status(400).json({ 
        success: false, 
        message: 'currentenduserversion is required' 
      });
    }

    const versionPath = path.join(__dirname, '..', 'apkdistribution', 'version.json');
    const versionData = { currentenduserversion };
    
    fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));
    
    res.json({
      success: true,
      message: 'Version updated successfully',
      currentVersion: currentenduserversion
    });
  } catch (error) {
    console.error('Error updating version:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating version' 
    });
  }
}; 