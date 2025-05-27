// import React, { useRef, forwardRef, useState, useCallback,useEffect } from 'react';
// import { View, TouchableOpacity, Text, ScrollView, Dimensions, Modal, SafeAreaView, StatusBar } from 'react-native';
// import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
// import { cssInterop } from "nativewind";
// import WebView from 'react-native-webview';
// import { TextInput, FlatList, Alert } from 'react-native';
// import { fetchAnnouncements, createAnnouncement, updateLikes } from '@/api/admin';
// import { router } from 'expo-router';
// import { AuthStorage } from '@/utils/authStorage';
// import { updateAnnouncement } from '@/api/admin';

// interface Announcement {
//   id: number;
//   title: string;
//   body: string;
//   created_at: string;
//   likes: number;
//   dislikes: number;
// }
// // Update the interface
// interface RichTextEditorProps {
//   initialTitle?: string;
//   initialContent?: string;
//   announcementId?: number;
// }
// // Create a forwarded ref component for RichEditor
// const ForwardedRichEditor = forwardRef<RichEditor, any>((props, ref) => (
//   <RichEditor {...props} ref={ref} />
// ));

// // Use cssInterop with the forwarded ref component
// const StyledRichEditor = cssInterop(ForwardedRichEditor, {
//   className: 'style'
// });

// // Use cssInterop for RichToolbar
// const StyledRichToolbar = cssInterop(RichToolbar, {
//   className: 'style'
// });

// // Use cssInterop for WebView
// const StyledWebView = cssInterop(WebView, {
//   className: 'style'
// });

// // Update the component definition
// const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
//   initialTitle = '', 
//   initialContent = '',
//   announcementId
// }) => {
//    // Update state initialization to use props
//   const richText = useRef<RichEditor>(null);
//   const [content, setContent] = useState<string>(initialContent);
//   const [title, setTitle] = useState<string>(initialTitle);

// // Add this useEffect to update state if props change
//   useEffect(() => {
//     setTitle(initialTitle);
//     setContent(initialContent);
    
//     // Update the editor content if the ref is available
//     if (richText.current && initialContent) {
//       richText.current.setContentHTML(initialContent);
//     }
//   }, [initialTitle, initialContent]);

//   // Update the handleCreateAnnouncement function
//   const handleCreateAnnouncement = async () => {
//     if (!title.trim() || !content.trim()) {
//       Alert.alert('Error', 'Title and Body cannot be empty.');
//       return;
//     }
    
//     try {
//       let result;
      
//       if (announcementId) {
//         // Update existing announcement
//         result = await updateAnnouncement(announcementId, title, content);
//         console.log("Updated announcement:", result);
//       } else {
//         // Create new announcement
//         result = await createAnnouncement(title, content, (await AuthStorage.getUser())?.userId);
//         console.log("Created announcement:", result);
//       }
      
//       setTitle('');
//       setContent('');
      
//       router.replace({
//         pathname: "/announcement",
//         params: { newAnnouncement: JSON.stringify(result) }
//       });
//     } catch (error) {
//       console.error('Error saving announcement:', error);
//       Alert.alert('Error', 'Failed to save announcement. Please try again.');
//     }
//   };


//   // State to control the modal visibility
//   const [modalVisible, setModalVisible] = useState<boolean>(false);
//   const { width } = Dimensions.get('window');

//   // Handle content change
//   const handleContentChange = useCallback((html: string) => {
//     setContent(html);
//   }, []);

