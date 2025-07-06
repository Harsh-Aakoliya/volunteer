const axios = require('axios');

const API_URL = 'http://103.47.172.58:50160';

async function testAPIConnectivity() {
  console.log('Testing API connectivity...\n');

  try {
    // Test 1: Basic connectivity
    console.log('1. Testing basic connectivity...');
    const response = await axios.get(`${API_URL}/api/test`, {
      timeout: 10000 // 10 second timeout
    });
    console.log('✅ Basic connectivity: SUCCESS');
    console.log('Response:', response.data);
    console.log('');

    // Test 2: Version endpoint
    console.log('2. Testing version endpoint...');
    const versionResponse = await axios.get(`${API_URL}/api/version/current`, {
      timeout: 10000
    });
    console.log('✅ Version endpoint: SUCCESS');
    console.log('Response:', versionResponse.data);
    console.log('');

    // Test 3: Auth endpoint (should return 401 for unauthorized)
    console.log('3. Testing auth endpoint...');
    try {
      await axios.get(`${API_URL}/api/auth/test`, {
        timeout: 10000
      });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Auth endpoint: SUCCESS (401 expected for unauthorized)');
      } else {
        console.log('⚠️ Auth endpoint: Unexpected response', error.response?.status);
      }
    }
    console.log('');

    console.log('🎉 All API tests completed successfully!');
    console.log('\n💡 If these tests pass but your app still fails:');
    console.log('1. Check if your device has internet access');
    console.log('2. Verify the app has INTERNET permission');
    console.log('3. Check if any VPN or firewall is blocking the connection');
    console.log('4. Try using a different network (mobile data vs WiFi)');

  } catch (error) {
    console.error('❌ API connectivity test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused - possible issues:');
      console.log('1. Server is not running');
      console.log('2. Port 50160 is not open');
      console.log('3. Firewall is blocking the connection');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 DNS resolution failed - possible issues:');
      console.log('1. IP address is incorrect');
      console.log('2. DNS server issues');
      console.log('3. Network connectivity problems');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Request timed out - possible issues:');
      console.log('1. Slow network connection');
      console.log('2. Server is overloaded');
      console.log('3. Network latency issues');
    }
  }
}

testAPIConnectivity(); 