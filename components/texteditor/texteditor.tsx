import React, { useRef, forwardRef, useState, useCallback,useEffect } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Dimensions, Modal, SafeAreaView, StatusBar } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import WebView from 'react-native-webview';
import { TextInput, FlatList, Alert } from 'react-native';
import { fetchAnnouncements, createAnnouncement, updateLikes } from '@/api/admin';
import { router } from 'expo-router';

interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
  likes: number;
  dislikes: number;
}

// Create a forwarded ref component for RichEditor
const ForwardedRichEditor = forwardRef<RichEditor, any>((props, ref) => (
  <RichEditor {...props} ref={ref} />
));

// Use cssInterop with the forwarded ref component
const StyledRichEditor = cssInterop(ForwardedRichEditor, {
  className: 'style'
});

// Use cssInterop for RichToolbar
const StyledRichToolbar = cssInterop(RichToolbar, {
  className: 'style'
});

// Use cssInterop for WebView
const StyledWebView = cssInterop(WebView, {
  className: 'style'
});

const RichTextEditor = () => {
  // Properly type the ref
  const richText = useRef<RichEditor>(null);
  // State to store the current HTML content
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  // const [body, setBody] = useState<string>('');
  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Title and Body cannot be empty.');
      return;
    }
    try {
      const newAnnouncement=await createAnnouncement(title, content);
      console.log(";aljf",newAnnouncement)
      setTitle('');
      setContent('');
      console.log("after publishing",newAnnouncement);
      router.push({
        pathname: "/announcement",
        params: { newAnnouncement: JSON.stringify(newAnnouncement) }
    });
    
    } catch (error) {
      console.error('Error creating announcement:', error);
    }
  };


  // State to control the modal visibility
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const { width } = Dimensions.get('window');

  // Handle content change
  const handleContentChange = useCallback((html: string) => {
    setContent(html);
  }, []);

  // Create HTML with proper styling for the preview
  const getPreviewHTML = useCallback(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 16px;
              margin: 0;
              color: #1f2937;
              font-size: 16px;
              line-height: 1.5;
              background-color: white;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            ul, ol {
              padding-left: 20px;
            }
            a {
              color: #2563eb;
              text-decoration: underline;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              line-height: 1.2;
            }
            h1 {
              font-size: 1.8em;
            }
            h2 {
              font-size: 1.5em;
            }
            blockquote {
              border-left: 4px solid #e5e7eb;
              padding-left: 16px;
              margin-left: 0;
              color: #4b5563;
            }
            pre {
              background-color: #f3f4f6;
              padding: 16px;
              border-radius: 4px;
              overflow-x: auto;
            }
            code {
              font-family: monospace;
              background-color: #f3f4f6;
              padding: 2px 4px;
              border-radius: 4px;
            }
            .announcement-title {
              font-size: 24px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 16px;
              color: #111827;
            }
            .announcement-date {
              text-align: center;
              margin-bottom: 24px;
              color: #6b7280;
            }
            .announcement-content {
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="announcement-title">Announcement Preview</div>
          <div class="announcement-date">${new Date().toLocaleDateString()}</div>
          <div class="announcement-content">
            ${content || '<span style="color: #9ca3af; font-style: italic;">No content to preview</span>'}
          </div>
        </body>
      </html>
    `;
  }, [content]);

  // Toggle modal visibility
  const toggleModal = () => {
    setModalVisible(!modalVisible);
  };

  return (
    <SafeAreaView className="flex-1 bg-white pt-5">
      <ScrollView className="flex-1 px-4 pb-6">
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 10,
          borderRadius: 5
        }}
      />
        <Text className="text-xl font-bold my-4">Rich Text Editor</Text>
        
        {/* Toolbar */}
        <StyledRichToolbar
          editor={richText}
          className="border border-gray-300 rounded-t-lg"
          selectedIconTint="#2563EB" // tailwind blue-600
          iconTint="#6B7280" // tailwind gray-500
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.heading1,
            actions.heading2,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.insertLink,
            actions.insertImage,
            actions.alignLeft,
            actions.alignCenter,
            actions.alignRight,
            actions.code,
            actions.blockquote,
            actions.line,
            actions.undo,
            actions.redo,
          ]}
        />
        
        {/* Editor - Now with proper ref forwarding and onChange handler */}
        <StyledRichEditor
          className="min-h-64 border border-gray-300 border-t-0 rounded-b-lg p-2 bg-white"
          placeholder="Start typing..."
          initialHeight={250}
          ref={richText}
          onChange={handleContentChange}
          editorStyle={{
            contentCSSText: `
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 16px;
              padding: 8px;
            `
          }}
        />
        
        {/* Custom Buttons */}
        <View className="flex-row justify-end mt-4 space-x-2">
          <TouchableOpacity 
            className="bg-gray-200 py-2 px-4 rounded-lg"
            onPress={() => {
              if (richText.current) {
                richText.current.setContentHTML('');
                setContent('');
              }
            }}
          >
            <Text className="text-gray-800">Clear</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-blue-600 py-2 px-4 rounded-lg"
            onPress={() => {
              if (richText.current) {
                const currentContent = richText.current.getContentHtml();
                console.log('Content:', currentContent);
                toggleModal(); // Open the modal with the preview
              }
            }}
          >
            <Text className="text-white">Save</Text>
          </TouchableOpacity>
        </View>
        
        {/* Live Preview Section */}
        {/* <View className="mt-8">
          <Text className="text-xl font-bold mb-2">Live Preview</Text>
          <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <StyledWebView
              className="w-full min-h-48"
              originWhitelist={['*']}
              source={{ html: getPreviewHTML() }}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View> */}
      </ScrollView>

      {/* Modal Preview Window */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={toggleModal}
      >
        <SafeAreaView className="flex-1 bg-white">
          <StatusBar barStyle="dark-content" />
          
          {/* Modal Header */}
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
            <Text className="text-xl font-bold">Announcement Preview</Text>
            <View className="flex-row space-x-2">
              <TouchableOpacity 
                className="bg-gray-200 py-2 px-4 rounded-lg"
                onPress={toggleModal}
              >
                <Text className="text-gray-800">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="bg-green-600 py-2 px-4 rounded-lg"
                onPress={() => {
                  // Handle final save/publish logic here
                  console.log('Publishing announcement:', content);
                  toggleModal();
                  // Add your save to server or state management logic here
                  console.log("type of content",typeof(content));
                  handleCreateAnnouncement();
                }}
              >
                <Text className="text-white">Publish</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Full Page Preview */}
          <View className="flex-1">
            <StyledWebView
              className="flex-1"
              originWhitelist={['*']}
              source={{ html: getPreviewHTML() }}
              showsVerticalScrollIndicator={true}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default RichTextEditor;