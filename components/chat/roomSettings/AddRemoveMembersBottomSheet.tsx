// components/chat/roomSettings/AddRemoveMembersBottomSheet.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateRoomMembers, fetchChatUsers } from '@/api/chat';
import { ChatUser } from '@/types/type';
import { showToast } from '@/utils/toast';

interface Member {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
}

interface AddRemoveMembersBottomSheetProps {
  roomId: string;
  currentMembers: Member[];
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type ListItem =
  | { type: 'instruction' }
  | { type: 'sectionHeader'; title: string; count: number }
  | { type: 'user'; user: ChatUser; isExistingMember: boolean; isAdmin: boolean; isCurrentUser: boolean }
  | { type: 'empty' };

export default function AddRemoveMembersBottomSheet({
  roomId,
  currentMembers,
  currentUserId,
  onClose,
  onSuccess,
}: AddRemoveMembersBottomSheetProps) {
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsFetchingUsers(true);
        const users = await fetchChatUsers();
        setAllUsers(users);
        const currentMemberIds = currentMembers.map(m => m.userId);
        setSelectedMembers(new Set(currentMemberIds));
      } catch (error) {
        console.error('Error fetching users:', error);
        Alert.alert('Error', 'Failed to load users');
      } finally {
        setIsFetchingUsers(false);
      }
    };
    loadUsers();
  }, [currentMembers]);

  const currentMemberIds = useMemo(() => currentMembers.map(m => m.userId), [currentMembers]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter(user =>
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.mobileNumber?.includes(searchQuery)
    );
  }, [allUsers, searchQuery]);

  const existingMembers = useMemo(() => 
    filteredUsers.filter(u => currentMemberIds.includes(u.userId)),
    [filteredUsers, currentMemberIds]
  );
  
  const nonMembers = useMemo(() => 
    filteredUsers.filter(u => !currentMemberIds.includes(u.userId)),
    [filteredUsers, currentMemberIds]
  );

  // Build list data
  const listData = useMemo<ListItem[]>(() => {
    const data: ListItem[] = [];

    // Instruction
    data.push({ type: 'instruction' });

    // Current Members Section
    if (existingMembers.length > 0) {
      data.push({ type: 'sectionHeader', title: 'Current Members', count: existingMembers.length });
      existingMembers.forEach(user => {
        const member = currentMembers.find(m => m.userId === user.userId);
        data.push({
          type: 'user',
          user,
          isExistingMember: true,
          isAdmin: member?.isAdmin || false,
          isCurrentUser: user.userId === currentUserId,
        });
      });
    }

    // Other Users Section
    if (nonMembers.length > 0) {
      data.push({ type: 'sectionHeader', title: 'Other Users', count: nonMembers.length });
      nonMembers.forEach(user => {
        data.push({
          type: 'user',
          user,
          isExistingMember: false,
          isAdmin: false,
          isCurrentUser: user.userId === currentUserId,
        });
      });
    }

    // Empty state
    if (filteredUsers.length === 0) {
      data.push({ type: 'empty' });
    }

    return data;
  }, [existingMembers, nonMembers, currentMembers, currentUserId, filteredUsers]);

  const toggleMember = useCallback((userId: string, isAdmin: boolean, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      Alert.alert('Info', 'You cannot remove yourself from the room');
      return;
    }

    if (isAdmin && selectedMembers.has(userId)) {
      Alert.alert('Info', 'Cannot remove admin users. Please demote them first.');
      return;
    }

    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, [selectedMembers]);

  const handleUpdate = async () => {
    try {
      setIsLoading(true);
      await updateRoomMembers(roomId, Array.from(selectedMembers));
      showToast('Room members updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating room members:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update room members');
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    switch (item.type) {
      case 'instruction':
        return (
          <View style={styles.instructionBox}>
            <Text style={styles.instructionText}>
              Select users to add or remove from the room. Admin users cannot be removed.
            </Text>
          </View>
        );

      case 'sectionHeader':
        return (
          <Text style={styles.sectionTitle}>
            {item.title} ({item.count})
          </Text>
        );

      case 'user': {
        const { user, isExistingMember, isAdmin, isCurrentUser } = item;
        const isDisabled = isAdmin || isCurrentUser;

        return (
          <TouchableOpacity
            onPress={() => toggleMember(user.userId, isAdmin, isCurrentUser)}
            disabled={isDisabled}
            style={[
              styles.userItem,
              isExistingMember ? styles.userItemExisting : styles.userItemNew,
              isDisabled && styles.userItemDisabled,
            ]}
            activeOpacity={isDisabled ? 1 : 0.7}
          >
            <View style={styles.userInfo}>
              <View style={[styles.avatar, isExistingMember ? styles.avatarExisting : styles.avatarNew]}>
                <Ionicons name="person" size={20} color={isExistingMember ? '#3b82f6' : '#6b7280'} />
              </View>
              <View style={styles.userTextContainer}>
                <Text style={styles.userName}>
                  {user.fullName || 'Unknown'}
                  {isCurrentUser && ' (You)'}
                </Text>
                {isAdmin && <Text style={styles.adminBadge}>Admin</Text>}
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                selectedMembers.has(user.userId) ? styles.checkboxSelected : styles.checkboxUnselected,
              ]}
            >
              {selectedMembers.has(user.userId) && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>
        );
      }

      case 'empty':
        return (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No users found</Text>
          </View>
        );

      default:
        return null;
    }
  }, [selectedMembers, toggleMember]);

  const getItemKey = useCallback((item: ListItem, index: number) => {
    switch (item.type) {
      case 'instruction':
        return 'instruction';
      case 'sectionHeader':
        return `section-${item.title}`;
      case 'user':
        return `user-${item.user.userId}`;
      case 'empty':
        return 'empty';
      default:
        return String(index);
    }
  }, []);

  if (isFetchingUsers) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar - Fixed at top */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={<View style={styles.listFooter} />}
        removeClippedSubviews={false}
      />

      {/* Fixed Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          onPress={onClose}
          disabled={isLoading}
          style={styles.cancelButton}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleUpdate}
          disabled={isLoading}
          style={[styles.updateButton, isLoading && styles.updateButtonDisabled]}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.updateButtonText}>Update</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#111827',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  listFooter: {
    height: 24,
  },
  instructionBox: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionText: {
    color: '#1E40AF',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  userItemExisting: {
    backgroundColor: '#F9FAFB',
  },
  userItemNew: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userItemDisabled: {
    opacity: 0.5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarExisting: {
    backgroundColor: '#DBEAFE',
  },
  avatarNew: {
    backgroundColor: '#F3F4F6',
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  adminBadge: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
  },
  checkboxUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});