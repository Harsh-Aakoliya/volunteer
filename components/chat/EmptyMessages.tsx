// components/chat/EmptyMessages.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyMessagesProps {
  isGroupAdmin: boolean;
}

const EmptyMessages: React.FC<EmptyMessagesProps> = ({ isGroupAdmin }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="chatbubble-outline" size={60} color="#d1d5db" />
      <Text style={styles.text}>
        No messages yet.{' '}
        {isGroupAdmin
          ? 'Be the first to send a message!'
          : 'Only group admins can send messages in this room.'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    marginTop: 40,
  },
  text: {
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
  },
});

export default React.memo(EmptyMessages);