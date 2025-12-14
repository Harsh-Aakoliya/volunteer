import React from "react";
import { View } from "react-native";
import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
import MediaGrid from "@/components/chat/MediaGrid";
import { Message } from "@/types/type";
import { API_URL } from "@/constants/api";

type Props = {
  message: Message;
  isOwnMessage: boolean;
  onMediaGridPress: (mediaFiles: any[], selectedIndex: number) => void;
};

export default function MediaMessage({
  message,
  isOwnMessage,
  onMediaGridPress,
}: Props) {
  if (!message.mediaFilesId) return null;

  if (message.messageType === "audio") {
    return (
      <View className="mt-1">
        <AudioMessagePlayer
          audioUrl={`${API_URL}/media/chat/${message.mediaFilesId}`}
          duration={
            message.messageText?.includes("(")
              ? message.messageText.match(/\(([^)]+)\)/)?.[1]
              : undefined
          }
          isOwn={isOwnMessage}
          waves={[]} // TODO: Store and retrieve wave data
        />
      </View>
    );
  }

  return (
    <View className="mt-2">
      <MediaGrid
        mediaFilesId={message.mediaFilesId}
        messageId={message.id}
        onMediaPress={onMediaGridPress}
        isOwnMessage={isOwnMessage}
        isLoading={false}
      />
    </View>
  );
}
