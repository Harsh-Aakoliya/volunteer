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
import AnnouncementItem from '@/components/AnnouncementItem';
import ReadLikeDetailsModal from '@/components/ReadLikeDetailsModal';
import { API_URL } from "@/constants/api";

const Announcements = () => {
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [isKaryalay, setIsKaryalay] = useState(false);
  const [isHOD, setIsHOD] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>("ALL");
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  
  const [isAnnouncementOpening, setIsAnnouncementOpening] = useState(false);
  const [isNavigatingToEditor, setIsNavigatingToEditor] = useState(false);

  // Read/Like details modal state
  const [showReadLikeModal, setShowReadLikeModal] = useState(false);
  const [modalType, setModalType] = useState<'read' | 'like'>('read');
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<number | null>(null);
  const [selectedDepartmentTag, setSelectedDepartmentTag] = useState<string[]>([]);
  const [isRefreshingModal, setIsRefreshingModal] = useState(false);

  const router = useRouter();
  const { newAnnouncement } = useLocalSearchParams();

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    setupTabs();
  }, [isKaryalay, isHOD, userDepartments]); 

  useEffect(() => {
    if (currentUserId) {
      loadAnnouncements();
    }
  }, [currentUserId]);

  useEffect(() => {
    filterAnnouncements();
  }, [selectedTab, allAnnouncements]);

  useEffect(() => {
    if (typeof newAnnouncement === "string") {
      const newAnn = JSON.parse(newAnnouncement);
      setAllAnnouncements((prev) => [newAnn, ...prev]);
      setAnnouncements((prev) => [newAnn, ...prev]);
    }
  }, [newAnnouncement]);

  const getCurrentUser = async () => {
    const userData = await AuthStorage.getUser();
    if (userData) {
      setCurrentUserId(userData.userId);
      setIsAdmin(userData.isAdmin || false);
      setUserDepartments(userData.departments || []);
      setIsKaryalay(userData?.departments && userData?.departments?.includes('Karyalay') || false);
      setIsHOD(userData?.isAdmin && userData?.departments && !userData?.departments?.includes('Karyalay') || false);
    }
  };

  const setupTabs = () => {
    let tabs: string[] = ['ALL'];
    
    if (isKaryalay) {
      tabs = ['ALL', 'Your announcements'];
      tabs.push(...userDepartments);
    } else if (isHOD) {
      tabs = ['ALL', 'Your announcements'];
      tabs.push(...userDepartments);
    } else {
      tabs = ['ALL', 'Karyalay'];
      tabs.push(...userDepartments);
    }
    
    setAvailableTabs(tabs);
    setSelectedTab('ALL');
  };

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
      filtered = allAnnouncements.filter(announcement => announcement.authorId === currentUserId);
    } else if (selectedTab === 'Karyalay') {
      filtered = allAnnouncements.filter(announcement => 
        announcement.authorDepartments && announcement.authorDepartments.includes('Karyalay')
      );
    } else {
      filtered = allAnnouncements.filter(announcement => 
        announcement.departmentTag && announcement.departmentTag.includes(selectedTab)
      );
    }

    setFilteredAnnouncements(filtered);
    setAnnouncements(filtered);
  };

  const getUnreadCountForTab = (tab: string) => {
    const isAnnouncementUnread = (announcement: Announcement) => {
      return announcement.status === 'published' && !isRead(announcement);
    };

    if (tab === 'ALL') {
      return allAnnouncements.filter(isAnnouncementUnread).length;
    }

    if (tab === 'Your announcements') {
      return allAnnouncements.filter(a => a.authorId === currentUserId && isAnnouncementUnread(a)).length;
    }

    if (tab === 'Karyalay') {
      return allAnnouncements.filter(a => a.authorDepartments && a.authorDepartments.includes('Karyalay') && isAnnouncementUnread(a)).length;
    }

    return allAnnouncements.filter(a => a.departmentTag && a.departmentTag.includes(tab) && isAnnouncementUnread(a)).length;
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const result = await markAsRead(id, currentUserId);
      if (result.wasNew) {
        loadAnnouncements();
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
      return;
    }

    setIsAnnouncementOpening(true);

    try {
      if (!isRead(announcement) && announcement.status === 'published') {
        await handleMarkAsRead(announcement.id);
      }
      router.push(`/announcement/${announcement.id}`);
    } catch (error) {
      console.error("Error during announcement open:", error);
      setIsAnnouncementOpening(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isAnnouncementOpening) {
        setIsAnnouncementOpening(false);
      }
    }, [isAnnouncementOpening])
  );

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
        pathname: "/create-announcement",
        params: {
          announcementId: draft.id,
          announcementMode: 'new',
          title: '',
          content: '',
          hasCoverImage: 'false'
        }
      });
    } catch (error) {
      console.error('Error creating new draft:', error);
      Alert.alert('Error', 'Failed to create new announcement. Please try again.');
      setIsNavigatingToEditor(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isNavigatingToEditor) {
        setIsNavigatingToEditor(false);
      }
    }, [isNavigatingToEditor])
  );

  const handleTabSelect = (tab: string) => {
    setSelectedTab(tab);
  };

  const handleShowReadDetails = (announcementId: number, departmentTag?: string[]) => {
    setSelectedAnnouncementId(announcementId);
    setSelectedDepartmentTag(departmentTag || []);
    setModalType('read');
    setShowReadLikeModal(true);
  };

  const handleSwitchModalTab = (type: 'read' | 'like') => {
    setModalType(type);
  };

  const handleRefreshModalData = async () => {
    if (!selectedAnnouncementId) return;
    
    setIsRefreshingModal(true);
    try {
      await loadAnnouncements();
    } catch (error) {
      console.error('Error refreshing modal data:', error);
    } finally {
      setIsRefreshingModal(false);
    }
  };

  const handleShowLikeDetails = (announcementId: number) => {
    setSelectedAnnouncementId(announcementId);
    setModalType('like');
    setShowReadLikeModal(true);
  };

  const handleCloseModal = () => {
    setShowReadLikeModal(false);
    setSelectedAnnouncementId(null);
    setSelectedDepartmentTag([]);
    setModalType('read');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      
      {/* Department Tabs */}
      {availableTabs.length > 1 && (
        <View 
          style={{ 
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ paddingHorizontal: 16, marginBottom: 4 }}
            contentContainerStyle={{ paddingRight: 20, paddingTop: 4, paddingBottom: 4 }}
          >
            {availableTabs.map((tab) => {
              const unreadCount = getUnreadCountForTab(tab);
              return (
                <View key={tab} style={{ position: 'relative', marginRight: 8, paddingTop: 4, paddingRight: 4 }}>
                  <TouchableOpacity
                    onPress={() => handleTabSelect(tab)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: selectedTab === tab ? '#6366f1' : '#fff',
                      shadowColor: selectedTab === tab ? '#6366f1' : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: selectedTab === tab ? 0.3 : 0.1,
                      shadowRadius: 4,
                      elevation: selectedTab === tab ? 4 : 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: selectedTab === tab ? '#fff' : '#374151',
                        letterSpacing: 0.3,
                      }}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                  {unreadCount > 0 && (
                    <View 
                      style={{ 
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        zIndex: 10,
                        transform: [{ translateX: 4 }, { translateY: -4 }],
                        backgroundColor: '#ef4444',
                        shadowColor: '#ef4444',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.4,
                        shadowRadius: 4,
                        elevation: 5,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.2 }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Announcements FlatList */}
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={['#6366f1']}
          />
        }
        contentContainerStyle={{ 
          paddingTop: 8,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        style={{ 
          flex: 1,
        }}
        showsVerticalScrollIndicator={true}
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

      {/* Floating Action Button */}
      {(isHOD || isKaryalay) && (
        <TouchableOpacity
          onPress={handleCreateNewAnnouncement}
          disabled={isNavigatingToEditor}
          style={{ 
            position: 'absolute',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#6366f1',
            shadowColor: '#6366f1',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 12,
            opacity: isNavigatingToEditor ? 0.5 : 1,
          }}
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