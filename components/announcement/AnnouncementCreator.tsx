//AnnouncementCreator.tsx
import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo  } from 'react';
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
import { RichText, Toolbar, useEditorBridge, DEFAULT_TOOLBAR_ITEMS } from '@10play/tentap-editor';
import { cssInterop } from "nativewind";
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
// Import utilities and components
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import AnnouncementMediaUploader from '@/components/texteditor/AnnouncementMediaUploader';
import { router } from 'expo-router';

// Filter default toolbar items to only include allowed buttons
const allowedToolbarItems = DEFAULT_TOOLBAR_ITEMS.filter((_, index) => {
  return [0, 1, 4, 6, 7, 9, 10, 11, 12, 13, 14].includes(index);
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
  announcementStatus?: string;
  hasCoverImage?: boolean;
}

export default function AnnouncementCreator({
  initialTitle = '',
  initialContent = '',
  announcementId,
  roomId,
  onExit,
  announcementMode,
  announcementStatus,
}: AnnouncementCreatorProps) {
  // Memoize initial values to prevent unnecessary re-renders
  const memoizedInitialContent = useMemo(() => initialContent, []);
  const memoizedInitialTitle = useMemo(() => initialTitle, []);

  // Tentap Editor Bridge
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: false,
    initialContent: memoizedInitialContent,
    dynamicHeight: true,
  });
  const titleInputRef = useRef<TextInput>(null);
  const currentTitleRef = useRef<string>(initialTitle);
  const editorInitializedRef = useRef<boolean>(false);
  const contentSetRef = useRef<boolean>(false);
  const editorContainerRef = useRef<View>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Form data states
  const [draftContent, setDraftContent] = useState<string>(memoizedInitialContent);
  const [draftTitle, setDraftTitle] = useState<string>(memoizedInitialTitle);

  // Media files states
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);

  // UI states
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // Button loading states
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // User data
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");

  // Tentap editor content setter
  const setEditorContent = useCallback(async (content: string) => {
    if (!content || content.trim() === '') {
      return;
    }
    try {
      editor.setContent(content);
      contentSetRef.current = true;
    } catch (error) {
      console.log('Error setting content:', error);
    }
  }, [editor]);

  // Tentap editor initialization handler
  const handleEditorInitialized = useCallback(() => {
    console.log('Tentap editor initialized');
    editorInitializedRef.current = true;
    setIsEditorReady(true);

    // Inject CSS to fix line spacing
    if (editor.webviewRef.current) {
      const cssInjection = `
        const style = document.createElement('style');
        style.textContent = \`
          .ProseMirror {
            line-height: 1.4 !important;
          }
          .ProseMirror p {
            margin: 0 0 0.5em 0 !important;
            line-height: 1.4 !important;
          }
          .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 {
            margin: 0.5em 0 0.25em 0 !important;
            line-height: 1.3 !important;
          }
          .ProseMirror ul, .ProseMirror ol {
            margin: 0.5em 0 !important;
            padding-left: 1.5em !important;
          }
          .ProseMirror li {
            margin: 0.25em 0 !important;
            line-height: 1.4 !important;
          }
          .ProseMirror br {
            line-height: 1.4 !important;
          }
        \`;
        document.head.appendChild(style);
      `;
      
      setTimeout(() => {
        editor.webviewRef.current?.injectJavaScript(cssInjection);
      }, 100);
    }

    // Set content immediately if needed
    if (memoizedInitialContent && memoizedInitialContent.trim() !== '' && !contentSetRef.current) {
      setEditorContent(memoizedInitialContent);
    }
  }, [memoizedInitialContent, setEditorContent, editor]);

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

  // Backup content setting mechanism - immediate without timeout
  useEffect(() => {
    if (isEditorReady && memoizedInitialContent && memoizedInitialContent.trim() !== '' && !contentSetRef.current) {
      console.log('Backup content setting triggered');
      setEditorContent(memoizedInitialContent);
    }
  }, [isEditorReady, memoizedInitialContent, setEditorContent]);

  // Final failsafe for content setting - immediate without timeout
  useEffect(() => {
    if (isEditorReady && memoizedInitialContent && memoizedInitialContent.trim() !== '' && !contentSetRef.current) {
      try {
        const currentContentPromise = editor.getHTML();
        currentContentPromise.then(currentContent => {
          const cleanCurrent = currentContent.replace(/<p><br><\/p>/g, '').trim();

          if (cleanCurrent === '<p></p>' || cleanCurrent === '') {
            console.log('Final failsafe: Setting content');
            editor.setContent(memoizedInitialContent);
            contentSetRef.current = true;
          }
        }).catch(error => {
          console.log('Final failsafe error:', error);
        });
      } catch (error) {
        console.log('Final failsafe error:', error);
      }
    }
  }, [isEditorReady, memoizedInitialContent, editor]);

  const useKeyboardHeight = () => {
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
      const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const showSub = Keyboard.addListener(showEvt, e =>
        setKeyboardHeight(e.endCoordinates.height),
      );
      const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    return keyboardHeight;
  };
  const keyboardHeightRef = useKeyboardHeight();

  // Replace your existing keyboard useEffect with this:
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
        setIsEditorFocused(false);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Emergency failsafe for editor initialization - immediate without timeout
  useEffect(() => {
    if (!isEditorReady && !editorInitializedRef.current) {
      console.log('Emergency failsafe: Setting editor as ready');
      setIsEditorReady(true);

      if (memoizedInitialContent && memoizedInitialContent.trim() !== '' && !contentSetRef.current) {
        setEditorContent(memoizedInitialContent);
      }
    }
  }, [memoizedInitialContent, setEditorContent]);

  // Inject CSS when editor is ready
  useEffect(() => {
    if (isEditorReady && editor.webviewRef.current) {
      const cssInjection = `
        const style = document.createElement('style');
        style.textContent = \`
          .ProseMirror {
            line-height: 1.4 !important;
          }
          .ProseMirror p {
            margin: 0 0 0.5em 0 !important;
            line-height: 1.4 !important;
          }
          .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 {
            margin: 0.5em 0 0.25em 0 !important;
            line-height: 1.3 !important;
          }
          .ProseMirror ul, .ProseMirror ol {
            margin: 0.5em 0 !important;
            padding-left: 1.5em !important;
          }
          .ProseMirror li {
            margin: 0.25em 0 !important;
            line-height: 1.4 !important;
          }
          .ProseMirror br {
            line-height: 1.4 !important;
          }
        \`;
        document.head.appendChild(style);
      `;
      
      setTimeout(() => {
        editor.webviewRef.current?.injectJavaScript(cssInjection);
      }, 200);
    }
  }, [isEditorReady, editor]);

  const handleContentChange = useCallback(() => {
    // Tentap editor content changes are handled internally
    // We'll get content when needed via getCurrentContent
  }, []);

  const handleTitleChange = useCallback((text: string) => {
    setDraftTitle(text);
    currentTitleRef.current = text;
  }, []);

  const getCurrentContent = async () => {
    let currentContent = '';
    try {
      currentContent = await editor.getHTML();
    } catch (error) {
      console.log("Could not get content from Tentap editor");
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
          announcementStatus: announcementStatus,
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

            {/* Editor Loading State - Simplified */}
            {!isEditorReady && (
              <View className="min-h-80 flex items-center justify-center">
                <ActivityIndicator size="large" color="#0284c7" />
                <Text className="text-gray-500 mt-2">Preparing editor...</Text>
              </View>
            )}

            {/* Tentap Rich Text Editor */}
            <View
              ref={editorContainerRef}
              className={isEditorReady ? 'block' : 'hidden'}
            >
              {/* Editor - Remove toolbar from here */}
              <View
                className="min-h-[300px]"
                onTouchStart={() => {
                  setIsEditorFocused(true);
                  editor.focus();
                }}
              >
                <RichText
                  editor={editor}
                  className="min-h-[300px]"
                />
              </View>
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

      </KeyboardAvoidingView>
      {isEditorFocused && (
        <View
          style={
            {
              position: 'absolute',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              zIndex: 9999,
              bottom: 0
            }
          }
        >
          <Toolbar editor={editor} items={allowedToolbarItems} />
        </View>
      )}
    </View>
  );
  
}