//   // Create HTML with proper styling for the preview
//   const getPreviewHTML = useCallback(() => {
//     return `
//       <!DOCTYPE html>
//       <html>
//         <head>
//           <meta name="viewport" content="width=device-width, initial-scale=1.0">
//           <style>
//             body {
//               font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
//               padding: 16px;
//               margin: 0;
//               color: #1f2937;
//               font-size: 16px;
//               line-height: 1.5;
//               background-color: white;
//             }
//             img {
//               max-width: 100%;
//               height: auto;
//             }
//             ul, ol {
//               padding-left: 20px;
//             }
//             a {
//               color: #2563eb;
//               text-decoration: underline;
//             }
//             h1, h2, h3, h4, h5, h6 {
//               margin-top: 1.5em;
//               margin-bottom: 0.5em;
//               line-height: 1.2;
//             }
//             h1 {
//               font-size: 1.8em;
//             }
//             h2 {
//               font-size: 1.5em;
//             }
//             blockquote {
//               border-left: 4px solid #e5e7eb;
//               padding-left: 16px;
//               margin-left: 0;
//               color: #4b5563;
//             }
//             pre {
//               background-color: #f3f4f6;
//               padding: 16px;
//               border-radius: 4px;
//               overflow-x: auto;
//             }
//             code {
//               font-family: monospace;
//               background-color: #f3f4f6;
//               padding: 2px 4px;
//               border-radius: 4px;
//             }
//             .announcement-title {
//               font-size: 24px;
//               font-weight: bold;
//               text-align: center;
//               margin-bottom: 16px;
//               color: #111827;
//             }
//             .announcement-date {
//               text-align: center;
//               margin-bottom: 24px;
//               color: #6b7280;
//             }
//             .announcement-content {
//               margin-top: 16px;
//             }
//           </style>
//         </head>
//         <body>
//           <div class="announcement-title">Announcement Preview</div>
//           <div class="announcement-date">${new Date().toLocaleDateString()}</div>
//           <div class="announcement-content">
//             ${content || '<span style="color: #9ca3af; font-style: italic;">No content to preview</span>'}
//           </div>
//         </body>
//       </html>
//     `;
//   }, [content]);

//   // Toggle modal visibility
//   const toggleModal = () => {
//     setModalVisible(!modalVisible);
//   };

//   return (
//     <SafeAreaView className="flex-1 bg-white pt-5">
//       <ScrollView className="flex-1 px-4 pb-6">
//       <TextInput
//         value={title}
//         onChangeText={setTitle}
//         placeholder="Title"
//         style={{
//           borderWidth: 1,
//           borderColor: '#ccc',
//           padding: 10,
//           marginBottom: 10,
//           borderRadius: 5
//         }}
//       />
//         <Text className="text-xl font-bold my-4">Rich Text Editor</Text>
        
//         {/* Toolbar */}
//         <StyledRichToolbar
//           editor={richText}
//           className="border border-gray-300 rounded-t-lg"
//           selectedIconTint="#2563EB" // tailwind blue-600
//           iconTint="#6B7280" // tailwind gray-500
//           actions={[
//             actions.setBold,
//             actions.setItalic,
//             actions.setUnderline,
//             actions.heading1,
//             actions.heading2,
//             actions.insertBulletsList,
//             actions.insertOrderedList,
//             actions.insertLink,
//             actions.insertImage,
//             actions.alignLeft,
//             actions.alignCenter,
//             actions.alignRight,
//             actions.code,
//             actions.blockquote,
//             actions.line,
//             actions.undo,
//             actions.redo,
//           ]}
//         />
        
//         {/* Editor - Now with proper ref forwarding and onChange handler */}
//         <StyledRichEditor
//           className="min-h-64 border border-gray-300 border-t-0 rounded-b-lg p-2 bg-white"
//           placeholder="Start typing..."
//           initialHeight={250}
//           ref={richText}
//           onChange={handleContentChange}
//           editorStyle={{
//             contentCSSText: `
//               font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
//               font-size: 16px;
//               padding: 8px;
//             `
//           }}
//         />
        
//         {/* Custom Buttons */}
//         <View className="flex-row justify-end mt-4 space-x-2">
//           <TouchableOpacity 
//             className="bg-gray-200 py-2 px-4 rounded-lg"
//             onPress={() => {
//               if (richText.current) {
//                 richText.current.setContentHTML('');
//                 setContent('');
//               }
//             }}
//           >
//             <Text className="text-gray-800">Clear</Text>
//           </TouchableOpacity>
          
//           <TouchableOpacity 
//             className="bg-blue-600 py-2 px-4 rounded-lg"
//             onPress={() => {
//               if (richText.current) {
//                 const currentContent = richText.current.getContentHtml();
//                 console.log('Content:', currentContent);
//                 toggleModal(); // Open the modal with the preview
//               }
//             }}
//           >
//             <Text className="text-white">Save</Text>
//           </TouchableOpacity>
//         </View>
        
