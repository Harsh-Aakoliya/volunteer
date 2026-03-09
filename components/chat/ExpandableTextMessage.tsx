import React, { useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  LayoutAnimation, 
  Platform, 
  UIManager,
  useWindowDimensions,
  StyleSheet
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { LinearGradient } from 'expo-linear-gradient';
import MessageStatus from "@/components/chat/MessageStatus";

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// WhatsApp adds an invisible spacer at the end of text to ensure the absolute positioned timestamp
// doesn't overlap the text. If the text hits the edge, the spacer forces a new line just for the time.
const WHATSAPP_SPACER = ' \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'; 

interface ExpandableTextMessageProps {
  content: string;
  isOwnMessage: boolean;
  maxLines?: number;
  timeString: string;
  status: "sending" | "sent" | "delivered" | "read" | "error";
  isEdited?: boolean;
}

const ExpandableTextMessage = React.memo(({
  content,
  isOwnMessage,
  maxLines = 10,
  timeString,
  status,
  isEdited
}: ExpandableTextMessageProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const measureRef = useRef(false);
  const { width } = useWindowDimensions();
  
  const LINE_HEIGHT = 22;
  const MAX_COLLAPSED_HEIGHT = maxLines * LINE_HEIGHT;
  
  const bubbleColor = isOwnMessage ? '#E7FFDB' : '#FFFFFF';
  const readMoreColor = '#0088CC';
  
  const gradientColors = isOwnMessage 
    ? ['rgba(231, 255, 219, 0)', 'rgba(231, 255, 219, 0.8)', 'rgba(231, 255, 219, 1)'] as const
    : ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 1)'] as const;

  const handleFullLayout = useCallback((event: any) => {
    if (!measureRef.current) {
      const height = event.nativeEvent.layout.height;
      setFullHeight(height);
      setShowReadMore(height > MAX_COLLAPSED_HEIGHT);
      measureRef.current = true;
    }
  }, [MAX_COLLAPSED_HEIGHT]);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 250,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setIsExpanded(prev => !prev);
  }, []);

  const cleanContent = useMemo(() => content ? content.trim() : "", [content]);
  const isHTML = /<[a-z][\s\S]*>/i.test(cleanContent);

  // The timestamp component formatted identically to WhatsApp
  const TimestampOverlay = () => (
    <View style={styles.timestampContainer}>
      {isEdited && <Text style={styles.editedText}>edited</Text>}
      <Text style={styles.timeText}>{timeString}</Text>
      {isOwnMessage && (
        <View style={styles.statusIcon}>
          <MessageStatus status={status} />
        </View>
      )}
    </View>
  );

  return (
    <View style={{ position: 'relative' }}>
      
      {fullHeight === null && (
        <View style={styles.measureView} onLayout={handleFullLayout} pointerEvents="none">
          <Text style={styles.textContent}>{cleanContent}</Text>
        </View>
      )}
      
      <View 
        style={{ 
          maxHeight: showReadMore && !isExpanded ? MAX_COLLAPSED_HEIGHT : undefined,
          overflow: 'hidden',
          minWidth: 80 // Ensures short messages are wide enough to hold the timestamp
        }}
      >
        {!isHTML ? (
          <Text style={styles.textContent}>
            {cleanContent}
            {/* The magic spacer that pushes the timestamp out of the way */}
            <Text style={styles.spacerText}>{WHATSAPP_SPACER}</Text>
          </Text>
        ) : (
          <View>
             <RenderHtml
              contentWidth={width * 0.75}
              source={{ html: cleanContent + `<span style="opacity:0;">${WHATSAPP_SPACER}</span>` }}
              baseStyle={styles.textContent}
              tagsStyles={{
                body: { margin: 0, padding: 0 },
                p: { marginTop: 0, marginBottom: 0 },
                a: { color: '#0088CC', textDecorationLine: 'underline' }
              }}
            />
          </View>
        )}
      </View>

      {/* Absolute Timestamp positioned at the bottom right */}
      <TimestampOverlay />
      
      {/* Read More Handling */}
      {showReadMore && !isExpanded && (
        <View style={styles.readMoreContainer}>
          <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientFade} />
          <TouchableOpacity onPress={toggleExpand} style={[styles.readMoreButton, { backgroundColor: bubbleColor }]}>
            <Text style={[styles.readMoreText, { color: readMoreColor }]}>Read more</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {showReadMore && isExpanded && (
        <TouchableOpacity onPress={toggleExpand} style={styles.readLessButton}>
          <Text style={[styles.readLessText, { color: readMoreColor }]}>Read less</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  measureView: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
  textContent: {
    fontSize: 15.5, // Exactly matching WhatsApp readability scale
    lineHeight: 21,
    color: '#111B21',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  spacerText: {
    fontSize: 15.5,
    lineHeight: 21,
    color: 'transparent',
  },
  timestampContainer: {
    position: 'absolute',
    bottom: -2,    // Snug against the bottom
    right: 0,      // Snug against the right
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent', // No background needed due to spacer text pushing content away
  },
  timeText: {
    fontSize: 11,
    color: '#667781',
    marginLeft: 4,
    marginBottom: 1, // Slight baseline adjustment
  },
  editedText: {
    fontSize: 11,
    color: '#667781',
    fontStyle: 'italic',
    marginRight: 2,
  },
  statusIcon: {
    marginLeft: 3,
    marginBottom: 1,
    marginTop: 1 // alignment tweak
  },
  // Read More Styles
  readMoreContainer: {
    position: 'absolute',
    bottom: 20, // Sit just above the timestamp line
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  gradientFade: { width: 60, height: '100%' },
  readMoreButton: { paddingLeft: 4, paddingRight: 2, height: '100%', justifyContent: 'center' },
  readMoreText: { fontSize: 15, fontWeight: '600' },
  readLessButton: { alignSelf: 'flex-start', marginTop: 10, paddingBottom: 4 },
  readLessText: { fontSize: 15, fontWeight: '600' },
});

export default ExpandableTextMessage;