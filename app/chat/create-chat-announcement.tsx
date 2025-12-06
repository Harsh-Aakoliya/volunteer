// app/chat/create-chat-announcement.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  Modal,
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from 'expo-file-system';
import axios from "axios";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { API_URL } from "@/constants/api";
import socketService from "@/utils/socketService";

const ForwardedRichEditor = React.forwardRef<RichEditor, any>((props, ref) => (
  <RichEditor {...props} ref={ref} />
));

const StyledRichEditor = cssInterop(ForwardedRichEditor, {
  className: 'style'
});

const StyledRichToolbar = cssInterop(RichToolbar, {
  className: 'style'
});

type VMMediaFile = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  caption: string;
};

type UploadingFile = {
  name: string;
  size: number;
  progress: number;
  mimeType: string;
};

const SEPARATOR = "|||ANNOUNCEMENT_SEPARATOR|||";

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function CreateChatAnnouncement() {
  const { roomId, userId } = useLocalSearchParams();
  const navigation = useNavigation();
  const richText = useRef<RichEditor>(null);
  const titleInputRef = useRef<TextInput>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  
  // Media upload states
  const [vmMediaFiles, setVmMediaFiles] = useState<VMMediaFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [tempFolderId, setTempFolderId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isSuccessfullySent, setIsSuccessfullySent] = useState(false);
  
  // UI states
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VMMediaFile | null>(null);
  
  // User data
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const initializeData = async () => {
      const user = await AuthStorage.getUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    initializeData();
  }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isSuccessfullySent || (title.trim() === '' && body.trim() === '' && vmMediaFiles.length === 0)) {
        navigation.dispatch(e.data.action);
        return;
      }
      
      e.preventDefault();
      Alert.alert(
        'Discard announcement?',
        'You have unsaved changes. Are you sure you want to discard?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await handleDiscardAndExit();
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, title, body, vmMediaFiles.length, tempFolderId, isSuccessfullySent]);

  const handleDiscardAndExit = async () => {
    if (tempFolderId) {
      try {
        const token = await AuthStorage.getToken();
        await axios.delete(`${API_URL}/api/vm-media/temp/${tempFolderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error("Error deleting temp folder:", error);
      }
    }
  };

  const handleEditorInitialized = useCallback(() => {
    setTimeout(() => {
      setIsEditorReady(true);
    }, 200);
  }, []);

  const handleContentChange = useCallback((html: string) => {
    setBody(html);
  }, []);

  const handleSelectFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: ["image/*", "video/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      setUploading(true);
      const filesToUpload: UploadingFile[] = result.assets.map((asset: any) => ({
        name: asset.name,
        size: asset.size || 0,
        progress: 0,
        mimeType: asset.mimeType || "",
      }));
      setUploadingFiles(filesToUpload);

      const filesWithData = await Promise.all(
        result.assets.map(async (asset: any) => {
          if (Platform.OS === "web") {
            const file = asset.file ?? (asset as any);
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result?.toString().split(",")[1] || "");
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            return {
              name: asset.name,
              mimeType: asset.mimeType || "application/octet-stream",
              fileData: base64,
            };
          } else {
            const fileData = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return {
              name: asset.name,
              mimeType: asset.mimeType || "application/octet-stream",
              fileData,
            };
          }
        })
      );

      try {
        const token = await AuthStorage.getToken();
        const response = await axios.post(
          `${API_URL}/api/vm-media/upload`,
          {
            files: filesWithData,
            tempFolderId: tempFolderId || undefined,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          setTempFolderId(response.data.tempFolderId);
          setVmMediaFiles((prev) => [...prev, ...response.data.uploadedFiles]);
        }

        setTimeout(() => setUploadingFiles([]), 1000);
      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Upload failed", "There was an error uploading your files.");
      } finally {
        setUploading(false);
      }
    } catch (error) {
      console.error("File selection error:", error);
      setUploading(false);
    }
  };

  const removeFile = async (file: VMMediaFile) => {
    try {
      const token = await AuthStorage.getToken();
      await axios.delete(`${API_URL}/api/vm-media/temp/${tempFolderId}/${file.fileName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVmMediaFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (error) {
      console.error("Error removing file:", error);
      Alert.alert("Error", "Failed to remove file");
    }
  };

  const sendAnnouncement = async () => {
    if (title.trim() === '') {
      Alert.alert("Title Required", "Please enter a title for your announcement.");
      return;
    }

    if (body.trim() === '' || body.trim() === '<p></p>' || body.trim() === '<p><br></p>') {
      Alert.alert("Content Required", "Please enter content for your announcement.");
      return;
    }

    setSending(true);
    try {
      const token = await AuthStorage.getToken();
      const messageText = `${title.trim()}${SEPARATOR}${body.trim()}`;
      
      if (vmMediaFiles.length > 0) {
        const filesWithCaptions = vmMediaFiles.map(f => ({
          fileName: f.fileName,
          originalName: f.originalName,
          caption: f.caption || "",
          mimeType: f.mimeType,
          size: f.size
        }));
        
        const response = await axios.post(
          `${API_URL}/api/vm-media/move-to-chat-announcement`,
          {
            tempFolderId,
            roomId,
            senderId: userId,
            filesWithCaptions,
            messageText,
            messageType: 'announcement'
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data.success) {
          if (currentUser && socketService.socket?.connected) {
            socketService.sendMessage(roomId as string, {
              id: response.data.messageId,
              roomId: parseInt(roomId as string),
              senderId: currentUser.userId,
              senderName: currentUser.fullName || "You",
              messageText: messageText,
              messageType: 'announcement',
              createdAt: response.data.createdAt || new Date().toISOString(),
              mediaFilesId: response.data.mediaId,
            }, {
              userId: currentUser.userId,
              userName: currentUser.fullName || "Anonymous",
            });
          }

          setIsSuccessfullySent(true);
          Alert.alert("Success", "Announcement sent successfully!", [
            { text: "OK", onPress: () => router.back() }
          ]);
        }
      } else {
        const response = await axios.post(
          `${API_URL}/api/chat/rooms/${roomId}/messages`,
          { 
            messageText: messageText,
            messageType: 'announcement',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const newMessage = response.data;

        if (currentUser && socketService.socket?.connected) {
          socketService.sendMessage(roomId as string, {
            ...newMessage,
            senderName: currentUser.fullName || "You",
          }, {
            userId: currentUser.userId,
            userName: currentUser.fullName || "Anonymous",
          });
        }

        setIsSuccessfullySent(true);
        Alert.alert("Success", "Announcement sent successfully!", [
          { text: "OK", onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      console.error("Error sending announcement:", error);
      const errorMessage = error.response?.data?.error || error.message || "Failed to send announcement";
      Alert.alert("Error", errorMessage);
    } finally {
      setSending(false);
    }
  };

  const openImageModal = (file: VMMediaFile) => {
    setSelectedFile(file);
    setShowImageModal(true);
  };

  const getDirectImageSource = (fileName: string) => {
    return {
      uri: `${API_URL}/media/chat/temp_${tempFolderId}/${fileName}`
    };
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 items-center justify-center -ml-2"
        >
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>

        <Text className="text-lg font-semibold text-gray-900">
          New Announcement
        </Text>

        <TouchableOpacity
          onPress={sendAnnouncement}
          disabled={!title.trim() || !body.trim() || sending}
          className={`px-4 py-2 rounded-full ${
            (title.trim() && body.trim()) && !sending 
              ? 'bg-blue-500' 
              : 'bg-gray-300'
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-sm">Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          className="flex-1"
          contentContainerClassName="pb-32"
          showsVerticalScrollIndicator={false}
        >
          {/* Form Container */}
          <View className="bg-white mt-2 mx-4 rounded-xl overflow-hidden shadow-sm">
            {/* Title Input */}
            <View className="px-4 py-3 border-b border-gray-100">
              <TextInput
                ref={titleInputRef}
                value={title}
                onChangeText={setTitle}
                placeholder="Announcement title"
                placeholderTextColor="#9ca3af"
                className="text-base text-gray-900 font-medium"
                onFocus={() => setIsTitleFocused(true)}
                onBlur={() => setIsTitleFocused(false)}
              />
            </View>

            {/* Body Input - Rich Editor */}
            <View className="min-h-[200px]">
              <StyledRichEditor
                className="bg-white"
                placeholder="Write your announcement here..."
                initialHeight={200}
                ref={richText}
                onChange={handleContentChange}
                androidHardwareAccelerationDisabled={true}
                androidLayerType="software"
                onEditorInitialized={handleEditorInitialized}
                editorStyle={{
                  backgroundColor: '#ffffff',
                  placeholderColor: '#9ca3af',
                  contentCSSText: `
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px;
                    line-height: 24px;
                    padding: 16px;
                    margin: 0;
                    min-height: 180px;
                    color: #1f2937;
                  `
                }}
              />
            </View>
          </View>

          {/* Media Section */}
          <View className="bg-white mt-3 mx-4 rounded-xl overflow-hidden shadow-sm">
            <TouchableOpacity 
              onPress={handleSelectFiles}
              disabled={uploading}
              className="flex-row items-center px-4 py-4"
            >
              <View className={`w-10 h-10 rounded-full items-center justify-center ${
                uploading ? 'bg-gray-100' : 'bg-blue-50'
              }`}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <Ionicons name="image-outline" size={20} color="#3b82f6" />
                )}
              </View>
              <Text className={`ml-3 text-base ${
                uploading ? 'text-gray-400' : 'text-gray-700'
              }`}>
                {uploading ? "Uploading..." : "Add photos or videos"}
              </Text>
            </TouchableOpacity>

            {/* Uploading Progress */}
            {uploadingFiles.length > 0 && (
              <View className="px-4 pb-4">
                {uploadingFiles.map((file, index) => (
                  <View key={index} className="mb-2 bg-gray-50 p-3 rounded-lg">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-sm text-gray-600 flex-1 mr-2" numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text className="text-xs text-gray-400">{formatBytes(file.size)}</Text>
                    </View>
                    <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <View className="h-full bg-blue-500 w-full rounded-full" />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Uploaded Files Grid */}
            {vmMediaFiles.length > 0 && (
              <View className="px-4 pb-4">
                <View className="flex-row flex-wrap gap-2">
                  {vmMediaFiles.map((file, index) => (
                    <View 
                      key={index} 
                      className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 relative"
                    >
                      <TouchableOpacity 
                        className="w-full h-full" 
                        onPress={() => openImageModal(file)}
                        activeOpacity={0.8}
                      >
                        {file.mimeType.startsWith("image") && (
                          <Image 
                            source={{ uri: `${API_URL}/media/chat/temp_${tempFolderId}/${file.fileName}` }} 
                            className="w-full h-full" 
                            resizeMode="cover"
                          />
                        )}
                        {file.mimeType.startsWith("video") && (
                          <View className="w-full h-full bg-gray-800 justify-center items-center">
                            <Ionicons name="play-circle" size={28} color="white" />
                          </View>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full items-center justify-center"
                        onPress={() => removeFile(file)}
                      >
                        <Ionicons name="close" size={14} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Info Text */}
          <Text className="text-center text-gray-400 text-xs mt-4 px-8">
            Announcements will be visible to all members of this chat
          </Text>
        </ScrollView>

        {/* Floating Toolbar */}
        {isKeyboardVisible && !isTitleFocused && (
          <View className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-200 shadow-lg">
            <StyledRichToolbar
              editor={richText}
              className="bg-white"
              selectedIconTint="#3b82f6"
              iconTint="#6b7280"
              actions={[
                actions.setBold,
                actions.setItalic,
                actions.setUnderline,
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.alignLeft,
                actions.alignCenter,
                actions.alignRight,
              ]}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View className="flex-1 bg-black">
          <View className="flex-row justify-between items-center px-4 pt-12 pb-4">
            <View className="w-16" />
            <Text className="text-white font-medium" numberOfLines={1}>
              {selectedFile?.originalName || 'Preview'}
            </Text>
            <TouchableOpacity
              className="w-16 items-end"
              onPress={() => setShowImageModal(false)}
            >
              <View className="bg-white/20 px-3 py-1.5 rounded-full">
                <Text className="text-white text-sm">Done</Text>
              </View>
            </TouchableOpacity>
          </View>
          {selectedFile && (
            <View className="flex-1 justify-center items-center">
              <Image
                source={getDirectImageSource(selectedFile.fileName)}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}