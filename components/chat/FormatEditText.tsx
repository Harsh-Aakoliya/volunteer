// Native Android EditText with "Format" in the Cut/Copy/Paste context menu.
// When user taps Format, onFormat is called so the app can show the formatting toolbar.
// Only available on Android; use RichEditor or TextInput on other platforms.

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  Platform,
  type ViewStyle,
} from 'react-native';

const NativeFormatEditText =
  Platform.OS === 'android'
    ? requireNativeComponent<{
        value?: string;
        placeholder?: string;
        onChangeText?: (e: { nativeEvent: { text: string } }) => void;
        onFormat?: () => void;
        style?: ViewStyle;
      }>('FormatEditText')
    : null;

export interface FormatEditTextRef {
  setBold: () => void;
  setItalic: () => void;
  setUnderline: () => void;
}

export interface FormatEditTextProps {
  value?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  onFormat?: () => void;
  style?: ViewStyle;
}

export const FormatEditText = forwardRef<FormatEditTextRef, FormatEditTextProps>(
  function FormatEditText({ value, placeholder, onChangeText, onFormat, style }, ref) {
    const innerRef = useRef<any>(null);

    useImperativeHandle(
      ref,
      () => ({
        setBold() {
          const tag = findNodeHandle(innerRef.current);
          if (tag != null) {
            UIManager.dispatchViewManagerCommand(tag, 'setBold', []);
          }
        },
        setItalic() {
          const tag = findNodeHandle(innerRef.current);
          if (tag != null) {
            UIManager.dispatchViewManagerCommand(tag, 'setItalic', []);
          }
        },
        setUnderline() {
          const tag = findNodeHandle(innerRef.current);
          if (tag != null) {
            UIManager.dispatchViewManagerCommand(tag, 'setUnderline', []);
          }
        },
      }),
      []
    );

    if (NativeFormatEditText == null) {
      return null;
    }

    return (
      <NativeFormatEditText
        ref={innerRef}
        value={value ?? ''}
        placeholder={placeholder}
        onChangeText={
          onChangeText
            ? (e: { nativeEvent: { text: string } }) =>
                onChangeText(e.nativeEvent?.text ?? '')
            : undefined
        }
        onFormat={onFormat}
        style={style}
      />
    );
  }
);
