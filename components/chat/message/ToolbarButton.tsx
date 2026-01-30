import React from 'react';
import { TouchableOpacity, View } from 'react-native';

export interface ToolbarButtonProps {
  onPress: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  /** Optional active bg class (e.g. 'bg-green-100' or 'bg-blue-100') */
  activeClass?: string;
}

export function ToolbarButton({
  onPress,
  isActive = false,
  children,
  activeClass = 'bg-green-100',
}: ToolbarButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-2.5 rounded-md mx-0.5 min-h-[36px] justify-center ${isActive ? activeClass : ''}`}
      activeOpacity={0.6}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {children}
    </TouchableOpacity>
  );
}
