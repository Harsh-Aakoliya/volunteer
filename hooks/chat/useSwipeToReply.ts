// hooks/chat/useSwipeToReply.ts
import { useCallback, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Message } from '@/types/type';
import { SwipeGestureContext } from '@/types/chat.types';

const SWIPE_CONFIG = {
  threshold: 70,
  velocityThreshold: 800,
  maxTranslation: 80,
  activeOffsetX: 20,
  failOffsetY: 30,
  spring: {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
};

interface UseSwipeToReplyOptions {
  onReply: (message: Message) => void;
  enabled?: boolean;
}

export const useSwipeToReply = ({ onReply, enabled = true }: UseSwipeToReplyOptions) => {
  const translateX = useSharedValue(0);
  const contextRef = useRef<SwipeGestureContext>({
    startX: 0,
    triggeredHaptic: false,
  });

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const createPanGesture = useCallback((message: Message) => {
    return Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX([-SWIPE_CONFIG.activeOffsetX, SWIPE_CONFIG.activeOffsetX])
      .failOffsetY([-SWIPE_CONFIG.failOffsetY, SWIPE_CONFIG.failOffsetY])
      .onStart(() => {
        contextRef.current = { startX: translateX.value, triggeredHaptic: false };
      })
      .onUpdate((event) => {
        'worklet';
        const { maxTranslation, threshold } = SWIPE_CONFIG;
        const limitedTranslation = Math.max(
          -maxTranslation,
          Math.min(maxTranslation, event.translationX)
        );
        
        translateX.value = limitedTranslation;

        // Trigger haptic feedback at threshold
        if (Math.abs(limitedTranslation) > threshold && !contextRef.current.triggeredHaptic) {
          contextRef.current.triggeredHaptic = true;
          runOnJS(triggerHaptic)();
        }
      })
      .onEnd((event) => {
        'worklet';
        const { threshold, velocityThreshold, spring } = SWIPE_CONFIG;
        const shouldReply = 
          Math.abs(event.translationX) > threshold || 
          Math.abs(event.velocityX) > velocityThreshold;

        if (shouldReply) {
          runOnJS(onReply)(message);
        }

        // Always animate back to original position
        translateX.value = withSpring(0, spring);
      })
      .onFinalize(() => {
        'worklet';
        translateX.value = withSpring(0, SWIPE_CONFIG.spring);
      });
  }, [enabled, onReply, triggerHaptic]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 30, 80],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, 60, 80],
          [0.6, 1, 1.15],
          Extrapolation.CLAMP
        ),
      },
      {
        rotate: `${interpolate(
          translateX.value,
          [0, 80],
          [0, -15],
          Extrapolation.CLAMP
        )}deg`,
      },
    ],
  }));

  const rightIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-80, -30, 0],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [-80, -60, 0],
          [1.15, 1, 0.6],
          Extrapolation.CLAMP
        ),
      },
      {
        rotate: `${interpolate(
          translateX.value,
          [-80, 0],
          [15, 0],
          Extrapolation.CLAMP
        )}deg`,
      },
    ],
  }));

  return {
    translateX,
    createPanGesture,
    animatedStyle,
    leftIconStyle,
    rightIconStyle,
  };
};