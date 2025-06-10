import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    Alert,
    Clipboard
} from "react-native";
import { Message } from "@/types/type";
import { Ionicons } from '@expo/vector-icons';
type ChatMessageOptionProps = {
    selectedMessages: Message[];
    setSelectedMessages:any;
    isAdmin?: boolean;
    onClose: () => void;
}

const ChatMessageOptions: React.FC<ChatMessageOptionProps> = ({ 
    selectedMessages,
    setSelectedMessages,
    isAdmin = false,
    onClose = ()=>console.log("closed calling")
}) => {
    const [showPinOptions, setShowPinOptions] = useState(false);
    const selectedCount = selectedMessages.length;
    const isSingleSelection = selectedCount === 1;
    const selectedMessage = isSingleSelection ? selectedMessages[0] : null;
    const isTextMessage = selectedMessage?.messageType === 'text';
    const hasMessageText = selectedMessage?.messageText && selectedMessage.messageText.trim() !== '';

    // Pin functionality
    const handlePin = (type: 'self' | 'others') => {
        setShowPinOptions(false);
        console.log(`Pinning ${selectedCount} messages for ${type}`);
        // TODO: Implement pin API call
        Alert.alert('Success', `Messages pinned for ${type}`);
        onClose();
    };

    // Delete functionality
    const handleDelete = () => {
        console.log(`Deleting ${selectedCount} messages`);
        // TODO: Implement delete API call
        Alert.alert('Success', `${selectedCount} message${selectedCount > 1 ? 's' : ''} deleted`);
        onClose();
    };

    // Edit functionality
    const handleEdit = () => {
        if (selectedMessage) {
            console.log('Editing message:', selectedMessage.id);
            // TODO: Implement edit functionality - open edit modal/input
            Alert.alert('Edit', 'Edit functionality to be implemented');
            onClose();
        }
    };

    // Copy functionality
    const handleCopy = () => {
        if (selectedMessage && selectedMessage.messageText) {
            Clipboard.setString(selectedMessage.messageText);
            Alert.alert('Copied', 'Message copied to clipboard');
            onClose();
        }
    };

    // Forward functionality
    const handleForward = () => {
        console.log(`Forwarding ${selectedCount} messages`);
        // TODO: Implement forward functionality - show contacts/groups list
        Alert.alert('Forward', 'Forward functionality to be implemented');
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
            // TODO: Implement info functionality - show message details modal
            const info = `Message ID: ${selectedMessage.id}\nType: ${selectedMessage.messageType}\nSender: ${selectedMessage.senderName}\nCreated: ${new Date(selectedMessage.createdAt).toLocaleString()}`;
            Alert.alert('Message Info', info);
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
                    <View className="flex-row items-center space-x-4">
                        {/* Pin */}
                        <TouchableOpacity onPress={handlePinPress} className="p-1">
                            <Ionicons name="bookmark-outline" size={20} color="#1F2937" />
                        </TouchableOpacity>

                        {/* Delete */}
                        <TouchableOpacity onPress={handleDelete} className="p-1">
                            <Ionicons name="trash-outline" size={20} color="#DC2626" />
                        </TouchableOpacity>

                        {/* Edit - Only for single text message */}
                        <TouchableOpacity 
                            onPress={handleEdit} 
                            disabled={!isSingleSelection || !isTextMessage || !hasMessageText}
                            className="p-1"
                        >
                            <Ionicons 
                                name="create-outline" 
                                size={20} 
                                color={(!isSingleSelection || !isTextMessage || !hasMessageText) ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        {/* Copy - Only for single text message */}
                        <TouchableOpacity 
                            onPress={handleCopy} 
                            disabled={!isSingleSelection || !isTextMessage || !hasMessageText}
                            className="p-1"
                        >
                            <Ionicons 
                                name="copy-outline" 
                                size={20} 
                                color={(!isSingleSelection || !isTextMessage || !hasMessageText) ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        {/* Forward */}
                        <TouchableOpacity onPress={handleForward} className="p-1">
                            <Ionicons name="arrow-redo-outline" size={20} color="#1F2937" />
                        </TouchableOpacity>

                        {/* Reply - Only for single message */}
                        <TouchableOpacity 
                            onPress={handleReply} 
                            disabled={!isSingleSelection}
                            className="p-1"
                        >
                            <Ionicons 
                                name="arrow-undo-outline" 
                                size={20} 
                                color={!isSingleSelection ? "#9CA3AF" : "#1F2937"} 
                            />
                        </TouchableOpacity>

                        {/* Info - Only for single message */}
                        <TouchableOpacity 
                            onPress={handleInfo} 
                            disabled={!isSingleSelection}
                            className="p-1"
                        >
                            <Ionicons 
                                name="information-circle-outline" 
                                size={20} 
                                color={!isSingleSelection ? "#9CA3AF" : "#1F2937"} 
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
        </View>
    );
};

export default ChatMessageOptions;