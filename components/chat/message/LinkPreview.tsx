// Shared link preview chip (open URL / remove)
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface LinkPreviewProps {
  url: string;
  onRemove: () => void;
}

export function LinkPreview({ url, onRemove }: LinkPreviewProps) {
  const domain = useMemo(() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }, [url]);

  const handlePress = () => {
    Linking.openURL(url).catch((err) => console.error('Failed to open URL:', err));
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="bg-gray-100 rounded-xl p-2.5 mr-2 flex-row items-center border border-gray-200"
      style={{ minWidth: 200 }}
      activeOpacity={0.7}
    >
      <View className="flex-1 flex-row items-center">
        <View className="w-9 h-9 rounded-lg bg-green-100 items-center justify-center mr-2.5">
          <Ionicons name="link" size={20} color="#1DAB61" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
            {domain}
          </Text>
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {url}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 ml-2"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
