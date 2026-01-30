// Shared animated toolbar wrapper for rich text toolbar
import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export interface AnimatedToolbarProps {
  visible: boolean;
  children: React.ReactNode;
  /** Optional container class (e.g. bg-gray-50 vs bg-white rounded) */
  className?: string;
}

export function AnimatedToolbar({
  visible,
  children,
  className = 'bg-gray-50 border-t border-gray-200 overflow-hidden',
}: AnimatedToolbarProps) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: visible ? 1 : 0,
      friction: 10,
      tension: 120,
      useNativeDriver: false,
    }).start();
  }, [visible, animValue]);

  const containerHeight = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 50],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.7, 1],
  });

  return (
    <Animated.View
      className={className}
      style={{
        height: containerHeight,
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}
