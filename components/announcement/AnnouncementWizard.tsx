import React, { useState, useEffect } from 'react';
import { View, Alert, BackHandler, Text } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

// Import step components
import Step1TitleBody from './Step1TitleBody';
import Step2Media from './Step2Media';
import Step3Recipients from './Step3Recipients';
import Step4Preview from './Step4Preview';

// Import API functions
import { 
  updateDraft, 
  publishDraft, 
  deleteDraft,
  updateAnnouncement,
  getAnnouncementDetails
} from '@/api/admin';
import { AuthStorage } from '@/utils/authStorage';

interface AnnouncementWizardProps {
  initialTitle?: string;
  initialContent?: string;
  announcementId?: number;
  announcementMode?: string;
  hasCoverImage?: boolean;
}

export default function AnnouncementWizard({ 
  initialTitle = '', 
  initialContent = '',
  announcementId,
  announcementMode = 'new',
  hasCoverImage: initialHasCoverImage = false
}: AnnouncementWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Step 1 data
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  
  // Step 2 data
  const [hasCoverImage, setHasCoverImage] = useState(initialHasCoverImage);
  const [attachedMediaFiles, setAttachedMediaFiles] = useState<any[]>([]);
  
  // Step 3 data
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  
  // States
  const [isLoadingAnnouncementData, setIsLoadingAnnouncementData] = useState(false);

  const isFresh = announcementMode === 'new';
  const isDraft = announcementMode === 'draft';
  const isEdit = announcementMode === 'edit';

  useEffect(() => {
    const getUserId = async () => {
      const user = await AuthStorage.getUser();
      if (user) {
        setCurrentUserId(user.userId);
        
        // Note: User selection will happen in Step 3
      }
    };
    getUserId();
  }, []);

  // Load existing announcement data for editing
  useEffect(() => {
    if (isEdit && announcementId) {
      loadExistingAnnouncementData();
    }
  }, [isEdit, announcementId]);

  const loadExistingAnnouncementData = async () => {
    if (!announcementId || !isEdit) return;
    
    try {
      setIsLoadingAnnouncementData(true);
      const announcementDetails = await getAnnouncementDetails(announcementId);
      
      if (announcementDetails) {
        // Set existing selected departments
        const departmentTags = announcementDetails.departmentTags || [];
        
        console.log('AnnouncementWizard: Loaded announcement details:', {
          announcementId,
          departmentTags,
          isEdit,
          isDraft
        });
        
        setSelectedDepartments(departmentTags);
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

  // Handle back button press
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleExitWizard();
        return true;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [currentStep, title, content])
  );

  const handleExitWizard = async () => {
    if (isFresh) {
      // New announcement flow
      const hasContent = title.trim() !== '' || content.trim() !== '';
      
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
              text: "Save as draft and exit",
              onPress: async () => {
                await handleSaveAsDraft();
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
      // Draft editing flow
      const hasContentChanges = title !== initialTitle || content !== initialContent;
      
      if (!hasContentChanges) {
        router.replace('../../draft-list');
      } else {
        Alert.alert(
          "Unsaved Changes",
          "You have unsaved changes. What would you like to do?",
          [
            {
              text: "Save draft and exit",
              onPress: async () => {
                await handleSaveAsDraft();
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
      // Edit published announcement flow
      const hasContentChanges = title !== initialTitle || content !== initialContent;
      
      if (!hasContentChanges) {
        router.replace('/announcement');
      } else {
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

  const handleDeleteDraft = async () => {
    if (!announcementId || !currentUserId) return;
    
    try {
      await deleteDraft(announcementId as number, currentUserId);
      router.back();
    } catch (error) {
      console.error("Error deleting draft:", error);
      Alert.alert("Error", "Failed to delete draft. Please try again.");
    }
  };

  const handleSaveAsDraft = async () => {
    if (!announcementId || !currentUserId) return;
    
    try {
      await updateDraft(announcementId, title, content, currentUserId, selectedDepartments);
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  };

  // Step handlers
  const handleStep1Next = async (newTitle: string, newContent: string) => {
    setTitle(newTitle);
    setContent(newContent);
    
    // Auto-save progress
    if (announcementId && currentUserId) {
      try {
        await updateDraft(announcementId, newTitle, newContent, currentUserId, selectedDepartments);
      } catch (error) {
        console.error('Error auto-saving:', error);
      }
    }
    
    setCurrentStep(2);
  };

  const handleStep1Back = () => {
    handleExitWizard();
  };

  const handleStep2Next = (newHasCoverImage: boolean, mediaFiles: any[]) => {
    setHasCoverImage(newHasCoverImage);
    setAttachedMediaFiles(mediaFiles);
    setCurrentStep(3);
  };

  const handleStep2Back = () => {
    handleExitWizard();
  };
  const handleStep2Previous = () => {
    setCurrentStep(1);
  };

  const handleStep3Next = (newSelectedDepartments: string[]) => {
    setSelectedDepartments(newSelectedDepartments);
    setCurrentStep(4);
  };

  const handleStep3Back = () => {
    handleExitWizard();
  };
  const handleStep3Previous = () => {
    setCurrentStep(2);
  };

  const handleStep4Back = () => {
    handleExitWizard();
  };

  const handlePublish = async () => {
    if (!announcementId || !currentUserId) return;
    
    try {
      if (isFresh || isDraft) {
        // Publish draft
        await publishDraft(announcementId as number, title, content, currentUserId, selectedDepartments);
      } else if (isEdit) {
        // Update existing published announcement
        await updateAnnouncement(announcementId, title, content, selectedDepartments);
      }
      
      // Navigate back to announcement screen
      router.replace('/announcement');
      
    } catch (error) {
      console.error('Error publishing announcement:', error);
      Alert.alert('Error', 'Failed to publish announcement. Please try again.');
      throw error; // Re-throw to stop the publishing animation
    }
  };

  if (isLoadingAnnouncementData) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Loading announcement data...</Text>
      </View>
    );
  }

  // Render current step
  switch (currentStep) {
    case 1:
      return (
        <Step1TitleBody
          initialTitle={title}
          initialContent={content}
          onNext={handleStep1Next}
          onBack={handleStep1Back}
          isEdit={isEdit}
        />
      );
    
    case 2:
      return (
        <Step2Media
          announcementId={announcementId!}
          hasCoverImage={hasCoverImage}
          onNext={handleStep2Next}
          onBack={handleStep2Back}
          onPrevious={handleStep2Previous}
          isEdit={isEdit}
        />
      );
    
    case 3:
      return (
        <Step3Recipients
          selectedDepartments={selectedDepartments}
          onNext={handleStep3Next}
          onBack={handleStep3Back}
          onPrevious={handleStep3Previous}
          isEdit={isEdit}
        />
      );
    
    case 4:
      return (
        <Step4Preview
          title={title}
          content={content}
          announcementId={announcementId!}
          selectedDepartments={selectedDepartments}
          attachedMediaFiles={attachedMediaFiles}
          onPublish={handlePublish}
          onBack={handleStep4Back}
          isEdit={isEdit}
        />
      );
    
    default:
      return null;
  }
}
