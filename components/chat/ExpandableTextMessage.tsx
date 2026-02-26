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

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const StyledTextMessage = React.memo(({ 
    content, 
    isOwnMessage 
  }: { 
    content: string, 
    isOwnMessage: boolean 
  }) => {
    const { width } = useWindowDimensions();
    const contentWidth = width * 0.75; 
  
    const cleanContent = useMemo(() => {
      if (!content) return "";
      return content.trim();
    }, [content]);
  
    const isHTML = /<[a-z][\s\S]*>/i.test(cleanContent);
    const messageTextColor = '#1F2937';
  
    if (!isHTML) {
      return (
        <Text
          style={{
            fontSize: 16,
            lineHeight: 22,
            color: messageTextColor,
            fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
            fontWeight: '400',
          }}
        >
          {cleanContent}
        </Text>
      );
    }
  
    const linkColor = isOwnMessage ? '#0000FF' : '#0088CC';
  
    return (
      <View>
        <RenderHtml
          contentWidth={contentWidth}
          source={{ html: cleanContent }}
          baseStyle={{
            fontSize: 16,
            lineHeight: 22,
            color: messageTextColor,
            fontFamily: Platform.OS === 'ios' ? 'System' : '-apple-system',
          }}
          tagsStyles={{
            body: { margin: 0, padding: 0 },
            p: { marginTop: 0, marginBottom: 4 },
            div: { marginTop: 0, marginBottom: 0 },
            b: { fontWeight: '700' },
            strong: { fontWeight: '700' },
            i: { fontStyle: 'italic' },
            em: { fontStyle: 'italic' },
            a: { color: linkColor, textDecorationLine: 'underline' },
            ul: { paddingLeft: 20, marginTop: 4, marginBottom: 4 },
            ol: { paddingLeft: 20, marginTop: 4, marginBottom: 4 },
            li: { marginBottom: 2 },
            span: { }, 
          }}
          defaultTextProps={{
            textBreakStrategy: 'simple',
          }}
        />
      </View>
    );
  });

// ============================================
// EXPANDABLE TEXT MESSAGE COMPONENT
// ============================================

interface ExpandableTextMessageProps {
  content: string;
  isOwnMessage: boolean;
  maxLines?: number;
}

const ExpandableTextMessage = React.memo(({
  content,
  isOwnMessage,
  maxLines = 10,
}: ExpandableTextMessageProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const measureRef = useRef(false);
  
  const LINE_HEIGHT = 22;
  const MAX_COLLAPSED_HEIGHT = maxLines * LINE_HEIGHT;
  
  // Colors based on message ownership
  const bubbleColor = isOwnMessage ? '#DCF8C6' : '#FFFFFF';
  const readMoreColor = isOwnMessage ? '#075E54' : '#0088CC';
  
  // Gradient colors for fade effect
  const gradientColors = isOwnMessage 
    ? ['rgba(220, 248, 198, 0)', 'rgba(220, 248, 198, 0.8)', 'rgba(220, 248, 198, 1)'] as const
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
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <View>
      {/* Hidden measuring view - renders once to get full height */}
      {fullHeight === null && (
        <View 
          style={styles.measureView}
          onLayout={handleFullLayout}
          pointerEvents="none"
        >
          <StyledTextMessage content={content} isOwnMessage={isOwnMessage} />
        </View>
      )}
      
      {/* Visible content */}
      <View 
        style={{ 
          maxHeight: showReadMore && !isExpanded ? MAX_COLLAPSED_HEIGHT : undefined,
          overflow: 'hidden',
        }}
      >
        <StyledTextMessage content={content} isOwnMessage={isOwnMessage} />
      </View>
      
      {/* Gradient fade + Read More button at bottom right */}
      {showReadMore && !isExpanded && (
        <View style={styles.readMoreContainer}>
          {/* Gradient fade from left */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientFade}
          />
          
          {/* Read More button */}
          <TouchableOpacity 
            onPress={toggleExpand}
            activeOpacity={0.7}
            style={[styles.readMoreButton, { backgroundColor: bubbleColor }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.readMoreText, { color: readMoreColor }]}>
              Read more
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Read Less button - shown below content when expanded */}
      {showReadMore && isExpanded && (
        <TouchableOpacity 
          onPress={toggleExpand}
          activeOpacity={0.7}
          style={styles.readLessButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.readLessText, { color: readMoreColor }]}>
            Read less
          </Text>
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
  readMoreContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  gradientFade: {
    width: 60,
    height: '100%',
  },
  readMoreButton: {
    paddingLeft: 4,
    paddingRight: 2,
    height: '100%',
    justifyContent: 'center',
  },
  readMoreText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  readLessButton: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingVertical: 2,
  },
  readLessText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default ExpandableTextMessage;