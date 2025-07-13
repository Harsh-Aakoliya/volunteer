// // constants/index.js
// // Replace with your actual server address - this would typically come from environment variables
// // export const API_URL = 'http://103.47.172.58:50160';//outside org network
// export const API_URL = 'http://192.168.8.34:3000'; // inside org network

// export const SOCKET_URL = API_URL; // Socket.IO connects to the same server

// // Debug logging for API URL
// console.log('🔗 API_URL configured as:', API_URL);
// console.log('🌐 SOCKET_URL configured as:', SOCKET_URL);


// // expo 

// //both needs to be there in same network i.e. in org network
// //so api url will be outside org network and in expo we will use exp:192.168.8.34:8081 

// //development build

// //if both are in same network then 
// // for development build frontend we will use http:192.168.8.34:8081 and http://192.168.8.34:3000 for API_URL





//normal env
export const API_URL = 'http://192.168.148.33:3000'; 

export const SOCKET_URL = API_URL; // Socket.IO connects to the same server

// Debug logging for API URL
console.log('🔗 API_URL configured as:', API_URL);
console.log('🌐 SOCKET_URL configured as:', SOCKET_URL);