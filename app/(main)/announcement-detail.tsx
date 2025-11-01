
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AnnouncementDetailScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcement Details</Text>
        <View style={styles.rightSpace} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="megaphone" size={40} color="#4A90E2" />
          </View>
          
          <Text style={styles.title}>Important System Update</Text>
          <Text style={styles.date}>October 30, 2025</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.description}>
            We're excited to announce a major system update that brings several new features and improvements to enhance your experience.
          </Text>
          
          <Text style={styles.sectionTitle}>What's New:</Text>
          <Text style={styles.bulletPoint}>• Enhanced user interface with modern design</Text>
          <Text style={styles.bulletPoint}>• Improved performance and faster load times</Text>
          <Text style={styles.bulletPoint}>• New notification system</Text>
          <Text style={styles.bulletPoint}>• Bug fixes and stability improvements</Text>
          
          <Text style={styles.sectionTitle}>Action Required:</Text>
          <Text style={styles.description}>
            Please ensure your app is updated to the latest version to enjoy these new features. The update will be automatically applied within the next 24 hours.
          </Text>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your attention!</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  rightSpace: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 15,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 5,
  },
  footer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '600',
  },
});
