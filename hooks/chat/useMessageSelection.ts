// hooks/chat/useMessageSelection.ts
import { useState, useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Message } from '@/types/type';

interface UseMessageSelectionOptions {
  isGroupAdmin: boolean;
}

export const useMessageSelection = ({ isGroupAdmin }: UseMessageSelectionOptions) => {
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);

  const isMessageSelected = useCallback(
    (messageId: string | number) => {
      return selectedMessages.some((msg) => msg.id === messageId);
    },
    [selectedMessages]
  );

  const handleMessageLongPress = useCallback(
    (message: Message) => {
      if (!isGroupAdmin) return;

      if (selectedMessages.length === 0) {
        setSelectedMessages([message]);
      } else if (!isMessageSelected(message.id)) {
        setSelectedMessages((prev) => [...prev, message]);
      }
    },
    [isGroupAdmin, selectedMessages.length, isMessageSelected]
  );

  const handleMessagePress = useCallback(
    (message: Message) => {
      if (!isGroupAdmin) return;

      if (selectedMessages.length > 0) {
        if (isMessageSelected(message.id)) {
          setSelectedMessages((prev) => prev.filter((msg) => msg.id !== message.id));
        } else {
          setSelectedMessages((prev) => [...prev, message]);
        }
      }
    },
    [isGroupAdmin, selectedMessages.length, isMessageSelected]
  );

  const clearSelection = useCallback(() => {
    setSelectedMessages([]);
  }, []);

  const selectAll = useCallback((messages: Message[]) => {
    if (isGroupAdmin) {
      setSelectedMessages(messages);
    }
  }, [isGroupAdmin]);

  // Handle Android back button
  useEffect(() => {
    const onBackPress = () => {
      if (selectedMessages.length > 0) {
        clearSelection();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [selectedMessages.length, clearSelection]);

  return {
    selectedMessages,
    setSelectedMessages,
    isMessageSelected,
    handleMessageLongPress,
    handleMessagePress,
    clearSelection,
    selectAll,
    hasSelection: selectedMessages.length > 0,
  };
};