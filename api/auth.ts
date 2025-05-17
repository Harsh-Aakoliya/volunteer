// api/auth.ts
import axios from "axios";
import { API_URL } from "../constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { User } from "@/types/type";
import { router } from "expo-router";

export const login = async (mobileNumber: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
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
        alert("Error fetching user profile. Please try again.");
        return null;
      }

      // Store user data if available
      if (userData) {
        await AuthStorage.storeUser(userData);
      }

      // Store admin status
      await AuthStorage.storeAdminStatus(response.data.isAdmin);

      // Redirect to announcement page on successful login
      router.replace("/announcement");
      return response.data;
    } else {
      return response.data;
    }
  } catch (error: any) {
    console.error("Login error", error);
    
    // Check if user doesn't exist (needs to register)
    if (error.response && error.response.status === 404) {
      alert("User not found. Please register first.");
      router.replace("/signup");
      return null;
    }
    
    // Check if user exists but not approved
    if (error.response && error.response.status === 401) {
      if (error.response.data && error.response.data.message && 
          error.response.data.message.includes("not approved")) {
        alert("Your registration is pending. Please wait for admin approval.");
        router.replace("/login");

        return null;
      } else {
        alert("Invalid credentials. Please try again.");
        router.replace("/login");

        return null;
      }
    }
    
    // Network or other errors
    alert("Error while logging in. Please try again later.");
    router.replace("/login");

    return null;
  }
};

export const register = async (mobileNumber: string, userId: string) => {
  try {

    const response = await axios.post(`${API_URL}/api/auth/register`, {
      mobileNumber,
      userId,
    });
    return response.data;
  } catch (error: any) {
    console.error("Registration error", error);
  }
};