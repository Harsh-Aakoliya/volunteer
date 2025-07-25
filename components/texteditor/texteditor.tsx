import React, { useRef, forwardRef, useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Dimensions, Modal, SafeAreaView, StatusBar, BackHandler, Image, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import WebView from 'react-native-webview';
import { TextInput, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';
import axios from 'axios';
import AnnouncementMediaUploader from './AnnouncementMediaUploader';
// Update the interface
interface RichTextEditorProps {
  initialTitle?: string;
  initialContent?: string;
  announcementId?: number;
  announcementMode?: string;
  draftId?: number;
  coverImage?: string;
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
  coverImage 
}) => {
    // console.log("initialContent", initialContent);
    // console.log("initialTitle", initialTitle);
  // State variables
  const richText = useRef<RichEditor>(null);
  const titleInputRef = useRef<TextInput>(null);
  const currentTitleRef = useRef<string>(initialTitle);
  const [content, setContent] = useState<string>(initialContent);
  const [title, setTitle] = useState<string>(initialTitle);
  const [draftContent, setDraftContent] = useState<string>(initialContent);
  const [draftTitle, setDraftTitle] = useState<string>(initialTitle);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeletingDraft, setIsDeletingDraft] = useState<boolean>(false);
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const isFresh = announcementMode === 'new';
  const isDraft = announcementMode === 'draft';
  const isEdit = announcementMode === 'edit';
  const [isUploadingCover, setIsUploadingCover] = useState<boolean>(false);
  const [coverImageUri, setCoverImageUri] = useState<string>('');
  const [hasCoverImage, setHasCoverImage] = useState<boolean>(false);
  console.log("coverImage", coverImage);
  
  // Initialize cover image state
  useEffect(() => {
    if (coverImage === 'true' || coverImage === 'TRUE') {
      setHasCoverImage(true);
      // Use a generic coverimage.jpg path with cache busting for custom images
      setCoverImageUri(`${API_URL}/media/announcement/${announcementId}/coverimage.jpg?t=${Date.now()}`);
    } else {
      setHasCoverImage(false);
      setCoverImageUri(`${API_URL}/media/defaultcoverimage.png`);
    }
  }, [coverImage, announcementId]);
  
  // Initialize state and user ID
  useEffect(() => {
    console.log("Initializing with:", { initialTitle, initialContent, announcementMode });
    setTitle(initialTitle);
    setContent(initialContent);
    setDraftTitle(initialTitle);
    setDraftContent(initialContent);
    currentTitleRef.current = initialTitle;
  }, [initialTitle, initialContent, announcementMode]);


  // Set content when editor becomes ready
  useEffect(() => {
    if (isEditorReady && richText.current && initialContent) {
      console.log("Setting content in editor:", initialContent);
      // Try multiple times to ensure content is set
      const setContentWithRetry = (attempts = 0) => {
        if (attempts >= 3) return;
        
        setTimeout(() => {
          if (richText.current) {
            try {
              richText.current.setContentHTML(initialContent);
              console.log("Content set successfully on attempt:", attempts + 1);
            } catch (error) {
              console.log("Failed to set content, retrying...", error);
              setContentWithRetry(attempts + 1);
            }
          }
        }, 100 + (attempts * 100)); // Increasing delay for each retry
      };
      
      setContentWithRetry();
    }
  }, [isEditorReady, initialContent]);

  useEffect(() => {
    const getUserId = async () => {
      const user = await AuthStorage.getUser();
      if (user) {
        setCurrentUserId(user.userId);
      }
    };
    getUserId();
  }, []);

  // Handle keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Failsafe: If editor doesn't initialize within 2 seconds, set it as ready
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isEditorReady) {
        console.log("Editor initialization timeout - setting as ready");
        setIsEditorReady(true);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isEditorReady]);

  // Add state to prevent duplicate operations

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

  // Helper function to get current content from editor and title input
  const getCurrentContent = async () => {
    // Get current content from the editor
    let currentContent = draftContent;
    if (richText.current) {
      try {
        currentContent = await richText.current.getContentHtml();
      } catch (error) {
        console.log("Could not get content from editor, using state value");
      }
    }

    // Get current title from the ref (updated immediately on input change)
    const currentTitle = currentTitleRef.current;

    return { currentTitle, currentContent };
  };

  const handleSaveProgress = async () => {
    if (!announcementId || !currentUserId) return;

    try {
      setIsSaving(true);
      
      const { currentTitle, currentContent } = await getCurrentContent();
      
      console.log("saving draft", currentTitle, currentContent, currentUserId);
      await updateDraft(announcementId, currentTitle, currentContent, currentUserId);
      
      // Update the main content to match draft content
      setTitle(currentTitle);
      setContent(currentContent);
      setDraftTitle(currentTitle);
      setDraftContent(currentContent);
      setHasUnsavedChanges(false);
      Alert.alert('Success', 'Progress saved successfully!');
    } catch (error) {
      console.error('Error saving progress:', error);
      Alert.alert('Error', 'Failed to save progress. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWithCurrentContent = async (title: string, content: string) => {
    if (!announcementId || !currentUserId) return;

    try {
      setIsSaving(true);
      console.log("saving draft with current content", title, content, currentUserId);
      await updateDraft(announcementId, title, content, currentUserId);
      
      // Update all state variables
      setTitle(title);
      setContent(content);
      setDraftTitle(title);
      setDraftContent(content);
      setHasUnsavedChanges(false);
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
    
    if (isFresh) {
      // New announcement flow - get current content from editor
      const { currentTitle, currentContent } = await getCurrentContent();
      
      const hasContent = currentTitle.trim() !== '' || currentContent.trim() !== '';
      
      if (!hasContent) {
        // User hasn't written anything - delete draft from DB
        await handleDeleteDraft();
      } else {
        // User has written something - show alert
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved changes. What would you like to do?",
          [
            {
              text: "Discard changes and exit",
              style: "destructive",
              onPress: async () => {
                await handleDeleteDraft();
              }
            },
            {
              text: "Move to draft and exit",
              onPress: async () => {
                // Save directly with current content
                await handleSaveWithCurrentContent(currentTitle, currentContent);
                router.replace('/announcement');
              }
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
      }
    } else if (isDraft) {
      // Draft editing flow - get current content from editor
      const { currentTitle, currentContent } = await getCurrentContent();
      
      const hasContentChanges = currentTitle !== title || currentContent !== content;
      
      if (!hasContentChanges) {
        // No changes made - go back to draft list
        router.replace('../../draft-list');
      } else {
        // Changes made - show alert
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved changes. What would you like to do?",
          [
            {
              text: "Save draft and exit",
              onPress: async () => {
                await handleSaveWithCurrentContent(currentTitle, currentContent);
                router.replace('../../draft-list');
              }
            },
            {
              text: "Discard changes and exit",
              style: "destructive",
              onPress: () => {
                router.replace('../../draft-list');
              }
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
      }
    } else if (isEdit) {
      // Edit published announcement flow - get current content from editor
      const { currentTitle, currentContent } = await getCurrentContent();
      
      const hasContentChanges = currentTitle !== title || currentContent !== content;
      
      if (!hasContentChanges) {
        // No changes made - go back to announcement screen
        router.replace('/announcement');
      } else {
        // Changes made - show alert
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved changes. What would you like to do?",
          [
            {
              text: "Discard changes and exit",
              style: "destructive",
              onPress: () => {
                router.replace('/announcement');
              }
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
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
    currentTitleRef.current = text; // Update ref immediately
  }, []);

  // // Handle cover image selection
  // const handleSelectCoverImage = async () => {
  //   try {
  //     const result = await DocumentPicker.getDocumentAsync({
  //       type: 'image/*',
  //       copyToCacheDirectory: true,
  //     });

  //     if (result.canceled || !result.assets[0]) {
  //       return;
  //     }

  //     const asset = result.assets[0];
  //     setIsUploadingCover(true);

  //     try {
  //       // Read the file as base64
  //       const base64 = await FileSystem.readAsStringAsync(asset.uri, {
  //         encoding: FileSystem.EncodingType.Base64,
  //       });

  //       // For now, just set the local URI - we'll upload when publishing
  //       setCoverImageUri(asset.uri);
  //       setCoverImage(base64); // Store base64 for upload later
        
  //       Alert.alert('Success', 'Cover image selected successfully!');
  //     } catch (error) {
  //       console.error('Error reading image file:', error);
  //       Alert.alert('Error', 'Failed to process the selected image.');
  //     } finally {
  //       setIsUploadingCover(false);
  //     }
  //   } catch (error) {
  //     console.error('Error selecting image:', error);
  //     Alert.alert('Error', 'Failed to select image.');
  //     setIsUploadingCover(false);
  //   }
  // };
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);
  
  const handleSelectCoverImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: ["image/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      
      // Check if it's an image
      if (!asset.mimeType?.startsWith('image/')) {
        Alert.alert("Invalid File", "Please select an image file only.");
        return;
      }

      setIsUploadingCover(true);
      setUploadProgress(0);

      try {
        // Read file as base64
        const fileData = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        setUploadProgress(30);

        const fileToUpload = {
          name: asset.name,
          mimeType: asset.mimeType || "image/jpeg",
          fileData,
        };

        setUploadProgress(50);

        const token = await AuthStorage.getToken();
        const response = await axios.post(
          `${API_URL}/api/announcements/cover-image`,
          {
            files: [fileToUpload],
            announcementId: announcementId
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        setUploadProgress(80);

        if (response.data.success) {
          // Update the cover image URI to the uploaded file (always saved as .jpg)
          const newImageUri = `${API_URL}/media/announcement/${announcementId}/coverimage.jpg?t=${Date.now()}`;
          setCoverImageUri(newImageUri);
          setHasCoverImage(true);
          setUploadProgress(100);
          
          Alert.alert("Success", "Cover image uploaded successfully!");
        } else {
          throw new Error("Upload failed");
        }

      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Upload failed", "There was an error uploading your cover image.");
        // Reset to default image on error
        setCoverImageUri(`${API_URL}/media/defaultcoverimage.png`);
        setHasCoverImage(false);
      } finally {
        setIsUploadingCover(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error("File selection error:", error);
      setIsUploadingCover(false);
    }
  };



  // Handle publishing/updating announcement
  const handlePublishAnnouncement = async () => {
    // Get current content from the editor and title
    const { currentTitle, currentContent } = await getCurrentContent();
    
    if (!currentTitle.trim() || !currentContent.trim()) {
      Alert.alert('Error', 'Title and Body cannot be empty.');
      return;
    }
    
    try {
      setIsPublishing(true);
      let result;
      
      if (isFresh || isDraft) {
        // Publish draft (either new or existing draft)
        result = await publishDraft(announcementId as number, currentTitle, currentContent, currentUserId);
        console.log("Published draft:", result);
        
        // Cover image is already uploaded during selection, no need to upload again
        
        // Navigate back to announcement screen
        router.replace('/announcement');
      } else if (isEdit) {
        // Update existing published announcement
        result = await updateAnnouncement(announcementId, currentTitle, currentContent);
        console.log("Updated announcement:", result);
        
        // Cover image is already uploaded during selection, no need to upload again
        
        // Navigate back to announcement screen
        router.replace('/announcement');
      }
      
      setTitle('');
      setContent('');
      setDraftTitle('');
      setDraftContent('');
      setHasUnsavedChanges(false);
      
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
    const mediaFilesHTML = attachedMediaFiles.length > 0 ? `
      <div class="media-attachments">
        <h3 style="margin-top: 24px; margin-bottom: 16px; color: #374151;">Attached Media Files</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
          ${attachedMediaFiles.map(file => {
            if (file.mimeType.startsWith('image/')) {
              return `<div style="text-align: center;">
                <img src="${API_URL}/media/announcement/${announcementId}/media/${file.fileName}" 
                     style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
                <p style="font-size: 12px; color: #6b7280; margin: 0;">${file.originalName}</p>
              </div>`;
            } else if (file.mimeType.startsWith('video/')) {
              return `<div style="text-align: center; background: #fee2e2; padding: 16px; border-radius: 8px;">
                <div style="font-size: 24px; margin-bottom: 8px;">🎬</div>
                <p style="font-size: 12px; color: #6b7280; margin: 0;">${file.originalName}</p>
              </div>`;
            } else if (file.mimeType.startsWith('audio/')) {
              return `<div style="text-align: center; background: #f3e8ff; padding: 16px; border-radius: 8px;">
                <div style="font-size: 24px; margin-bottom: 8px;">🎵</div>
                <p style="font-size: 12px; color: #6b7280; margin: 0;">${file.originalName}</p>
              </div>`;
            }
            return '';
          }).join('')}
        </div>
      </div>
    ` : '';

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
          ${mediaFilesHTML}
        </body>
      </html>
    `;
  }, [draftContent, draftTitle, attachedMediaFiles, announcementId]);

  // Toggle modal visibility
  const toggleModal = () => {
    setModalVisible(!modalVisible);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header with back button and centered title */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity
          onPress={handleGoBack}
          className="p-2"
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Announcement' : isDraft ? 'Draft Announcement' : 'New Announcement'}
        </Text>
        
        <View className="w-8" />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 py-4">
          {/* Title Input */}
          <TextInput
            ref={titleInputRef}
            value={draftTitle}
            onChangeText={handleTitleChange}
            placeholder="Enter announcement title..."
            className="text-xl font-semibold text-gray-900 py-3 border-b border-gray-200 mb-4"
            style={{ borderWidth: 0, borderBottomWidth: 1 }}
          />
          
          {/* Editor - now without toolbar, matching title padding */}
          {!isEditorReady && (
            <View className="min-h-80 rounded-lg p-2 bg-gray-50 flex items-center justify-center mt-4" style={{ marginLeft: 0, paddingLeft: 0 }}>
              <Text className="text-gray-500">Loading editor...</Text>
            </View>
          )}
          
          {isEditorReady && (
            <StyledRichEditor
              className="min-h-80 rounded-lg bg-white mt-4"
              placeholder="Start writing your announcement..."
              initialHeight={400}
              ref={richText}
              onChange={handleContentChange}
              androidHardwareAccelerationDisabled={true}
              androidLayerType="software"
              onEditorInitialized={() => {
                console.log("Editor initialized callback triggered");
                setIsEditorReady(true);
                
                // Set content after editor is ready with retry logic
                if (initialContent) {
                  console.log("Setting content on initialization:", initialContent);
                  const setContentWithRetry = (attempts = 0) => {
                    if (attempts >= 5) return;
                    
                    setTimeout(() => {
                      if (richText.current) {
                        try {
                          richText.current.setContentHTML(initialContent);
                          console.log("Content set successfully in callback on attempt:", attempts + 1);
                        } catch (error) {
                          console.log("Failed to set content in callback, retrying...", error);
                          setContentWithRetry(attempts + 1);
                        }
                      }
                    }, 200 + (attempts * 100));
                  };
                  
                  setContentWithRetry();
                }
              }}
              editorStyle={{
                contentCSSText: `
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  padding: 12px 0px;
                  margin: 0px;
                  border: none;
                `
              }}
            />
          )}
        
        {/* Cover Image Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Cover Image</Text>
          <View className="items-center">
            <TouchableOpacity
              onPress={handleSelectCoverImage}
              disabled={isUploadingCover}
              className="relative"
            >
              {/* Square Cover Image - 150x150 */}
              <View className="w-[150px] h-[150px] bg-gray-200 rounded-lg overflow-hidden">
                <Image
                  source={{ uri: coverImageUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                
                {/* Upload Progress Overlay */}
                {isUploadingCover && (
                  <View className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <View className="bg-white bg-opacity-90 p-4 rounded-lg items-center">
                      <Text className="text-gray-800 text-sm mb-2">Uploading...</Text>
                      <View className="w-32 h-2 bg-gray-300 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </View>
                      <Text className="text-gray-600 text-xs mt-1">{uploadProgress}%</Text>
                    </View>
                  </View>
                )}
              </View>
              
              <Text className="text-sm text-gray-600 mt-2 text-center">
                {hasCoverImage ? 'Tap to change cover image' : 'Tap to add cover image'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Media Attachments Section */}
        {announcementId && (
          <AnnouncementMediaUploader 
            announcementId={announcementId}
            onMediaChange={setAttachedMediaFiles}
          />
        )}
        
        {/* Action Buttons */}
        <View className="flex-row justify-between mt-6 space-x-3">
          <TouchableOpacity 
            className="bg-gray-200 py-3 px-6 rounded-lg flex-1"
            onPress={() => {
              if (richText.current) {
                richText.current.setContentHTML('');
                setDraftContent('');
                setDraftTitle('');
                currentTitleRef.current = '';
                if (titleInputRef.current) {
                  titleInputRef.current.clear();
                }
              }
            }}
          >
            <Text className="text-gray-800 text-center font-semibold">Clear All</Text>
          </TouchableOpacity>
          
          {/* Save Progress Button (only for drafts) */}
          {isDraft && (
            <TouchableOpacity
              onPress={handleSaveProgress}
              disabled={isSaving || !hasUnsavedChanges}
              className={`py-3 px-6 rounded-lg flex-1 ${
                hasUnsavedChanges && !isSaving 
                  ? 'bg-blue-500' 
                  : 'bg-gray-300'
              }`}
            >
              <Text className={`text-center font-semibold ${
                hasUnsavedChanges && !isSaving 
                  ? 'text-white' 
                  : 'text-gray-500'
              }`}>
                {isSaving ? 'Saving...' : 'Save Progress'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            className="bg-blue-600 py-3 px-6 rounded-lg flex-1"
            onPress={toggleModal}
          >
            <Text className="text-white text-center font-semibold">Preview</Text>
          </TouchableOpacity>
        </View>
        
          {/* Draft status indicator */}
          {hasUnsavedChanges && (isDraft || isFresh) && (
            <View className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Text className="text-yellow-800 text-center">
                ⚠️ You have unsaved changes
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Floating Toolbar - only visible when keyboard is shown */}
        {isKeyboardVisible && (
          <View 
            className="absolute left-0 right-0 bg-white border-t border-gray-300 shadow-lg"
            style={{ bottom: keyboardHeight }}
          >
            <StyledRichToolbar
              editor={richText}
              className="bg-white"
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
          </View>
        )}
      </KeyboardAvoidingView>

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
                  handlePublishAnnouncement();
                }}
                disabled={isPublishing}
              >
                <Text className="text-white">
                  {isPublishing 
                    ? 'Publishing...' 
                    : (isEdit ? 'Publish Changes' : 'Publish')
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