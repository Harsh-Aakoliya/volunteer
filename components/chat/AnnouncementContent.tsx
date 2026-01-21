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
  Platform,
  Keyboard,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import { cssInterop } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";

// Conditionally import rich editor only for native platforms
let RichEditor: any = null;
let RichToolbar: any = null;
let actions: any = {};

if (Platform.OS !== 'web') {
  try {
    const richEditorModule = require('react-native-pell-rich-editor');
    RichEditor = richEditorModule.RichEditor;
    RichToolbar = richEditorModule.RichToolbar;
    actions = richEditorModule.actions;
  } catch (e) {
    console.warn('react-native-pell-rich-editor not available');
  }
}

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
  showInSheet?: boolean;
  isHalfScreen?: boolean;
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

// Only create styled components if RichEditor is available
let StyledRichEditor: any = null;
let StyledRichToolbar: any = null;

if (RichEditor) {
  const ForwardedRichEditor = React.forwardRef<typeof RichEditor, any>((props, ref) => (
    <RichEditor {...props} ref={ref} />
  ));
  StyledRichEditor = cssInterop(ForwardedRichEditor, {
    className: "style",
  });
  StyledRichToolbar = cssInterop(RichToolbar, {
    className: "style",
  });
}

export default function AnnouncementContent({
  roomId,
  userId,
  onSuccess,
  onBack,
  isDark = false,
  showInSheet = false,
  isHalfScreen = false,
}: AnnouncementContentProps) {
  
  // Return early for web platform
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#0E1621" : "#fff" }]}>
        <View style={styles.webNotSupported}>
          <Ionicons
            name="desktop-outline"
            size={48}
            color={isDark ? "#6B7280" : "#9CA3AF"}
          />
          <Text style={[styles.webNotSupportedTitle, { color: isDark ? "#fff" : "#111827" }]}>
            Web Not Supported
          </Text>
          <Text style={[styles.webNotSupportedText, { color: isDark ? "#9CA3AF" : "#6B7280" }]}>
            Creating announcements with rich text editor is only available on mobile devices.
          </Text>
          <TouchableOpacity
            onPress={onBack}
            style={[styles.webBackButton, { backgroundColor: isDark ? "#3B82F6" : "#007AFF" }]}
          >
            <Text style={styles.webBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Native platform code continues here...
  const richText = useRef<typeof RichEditor>(null);
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
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
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });

    const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      keyboardShowListener?.remove();
      keyboardHideListener?.remove();
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

  const handleEditorInitialized = useCallback(() => {
    setTimeout(() => {
      setIsEditorReady(true);
    }, 200);
  }, []);

  const handleContentChange = useCallback((html: string) => {
    setBody(html);
  }, []);

  const handleEditorFocus = useCallback(() => {
    setIsEditorFocused(true);
    setIsTitleFocused(false);
  }, []);

  const handleEditorBlur = useCallback(() => {
    setIsEditorFocused(false);
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
          const fileData = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return {
            name: asset.name,
            mimeType: asset.mimeType || "application/octet-stream",
            fileData,
          };
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

  const isCreateEnabled =
    title.trim() !== "" &&
    body.trim() !== "" &&
    body.trim() !== "<p></p>" &&
    body.trim() !== "<p><br></p>";

  const sendAnnouncement = async () => {
    if (title.trim() === "") {
      Alert.alert("Title Required", "Please enter a title for your announcement.");
      return;
    }

    if (!isCreateEnabled) {
      Alert.alert("Content Required", "Please enter content for your announcement.");
      return;
    }

    Keyboard.dismiss();
    richText.current?.blurContentEditor();

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

        if (response.data.success && currentUser && isConnected) {
          socketSendMessage(roomId, {
            id: response.data.messageId,
            messageText: messageText,
            messageType: "announcement",
            createdAt: response.data.createdAt || new Date().toISOString(),
            mediaFilesId: response.data.mediaId,
          });
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
      }

      setTimeout(() => {
        onSuccess();
      }, 200);
    } catch (error: any) {
      console.error("Error sending announcement:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "Failed to send announcement";
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

  const Container = showInSheet ? View : SafeAreaView;
  const ScrollContainer = showInSheet ? BottomSheetScrollView : ScrollView;

  const scrollContent = (
    <>
      {/* Announcement Title Header - Side by Side Layout */}
      <View
        style={[
          styles.titleHeader,
          { borderBottomColor: isDark ? "#374151" : "#E5E7EB" },
        ]}
      >
        <View style={styles.titleHeaderRow}>
          <Text
            style={[
              styles.sectionLabel,
              { color: isDark ? "#3B82F6" : "#007AFF" },
            ]}
          >
            Announcement title
          </Text>
          <TouchableOpacity
            onPress={sendAnnouncement}
            disabled={!isCreateEnabled || sending}
            style={styles.createButton}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text
                style={[
                  styles.createButtonText,
                  {
                    color: isCreateEnabled
                      ? "#007AFF"
                      : isDark
                      ? "#4B5563"
                      : "#9CA3AF",
                  },
                ]}
              >
                CREATE
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          ref={titleInputRef}
          placeholder="Enter announcement title"
          placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
          style={[
            styles.titleInput,
            { color: isDark ? "#fff" : "#000" },
          ]}
          value={title}
          onChangeText={setTitle}
          onFocus={() => setIsTitleFocused(true)}
          onBlur={() => setIsTitleFocused(false)}
        />
      </View>

      {/* Announcement Body Section */}
      <View style={styles.bodySection}>
        <Text
          style={[
            styles.sectionLabel,
            { color: isDark ? "#3B82F6" : "#007AFF" },
          ]}
        >
          Announcement body
        </Text>

        {/* Rich Text Editor */}
        <View
          style={[
            styles.editorContainer,
            {
              borderColor: isDark ? "#374151" : "#E5E7EB",
              backgroundColor: isDark ? "#17212B" : "#fff",
            },
          ]}
        >
          {StyledRichEditor && (
            <StyledRichEditor
              ref={richText}
              placeholder="Write your announcement here..."
              initialHeight={180}
              onChange={handleContentChange}
              androidHardwareAccelerationDisabled={true}
              androidLayerType="software"
              onEditorInitialized={handleEditorInitialized}
              onFocus={handleEditorFocus}
              onBlur={handleEditorBlur}
              editorStyle={{
                backgroundColor: isDark ? "#17212B" : "#ffffff",
                placeholderColor: isDark ? "#8E8E93" : "#C7C7CC",
                contentCSSText: `
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  line-height: 24px;
                  padding: 12px;
                  margin: 0;
                  min-height: 160px;
                  color: ${isDark ? "#ffffff" : "#1f2937"};
                  background-color: ${isDark ? "#17212B" : "#ffffff"};
                `,
              }}
              style={{
                backgroundColor: isDark ? "#17212B" : "#fff",
              }}
            />
          )}
        </View>

        {/* Toolbar - Shows when editor is focused */}
        {isKeyboardVisible && !isTitleFocused && StyledRichToolbar && (
          <View
            style={[
              styles.toolbarContainer,
              {
                backgroundColor: isDark ? "#17212B" : "#fff",
                borderColor: isDark ? "#374151" : "#E5E7EB",
              },
            ]}
          >
            <StyledRichToolbar
              editor={richText}
              selectedIconTint={isDark ? "#60a5fa" : "#3b82f6"}
              iconTint={isDark ? "#9ca3af" : "#6b7280"}
              style={{
                backgroundColor: isDark ? "#17212B" : "#fff",
              }}
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
      </View>

      {/* Media Attachments Section */}
      <View
        style={[
          styles.mediaSection,
          { borderTopColor: isDark ? "#374151" : "#E5E7EB" },
        ]}
      >
        <Text
          style={[
            styles.sectionLabel,
            { color: isDark ? "#3B82F6" : "#007AFF" },
          ]}
        >
          Attachments
        </Text>

        {/* Add Media Button */}
        <TouchableOpacity
          onPress={handleSelectFiles}
          disabled={uploading}
          style={styles.addMediaButton}
        >
          <View
            style={[
              styles.addMediaIconCircle,
              {
                backgroundColor: uploading
                  ? isDark
                    ? "#374151"
                    : "#E5E7EB"
                  : isDark
                  ? "#3B82F6"
                  : "#007AFF",
              },
            ]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="image" size={18} color="white" />
            )}
          </View>
          <Text
            style={[
              styles.addMediaText,
              {
                color: uploading
                  ? isDark
                    ? "#6B7280"
                    : "#9CA3AF"
                  : isDark
                  ? "#3B82F6"
                  : "#007AFF",
              },
            ]}
          >
            {uploading ? "Uploading..." : "Add photos or videos..."}
          </Text>
        </TouchableOpacity>

        {/* Uploading Progress */}
        {uploadingFiles.length > 0 && (
          <View style={styles.uploadingContainer}>
            {uploadingFiles.map((file, index) => (
              <View
                key={index}
                style={[
                  styles.uploadingItem,
                  { backgroundColor: isDark ? "#1F2937" : "#F9FAFB" },
                ]}
              >
                <View style={styles.uploadingInfo}>
                  <Text
                    style={[
                      styles.uploadingFileName,
                      { color: isDark ? "#E5E7EB" : "#374151" },
                    ]}
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                  <Text
                    style={[
                      styles.uploadingFileSize,
                      { color: isDark ? "#6B7280" : "#9CA3AF" },
                    ]}
                  >
                    {formatBytes(file.size)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: isDark ? "#374151" : "#E5E7EB" },
                  ]}
                >
                  <View style={[styles.progressFill, { width: "100%" }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Uploaded Files Grid */}
        {vmMediaFiles.length > 0 && (
          <View style={styles.filesGrid}>
            {vmMediaFiles.map((file, index) => (
              <View
                key={index}
                style={[
                  styles.fileItem,
                  { backgroundColor: isDark ? "#1F2937" : "#F3F4F6" },
                ]}
              >
                <TouchableOpacity
                  style={styles.filePreview}
                  onPress={() => openImageModal(file)}
                  activeOpacity={0.8}
                >
                  {file.mimeType.startsWith("image") && (
                    <Image
                      source={{
                        uri: `${API_URL}/media/chat/temp_${tempFolderId}/${file.fileName}`,
                      }}
                      style={styles.fileImage}
                      resizeMode="cover"
                    />
                  )}
                  {file.mimeType.startsWith("video") && (
                    <View style={styles.videoPlaceholder}>
                      <Ionicons name="play-circle" size={28} color="white" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeFileButton}
                  onPress={() => removeFile(file)}
                >
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {vmMediaFiles.length === 0 && uploadingFiles.length === 0 && (
          <Text
            style={[
              styles.noFilesText,
              { color: isDark ? "#6B7280" : "#9CA3AF" },
            ]}
          >
            No attachments added yet.
          </Text>
        )}
      </View>

      {/* Bottom padding for tab bar space when in half screen */}
      {showInSheet && isHalfScreen && <View style={{ height: 140 }} />}

      {/* Extra padding for keyboard */}
      <View style={{ height: 100 }} />
    </>
  );

  return (
    <Container
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0E1621" : "#fff" },
      ]}
    >
      <ScrollContainer
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {scrollContent}
      </ScrollContainer>

      {/* Image Preview Modal */}
      <Modal
        visible={showImageModal}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderSpacer} />
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedFile?.originalName || "Preview"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowImageModal(false)}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            {selectedFile && (
              <View style={styles.modalImageContainer}>
                <Image
                  source={getDirectImageSource(selectedFile.fileName)}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Title Header Section
  titleHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  titleHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  createButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  titleInput: {
    fontSize: 16,
    paddingVertical: 8,
  },

  // Body Section
  bodySection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  editorContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 180,
  },
  toolbarContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },

  // Media Section
  mediaSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  addMediaButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  addMediaIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addMediaText: {
    fontSize: 16,
  },
  uploadingContainer: {
    marginTop: 8,
  },
  uploadingItem: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
  },
  uploadingInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  uploadingFileName: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  uploadingFileSize: {
    fontSize: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 2,
  },
  filesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  fileItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  filePreview: {
    width: "100%",
    height: "100%",
  },
  fileImage: {
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
  },
  removeFileButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  noFilesText: {
    fontSize: 12,
    marginTop: 4,
  },

  // Web Not Supported
  webNotSupported: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  webNotSupportedTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  webNotSupportedText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  webBackButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  webBackButtonText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalHeaderSpacer: {
    width: 64,
  },
  modalTitle: {
    color: "#fff",
    fontWeight: "500",
    flex: 1,
    textAlign: "center",
  },
  modalCloseButton: {
    width: 64,
    alignItems: "flex-end",
  },
  modalCloseText: {
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 14,
    overflow: "hidden",
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
});