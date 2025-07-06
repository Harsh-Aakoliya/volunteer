const axios = require('axios');

const API_URL = 'http://103.47.172.58:50160';

async function testUpdateSystem() {
  console.log('Testing Auto Update System...\n');

  try {
    // Test 1: Get current version
    console.log('1. Testing GET /api/version/current');
    const versionResponse = await axios.get(`${API_URL}/api/version/current`);
    console.log('✅ Version endpoint working');
    console.log('Response:', versionResponse.data);
    console.log('');

    // Test 2: Test download endpoint (should return 404 if no APK file)
    console.log('2. Testing GET /api/version/download/1.0.1');
    try {
      const downloadResponse = await axios.get(`${API_URL}/api/version/download/1.0.1`);
      console.log('✅ Download endpoint working');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Download endpoint working (404 expected - no APK file)');
        console.log('Response:', error.response.data);
      } else {
        console.log('❌ Download endpoint error:', error.message);
      }
    }
    console.log('');

    // Test 3: Test server health
    console.log('3. Testing server health');
    const healthResponse = await axios.get(`${API_URL}/api/test`);
    console.log('✅ Server is running');
    console.log('Response:', healthResponse.data);
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Place an APK file in Backend/apkdistribution/1.0.1/');
    console.log('2. Test the download endpoint again');
    console.log('3. Update your app version to test the update flow');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running:');
      console.log('cd Backend && node server.js');
    }
  }
}

testUpdateSystem(); 