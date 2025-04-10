// api/auth.ts
import axios from "axios";
import { API_URL } from "../constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { User } from "@/types/type";

export const login = async (mobileNumber: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/login`, {
      mobileNumber,
      password,
    });

    console.log("Login response:", response.data);
    console.log("Token get from backend", response.data.token);

    if (response.data.success) {
      // Store token
      await AuthStorage.storeToken(response.data.token);

      // If no user data in response, fetch user profile
      let userData: User | null = null;
      try {
        const profileResponse = await axios.get(
          `${API_URL}/api/users/${response.data.userId}/profile`,
          {
            headers: {
              Authorization: `Bearer ${response.data.token}`,
            },
          }
        );
        userData = profileResponse.data;
        console.log("User data from profile:", userData);
      } catch (profileError) {
        console.error("Error fetching user profile:", profileError);
      }

      // Store user data if available
      if (userData) {
        await AuthStorage.storeUser(userData);
      }

      // Store admin status
      await AuthStorage.storeAdminStatus(response.data.isAdmin);

      return response.data;
    }

    throw new Error(response.data.message || "Login failed");
  } catch (error) {
    console.error("Login error", error);
    throw error;
  }
};
export const register = async (mobileNumber: string, specificId: string) => {
  const response = await axios.post(`${API_URL}/api/register`, {
    mobileNumber,
    specificId,
  });
  return response.data;
};
