import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';

interface ImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  title?: string;
}

export default function ImageViewer({ 
  visible, 
  imageUri, 
  onClose, 
  title 
}: ImageViewerProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.header}>
          {title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
          maximumZoomScale={3}
          minimumZoomScale={1}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            onError={() => {
              console.error("Image load error for:", imageUri);
              Alert.alert("Error", "Failed to load image");
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 15,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 20,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
});