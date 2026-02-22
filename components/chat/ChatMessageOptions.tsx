import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    Alert,
    Clipboard,
    Platform,
    ActivityIndicator
} from "react-native";
import { Message, ChatUser, ChatRoom } from "@/types/type";
import { Ionicons } from '@expo/vector-icons';
import InfoMessageModal from './InfoMessageModal';
import ForwardMessagesModal from './ForwardMessagesModal';
import { ToastAndroid } from 'react-native';
import { isHtmlContent, stripHtml } from '@/components/chat/message';

type ChatMessageOptionProps = {
    selectedMessages: Message[];
    setSelectedMessages: any;
    isAdmin?: boolean;
    canSendMessage?: boolean;
    onClose: () => void;
    /** Called when user confirms forward; modal is shown inside this component. */
    onForward: (selectedRooms: ChatRoom[], messagesToForward: Message[]) => Promise<void>;
    onDeletePress: (messageIds: (string | number)[]) => Promise<void>;
    roomId?: string | number;
    /** Current room id (string) for filtering in forward modal. */
    currentRoomId: string;
    roomMembers?: ChatUser[];
    currentUser?: {
        userId: string;
        fullName: string | null;
    } | null;
    onMessageEdited?: (editedMessage: Message) => void;
    /** Called when user taps Edit – parent should open edit modal and clear selection */
    onEditPress?: (message: Message) => void;
}

