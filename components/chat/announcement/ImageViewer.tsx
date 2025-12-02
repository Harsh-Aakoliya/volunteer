import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { cssInterop } from "nativewind";
import ImageZoomViewer from 'react-native-image-zoom-viewer';

interface CustomImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  title?: string;
}

// Create styled components with cssInterop
const StyledView = cssInterop(View, { className: 'style' });
const StyledText = cssInterop(Text, { className: 'style' });
const StyledTouchableOpacity = cssInterop(TouchableOpacity, { className: 'style' });

export default function CustomImageViewer({ 
  visible, 
  imageUri, 
  onClose, 
  title 
}: CustomImageViewerProps) {
  // Prepare image data for the viewer
  const images = [
    {
      url: imageUri,
      // Optional: Add width and height if known
    }
  ];

  const renderHeader = () => (
    <StyledView className="flex-row justify-between items-center px-5 py-3 pt-12 z-10">
      {title && (
        <StyledText className="text-white text-base font-medium flex-1 mr-4" numberOfLines={1}>
          {title}
        </StyledText>
      )}
      <StyledTouchableOpacity
        className="bg-black bg-opacity-60 px-3 py-2 rounded-full"
        onPress={onClose}
      >
        <StyledText className="text-white text-base">Close</StyledText>
      </StyledTouchableOpacity>
    </StyledView>
  );

  const renderIndicator = () => <View />; // Hide page indicator since we only have one image

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <ImageZoomViewer
        imageUrls={images}
        onCancel={onClose}
        enableSwipeDown={true}
        // renderHeader={renderHeader}
        renderIndicator={renderIndicator}
        backgroundColor="black"
        enablePreload={true}
        saveToLocalByLongPress={false}
        menuContext={{ saveToLocal: 'Save to Photos', cancel: 'Cancel' }}
        onSaveToCamera={() => {
          Alert.alert('Info', 'Image saved to gallery');
        }}
        failImageSource={{
          url: 'https://via.placeholder.com/300x300?text=Image+Not+Found',
          width: 300,
          height: 300,
        }}
      />
    </Modal>
  );
}

