
// import React, { createContext, useState, useContext, useEffect } from 'react';
// import { storage } from '../utils/storage';

// type AuthContextType = {
//   token: string | null;
//   isLoading: boolean;
//   login: () => Promise<void>;
//   logout: () => Promise<void>;
// };

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
//   const [token, setToken] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
// a
//   // Check for existing token on app launch
//   useEffect(() => {
//     checkToken();
//   }, []);

//   const checkToken = async () => {
//     try {
//       const savedToken = await storage.getToken();
//       setToken(savedToken);
//     } catch (error) {
//       console.error('Error checking token:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Login: Generate random token and save it
//   const login = async () => {
//     try {
//       const randomToken = `token_${Math.random().toString(36).substring(7)}_${Date.now()}`;
//       await storage.saveToken(randomToken);
//       setToken(randomToken);
//       console.log("Token saved ",randomToken);
//     } catch (error) {
//       console.error('Error during login:', error);
//       throw error;
//     }
//   };

//   // Logout: Remove token from storage
//   const logout = async () => {
//     try {
//       await storage.removeToken();
//       setToken(null);
//     } catch (error) {
//       console.error('Error during logout:', error);
//       throw error;
//     }
//   };

//   return (
//     <AuthContext.Provider value={{ token, isLoading, login, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// // Custom hook to use auth context
// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within AuthProvider');
//   }
//   return context;
// };