const ChatMessageOptions: React.FC<ChatMessageOptionProps> = ({ 
    selectedMessages,
    setSelectedMessages,
    isAdmin = false,
    canSendMessage = true,
    onClose = () => {},
    onForward,
    onDeletePress,
    roomId,
    currentRoomId,
    roomMembers = [],
    currentUser = null,
    onMessageEdited,
    onEditPress
}) => {
    const [showPinOptions, setShowPinOptions] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const selectedCount = selectedMessages.length;
    const isSingleSelection = selectedCount === 1;
    const selectedMessage = isSingleSelection ? selectedMessages[0] : null;
    const isTextMessage = selectedMessage?.messageType === 'text';
    const hasMessageText = selectedMessage?.messageText && selectedMessage.messageText.trim() !== '';
    
    // Permission checks based on user role:
    // - Admin: can delete/edit any message
    // - Can send message: can delete/edit own messages only
    // - Cannot send message: cannot delete/edit any message
    
    // Check if user can edit the selected message
    // Admin can edit any text message, canSendMessage users can only edit their own text messages
    const canEditMessage = isSingleSelection && isTextMessage && hasMessageText && 
        !(typeof selectedMessage?.id === 'string' && selectedMessage?.id.startsWith('temp-')) &&
        (isAdmin || (canSendMessage && selectedMessage?.senderId === currentUser?.userId));

    // Check if user can delete the selected messages
    // Admin can delete any message, canSendMessage users can only delete their own messages
    const canDeleteMessages = (isAdmin || canSendMessage) && 
        (isAdmin || selectedMessages.every(msg => msg.senderId === currentUser?.userId));

    // Check if user can see info for the selected message (only message sender)
    const canShowInfo = isSingleSelection && selectedMessage?.senderId === currentUser?.userId;

    // Show component if there are selected messages OR a modal is open (info/forward)
    const hasModalOpen = showInfoModal || showForwardModal;
    if (selectedCount === 0 && !hasModalOpen) {
        return null;
    }

    // Pin functionality
    const handlePin = (type: 'self' | 'others') => {
        setShowPinOptions(false);
        console.log(`Pinning ${selectedCount} messages for ${type}`);
        // TODO: Implement pin API call
        Alert.alert('Success', `Messages pinned for ${type}`);
        onClose();
    };

    // Delete functionality: show "Deleting..." and run delete; clear selection when done
    const handleDelete = () => {
        if (isDeleting || !canDeleteMessages) return;
        const messageIds = selectedMessages.map(msg => msg.id);
        setIsDeleting(true);
        onDeletePress(messageIds)
            .then(() => {
                setSelectedMessages([]);
                onClose();
            })
            .catch((error) => {
                console.error('Error deleting messages:', error);
                Alert.alert('Error', 'Failed to delete messages. Please try again.');
            })
            .finally(() => setIsDeleting(false));
    };

    // Edit: notify parent to open edit modal and clear selection (modal lives in parent so it stays visible)
    const handleEdit = () => {
        if (selectedMessage && canEditMessage && onEditPress) {
            onEditPress(selectedMessage);
        }
    };

    // Copy functionality: plain text copies directly; rich text shows dialog (Plain vs Rich)
    const handleCopy = () => {
        if (!selectedMessage?.messageText) return;
        const text = selectedMessage.messageText;
        if (isHtmlContent(text)) {
            Alert.alert(
                'Copy as',
                'This message has formatting. How would you like to copy?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Plain text',
                        onPress: () => {
                            Clipboard.setString(stripHtml(text));
                            if (Platform.OS === 'android') ToastAndroid.show('Copied as plain text', ToastAndroid.SHORT);
                            onClose();
                        }
                    },
                    {
                        text: 'Rich text (with formatting)',
                        onPress: () => {
                            Clipboard.setString(text);
                            if (Platform.OS === 'android') ToastAndroid.show('Copied with formatting', ToastAndroid.SHORT);
                            onClose();
                        }
                    }
                ]
            );
        } else {
            Clipboard.setString(text);
            if (Platform.OS === 'android') ToastAndroid.show('Message copied to clipboard', ToastAndroid.SHORT);
            onClose();
        }
    };

    // Forward functionality – open modal inside this component (same as Edit)
    const handleForward = () => {
        setShowForwardModal(true);
    };

    const handleForwardComplete = async (selectedRooms: ChatRoom[], messagesToForward: Message[]) => {
        await onForward(selectedRooms, messagesToForward);
        setShowForwardModal(false);
        onClose();
    };

    // Reply functionality
    const handleReply = () => {
        if (selectedMessage) {
            console.log('Replying to message:', selectedMessage.id);
            // TODO: Implement reply functionality - set reply context
            Alert.alert('Reply', 'Reply functionality to be implemented');
            onClose();
        }
    };

    // Info functionality
    const handleInfo = () => {
        if (selectedMessage) {
            console.log('Showing info for message:', selectedMessage.id);
            setShowInfoModal(true);
        }
    };

    const handlePinPress = () => {
        if (isAdmin) {
            setShowPinOptions(!showPinOptions);
        } else {
            handlePin('self');
        }
    };

    return (
        <View className="bg-white border-b border-gray-200 shadow-sm">
            {/* Main options strip - only when there are selected messages */}
            {selectedCount > 0 && (
            <View className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                <View className="flex-row items-center justify-between">
                    <View className={`flex-row items-center`}>
                        {/* Close - disabled while deleting */}
                        <TouchableOpacity onPress={() => setSelectedMessages([])} disabled={isDeleting}>
                            <Ionicons name="close" size={20} color={isDeleting ? "#9CA3AF" : "#6B7280"} />
                        </TouchableOpacity>

                        {isDeleting ? (
                            <View className="flex-row items-center ml-2">
                                <ActivityIndicator size="small" color="#1D4ED8" />
                                <Text className="text-sm font-medium text-blue-800 ml-2">Deleting...</Text>
                            </View>
                        ) : (
                            <Text className="text-sm font-medium text-blue-800 ml-2">
                                {selectedCount} selected
                            </Text>
                        )}
                    </View>
                    <View className="flex-row items-center space-x-6">
                        {/* Delete - Group admins can delete any message */}
                        <TouchableOpacity 
                            onPress={handleDelete} 
                            disabled={!canDeleteMessages || isDeleting}
                            className="p-2"
                        >
                            <Ionicons 
                                name="trash-outline" 
                                size={24} 
                                color={!canDeleteMessages || isDeleting ? "#9CA3AF" : "#DC2626"} 
                            />
                        </TouchableOpacity>

                        {/* Edit - Only for single text message and if user can edit */}
                        <TouchableOpacity 
                            onPress={handleEdit} 
                            disabled={!canEditMessage || isDeleting}
                            className="p-2"
                        >
                            <Ionicons 
                                name="create-outline" 
                                size={24} 
                                color={!canEditMessage || isDeleting ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        {/* Copy - Only for single text message */}
                        <TouchableOpacity 
                            onPress={handleCopy} 
                            disabled={!isSingleSelection || !isTextMessage || !hasMessageText || isDeleting}
                            className="p-2"
                        >
                            <Ionicons 
                                name="copy-outline" 
                                size={24} 
                                color={(!isSingleSelection || !isTextMessage || !hasMessageText || isDeleting) ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        {/* Forward */}
                        <TouchableOpacity onPress={handleForward} disabled={isDeleting} className="p-2">
                            <Ionicons name="arrow-redo-outline" size={24} color={isDeleting ? "#9CA3AF" : "#1F2937"} />
                        </TouchableOpacity>

                        {/* Info - Only for message sender */}
                        <TouchableOpacity 
                            onPress={handleInfo} 
                            disabled={!canShowInfo || isDeleting}
                            className="p-2"
                        >
                            <Ionicons 
                                name="information-circle-outline" 
                                size={24} 
                                color={!canShowInfo || isDeleting ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        
                    </View>
                </View>
            </View>
            )}

            {/* Pin options (only show if admin and pin button was pressed) */}
            {selectedCount > 0 && showPinOptions && isAdmin && (
                <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <View className="flex-row items-center justify-center space-x-6">
                        <TouchableOpacity 
                            onPress={() => handlePin('self')}
                            className="flex-row items-center px-3 py-1 bg-blue-100 rounded-full"
                        >
                            <Ionicons name="person-outline" size={16} color="#1D4ED8" />
                            <Text className="text-blue-800 text-sm ml-1">Pin for me</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => handlePin('others')}
                            className="flex-row items-center px-3 py-1 bg-green-100 rounded-full"
                        >
                            <Ionicons name="people-outline" size={16} color="#059669" />
                            <Text className="text-green-800 text-sm ml-1">Pin for all</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Info Message Modal */}
            <InfoMessageModal
                visible={showInfoModal}
                onClose={() => {
                    setShowInfoModal(false);
                    onClose();
                }}
                message={selectedMessage}
            />

            {/* Forward Message Modal – same pattern as EditMessageModal */}
            <ForwardMessagesModal
                visible={showForwardModal}
                onClose={() => setShowForwardModal(false)}
                selectedMessages={selectedMessages}
                currentRoomId={currentRoomId}
                onForward={handleForwardComplete}
            />
        </View>
    );
};

export default ChatMessageOptions;