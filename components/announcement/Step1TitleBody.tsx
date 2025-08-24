import React, { useRef, useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Keyboard,
  ScrollView,
  Dimensions
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import { Ionicons } from '@expo/vector-icons';

// Create forwarded ref components
const ForwardedRichEditor = React.forwardRef<RichEditor, any>((props, ref) => (
  <RichEditor {...props} ref={ref} />
));

const StyledRichEditor = cssInterop(ForwardedRichEditor, {
  className: 'style'
});

const StyledRichToolbar = cssInterop(RichToolbar, {
  className: 'style'
});

interface Step1TitleBodyProps {
  initialTitle: string;
  initialContent: string;
  onNext: (title: string, content: string) => void;
  onBack: () => void;
  isEdit?: boolean;
}

export default function Step1TitleBody({ 
  initialTitle, 
  initialContent, 
  onNext, 
  onBack,
  isEdit = false
}: Step1TitleBodyProps) {
  const richText = useRef<RichEditor>(null);
  const titleInputRef = useRef<TextInput>(null);
  const currentTitleRef = useRef<string>(initialTitle);
  const [content, setContent] = useState<string>(initialContent);
  const [title, setTitle] = useState<string>(initialTitle);
  const [draftContent, setDraftContent] = useState<string>(initialContent);
  const [draftTitle, setDraftTitle] = useState<string>(initialTitle);
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Initialize state and user ID (matching original texteditor.tsx)
  useEffect(() => {
    console.log("Initializing with:", { initialTitle, initialContent });
    setTitle(initialTitle);
    setContent(initialContent);
    setDraftTitle(initialTitle);
    setDraftContent(initialContent);
    currentTitleRef.current = initialTitle;
  }, [initialTitle, initialContent]);

  // Set content when editor becomes ready (matching original texteditor.tsx)
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

  // Handle keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Failsafe: If editor doesn't initialize within 2 seconds, set it as ready (matching original)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isEditorReady) {
        console.log("Editor initialization timeout - setting as ready");
        setIsEditorReady(true);
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [isEditorReady]);

  // Handle content change (matching original texteditor.tsx)
  const handleContentChange = useCallback((html: string) => {
    setDraftContent(html);
  }, []);

  // Handle title change (matching original texteditor.tsx)
  const handleTitleChange = useCallback((text: string) => {
    setDraftTitle(text);
    currentTitleRef.current = text; // Update ref immediately
  }, []);

  // Helper function to get current content from editor and title input (matching original)
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

  const handleNext = async () => {
    const { currentTitle, currentContent } = await getCurrentContent();
    onNext(currentTitle.trim(), currentContent.trim());
  };

  const isFormValid = draftTitle.trim() !== '' && draftContent.trim() !== '';

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white z-10">
        <TouchableOpacity onPress={onBack} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Content' : 'Create Announcement'}
        </Text>
        
        <View className="w-8" />
      </View>

      {/* Step indicator */}
      <View className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <Text className="text-blue-800 font-medium text-center">Step 1 of 4: Content</Text>
        <Text className="text-blue-600 text-sm text-center mt-1">Write your announcement title and body</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView className="flex-1 px-4 py-4">
          {/* Title Input - matching original texteditor style */}
          <TextInput
            ref={titleInputRef}
            value={draftTitle}
            onChangeText={handleTitleChange}
            placeholder="Enter announcement title..."
            className="text-3xl font-semibold text-gray-900 py-3"
            placeholderTextColor="#9ca3af"
            multiline
          />
          
          {/* Editor - matching original texteditor style */}
          {!isEditorReady && (
            <View className="min-h-80 rounded-lg p-2 bg-gray-50 flex items-center justify-center mt-4" style={{ marginLeft: 0, paddingLeft: 0 }}>
              <Text className="text-gray-500">Loading editor...</Text>
            </View>
          )}
          
          {isEditorReady && (
            <StyledRichEditor
              className="min-h-80 rounded-lg bg-white"
              placeholder="Tap Here to Start Writing"
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
        </ScrollView>

        {/* Floating Toolbar - only visible when keyboard is shown (matching original) */}
        {isKeyboardVisible && (
          <View 
            className="left-0 right-0 bg-white border-t border-gray-300 shadow-lg"
            style={{ bottom: 0 }}
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

        {/* Validation Notice and Next Button */}
        <View className="p-4 bg-white border-t border-gray-200">
          {!isFormValid && (
            <View className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <View className="flex-row items-center">
                <Ionicons name="warning" size={16} color="#ea580c" />
                <Text className="text-orange-800 font-medium ml-2">Required fields</Text>
              </View>
              <Text className="text-orange-700 text-sm mt-1">
                Both title and content are required to continue.
              </Text>
            </View>
          )}
          
          <TouchableOpacity
            onPress={handleNext}
            disabled={!isFormValid}
            className={`py-3 px-6 rounded-lg ${
              isFormValid 
                ? 'bg-blue-600' 
                : 'bg-gray-300'
            }`}
          >
            <Text className={`text-center font-semibold ${
              isFormValid 
                ? 'text-white' 
                : 'text-gray-500'
            }`}>
              Next: Media & Cover
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
