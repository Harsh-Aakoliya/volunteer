// Shared SVG icons for rich text toolbar
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle, Path } from 'react-native-svg';

export const AlignLeftIcon = ({ size = 20, color = "#666" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="3" y1="12" x2="15" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="3" y1="18" x2="18" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const AlignCenterIcon = ({ size = 20, color = "#666" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="6" y1="12" x2="18" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const AlignRightIcon = ({ size = 20, color = "#666" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="9" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="6" y1="18" x2="21" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const BulletListIcon = ({ size = 20, color = "#666" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="4" cy="6" r="2" fill={color} />
    <Circle cx="4" cy="12" r="2" fill={color} />
    <Circle cx="4" cy="18" r="2" fill={color} />
    <Line x1="9" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="9" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="9" y1="18" x2="21" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const NumberListIcon = ({ size = 20, color = "#666" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 5.5L4.5 5L5 5.5V9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3.5 15H5.5L3.5 17.5H5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.5 15H5.5L3.5 17.5H5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="9" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="9" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="9" y1="18" x2="21" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const ColorIndicatorIcon = ({
  type,
  color,
  size = 22
}: {
  type: 'text' | 'background';
  color: string;
  size?: number;
}) => (
  <View className="relative">
    <Ionicons
      name={type === 'text' ? "color-palette" : "color-fill"}
      size={size}
      color="#666"
    />
    <View
      className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-full"
      style={{ backgroundColor: color }}
    />
  </View>
);
