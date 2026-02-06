// components/SplashScreen.tsx
// Single splash view: centered logo + tint background. Optional onPress for hidden actions (e.g. 7-tap dev mode).

import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ImageSourcePropType } from 'react-native';

const LOGO = require('@/assets/images/sevakapplogo.png');

const TINT_BACKGROUND = '#E5DDD5'; // same as room's background color

export interface SplashScreenProps {
  /** Optional: when provided, the splash is pressable (e.g. for 7-tap dev mode) */
  onPress?: () => void;
  /** Override background color */
  backgroundColor?: string;
  /** Override logo source */
  logoSource?: ImageSourcePropType;
}

export default function SplashScreen({
  onPress,
  backgroundColor = TINT_BACKGROUND,
  logoSource = LOGO,
}: SplashScreenProps) {
  const content = (
    <View style={[styles.container, { backgroundColor }]}>
      <Image
        source={logoSource}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Sevak App Logo"
      />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={1} onPress={onPress} style={styles.flex}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 180,
    maxWidth: '70%',
    maxHeight: '45%',
  },
});
