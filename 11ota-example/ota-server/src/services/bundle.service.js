const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const extractZip = require('extract-zip');
const { hashFile, hashBuffer } = require('../utils/helpers');
const storageService = require('./storage.service');

class BundleService {
  /**
   * Process an uploaded bundle file.
   * Accepts: .zip (with bundle + assets) or raw .bundle/.jsbundle file
   */
  async processUpload(uploadedFilePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const stats = fs.statSync(uploadedFilePath);
    const hash = await hashFile(uploadedFilePath);

    return {
      filePath: uploadedFilePath,
      fileName: originalName,
      extension: ext,
      size: stats.size,
      hash: hash,
      isZip: ext === '.zip'
    };
  }

  /**
   * Create a zip bundle from a directory containing bundle + assets
   */
  async createZipBundle(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(archive.pointer()));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Extract a zip bundle
   */
  async extractBundle(zipPath, destDir) {
    await extractZip(zipPath, { dir: path.resolve(destDir) });
  }

  /**
   * Compute diff between two bundles (simplified - returns full if different)
   * In production, you'd use bsdiff or similar
   */
  async computeDiff(oldBundlePath, newBundlePath, outputPath) {
    const oldHash = await hashFile(oldBundlePath);
    const newHash = await hashFile(newBundlePath);

    if (oldHash === newHash) {
      return null; // No diff needed
    }

    // For simplicity, we copy the full new bundle as the "diff"
    // In production, use a real binary diff algorithm
    fs.copyFileSync(newBundlePath, outputPath);
    const diffHash = await hashFile(outputPath);
    const diffSize = fs.statSync(outputPath).size;

    return { hash: diffHash, size: diffSize, path: outputPath };
  }

  /**
   * Validate that the uploaded file is a valid React Native bundle
   */
  validateBundle(filePath, isZip) {
    if (!fs.existsSync(filePath)) {
      throw new Error('Bundle file not found');
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('Bundle file is empty');
    }

    if (!isZip) {
      // Check if it looks like a JS bundle
      const head = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' }).substring(0, 500);
      if (!head.includes('__d(') && !head.includes('require(') && !head.includes('var ') && 
          !head.includes('function') && !head.includes('__r(')) {
        console.warn('⚠️  Warning: File may not be a valid React Native bundle');
      }
    }

    return true;
  }
}

module.exports = new BundleService();