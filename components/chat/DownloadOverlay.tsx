/**
 * WhatsApp-style download overlay for media cells.
 * Shows: idle → download icon, downloading → circular progress, error → retry icon.
 */
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";

interface DownloadOverlayProps {
  state: "idle" | "downloading" | "done" | "error";
  progress: number; // 0–1
  onPress: () => void;
  size?: number;
  fileSize?: string;
}

const DownloadOverlay: React.FC<DownloadOverlayProps> = ({
  state,
  progress,
  onPress,
  size = 48,
  fileSize,
}) => {
  if (state === "done") return null;

  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="box-none">
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.touchable}>
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
          {state === "downloading" ? (
            <>
              <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#fff"
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              </Svg>
              <Ionicons name="close" size={size * 0.4} color="#fff" />
            </>
          ) : state === "error" ? (
            <Ionicons name="reload" size={size * 0.45} color="#fff" />
          ) : (
            <Ionicons name="arrow-down" size={size * 0.45} color="#fff" />
          )}
        </View>
        {fileSize && state === "idle" && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{fileSize}</Text>
          </View>
        )}
        {state === "downloading" && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  touchable: {
    alignItems: "center",
  },
  circle: {
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    marginTop: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});

export default React.memo(DownloadOverlay);
