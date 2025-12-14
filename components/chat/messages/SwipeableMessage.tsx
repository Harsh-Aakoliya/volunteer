// components/chat/messages/SwipeableMessage.tsx
import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Message } from '@/types/type';

interface SwipeableMessageProps {
  message: Message;
  children: React.ReactNode;
  onReply: (message: Message) => void;
  onPress: (message: Message) => void;
  onLongPress: (message: Message) => void;
  isSelected: boolean;
  enabled: boolean;
}

const SWIPE_THRESHOLD = 70;
const MAX_TRANSLATION = 80;
const VELOCITY_THRESHOLD = 800;

const springConfig = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({
  message,
  children,
  onReply,
  onPress,
  onLongPress,
  isSelected,
  enabled,
}) => {
  const translateX = useSharedValue(0);
  const hapticTriggeredRef = React.useRef(false);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleReply = useCallback(() => {
    onReply(message);
  }, [message, onReply]);

  const panGesture = Gesture.Pan()
    .enabled(enabled && !isSelected)
    .activeOffsetX([-20, 20])
    .failOffsetY([-30, 30])
    .onStart(() => {
      hapticTriggeredRef.current = false;
    })
    .onUpdate((event) => {
      'worklet';
      const limitedTranslation = Math.max(
        -MAX_TRANSLATION,
        Math.min(MAX_TRANSLATION, event.translationX)
      );
      translateX.value = limitedTranslation;

      if (Math.abs(limitedTranslation) > SWIPE_THRESHOLD && !hapticTriggeredRef.current) {
        hapticTriggeredRef.current = true;
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd((event) => {
      'worklet';
      const shouldReply =
        Math.abs(event.translationX) > SWIPE_THRESHOLD ||
        Math.abs(event.velocityX) > VELOCITY_THRESHOLD;

      if (shouldReply) {
        runOnJS(handleReply)();
      }

      translateX.value = withSpring(0, springConfig);
    })
    .onFinalize(() => {
      'worklet';
      translateX.value = withSpring(0, springConfig);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 30, 80], [0, 0.5, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(translateX.value, [0, 60, 80], [0.6, 1, 1.15], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(translateX.value, [0, 80], [0, -15], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const rightIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, -30, 0], [1, 0.5, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(translateX.value, [-80, -60, 0], [1.15, 1, 0.6], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(translateX.value, [-80, 0], [15, 0], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  return (
    <View style={styles.container}>
      {/* Left Reply Icon */}
      <Animated.View style={[styles.replyIconContainer, styles.leftIcon, leftIconStyle]}>
        <View style={styles.replyIconBackground}>
          <Ionicons name="arrow-undo" size={20} color="white" />
        </View>
      </Animated.View>

      {/* Right Reply Icon */}
      <Animated.View style={[styles.replyIconContainer, styles.rightIcon, rightIconStyle]}>
        <View style={styles.replyIconBackground}>
          <Ionicons name="arrow-undo" size={20} color="white" />
        </View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <Pressable
            onPress={() => onPress(message)}
            onLongPress={() => onLongPress(message)}
            delayLongPress={300}
          >
            {/* Selection overlay */}
            {isSelected && <View style={styles.selectionOverlay} />}
            {children}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  replyIconContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftIcon: {
    left: 16,
  },
  rightIcon: {
    right: 16,
  },
  replyIconBackground: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    padding: 8,
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -16,
    right: -16,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    zIndex: 1,
  },
});

export default React.memo(SwipeableMessage);