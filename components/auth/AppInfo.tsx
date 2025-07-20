import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { API_URL } from '@/constants/api';
import axios from 'axios';

interface AppInfoProps {
  visible: boolean;
  onClose: () => void;
}

const AppInfo: React.FC<AppInfoProps> = ({ visible, onClose }) => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoadingDeviceId, setIsLoadingDeviceId] = useState(false);
  const [deviceIdError, setDeviceIdError] = useState<string | null>(null);
  const [serverResponse, setServerResponse] = useState<string | null>(null);

  // Fetch device ID when component mounts
  useEffect(() => {
    const fetchDeviceId = async (): Promise<void> => {
      setIsLoadingDeviceId(true);
      try {
        const id = await Application.getAndroidId();
        setDeviceId(id);
        console.log(id);
        setDeviceIdError(null);
      } catch (error) {
        console.error("Failed to fetch device ID:", error);
        setDeviceIdError("Failed to fetch device ID");
      } finally {
        setIsLoadingDeviceId(false);
      }
    };
    
    if (visible) {
      fetchDeviceId();
    }
  }, [visible]);

  const testServer = () => {
    axios.get(`${API_URL}/api/test`)
      .then(res => {
        setServerResponse(res.data.message);
      })
      .catch(err => {
        setServerResponse(err.response?.data?.message || 'Server test failed');
      });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-xl mx-4 w-80 max-h-96">
              <SafeAreaView>
                {/* Header */}
                <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                  <Text className="text-lg font-bold text-gray-900">App Information</Text>
                  <TouchableOpacity onPress={onClose} className="p-1">
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView className="p-4 space-y-4">
                  {/* Device ID */}
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-gray-700">Device ID</Text>
                    {isLoadingDeviceId ? (
                      <Text className="text-gray-500">Loading...</Text>
                    ) : deviceIdError ? (
                      <Text className="text-red-500">{deviceIdError}</Text>
                    ) : (
                      <Text className="text-gray-600 text-xs font-mono">{deviceId}</Text>
                    )}
                  </View>

                  {/* App Version */}
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-gray-700">App Version</Text>
                    <Text className="text-gray-600">{Application.nativeApplicationVersion}</Text>
                  </View>

                  {/* Build Version */}
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-gray-700">Build Version</Text>
                    <Text className="text-gray-600">{Application.nativeBuildVersion}</Text>
                  </View>

                  {/* Current Version */}
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-gray-700">Current Version</Text>
                    <Text className="text-gray-600">1.0.4</Text>
                  </View>

                  {/* Backend URL */}
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-gray-700">Backend URL</Text>
                    <Text className="text-gray-600 text-xs font-mono">{API_URL}</Text>
                  </View>

                  {/* Server Test */}
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-gray-700">Server Test</Text>
                    <TouchableOpacity
                      onPress={testServer}
                      className="bg-blue-500 px-4 py-2 rounded-lg"
                    >
                      <Text className="text-white text-center font-medium">Test Server</Text>
                    </TouchableOpacity>
                    {serverResponse && (
                      <View className="mt-2 p-2 bg-gray-100 rounded">
                        <Text className="text-gray-700 text-sm">{serverResponse}</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </SafeAreaView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default AppInfo; 