//         {/* Live Preview Section */}
//         {/* <View className="mt-8">
//           <Text className="text-xl font-bold mb-2">Live Preview</Text>
//           <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
//             <StyledWebView
//               className="w-full min-h-48"
//               originWhitelist={['*']}
//               source={{ html: getPreviewHTML() }}
//               scrollEnabled={true}
//               showsVerticalScrollIndicator={false}
//             />
//           </View>
//         </View> */}
//       </ScrollView>

//       {/* Modal Preview Window */}
//       <Modal
//         animationType="slide"
//         transparent={false}
//         visible={modalVisible}
//         onRequestClose={toggleModal}
//       >
//         <SafeAreaView className="flex-1 bg-white">
//           <StatusBar barStyle="dark-content" />
          
//           {/* Modal Header */}
//           <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
//             <Text className="text-xl font-bold">Announcement Preview</Text>
//             <View className="flex-row space-x-2">
//               <TouchableOpacity 
//                 className="bg-gray-200 py-2 px-4 rounded-lg"
//                 onPress={toggleModal}
//               >
//                 <Text className="text-gray-800">Cancel</Text>
//               </TouchableOpacity>
              
//               <TouchableOpacity 
//                 className="bg-green-600 py-2 px-4 rounded-lg"
//                 onPress={() => {
//                   console.log('Publishing announcement:', content);
//                   toggleModal();
//                   handleCreateAnnouncement();
//                 }}
//               >
//                 <Text className="text-white">{announcementId ? 'Update' : 'Publish'}</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
          
//           {/* Full Page Preview */}
//           <View className="flex-1">
//             <StyledWebView
//               className="flex-1"
//               originWhitelist={['*']}
//               source={{ html: getPreviewHTML() }}
//               showsVerticalScrollIndicator={true}
//             />
//           </View>
//         </SafeAreaView>
//       </Modal>
//     </SafeAreaView>
//   );
// };

// export default RichTextEditor;


import React, { useRef, forwardRef, useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Dimensions, Modal, SafeAreaView, StatusBar, Alert, ActivityIndicator, Image } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { cssInterop } from "nativewind";
import WebView from 'react-native-webview';
import { TextInput, FlatList } from 'react-native';
import { fetchAnnouncements, createAnnouncement, updateLikes } from '@/api/admin';
import { router } from 'expo-router';
import { AuthStorage } from '@/utils/authStorage';
import { updateAnnouncement } from '@/api/admin';
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { API_URL } from "@/constants/api";

interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
  likes: number;
  dislikes: number;
}

// Update the interface
interface RichTextEditorProps {
  initialTitle?: string;
  initialContent?: string;
  announcementId?: number;
}

type MediaFile = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  caption: string;
};

type UploadingFile = {
  name: string;
  size: number;
  progress: number;
  mimeType: string;
};

// Create a forwarded ref component for RichEditor
const ForwardedRichEditor = forwardRef<RichEditor, any>((props, ref) => (
  <RichEditor {...props} ref={ref} />
));

// Use cssInterop with the forwarded ref component
const StyledRichEditor = cssInterop(ForwardedRichEditor, {
  className: 'style'
});

// Use cssInterop for RichToolbar
const StyledRichToolbar = cssInterop(RichToolbar, {
  className: 'style'
});

// Use cssInterop for WebView
const StyledWebView = cssInterop(WebView, {
  className: 'style'
});

