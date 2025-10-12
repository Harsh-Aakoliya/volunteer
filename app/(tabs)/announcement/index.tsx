//main announcement page (index.tsx)
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
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
  

  const [isAnnouncementOpening,setIsAnnouncementOpening] = useState(false);
  
  const [isNavigatingToEditor, setIsNavigatingToEditor] = useState(false);

  // Read/Like details modal state
  const [showReadLikeModal, setShowReadLikeModal] = useState(false);
  const [modalType, setModalType] = useState<'read' | 'like'>('read');
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null);
  const [selectedDepartmentTag, setSelectedDepartmentTag] = useState<string[]>([]);
  const [isRefreshingModal, setIsRefreshingModal] = useState(false);

  // Get screen dimensions
  const { height: screenHeight } = Dimensions.get('window');
  const announcementHeight = screenHeight / 4; // Each announcement takes 1/4 of screen height
  const itemsPerPage = 4; // Show only 4 announcements per page

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
        // Only mark as read for published announcements, not scheduled ones
        if (!isRead(announcement) && announcement.status === 'published') {
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

useFocusEffect(
  useCallback(() => {
      if (isNavigatingToEditor) {
          console.log("🔁 Resetting isNavigatingToEditor on screen focus");
          setIsNavigatingToEditor(false);
      }
  }, [isNavigatingToEditor])
);


  // Handle tab selection
  const handleTabSelect = (tab: string) => {
    setSelectedTab(tab);
  };

  // Handle showing analytics modal (both read and like)
  const handleShowReadDetails = (announcementId: number, departmentTag?: string[]) => {
    setSelectedAnnouncementId(announcementId);
    setSelectedDepartmentTag(departmentTag || []);
    setModalType('read'); // Start with read tab active
    setShowReadLikeModal(true);
  };

  // Handle switching between read and like tabs
  const handleSwitchModalTab = (type: 'read' | 'like') => {
    setModalType(type);
  };

  // Handle refreshing modal data
  const handleRefreshModalData = async () => {
    if (!selectedAnnouncementId) return;
    
    setIsRefreshingModal(true);
    try {
      // Refresh the main announcements data which will update the modal
      await loadAnnouncements();
    } catch (error) {
      console.error('Error refreshing modal data:', error);
    } finally {
      setIsRefreshingModal(false);
    }
  };

  // Handle showing like details (for backward compatibility)
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
    setModalType('read'); // Reset to read tab
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
        <View className="">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="px-4 py-2"
            contentContainerStyle={{ paddingRight: 20 }}
          >
            {availableTabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => handleTabSelect(tab)}
                className={`mr-3 px-3 py-1.5 rounded-full border ${
                  selectedTab === tab
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
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
        data={announcements.slice(0, itemsPerPage)}
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
            onOpenAnnouncement={openAnnouncement}
            formatDateTime={formatDateTime}
            isAnnouncementOpening={isAnnouncementOpening}
            onShowReadDetails={handleShowReadDetails}
            onShowLikeDetails={handleShowLikeDetails}
            isScheduled={item.status === 'scheduled'}
          />
        )}
      />

      {/* Twitter-style Floating Action Menu - Only for HODs and Karyalay users */}
      {(isHOD || isKaryalay) && (
        <TouchableOpacity
          onPress={handleCreateNewAnnouncement}
          disabled={isNavigatingToEditor}
          className={`absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full items-center justify-center shadow-lg ${
            isNavigatingToEditor ? 'opacity-50' : ''
          }`}
          style={{ elevation: 10 }}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      )}

      {/* Read/Like Details Modal */}
      {selectedAnnouncementId && (
        <ReadLikeDetailsModal
          visible={showReadLikeModal}
          onClose={handleCloseModal}
          type={modalType}
          announcementId={selectedAnnouncementId}
          departmentTag={selectedDepartmentTag}
          onSwitchTab={handleSwitchModalTab}
          onRefresh={handleRefreshModalData}
          isRefreshing={isRefreshingModal}
        />
      )}

    </View>
  );
};



export default Announcements;