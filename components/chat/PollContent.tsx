// components/chat/PollContent.tsx
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import axios from "axios";
import { AuthStorage } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

type PollOption = {
  id: string;
  text: string;
};

interface PollContentProps {
  roomId: string;
  userId: string;
  onSuccess: () => void;
  onBack: () => void;
  isDark?: boolean;
  showInSheet?: boolean;
  isHalfScreen?: boolean;
}

export default function PollContent({
  roomId,
  userId,
  onSuccess,
  onBack,
  isDark = false,
  showInSheet = false,
  isHalfScreen = false,
}: PollContentProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<PollOption[]>([
    { id: `${Date.now()}-1`, text: "" },
    { id: `${Date.now()}-2`, text: "" },
  ]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [sending, setSending] = useState(false);
  const { sendMessage: socketSendMessage } = useSocket();

  const validOptions = options.filter((opt) => opt.text.trim() !== "");
  const isCreateEnabled = question.trim() !== "" && validOptions.length >= 2;

  const addOption = useCallback(() => {
    if (options.length < 12) {
      setOptions((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, text: "" },
      ]);
    }
  }, [options.length]);

  const removeOption = useCallback(
    (optionId: string) => {
      if (options.length > 1) {
        setOptions((prev) => prev.filter((opt) => opt.id !== optionId));
      }
    },
    [options.length]
  );

  const updateOptionText = useCallback((optionId: string, text: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === optionId ? { ...opt, text } : opt))
    );
  }, []);

  const sendPoll = async () => {
    if (sending || !isCreateEnabled) return;

    setSending(true);
    try {
      const response = await axios.post(`${API_URL}/api/poll`, {
        question: question,
        options: validOptions,
        isMultipleChoiceAllowed: multipleChoice,
        pollEndTime: null,
        roomId: roomId,
        createdBy: userId,
      });
      const createdPollId = response.data.poll.id;

      const token = await AuthStorage.getToken();
      const pollResponse = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText: "",
          messageType: "poll",
          pollId: createdPollId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      socketSendMessage(roomId, {
        id: pollResponse.data.id,
        messageText: "Shared poll",
        createdAt: pollResponse.data.createdAt,
        messageType: "poll",
        mediaFilesId: 0,
        pollId: pollResponse.data.pollId,
        tableId: 0,
        replyMessageId: 0,
      });

      onSuccess();
    } catch (error) {
      console.error("Error creating poll:", error);
      Alert.alert("Error", "Failed to create poll. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const renderOptionItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<PollOption>) => (
    <ScaleDecorator>
      <View style={styles.optionRow}>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={styles.dragHandle}
        >
          <Ionicons
            name="menu"
            size={20}
            color={isDark ? "#8E8E93" : "#C7C7CC"}
          />
        </TouchableOpacity>

        <TextInput
          placeholder="Option"
          placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
          style={[
            styles.optionInput,
            {
              color: isDark ? "#fff" : "#000",
              borderBottomColor: isDark ? "#374151" : "#E5E7EB",
            },
          ]}
          value={item.text}
          onChangeText={(text) => updateOptionText(item.id, text)}
        />

        {options.length > 1 && (
          <TouchableOpacity
            onPress={() => removeOption(item.id)}
            style={styles.removeButton}
          >
            <Ionicons
              name="close-circle"
              size={22}
              color={isDark ? "#8E8E93" : "#C7C7CC"}
            />
          </TouchableOpacity>
        )}
      </View>
    </ScaleDecorator>
  );

  const Container = showInSheet ? View : SafeAreaView;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            <TouchableOpacity onPress={onBack} style={styles.headerButton}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? "#8E8E93" : "#007AFF"}
              />
            </TouchableOpacity>

            <Text
              style={[styles.headerTitle, { color: isDark ? "#fff" : "#000" }]}
            >
              New Poll
            </Text>

            <TouchableOpacity
              onPress={sendPoll}
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

          <View style={styles.flex1}>
            {/* Poll Question */}
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
                Poll question
              </Text>
              <TextInput
                placeholder="Ask a question"
                placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
                style={[
                  styles.questionInput,
                  { color: isDark ? "#fff" : "#000" },
                ]}
                value={question}
                onChangeText={setQuestion}
                multiline={false}
              />
            </View>

            {/* Answer Options */}
            <View
              style={[
                styles.optionsSection,
                { borderBottomColor: isDark ? "#374151" : "#E5E7EB" },
              ]}
            >
              <Text
                style={[
                  styles.sectionLabel,
                  { color: isDark ? "#3B82F6" : "#007AFF" },
                ]}
              >
                Answer options
              </Text>

              <DraggableFlatList
                data={options}
                onDragEnd={({ data }) => setOptions(data)}
                keyExtractor={(item) => item.id}
                renderItem={renderOptionItem}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.optionsList}
                ListFooterComponent={
                  <View style={styles.footer}>
                    {options.length < 12 && (
                      <TouchableOpacity
                        onPress={addOption}
                        style={styles.addOptionButton}
                      >
                        <View
                          style={[
                            styles.addIconCircle,
                            { backgroundColor: isDark ? "#3B82F6" : "#007AFF" },
                          ]}
                        >
                          <Ionicons name="add" size={18} color="white" />
                        </View>
                        <Text
                          style={[
                            styles.addOptionText,
                            { color: isDark ? "#3B82F6" : "#007AFF" },
                          ]}
                        >
                          Add an Option...
                        </Text>
                      </TouchableOpacity>
                    )}

                    {options.length < 12 && (
                      <Text
                        style={[
                          styles.remainingText,
                          { color: isDark ? "#6B7280" : "#9CA3AF" },
                        ]}
                      >
                        You can add {12 - options.length} more option
                        {12 - options.length !== 1 ? "s" : ""}.
                      </Text>
                    )}

                    {/* Settings */}
                    <View
                      style={[
                        styles.settingsSection,
                        { borderTopColor: isDark ? "#374151" : "#E5E7EB" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sectionLabel,
                          { color: isDark ? "#3B82F6" : "#007AFF" },
                        ]}
                      >
                        Settings
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          if (validOptions.length >= 2) {
                            setMultipleChoice(!multipleChoice);
                          }
                        }}
                        disabled={validOptions.length < 2}
                        style={[
                          styles.settingRow,
                          { borderBottomColor: isDark ? "#374151" : "#E5E7EB" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.settingText,
                            {
                              color:
                                validOptions.length >= 2
                                  ? isDark
                                    ? "#fff"
                                    : "#000"
                                  : isDark
                                  ? "#4B5563"
                                  : "#9CA3AF",
                            },
                          ]}
                        >
                          Multiple Answers
                        </Text>
                        <View
                          style={[
                            styles.toggle,
                            {
                              backgroundColor:
                                multipleChoice && validOptions.length >= 2
                                  ? isDark
                                    ? "#3B82F6"
                                    : "#007AFF"
                                  : isDark
                                  ? "#4B5563"
                                  : "#D1D5DB",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.toggleCircle,
                              multipleChoice && styles.toggleCircleActive,
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Bottom padding for tab bar space when in half screen */}
                    {showInSheet && isHalfScreen && (
                      <View style={{ height: 120 }} />
                    )}
                  </View>
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Container>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
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
  questionInput: {
    fontSize: 16,
    paddingVertical: 8,
  },
  optionsSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
  },
  optionsList: {
    paddingBottom: 20,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dragHandle: {
    marginRight: 12,
  },
  optionInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  removeButton: {
    marginLeft: 12,
    padding: 4,
  },
  footer: {},
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  addIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addOptionText: {
    fontSize: 16,
  },
  remainingText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  settingsSection: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingText: {
    fontSize: 16,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  toggleCircleActive: {
    marginLeft: "auto",
  },
});