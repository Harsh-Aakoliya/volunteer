// Shared inline link URL + text input for rich editor
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface InlineLinkInputProps {
  visible: boolean;
  onInsert: (url: string, text: string) => void;
  onClose: () => void;
  editorRef: React.RefObject<any>;
  /** Optional container class (e.g. bg-gray-50 vs bg-white rounded) */
  containerClassName?: string;
  /** Optional accent for insert button: 'green' | 'blue' */
  accent?: 'green' | 'blue';
}

export function InlineLinkInput({
  visible,
  onInsert,
  onClose,
  editorRef,
  containerClassName = 'bg-gray-50 border-t border-gray-200 overflow-hidden px-3',
  accent = 'green',
}: InlineLinkInputProps) {
  const [url, setUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const animValue = useRef(new Animated.Value(0)).current;
  const urlInputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [visible, animValue]);

  const containerHeight = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 110],
  });

  const handleInsert = () => {
    if (url.trim()) {
      onInsert(url.trim(), linkText.trim() || url.trim());
      setUrl('');
      setLinkText('');
      onClose();
      setTimeout(() => {
        editorRef.current?.focusContentEditor();
      }, 100);
    }
  };

  const handleClose = () => {
    setUrl('');
    setLinkText('');
    onClose();
    setTimeout(() => {
      editorRef.current?.focusContentEditor();
    }, 50);
  };

  if (!visible) return null;

  const buttonClass =
    accent === 'green'
      ? 'w-9 h-9 rounded-full bg-green-600 items-center justify-center'
      : 'w-9 h-9 rounded-full bg-blue-500 items-center justify-center';

  return (
    <Animated.View className={containerClassName} style={{ height: containerHeight }}>
      <View className="flex-row justify-between items-center pt-2 pb-1">
        <Text className="text-sm font-semibold text-gray-700">Insert Link</Text>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={22} color="#666" />
        </TouchableOpacity>
      </View>
      <View className="flex-row items-center gap-2 pb-3">
        <TextInput
          ref={urlInputRef}
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com"
          className="flex-1 bg-white rounded-lg px-3 py-2 text-sm border border-gray-200"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="next"
          blurOnSubmit={false}
        />
        <TextInput
          value={linkText}
          onChangeText={setLinkText}
          placeholder="Text"
          className="w-20 bg-white rounded-lg px-3 py-2 text-sm border border-gray-200"
          returnKeyType="done"
          onSubmitEditing={handleInsert}
          blurOnSubmit={false}
        />
        <TouchableOpacity onPress={handleInsert} className={buttonClass}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
