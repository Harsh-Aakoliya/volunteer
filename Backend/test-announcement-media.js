// Test script for announcement media endpoints
// Run with: node test-announcement-media.js

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3000/api';
const TEST_ANNOUNCEMENT_ID = 1; // Replace with actual announcement ID

async function testAnnouncementMedia() {
  console.log('🧪 Testing Announcement Media Endpoints...\n');

  try {
    // Test 1: Upload media files
    console.log('📤 Test 1: Upload media files');
    
    // Create a test image file (1x1 pixel PNG in base64)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA0UL7+AAAAABJRU5ErkJggg==';
    
    const uploadResponse = await axios.post(`${API_URL}/announcements/${TEST_ANNOUNCEMENT_ID}/media/upload`, {
      files: [
        {
          name: 'test-image.png',
          mimeType: 'image/png',
          fileData: testImageBase64
        }
      ]
    });

    console.log('✅ Upload successful:', uploadResponse.data);
    console.log(`   Uploaded ${uploadResponse.data.uploadedFiles.length} file(s)\n`);

    // Test 2: Get media files
    console.log('📥 Test 2: Get media files');
    
    const getResponse = await axios.get(`${API_URL}/announcements/${TEST_ANNOUNCEMENT_ID}/media`);
    console.log('✅ Get successful:', getResponse.data);
    console.log(`   Found ${getResponse.data.files.length} file(s)\n`);

    // Test 3: Delete media file (if we have files)
    if (getResponse.data.files.length > 0) {
      console.log('🗑️  Test 3: Delete media file');
      
      const fileToDelete = getResponse.data.files[0];
      const deleteResponse = await axios.delete(`${API_URL}/announcements/${TEST_ANNOUNCEMENT_ID}/media/${fileToDelete.fileName}`);
      
      console.log('✅ Delete successful:', deleteResponse.data);
      console.log('   File deleted successfully\n');
    }

    // Test 4: Verify file was deleted
    console.log('🔍 Test 4: Verify deletion');
    
    const finalGetResponse = await axios.get(`${API_URL}/announcements/${TEST_ANNOUNCEMENT_ID}/media`);
    console.log('✅ Final check:', finalGetResponse.data);
    console.log(`   Remaining files: ${finalGetResponse.data.files.length}\n`);

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('   Status:', error.response?.status);
    console.error('   URL:', error.config?.url);
  }
}

// Run the test
testAnnouncementMedia(); 