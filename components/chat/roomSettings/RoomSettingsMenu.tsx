// components/chat/roomSettings/RoomSettingsMenu.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { leaveRoom, deleteRoom } from '@/api/chat';
import { showToast } from '@/utils/toast';
import AssignAdminBottomSheet from './AssignAdminBottomSheet';
import AddRemoveMembersBottomSheet from './AddRemoveMembersBottomSheet';
import MessagingPermissionBottomSheet from './MessagingPermissionBottomSheet';
import RenameRoomBottomSheet from './RenameRoomBottomSheet';

interface Member {
  userId: string;
  fullName: string | null;
  isAdmin: boolean;
  canSendMessage: boolean;
}

interface MenuOption {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  danger?: boolean;
  disabled?: boolean;
}

interface RoomSettingsMenuProps {
  roomId: string;
  roomName: string;
  roomDescription?: string;
  members: Member[];
  currentUserId: string;
  isCreator: boolean;
  isGroupAdmin: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

type ModalType = 'assign-admin' | 'add-members' | 'message-permissions' | 'rename-room' | null;

export default function RoomSettingsMenu({
  roomId,
  roomName,
  roomDescription,
  members,
  currentUserId,
  isCreator,
  isGroupAdmin,
  onClose,
  onRefresh,
}: RoomSettingsMenuProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Count number of admins
  const adminCount = members.filter(m => m.isAdmin).length;
  const canLeaveRoom = adminCount > 1 || !isGroupAdmin;

  const menuOptions: MenuOption[] = [
    {
      id: 'assign-admin',
      title: 'Assign/Remove Group Admin',
      subtitle: 'Manage admin privileges',
      icon: 'shield-checkmark-outline',
      iconColor: '#8B5CF6',
      bgColor: '#F3E8FF',
    },
    {
      id: 'add-members',
      title: 'Add/Remove Members',
      subtitle: 'Manage room membership',
      icon: 'people-outline',
      iconColor: '#10B981',
      bgColor: '#D1FAE5',
    },
    {
      id: 'message-permissions',
      title: 'Messaging Permission',
      subtitle: 'Control who can send messages',
      icon: 'chatbox-outline',
      iconColor: '#3B82F6',
      bgColor: '#DBEAFE',
    },
    {
      id: 'rename-room',
      title: 'Rename Chatroom',
      subtitle: 'Change room name and description',
      icon: 'pencil-outline',
      iconColor: '#F59E0B',
      bgColor: '#FEF3C7',
    },
    {
      id: 'leave-room',
      title: 'Leave Chatroom',
      subtitle: canLeaveRoom ? 'Exit from this conversation' : 'Add another admin first',
      icon: 'exit-outline',
      iconColor: '#EF4444',
      bgColor: '#FEE2E2',
      danger: true,
      disabled: !canLeaveRoom,
    },
  ];

  // Show delete option to all group admins
  if (isGroupAdmin) {
    menuOptions.push({
      id: 'delete-room',
      title: 'Delete Chatroom',
      subtitle: 'Permanently delete this room',
      icon: 'trash-outline',
      iconColor: '#DC2626',
      bgColor: '#FEE2E2',
      danger: true,
    });
  }

  // Handle modal open
  const openModal = (type: ModalType) => {
    setActiveModal(type);
  };

  // Handle modal close
  const closeModal = () => {
    setActiveModal(null);
  };

  // Handle modal success
  const handleModalSuccess = () => {
    closeModal();
    onRefresh();
  };

  // Handle Android back button
  useEffect(() => {
    if (activeModal) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        closeModal();
        return true; // Prevent default back action
      });

      return () => backHandler.remove();
    }
  }, [activeModal]);

  // Handle leave room
  const handleLeaveRoom = () => {
    if (!canLeaveRoom) {
      Alert.alert(
        'Cannot Leave Room',
        'You are the only admin. Please assign another admin before leaving or delete the room.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Leave Chatroom',
      'Are you sure you want to leave this room? You will no longer have access to messages and updates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              await leaveRoom(roomId);
              showToast('You have left the room');
              onClose();
              router.replace('/(drawer)');
            } catch (error: any) {
              console.error('Error leaving room:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to leave room');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  // Handle delete room
  const handleDeleteRoom = () => {
    Alert.alert(
      'Delete Chatroom',
      'Are you sure you want to permanently delete this room? This action cannot be undone and all messages will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              await deleteRoom(roomId);
              showToast('Room deleted successfully');
              onClose();
              router.replace('/(drawer)');
            } catch (error: any) {
              console.error('Error deleting room:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete room');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleOptionPress = (option: MenuOption) => {
    if (option.disabled) {
      return;
    }

    switch (option.id) {
      case 'assign-admin':
        openModal('assign-admin');
        break;
      case 'add-members':
        openModal('add-members');
        break;
      case 'message-permissions':
        openModal('message-permissions');
        break;
      case 'rename-room':
        openModal('rename-room');
        break;
      case 'leave-room':
        handleLeaveRoom();
        break;
      case 'delete-room':
        handleDeleteRoom();
        break;
    }
  };

  return (
    <>
      <View style={styles.container}>
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}

        {menuOptions.map((option, index) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.optionItem,
              index === menuOptions.length - 1 && styles.lastOption,
              option.disabled && styles.disabledOption,
            ]}
            onPress={() => handleOptionPress(option)}
            activeOpacity={option.disabled ? 1 : 0.7}
            disabled={option.disabled || isProcessing}
          >
            {/* Icon Container */}
            <View style={[styles.iconContainer, { backgroundColor: option.bgColor }]}>
              <Ionicons 
                name={option.icon} 
                size={22} 
                color={option.disabled ? '#9CA3AF' : option.iconColor} 
              />
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text 
                style={[
                  styles.optionTitle, 
                  option.danger && !option.disabled && styles.dangerText,
                  option.disabled && styles.disabledText
                ]}
              >
                {option.title}
              </Text>
              {option.subtitle && (
                <Text style={[styles.optionSubtitle, option.disabled && styles.disabledText]}>
                  {option.subtitle}
                </Text>
              )}
            </View>

            {/* Arrow */}
            <Ionicons
              name="chevron-forward"
              size={20}
              color={option.disabled ? '#D1D5DB' : option.danger ? '#EF4444' : '#9CA3AF'}
            />
          </TouchableOpacity>
        ))}

        {/* Footer Note */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
          <Text style={styles.footerText}>
            Only group admins can manage room settings
          </Text>
        </View>
      </View>

      {/* Modals */}
      
      {/* Assign Admin Modal */}
      <Modal
        visible={activeModal === 'assign-admin'}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={closeModal}
              style={styles.modalCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign/Remove Group Admin</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.modalContent}>
            <AssignAdminBottomSheet
              roomId={roomId}
              members={members}
              onClose={closeModal}
              onSuccess={handleModalSuccess}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add/Remove Members Modal */}
      <Modal
        visible={activeModal === 'add-members'}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={closeModal}
              style={styles.modalCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add/Remove Members</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.modalContent}>
            <AddRemoveMembersBottomSheet
              roomId={roomId}
              currentMembers={members}
              currentUserId={currentUserId}
              onClose={closeModal}
              onSuccess={handleModalSuccess}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Messaging Permission Modal */}
      <Modal
        visible={activeModal === 'message-permissions'}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={closeModal}
              style={styles.modalCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Messaging Permission</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.modalContent}>
            <MessagingPermissionBottomSheet
              roomId={roomId}
              members={members}
              onClose={closeModal}
              onSuccess={handleModalSuccess}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Rename Room Modal */}
      <Modal
        visible={activeModal === 'rename-room'}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={closeModal}
              style={styles.modalCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Rename Chatroom</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.modalContent}>
            <RenameRoomBottomSheet
              roomId={roomId}
              currentName={roomName}
              currentDescription={roomDescription}
              onClose={closeModal}
              onSuccess={handleModalSuccess}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  disabledOption: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  dangerText: {
    color: '#EF4444',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
});