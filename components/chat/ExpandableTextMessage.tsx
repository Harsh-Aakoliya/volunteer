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
import MessageStatus from "@/components/chat/MessageStatus";

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  
  const LINE_HEIGHT = 21;
  const MAX_COLLAPSED_HEIGHT = maxLines * LINE_HEIGHT;
  
  // DYNAMIC SPACER: 
  // Edited messages have a wider timestamp ("edited 10:00 PM ✓✓"), so they need more non-breaking spaces.
  // The zero-width space (\u200B) ensures the block of spaces can wrap to a new line if needed.
  const spacerSpaces = isEdited ? 32 : 18; 
  const spacerString = '\u200B' + '\u00A0'.repeat(spacerSpaces);

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
      
      {/* Hidden Measure View */}
      {fullHeight === null && (
        <View style={styles.measureView} onLayout={handleFullLayout} pointerEvents="none">
          <Text style={styles.textContent}>{cleanContent}</Text>
        </View>
      )}
      
      {/* Content Container */}
      <View 
        style={{ 
          maxHeight: showReadMore && !isExpanded ? MAX_COLLAPSED_HEIGHT : undefined,
          overflow: 'hidden',
          minWidth: 80 
        }}
      >
        {!isHTML ? (
          <Text style={styles.textContent}>
            {cleanContent}
            {/* If NOT showing the read more button, append spacer directly to the text */}
            {!showReadMore && (
              <Text style={styles.spacerText}>{spacerString}</Text>
            )}
          </Text>
        ) : (
          <View>
             <RenderHtml
              contentWidth={width * 0.70}
              source={{ html: cleanContent + (!showReadMore ? `<span style="opacity:0; font-size:15.5px;">${spacerString}</span>` : '') }}
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

      {/* Read More / Read Less anchored strictly to the Bottom-Left */}
      {showReadMore && (
        <TouchableOpacity 
          onPress={toggleExpand} 
          style={styles.readMoreButton}
          activeOpacity={0.7}
        >
          <Text style={styles.readMoreText}>
            {isExpanded ? 'Read less' : 'Read more'}
            {/* ALWAYS append the spacer to the button text. This forces the bubble to widen 
                enough for vertical text and prevents the timestamp from overlapping the button. */}
            <Text style={styles.spacerText}>{spacerString}</Text>
          </Text>
        </TouchableOpacity>
      )}

      {/* Timestamp stays anchored to the bottom right corner exactly */}
      <TimestampOverlay />
      
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
    fontSize: 15.5, 
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
    bottom: 0,     // Perfectly aligns with the bottom baseline
    right: 0,      
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    color: '#667781',
    marginLeft: 4,
    marginBottom: 1, 
  },
  editedText: {
    fontSize: 11,
    color: '#667781',
    fontStyle: 'italic',
    marginRight: 2,
    marginBottom: 1,
  },
  statusIcon: {
    marginLeft: 3,
    marginBottom: 1,
  },
  readMoreButton: { 
    alignSelf: 'flex-start', // Forces it immediately to the left
    marginTop: 2,
  },
  readMoreText: { 
    fontSize: 15.5, 
    lineHeight: 21,
    fontWeight: '600',
    color: '#0088CC', 
  },
});

export default ExpandableTextMessage;