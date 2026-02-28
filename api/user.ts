// api/user.ts
import { api, apiUrl } from "@/api/apiClient";
import { AuthStorage } from "@/utils/authStorage";

export const fetchUserProfile = async () => {
  try {
    const storedUser = await AuthStorage.getUser();
    if (!storedUser || !storedUser.seid) {
      throw new Error("No user userId found");
    }

    const response = await api.get(
      apiUrl(`/api/users/${storedUser.seid}/profile`)
    );

    await AuthStorage.storeUser({
      userId: response.data.seid,
      mobileNumber: response.data.mobileno,
      name: response.data.sevakname,
      fullName: response.data.sevakname,
      role: response.data.usertype,
      ...response.data,
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    const storedUser = await AuthStorage.getUser();
    if (storedUser) return storedUser;
    throw error;
  }
};

export const logout = async () => {
  try {
    await AuthStorage.clear();
  } catch (error) {
    console.error("Error during logout:", error);
  }
};
