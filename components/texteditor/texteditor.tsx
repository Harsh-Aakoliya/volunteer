import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Modal, SafeAreaView, StatusBar, BackHandler } from 'react-native';
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

// Custom Rich Text Editor Component
const CustomRichEditor = ({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (text: string) => void; 
  placeholder: string; 
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isList, setIsList] = useState(false);
  const [isOrderedList, setIsOrderedList] = useState(false);

  const applyFormat = (format: string) => {
    let newValue = value;
    
    switch (format) {
      case 'bold':
        if (isBold) {
          newValue = value.replace(/<strong>(.*?)<\/strong>/g, '$1');
        } else {
          newValue = value + '<strong>Selected Text</strong>';
        }
        setIsBold(!isBold);
        break;
      case 'italic':
        if (isItalic) {
          newValue = value.replace(/<em>(.*?)<\/em>/g, '$1');
        } else {
          newValue = value + '<em>Selected Text</em>';
        }
        setIsItalic(!isItalic);
        break;
      case 'underline':
        if (isUnderline) {
          newValue = value.replace(/<u>(.*?)<\/u>/g, '$1');
        } else {
          newValue = value + '<u>Selected Text</u>';
        }
        setIsUnderline(!isUnderline);
        break;
      case 'list':
        if (isList) {
          newValue = value.replace(/<ul>(.*?)<\/ul>/g, '$1');
        } else {
          newValue = value + '<ul><li>List Item</li></ul>';
        }
        setIsList(!isList);
        break;
      case 'orderedList':
        if (isOrderedList) {
          newValue = value.replace(/<ol>(.*?)<\/ol>/g, '$1');
        } else {
          newValue = value + '<ol><li>Ordered Item</li></ol>';
        }
        setIsOrderedList(!isOrderedList);
        break;
    }
    
    onChange(newValue);
  };

  return (
    <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, backgroundColor: 'white' }}>
      {/* Toolbar */}
      <View style={{ 
        flexDirection: 'row', 
        padding: 8, 
        borderBottomWidth: 1, 
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <TouchableOpacity 
          style={{ 
            padding: 8, 
            marginRight: 4, 
            backgroundColor: isBold ? '#2563eb' : 'transparent',
            borderRadius: 4
          }}
          onPress={() => applyFormat('bold')}
        >
          <Text style={{ 
            fontWeight: 'bold', 
            color: isBold ? 'white' : '#6b7280',
            fontSize: 16
          }}>B</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ 
            padding: 8, 
            marginRight: 4, 
            backgroundColor: isItalic ? '#2563eb' : 'transparent',
            borderRadius: 4
          }}
          onPress={() => applyFormat('italic')}
        >
          <Text style={{ 
            fontStyle: 'italic', 
            color: isItalic ? 'white' : '#6b7280',
            fontSize: 16
          }}>I</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ 
            padding: 8, 
            marginRight: 4, 
            backgroundColor: isUnderline ? '#2563eb' : 'transparent',
            borderRadius: 4
          }}
          onPress={() => applyFormat('underline')}
        >
          <Text style={{ 
            textDecorationLine: 'underline', 
            color: isUnderline ? 'white' : '#6b7280',
            fontSize: 16
          }}>U</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ 
            padding: 8, 
            marginRight: 4, 
            backgroundColor: isList ? '#2563eb' : 'transparent',
            borderRadius: 4
          }}
          onPress={() => applyFormat('list')}
        >
          <Text style={{ 
            color: isList ? 'white' : '#6b7280',
            fontSize: 16
          }}>•</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ 
            padding: 8, 
            marginRight: 4, 
            backgroundColor: isOrderedList ? '#2563eb' : 'transparent',
            borderRadius: 4
          }}
          onPress={() => applyFormat('orderedList')}
        >
          <Text style={{ 
            color: isOrderedList ? 'white' : '#6b7280',
            fontSize: 16
          }}>1.</Text>
        </TouchableOpacity>
      </View>
      
      {/* Text Input */}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        multiline
        textAlignVertical="top"
        style={{ 
          minHeight: 200, 
          padding: 12, 
          fontSize: 16,
          lineHeight: 24,
          color: '#111827'
        }}
      />
    </View>
  );
};

