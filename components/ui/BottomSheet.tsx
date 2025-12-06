// components/ui/BottomSheet.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
}

export default function BottomSheet({
  visible,
  onClose,
  title = 'Options',
  children,
  minHeight = SCREEN_HEIGHT * 0.45,
  maxHeight = SCREEN_HEIGHT * 0.85,
}: BottomSheetProps) {
  // Use separate animated values - all with useNativeDriver: false for consistency
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(minHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Track gesture
  const startY = useRef(0);
  const startHeight = useRef(minHeight);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        startHeight.current = sheetHeight;
      },
      onPanResponderMove: (_, gestureState) => {
        const newHeight = startHeight.current - gestureState.dy;
        
        // Clamp height between min and max with some resistance
        if (newHeight >= minHeight && newHeight <= maxHeight) {
          setSheetHeight(newHeight);
        } else if (newHeight < minHeight) {
          // Resistance when pulling down past min
          const overscroll = minHeight - newHeight;
          setSheetHeight(minHeight - overscroll * 0.2);
        } else if (newHeight > maxHeight) {
          // Resistance when pulling up past max
          const overscroll = newHeight - maxHeight;
          setSheetHeight(maxHeight + overscroll * 0.1);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vy;
        const dy = gestureState.dy;

        // Close if swiped down fast or far enough
        if (velocity > 0.5 || (dy > 80 && velocity >= 0)) {
          closeSheet();
          return;
        }
        
        // Expand if swiped up fast or far enough
        if (velocity < -0.5 || (dy < -50 && velocity <= 0)) {
          setIsExpanded(true);
          animateHeight(maxHeight);
          return;
        }

        // Snap to nearest state
        const midPoint = (minHeight + maxHeight) / 2;
        if (sheetHeight > midPoint) {
          setIsExpanded(true);
          animateHeight(maxHeight);
        } else {
          setIsExpanded(false);
          animateHeight(minHeight);
        }
      },
    })
  ).current;

  const animateHeight = (toHeight: number) => {
    const startValue = sheetHeight;
    const diff = toHeight - startValue;
    const duration = 250;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setSheetHeight(startValue + diff * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (visible) {
      openSheet();
    }
  }, [visible]);

  const openSheet = () => {
    setSheetHeight(minHeight);
    setIsExpanded(false);
    
    // Animate sheet up and backdrop in
    Animated.parallel([
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setSheetHeight(minHeight);
      setIsExpanded(false);
      onClose();
    });
  };

  const toggleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      animateHeight(minHeight);
    } else {
      setIsExpanded(true);
      animateHeight(maxHeight);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable style={styles.backdropPressable} onPress={closeSheet} />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              height: sheetHeight,
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          {/* Drag Handle Area */}
          <View {...panResponder.panHandlers} style={styles.handleContainer}>
            {/* Drag Indicator */}
            <TouchableOpacity 
              onPress={toggleExpand}
              activeOpacity={0.7}
              style={styles.dragIndicatorContainer}
            >
              <View style={styles.dragIndicator} />
            </TouchableOpacity>
            
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{title}</Text>
                {isExpanded && (
                  <Text style={styles.expandedHint}>Swipe down to minimize</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={closeSheet}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPressable: {
    flex: 1,
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    overflow: 'hidden',
  },
  handleContainer: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  expandedHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  content: {
    flex: 1,
  },
});