import React from "react";
import { View, Text } from "react-native";
import { Message } from "@/types/type";
import AnnouncementMessage from "./AnnouncementMessage";
import TextMessage from "./TextMessage";
import MediaMessage from "./MediaMessage";
import TableMessage from "./TableMessage";
import PollMessage from "./PollMessage";

type Props = {
  message: Message;
  isOwnMessage: boolean;
  contentWidth: number;
  showPollModal: boolean;
  activePollId: number | null;
  onMediaGridPress: (mediaFiles: any[], selectedIndex: number) => void;
  onOpenTable: (tableId: number) => void;
  onOpenPoll: (pollId: number) => void;
};

export default function MessageContent({
  message,
  isOwnMessage,
  contentWidth,
  showPollModal,
  activePollId,
  onMediaGridPress,
  onOpenTable,
  onOpenPoll,
}: Props) {
  // Announcement
  if (message.messageType === "announcement") {
    return (
      <AnnouncementMessage
        messageText={message.messageText || ""}
        isOwnMessage={isOwnMessage}
        contentWidth={contentWidth}
      />
    );
  }

  return (
    <View>
      <TextMessage text={message.messageText} isOwnMessage={isOwnMessage} />

      <MediaMessage
        message={message}
        isOwnMessage={isOwnMessage}
        onMediaGridPress={onMediaGridPress}
      />

      <TableMessage
        tableId={message.tableId ?? null}
        isOwnMessage={isOwnMessage}
        onOpenTable={onOpenTable}
      />

      <PollMessage
        pollId={message.pollId ?? null}
        isOwnMessage={isOwnMessage}
        showPollModal={showPollModal}
        activePollId={activePollId}
        onOpenPoll={onOpenPoll}
      />
    </View>
  );
}
