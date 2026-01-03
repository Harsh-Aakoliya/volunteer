// components/chat/AttachmentsBottomSheet.tsx
import React, { useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import MediaTab from "./tabs/MediaTab";
import PollTab from "@/components/chat/tabs/PollTab";
import TableTab from "@/components/chat/tabs/TableTab";
import AnnouncementTab from "@/components/chat/tabs/AnnouncementTab";

type TabType = "media" | "poll" | "table" | "announcement";

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
}

export default function AttachmentsBottomSheet({
  visible,
  onClose,
  roomId,
  userId,
}: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["45%"], []);
  const [activeTab, setActiveTab] = useState<TabType>("media");

  React.useEffect(() => {
    visible ? sheetRef.current?.expand() : sheetRef.current?.close();
  }, [visible]);

  const renderContent = () => {
    switch (activeTab) {
      case "media":
        return <MediaTab roomId={roomId} userId={userId} />;
      case "poll":
        return <PollTab roomId={roomId} userId={userId} />;
      case "table":
        return <TableTab roomId={roomId} userId={userId} />;
      case "announcement":
        return <AnnouncementTab roomId={roomId} userId={userId} />;
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      index={-1}
    >
      {/* Tabs */}
      <View className="flex-row border-b border-gray-200">
        {[
          ["media", "Media"],
          ["poll", "Poll"],
          ["table", "Table"],
          ["announcement", "Announcement"],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            className={`flex-1 py-3 items-center ${
              activeTab === key ? "border-b-2 border-blue-500" : ""
            }`}
            onPress={() => setActiveTab(key as TabType)}
          >
            <Text
              className={`text-sm ${
                activeTab === key ? "text-blue-500 font-semibold" : "text-gray-500"
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View className="flex-1 px-4 py-2">{renderContent()}</View>
    </BottomSheet>
  );
}
