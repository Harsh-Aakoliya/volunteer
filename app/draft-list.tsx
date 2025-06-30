import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getDrafts, deleteDraft } from '@/api/admin';
import { Ionicons } from '@expo/vector-icons';
import { AuthStorage } from '@/utils/authStorage';

interface Draft {
  id: number;
  title: string;
  body: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

const DraftList = () => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const params = useLocalSearchParams();

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const userData = await AuthStorage.getUser();
    if (userData) {
      setCurrentUserId(userData.userId);
      loadDrafts(userData.userId);
    }
  };

  const loadDrafts = async (authorId?: string) => {
    try {
      const userId = authorId || currentUserId;
      if (!userId) return;
      
      setIsLoading(true);
      const data = await getDrafts(userId);
      setDrafts(data);
    } catch (error) {
      console.error('Error loading drafts:', error);
      Alert.alert('Error', 'Failed to load drafts. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDrafts();
  };

  const handleDeleteDraft = async (draftId: number) => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(draftId, currentUserId);
              setDrafts(prevDrafts => prevDrafts.filter(draft => draft.id !== draftId));
              Alert.alert('Success', 'Draft deleted successfully');
            } catch (error) {
              console.error('Error deleting draft:', error);
              Alert.alert('Error', 'Failed to delete draft. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleEditDraft = (draft: Draft) => {
    router.push({
      pathname: '/create-announcement',
      params: {
        announcementId: draft.id,
        announcementMode: 'draft',
        title: draft.title,
        content: draft.body
      }
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDraftItem = ({ item }: { item: Draft }) => (
    <TouchableOpacity 
      onPress={() => handleEditDraft(item)}
      className="bg-white p-4 mb-3 rounded-xl shadow-sm border border-gray-200"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-bold text-gray-900 mb-1">
            {item.title || 'Untitled Draft'}
          </Text>
          <Text className="text-sm text-gray-500 mb-2">
            Last edited: {formatDateTime(item.updatedAt)}
          </Text>
          <Text className="text-gray-600 text-sm" numberOfLines={2}>
            {item.body ? item.body.replace(/<[^>]*>/g, '') : 'No content'}
          </Text>
        </View>
        
        <TouchableOpacity
          onPress={() => handleDeleteDraft(item.id)}
          className="p-2 bg-red-100 rounded-lg"
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-gray-200 py-2 px-4 rounded-lg"
        >
          <Text className="text-gray-800">← Back</Text>
        </TouchableOpacity>
        
        <Text className="text-lg font-bold">My Drafts</Text>
        
        <TouchableOpacity
          onPress={onRefresh}
          className="bg-blue-100 py-2 px-4 rounded-lg"
        >
          <Ionicons name="refresh" size={16} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1 px-4 py-4">
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500">Loading drafts...</Text>
          </View>
        ) : (
          <FlatList
            data={drafts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderDraftItem}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={['#0284c7']}
              />
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-20">
                <Ionicons name="document-outline" size={64} color="#9ca3af" />
                <Text className="text-gray-500 text-lg mt-4">No drafts found</Text>
                <Text className="text-gray-400 text-sm mt-2 text-center">
                  Your saved drafts will appear here
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default DraftList; 