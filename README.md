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
- 🌐 Multi-language UI (Italian, English, Chinese, Thai, Dutch, Spanish, French, Portuguese, Russian — easily extensible)
- 🌙 Dark theme

---

## Who needs to do this?

> **Only the admin — once.**

The setup described below (Firebase, Expo, building the APK) is done **a single time by one person** — the admin, i.e. whoever hosts the app for their family or group of friends. It takes 30–60 minutes the first time.

Once the admin has built the APK, **everyone else just receives a download link and installs it on their phone.** No accounts, no technical steps, no configuration — they open the app, register, and start chatting. That's it.

---

## What You'll Need

**Accounts to create (all free):**

| Service | Purpose | Link |
|---------|---------|------|
| **Firebase** | Database, authentication, file storage | https://console.firebase.google.com |
| **Expo** | Building and distributing the APK | https://expo.dev |

**For AI translation (required to use translation and voice features):**

| Service | Purpose | Link |
|---------|---------|------|
| **Anthropic** | Message translation | https://console.anthropic.com |
| **OpenAI** | Voice message transcription | https://platform.openai.com |

The Anthropic and OpenAI API keys are **not** part of the setup wizard — the admin enters them directly inside the app after the first login (Settings screen). They are stored securely in your Firebase project, never in the code.

**On your computer:**
- **Node.js** — check with `node --version`, download from https://nodejs.org if needed
- **Git** — to clone this repository

---

## Cost Overview

Everything runs on free tiers and is effectively **free for a family or small group.**

| Service | Free tier | Credit card required? |
|---------|-----------|----------------------|
| Firebase Authentication | 50,000 users/month | No |
| Firebase Firestore | 50,000 reads/day, 20,000 writes/day, 1 GB storage | No |
| Firebase Storage | 5 GB storage, 1 GB transfer/day | **Yes** (Blaze plan) |
| Expo EAS Build | 30 builds/month | No |
| Anthropic API | Pay per use (~$0.001 per message) | Yes |
| OpenAI API | Pay per use (~$0.006 per minute of audio) | Yes |

> **Firebase Storage note:** As of early 2026, Firebase requires the **Blaze (pay-as-you-go) plan** to use Storage. This means you need to add a credit card to your Firebase account. However, you will **not be charged** as long as you stay within the free tier limits (5 GB storage, 1 GB/day transfer), which is more than enough for any family chat. Google will only charge you if you explicitly exceed those limits.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/VikFinlay/FamTalk.git
cd FamTalk

# 2. Run the setup wizard — it will ask you for your credentials
node setup.js

# 3. Download google-services.json from Firebase (see Step 4 below)
#    and place it in the root of the project

# 4. Install dependencies
npm install

