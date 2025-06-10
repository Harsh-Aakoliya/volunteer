import { TouchableOpacity, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

interface BackButtonProps {
  label?: string;
  color?: string;
  iconSize?: number;
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  label = 'Back',
  color = '#000',
  iconSize = 24,
  className = ''
}) => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      className={`flex-row ${className}`}
    >
      <Ionicons name="arrow-back" size={iconSize} color={color} />
      {/* <Text className="ml-1 text-base" style={{ color }}>
        {label}
      </Text> */}
    </TouchableOpacity>
  );
};

export default BackButton;