// Update the component definition
const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  initialTitle = '', 
  initialContent = '',
  announcementId,
  announcementMode,
}) => {
  console.log("initialContent", initialContent);
  console.log("initialTitle", initialTitle);
  
  // State variables
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
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const isFresh = announcementMode === 'new';
  const isDraft = announcementMode === 'draft';
  const isEdit = announcementMode === 'edit';

  // Initialize state and user ID
  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    setDraftTitle(initialTitle);
    setDraftContent(initialContent);
    currentTitleRef.current = initialTitle;
  }, [initialTitle, initialContent]);

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
    // Get current content from the rich editor
    let currentContent = draftContent;

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
      setDraftTitle(currentTitle);
      setDraftContent(currentContent);
      setHasUnsavedChanges(false);
      
      console.log("Draft saved successfully");
    } catch (error) {
      console.error("Error saving draft:", error);
      Alert.alert("Error", "Failed to save draft. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWithCurrentContent = async (title: string, content: string) => {
    if (!announcementId || !currentUserId) return;

    try {
      await updateDraft(announcementId, title, content, currentUserId);
      setDraftTitle(title);
      setDraftContent(content);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving with current content:", error);
      throw error;
    }
  };

  const handleDeleteDraft = async () => {
    if (!announcementId || !currentUserId) return;

    try {
      setIsDeletingDraft(true);
      await deleteDraft(announcementId, currentUserId);
      console.log("Draft deleted successfully");
      router.back();
    } catch (error) {
      console.error("Error deleting draft:", error);
      Alert.alert("Error", "Failed to delete draft. Please try again.");
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const handleGoBack = async () => {
    if (hasUnsavedChanges && (isDraft || isFresh)) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. What would you like to do?",
        [
          {
            text: "Discard Changes",
            style: "destructive",
            onPress: () => {
              if (isDraft) {
                handleDeleteDraft();
              } else {
                router.back();
              }
            }
          },
          {
            text: "Save Draft",
            onPress: async () => {
              try {
                if (isFresh) {
                  // For fresh announcements, create a new draft
                  const { currentTitle, currentContent } = await getCurrentContent();
                  if (currentTitle.trim() || currentContent.trim()) {
                    const newAnnouncement = await createAnnouncement(
                      currentTitle,
                      currentContent,
                      currentUserId,
                      true // isDraft
                    );
                    console.log("New draft created:", newAnnouncement);
                  }
                } else if (isDraft) {
                  await handleSaveProgress();
                }
                router.back();
              } catch (error) {
                console.error("Error saving draft:", error);
                Alert.alert("Error", "Failed to save draft. Please try again.");
              }
            }
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
    } else {
      router.back();
    }
  };

  const handleTitleChange = (text: string) => {
    setDraftTitle(text);
    currentTitleRef.current = text;
  };

  const handleContentChange = (text: string) => {
    setDraftContent(text);
  };

  const handlePublishAnnouncement = async () => {
    if (!currentUserId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    try {
      setIsPublishing(true);
      
      const { currentTitle, currentContent } = await getCurrentContent();
      
      if (!currentTitle.trim()) {
        Alert.alert("Error", "Please enter a title for the announcement");
        return;
      }

      if (!currentContent.trim()) {
        Alert.alert("Error", "Please enter content for the announcement");
        return;
      }

      if (isEdit && announcementId) {
        // Update existing announcement
        await updateAnnouncement(announcementId, currentTitle, currentContent);
        console.log("Announcement updated successfully");
      } else if (isDraft && announcementId) {
        // Publish draft
        await publishDraft(announcementId, currentTitle, currentContent, currentUserId);
        console.log("Draft published successfully");
      } else {
        // Create new announcement
        await createAnnouncement(currentTitle, currentContent, currentUserId, false);
        console.log("Announcement created successfully");
      }

      // Navigate back to announcements list
      router.back();
    } catch (error) {
      console.error("Error publishing announcement:", error);
      Alert.alert("Error", "Failed to publish announcement. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Generate preview HTML
  const getPreviewHTML = useCallback(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #111827;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background-color: #ffffff;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #111827;
              margin-top: 24px;
              margin-bottom: 16px;
            }
            p {
              margin-bottom: 16px;
            }
            ul, ol {
              margin-bottom: 16px;
              padding-left: 24px;
            }
            li {
              margin-bottom: 8px;
            }
            blockquote {
              border-left: 4px solid #e5e7eb;
              padding-left: 16px;
              margin: 16px 0;
              color: #6b7280;
              font-style: italic;
            }
            code {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header with back button */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={{ backgroundColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
        >
          <Text style={{ color: '#1f2937' }}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
          {isEdit ? 'Edit Announcement' : isDraft ? 'Editing Draft' : 'New Announcement'}
        </Text>
        
        {isDraft && (
          <TouchableOpacity
            onPress={handleSaveProgress}
            disabled={isSaving || !hasUnsavedChanges}
            style={{ 
              paddingVertical: 8, 
              paddingHorizontal: 16, 
              borderRadius: 8,
              backgroundColor: hasUnsavedChanges && !isSaving ? '#3b82f6' : '#d1d5db'
            }}
          >
            <Text style={{ 
              color: hasUnsavedChanges && !isSaving ? 'white' : '#6b7280'
            }}>
              {isSaving ? 'Saving...' : 'Save Progress'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
        {/* Title Input */}
        <TextInput
          ref={titleInputRef}
          value={draftTitle}
          onChangeText={handleTitleChange}
          placeholder="Enter announcement title..."
          style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 18, fontWeight: '600' }}
        />
        
        {/* Custom Rich Text Editor */}
        <CustomRichEditor
          value={draftContent}
          onChange={handleContentChange}
          placeholder="Start writing your announcement..."
        />
        
        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
          <TouchableOpacity 
            style={{ backgroundColor: '#e5e7eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, flex: 1 }}
            onPress={() => {
              setDraftContent('');
              setDraftTitle('');
            }}
          >
            <Text style={{ color: '#1f2937', textAlign: 'center', fontWeight: '600' }}>Clear All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={{ backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, flex: 1 }}
            onPress={toggleModal}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>Preview</Text>
          </TouchableOpacity>
        </View>
        
        {/* Draft status indicator */}
        {hasUnsavedChanges && (isDraft || isFresh) && (
          <View style={{ marginTop: 16, padding: 12, backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde047', borderRadius: 8 }}>
            <Text style={{ color: '#92400e', textAlign: 'center' }}>
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
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <StatusBar barStyle="dark-content" />
          
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Preview</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity 
                style={{ backgroundColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                onPress={toggleModal}
              >
                <Text style={{ color: '#1f2937' }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ backgroundColor: '#16a34a', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                onPress={() => {
                  toggleModal();
                  handlePublishAnnouncement();
                }}
                disabled={isPublishing}
              >
                <Text style={{ color: 'white' }}>
                  {isPublishing 
                    ? 'Publishing...' 
                    : (isEdit ? 'Publish Changes' : 'Publish')
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Full Page Preview */}
          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1, padding: 20 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#111827' }}>
                {draftTitle || 'Untitled'}
              </Text>
              <Text style={{ textAlign: 'center', marginBottom: 24, color: '#6b7280' }}>
                {new Date().toLocaleDateString()}
              </Text>
              <Text style={{ lineHeight: 24, color: '#111827' }}>
                {draftContent || 'No content to preview'}
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default RichTextEditor;