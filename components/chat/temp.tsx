const renderMediaItem = (file: LocalMediaFile, index: number) => {

    return(
      <View key={file.id}>
        <Text>{file.name}</Text>
      </View>
    )
    // return (
    //   <View key={file.id} style={{ width, padding: 16 }}>
    //     <View className="relative bg-gray-100 rounded-lg overflow-hidden mb-3">
    //       <View className="items-center justify-center" style={{ height: 260 }}>
    //         {(() => {
    //           let mediaType = '';
    //           if (isImage(file)) mediaType = 'image';
    //           else if (isVideo(file)) mediaType = 'video';
    //           else if (isAudio(file)) mediaType = 'audio';
    //           switch(mediaType) {
    //             case 'image':
    //               return (
    //                 <Image
    //                   source={{ uri: file.uri }}
    //                   className="w-full h-full"
    //                   resizeMode="contain"
    //                 />
    //               );
    //             case 'video':
    //               return (
    //                 <Video
    //                   source={{ uri: file.uri }}
    //                   useNativeControls
    //                   resizeMode={ResizeMode.CONTAIN}
    //                   className="w-full h-full"
    //                 />
    //               );
    //             case 'audio':
    //               return (
    //                 <View className="w-full h-full bg-purple-500 justify-center items-center">
    //                   <Text className="text-white text-5xl mb-2">🎵</Text>
    //                   <Text className="text-white text-lg font-semibold">{file.name}</Text>
    //                 </View>
    //               );
    //             default:
    //               return null;
    //           }
    //         })()}
            
    //         {/* Show upload progress if file is uploading */}
    //         {uploading ? (
    //           <View className="absolute bottom-0 left-0 right-0 bg-black/40 p-2">
    //             <View className="flex-row justify-between mb-1">
    //               <Text className="text-white text-xs">{file.progress}%</Text>
    //               {file.uploaded ? <Ionicons name="checkmark-circle" size={16} color="#4ade80" /> : null}
    //             </View>
    //             <View className="h-1 bg-gray-200 rounded-full overflow-hidden">
    //               <View 
    //                 className={`h-full ${file.uploaded ? 'bg-green-500' : 'bg-blue-500'}`} 
    //                 style={{ width: `${file.progress}%` }} 
    //               />
    //             </View>
    //           </View>
    //         ) : null}
    //       </View>
          
    //       {!uploading ? (
    //         <TouchableOpacity
    //           className="absolute top-2 right-2 bg-red-500 rounded-full w-8 h-8 justify-center items-center"
    //           onPress={() => onRemoveFile(file.id)}
    //         >
    //           <Ionicons name="close" size={18} color="white" />
    //         </TouchableOpacity>
    //       ) : null}
          
    //       <View className="absolute top-2 left-2 bg-black/40 rounded-md px-2 py-1">
    //         <Text className="text-white text-xs">{formatFileSize(file.size)}</Text>
    //       </View>
    //     </View>
        
    //     <TextInput
    //       className="bg-white border border-gray-300 rounded-lg px-4 py-3"
    //       placeholder="Add an optional message..."
    //       value={file.message || ''}
    //       onChangeText={(text) => onUpdateMessage(file.id, text)}
    //       multiline
    //       editable={!uploading}
    //     />
    //   </View>
    // );
  };



    // Format file size
    const formatFileSize = (bytes?: number): string => {
      if (!bytes) return '';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };