//main announcement page (index.tsx)
import React,{ useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView
} from "react-native";
import {
  fetchUserAnnouncements,
  toggleLike,
  markAsRead,
  createDraft
} from "@/api/admin";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { AuthStorage } from "@/utils/authStorage";
import { Ionicons } from '@expo/vector-icons';
import { Announcement } from "@/types/type";
import { ActivityIndicator, Image as RNImage } from 'react-native'; // 👈 Add these imports at 
import AnnouncementItem from '@/components/AnnouncementItem';
import ReadLikeDetailsModal from '@/components/ReadLikeDetailsModal';
import Basic from '@/components/CNQuillTestSection';
import { API_URL } from "@/constants/api";

const Announcements = () => {

  // return (
  //   <SafeAreaView style={{flex: 1, backgroundColor: '#0068C5'}}> 
  //           <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f1f1', paddingHorizontal: 22}}>
  //               <Basic />
  //           </View>
  //       </SafeAreaView> 
  // )
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]); // Store all fetched announcements
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]); // Filtered announcements for display
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [isKaryalay, setIsKaryalay] = useState(false);
  const [isHOD, setIsHOD] = useState(false);
  // const [allDepartments, setAllDepartments] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("ALL");
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  
  const [likingInProgress, setLikingInProgress] = useState<Set<number>>(new Set());
  const [showActionMenu, setShowActionMenu] = useState(false);

  const [isAnnouncementOpening,setIsAnnouncementOpening] = useState(false);
  
  const [isNavigatingToEditor, setIsNavigatingToEditor] = useState(false);

  // Read/Like details modal state
  const [showReadLikeModal, setShowReadLikeModal] = useState(false);
  const [modalType, setModalType] = useState<'read' | 'like'>('read');
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null);
  const [selectedDepartmentTag, setSelectedDepartmentTag] = useState<string[]>([]);
  // Animation values
  const rotationAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  // Get screen dimensions
  const { height: screenHeight } = Dimensions.get('window');
  const announcementHeight = screenHeight / 4; // Each announcement takes 1/4 of screen height

  useEffect(() => {
    getCurrentUser();
    // loadDepartments();
  }, []);

  useEffect(() => {
    // Set up tabs based on user type
    setupTabs();
  }, [isKaryalay, isHOD, userDepartments]); 

  useEffect(() => {
    // Load announcements when user type is determined
    if (currentUserId) {
      loadAnnouncements();
    }
  }, [currentUserId]);

  useEffect(() => {
    // Filter announcements when tab changes
    filterAnnouncements();
  }, [selectedTab, allAnnouncements]);

  const getCurrentUser = async () => {
    const userData = await AuthStorage.getUser();
    // console.log("User data in announcement page",userData);
    if (userData) {
      setCurrentUserId(userData.userId);
      setIsAdmin(userData.isAdmin || false);
      setUserDepartments(userData.departments || []);
      setIsKaryalay(userData?.departments && userData?.departments?.includes('Karyalay') || false);
      setIsHOD(userData?.isAdmin && userData?.departments && !userData?.departments?.includes('Karyalay') || false);
    }
  };

  // const loadDepartments = async () => {
  //   try {
  //     const departments = await getAllDepartments();
  //     setAllDepartments(departments);
  //   } catch (error) {
  //     console.error('Error loading departments:', error);
  //   }
  // };

  const setupTabs = () => {
    let tabs: string[] = ['ALL'];
    
    if (isKaryalay) {
      // Karyalay users see: ALL, Your announcements, and their departments
      tabs = ['ALL', 'Your announcements'];
      tabs.push(...userDepartments);
    } else if (isHOD) {
      // HOD users see: ALL, Your announcements, Karyalay, and their departments
      tabs = ['ALL', 'Your announcements', 'Karyalay'];
      tabs.push(...userDepartments);
    } else {
      // Normal users see: ALL, Karyalay, and their departments
      tabs = ['ALL', 'Karyalay'];
      tabs.push(...userDepartments);
    }
    
    setAvailableTabs(tabs);
    setSelectedTab('ALL');
  };

  const router = useRouter();
  const { newAnnouncement } = useLocalSearchParams();

  useEffect(() => {
    if (typeof newAnnouncement === "string") {
      const newAnn = JSON.parse(newAnnouncement);
      setAllAnnouncements((prev) => [newAnn, ...prev]);
      setAnnouncements((prev) => [newAnn, ...prev]);
    }
  }, [newAnnouncement]);

  const loadAnnouncements = async () => {
    try {
      setIsRefreshing(true);
      const data: Announcement[] = await fetchUserAnnouncements();
      setAllAnnouncements(data);
      setAnnouncements(data);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setIsRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadAnnouncements();
  }, []);

  const filterAnnouncements = () => {
    if (selectedTab === 'ALL') {
      setFilteredAnnouncements(allAnnouncements);
      setAnnouncements(allAnnouncements);
      return;
    }

    let filtered: Announcement[] = [];

    if (selectedTab === 'Your announcements') {
      // Show only announcements created by current user
      filtered = allAnnouncements.filter(announcement => announcement.authorId === currentUserId);
    } else if (selectedTab === 'Karyalay') {
      // Show announcements where author is from Karyalay department
      filtered = allAnnouncements.filter(announcement => 
        announcement.authorDepartments && announcement.authorDepartments.includes('Karyalay')
      );
    } else {
      // Filter by specific department in departmentTag
      filtered = allAnnouncements.filter(announcement => 
        announcement.departmentTag && announcement.departmentTag.includes(selectedTab)
      );
    }

    setFilteredAnnouncements(filtered);
    setAnnouncements(filtered);
  };

  const handleToggleLike = async (id: number) => {
    // Prevent multiple rapid clicks
    if (likingInProgress.has(id)) {
      return;
    }

    try {
      // Mark as in progress
      setLikingInProgress(prev => new Set(prev.add(id)));

      // Optimistically update the UI first for immediate feedback
      setAnnouncements(prevAnnouncements => 
        prevAnnouncements.map(announcement => {
          if (announcement.id === id) {
            const currentlyLiked = announcement.likedBy?.some(like => like.userId === currentUserId) || false;
            let newLikedBy;
            
            if (currentlyLiked) {
              // Remove user's like
              newLikedBy = announcement.likedBy?.filter(like => like.userId !== currentUserId) || [];
            } else {
              // Add user's like
              const newLike = {
                userId: currentUserId,
                fullName: 'You', // We'll get actual name from server response
                likedAt: new Date().toISOString()
              };
              newLikedBy = [...(announcement.likedBy || []), newLike];
            }
            
            return {
              ...announcement,
              likedBy: newLikedBy
            };
          }
          return announcement;
        })
      );


      // Send request to server
      const result = await toggleLike(id, currentUserId);
      console.log('Like toggle result:', result);
      
      // Success! The optimistic update should be correct
      // We could optionally refresh to get accurate server data
      
    } catch (error: any) {
      console.error("Error toggling like:", error);
      
      // Revert optimistic update on error
      loadAnnouncements();
      
      // Show error message
      Alert.alert("Error", "Failed to update like. Please try again.");
    } finally {
      // Remove from in progress
      setLikingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const result = await markAsRead(id, currentUserId);
      if (result.wasNew) {
        loadAnnouncements(); // Refresh to get updated read status
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const isRead = (announcement: Announcement) => {
    return announcement.readBy?.some(read => read.userId === currentUserId) || false;
  };

  const openAnnouncement = async (announcement: Announcement) => {
    if (isAnnouncementOpening) {
        console.log("🛑 Announcement opening in progress, ignoring click.");
        return;
    }

    setIsAnnouncementOpening(true);
    console.log("Opening announcement:", announcement);

    try {
        if (!isRead(announcement)) {
            await handleMarkAsRead(announcement.id);
        }
        router.push(`/announcement/${announcement.id}`);
        // Wait for user to come back → reset via useFocusEffect
    } catch (error) {
        console.error("Error during announcement open:", error);
        setIsAnnouncementOpening(false); // Reset only on error
    }
};

useFocusEffect(
  useCallback(() => {
      // Reset opening state whenever user returns to this screen
      if (isAnnouncementOpening) {
          console.log("🔁 Resetting isAnnouncementOpening on screen focus");
          setIsAnnouncementOpening(false);
      }
  }, [isAnnouncementOpening])
);
  
  


  // Check if current user has read the announcement
  const hasUserRead = (announcement: Announcement) => {
    return announcement.readBy?.some(read => read.userId === currentUserId) || false;
  };

  // Check if current user has liked the announcement
  const hasUserLiked = (announcement: Announcement) => {
    return announcement.likedBy?.some(like => like.userId === currentUserId) || false;
  };


  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleCreateNewAnnouncement = async () => {
    if (isNavigatingToEditor) {
        console.log("🛑 Navigation to editor already in progress");
        return;
    }

    try {
        closeActionMenu();
        setIsNavigatingToEditor(true);

        let departmentTags: string[] = [];
        if (isKaryalay) {
            departmentTags = [];
        } else {
            departmentTags = [];
        }

        const draft = await createDraft(currentUserId, departmentTags);

        router.push({
            pathname: "../create-announcement",
            params: {
                announcementId: draft.id,
                announcementMode: 'new',
                title: '',
                content: '',
                hasCoverImage: 'false'
            }
        });

        // DO NOT reset here — wait until user comes back!
    } catch (error) {
        console.error('Error creating new draft:', error);
        Alert.alert('Error', 'Failed to create new announcement. Please try again.');
        setIsNavigatingToEditor(false); // Only reset on error
    }
};

const handleCreateFromDraft = () => {
  if (isNavigatingToEditor) {
      console.log("🛑 Navigation to editor already in progress");
      return;
  }

  closeActionMenu();
  setIsNavigatingToEditor(true);

  router.push({
      pathname: "../../draft-list",
      params: {
          authorId: currentUserId
      }
  });

  // DO NOT reset here — wait until user comes back!
};
useFocusEffect(
  useCallback(() => {
      if (isNavigatingToEditor) {
          console.log("🔁 Resetting isNavigatingToEditor on screen focus");
          setIsNavigatingToEditor(false);
      }
  }, [isNavigatingToEditor])
);

  const openActionMenu = () => {
    setShowActionMenu(true);
    
    Animated.parallel([
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeActionMenu = () => {
    Animated.parallel([
      Animated.timing(rotationAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowActionMenu(false);
    });
  };

  const handleActionMenuToggle = () => {
    if (showActionMenu) {
      closeActionMenu();
    } else {
      openActionMenu();
    }
  };

  // Handle tab selection
  const handleTabSelect = (tab: string) => {
    setSelectedTab(tab);
  };

  // Handle showing read details
  const handleShowReadDetails = (announcementId: number, departmentTag?: string[]) => {
    setSelectedAnnouncementId(announcementId);
    setSelectedDepartmentTag(departmentTag || []);
    setModalType('read');
    setShowReadLikeModal(true);
  };

  // Handle showing like details
  const handleShowLikeDetails = (announcementId: number) => {
    setSelectedAnnouncementId(announcementId);
    setModalType('like');
    setShowReadLikeModal(true);
  };

  // Handle closing modal
  const handleCloseModal = () => {
    setShowReadLikeModal(false);
    setSelectedAnnouncementId(null);
    setSelectedDepartmentTag([]);
  };





  return (
    <View className="flex-1 bg-gray-50">
      {/* {isAnnouncementOpening && (
          <View className="absolute inset-0 bg-white z-50 flex items-center justify-center">
              <ActivityIndicator size="large" color="#007AFF" />
              <Text className="mt-4 text-gray-600">Opening announcement...</Text>
          </View>
      )} */}
      
      {/* TEST SECTION FOR REACT-NATIVE-CN-QUILL */}
      
      

      {/* <Department  /> */}
      {availableTabs.length > 1 && (
        <View className="bg-white border-b border-gray-200">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="px-4 py-3"
            contentContainerStyle={{ paddingRight: 20 }}
          >
            {availableTabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => handleTabSelect(tab)}
                className={`mr-4 px-4 py-2 rounded-full border ${
                  selectedTab === tab
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-300'
                }`}
              >
                <Text
                  className={`font-medium ${
                    selectedTab === tab ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => (
          <View className="h-px bg-gray-200 mx-4" />
        )}
        renderItem={({ item }) => (
          <AnnouncementItem
            item={item}
            currentUserId={currentUserId}
            likingInProgress={likingInProgress}
            onToggleLike={handleToggleLike}
            onOpenAnnouncement={openAnnouncement}
            formatDateTime={formatDateTime}
            isAnnouncementOpening={isAnnouncementOpening}
            onShowReadDetails={handleShowReadDetails}
            onShowLikeDetails={handleShowLikeDetails}
          />
        )}
      />

      {/* Twitter-style Floating Action Menu - Only for HODs and Karyalay users */}
      {(isHOD || isKaryalay) && (
        <>
          {/* Blurred Background Overlay */}
          {showActionMenu && (
            <Animated.View 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                opacity: opacityAnim,
              }}
            >
              <TouchableOpacity 
                style={{ flex: 1 }}
                onPress={closeActionMenu}
                activeOpacity={1}
              />
            </Animated.View>
          )}

          {/* Floating Action Buttons */}
          {showActionMenu && (
            <>
              {/* Create from Draft Button */}
              <Animated.View
                style={{
                  position: 'absolute',
                  bottom: 150, // 90 + 60 (button height + spacing)
                  right: 24,
                  transform: [
                    { scale: scaleAnim },
                    { 
                      translateY: scaleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0]
                      })
                    }
                  ],
                  opacity: opacityAnim,
                }}
                className="flex-row items-center"
              >
                <View className="bg-black bg-opacity-80 px-3 py-2 rounded-full mr-3">
                  <Text className="text-white text-sm font-medium">Create from Draft</Text>
                </View>
                <TouchableOpacity
                    onPress={handleCreateFromDraft}
                    disabled={isNavigatingToEditor} // 👈 Disable during nav
                    className={`bg-green-500 w-14 h-14 rounded-full items-center justify-center shadow-lg ${
                        isNavigatingToEditor ? 'opacity-50' : ''
                    }`}
                    style={{ elevation: 8 }}
                >
                    <Ionicons name="file-tray-outline" size={24} color="white" />
                </TouchableOpacity>
              </Animated.View>

              {/* Create New Announcement Button */}
              <Animated.View
                style={{
                  position: 'absolute',
                  bottom: 90, // 90 from bottom
                  right: 24,
                  transform: [
                    { scale: scaleAnim },
                    { 
                      translateY: scaleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0]
                      })
                    }
                  ],
                  opacity: opacityAnim,
                }}
                className="flex-row items-center"
              >
                <View className="bg-black bg-opacity-80 px-3 py-2 rounded-full mr-3">
                  <Text className="text-white text-sm font-medium">Create New Announcement</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCreateNewAnnouncement}
                  className="bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
                  style={{ elevation: 8 }}
                >
                  <Ionicons name="document-text-outline" size={24} color="white" />
                </TouchableOpacity>
              </Animated.View>
            </>
          )}

          {/* Main FAB with rotating + to X */}
          <TouchableOpacity
            onPress={handleActionMenuToggle}
            className="absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
            style={{ elevation: 10 }}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: rotationAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '45deg']
                    })
                  }
                ]
              }}
            >
              <Ionicons name="add" size={32} color="white" />
            </Animated.View>
          </TouchableOpacity>
        </>
      )}

      {/* Read/Like Details Modal */}
      {selectedAnnouncementId && (
        <ReadLikeDetailsModal
          visible={showReadLikeModal}
          onClose={handleCloseModal}
          type={modalType}
          announcementId={selectedAnnouncementId}
          departmentTag={selectedDepartmentTag}
        />
      )}

    </View>
  );
};



export default Announcements;