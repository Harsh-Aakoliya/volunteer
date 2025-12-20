// hooks/useSimCards.ts
import { useState, useCallback } from "react";
import { Platform, Alert, PermissionsAndroid } from "react-native";

interface SimCard {
  phoneNumber: string;
  carrierName: string;
  slotIndex: number;
}

interface UseSimCardsReturn {
  fetchSimCards: () => Promise<SimCard[]>;
  isLoading: boolean;
  isSupported: boolean;
}

export const useSimCards = (): UseSimCardsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const requestAndroidPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        {
          title: "Phone State Permission",
          message: "This app needs access to your phone state to read SIM information.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        }
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }

      // For Android 10+, we might need READ_PHONE_NUMBERS
      if (Platform.Version >= 29) {
        const phoneNumbersGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS,
          {
            title: "Phone Numbers Permission",
            message: "This app needs access to read your phone numbers.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        return phoneNumbersGranted === PermissionsAndroid.RESULTS.GRANTED;
      }

      return true;
    } catch (err) {
      console.warn("Permission error:", err);
      return false;
    }
  };

  const fetchSimCards = useCallback(async (): Promise<SimCard[]> => {
    setIsLoading(true);

    try {
      // Request permissions on Android
      if (Platform.OS === "android") {
        const hasPermission = await requestAndroidPermissions();
        if (!hasPermission) {
          setIsSupported(false);
          throw new Error("Permission denied");
        }
      }

      // Dynamically import to avoid errors if not available
      const SimCardsManager = require("react-native-sim-cards-manager").default;
      
      const simCards = await SimCardsManager.getSimCards({
        title: "Select SIM",
        message: "Please select a SIM card",
      });

      if (!simCards || simCards.length === 0) {
        setIsSupported(false);
        return [];
      }

      // Filter and map SIM cards with valid phone numbers
        const validSimCards: SimCard[] = simCards
        .filter((sim: any) => sim.phoneNumber && sim.phoneNumber.length > 0)
        .map((sim: any, index: number) => {
        // Remove all non-digit characters
        const digitsOnly = sim.phoneNumber.replace(/\D/g, "");
        // Get last 10 digits (removes country code)
        const mobileNumber = digitsOnly.slice(-10);
        
            return {
                phoneNumber: mobileNumber,
                carrierName: sim.carrierName || `SIM ${index + 1}`,
                slotIndex: sim.slotIndex ?? index,
            };
        })
        .filter((sim:any) => sim.phoneNumber.length === 10); // Only keep valid 10-digit numbers

      if (validSimCards.length === 0) {
        setIsSupported(false);
      }

      return validSimCards;
    } catch (error: any) {
      console.log("SIM fetch error:", error);
      setIsSupported(false);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    fetchSimCards,
    isLoading,
    isSupported,
  };
};