import React, { useRef, forwardRef, useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Dimensions, Modal, SafeAreaView, StatusBar, BackHandler } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import WebView from 'react-native-webview';
import { TextInput, Alert } from 'react-native';
import { 
  createAnnouncement, 
  updateDraft, 
  publishDraft, 
  removeEmptyDraft,
  updateAnnouncement,
  deleteDraft
} from '@/api/admin';
import { router } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import { Announcement } from '@/types/type';
import { useFocusEffect } from '@react-navigation/native';
// Update the interface
interface RichTextEditorProps {
  initialTitle?: string;
  initialContent?: string;
  announcementId?: number;
  announcementMode?: string;
  draftId?: number;
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

// Update the component definition
const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  initialTitle = '', 
  initialContent = '',
  announcementId,
  announcementMode,
}) => {
  // State variables
  const richText = useRef<RichEditor>(null);
  const [content, setContent] = useState<string>(initialContent);
  const [title, setTitle] = useState<string>(initialTitle);
  const [draftContent, setDraftContent] = useState<string>(initialContent);
  const [draftTitle, setDraftTitle] = useState<string>(initialTitle);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isFresh = announcementMode === 'fresh';
  const isDraft = announcementMode === 'draft';
  const isEdit = announcementMode === 'edit';

  // Initialize state and user ID
  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    setDraftTitle(initialTitle);
    setDraftContent(initialContent);
    
    // Update the editor content with a delay to ensure it's ready
    if (initialContent) {
      console.log("initialContent", initialContent);
      // Use setTimeout to ensure the editor is fully mounted
      const timeoutId = setTimeout(() => {
        if (richText.current) {
          richText.current.setContentHTML(initialContent);
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [initialTitle, initialContent]);

  // Additional effect to set content when editor ref becomes available
  useEffect(() => {
    if (richText.current && initialContent && !draftContent) {
      console.log("Setting content via ref availability check:", initialContent);
      setTimeout(() => {
        if (richText.current) {
          richText.current.setContentHTML(initialContent);
        }
      }, 200);
    }
  }, [richText.current, initialContent]);

  useEffect(() => {
    const getUserId = async () => {
      const user = await AuthStorage.getUser();
      if (user) {
        setCurrentUserId(user.userId);
      }
    };
    getUserId();
  }, []);

  // Add state to prevent duplicate operations
  const [isDeletingDraft, setIsDeletingDraft] = useState<boolean>(false);

  // Track changes for auto-save functionality - now using draft versions
  useEffect(() => {
    console.log("draftTitle", draftTitle);
    console.log("title", title);
    console.log("draftContent", draftContent);
    console.log("content", content);
    if ((draftTitle !== title || draftContent !== content)) {
      setHasUnsavedChanges(true);
    }else{  
      setHasUnsavedChanges(false);
    }
  }, [draftTitle, draftContent, title, content]);

  // Handle back button press
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true; // Prevent default back action
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [hasUnsavedChanges, isDeletingDraft]) // Add isDeletingDraft to dependencies
  );

  const handleSaveProgress = async () => {
    if (!announcementId || !currentUserId) return;

    try {
      setIsSaving(true);
      // Save draft content to the main content fields
      await updateDraft(announcementId, draftTitle, draftContent, currentUserId);
      
      // Update the main content to match draft content
      setTitle(draftTitle);
      setContent(draftContent);
      setHasUnsavedChanges(false);
      Alert.alert('Success', 'Progress saved successfully!');
    } catch (error) {
      console.error('Error saving progress:', error);
      Alert.alert('Error', 'Failed to save progress. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  const handleDeleteDraft = async () => {
    // Prevent duplicate calls
    if (isDeletingDraft) {
      console.log("Delete already in progress, skipping...");
      return;
    }

    // Ensure we have a currentUserId before proceeding
    let userId = currentUserId;
    if (!userId) {
      console.log("No currentUserId, fetching from storage...");
      const user = await AuthStorage.getUser();
      if (user) {
        userId = user.userId;
        setCurrentUserId(userId);
      } else {
        console.error("No user found in storage");
        Alert.alert("Error", "User not found. Please try again.");
        return;
      }
    }

    if (!announcementId) {
      console.error("No announcementId provided");
      return;
    }

    console.log("currentUserId", userId);
    console.log("deleting draft", announcementId, userId);
    
    try {
      setIsDeletingDraft(true);
      await deleteDraft(announcementId as number, userId);
      router.back();  
    } catch (error) {
      console.error("Error deleting draft:", error);
      Alert.alert("Error", "Failed to delete draft. Please try again.");
    } finally {
      setIsDeletingDraft(false);
    }
  };
  // Handle back navigation
  const handleGoBack = async () => {
    // Prevent multiple calls if already processing
    if (isDeletingDraft || isSaving || isPublishing) {
      console.log("Operation in progress, skipping back action");
      return;
    }

    console.log("back button pressed", hasUnsavedChanges);
    if(isFresh){
      console.log("yes it's fresh and handling back", isFresh);
      if(hasUnsavedChanges){
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved changes. What would you like to do?",
          [
            {
              text: "Discard Changes",
              style: "destructive",
              onPress: () => router.back()
            },
            {
              text: "Save Progress & Exit",
              onPress: async () => {
                await handleSaveProgress();
                router.back();
              }
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        )
      } else {
        console.log("no unsaved changes and deleting draft");
        await handleDeleteDraft();
      }
    }else if(isEdit){
      if(hasUnsavedChanges){
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved changes. What would you like to do?",
          [
            {
              text: "Discard Changes",
              style: "destructive",
              onPress: () => router.back()
            },
            {
              text: "Publish",
              onPress: async () => {
                // await ();//will do something
                router.back();
              }
            },
          ]
        )
      }else{
        router.back();
      }
    }
    else if (isDraft) {
      if(hasUnsavedChanges){
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. What would you like to do?",
        [
          {
            text: "Discard Changes",
            style: "destructive",
            onPress: () => router.back()
          },
          {
            text: "Save & Exit",
            onPress: async () => {
              await handleSaveProgress();
              router.back();
            }
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
      }else{
        router.back();
      }
    } else {
      router.back();
    }
  };

  // Handle content change
  const handleContentChange = useCallback((html: string) => {
    setDraftContent(html);
  }, []);

  // Handle title change
  const handleTitleChange = useCallback((text: string) => {
    setDraftTitle(text);
  }, []);

  // Handle publishing/updating announcement
  const handleCreateAnnouncement = async () => {
    if (!draftTitle.trim() || !draftContent.trim()) {
      Alert.alert('Error', 'Title and Body cannot be empty.');
      return;
    }
    
    try {
      setIsPublishing(true);
      let result;
      
      if (announcementId && isDraft) {
        // Publish draft using draft content
        result = await publishDraft(announcementId, draftTitle, draftContent, currentUserId);
        console.log("Published draft:", result);
      } else if (announcementId) {
        // Update existing published announcement using draft content
        result = await updateAnnouncement(announcementId, draftTitle, draftContent);
        console.log("Updated announcement:", result);
      } else {
        // Create new announcement (fallback) using draft content
        result = await createAnnouncement(draftTitle, draftContent, currentUserId, 'published');
        console.log("Created announcement:", result);
      }
      
      setTitle('');
      setContent('');
      setDraftTitle('');
      setDraftContent('');
      setHasUnsavedChanges(false);
      
      router.replace({
        pathname: "/announcement",
        params: { newAnnouncement: JSON.stringify(result) }
      });
    } catch (error) {
      console.error('Error publishing announcement:', error);
      Alert.alert('Error', 'Failed to publish announcement. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };
  // State to control the modal visibility
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const { width } = Dimensions.get('window');

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
          <div class="announcement-title">${draftTitle || 'Untitled'}</div>
          <div class="announcement-date">${new Date().toLocaleDateString()}</div>
          <div class="announcement-content">
            ${draftContent || '<span style="color: #9ca3af; font-style: italic;">No content to preview</span>'}
          </div>
        </body>
      </html>
    `;
  }, [draftContent, draftTitle]);

  // Toggle modal visibility
  const toggleModal = () => {
    setModalVisible(!modalVisible);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header with back button */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
        <TouchableOpacity
          onPress={handleGoBack}
          className="bg-gray-200 py-2 px-4 rounded-lg"
        >
          <Text className="text-gray-800">← Back</Text>
        </TouchableOpacity>
        
        <Text className="text-lg font-bold">
          {isFresh ? 'New Announcement' : isDraft ? (announcementId ? 'Edit Draft' : 'New Draft') : 'Edit Announcement'}
        </Text>
        
        { (
          <TouchableOpacity
            onPress={handleSaveProgress}
            disabled={isSaving || !hasUnsavedChanges}
            className={`py-2 px-4 rounded-lg ${
              hasUnsavedChanges && !isSaving 
                ? 'bg-blue-500' 
                : 'bg-gray-300'
            }`}
          >
            <Text className={`${
              hasUnsavedChanges && !isSaving 
                ? 'text-white' 
                : 'text-gray-500'
            }`}>
              {isSaving ? 'Saving...' : 'Save Progress'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {/* Title Input */}
        <TextInput
          value={draftTitle}
          onChangeText={handleTitleChange}
          placeholder="Enter announcement title..."
          className="border border-gray-300 rounded-lg p-3 mb-4 text-lg font-semibold"
        />
        
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
        
        {        /* Editor */}
        <StyledRichEditor
          className="min-h-64 border border-gray-300 border-t-0 rounded-b-lg p-2 bg-white"
          placeholder="Start writing your announcement..."
          initialHeight={300}
          ref={richText}
          onChange={handleContentChange}
          onEditorInitialized={() => {
            // This callback is triggered when the editor is fully initialized
            // Set content here as an additional safety measure
            if (richText.current && initialContent) {
              console.log("Editor initialized, setting content:", initialContent);
              richText.current.setContentHTML(initialContent);
            }
          }}
          editorStyle={{
            contentCSSText: `
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 16px;
              padding: 8px;
            `
          }}
        />
        
        {/* Action Buttons */}
        <View className="flex-row justify-between mt-6 space-x-3">
          <TouchableOpacity 
            className="bg-gray-200 py-3 px-6 rounded-lg flex-1"
            onPress={() => {
              if (richText.current) {
                richText.current.setContentHTML('');
                setDraftContent('');
                setDraftTitle('');
              }
            }}
          >
            <Text className="text-gray-800 text-center font-semibold">Clear All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-blue-600 py-3 px-6 rounded-lg flex-1"
            onPress={toggleModal}
          >
            <Text className="text-white text-center font-semibold">Preview</Text>
          </TouchableOpacity>
        </View>
        
        {/* Draft status indicator */}
        {isDraft && hasUnsavedChanges && (
          <View className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Text className="text-yellow-800 text-center">
              ⚠️ You have unsaved changes
            </Text>
          </View>
        )}
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
            <Text className="text-xl font-bold">Preview</Text>
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
                  toggleModal();
                  handleCreateAnnouncement();
                }}
                disabled={isPublishing}
              >
                <Text className="text-white">
                  {isPublishing 
                    ? 'Publishing...' 
                    : (isDraft ? 'Publish' : (announcementId ? 'Update' : 'Publish'))
                  }
                </Text>
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