// Format bytes to readable format
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Update the component definition
const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  initialTitle = '', 
  initialContent = '',
  announcementId
}) => {
  // Update state initialization to use props
  const richText = useRef<RichEditor>(null);
  const [content, setContent] = useState<string>(initialContent);
  const [title, setTitle] = useState<string>(initialTitle);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // Add this useEffect to update state if props change
  useEffect(() => {
    setTitle(initialTitle);
    setContent(initialContent);
    
    // Update the editor content if the ref is available
    if (richText.current && initialContent) {
      richText.current.setContentHTML(initialContent);
    }
  }, [initialTitle, initialContent]);

  function getDirectDriveUrl(url: string): string {
    const match = url.match(/\/file\/d\/(.*?)\/|id=([^&]+)/);
    const fileId = match?.[1] || match?.[2];
    return fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : url;
  }
  

  // Function to insert media files into content
  const insertMediaIntoContent = useCallback((uploadedFiles: MediaFile[]) => {
    let mediaHTML = '';
  
    uploadedFiles.forEach((file) => {
      const isImage = file.mimeType.startsWith("image");
      const isVideo = file.mimeType.startsWith("video");
      const isAudio = file.mimeType.startsWith("audio");
  
      // Normalize URL if it's from Google Drive
      const mediaUrl = getDirectDriveUrl(file.url);
  
      if (isImage) {
        mediaHTML += `<div style="margin: 16px 0; text-align: center;">
          <img src="${mediaUrl}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          ${file.caption ? `<p style="margin-top: 8px; font-style: italic; color: #666; font-size: 14px;">${file.caption}</p>` : ''}
        </div>`;
      } else if (isVideo) {
        mediaHTML += `<div style="margin: 16px 0; text-align: center;">
          <video controls style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <source src="${mediaUrl}" type="${file.mimeType}" />
            Your browser does not support the video tag.
          </video>
          ${file.caption ? `<p style="margin-top: 8px; font-style: italic; color: #666; font-size: 14px;">${file.caption}</p>` : ''}
        </div>`;
      } else if (isAudio) {
        mediaHTML += `<div style="margin: 16px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
          <audio controls style="width: 100%; max-width: 400px;">
            <source src="${mediaUrl}" type="${file.mimeType}" />
            Your browser does not support the audio element.
          </audio>
          <p style="margin: 8px 0 0 0; font-weight: bold; color: #333;">${file.name}</p>
          ${file.caption ? `<p style="margin-top: 4px; font-style: italic; color: #666; font-size: 14px;">${file.caption}</p>` : ''}
        </div>`;
      }
    });
  
    const currentContent = content || '';
    const newContent = currentContent + mediaHTML;
  
    if (richText.current) {
      richText.current.setContentHTML(newContent);
    }
    setContent(newContent);
  }, [content]);
  

  // Handle file selection and upload
  const handleSelectFiles = async () => {
    try {
      // Open document picker
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: ["image/*", "audio/*", "video/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      setUploading(true);
      
      // Initialize progress tracking for each file
      const filesToUpload: UploadingFile[] = result.assets.map(asset => ({
        name: asset.name,
        size: asset.size || 0,
        progress: 0,
        mimeType: asset.mimeType || "",
      }));
      
      setUploadingFiles(filesToUpload);

      // Create form data for upload
      const formData = new FormData();
      result.assets.forEach((asset) => {
        formData.append("files", {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream",
        } as any);
      });
      
      const user = await AuthStorage.getUser();
      formData.append("userId", user?.userId.toString() || "");
      formData.append("roomId", "51"); // Using a default room for announcements
      
      try {
        // Use axios with upload progress tracking
        const response = await axios.post(
          `${API_URL}/api/media/upload`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            onUploadProgress: (progressEvent) => {
              const totalSize = result.assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
              const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || totalSize));
              
              // Distribute progress among files proportionally to their size
              if (totalSize > 0) {
                setUploadingFiles(prevFiles => 
                  prevFiles.map(file => ({
                    ...file,
                    progress: (percentCompleted * file.size) / totalSize
                  }))
                );
              }
            },
          }
        );
        
        console.log("response got after uploading files", response.data);
        
        // Add the newly uploaded files to our media files list
        const newFiles = response.data.uploaded.map((file: any, idx: number) => ({
          ...file,
          mimeType: result.assets[idx].mimeType ?? "",
          caption: file.caption || "",
        }));
        
        setMediaFiles((prev) => [...prev, ...newFiles]);
        
        // Insert media into content immediately after upload
        insertMediaIntoContent(newFiles);
        
        // Clear uploading files after successful upload
        setTimeout(() => {
          setUploadingFiles([]);
        }, 1000);
        
        Alert.alert("Success", "Media files uploaded and added to content!");
        
      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Error", "Failed to upload files");
        setUploadingFiles([]);
      } finally {
        setUploading(false);
      }
    } catch (error) {
      console.error("File selection error:", error);
      Alert.alert("Error", "An error occurred while selecting files");
      setUploading(false);
      setUploadingFiles([]);
    }
  };

  // Update the handleCreateAnnouncement function
  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Title and Body cannot be empty.');
      return;
    }
    
    try {
      let result;
      
      if (announcementId) {
        // Update existing announcement
        result = await updateAnnouncement(announcementId, title, content);
        console.log("Updated announcement:", result);
      } else {
        // Create new announcement
        result = await createAnnouncement(title, content, (await AuthStorage.getUser())?.userId);
        console.log("Created announcement:", result);
      }
      
      setTitle('');
      setContent('');
      setMediaFiles([]);
      
      router.replace({
        pathname: "/announcement",
        params: { newAnnouncement: JSON.stringify(result) }
      });
    } catch (error) {
      console.error('Error saving announcement:', error);
      Alert.alert('Error', 'Failed to save announcement. Please try again.');
    }
  };

  // State to control the modal visibility
  const { width } = Dimensions.get('window');

  // Handle content change
  const handleContentChange = useCallback((html: string) => {
    setContent(html);
  }, []);

  // Create HTML with proper styling for the preview
  const getPreviewHTML = useCallback(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 16px;
              margin: 0;
              color: #1f2937;
              font-size: 16px;
              line-height: 1.5;
              background-color: white;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            video {
              max-width: 100%;
              height: auto;
            }
            audio {
              width: 100%;
              max-width: 400px;
            }
            ul, ol {
              padding-left: 20px;
            }
            a {
              color: #2563eb;
              text-decoration: underline;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              line-height: 1.2;
            }
            h1 {
              font-size: 1.8em;
            }
            h2 {
              font-size: 1.5em;
            }
            blockquote {
              border-left: 4px solid #e5e7eb;
              padding-left: 16px;
              margin-left: 0;
              color: #4b5563;
            }
            pre {
              background-color: #f3f4f6;
              padding: 16px;
              border-radius: 4px;
              overflow-x: auto;
            }
            code {
              font-family: monospace;
              background-color: #f3f4f6;
              padding: 2px 4px;
              border-radius: 4px;
            }
            .announcement-title {
              font-size: 24px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 16px;
              color: #111827;
            }
            .announcement-date {
              text-align: center;
              margin-bottom: 24px;
              color: #6b7280;
            }
            .announcement-content {
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="announcement-title">${title || 'Announcement Preview'}</div>
          <div class="announcement-date">${new Date().toLocaleDateString()}</div>
          <div class="announcement-content">
            ${content || '<span style="color: #9ca3af; font-style: italic;">No content to preview</span>'}
          </div>
        </body>
      </html>
    `;
  }, [content, title]);

  // Toggle modal visibility
  const togglePreviewModal = () => {
    setPreviewModalVisible(!previewModalVisible);
  };

  // Media thumbnail component
  const MediaThumbnail = ({ file, onPress }: { file: MediaFile; onPress: () => void }) => {
    const isImage = file.mimeType.startsWith("image");
    const isAudio = file.mimeType.startsWith("audio");
    const isVideo = file.mimeType.startsWith("video");
    
    let thumbnailContent;
    let containerClass = "w-16 h-16 rounded-lg overflow-hidden justify-center items-center mr-2 mb-2";
    
    if (isImage) {
      containerClass += " bg-gray-100";
      thumbnailContent = (
        <Image 
          source={{ uri: file.url }} 
          className="w-full h-full" 
          resizeMode="cover"
        />
      );
    } else if (isAudio) {
      containerClass += " bg-purple-500";
      thumbnailContent = (
        <>
          <Text className="text-lg mb-1">🎵</Text>
          <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
            Audio
          </Text>
        </>
      );
    } else if (isVideo) {
      containerClass += " bg-red-500";
      thumbnailContent = (
        <>
          <Text className="text-lg mb-1">🎬</Text>
          <Text className="text-white text-xs text-center px-1" numberOfLines={1}>
            Video
          </Text>
        </>
      );
    }

    return (
      <TouchableOpacity className={containerClass} onPress={onPress}>
        {thumbnailContent}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white pt-5">
      <ScrollView className="flex-1 px-4 pb-6">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 10,
            marginBottom: 10,
            borderRadius: 5
          }}
        />
        <Text className="text-xl font-bold my-4">Rich Text Editor</Text>
        
        {/* Toolbar */}
        <StyledRichToolbar
          editor={richText}
          className="border border-gray-300 rounded-t-lg"
          selectedIconTint="#2563EB" // tailwind blue-600
          iconTint="#6B7280" // tailwind gray-500
          actions={[
            actions.setBold,
            actions.setItalic,
            actions.setUnderline,
            actions.heading1,
            actions.heading2,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.insertLink,
            actions.insertImage,
            actions.alignLeft,
            actions.alignCenter,
            actions.alignRight,
            actions.code,
            actions.blockquote,
            actions.line,
            actions.undo,
            actions.redo,
          ]}
        />
        
        {/* Editor - Now with proper ref forwarding and onChange handler */}
        <StyledRichEditor
          className={`min-h-64 border border-gray-300 border-t-0 rounded-b-lg p-2 bg-white ${uploading ? 'opacity-50' : ''}`}
          placeholder="Start typing..."
          initialHeight={250}
          ref={richText}
          onChange={handleContentChange}
          disabled={uploading}
          editorStyle={{
            contentCSSText: `
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 16px;
              padding: 8px;
              ${uploading ? 'pointer-events: none; opacity: 0.5;' : ''}
            `
          }}
        />
        
        {/* Upload progress section */}
        {uploadingFiles.length > 0 && (
          <View className="mt-4 mb-4">
            <Text className="text-lg font-semibold mb-2">Upload Progress</Text>
            {uploadingFiles.map((file, index) => (
              <View key={index} className="mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm" numberOfLines={1}>{file.name}</Text>
                  <Text className="text-sm text-blue-600">
                    {formatBytes(Math.round(file.progress * file.size / 100))}/{formatBytes(file.size)}
                  </Text>
                </View>
                {/* Progress bar */}
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min(file.progress, 100)}%` }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Uploaded media files preview */}
        {mediaFiles.length > 0 && (
          <View className="mt-4">
            <Text className="text-lg font-semibold mb-2">Uploaded Media Files</Text>
            <View className="flex-row flex-wrap">
              {mediaFiles.map((file, index) => (
                <MediaThumbnail 
                  key={file.id || index} 
                  file={file} 
                  onPress={() => {
                    // You can add a preview modal here if needed
                    Alert.alert("Media File", `Name: ${file.name}\nType: ${file.mimeType}`);
                  }} 
                />
              ))}
            </View>
          </View>
        )}
        
        {/* Custom Buttons */}
        <View className="flex-row justify-between items-center mt-4">
          {/* Media Upload Button */}
          <TouchableOpacity 
            className={`py-2 px-4 rounded-lg ${uploading ? 'bg-gray-400' : 'bg-purple-600'}`}
            onPress={handleSelectFiles}
            disabled={uploading}
          >
            {uploading ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-white ml-2">Uploading...</Text>
              </View>
            ) : (
              <Text className="text-white">📎 Add Media</Text>
            )}
          </TouchableOpacity>

          {/* Right side buttons */}
          <View className="flex-row space-x-2">
            <TouchableOpacity 
              className="bg-gray-200 py-2 px-4 rounded-lg"
              onPress={() => {
                if (richText.current) {
                  richText.current.setContentHTML('');
                  setContent('');
                  setMediaFiles([]);
                }
              }}
            >
              <Text className="text-gray-800">Clear</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-blue-600 py-2 px-4 rounded-lg"
              onPress={() => {
                if (richText.current) {
                  const currentContent = richText.current.getContentHtml();
                  console.log('Content:', currentContent);
                  togglePreviewModal(); // Open the modal with the preview
                }
              }}
            >
              <Text className="text-white">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal Preview Window */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={previewModalVisible}
        onRequestClose={togglePreviewModal}
      >
        <SafeAreaView className="flex-1 bg-white">
          <StatusBar barStyle="dark-content" />
          
          {/* Modal Header */}
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
            <Text className="text-xl font-bold">Announcement Preview</Text>
            <View className="flex-row space-x-2">
              <TouchableOpacity 
                className="bg-gray-200 py-2 px-4 rounded-lg"
                onPress={togglePreviewModal}
              >
                <Text className="text-gray-800">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="bg-green-600 py-2 px-4 rounded-lg"
                onPress={() => {
                  console.log('Publishing announcement:', content);
                  togglePreviewModal();
                  handleCreateAnnouncement();
                }}
              >
                <Text className="text-white">{announcementId ? 'Update' : 'Publish'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Full Page Preview */}
          <View className="flex-1">
            <StyledWebView
              className="flex-1"
              originWhitelist={['*']}
              source={{ html: getPreviewHTML() }}
              showsVerticalScrollIndicator={true}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default RichTextEditor;