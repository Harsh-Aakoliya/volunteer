// app/chat/create-chat-announcement.tsx
// Combined Media Uploader + Announcement Creator for Chat
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

// Styled components
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

  // Handle keyboard visibility
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

  // Prevent accidental exit
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
    console.log('Rich editor initialized');
    setTimeout(() => {
      setIsEditorReady(true);
    }, 200);
  }, []);

  const handleContentChange = useCallback((html: string) => {
    setBody(html);
  }, []);

  // File selection and upload
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
      
      // Combine title and body with separator
      const messageText = `${title.trim()}${SEPARATOR}${body.trim()}`;
      
      if (vmMediaFiles.length > 0) {
        // If there are media files, use vm-media flow
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
            messageText, // Title + separator + body
            messageType: 'announcement'
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data.success) {
          // Emit socket event for real-time update
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
        // No media files, just send as announcement message
        const response = await axios.post(
          `${API_URL}/api/chat/rooms/${roomId}/messages`,
          { 
            messageText: messageText,
            messageType: 'announcement',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const newMessage = response.data;

        // Emit socket event
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
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        <Text className="text-lg font-semibold text-gray-900">
          Create Announcement
        </Text>

        <View className="w-8" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          className="flex-1 px-4 py-2"
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
        >
          {/* Title Input */}
          <TextInput
            ref={titleInputRef}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter announcement title..."
            className="text-xl font-semibold text-gray-900 py-2 mb-1"
            placeholderTextColor="#9ca3af"
            multiline={true}
            numberOfLines={3}
            onFocus={() => setIsTitleFocused(true)}
            onBlur={() => setIsTitleFocused(false)}
          />

          {/* Rich Text Editor with Loading Overlay */}
          <View className="relative">
            <StyledRichEditor
              className="min-h-60 bg-white"
              placeholder="Write announcement content..."
              initialHeight={300}
              ref={richText}
              onChange={handleContentChange}
              androidHardwareAccelerationDisabled={true}
              androidLayerType="software"
              onEditorInitialized={handleEditorInitialized}
              editorStyle={{
                contentCSSText: `
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  margin: 0px;
                  border: none;
                  min-height: 200px;
                `
              }}
            />
            
            {/* Loading Overlay
            {!isEditorReady && (
              <View className="absolute inset-0 min-h-60 p-4 bg-gray-50/95 flex items-center justify-center rounded-lg border border-gray-200">
                <ActivityIndicator size="large" color="#0284c7" />
                <Text className="text-gray-500 mt-2">Preparing editor...</Text>
              </View>
            )} */}
          </View>

          {/* Media Section */}
          <View className="mt-6 mb-4">
            <Text className="text-lg font-semibold mb-3">Attach Media (optional)</Text>
            
            <TouchableOpacity 
              onPress={handleSelectFiles}
              className={`py-3 px-4 rounded-lg mb-4 ${uploading ? 'bg-gray-400' : 'bg-blue-500'}`}
              disabled={uploading}
            >
              <Text className="text-white font-semibold text-center">
                {uploading ? "Uploading..." : "Select Images/Videos"}
              </Text>
            </TouchableOpacity>

            {uploadingFiles.length > 0 && (
              <View className="mb-4">
                {uploadingFiles.map((file, index) => (
                  <View key={index} className="mb-2">
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-sm" numberOfLines={1}>{file.name}</Text>
                      <Text className="text-sm text-blue-600">{formatBytes(file.size)}</Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View className="h-full bg-blue-500 w-full" />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {vmMediaFiles.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {vmMediaFiles.map((file, index) => (
                  <View key={index} className="w-24 h-24 rounded-lg overflow-hidden relative bg-gray-100">
                    <TouchableOpacity className="w-full h-full" onPress={() => openImageModal(file)}>
                      {file.mimeType.startsWith("image") && (
                        <Image 
                          source={{ uri: `${API_URL}/media/chat/temp_${tempFolderId}/${file.fileName}` }} 
                          className="w-full h-full" 
                          resizeMode="cover"
                        />
                      )}
                      {file.mimeType.startsWith("video") && (
                        <View className="w-full h-full bg-red-500 justify-center items-center">
                          <Text className="text-2xl">🎬</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      className="absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 justify-center items-center"
                      onPress={() => removeFile(file)}
                    >
                      <Text className="text-white text-xs font-bold">×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Send Button */}
          <TouchableOpacity
            className={`py-3 px-4 rounded-lg mt-4 ${(title.trim() && body.trim()) && !sending ? 'bg-green-500' : 'bg-gray-400'}`}
            onPress={sendAnnouncement}
            disabled={!title.trim() || !body.trim() || sending}
          >
            {sending ? (
              <View className="flex-row justify-center items-center">
                <ActivityIndicator size="small" color="white" className="mr-2" />
                <Text className="text-white font-semibold text-center">Sending...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold text-center">Send Announcement</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Floating Toolbar */}
        {isKeyboardVisible && !isTitleFocused && (
          <View 
            className="left-0 right-0 bg-white border-t border-gray-300 shadow-lg"
            style={{ bottom: 0 }}
          >
            <StyledRichToolbar
              editor={richText}
              className="bg-white"
              selectedIconTint="#2563EB"
              iconTint="#6B7280"
              actions={[
                actions.setBold,
                actions.setItalic,
                actions.setUnderline,
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.alignLeft,
                actions.alignCenter,
                actions.alignRight,
                actions.undo,
                actions.redo,
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
          <View className="flex-row justify-end p-5 pt-12">
            <TouchableOpacity
              className="bg-black/60 p-3 rounded-full"
              onPress={() => setShowImageModal(false)}
            >
              <Text className="text-white text-base">Close</Text>
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

