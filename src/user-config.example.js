// ============================================================
// USER CONFIGURATION TEMPLATE
// ============================================================
// 1. Copy this file and rename the copy to: src/user-config.js
// 2. Replace every placeholder value with your own credentials
// 3. Never commit src/user-config.js — it is gitignored
//
// TIP: The easiest way is to run: node setup.js
//      The wizard will fill in this file automatically.
// ============================================================

module.exports = {

  // ----------------------------------------------------------
  // FIREBASE WEB CONFIGURATION
  // Where to find: Firebase Console → Project settings
  //   → Your apps → Web app → SDK setup → Config
  // ----------------------------------------------------------
  firebase: {
    apiKey:            'YOUR_FIREBASE_API_KEY',
    authDomain:        'your-project.firebaseapp.com',
    projectId:         'your-project-id',
    storageBucket:     'your-project.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId:             '1:000000000000:web:xxxxxxxxxxxxxxxx',
  },

  // ----------------------------------------------------------
  // EXPO PROJECT ID
  // Where to find: https://expo.dev → your project → Overview
  // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // ----------------------------------------------------------
  expoProjectId: 'YOUR_EXPO_PROJECT_ID',

  // ----------------------------------------------------------
  // ANDROID PACKAGE NAME
  // Unique identifier for your app (lowercase, dots only)
  // Example: com.smith.familytalk
  // WARNING: Cannot be changed after you distribute the APK!
  // ----------------------------------------------------------
  androidPackage: 'com.yourname.familytalk',

};
