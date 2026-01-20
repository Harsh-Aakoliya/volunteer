
// components/chat/AnnouncementContent.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Keyboard,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import axios from "axios";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";

interface AnnouncementContentProps {
  roomId: string;
  userId: string;
  onSuccess: () => void;
  onBack: () => void;
  isDark?: boolean;
  showInSheet?: boolean;
  isHalfScreen?: boolean;
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { sendMessage: socketSendMessage } = useSocket();

  const isCreateEnabled = title.trim() !== "" && body.trim() !== "";

  const sendAnnouncement = async () => {
    if (sending || !isCreateEnabled) return;
    setSending(true);
    
    // Dismiss keyboard immediately when starting send
    Keyboard.dismiss();
    
    try {
      const token = await AuthStorage.getToken();
      
      // Create announcement message
      const response = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText: `📢 ${title}\n\n${body}`,
          messageType: "announcement",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      socketSendMessage(roomId, {
        id: response.data.id,
        messageText: `📢 ${title}\n\n${body}`,
        createdAt: response.data.createdAt,
        messageType: "announcement",
        mediaFilesId: 0,
        pollId: 0,
        tableId: 0,
        replyMessageId: 0,
      });

      // Wait for keyboard to fully dismiss before calling onSuccess
      setTimeout(() => {
        onSuccess();
      }, 200);
      
    } catch (error) {
      console.error("Error creating announcement:", error);
      Alert.alert("Error", "Failed to create announcement. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    setTimeout(() => {
      onBack();
    }, 50);
  }, [onBack]);

  const Container = showInSheet ? View : SafeAreaView;

  return (
    <Container
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0E1621" : "#fff" },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex1}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: isDark ? "#374151" : "#E5E7EB" },
          ]}
        >
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#8E8E93" : "#007AFF"}
            />
          </TouchableOpacity>

          <Text
            style={[styles.headerTitle, { color: isDark ? "#fff" : "#000" }]}
          >
            New Announcement
          </Text>

          <TouchableOpacity
            onPress={sendAnnouncement}
            disabled={!isCreateEnabled || sending}
            style={styles.headerButton}
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

        <ScrollView 
          style={styles.flex1}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            showInSheet && isHalfScreen && { paddingBottom: 120 }
          ]}
        >
          {/* Title Section */}
          <View
            style={[
              styles.section,
              { borderBottomColor: isDark ? "#374151" : "#E5E7EB" },
            ]}
          >
            <Text
              style={[
                styles.sectionLabel,
                { color: isDark ? "#3B82F6" : "#007AFF" },
              ]}
            >
              Title
            </Text>
            <TextInput
              placeholder="Announcement title"
              placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
              style={[
                styles.titleInput,
                { 
                  color: isDark ? "#fff" : "#000",
                  borderBottomColor: isDark ? "#374151" : "#E5E7EB",
                },
              ]}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Body Section */}
          <View
            style={[
              styles.section,
              { borderBottomColor: isDark ? "#374151" : "#E5E7EB" },
            ]}
          >
            <Text
              style={[
                styles.sectionLabel,
                { color: isDark ? "#3B82F6" : "#007AFF" },
              ]}
            >
              Message
            </Text>
            <TextInput
              placeholder="Write your announcement..."
              placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
              style={[
                styles.bodyInput,
                { 
                  color: isDark ? "#fff" : "#000",
                  borderColor: isDark ? "#374151" : "#E5E7EB",
                },
              ]}
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text
              style={[
                styles.charCount,
                { color: isDark ? "#6B7280" : "#9CA3AF" },
              ]}
            >
              {body.length}/1000
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  bodyInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
});