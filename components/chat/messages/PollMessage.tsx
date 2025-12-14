import React from "react";
import { TouchableOpacity, Text } from "react-native";

type Props = {
  pollId: number | null;
  isOwnMessage: boolean;
  showPollModal: boolean;
  activePollId: number | null;
  onOpenPoll: (pollId: number) => void;
};

export default function PollMessage({
  pollId,
  isOwnMessage,
  showPollModal,
  activePollId,
  onOpenPoll,
}: Props) {
  if (!pollId) return null;

  const isAnotherPollActive =
    showPollModal && activePollId !== null && activePollId !== pollId;

  return (
    <TouchableOpacity
      onPress={() => {
        if (typeof pollId === "number" && !isAnotherPollActive) {
          onOpenPoll(pollId);
        }
      }}
      disabled={isAnotherPollActive}
      className={`p-3 rounded-lg mt-1 ${
        isAnotherPollActive
          ? "bg-gray-200 opacity-50"
          : isOwnMessage
          ? "bg-blue-200"
          : "bg-gray-200"
      }`}
    >
      <Text
        className={`font-semibold ${
          isAnotherPollActive
            ? "text-gray-500"
            : isOwnMessage
            ? "text-blue-800"
            : "text-gray-700"
        }`}
      >
        📊 Poll
      </Text>
      <Text
        className={`text-xs ${
          isAnotherPollActive
            ? "text-gray-400"
            : isOwnMessage
            ? "text-blue-600"
            : "text-gray-600"
        }`}
      >
        {isAnotherPollActive ? "Another poll is active" : "Tap to vote"}
      </Text>
    </TouchableOpacity>
  );
}
