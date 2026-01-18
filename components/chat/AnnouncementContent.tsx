// components/chat/AnnouncementContent.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  Modal,
} from "react-native";
import {
  RichEditor,
  RichToolbar,
  actions,
} from "react-native-pell-rich-editor";
import { cssInterop } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import { SafeAreaView } from "react-native-safe-area-context";

// Forward ref for RichEditor to work with cssInterop
const ForwardedRichEditor = React.forwardRef<RichEditor, any>((props, ref) => (
  <RichEditor {...props} ref={ref} />
));

const StyledRichEditor = cssInterop(ForwardedRichEditor, {
  className: "style",
});

const StyledRichToolbar = cssInterop(RichToolbar, {
  className: "style",
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

interface AnnouncementContentProps {
  roomId: string;
  userId: string;
  onSuccess: () => void;
  onBack: () => void;
  isDark?: boolean;
  showInSheet?: boolean;  // NEW
  isHalfScreen?: boolean; // NEW
}

const SEPARATOR = "|||ANNOUNCEMENT_SEPARATOR|||";

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export default function AnnouncementContent({
  roomId,
  userId,
  onSuccess,
  onBack,
  isDark = false,
  showInSheet = false,
  isHalfScreen = false,
}: AnnouncementContentProps) {
  const richText = useRef<RichEditor>(null);
  const titleInputRef = useRef<TextInput>(null);

  // Socket context
  const { isConnected, sendMessage: socketSendMessage } = useSocket();

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Media upload states
  const [vmMediaFiles, setVmMediaFiles] = useState<VMMediaFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [tempFolderId, setTempFolderId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // UI states
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VMMediaFile | null>(null);

  // User data
  const [currentUser, setCurrentUser] = useState<any>(null);

  const Wrapper = showInSheet ? View : SafeAreaView;


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
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const handleDiscardAndExit = async () => {
    if (tempFolderId) {
      try {
        const token = await AuthStorage.getToken();
        await axios.delete(`${API_URL}/api/vm-media/temp/${tempFolderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.error("Error deleting temp folder:", error);
      }
    }
  };

  const handleBack = () => {
    if (
      title.trim() === "" &&
      body.trim() === "" &&
      vmMediaFiles.length === 0
    ) {
      onBack();
      return;
    }

    Alert.alert(
      "Discard announcement?",
      "You have unsaved changes. Are you sure you want to discard?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await handleDiscardAndExit();
            onBack();
          },
        },
      ]
    );
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
              reader.onloadend = () =>
                resolve(reader.result?.toString().split(",")[1] || "");
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
      await axios.delete(
        `${API_URL}/api/vm-media/temp/${tempFolderId}/${file.fileName}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setVmMediaFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (error) {
      console.error("Error removing file:", error);
      Alert.alert("Error", "Failed to remove file");
    }
  };

  const sendAnnouncement = async () => {
    if (title.trim() === "") {
      Alert.alert(
        "Title Required",
        "Please enter a title for your announcement."
      );
      return;
    }

    if (
      body.trim() === "" ||
      body.trim() === "<p></p>" ||
      body.trim() === "<p><br></p>"
    ) {
      Alert.alert(
        "Content Required",
        "Please enter content for your announcement."
      );
      return;
    }

    setSending(true);
    try {
      const token = await AuthStorage.getToken();
      const messageText = `${title.trim()}${SEPARATOR}${body.trim()}`;

      if (vmMediaFiles.length > 0) {
        const filesWithCaptions = vmMediaFiles.map((f) => ({
          fileName: f.fileName,
          originalName: f.originalName,
          caption: f.caption || "",
          mimeType: f.mimeType,
          size: f.size,
        }));

        const response = await axios.post(
          `${API_URL}/api/vm-media/move-to-chat-announcement`,
          {
            tempFolderId,
            roomId,
            senderId: userId,
            filesWithCaptions,
            messageText,
            messageType: "announcement",
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.success) {
          if (currentUser && isConnected) {
            socketSendMessage(roomId, {
              id: response.data.messageId,
              messageText: messageText,
              messageType: "announcement",
              createdAt: response.data.createdAt || new Date().toISOString(),
              mediaFilesId: response.data.mediaId,
            });
          }

          Alert.alert("Success", "Announcement sent successfully!", [
            { text: "OK", onPress: () => onSuccess() },
          ]);
        }
      } else {
        const response = await axios.post(
          `${API_URL}/api/chat/rooms/${roomId}/messages`,
          {
            messageText: messageText,
            messageType: "announcement",
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const newMessage = response.data;

        if (currentUser && isConnected) {
          socketSendMessage(roomId, {
            id: newMessage.id,
            messageText: newMessage.messageText,
            messageType: newMessage.messageType,
            createdAt: newMessage.createdAt,
          });
        }

        Alert.alert("Success", "Announcement sent successfully!", [
          { text: "OK", onPress: () => onSuccess() },
        ]);
      }
    } catch (error: any) {
      console.error("Error sending announcement:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to send announcement";
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
      uri: `${API_URL}/media/chat/temp_${tempFolderId}/${fileName}`,
    };
  };

  const isBodyEmpty =
    body.trim() === "" ||
    body.trim() === "<p></p>" ||
    body.trim() === "<p><br></p>";
  const isCreateEnabled = title.trim() !== "" && !isBodyEmpty;

  return (
    <Wrapper
    className={`flex-1 ${isDark ? "bg-[#0E1621]" : "bg-gray-50"}`}
    style={showInSheet ? { flex: 1, backgroundColor: isDark ? "#0E1621" : "#f9fafb" } : undefined}
    // Remove edges prop when using View
    {...(!showInSheet && { edges: ["top"] })}
  >
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0E1621]" : "bg-gray-50"}`}
      edges={["top"]}
    >
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 py-3 ${
          isDark ? "border-gray-700" : "border-gray-200"
        } border-b ${isDark ? "bg-[#0E1621]" : "bg-white"}`}
      >
        <TouchableOpacity onPress={handleBack} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? "#8E8E93" : "#007AFF"}
          />
        </TouchableOpacity>

        <Text
          className={`${
            isDark ? "text-white" : "text-black"
          } text-lg font-semibold`}
        >
          New Announcement
        </Text>

        <TouchableOpacity
          onPress={sendAnnouncement}
          disabled={!isCreateEnabled || sending}
          className="p-2"
        >
          {sending ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text
              className={`text-base font-semibold ${
                isCreateEnabled
                  ? "text-[#007AFF]"
                  : isDark
                  ? "text-gray-600"
                  : "text-gray-400"
              }`}
            >
              CREATE
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 128 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Form Container */}
          <View
            className={`${
              isDark ? "bg-[#17212B]" : "bg-white"
            } mt-2 mx-4 rounded-xl overflow-hidden shadow-sm`}
          >
            {/* Title Input */}
            <View
              className={`px-4 py-3 border-b ${
                isDark ? "border-gray-700" : "border-gray-100"
              }`}
            >
              <TextInput
                ref={titleInputRef}
                value={title}
                onChangeText={setTitle}
                placeholder="Announcement title"
                placeholderTextColor={isDark ? "#8E8E93" : "#9ca3af"}
                className={`text-base font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
                onFocus={() => setIsTitleFocused(true)}
                onBlur={() => setIsTitleFocused(false)}
              />
            </View>

            {/* Body Input - Rich Editor */}
            <View className="min-h-[200px]">
              <StyledRichEditor
                className={isDark ? "bg-[#17212B]" : "bg-white"}
                placeholder="Write your announcement here..."
                initialHeight={200}
                ref={richText}
                onChange={handleContentChange}
                androidHardwareAccelerationDisabled={true}
                androidLayerType="software"
                onEditorInitialized={handleEditorInitialized}
                editorStyle={{
                  backgroundColor: isDark ? "#17212B" : "#ffffff",
                  placeholderColor: isDark ? "#8E8E93" : "#9ca3af",
                  contentCSSText: `
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px;
                    line-height: 24px;
                    padding: 16px;
                    margin: 0;
                    min-height: 180px;
                    color: ${isDark ? "#ffffff" : "#1f2937"};
                    background-color: ${isDark ? "#17212B" : "#ffffff"};
                  `,
                }}
              />
            </View>
          </View>

          {/* Media Section */}
          <View
            className={`${
              isDark ? "bg-[#17212B]" : "bg-white"
            } mt-3 mx-4 rounded-xl overflow-hidden shadow-sm`}
          >
            <TouchableOpacity
              onPress={handleSelectFiles}
              disabled={uploading}
              className="flex-row items-center px-4 py-4"
            >
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  uploading
                    ? isDark
                      ? "bg-gray-700"
                      : "bg-gray-100"
                    : isDark
                    ? "bg-blue-900"
                    : "bg-blue-50"
                }`}
              >
                {uploading ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#60a5fa" : "#3b82f6"}
                  />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={20}
                    color={isDark ? "#60a5fa" : "#3b82f6"}
                  />
                )}
              </View>
              <Text
                className={`ml-3 text-base ${
                  uploading
                    ? isDark
                      ? "text-gray-500"
                      : "text-gray-400"
                    : isDark
                    ? "text-gray-300"
                    : "text-gray-700"
                }`}
              >
                {uploading ? "Uploading..." : "Add photos or videos"}
              </Text>
            </TouchableOpacity>

            {/* Uploading Progress */}
            {uploadingFiles.length > 0 && (
              <View className="px-4 pb-4">
                {uploadingFiles.map((file, index) => (
                  <View
                    key={index}
                    className={`mb-2 p-3 rounded-lg ${
                      isDark ? "bg-gray-800" : "bg-gray-50"
                    }`}
                  >
                    <View className="flex-row justify-between mb-2">
                      <Text
                        className={`text-sm flex-1 mr-2 ${
                          isDark ? "text-gray-300" : "text-gray-600"
                        }`}
                        numberOfLines={1}
                      >
                        {file.name}
                      </Text>
                      <Text
                        className={`text-xs ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}
                      >
                        {formatBytes(file.size)}
                      </Text>
                    </View>
                    <View
                      className={`h-1.5 rounded-full overflow-hidden ${
                        isDark ? "bg-gray-700" : "bg-gray-200"
                      }`}
                    >
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
                      className={`w-24 h-24 rounded-lg overflow-hidden relative ${
                        isDark ? "bg-gray-800" : "bg-gray-100"
                      }`}
                    >
                      <TouchableOpacity
                        className="w-full h-full"
                        onPress={() => openImageModal(file)}
                        activeOpacity={0.8}
                      >
                        {file.mimeType.startsWith("image") && (
                          <Image
                            source={{
                              uri: `${API_URL}/media/chat/temp_${tempFolderId}/${file.fileName}`,
                            }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        )}
                        {file.mimeType.startsWith("video") && (
                          <View className="w-full h-full bg-gray-800 justify-center items-center">
                            <Ionicons
                              name="play-circle"
                              size={28}
                              color="white"
                            />
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
        </ScrollView>

        {/* Floating Toolbar */}
        {isKeyboardVisible && !isTitleFocused && (
          <View
            className={`absolute left-0 right-0 bottom-0 border-t shadow-lg ${
              isDark
                ? "bg-[#17212B] border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <StyledRichToolbar
              editor={richText}
              className={isDark ? "bg-[#17212B]" : "bg-white"}
              selectedIconTint={isDark ? "#60a5fa" : "#3b82f6"}
              iconTint={isDark ? "#9ca3af" : "#6b7280"}
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
          <SafeAreaView className="flex-1">
            <View className="flex-row justify-between items-center px-4 py-4">
              <View className="w-16" />
              <Text
                className="text-white font-medium flex-1 text-center"
                numberOfLines={1}
              >
                {selectedFile?.originalName || "Preview"}
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
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
    </Wrapper>
  );
}