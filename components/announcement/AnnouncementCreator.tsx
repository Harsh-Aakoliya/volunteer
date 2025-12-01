//AnnouncementCreator.tsx
import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
// Import utilities and components
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import AnnouncementMediaUploader from '@/components/texteditor/AnnouncementMediaUploader';
import { router } from 'expo-router';

// Create forwarded ref components for Pell Rich Editor
const ForwardedRichEditor = React.forwardRef<RichEditor, any>((props, ref) => (
  <RichEditor {...props} ref={ref} />
));

const StyledRichEditor = cssInterop(ForwardedRichEditor, {
  className: 'style'
});

const StyledRichToolbar = cssInterop(RichToolbar, {
  className: 'style'
});

const StyledWebView = cssInterop(WebView, {
  className: "style",
});

interface AnnouncementCreatorProps {
  initialTitle?: string;
  initialContent?: string;
  announcementId?: number;
  roomId?: string; // roomId if creating announcement from chat
  onExit: () => void;
  announcementMode?: string;
  hasCoverImage?: boolean;
}

export default function AnnouncementCreator({
  initialTitle = '',
  initialContent = '',
  announcementId,
  roomId,
  onExit,
  announcementMode,
}: AnnouncementCreatorProps) {
  // Memoize initial values to prevent unnecessary re-renders
  const memoizedInitialContent = useMemo(() => initialContent, []);
  const memoizedInitialTitle = useMemo(() => initialTitle, []);

  // Pell Rich Editor Ref
  const richText = useRef<RichEditor>(null);
  const titleInputRef = useRef<TextInput>(null);
  const currentTitleRef = useRef<string>(initialTitle);
  const editorInitializedRef = useRef<boolean>(false);
  const contentSetRef = useRef<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const lineCountRef = useRef<number>(0);

  // Form data states
  const [draftContent, setDraftContent] = useState<string>(memoizedInitialContent);
  const [draftTitle, setDraftTitle] = useState<string>(memoizedInitialTitle);

  // Media files states
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);

  // UI states
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [lineCount, setLineCount] = useState<number>(0);
  const [showLineWarning, setShowLineWarning] = useState(false);

  // Button loading states
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // User data
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");

  // Count lines in HTML content
  const countLines = (html: string): number => {
    if (!html) return 0;
    
    // Remove HTML tags
    const text = html.replace(/<[^>]*>/g, '');
    
    // Count newlines and paragraphs
    const lines = text.split('\n').length;
    const paragraphs = (html.match(/<p>/g) || []).length;
    const breaks = (html.match(/<br>/g) || []).length;
    
    return Math.max(lines, paragraphs, breaks);
  };

  // Pell editor content setter with retry mechanism
  const setEditorContent = useCallback(async (content: string, maxRetries = 10) => {
    if (!richText.current || !content || content.trim() === '' || contentSetRef.current) {
      return;
    }

    const attemptSetContent = async (attempt: number): Promise<boolean> => {
      if (attempt > maxRetries) {
        console.log(`Failed to set content after ${maxRetries} attempts`);
        return false;
      }

      try {
        if (!richText.current) return false;
        
        await richText.current.setContentHTML(content);
        
        // Wait and verify content was set
        await new Promise(resolve => setTimeout(resolve, 150));
        
        if (!richText.current) return false;
        
        const currentContent = await richText.current.getContentHtml();
        const cleanCurrent = currentContent.replace(/<p><br><\/p>/g, '').replace(/<br>/g, '').trim();
        const cleanExpected = content.replace(/<p><br><\/p>/g, '').replace(/<br>/g, '').trim();
        
        // Check if content was properly set
        if (cleanCurrent !== '<p></p>' && cleanCurrent !== '' && 
            (cleanExpected === '' || cleanCurrent.includes(cleanExpected.substring(0, 50)))) {
          console.log(`Content set successfully on attempt ${attempt}`);
          contentSetRef.current = true;
          
          // Update line count
          const lines = countLines(currentContent);
          setLineCount(lines);
          lineCountRef.current = lines;
          
          return true;
        }
        
        // Retry with exponential backoff
        const delay = Math.min(200 * Math.pow(1.5, attempt - 1), 2000);
        console.log(`Content verification failed on attempt ${attempt}, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return attemptSetContent(attempt + 1);
      } catch (error) {
        console.log(`Error setting content on attempt ${attempt}:`, error);
        const delay = Math.min(300 * Math.pow(1.5, attempt - 1), 2000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptSetContent(attempt + 1);
      }
    };

    return attemptSetContent(1);
  }, []);

  // Pell editor initialization handler
  const handleEditorInitialized = useCallback(() => {
    console.log('Pell Rich editor initialized');
    editorInitializedRef.current = true;
    
    // Set editor as ready after a short delay
    setTimeout(() => {
      setIsEditorReady(true);
      
      // Set content immediately after marking as ready
      if (memoizedInitialContent && memoizedInitialContent.trim() !== '' && !contentSetRef.current) {
        setTimeout(() => {
          setEditorContent(memoizedInitialContent);
        }, 100);
      }
    }, 200);
  }, [memoizedInitialContent, setEditorContent]);

  // Initialize user data
  useEffect(() => {
    const initializeData = async () => {
      const user = await AuthStorage.getUser();
      if (user) {
        setCurrentUserId(user.userId);
        setCurrentUserName(user.fullName || 'User');
      }
    };

    initializeData();
  }, []);

  // Set initial form values once
  useEffect(() => {
    currentTitleRef.current = memoizedInitialTitle;
  }, [memoizedInitialTitle]);

  // Backup content setting mechanism
  useEffect(() => {
    if (isEditorReady && memoizedInitialContent && memoizedInitialContent.trim() !== '' && !contentSetRef.current) {
      const backupTimeout = setTimeout(() => {
        if (!contentSetRef.current) {
          console.log('Backup content setting triggered');
          setEditorContent(memoizedInitialContent);
        }
      }, 1000);

      return () => clearTimeout(backupTimeout);
    }
  }, [isEditorReady, memoizedInitialContent, setEditorContent]);

  // Final failsafe for content setting
  useEffect(() => {
    if (isEditorReady && memoizedInitialContent && memoizedInitialContent.trim() !== '') {
      const finalTimeout = setTimeout(async () => {
        if (!contentSetRef.current && richText.current) {
          try {
            const currentContent = await richText.current.getContentHtml();
            const cleanCurrent = currentContent.replace(/<p><br><\/p>/g, '').trim();
            
            if (cleanCurrent === '<p></p>' || cleanCurrent === '') {
              console.log('Final failsafe: Setting content');
              await richText.current.setContentHTML(memoizedInitialContent);
              contentSetRef.current = true;
            }
          } catch (error) {
            console.log('Final failsafe error:', error);
          }
        }
      }, 3000);

      return () => clearTimeout(finalTimeout);
    }
  }, [isEditorReady, memoizedInitialContent]);

  // Handle keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Emergency failsafe for editor initialization
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isEditorReady && !editorInitializedRef.current) {
        console.log('Emergency failsafe: Setting editor as ready');
        setIsEditorReady(true);
        
        if (memoizedInitialContent && memoizedInitialContent.trim() !== '' && !contentSetRef.current) {
          setTimeout(() => {
            setEditorContent(memoizedInitialContent);
          }, 500);
        }
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [memoizedInitialContent, setEditorContent]);

  const handleContentChange = useCallback(async (html: string) => {
    setDraftContent(html);
    
    // Count lines
    const lines = countLines(html);
    setLineCount(lines);
    lineCountRef.current = lines;
    
    // Show warning if approaching or at limit
    if (lines >= 35 && lines < 40) {
      setShowLineWarning(true);
    } else if (lines >= 40) {
      setShowLineWarning(true);
      // Prevent further input by alerting user
      if (lines > 40 && richText.current) {
        Alert.alert(
          'Line Limit Reached',
          'You have reached the maximum of 40 lines. Please remove some content to continue.',
          [{ text: 'OK' }]
        );
      }
    } else {
      setShowLineWarning(false);
    }
  }, []);

  const handleTitleChange = useCallback((text: string) => {
    setDraftTitle(text);
    currentTitleRef.current = text;
  }, []);

  const getCurrentContent = async () => {
    let currentContent = draftContent;
    if (richText.current) {
      try {
        currentContent = await richText.current.getContentHtml();
      } catch (error) {
        console.log("Could not get content from editor, using state value");
      }
    }
    console.log("currentContent here in getCurrentContent", currentContent);

    const currentTitle = currentTitleRef.current;
    return { currentTitle, currentContent };
  };

  const handlePreview = async () => {
    if (isLoadingPreview) return;

    // Validate that title is not empty
    if (!draftTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your announcement.');
      return;
    }

    try {
      setIsLoadingPreview(true);
      const { currentTitle, currentContent } = await getCurrentContent();

      // Navigate to preview route with current content
      router.push({
        pathname: "/preview",
        params: {
          title: currentTitle.trim(),
          content: currentContent.trim(),
          authorName: currentUserName,
          announcementId: announcementId,
          attachedMediaFiles: JSON.stringify(attachedMediaFiles),
          roomId: roomId, // Pass roomId to preview page
          announcementMode: announcementMode,
        }
      });
    } catch (error) {
      console.error('Error preparing preview:', error);
      Alert.alert('Error', 'Failed to prepare preview. Please try again.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const isFormValid = draftTitle.trim() !== '';

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white z-10">
        <TouchableOpacity onPress={onExit} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        <Text className="text-lg font-semibold text-gray-900">
          Create Announcement
        </Text>

        <View className="w-8" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4 py-2"
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
        >
          {/* Title and Body Section */}
          <View className="mb-4">
            {/* Title Input */}
            <TextInput
              ref={titleInputRef}
              value={draftTitle}
              onChangeText={handleTitleChange}
              placeholder="Enter announcement title..."
              className="text-xl font-semibold text-gray-900 py-2 mb-1"
              placeholderTextColor="#9ca3af"
              multiline={true}
              numberOfLines={3}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => setIsTitleFocused(false)}
            />

            {/* Editor Loading State */}
            {!isEditorReady && (
              <View className="min-h-80 p-4 bg-gray-50 flex items-center justify-center rounded-lg border border-gray-200">
                <ActivityIndicator size="large" color="#0284c7" />
                <Text className="text-gray-500 mt-2">Preparing editor...</Text>
              </View>
            )}

            {/* Line Count Warning */}
            {showLineWarning && lineCount < 40 && (
              <View className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-2">
                <Text className="text-yellow-800 text-sm">
                  ⚠️ Warning: You're approaching the 40-line limit ({lineCount}/40 lines)
                </Text>
              </View>
            )}
            
            {lineCount >= 40 && (
              <View className="bg-red-50 border border-red-300 rounded-lg p-3 mb-2">
                <Text className="text-red-800 text-sm font-semibold">
                  🚫 Line limit reached ({lineCount}/40 lines). Please remove some content.
                </Text>
              </View>
            )}

            {/* Pell Rich Text Editor */}
            <View className={isEditorReady ? 'block' : 'hidden'}>
              <StyledRichEditor
                className="min-h-80 bg-white"
                placeholder="Tap Here to Start Writing"
                initialHeight={400}
                ref={richText}
                onChange={handleContentChange}
                androidHardwareAccelerationDisabled={true}
                androidLayerType="software"
                onEditorInitialized={handleEditorInitialized}
                editorStyle={{
                  contentCSSText: `
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px;
                    margin: 0px;
                    border: none;
                    min-height: 300px;
                  `
                }}
              />
            </View>
          </View>

          {/* Media Files Section */}
          <View className="mb-8">
            <Text className="text-xl font-bold text-gray-900 mb-4">Attach Media Files <Text className="text-gray-500 font-normal">(optional)</Text></Text>

            <AnnouncementMediaUploader
              announcementId={announcementId!}
              onMediaChange={setAttachedMediaFiles}
            />
          </View>

          {/* Action Buttons - Preview */}
          <View className="p-4 bg-white border-t border-gray-200 mb-8">
            <TouchableOpacity
              onPress={handlePreview}
              disabled={!isFormValid || isLoadingPreview}
              className={`py-3 px-6 rounded-lg ${(isFormValid && !isLoadingPreview)
                ? 'bg-blue-600'
                : 'bg-gray-400'
                }`}
            >
              <Text className={`text-center font-bold text-white`}>
                {isLoadingPreview ? 'Loading...' : 'Preview'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Floating Toolbar - visible only when typing in body */}
        {isKeyboardVisible && !isTitleFocused && (
          <View 
            className="left-0 right-0 bg-white border-t border-gray-300 shadow-lg"
            style={{ bottom: 0 }}
          >
            <StyledRichToolbar
              editor={richText}
              className="bg-white"
              selectedIconTint="#2563EB"
              iconTint="#6B7280"
              actions={[
                actions.setBold,
                actions.setItalic,
                actions.setUnderline,
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.insertLink,
                actions.alignLeft,
                actions.alignCenter,
                actions.alignRight,
                actions.line,
                actions.undo,
                actions.redo,
              ]}
            />
          </View>
        )}

      </KeyboardAvoidingView>
    </View>
  );
}