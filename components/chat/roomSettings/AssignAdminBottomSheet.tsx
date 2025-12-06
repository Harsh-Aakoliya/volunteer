// components/chat/roomSettings/AssignAdminBottomSheet.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateGroupAdmins } from '@/api/chat';
import { showToast } from '@/utils/toast';

interface Member {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
}

interface AssignAdminBottomSheetProps {
  roomId: string;
  members: Member[];
  onClose: () => void;
  onSuccess: () => void;
}

type ListItem = 
  | { type: 'instruction' }
  | { type: 'sectionHeader'; title: string; count: number }
  | { type: 'member'; member: Member; isCurrentAdmin: boolean };

export default function AssignAdminBottomSheet({
  roomId,
  members,
  onClose,
  onSuccess,
}: AssignAdminBottomSheetProps) {
  const [selectedAdmins, setSelectedAdmins] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const currentAdmins = members.filter(m => m.isAdmin).map(m => m.userId);
    setSelectedAdmins(new Set(currentAdmins));
  }, [members]);

  const adminMembers = members.filter(m => m.isAdmin);
  const nonAdminMembers = members.filter(m => !m.isAdmin);

  // Build list data with sections
  const listData = useMemo<ListItem[]>(() => {
    const data: ListItem[] = [];
    
    // Instruction
    data.push({ type: 'instruction' });
    
    // Current Admins Section
    if (adminMembers.length > 0) {
      data.push({ type: 'sectionHeader', title: 'Current Admins', count: adminMembers.length });
      adminMembers.forEach(member => {
        data.push({ type: 'member', member, isCurrentAdmin: true });
      });
    }
    
    // Other Members Section
    if (nonAdminMembers.length > 0) {
      data.push({ type: 'sectionHeader', title: 'Other Members', count: nonAdminMembers.length });
      nonAdminMembers.forEach(member => {
        data.push({ type: 'member', member, isCurrentAdmin: false });
      });
    }
    
    return data;
  }, [adminMembers, nonAdminMembers]);

  const toggleAdmin = (userId: string) => {
    const newSet = new Set(selectedAdmins);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedAdmins(newSet);
  };

  const handleUpdate = async () => {
    if (selectedAdmins.size === 0) {
      Alert.alert('Error', 'Room must have at least one admin');
      return;
    }

    try {
      setIsLoading(true);
      await updateGroupAdmins(roomId, Array.from(selectedAdmins));
      showToast('Group admins updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating group admins:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update group admins');
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'instruction') {
      return (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionText}>
            Select users who should be group admins. At least one admin is required.
          </Text>
        </View>
      );
    }

    if (item.type === 'sectionHeader') {
      return (
        <Text style={styles.sectionTitle}>
          {item.title} ({item.count})
        </Text>
      );
    }

    if (item.type === 'member') {
      const { member, isCurrentAdmin } = item;
      return (
        <TouchableOpacity
          onPress={() => toggleAdmin(member.userId)}
          style={[
            styles.memberItem,
            isCurrentAdmin ? styles.memberItemAdmin : styles.memberItemNormal,
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.memberInfo}>
            <View style={[styles.avatar, isCurrentAdmin ? styles.avatarAdmin : styles.avatarNormal]}>
              <Ionicons name="person" size={20} color={isCurrentAdmin ? '#3b82f6' : '#6b7280'} />
            </View>
            <View style={styles.memberTextContainer}>
              <Text style={styles.memberName}>
                {member.fullName || 'Unknown'}
              </Text>
              {isCurrentAdmin && (
                <Text style={styles.adminBadge}>Admin</Text>
              )}
            </View>
          </View>
          <View
            style={[
              styles.checkbox,
              selectedAdmins.has(member.userId) ? styles.checkboxSelected : styles.checkboxUnselected,
            ]}
          >
            {selectedAdmins.has(member.userId) && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const getItemKey = (item: ListItem, index: number) => {
    if (item.type === 'instruction') return 'instruction';
    if (item.type === 'sectionHeader') return `section-${item.title}`;
    if (item.type === 'member') return item.member.userId;
    return String(index);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        ListFooterComponent={<View style={styles.listFooter} />}
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
          disabled={isLoading || selectedAdmins.size === 0}
          style={[
            styles.updateButton,
            (isLoading || selectedAdmins.size === 0) && styles.updateButtonDisabled,
          ]}
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
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  memberItemAdmin: {
    backgroundColor: '#F9FAFB',
  },
  memberItemNormal: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberInfo: {
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
  avatarAdmin: {
    backgroundColor: '#DBEAFE',
  },
  avatarNormal: {
    backgroundColor: '#F3F4F6',
  },
  memberTextContainer: {
    flex: 1,
  },
  memberName: {
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