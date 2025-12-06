// components/chat/roomSettings/MessagingPermissionBottomSheet.tsx
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
import { updateMessagingPermissions } from '@/api/chat';
import { showToast } from '@/utils/toast';

interface Member {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
  canSendMessage: boolean;
}

interface MessagingPermissionBottomSheetProps {
  roomId: string;
  members: Member[];
  onClose: () => void;
  onSuccess: () => void;
}

type ListItem =
  | { type: 'instruction' }
  | { type: 'sectionHeader'; title: string; count: number; subtitle?: string }
  | { type: 'adminMember'; member: Member }
  | { type: 'nonAdminMember'; member: Member }
  | { type: 'empty' };

export default function MessagingPermissionBottomSheet({
  roomId,
  members,
  onClose,
  onSuccess,
}: MessagingPermissionBottomSheetProps) {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const adminMembers = members.filter(m => m.isAdmin);
  const nonAdminMembers = members.filter(m => !m.isAdmin);

  useEffect(() => {
    const usersWithPermission = members
      .filter(m => m.canSendMessage && !m.isAdmin)
      .map(m => m.userId);
    setSelectedUsers(new Set(usersWithPermission));
  }, [members]);

  // Build list data
  const listData = useMemo<ListItem[]>(() => {
    const data: ListItem[] = [];

    // Instruction
    data.push({ type: 'instruction' });

    // Admin Members Section
    if (adminMembers.length > 0) {
      data.push({
        type: 'sectionHeader',
        title: 'Admins',
        count: adminMembers.length,
        subtitle: 'Always Allowed',
      });
      adminMembers.forEach(member => {
        data.push({ type: 'adminMember', member });
      });
    }

    // Non-Admin Members Section
    if (nonAdminMembers.length > 0) {
      data.push({
        type: 'sectionHeader',
        title: 'Other Members',
        count: nonAdminMembers.length,
      });
      nonAdminMembers.forEach(member => {
        data.push({ type: 'nonAdminMember', member });
      });
    } else if (adminMembers.length > 0) {
      data.push({ type: 'empty' });
    }

    return data;
  }, [adminMembers, nonAdminMembers]);

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const handleUpdate = async () => {
    try {
      setIsLoading(true);
      const adminIds = adminMembers.map(m => m.userId);
      const allowedUserIds = [...adminIds, ...Array.from(selectedUsers)];
      await updateMessagingPermissions(roomId, allowedUserIds);
      showToast('Messaging permissions updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating messaging permissions:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update messaging permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    switch (item.type) {
      case 'instruction':
        return (
          <View style={styles.instructionBox}>
            <Text style={styles.instructionText}>
              Select non-admin members who can send messages. Admin users always have messaging permission.
            </Text>
          </View>
        );

      case 'sectionHeader':
        return (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>
              {item.title} ({item.count})
              {item.subtitle && (
                <Text style={styles.sectionSubtitle}> - {item.subtitle}</Text>
              )}
            </Text>
          </View>
        );

      case 'adminMember':
        return (
          <View style={[styles.memberItem, styles.memberItemDisabled]}>
            <View style={styles.memberInfo}>
              <View style={[styles.avatar, styles.avatarAdmin]}>
                <Ionicons name="person" size={20} color="#3b82f6" />
              </View>
              <View style={styles.memberTextContainer}>
                <Text style={styles.memberName}>{item.member.fullName || 'Unknown'}</Text>
                <Text style={styles.adminBadge}>Admin</Text>
              </View>
            </View>
            <View style={[styles.checkbox, styles.checkboxSelected]}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
          </View>
        );

      case 'nonAdminMember':
        return (
          <TouchableOpacity
            onPress={() => toggleUser(item.member.userId)}
            style={[styles.memberItem, styles.memberItemNormal]}
            activeOpacity={0.7}
          >
            <View style={styles.memberInfo}>
              <View style={[styles.avatar, styles.avatarNormal]}>
                <Ionicons name="person" size={20} color="#6b7280" />
              </View>
              <View style={styles.memberTextContainer}>
                <Text style={styles.memberName}>{item.member.fullName || 'Unknown'}</Text>
                {selectedUsers.has(item.member.userId) && (
                  <Text style={styles.permissionBadge}>Can send messages</Text>
                )}
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                selectedUsers.has(item.member.userId)
                  ? styles.checkboxSelected
                  : styles.checkboxUnselected,
              ]}
            >
              {selectedUsers.has(item.member.userId) && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>
        );

      case 'empty':
        return (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No non-admin members in this room</Text>
          </View>
        );

      default:
        return null;
    }
  };

  const getItemKey = (item: ListItem, index: number) => {
    switch (item.type) {
      case 'instruction':
        return 'instruction';
      case 'sectionHeader':
        return `section-${item.title}`;
      case 'adminMember':
        return `admin-${item.member.userId}`;
      case 'nonAdminMember':
        return `member-${item.member.userId}`;
      case 'empty':
        return 'empty';
      default:
        return String(index);
    }
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
  sectionHeaderContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  memberItemNormal: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberItemDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
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
  permissionBadge: {
    fontSize: 12,
    color: '#10B981',
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