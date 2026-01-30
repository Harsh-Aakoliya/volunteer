// Shared heading picker (H1–H6, Normal) for rich editor
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HeadingLevel } from './htmlHelpers';

export interface InlineHeadingPickerProps {
  visible: boolean;
  selectedHeading: HeadingLevel;
  onSelect: (heading: HeadingLevel) => void;
  onClose: () => void;
}

const headings: HeadingLevel[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

export function InlineHeadingPicker({
  visible,
  selectedHeading,
  onSelect,
  onClose,
}: InlineHeadingPickerProps) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [visible, animValue]);

  const containerHeight = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.3, 1],
  });

  if (!visible) return null;

  return (
    <Animated.View
      className="bg-white border-t border-gray-200 overflow-hidden rounded-xl mt-2"
      style={{ height: containerHeight, opacity }}
    >
      <View className="flex-row justify-between items-center px-3 pt-2 pb-1">
        <Text className="text-sm font-semibold text-gray-700">Select Heading</Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="p-1"
        >
          <Ionicons name="close-circle" size={22} color="#666" />
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}
        keyboardShouldPersistTaps="always"
      >
        {headings.map((heading) => {
          const isSelected = selectedHeading === heading;
          return (
            <TouchableOpacity
              key={heading}
              onPress={() => onSelect(heading)}
              className={`px-4 py-2 rounded-lg ${
                isSelected ? 'bg-green-100 border border-green-500' : 'bg-gray-100 border border-gray-200'
              }`}
            >
              <Text className={`text-sm font-bold ${isSelected ? 'text-green-600' : 'text-gray-700'}`}>
                {heading?.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => onSelect(null)}
          className={`px-4 py-2 rounded-lg ${
            !selectedHeading ? 'bg-green-100 border border-green-500' : 'bg-gray-100 border border-gray-200'
          }`}
        >
          <Text className={`text-sm font-semibold ${!selectedHeading ? 'text-green-600' : 'text-gray-700'}`}>
            Normal
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}
