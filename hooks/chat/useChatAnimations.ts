// hooks/chat/useChatAnimations.ts
import { useCallback, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
  SharedValue,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Animation configuration
export const ANIMATION_CONFIG = {
  swipe: {
    threshold: 60,
    velocityThreshold: 800,
    maxTranslation: 80,
    spring: {
      damping: 20,
      stiffness: 300,
      mass: 0.8,
    },
  },
  blink: {
    duration: 200,
    repetitions: 2,
  },
  highlight: {
    color: {
      own: '#dbeafe',
      other: '#f3f4f6',
      highlighted: '#fbbf24',
    },
  },
};

// Custom spring configuration for smooth animations
export const springConfig = {
  damping: ANIMATION_CONFIG.swipe.spring.damping,
  stiffness: ANIMATION_CONFIG.swipe.spring.stiffness,
  mass: ANIMATION_CONFIG.swipe.spring.mass,
};

// Hook for message swipe animation
export const useSwipeAnimation = () => {
  const translateX = useSharedValue(0);
  const hapticTriggered = useRef(false);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const resetAnimation = useCallback(() => {
    'worklet';
    translateX.value = withSpring(0, springConfig);
  }, []);

  const handleSwipeUpdate = useCallback((translationX: number) => {
    'worklet';
    const { maxTranslation, threshold } = ANIMATION_CONFIG.swipe;
    const limitedTranslation = Math.max(
      -maxTranslation,
      Math.min(maxTranslation, translationX)
    );
    
    translateX.value = limitedTranslation;

    // Trigger haptic when threshold is crossed
    if (Math.abs(limitedTranslation) > threshold && !hapticTriggered.current) {
      hapticTriggered.current = true;
      runOnJS(triggerHaptic)();
    } else if (Math.abs(limitedTranslation) <= threshold / 2) {
      hapticTriggered.current = false;
    }
  }, []);

  const shouldTriggerReply = useCallback((translationX: number, velocityX: number): boolean => {
    'worklet';
    const { threshold, velocityThreshold } = ANIMATION_CONFIG.swipe;
    return Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconLeftStyle = useAnimatedStyle(() => ({
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
          [0.5, 1, 1.1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const replyIconRightStyle = useAnimatedStyle(() => ({
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
          [1.1, 1, 0.5],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  return {
    translateX,
    animatedStyle,
    replyIconLeftStyle,
    replyIconRightStyle,
    handleSwipeUpdate,
    shouldTriggerReply,
    resetAnimation,
    resetHapticTrigger: () => { hapticTriggered.current = false; },
  };
};

// Hook for message highlight/blink animation
export const useHighlightAnimation = () => {
  const highlightProgress = useSharedValue(0);

  const triggerHighlight = useCallback(() => {
    'worklet';
    const { duration, repetitions } = ANIMATION_CONFIG.blink;
    
    const sequence = [];
    for (let i = 0; i < repetitions; i++) {
      sequence.push(withTiming(1, { duration }));
      sequence.push(withTiming(0, { duration }));
    }
    
    highlightProgress.value = withSequence(...sequence);
  }, []);

  const getHighlightStyle = useCallback((isOwnMessage: boolean) => {
    'worklet';
    const { color } = ANIMATION_CONFIG.highlight;
    const baseColor = isOwnMessage ? color.own : color.other;
    
    return useAnimatedStyle(() => ({
      backgroundColor: interpolateColor(
        highlightProgress.value,
        [0, 1],
        [baseColor, color.highlighted].map((c) => {
          // Convert hex to numeric for interpolation
          return c;
        })
      ),
    }));
  }, []);

  return {
    highlightProgress,
    triggerHighlight,
    getHighlightStyle,
  };
};

// Hook for scroll-to-bottom button animation
export const useScrollButtonAnimation = (visible: boolean) => {
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.5);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withSpring(visible ? 1 : 0, { damping: 15 }),
    transform: [
      { scale: withSpring(visible ? 1 : 0.5, { damping: 15 }) },
    ],
  }));

  return animatedStyle;
};

// Utility for creating staggered animations
export const useStaggeredAnimation = (itemCount: number, delay: number = 50) => {
  const getItemDelay = useCallback((index: number) => {
    return index * delay;
  }, [delay]);

  const getItemStyle = useCallback((index: number) => {
    return useAnimatedStyle(() => ({
      opacity: withTiming(1, { duration: 300 }),
      transform: [
        {
          translateY: withSpring(0, {
            damping: 15,
            ...(getItemDelay(index) > 0 ? { delay: getItemDelay(index) } : {}),
          }),
        },
      ],
    }));
  }, []);

  return { getItemDelay, getItemStyle };
};