# 5. Build the APK
npx eas build --platform android --profile preview
```

Expo builds in the cloud and gives you a download link. Share it with your family!

---

## Detailed Setup Guide

Follow these steps carefully if you are new to Firebase or Expo. The whole process takes about 30–60 minutes, and you only ever do it once.

---

<details>
<summary><strong>Step 1 — Create a Firebase project</strong></summary>

1. Go to https://console.firebase.google.com and sign in with your Google account
2. Click **"Add project"** (or **"Create a project"**)
3. Enter a project name (e.g. `my-famtalk`) — this is just for you, it won't be visible to users
4. On the Google Analytics screen, you can safely disable it — it is not needed
5. Click **"Create project"** and wait for the spinner to finish (about 30 seconds)
6. Click **"Continue"** to open your new project dashboard

</details>

---

<details>
<summary><strong>Step 2 — Upgrade to the Blaze plan (required for Storage)</strong></summary>

Firebase Storage requires the Blaze (pay-as-you-go) plan. You need to add a credit card, but **you will not be charged** as long as you stay within the generous free tier (5 GB storage, 1 GB/day transfer).

1. In the Firebase Console, look at the bottom-left corner — you will see **"Spark plan"**
2. Click on it, then click **"Upgrade"**
3. Follow the prompts to link a Google Cloud billing account
   - If you don't have one, you'll be asked to create one — this requires a credit card
   - Google may offer a free credit when you sign up
4. Select the **Blaze** plan and confirm

> You can set a **budget alert** in Google Cloud Console (https://console.cloud.google.com) to get notified if spending ever exceeds $1 — this gives you extra peace of mind. For a family chat app, it will realistically always be $0.

</details>

---

<details>
<summary><strong>Step 3 — Enable Authentication</strong></summary>

1. In the left sidebar click **"Build" → "Authentication"**
2. Click **"Get started"**
3. Click on the **"Sign-in method"** tab
4. Click **"Email/Password"**
5. Toggle the first switch (**"Email/Password"**) to **Enabled**
6. Leave "Email link (passwordless sign-in)" disabled
7. Click **"Save"**

Authentication is now configured. No billing required for this service.

</details>

---

<details>
<summary><strong>Step 4 — Enable Firestore Database</strong></summary>

1. In the left sidebar click **"Build" → "Firestore Database"**
2. Click **"Create database"**
3. When asked about security rules, choose **"Start in production mode"** → click **"Next"**
4. Choose a **location** close to where your users are (e.g. `europe-west` for Europe) → click **"Enable"**
5. Wait for the database to be provisioned (about 1 minute)

**Now set the security rules:**

6. Click the **"Rules"** tab at the top of the Firestore page
7. Delete the existing content and paste the following:

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

8. Click **"Publish"**

These rules ensure that:
- Users can only read/write their own profile
- Only chat participants can access a chat and its messages
- Only the admin can change app-wide settings (API keys, model)

</details>

---

<details>
<summary><strong>Step 5 — Enable Storage</strong></summary>

Storage is used for profile pictures and voice messages.

1. In the left sidebar click **"Build" → "Storage"**
2. Click **"Get started"**
3. When asked about security rules, choose **"Start in production mode"** → click **"Next"**
4. Choose the **same location** you selected for Firestore → click **"Done"**
5. Wait for the bucket to be created

**Now set the security rules:**

6. Click the **"Rules"** tab at the top of the Storage page
7. Delete the existing content and paste the following:

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

8. Click **"Publish"**

These rules allow any authenticated user to upload and download files (profile pictures, voice messages).

</details>

---

<details>
<summary><strong>Step 6 — Get your Firebase credentials</strong></summary>

You need two things from Firebase: a **Web app config** (for the setup wizard) and a **`google-services.json`** file (for the Android build).

### Web app config (6 values for the setup wizard)

1. Click the ⚙️ gear icon in the top-left → **"Project settings"**
2. Scroll down to the **"Your apps"** section
3. If you don't see a Web app (the `</>` icon), click **"Add app"** → choose **`</>`** (Web)
4. Enter a nickname (e.g. `famtalk-web`), leave "Firebase Hosting" unchecked, click **"Register app"**
5. Under **"SDK setup and configuration"**, make sure **"Config"** is selected
6. You will see a block like this — keep this page open, you'll need it in Step 8:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-famtalk.firebaseapp.com",
  projectId: "my-famtalk",
  storageBucket: "my-famtalk.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Android app + google-services.json

1. Still in **"Project settings"** → **"Your apps"**, click **"Add app"** → choose the **Android** icon
2. In **"Android package name"**, enter the unique identifier you want for your app (e.g. `com.smith.familytalk`)
   - Use your own name, not `smith` — this must be globally unique on Android
   - Write it down — you'll need the exact same string in Step 8
3. App nickname and debug SHA-1 are optional — leave them blank
4. Click **"Register app"**
5. Click **"Download google-services.json"**
6. Move that file into the **root folder** of the FamTalk project (the same folder as `package.json` and `setup.js`)

> `google-services.json` contains your Firebase credentials and is gitignored — it will never be committed to the repository.

</details>

---

<details>
<summary><strong>Step 7 — Create an Expo account and project</strong></summary>

Expo is the service that builds your APK in the cloud without needing Android Studio.

1. Go to https://expo.dev and sign up for a free account
2. Install the EAS CLI globally on your computer:

```bash
npm install -g eas-cli
```

3. Log in to your Expo account from the terminal:

```bash
eas login
```

4. Navigate to the FamTalk project folder and initialise the Expo project:

```bash
cd FamTalk
npx eas init
```

This links the project to your Expo account and prints a **Project ID** (a UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

5. You can also find the Project ID at any time by going to https://expo.dev → your project → **Overview** page.

> The free Expo plan includes **30 builds per month**, which is far more than enough for a family app. You will realistically rebuild only when you update the app.

</details>

---

<details>
<summary><strong>Step 8 — Run the setup wizard</strong></summary>

With everything above ready, run the interactive setup wizard:

```bash
node setup.js
```

The wizard supports **English, Italian, Chinese, and Thai** — choose your language at the start.

It will ask for:
- **Firebase API Key** — from the `firebaseConfig` block in Step 6
- **Auth Domain** — e.g. `my-famtalk.firebaseapp.com`
- **Project ID** — e.g. `my-famtalk`
- **Storage Bucket** — e.g. `my-famtalk.firebasestorage.app`
- **Messaging Sender ID** — the long number in `firebaseConfig`
- **App ID** — e.g. `1:123456789:web:abcdef`
- **Expo Project ID** — the UUID from Step 7
- **Android Package Name** — the one you chose in Step 6 (e.g. `com.smith.familytalk`)

The wizard writes `src/user-config.js` automatically. That file is gitignored and stays only on your machine.

</details>

---

<details>
<summary><strong>Step 9 — Build the APK</strong></summary>

Install dependencies and start the cloud build:

```bash
npm install
npx eas build --platform android --profile preview
```

- Expo builds in the cloud — **no Android Studio or local toolchain needed**
- The first build may take **10–20 minutes** (queue + build time); subsequent builds are faster
- When done, Expo prints a **direct download link** for the APK file

To build a production-signed APK (e.g. for the Google Play Store):

```bash
npx eas build --platform android --profile production
```

</details>

---

<details>
<summary><strong>Step 10 — First login and admin setup</strong></summary>

1. Download the APK from the Expo link and install it on your Android device
   - You may need to allow "Install from unknown sources" in your Android settings
2. Open FamTalk and tap **Register** to create the first account — use your own name and email
3. **The first account registered is automatically the admin.** This gives you access to the Translation settings inside the app.
4. Go to **Settings** (bottom tab) → scroll to **Translation (Admin)**
5. Enter your:
   - **Anthropic API Key** (starts with `sk-ant-`) — get it from https://console.anthropic.com
   - **OpenAI API Key** (starts with `sk-`) — get it from https://platform.openai.com
6. Choose the AI model:
   - **Haiku** — faster and cheaper (good for most families)
   - **Sonnet** — more accurate translations (recommended if quality matters more than cost)
7. Tap **Save settings**

> The API keys are stored in your Firebase project (Firestore `config/secrets`). They are never stored in the app code or this repository. Only the admin can view or change them.

</details>

---

<details>
<summary><strong>Step 11 — Share the app with your family</strong></summary>

You're done with the hard part. Now:

1. Copy the **APK download link** from Expo (or re-find it at https://expo.dev → your project → Builds)
2. Send the link to your family members via WhatsApp, email, or any messaging app
3. They tap the link on their Android phone, download the APK, and install it
   - They may need to allow "Install from unknown sources" once
4. They open FamTalk, tap **Register**, choose their name and their language (Italian, English, Chinese, Thai, Dutch, Spanish, French, Portuguese, or Russian)
5. They add each other using **invite codes** — each user has a unique code visible in their profile

That's it. **Your family members don't need Firebase, Expo, Node.js, or any technical knowledge.** They just install and use the app like any other.

</details>

---

## How Translation Works

- Each user chooses their **translation language** when registering (the language they want to *receive* messages in)
- Each user also chooses their **UI language** (the language the app interface shows)
- When a message is sent, FamTalk calls the Anthropic Claude API to translate it into each recipient's language
- In group chats, one API call translates to all participants' languages simultaneously
- Voice messages are first transcribed (OpenAI Whisper), then translated

Supported languages out of the box: 🇮🇹 Italian, 🇬🇧 English, 🇨🇳 Chinese, 🇹🇭 Thai, 🇳🇱 Dutch, 🇪🇸 Spanish, 🇫🇷 French, 🇧🇷 Portuguese, 🇷🇺 Russian.
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
→ Run `node setup.js` from the project root folder.

**`google-services.json not found` during build**
→ Download it from Firebase Console (Project settings → Your apps → Android app → Download google-services.json) and place it in the root of the project (same folder as `package.json`).

**Build fails with "package name already used"**
→ Your Android package name must be globally unique across all Android apps. Avoid generic names like `com.famtalk.app`. Use something personal like `com.yourname.familytalk`.

**"Permission denied" or "Missing or insufficient permissions" in the app**
→ Your Firestore or Storage security rules were not published correctly. Go back to Step 4 and Step 5, re-paste the rules, and make sure you clicked **"Publish"**.

**Storage not working / photos or voice messages not uploading**
→ Firebase Storage requires the Blaze plan (see Step 2). Make sure you upgraded your project and that the Storage bucket was created successfully.

**Translation not working**
→ Log in as admin, go to Settings → Translation (Admin), and make sure your Anthropic API key is entered and saved correctly. The key must start with `sk-ant-`.

**Voice transcription not working**
→ Check that your OpenAI API key is entered in Settings. The key starts with `sk-`. Make sure your OpenAI account has available credit.

**Push notifications not working**
→ Make sure the Expo Project ID you entered in the setup wizard matches exactly the one shown on your project's Overview page at https://expo.dev.

**"eas: command not found"**
→ Run `npm install -g eas-cli` to install the Expo CLI globally, then try again.

**The app installs but shows a blank screen**
→ The `src/user-config.js` may contain incorrect Firebase credentials. Run `node setup.js` again with the correct values from your Firebase Console.

---

## Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a new language or contribute features.

---

## License

MIT © [Vik Finlay](https://github.com/VikFinlay)
