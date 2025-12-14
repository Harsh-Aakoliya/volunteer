// components/chat/DateSeparator.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDateForDisplay } from '@/utils/messageHelpers';

interface DateSeparatorProps {
  date: string;
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{formatDateForDisplay(date)}</Text>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  text: {
    marginHorizontal: 12,
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default React.memo(DateSeparator);