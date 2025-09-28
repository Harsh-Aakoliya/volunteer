//AnnouncementCreator.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Image, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Modal
} from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Checkbox from 'expo-checkbox';
import WebView from 'react-native-webview';
import axios from 'axios';

// Import utilities and components
import { AuthStorage } from '@/utils/authStorage';
import { API_URL } from '@/constants/api';
import AnnouncementMediaUploader from '@/components/texteditor/AnnouncementMediaUploader';
import { router } from 'expo-router';

// Import API functions
import { 
  updateDraft, 
  publishDraft, 
  deleteDraft,
  updateAnnouncement,
  getAnnouncementDetails
} from '@/api/admin';

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

const StyledWebView = cssInterop(WebView, {
  className: "style",
});

interface Department {
  departmentName: string;
  isSelected: boolean;
}

interface AnnouncementCreatorProps {
  initialTitle?: string;
  initialContent?: string;
  announcementId?: number;
  announcementMode?: string;
  hasCoverImage?: boolean;
  initialDepartmentTags?: string[];
  onExit: () => void;
}

export default function AnnouncementCreator({ 
  initialTitle = '', 
  initialContent = '',
  announcementId,
  announcementMode = 'new',
  hasCoverImage: initialHasCoverImage = false,
  initialDepartmentTags = [],
  onExit
}: AnnouncementCreatorProps) {
  console.log("initialTitle", initialTitle);
  console.log("initialContent", initialContent);
  console.log("announcementMode", announcementMode);
  console.log("hasCoverImage", initialHasCoverImage);
  console.log("initialDepartmentTags", initialDepartmentTags);
  console.log("onExit", onExit);
  
  const richText = useRef<RichEditor>(null);
  const titleInputRef = useRef<TextInput>(null);
  const currentTitleRef = useRef<string>(initialTitle);
  const editorInitializedRef = useRef<boolean>(false);
  const contentSetRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  
  // Memoize initial values to prevent unnecessary re-renders
  const memoizedInitialContent = useMemo(() => initialContent, []);
  const memoizedInitialTitle = useMemo(() => initialTitle, []);
  
  // Form data states
  const [draftContent, setDraftContent] = useState<string>(memoizedInitialContent);
  const [draftTitle, setDraftTitle] = useState<string>(memoizedInitialTitle);
  
  // Cover image states
  const [hasCoverImage, setHasCoverImage] = useState(initialHasCoverImage);
  const [coverImageUri, setCoverImageUri] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Media files states
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);
  
  // Department selection states
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(initialDepartmentTags);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  
  // UI states
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isLoadingAnnouncementData, setIsLoadingAnnouncementData] = useState(false);
  
  // Button loading states
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  
  // User data
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [isKaryalay, setIsKaryalay] = useState(false);

  const isFresh = announcementMode === 'new';
  const isDraft = announcementMode === 'draft';
  const isEdit = announcementMode === 'edit';

  // Optimized content setter with proper retry mechanism
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

  // Optimized editor initialization handler
  const handleEditorInitialized = useCallback(() => {
    console.log('Rich editor initialized');
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

  // Initialize user data and cover image
  useEffect(() => {
    const initializeData = async () => {
      const user = await AuthStorage.getUser();
      if (user) {
        setCurrentUserId(user.userId);
        setCurrentUserName(user.fullName || 'User');
        const departments = user.departments || [];
        const isKaryalayUser = (user?.departments && user?.departments.includes('Karyalay')) || false;
        const isAdminUser = user.isAdmin || false;
        
        setUserDepartments(departments);
        setIsKaryalay(isKaryalayUser);
        
        // Load departments
        await loadDepartments(departments, isKaryalayUser);
      }
    };
    
    initializeData();
    
    // Initialize cover image
    if (initialHasCoverImage) {
      setCoverImageUri(`${API_URL}/media/announcement/${announcementId}/coverimage.jpg?t=${Date.now()}`);
    } else {
      setCoverImageUri(`${API_URL}/media/defaultcoverimage.jpg`);
    }
  }, []);

  // Load existing announcement data for editing and drafts
  useEffect(() => {
    if ((isEdit || isDraft) && announcementId) {
      loadExistingAnnouncementData();
    }
  }, [isEdit, isDraft, announcementId]);

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

  // Filter departments based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDepartments(departments);
    } else {
      const filtered = departments.filter(dept => 
        dept.departmentName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDepartments(filtered);
    }
  }, [searchQuery, departments]);

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

  const loadExistingAnnouncementData = async () => {
    if (!announcementId || (!isEdit && !isDraft)) return;
    
    try {
      setIsLoadingAnnouncementData(true);
      const announcementDetails = await getAnnouncementDetails(announcementId);
      
      if (announcementDetails) {
        const departmentTags = announcementDetails.departmentTags || [];
        setSelectedDepartments(departmentTags);
        
        // Reload departments with the correct selection
        setTimeout(() => {
          loadDepartments();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading existing announcement data:', error);
      Alert.alert(
        'Warning',
        'Could not load some existing announcement data. You can still edit the announcement.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingAnnouncementData(false);
    }
  };

  const loadDepartments = async (userDepts?: string[], isKaryalayUser?: boolean) => {
    try {
      setIsLoadingDepartments(true);
      const token = await AuthStorage.getToken();

      const currentUserDepartments = userDepts || userDepartments;
      const currentIsKaryalay = isKaryalayUser !== undefined ? isKaryalayUser : isKaryalay;
      
      let availableDepartments: string[] = [];
      
      const user = await AuthStorage.getUser();
      const isAdminUser = user?.isAdmin || false;
      
      if (currentIsKaryalay) {
        const response = await axios.get(`${API_URL}/api/announcements/departments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        availableDepartments = response.data;
      } else {
        availableDepartments = currentUserDepartments;
        
        if (availableDepartments.length === 0) {
          Alert.alert("Warning", "You don't have any departments assigned. Please contact administrator.");
          return;
        }
      }

      const departmentObjects: Department[] = availableDepartments.map(deptName => ({
        departmentName: deptName,
        isSelected: selectedDepartments.includes(deptName)
      }));

      setDepartments(departmentObjects);
      setFilteredDepartments(departmentObjects);
    } catch (error) {
      console.error('Error loading departments:', error);
      Alert.alert('Error', 'Failed to load departments');
    } finally {
      setIsLoadingDepartments(false);
    }
  };

  const handleContentChange = useCallback((html: string) => {
    setDraftContent(html);
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

  const handleSelectCoverImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: ["image/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      
      if (!asset.mimeType?.startsWith('image/')) {
        Alert.alert("Invalid File", "Please select an image file only.");
        return;
      }

      setIsUploadingCover(true);
      setUploadProgress(0);

      try {
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
          const newImageUri = `${API_URL}/media/announcement/${announcementId}/coverimage.jpg?t=${Date.now()}`;
          setCoverImageUri(newImageUri);
          setHasCoverImage(true);
          setUploadProgress(100);
          
        } else {
          throw new Error("Upload failed");
        }

      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Upload failed", "There was an error uploading your cover image.");
        setCoverImageUri(`${API_URL}/media/defaultcoverimage.jpg`);
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

  const toggleDepartmentSelection = (departmentName: string) => {
    setSelectedDepartments(prev => 
      prev.includes(departmentName)
        ? prev.filter(name => name !== departmentName)
        : [...prev, departmentName]
    );

    setDepartments(prev => prev.map(dept => 
      dept.departmentName === departmentName 
        ? { ...dept, isSelected: !dept.isSelected }
        : dept
    ));
  };

  const selectAllDepartments = () => {
    const allDepartmentNames = filteredDepartments.map(dept => dept.departmentName);
    const allSelected = allDepartmentNames.every(name => selectedDepartments.includes(name));
    
    if (allSelected) {
      setSelectedDepartments(prev => prev.filter(name => !allDepartmentNames.includes(name)));
    } else {
      setSelectedDepartments(prev => [...new Set([...prev, ...allDepartmentNames])]);
    }

    setDepartments(prev => prev.map(dept => ({
      ...dept,
      isSelected: allSelected ? false : (filteredDepartments.some(fd => fd.departmentName === dept.departmentName) ? true : dept.isSelected)
    })));
  };

  const handleDeleteDraft = async () => {
    if (!announcementId || !currentUserId) return;
    
    try {
      await deleteDraft(announcementId as number, currentUserId);
      onExit();
    } catch (error) {
      console.error("Error deleting draft:", error);
      Alert.alert("Error", "Failed to delete draft. Please try again.");
    }
  };

  const handleSaveAsDraft = async () => {
    if (!announcementId || !currentUserId || isSavingDraft) return;
    
    try {
      setIsSavingDraft(true);
      const { currentTitle, currentContent } = await getCurrentContent();
      await updateDraft(announcementId, currentTitle, currentContent, currentUserId, selectedDepartments);
      
      Alert.alert(
        'Draft Saved',
        'Your announcement has been saved as draft.',
        [
          {
            text: 'OK',
            onPress: () => {
              setIsSavingDraft(false);
              onExit();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error saving draft:', error);
      setIsSavingDraft(false);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  };

  const handlePreview = async () => {
    if (isLoadingPreview) return;
    
    try {
      setIsLoadingPreview(true);
      const { currentTitle, currentContent } = await getCurrentContent();
      
      // Auto-save progress
      // if (announcementId && currentUserId) {
      //   try {
      //     await updateDraft(announcementId, currentTitle, currentContent, currentUserId, selectedDepartments);
      //   } catch (error) {
      //     console.error('Error auto-saving:', error);
      //   }
      // }
      
      // Navigate to preview route with current content
      router.push({
        pathname: "/preview",
        params: {
          title: currentTitle.trim(),
          content: currentContent.trim(),
          authorName: currentUserName,
          announcementId: announcementId,
          announcementMode: announcementMode,
          hasCoverImage: hasCoverImage ? 'true' : 'false',
          departmentTags: JSON.stringify(selectedDepartments),
          attachedMediaFiles: JSON.stringify(attachedMediaFiles)
        }
      });
    } catch (error) {
      console.error('Error preparing preview:', error);
      Alert.alert('Error', 'Failed to prepare preview. Please try again.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSchedule = () => {
    if (isScheduling) return;
    setIsScheduling(true);
    
    setTimeout(() => {
      setIsScheduling(false);
      Alert.alert('Coming Soon', 'Schedule functionality will be available in the next update.');
    }, 1000);
  };

  const renderDepartmentItem = (department: Department) => {
    const isSelected = selectedDepartments.includes(department.departmentName);

    return (
      <TouchableOpacity
        key={department.departmentName}
        onPress={() => toggleDepartmentSelection(department.departmentName)}
        className={`flex-row items-center p-4 border-b border-gray-100 ${
          isSelected ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        <Checkbox
          value={isSelected}
          onValueChange={() => toggleDepartmentSelection(department.departmentName)}
          className="mr-3"
          color={isSelected ? '#0284c7' : undefined}
        />
        
        <View className="w-12 h-12 rounded-full justify-center items-center mr-3 bg-blue-100">
          <Ionicons name="business" size={24} color="#0284c7" />
        </View>
        
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-800">
            {department.departmentName}
          </Text>
          <Text className="text-sm text-gray-500">
            Department
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isFormValid = draftTitle.trim() !== '' && draftContent.trim() !== '' && selectedDepartments.length > 0;
  const allFilteredSelected = filteredDepartments.length > 0 && 
    filteredDepartments.every(dept => selectedDepartments.includes(dept.departmentName));

  if (isLoadingAnnouncementData) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Loading announcement data...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white z-10">
        <TouchableOpacity onPress={onExit} className="p-2">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Announcement' : 'Create Announcement'}
        </Text>
        
        <View className="w-8" />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}>
          {/* Title and Body Section */}
          <View className="mb-8">
            {/* Title Input */}
            <TextInput
              ref={titleInputRef}
              value={draftTitle}
              onChangeText={handleTitleChange}
              placeholder="Enter announcement title..."
              className="text-xl font-semibold text-gray-900 py-3 mb-4"
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
            
            {/* Rich Text Editor */}
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

          {/* Cover Image Section */}
          <View className="mb-8">
            <Text className="text-xl font-bold text-gray-900 mb-4">Cover Image <Text className="text-gray-500 font-normal">(optional)</Text></Text>
            <View className="items-center">
              <TouchableOpacity
                onPress={handleSelectCoverImage}
                disabled={isUploadingCover}
                className="relative"
              >
                <View className="w-[200px] h-[200px] bg-gray-200 rounded-lg overflow-hidden">
                  <Image
                    source={{ uri: coverImageUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  
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

          {/* Media Files Section */}
          <View className="mb-8">
            <Text className="text-xl font-bold text-gray-900 mb-4">Attach Media Files <Text className="text-gray-500 font-normal">(optional)</Text></Text>
            
            <AnnouncementMediaUploader 
              announcementId={announcementId!}
              onMediaChange={setAttachedMediaFiles}
            />
          </View>

          {/* Department Selection Section */}
          <View className="mb-8">
            <Text className="text-xl font-bold text-gray-900 mb-4">Select Departments</Text>
            
            {/* Search Bar */}
            {filteredDepartments.length > 1 && (
              <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-3">
                <Ionicons name="search" size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 ml-2 text-base"
                  placeholder="Search departments..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#6b7280" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            {/* Select All Button */}
            {filteredDepartments.length > 1 && (
              <TouchableOpacity
                onPress={selectAllDepartments}
                className="flex-row items-center p-3 bg-gray-50 rounded-lg mb-3"
              >
                <View className="mr-3">
                  <Checkbox
                    value={allFilteredSelected}
                    onValueChange={selectAllDepartments}
                    color={allFilteredSelected ? '#0284c7' : undefined}
                  />
                </View>
                <Text className="text-gray-700 font-medium">
                  {allFilteredSelected ? 'Deselect All' : 'Select All'} 
                  {searchQuery ? ' (Filtered)' : ''}
                </Text>
              </TouchableOpacity>
            )}

            {/* Department List */}
            {isLoadingDepartments ? (
              <View className="justify-center items-center p-8">
                <ActivityIndicator size="large" color="#0284c7" />
                <Text className="text-gray-500 mt-2">Loading departments...</Text>
              </View>
            ) : (
              <View className="border border-gray-200 rounded-lg overflow-hidden">
                {filteredDepartments.length === 0 ? (
                  <View className="justify-center items-center p-8">
                    <Ionicons name="business-outline" size={60} color="#d1d5db" />
                    <Text className="text-gray-500 mt-4 text-center">
                      {searchQuery.length > 0 
                        ? "No departments match your search" 
                        : "No departments available"}
                    </Text>
                  </View>
                ) : (
                  filteredDepartments.map(department => renderDepartmentItem(department))
                )}
              </View>
            )}
          </View>

          {/* Action Buttons - After Department Selection */}
          <View className="p-4 bg-white border-t border-gray-200 mb-8">
            <View className="flex-row items-center">
              {/* Save Draft - Leftmost */}
              {(isFresh || isDraft) && (
              <TouchableOpacity
                onPress={handleSaveAsDraft}
                disabled={!draftTitle.trim() || !draftContent.trim() || isSavingDraft}
                className={`py-3 px-6 rounded-lg ${
                  (draftTitle.trim() && draftContent.trim() && !isSavingDraft)
                    ? 'bg-gray-100'
                    : 'bg-gray-200'
                }`}
              >
                <Text className={`text-center font-bold text-sm ${
                  (draftTitle.trim() && draftContent.trim() && !isSavingDraft)
                    ? 'text-gray-700'
                    : 'text-gray-400'
                }`}>
                  {isSavingDraft ? 'Saving...' : 'Save Draft'}
                </Text>
              </TouchableOpacity>
              )}
              {/* Gap */}
              <View className="flex-1" />
              
              {/* Schedule and Preview */}
              <View className="flex-row gap-3">
              {/*}
                <TouchableOpacity
                  onPress={handleSchedule}
                  disabled={!isFormValid || isScheduling}
                  className={`py-3 px-6 rounded-lg ${
                    (isFormValid && !isScheduling)
                      ? 'bg-yellow-100'
                      : 'bg-gray-200'
                  }`}
                >
                  <Text className={`text-center font-bold text-sm ${
                    (isFormValid && !isScheduling)
                      ? 'text-yellow-700'
                      : 'text-gray-400'
                  }`}>
                    {isScheduling ? 'Scheduling...' : 'Schedule'}
                  </Text>
                </TouchableOpacity>
                */}
                
                <TouchableOpacity
                  onPress={handlePreview}
                  disabled={!isFormValid || isLoadingPreview}
                  className={`py-3 px-6 rounded-lg ${
                    (isFormValid && !isLoadingPreview)
                      ? 'bg-blue-100'
                      : 'bg-gray-200'
                  }`}
                >
                  <Text className={`text-center font-bold text-sm ${
                    (isFormValid && !isLoadingPreview)
                      ? 'text-blue-700'
                      : 'text-gray-400'
                  }`}>
                    {isLoadingPreview ? 'Loading...' : 'Preview'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
                // actions.heading1,
                // actions.heading2,
                // actions.heading3,
                // actions.heading4,
                // actions.heading5,
                // actions.heading6,
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.insertLink,
                // actions.insertImage,
                // actions.insertVideo,
                // actions.table,
                actions.alignLeft,
                actions.alignCenter,
                actions.alignRight,
                // actions.code,
                // actions.blockquote,
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