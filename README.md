# 🏠 FamTalk

**A multilingual family chat app powered by AI translation.**

FamTalk lets families communicate across language barriers in real time. Messages are automatically translated into each member's preferred language using the Anthropic Claude API. Perfect for multicultural families where members speak Italian, Chinese, Thai, or any language you add.

> Built with React Native (Expo), Firebase, and the Anthropic Claude API.
> Licensed under MIT — created by [Vik Finlay](https://github.com/VikFinlay).

---

## Features

- 💬 Real-time chat (1-on-1 and group)
- 🌍 AI-powered message translation (each person reads in their own language)
- 🎙️ Voice messages with automatic transcription (OpenAI Whisper)
- 📷 Photo sharing
- 🔔 Push notifications
- 👥 Group chats with per-member language settings, contact picker, and leave group support
- 😄 Emoji reactions and message replies
- 🌐 Multi-language UI (Italian, English, Chinese, Thai — easily extensible)
- 🌙 Dark theme

---

## Before You Start

You will need to create two free accounts:

| Service | Purpose | Link |
|---------|---------|------|
| **Firebase** | Database, auth, file storage | https://console.firebase.google.com |
| **Expo** | Building and distributing the APK | https://expo.dev |

For AI translation (optional, but needed to use the translation features):

| Service | Purpose | Link |
|---------|---------|------|
| **Anthropic** | Message translation | https://console.anthropic.com |
| **OpenAI** | Voice transcription | https://platform.openai.com |

The API keys for Anthropic and OpenAI are **not** part of the setup wizard — the first user who logs in becomes the admin and enters them directly inside the app (Settings screen).

You also need **Node.js** installed on your computer.
Check with: `node --version`. Download from https://nodejs.org if needed.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/VikFinlay/FamTalk.git
cd FamTalk

# 2. Run the setup wizard — it will ask you for your credentials
node setup.js

# 3. Download google-services.json from Firebase (see Step 3 below)
#    and place it in the root of the project

# 4. Install dependencies
npm install

# 5. Build the APK
npx eas build --platform android --profile preview
```

Expo will build the APK in the cloud and give you a download link. Share it with your family!

---

## Detailed Setup Guide

Follow these steps if you are new to Firebase or Expo.

---

<details>
<summary><strong>Step 1 — Create a Firebase project</strong></summary>

1. Go to https://console.firebase.google.com
2. Click **"Add project"** (or **"Create a project"**)
3. Enter a project name (e.g. `my-famtalk`)
4. Google Analytics: you can disable it — it is not required
5. Click **"Create project"** and wait for it to finish
6. Click **"Continue"** to open your new project

</details>

---

<details>
<summary><strong>Step 2 — Enable Firebase services</strong></summary>

Inside your Firebase project, enable these three services:

### Authentication
1. In the left sidebar click **"Build" → "Authentication"**
2. Click **"Get started"**
3. Under **"Sign-in method"**, click **"Email/Password"**
4. Toggle **"Email/Password"** to **Enabled**
5. Click **"Save"**

### Firestore Database
1. In the sidebar click **"Build" → "Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → click **"Next"**
4. Choose a location close to your users → click **"Enable"**
5. Once created, go to the **"Rules"** tab and paste these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /chats/{chatId} {
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
    }
    match /config/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

6. Click **"Publish"**

### Storage
1. In the sidebar click **"Build" → "Storage"**
2. Click **"Get started"**
3. Choose **"Start in production mode"** → click **"Next"**
4. Choose the same location as Firestore → click **"Done"**
5. Go to the **"Rules"** tab and paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. Click **"Publish"**

</details>

---

<details>
<summary><strong>Step 3 — Get your Firebase credentials</strong></summary>

### Web app credentials (for the setup wizard)

1. In Firebase Console, click the ⚙️ gear icon → **"Project settings"**
2. Scroll down to **"Your apps"**
3. If you see no Web app, click **"Add app"** → choose the **`</>`** (Web) icon
4. Enter an app nickname (e.g. `famtalk-web`) and click **"Register app"**
5. Under **"SDK setup and configuration"**, select **"Config"**
6. You will see a `firebaseConfig` object — you will need these values when running `node setup.js`

### Android app + google-services.json

1. Still in **"Project settings"** → **"Your apps"**
2. Click **"Add app"** → choose the Android icon
3. Enter the **Android package name** — use the same one you will give to the setup wizard (e.g. `com.smith.familytalk`)
4. App nickname is optional — click **"Register app"**
5. Click **"Download google-services.json"**
6. Move that file into the **root folder** of the FamTalk project (next to `package.json`)

> `google-services.json` is gitignored and will never be committed.

</details>

---

<details>
<summary><strong>Step 4 — Create an Expo account and project</strong></summary>

1. Go to https://expo.dev and sign up for a free account
2. Install the EAS CLI (Expo Application Services):

```bash
npm install -g eas-cli
```

3. Log in:

```bash
eas login
```

4. Inside the FamTalk project folder, initialise your Expo project:

```bash
npx eas init
```

   This creates a project on expo.dev and prints a **Project ID** (a UUID).

5. Go to https://expo.dev → open your project → copy the **Project ID** from the Overview page — you will need it in the setup wizard.

</details>

---

<details>
<summary><strong>Step 5 — Run the setup wizard</strong></summary>

With Firebase credentials ready and Expo project ID in hand, run:

```bash
node setup.js
```

The wizard will ask for:
- Firebase API Key, Auth Domain, Project ID, Storage Bucket, Messaging Sender ID, App ID
- Expo Project ID
- Android Package Name

It writes `src/user-config.js` automatically. That file is gitignored.

</details>

---

<details>
<summary><strong>Step 6 — Build the APK</strong></summary>

```bash
npm install
npx eas build --platform android --profile preview
```

- Expo builds in the cloud — no Android Studio needed
- When the build finishes, Expo prints a **download link** for the APK
- Share that link with your family members to install the app

> The first build may take 10–20 minutes. Subsequent builds are faster.

To build a production APK (for Google Play Store):

```bash
npx eas build --platform android --profile production
```

</details>

---

<details>
<summary><strong>Step 7 — First login and admin setup</strong></summary>

1. Install the APK on your Android device
2. Open FamTalk and tap **Register** to create the first account
3. The first account created is automatically made **admin**
4. Go to **Settings** (⚙️ icon)
5. Under **Translation (Admin)**, enter your:
   - **Anthropic API Key** (starts with `sk-ant-`) — used for message translation
   - **OpenAI API Key** (starts with `sk-`) — used for voice message transcription
6. Select the AI model (Haiku = faster & cheaper, Sonnet = more accurate)
7. Tap **Save settings**

> The API keys are stored in your Firebase project (Firestore `config/secrets`), not in the app code. Only the admin can change them.

Now share the APK download link with your family and have them register!

</details>

---

## How Translation Works

- Each user chooses their **translation language** when registering (the language they want to *receive* messages in)
- Each user also chooses their **UI language** (the language the app interface shows)
- When a message is sent, FamTalk calls the Anthropic Claude API to translate it into each recipient's language
- In group chats, one API call translates to all participants' languages simultaneously
- Voice messages are first transcribed (OpenAI Whisper), then translated

Supported languages out of the box: 🇮🇹 Italian, 🇬🇧 English, 🇨🇳 Chinese, 🇹🇭 Thai.
See [CONTRIBUTING.md](CONTRIBUTING.md) to add more.

---

## Adding More Languages

See [CONTRIBUTING.md](CONTRIBUTING.md) for a step-by-step guide on adding a new language to the UI and translation system.

---

## Project Structure

```
famtalk/
├── setup.js                    ← Run this first: node setup.js
├── app.config.js               ← Expo config (reads from user-config.js)
├── src/
│   ├── user-config.example.js  ← Template — copy to user-config.js
│   ├── firebase/
│   │   └── config.js           ← Firebase initialisation
│   ├── i18n/
│   │   └── index.js            ← All UI translation strings
│   ├── context/
│   │   ├── AuthContext.js      ← Firebase auth + user profile
│   │   └── I18nContext.js      ← UI language provider
│   ├── navigation/
│   │   └── AppNavigator.js     ← Navigation stack
│   ├── screens/
│   │   ├── auth/               ← Login, Register
│   │   └── main/               ← Home, Chat, Settings, CreateGroup
│   ├── services/
│   │   ├── notifications.js    ← Push notifications
│   │   └── translation.js      ← Anthropic + OpenAI API calls
│   └── theme/
│       └── colors.js           ← Dark theme colours
├── google-services.json        ← gitignored — download from Firebase
└── src/user-config.js          ← gitignored — created by node setup.js
```

---

## Troubleshooting

**`src/user-config.js not found`**
→ Run `node setup.js`

**`google-services.json not found` during build**
→ Download it from Firebase Console and place it in the project root

**Build fails with "package name already used"**
→ Your Android package name must be globally unique. Use `com.yourname.familytalk` instead of a generic name.

**Translation not working**
→ Log in as admin, go to Settings, and enter your Anthropic API key.

**Push notifications not working**
→ Make sure your Expo Project ID in `setup.js` matches the one in your expo.dev account.

---

## Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a new language or contribute features.

---

## License

MIT © [Vik Finlay](https://github.com/VikFinlay)
