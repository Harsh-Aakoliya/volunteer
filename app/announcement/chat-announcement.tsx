// app/announcement/chat-announcement.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatISTDate } from '@/utils/dateUtils';
import { WebView } from 'react-native-webview';

const ChatAnnouncementDetails = () => {
  const params = useLocalSearchParams();
  const [contentHeight, setContentHeight] = useState(200);
  
  const title = params.title as string || 'Untitled';
  const body = params.body as string || '';
  const authorName = params.authorName as string || 'Unknown';
  const createdAt = params.createdAt as string || new Date().toISOString();
  const attachedMediaFiles = params.attachedMediaFiles 
    ? JSON.parse(params.attachedMediaFiles as string) 
    : [];

  const screenWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="relative flex-row justify-center items-center px-4 py-3 bg-white border-b border-gray-200">
        {/* Back Button */}
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="absolute left-4 z-10"
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        {/* Title */}
        <Text className="text-xl font-bold">Announcement</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
        <View className="px-4 py-4">
          {/* Announcement icon */}
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="megaphone" size={24} color="#0284c7" />
            </View>
            <View>
              <Text className="text-sm text-gray-600">From Chat Room</Text>
              <Text className="text-xs text-gray-500">
                {formatISTDate(createdAt, { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric', 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                })}
              </Text>
            </View>
          </View>

          <Text className="text-3xl font-bold text-gray-900 mb-2">{title}</Text>
          <Text className="text-sm text-gray-500 mb-4">
            By {authorName}
          </Text>
          <View className="bg-gray-100 h-px mb-4"></View>
          
          {/* Body content */}
          <WebView
            source={{ html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    margin: 0;
                    padding: 0;
                    color: #374151;
                  }
                  p {
                    margin: 0 0 0.5em 0;
                    line-height: 1.6;
                  }
                  h1, h2, h3, h4, h5, h6 {
                    margin: 0.5em 0 0.25em 0;
                    line-height: 1.3;
                  }
                  ul, ol {
                    margin: 0.5em 0;
                    padding-left: 1.5em;
                  }
                  li {
                    margin: 0.25em 0;
                    line-height: 1.6;
                  }
                  strong, b {
                    font-weight: 600;
                  }
                  em, i {
                    font-style: italic;
                  }
                </style>
              </head>
              <body>
                ${body}
              </body>
              <script>
                function sendHeight() {
                  const height = Math.max(document.body.scrollHeight, document.body.offsetHeight);
                  window.ReactNativeWebView.postMessage(JSON.stringify({type: 'contentHeight', height: height}));
                }
                
                window.addEventListener('load', sendHeight);
                document.addEventListener('DOMContentLoaded', sendHeight);
                setTimeout(sendHeight, 100);
              </script>
            ` }}
            style={{ 
              height: contentHeight, 
              backgroundColor: 'transparent',
              marginVertical: 8
            }}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'contentHeight') {
                  setContentHeight(data.height + 20);
                }
              } catch (error) {
                console.log('Error parsing WebView message:', error);
              }
            }}
          />

          {/* Attached Media Files - if any */}
          {attachedMediaFiles.length > 0 && (
            <View className="mt-4">
              <Text className="text-base font-semibold text-gray-900 mb-3">
                Attached Files ({attachedMediaFiles.length})
              </Text>
              {attachedMediaFiles.map((file: any, index: number) => (
                <View 
                  key={index} 
                  className="flex-row items-center p-3 bg-gray-50 rounded-lg mb-2"
                >
                  <Ionicons 
                    name={
                      file.mimeType?.startsWith('image/') ? 'image' :
                      file.mimeType?.startsWith('video/') ? 'videocam' :
                      file.mimeType?.startsWith('audio/') ? 'musical-notes' :
                      'document'
                    } 
                    size={24} 
                    color="#6b7280" 
                  />
                  <Text className="ml-3 text-gray-800 flex-1" numberOfLines={1}>
                    {file.originalName || file.fileName || `File ${index + 1}`}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChatAnnouncementDetails;

