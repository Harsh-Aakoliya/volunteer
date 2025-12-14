// hooks/chat/useScrollBehavior.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { FlatList, Keyboard } from 'react-native';
import { Message } from '@/types/type';
import Animated, {
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface UseScrollBehaviorOptions {
  messages: Message[];
}

export const useScrollBehavior = ({ messages }: UseScrollBehaviorOptions) => {
  const flatListRef = useRef<FlatList>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  
  const highlightedMessageId = useRef<string | number | null>(null);
  const blinkProgress = useSharedValue(0);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
      setShowScrollToBottom(false);
      setIsNearBottom(true);
    }
  }, [messages.length]);

  const scrollToMessage = useCallback((messageId: string | number) => {
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: messageIndex,
        animated: true,
        viewPosition: 0.5,
      });

      // Trigger blink animation
      highlightedMessageId.current = messageId;
      blinkProgress.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 200 })
      );

      setTimeout(() => {
        highlightedMessageId.current = null;
      }, 800);
    }
  }, [messages, blinkProgress]);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;

    setIsNearBottom(isAtBottom);
    setShowScrollToBottom(!isAtBottom && messages.length > 10);
  }, [messages.length]);

  const scrollToEndOnNewMessage = useCallback(() => {
    if (isNearBottom) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [isNearBottom, scrollToBottom]);

  // Keyboard handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(scrollToBottom, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setTimeout(scrollToBottom, 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [scrollToBottom]);

  const isMessageHighlighted = useCallback((messageId: string | number) => {
    return highlightedMessageId.current === messageId;
  }, []);

  return {
    flatListRef,
    showScrollToBottom,
    isNearBottom,
    scrollToBottom,
    scrollToMessage,
    handleScroll,
    scrollToEndOnNewMessage,
    isMessageHighlighted,
    blinkProgress,
  };
};