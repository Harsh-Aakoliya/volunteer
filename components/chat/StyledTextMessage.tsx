import React from 'react';
import { View, Text, Dimensions, Linking, TouchableOpacity } from 'react-native';
import RenderHtml from 'react-native-render-html';

const StyledTextMessage = React.memo(({ content }: { content: string }) => {
    console.log("content", content);
  const { width } = Dimensions.get('window');
  const maxWidth = width * 0.75;
  
  // Check if content contains HTML tags
  const isHTML = /<[^>]+>/g.test(content);
  
  if (!isHTML) {
    // Plain text - render normally with link detection
    return (
      <Text className="text-base leading-[22px] text-black">
        {content}
      </Text>
    );
  }
  
  // HTML content - render with RenderHtml
  // Clean up the HTML to ensure proper rendering
  let htmlContent = content.trim();
  
  // Wrap content in a div if not already wrapped
  if (!htmlContent.startsWith('<div') && !htmlContent.startsWith('<p')) {
    htmlContent = `<div>${htmlContent}</div>`;
  }
  
  return (
    <View style={{ maxWidth }}>
      <RenderHtml
        contentWidth={maxWidth}
        source={{ html: htmlContent }}
        baseStyle={{
          fontSize: 16,
          lineHeight: 22,
          color: '#000000',
        }}
        tagsStyles={{
          body: {
            margin: 0,
            padding: 0,
          },
          div: {
            margin: 0,
            padding: 0,
          },
          p: {
            margin: 0,
            marginBottom: 4,
            padding: 0,
          },
          strong: {
            fontWeight: 'bold',
          },
          b: {
            fontWeight: 'bold',
          },
          em: {
            fontStyle: 'italic',
          },
          i: {
            fontStyle: 'italic',
          },
          u: {
            textDecorationLine: 'underline',
          },
          s: {
            textDecorationLine: 'line-through',
          },
          strike: {
            textDecorationLine: 'line-through',
          },
          del: {
            textDecorationLine: 'line-through',
          },
          ol: {
            margin: 0,
            marginTop: 4,
            marginBottom: 4,
            paddingLeft: 20,
          },
          ul: {
            margin: 0,
            marginTop: 4,
            marginBottom: 4,
            paddingLeft: 20,
          },
          li: {
            marginBottom: 4,
          },
          a: {
            color: '#0088CC',
            textDecorationLine: 'underline',
          },
          br: {
            height: 4,
          },
          span: {
            // Preserve inline styles
          },
        }}
        defaultTextProps={{
          style: {
            fontSize: 16,
            lineHeight: 22,
            color: '#000000',
          },
        }}
        renderersProps={{
          a: {
            onPress: (event: any, href: string) => {
              Linking.openURL(href).catch(err => {
                console.error('Failed to open URL:', err);
              });
            },
          },
        }}
        enableExperimentalMarginCollapsing={true}
      />
    </View>
  );
});

export default StyledTextMessage;