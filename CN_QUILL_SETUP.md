# React Native CN-Quill Setup Guide

## Installation

```bash
npm install react-native-cn-quill
# or
yarn add react-native-cn-quill
```

## iOS Setup

Add to `ios/Podfile`:
```ruby
pod 'react-native-webview', :path => '../node_modules/react-native-webview'
```

Then run:
```bash
cd ios && pod install
```

## Android Setup

No additional setup required for Android.

## Usage

The test component is already created at `/components/CNQuillTestSection.tsx` and integrated into the announcement page.

## Features Included in Test Component

1. **Basic Editor**: Full-featured rich text editor with toolbar
2. **Content Management**: Get/Set/Clear content functionality
3. **Preview**: Shows raw HTML content
4. **Toolbar Options**:
   - Bold, Italic, Underline
   - Headers (H1, H2)
   - Lists (Ordered, Bullet)
   - Blockquote, Code Block
   - Links
   - Clean formatting

## Testing the Component

1. Navigate to the Announcements tab
2. You'll see a yellow test section at the top
3. Tap "Open Test" to open the editor modal
4. Use the test controls to:
   - Get current content
   - Set sample content
   - Clear content
   - Toggle preview

## Integration Notes

- The component uses `QuillEditor` and `QuillToolbar` from react-native-cn-quill
- Content is handled as HTML strings
- The editor supports custom styling and themes
- WebView-based implementation for cross-platform compatibility

## Next Steps

After testing, you can:
1. Integrate this editor into your AnnouncementCreator component
2. Replace the existing react-native-pell-rich-editor
3. Customize the toolbar options and styling
4. Add more advanced features like image upload, custom formats, etc.
