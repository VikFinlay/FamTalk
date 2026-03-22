'use strict';

/**
 * FamTalk — Expo dynamic configuration
 *
 * This file replaces app.json. It reads credentials from
 * src/user-config.js (gitignored). Run `node setup.js` to
 * generate that file from your own Firebase / Expo project.
 */

let userConfig;
try {
  userConfig = require('./src/user-config');
} catch (e) {
  console.warn(
    '\n  ⚠️  src/user-config.js not found.\n' +
    '  Run: node setup.js\n'
  );
  userConfig = {
    firebase: {},
    expoProjectId: '',
    androidPackage: 'com.yourname.familytalk',
  };
}

module.exports = {
  expo: {
    name: 'FamTalk',
    slug: 'FamTalk',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/FAMChat.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: userConfig.androidPackage,
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/FAMChat.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-notifications',
        { defaultChannel: 'messages', sounds: [] },
      ],
    ],
    extra: {
      // Injected into the app via expo-constants
      firebaseConfig: userConfig.firebase,
      expoProjectId: userConfig.expoProjectId,
      eas: {
        projectId: userConfig.expoProjectId,
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    ...(userConfig.expoProjectId
      ? { updates: { url: `https://u.expo.dev/${userConfig.expoProjectId}` } }
      : {}),
  },
};
