import axios from "axios";

// replace with your API URL
const API_URL = "http://localhost:3000";  

export const register = async (mobileNumber, userId, fullName) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      mobileNumber,
      userId,
      fullName,
    });
    console.log(`✅ Registered: ${fullName}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Registration failed for ${fullName}:`, error.response?.data || error.message);
  }
};

const run = async () => {
  const users = [
    "sixth user",
    "seventh user",
    "eighth user",
    "ninth user",
    "tenth user",
    "eleventh user",
    "twelfth user",
    "thirteenth user",
    "fourteenth user",
    "fifteenth user",
  ];

  for (let i = 0; i < users.length; i++) {
    const id = i + 6; // 6 → 15
    await register(String(id), String(id), users[i]);
  }
};

run();
