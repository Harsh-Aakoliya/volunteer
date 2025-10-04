import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RichText, Toolbar, useEditorBridge } from '@10play/tentap-editor';

const CNQuillTestSection: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  
  // Tentap Editor Bridge with default StarterKit
  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: 'Start editing your announcement here...',
    dynamicHeight: true,
  });

  const handleContentChange = () => {
    // Tentap editor content changes are handled internally
    console.log('Content changed via Tentap editor');
  };

  const handlePreview = () => {
    setShowPreview(!showPreview);
  };

  const handleGetContent = async () => {
    try {
      // Get HTML content from editor
      const html = await editor.getHTML();
      console.log('Editor HTML content:', html);
      Alert.alert('Content Retrieved', `HTML length: ${html.length} characters`);
      setEditorContent(html);
    } catch (error) {
      console.error('Error getting content:', error);
      Alert.alert('Error', 'Failed to get content');
    }
  };

  const handleSetSampleContent = () => {
    try {
      // Tentap editor uses setContent method
      const sampleContent = `
        <h1>Sample Announcement</h1>
        <p>This is a <strong>sample announcement</strong> with <em>rich text formatting</em>.</p>
        <ul>
          <li>First bullet point</li>
          <li>Second bullet point with <a href="https://example.com">a link</a></li>
          <li>Third bullet point</li>
        </ul>
        <p>Here's a numbered list:</p>
        <ol>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ol>
        <blockquote>
          <p>This is a blockquote with important information.</p>
        </blockquote>
        <p>End of sample content.</p>
      `;
      
      editor.setContent(sampleContent);
      Alert.alert('Content Set', 'Sample content has been loaded into the editor');
    } catch (error) {
      console.error('Error setting content:', error);
      Alert.alert('Error', 'Failed to set content');
    }
  };

  const handleClearContent = () => {
    try {
      // Tentap editor uses setContent with empty string to clear
      editor.setContent('');
      setEditorContent('');
      Alert.alert('Content Cleared', 'Editor content has been cleared');
    } catch (error) {
      console.error('Error clearing content:', error);
      Alert.alert('Error', 'Failed to clear content');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Tentap Editor Test</Text>
        <Text style={styles.subtitle}>Test the @10play/tentap-editor rich text editor</Text>
      </View>
      
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        style={styles.openButton}
      >
        <Text style={styles.buttonText}>Open Tentap Editor</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Tentap Rich Text Editor</Text>
            
            <TouchableOpacity
              onPress={handlePreview}
              style={styles.previewButton}
            >
              <Text style={styles.previewButtonText}>
                {showPreview ? 'Editor' : 'Preview'}
              </Text>
            </TouchableOpacity>
          </View>

          {showPreview ? (
            /* Preview Section */
            <ScrollView style={styles.previewContainer}>
              <Text style={styles.previewTitle}>Preview</Text>
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>HTML Content:</Text>
                <ScrollView style={styles.htmlContainer}>
                  <Text style={styles.htmlText} selectable>
                    {editorContent || 'No content yet...'}
                  </Text>
                </ScrollView>
              </View>
            </ScrollView>
          ) : (
            /* Editor Section */
            <View style={styles.editorContainer}>
              <Text style={styles.editorTitle}>Editor</Text>
              
              {/* Toolbar - Move to top for better visibility */}
              <View style={styles.toolbarContainer}>
                <Toolbar editor={editor} />
              </View>
              
              {/* Editor */}
              <View style={styles.editorWrapper}>
                <RichText 
                  editor={editor}
                  style={styles.editor}
                />
              </View>
            </View>
          )}

          {/* Test Controls */}
          <View style={styles.controlsContainer}>
            <View style={styles.controlsRow}>
              <TouchableOpacity
                onPress={handleGetContent}
                style={styles.controlButton}
              >
                <Text style={styles.controlButtonText}>Get Content</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleSetSampleContent}
                style={[styles.controlButton, styles.greenButton]}
              >
                <Text style={styles.controlButtonText}>Set Sample</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleClearContent}
                style={[styles.controlButton, styles.redButton]}
              >
                <Text style={styles.controlButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#a16207',
  },
  openButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  previewButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  previewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  previewLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  htmlContainer: {
    maxHeight: 300,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  htmlText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'monospace',
  },
  editorContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  toolbarContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 50,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  editorWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  editor: {
    flex: 1,
    backgroundColor: 'white',
  },
  controlsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  greenButton: {
    backgroundColor: '#10b981',
  },
  redButton: {
    backgroundColor: '#ef4444',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default CNQuillTestSection;