# Auto Update System Documentation

## Overview
This system provides automatic update functionality for the React Native app. It checks for updates when the app starts and prompts users to download and install new versions.

## How It Works

### 1. Version Management
- The system maintains a `version.json` file in `Backend/apkdistribution/version.json`
- This file contains the current end-user version: `{"currentenduserversion": "1.0.1"}`

### 2. APK Distribution Structure
```
Backend/apkdistribution/
├── version.json
├── 1.0.1/
│   └── app-1.0.1.apk
├── 1.0.2/
│   └── app-1.0.2.apk
└── [future-version]/
    └── [apk-file].apk
```

### 3. Update Process Flow

#### Frontend (App Startup)
1. App starts and calls `checkForUpdates()` in `app/index.tsx`
2. Gets current app version using `Application.nativeApplicationVersion`
3. Makes API call to `/api/version/current` to get server version
4. Compares versions:
   - **Same version**: App continues normally
   - **Different version**: Shows update alert

#### Update Alert
- **Update button**: Downloads and installs new APK
- **Cancel button**: App exits (user must update to continue)

#### Download & Installation
1. Downloads APK from `/api/version/download/{version}`
2. Saves to device storage
3. Deletes old APK files
4. Launches Android package installer

## API Endpoints

### GET `/api/version/current`
Returns the current version from `version.json`
```json
{
  "success": true,
  "currentVersion": "1.0.1"
}
```

### GET `/api/version/download/{version}`
Downloads APK file for specified version
- Headers: `Content-Type: application/vnd.android.package-archive`
- Returns: APK file as binary data

### POST `/api/version/update` (Admin)
Updates the current version in `version.json`
```json
{
  "currentenduserversion": "1.0.2"
}
```

## How to Release a New Version

### 1. Build New APK
```bash
# Build your app
expo build:android
# or
eas build --platform android
```

### 2. Create Version Folder
```bash
mkdir Backend/apkdistribution/1.0.2
```

### 3. Place APK File
- Copy your built APK to `Backend/apkdistribution/1.0.2/`
- Name it appropriately (e.g., `app-1.0.2.apk`)

### 4. Update Version
Update `Backend/apkdistribution/version.json`:
```json
{
  "currentenduserversion": "1.0.2"
}
```

### 5. Update App Version
In your app's `app.json` or `package.json`, update the version to match:
```json
{
  "version": "1.0.2"
}
```

## File Structure

### Backend Files
- `Backend/controllers/versionController.js` - Version management logic
- `Backend/routes/versionRoutes.js` - API routes
- `Backend/routes/index.js` - Route registration
- `Backend/apkdistribution/version.json` - Current version
- `Backend/apkdistribution/{version}/` - APK files

### Frontend Files
- `api/version.ts` - API functions for version checking and download
- `utils/updateChecker.ts` - Update checking logic
- `app/index.tsx` - Entry point with update check

## Dependencies

### Required Expo Packages
- `expo-file-system` - File operations
- `expo-intent-launcher` - APK installation
- `expo-application` - App version info

### Backend Dependencies
- `express` - Web server
- `fs` - File system operations
- `path` - Path utilities

## Security Considerations

1. **APK Verification**: Ensure APK files are properly signed
2. **HTTPS**: Use HTTPS in production for secure downloads
3. **Authentication**: Consider adding auth to version update endpoint
4. **File Validation**: Validate APK files before serving

## Testing

### Test Update Flow
1. Set `version.json` to a different version than your app
2. Start the app
3. Verify update alert appears
4. Test download and installation

### Test Normal Flow
1. Set `version.json` to match your app version
2. Start the app
3. Verify no update alert appears

## Troubleshooting

### Common Issues

1. **APK not found**: Ensure APK file exists in correct version folder
2. **Download fails**: Check network connectivity and server status
3. **Installation fails**: Ensure APK is properly signed
4. **Version mismatch**: Verify `version.json` and app version match

### Debug Logs
The system logs extensively to help with debugging:
- Current app version
- Server version
- Download progress
- Installation status

## Future Enhancements

1. **Progressive Updates**: Support for incremental updates
2. **Rollback**: Ability to rollback to previous versions
3. **Beta Testing**: Separate channels for beta releases
4. **Analytics**: Track update success rates
5. **Force Updates**: Critical security updates that can't be skipped 