# Contributing to FamTalk

Thank you for your interest in FamTalk!

The most common contribution is **adding a new UI language**. This guide walks you through the process step by step.

---

## Adding a New UI Language

FamTalk's interface strings live in a single file: `src/i18n/index.js`.

All you need to do is:
1. Add a new language block to the `strings` object
2. Register the language in the `LANGUAGES` array

### Step-by-step example: adding English

Open `src/i18n/index.js`. You will see a structure like this:

```js
const strings = {
  it: { /* Italian strings */ },
  th: { /* Thai strings */ },
  zh: { /* Chinese strings */ },
};

export const LANGUAGES = [
  { code: 'it', flag: '🇮🇹', key: 'langIt' },
  { code: 'th', flag: '🇹🇭', key: 'langTh' },
  { code: 'zh', flag: '🇨🇳', key: 'langZh' },
];
```

**1. Add your language block** inside the `strings` object, after the last existing language.
Copy the entire `it` (Italian) block and translate every value. Keep the keys exactly the same.

Example for English (`en`):

```js
  en: {
    // Login
    tagline: 'Your family, without language barriers',
    login: 'Log in',
    noAccount: "Don't have an account? Register",
    errorEmptyFields: 'Please enter your email and password',
    errorWrongCredentials: 'Incorrect email or password',

    // Register
    createAccount: 'Create your account',
    namePlaceholder: 'Name',
    passwordPlaceholder: 'Password (min. 6 characters)',
    translationLang: 'Your language (for translation)',
    register: 'Register',
    hasAccount: 'Already have an account? Log in',
    errorFillFields: 'Please fill in all fields',
    errorPasswordShort: 'Password must be at least 6 characters',
    errorEmailInUse: 'Email already in use',
    errorRegisterFailed: 'Registration failed. Please try again.',

    // Home
    noChatsYet: 'No chats yet.',
    noChatsSubtext: 'Add a contact with an invite code to get started.',
    noMessages: 'No messages yet',
    yourProfile: 'Your profile',
    labelName: 'Name',
    labelLanguage: 'Language',
    yourInviteCode: 'Your invite code',
    shareCodeHint: 'Share it so others can add you to a chat',
    close: 'Close',
    addContact: 'Add contact',
    addContactHint: 'Ask your contact for their invite code (e.g. FMLY-K7XM)',
    cancel: 'Cancel',
    add: 'Add',
    notFound: 'Not found',
    userNotFound: 'No user found with this invite code.',
    errorSelf: 'You cannot add yourself.',
    error: 'Error',

    // Settings
    settingsTitle: 'Settings',
    sectionLanguages: 'Your languages',
    labelTranslationLang: 'Translation language',
    labelTranslationLangSub: 'Messages you receive are translated into this language',
    labelUiLang: 'App language',
    labelUiLangSub: 'The language used for buttons and text in the app',
    sectionApi: 'Translation (Admin)',
    labelApiKey: 'Anthropic API Key',
    labelModel: 'Model',
    modelFast: 'fast and economical',
    modelAccurate: 'more accurate (recommended)',
    saveLangs: 'Save languages',
    saveAdmin: 'Save settings',
    savedTitle: 'Saved ✓',
    savedLangsMessage: 'Language preferences updated.',
    savedAdminMessage: 'Settings updated successfully.',
    warningApiKey: 'The Anthropic API key must start with "sk-ant-"',
    warning: 'Warning',
    inviteCodeTitle: 'Your invite code',
    inviteCodeSub: 'Share it with family members to add them to the app',

    // Language names (translate these into your language)
    langIt: '🇮🇹 Italian',
    langTh: '🇹🇭 Thai',
    langZh: '🇨🇳 Chinese',
    langEn: '🇬🇧 English',   // <-- add your own language name too

    // Groups
    newContact: 'Contact',
    newGroup: 'Group',
    newGroupTitle: 'New group',
    groupNameLabel: 'Group name',
    groupNamePlaceholder: 'e.g. Family 👨‍👩‍👧',
    addMembers: 'Add members',
    inviteCodePlaceholder: 'Invite code (FMLY-XXXX)',
    alreadyAdded: 'Already added.',
    groupNameRequired: 'Please enter a group name.',
    groupMemberRequired: 'Please add at least one member.',
    participants: 'Participants',
    me: '(you)',
    createGroup: 'Create group',

    // Chat
    typing: 'is typing...',
    online: 'online',
    offline: 'offline',
    participantsCount: 'participants',
    deleteChat: 'Delete chat',
    deleteChatConfirm: 'Are you sure? The chat will be deleted for all participants.',
    delete: 'Delete',
  },
```

**2. Add your language to the `LANGUAGES` array**, also in `src/i18n/index.js`:

```js
export const LANGUAGES = [
  { code: 'it', flag: '🇮🇹', key: 'langIt' },
  { code: 'th', flag: '🇹🇭', key: 'langTh' },
  { code: 'zh', flag: '🇨🇳', key: 'langZh' },
  { code: 'en', flag: '🇬🇧', key: 'langEn' },  // <-- add this line
];
```

**3. Add the language name key to the other languages.**
Every existing language block must have a `langEn` key (or whatever `key` you chose), so users reading Italian, Thai, or Chinese also see the name of your language. Add a line like this to every existing block:

```js
// inside the 'it' block
langEn: '🇬🇧 Inglese',

// inside the 'th' block
langEn: '🇬🇧 อังกฤษ',

// inside the 'zh' block
langEn: '🇬🇧 英语',
```

That's it! The app's language selector will automatically show the new option.

---

## Translation of Messages

Message translation is handled by the Anthropic Claude API (`src/services/translation.js`). It infers the target language from the `language` field stored in each user's Firestore profile (e.g. `"en"`, `"it"`, `"th"`).

No code changes are needed for message translation to work with a new language — Claude handles any language automatically. You only need to add the UI strings as described above.

---

## Checklist for a New Language PR

- [ ] New language block added to `strings` in `src/i18n/index.js`
- [ ] All keys from the `it` block are present (none missing, none extra)
- [ ] Language registered in `LANGUAGES` array with correct `code`, `flag`, `key`
- [ ] `langXX` key added to all existing language blocks (`it`, `th`, `zh`, ...)
- [ ] Strings translated by a native or fluent speaker

---

## Other Contributions

Bug fixes and feature improvements are welcome. Please open an issue first to discuss larger changes before submitting a PR.

---

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
