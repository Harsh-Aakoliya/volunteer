// Shared inline color picker for rich text (text / highlight)
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
import { COLORS } from './editorConstants';

export interface InlineColorPickerProps {
  visible: boolean;
  type: 'text' | 'background' | null;
  selectedColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
  /** 'default' = gray-50, 'white' = white rounded */
  variant?: 'default' | 'white';
  /** Tailwind border class when selected (e.g. 'border-green-500' or 'border-blue-500') */
  selectedBorderClass?: string;
}

const defaultBorderClass = 'border-green-500';

export function InlineColorPicker({
  visible,
  type,
  selectedColor,
  onSelect,
  onClose,
  variant = 'default',
  selectedBorderClass = defaultBorderClass,
}: InlineColorPickerProps) {
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
    outputRange: [0, 90],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.3, 1],
  });

  if (!visible) return null;

  const containerClass =
    variant === 'white'
      ? 'bg-white border-t border-gray-200 overflow-hidden rounded-xl mt-2'
      : 'bg-gray-50 border-t border-gray-200 overflow-hidden';

  return (
    <Animated.View
      className={containerClass}
      style={{ height: containerHeight, opacity }}
    >
      <View className="flex-row justify-between items-center px-3 pt-2 pb-1">
        <Text className="text-sm font-semibold text-gray-700">
          {type === 'text' ? 'Text Color' : 'Highlight Color'}
        </Text>
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
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}
        keyboardShouldPersistTaps="always"
      >
        {COLORS.map((color) => {
          const isSelected = selectedColor === color;
          return (
            <TouchableOpacity
              key={color}
              onPress={() => onSelect(color)}
              className={`w-9 h-9 rounded-full items-center justify-center ${
                color === '#FFFFFF' ? 'border-2 border-gray-300' : ''
              } ${isSelected ? `border-2 ${selectedBorderClass}` : ''}`}
              style={{
                backgroundColor: color,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={color === '#FFFFFF' || color === '#FFFF00' || color === '#FFAA00' ? '#000' : '#fff'}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
