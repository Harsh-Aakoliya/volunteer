import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    Alert,
    Clipboard
} from "react-native";
import { Message, ChatUser } from "@/types/type";
import { Ionicons } from '@expo/vector-icons';
import EditMessageModal from './EditMessageModal';
import { ToastAndroid } from 'react-native';
type ChatMessageOptionProps = {
    selectedMessages: Message[];
    setSelectedMessages:any;
    isAdmin?: boolean; // This represents group admin status (admin of the specific chat room)
    onClose: () => void;
    onForwardPress: () => void;
    onDeletePress: (messageIds: (string | number)[]) => Promise<void>;
    onInfoPress?: (message: Message) => void; // Add info press handler
    roomId?: string | number; // Add roomId prop
    roomMembers?: ChatUser[];
    currentUser?: {
        userId: string;
        fullName: string | null;
    } | null;
    onMessageEdited?: (editedMessage: Message) => void;
}

const ChatMessageOptions: React.FC<ChatMessageOptionProps> = ({ 
    selectedMessages,
    setSelectedMessages,
    isAdmin = false, // Group admin status - defaults to false for safety
    onClose = ()=>console.log("closed calling"),
    onForwardPress,
    onDeletePress,
    onInfoPress,
    roomId,
    roomMembers = [],
    currentUser = null,
    onMessageEdited
}) => {
    const [showPinOptions, setShowPinOptions] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const selectedCount = selectedMessages.length;
    const isSingleSelection = selectedCount === 1;
    const selectedMessage = isSingleSelection ? selectedMessages[0] : null;
    const isTextMessage = selectedMessage?.messageType === 'text';
    const hasMessageText = selectedMessage?.messageText && selectedMessage.messageText.trim() !== '';
    
    // Check if user can edit the selected message (only message sender)
    const canEditMessage = isSingleSelection && isTextMessage && hasMessageText && 
        selectedMessage?.senderId === currentUser?.userId &&
        // Don't allow editing temporary messages
        !(typeof selectedMessage?.id === 'string' && selectedMessage?.id.startsWith('temp-'));

    // Check if user can delete the selected messages (only message sender)
    const canDeleteMessages = selectedMessages.every(msg => msg.senderId === currentUser?.userId);

    // Check if user can see info for the selected message (only message sender)
    const canShowInfo = isSingleSelection && selectedMessage?.senderId === currentUser?.userId;

    // Show component if there are selected messages
    // Note: Non-admin users can only select their own messages (enforced in handleMessageLongPress)
    // Admin users can select any messages
    if (selectedCount === 0) {
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

    // Delete functionality
    const handleDelete = async () => {
        const messageIds = selectedMessages.map(msg => msg.id);
        console.log("messageIds",messageIds);
        Alert.alert(
            'Delete Messages',
            `Are you sure you want to delete ${selectedCount} message${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            console.log("deleting messages",messageIds);
                            await onDeletePress(messageIds);
                            onClose();
                        } catch (error) {
                            console.error('Error deleting messages:', error);
                            Alert.alert('Error', 'Failed to delete messages. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    // Edit functionality
    const handleEdit = () => {
        if (selectedMessage && canEditMessage) {
            console.log('Editing message:', selectedMessage.id);
            // Clear selection before opening edit modal
            // setSelectedMessages([]);
            setShowEditModal(true);
        }
    };

    // Handle message edited
    const handleMessageEdited = (editedMessage: Message) => {
        onMessageEdited && onMessageEdited(editedMessage);
        onClose();
    };

    // Copy functionality
    const handleCopy = () => {
        if (selectedMessage && selectedMessage.messageText) {
            Clipboard.setString(selectedMessage.messageText);
            ToastAndroid.show("Message copied to clipboard", ToastAndroid.SHORT);
            // Alert.alert('Copied', 'Message copied to clipboard');
            onClose();
        }
    };

    // Forward functionality
    const handleForward = () => {
        console.log(`Forwarding ${selectedCount} messages`);
        onForwardPress();
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
        if (selectedMessage && onInfoPress) {
            console.log('Showing info for message:', selectedMessage.id);
            onInfoPress(selectedMessage);
            onClose();
        }
    };

    const handlePinPress = () => {
        if (isAdmin) {
            setShowPinOptions(!showPinOptions);
        } else {
            handlePin('self');
        }
    };

    if (selectedCount === 0) return null;

    return (
        <View className="bg-white border-b border-gray-200 shadow-sm">
            {/* Main options strip */}
            <View className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                <View className="flex-row items-center justify-between">
                    <View className={`flex-row items-center`}>
                        {/* Close */}
                        <TouchableOpacity onPress={()=>setSelectedMessages([])}>
                                <Ionicons name="close" size={20} color="#6B7280" />
                            </TouchableOpacity>

                        <Text className="text-sm font-medium text-blue-800">
                            {selectedCount} selected
                        </Text>
                    </View>
                    <View className="flex-row items-center space-x-6">
                        {/* Pin */}
                        {/* <TouchableOpacity onPress={handlePinPress} className="p-2">
                            <Ionicons name="bookmark-outline" size={24} color="#1F2937" />
                        </TouchableOpacity> */}

                        {/* Delete - Group admins can delete any message */}
                        <TouchableOpacity 
                            onPress={handleDelete} 
                            disabled={!canDeleteMessages}
                            className="p-2"
                        >
                            <Ionicons 
                                name="trash-outline" 
                                size={24} 
                                color={!canDeleteMessages ? "#9CA3AF" : "#DC2626"} 
                            />
                        </TouchableOpacity>

                        {/* Edit - Only for single text message and if user can edit */}
                        <TouchableOpacity 
                            onPress={handleEdit} 
                            disabled={!canEditMessage}
                            className="p-2"
                        >
                            <Ionicons 
                                name="create-outline" 
                                size={24} 
                                color={!canEditMessage ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        {/* Copy - Only for single text message */}
                        <TouchableOpacity 
                            onPress={handleCopy} 
                            disabled={!isSingleSelection || !isTextMessage || !hasMessageText}
                            className="p-2"
                        >
                            <Ionicons 
                                name="copy-outline" 
                                size={24} 
                                color={(!isSingleSelection || !isTextMessage || !hasMessageText) ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        {/* Forward */}
                        <TouchableOpacity onPress={handleForward} className="p-2">
                            <Ionicons name="arrow-redo-outline" size={24} color="#1F2937" />
                        </TouchableOpacity>

                        {/* Info - Only for message sender */}
                        <TouchableOpacity 
                            onPress={handleInfo} 
                            disabled={!canShowInfo}
                            className="p-2"
                        >
                            <Ionicons 
                                name="information-circle-outline" 
                                size={24} 
                                color={!canShowInfo ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        
                    </View>
                </View>
            </View>

            {/* Pin options (only show if admin and pin button was pressed) */}
            {showPinOptions && isAdmin && (
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

            {/* Edit Message Modal */}
            <EditMessageModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                message={selectedMessage}
                roomId={roomId || ''}
                roomMembers={roomMembers}
                currentUser={currentUser}
                onMessageEdited={handleMessageEdited}
            />
        </View>
    );
};

export default ChatMessageOptions;