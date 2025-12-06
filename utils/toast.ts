// utils/toast.ts
import { Platform, ToastAndroid } from 'react-native';

export const showToast = (message: string, duration: 'SHORT' | 'LONG' = 'SHORT') => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, duration === 'SHORT' ? ToastAndroid.SHORT : ToastAndroid.LONG);
  } else {
    // For iOS, we can use a simple console log or implement a custom toast
    // For now, using console log - you can replace with a custom toast library if needed
    console.log('Toast:', message);
  }
};

