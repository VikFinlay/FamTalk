#!/usr/bin/env node
'use strict';

/**
 * FamTalk Setup Wizard
 * Run with: node setup.js
 *
 * This script collects your Firebase and Expo credentials
 * and writes them to src/user-config.js (gitignored).
 * Your credentials are NEVER committed to the repository.
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function line() { console.log('  ' + '─'.repeat(58)); }
function title(text) { console.log(`\n${BOLD}${CYAN}  ${text}${RESET}`); line(); }
function info(text)  { console.log(`  ${text}`); }
function hint(text)  { console.log(`  ${YELLOW}${text}${RESET}`); }
function ok(text)    { console.log(`  ${GREEN}${text}${RESET}`); }

// ─────────────────────────────────────────────
// Strings for all supported languages
// ─────────────────────────────────────────────
const STRINGS = {
  en: {
    langPrompt: 'Choose your language / Scegli la lingua / 选择语言 / เลือกภาษา\n\n  1) English\n  2) Italiano\n  3) 中文\n  4) ภาษาไทย\n\n  Enter number (default: 1)',
    langInvalid: 'Invalid choice, defaulting to English.',
    intro1: 'This wizard creates your personal src/user-config.js file.',
    intro2: 'That file is gitignored — your credentials stay on your machine.',
    intro3: 'Before you start, make sure you have:',
    introFirebase: '• A Firebase project   → https://console.firebase.google.com',
    introExpo: '• An Expo account      → https://expo.dev',
    introCancel: 'Press Ctrl+C at any time to cancel.',
    pressEnter: 'Press Enter to continue...',
    step1Title: 'STEP 1 / 3  —  Firebase Web Configuration',
    step1Info1: 'How to find these values:',
    step1Info2: '  1. Open https://console.firebase.google.com',
    step1Info3: '  2. Select your project',
    step1Info4: '  3. Click the ⚙️  gear icon → "Project settings"',
    step1Info5: '  4. Scroll down to "Your apps" → click your Web app',
    step1Info6: '     (if you have no Web app, click "Add app" → Web)',
    step1Info7: '  5. Under "SDK setup and configuration" select "Config"',
    step1Info8: '  6. Copy each value below from the firebaseConfig object',
    apiKey: 'Firebase API Key',
    authDomain: 'Auth Domain  (e.g. myproject.firebaseapp.com)',
    projectId: 'Project ID   (e.g. myproject-abc12)',
    storageBucket: 'Storage Bucket  (e.g. myproject.firebasestorage.app)',
    messagingSenderId: 'Messaging Sender ID  (numbers only)',
    appId: 'App ID  (e.g. 1:123456:web:abcdef)',
    step2Title: 'STEP 2 / 3  —  Expo Project ID',
    step2Info1: 'How to find your Expo Project ID:',
    step2OptionA: '  Option A — from the web:',
    step2A1: '    1. Go to https://expo.dev → sign in',
    step2A2: '    2. Open your project',
    step2A3: '    3. Copy the "Project ID" on the Overview page',
    step2A4: '       (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
    step2OptionB: '  Option B — create a new project via CLI:',
    step2B2: '    Then check expo.dev for the generated Project ID',
    expoProjectId: 'Expo Project ID',
    step3Title: 'STEP 3 / 3  —  Android Package Name',
    step3Info1: 'This is the unique identifier for your app on Android.',
    step3Info2: 'Format  : com.yourname.appname  (lowercase, letters, numbers, dots)',
    step3Info3: 'Example : com.smith.familytalk',
    step3Warn: '⚠️  Once you distribute the APK this cannot be changed.',
    androidPackage: 'Android Package Name',
    doneTitle: '✅  Configuration saved!',
    doneCreated: '  src/user-config.js has been created.',
    doneManual: 'One manual step remaining — download google-services.json:',
    doneStep1: '  1. Go to Firebase Console → Project settings',
    doneStep2: '  2. Under "Your apps", find or create an Android app',
    doneStep3: '  3. Click "Download google-services.json"',
    doneStep4: '  4. Place the file in the ROOT of this project',
    doneStep4b: '     (same folder as package.json and setup.js)',
    doneBuild: 'Then install dependencies and build:',
    doneExpo: 'Expo will give you a download link for the APK when done.',
    doneShare: 'Share that link with your family!',
    doneGuide: '📖  Full step-by-step guide: README.md',
    errorEmpty: 'cannot be empty. Please try again.',
    errorFailed: 'Setup failed:',
  },
  it: {
    intro1: 'Questa procedura crea il file src/user-config.js sul tuo computer.',
    intro2: 'Il file è ignorato da git — le tue credenziali restano solo qui.',
    intro3: 'Prima di iniziare assicurati di avere:',
    introFirebase: '• Un progetto Firebase  → https://console.firebase.google.com',
    introExpo: '• Un account Expo       → https://expo.dev',
    introCancel: 'Premi Ctrl+C in qualsiasi momento per annullare.',
    pressEnter: 'Premi Invio per continuare...',
    step1Title: 'PASSO 1 / 3  —  Configurazione Firebase Web',
    step1Info1: 'Come trovare questi valori:',
    step1Info2: '  1. Apri https://console.firebase.google.com',
    step1Info3: '  2. Seleziona il tuo progetto',
    step1Info4: '  3. Clicca l\'icona ⚙️  → "Impostazioni progetto"',
    step1Info5: '  4. Scorri fino a "Le tue app" → clicca la tua app Web',
    step1Info6: '     (se non hai un\'app Web, clicca "Aggiungi app" → Web)',
    step1Info7: '  5. In "Configurazione SDK" seleziona "Config"',
    step1Info8: '  6. Copia i valori qui sotto dall\'oggetto firebaseConfig',
    apiKey: 'Firebase API Key',
    authDomain: 'Auth Domain  (es. mioprogetto.firebaseapp.com)',
    projectId: 'Project ID   (es. mioprogetto-abc12)',
    storageBucket: 'Storage Bucket  (es. mioprogetto.firebasestorage.app)',
    messagingSenderId: 'Messaging Sender ID  (solo numeri)',
    appId: 'App ID  (es. 1:123456:web:abcdef)',
    step2Title: 'PASSO 2 / 3  —  Expo Project ID',
    step2Info1: 'Come trovare il tuo Expo Project ID:',
    step2OptionA: '  Opzione A — dal sito:',
    step2A1: '    1. Vai su https://expo.dev → accedi',
    step2A2: '    2. Apri il tuo progetto',
    step2A3: '    3. Copia il "Project ID" dalla pagina Overview',
    step2A4: '       (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
    step2OptionB: '  Opzione B — crea un nuovo progetto via CLI:',
    step2B2: '    Poi controlla expo.dev per il Project ID generato',
    expoProjectId: 'Expo Project ID',
    step3Title: 'PASSO 3 / 3  —  Nome pacchetto Android',
    step3Info1: 'È l\'identificatore univoco della tua app su Android.',
    step3Info2: 'Formato  : com.tuonome.nomeapp  (minuscolo, lettere, numeri, punti)',
    step3Info3: 'Esempio  : com.rossi.familytalk',
    step3Warn: '⚠️  Una volta distribuito l\'APK non si può più cambiare.',
    androidPackage: 'Nome pacchetto Android',
    doneTitle: '✅  Configurazione salvata!',
    doneCreated: '  src/user-config.js è stato creato.',
    doneManual: 'Un passaggio manuale rimasto — scarica google-services.json:',
    doneStep1: '  1. Vai su Firebase Console → Impostazioni progetto',
    doneStep2: '  2. In "Le tue app", trova o crea un\'app Android',
    doneStep3: '  3. Clicca "Scarica google-services.json"',
    doneStep4: '  4. Metti il file nella ROOT del progetto',
    doneStep4b: '     (stessa cartella di package.json e setup.js)',
    doneBuild: 'Poi installa le dipendenze e compila:',
    doneExpo: 'Expo ti darà un link per scaricare l\'APK al termine.',
    doneShare: 'Condividi quel link con la tua famiglia!',
    doneGuide: '📖  Guida completa: README.md',
    errorEmpty: 'non può essere vuoto. Riprova.',
    errorFailed: 'Setup fallito:',
  },
  zh: {
    intro1: '此向导将在您的电脑上创建 src/user-config.js 文件。',
    intro2: '该文件已被 git 忽略 — 您的凭据仅保存在本地。',
    intro3: '开始之前，请确保您已准备好：',
    introFirebase: '• 一个 Firebase 项目  → https://console.firebase.google.com',
    introExpo: '• 一个 Expo 账号      → https://expo.dev',
    introCancel: '随时可按 Ctrl+C 取消。',
    pressEnter: '按 Enter 继续...',
    step1Title: '第 1 步 / 共 3 步  —  Firebase Web 配置',
    step1Info1: '如何获取这些值：',
    step1Info2: '  1. 打开 https://console.firebase.google.com',
    step1Info3: '  2. 选择您的项目',
    step1Info4: '  3. 点击 ⚙️  齿轮图标 → "项目设置"',
    step1Info5: '  4. 向下滚动到"您的应用" → 点击您的 Web 应用',
    step1Info6: '     （如果没有 Web 应用，点击"添加应用" → Web）',
    step1Info7: '  5. 在"SDK 设置和配置"下选择"配置"',
    step1Info8: '  6. 从 firebaseConfig 对象中复制以下每个值',
    apiKey: 'Firebase API Key',
    authDomain: 'Auth Domain  (例如 myproject.firebaseapp.com)',
    projectId: 'Project ID   (例如 myproject-abc12)',
    storageBucket: 'Storage Bucket  (例如 myproject.firebasestorage.app)',
    messagingSenderId: 'Messaging Sender ID  (仅数字)',
    appId: 'App ID  (例如 1:123456:web:abcdef)',
    step2Title: '第 2 步 / 共 3 步  —  Expo Project ID',
    step2Info1: '如何找到您的 Expo Project ID：',
    step2OptionA: '  方式 A — 从网站获取：',
    step2A1: '    1. 前往 https://expo.dev → 登录',
    step2A2: '    2. 打开您的项目',
    step2A3: '    3. 从概览页面复制"Project ID"',
    step2A4: '       (格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
    step2OptionB: '  方式 B — 通过命令行创建新项目：',
    step2B2: '    然后在 expo.dev 查看生成的 Project ID',
    expoProjectId: 'Expo Project ID',
    step3Title: '第 3 步 / 共 3 步  —  Android 包名',
    step3Info1: '这是您的应用在 Android 上的唯一标识符。',
    step3Info2: '格式  : com.yourname.appname  (小写字母、数字、点)',
    step3Info3: '示例  : com.smith.familytalk',
    step3Warn: '⚠️  APK 发布后无法更改包名。',
    androidPackage: 'Android 包名',
    doneTitle: '✅  配置已保存！',
    doneCreated: '  src/user-config.js 已创建。',
    doneManual: '还有一个手动步骤 — 下载 google-services.json：',
    doneStep1: '  1. 前往 Firebase Console → 项目设置',
    doneStep2: '  2. 在"您的应用"中，找到或创建一个 Android 应用',
    doneStep3: '  3. 点击"下载 google-services.json"',
    doneStep4: '  4. 将文件放在项目根目录',
    doneStep4b: '     （与 package.json 和 setup.js 同一文件夹）',
    doneBuild: '然后安装依赖并构建：',
    doneExpo: 'Expo 构建完成后会提供 APK 下载链接。',
    doneShare: '将链接分享给您的家人！',
    doneGuide: '📖  完整指南：README.md',
    errorEmpty: '不能为空，请重试。',
    errorFailed: '安装失败：',
  },
  th: {
    intro1: 'ตัวช่วยนี้จะสร้างไฟล์ src/user-config.js บนเครื่องของคุณ',
    intro2: 'ไฟล์นี้ถูก git ละเว้น — ข้อมูลของคุณจะอยู่บนเครื่องเท่านั้น',
    intro3: 'ก่อนเริ่มต้น ตรวจสอบให้แน่ใจว่าคุณมี:',
    introFirebase: '• โปรเจกต์ Firebase  → https://console.firebase.google.com',
    introExpo: '• บัญชี Expo         → https://expo.dev',
    introCancel: 'กด Ctrl+C ได้ทุกเมื่อเพื่อยกเลิก',
    pressEnter: 'กด Enter เพื่อดำเนินการต่อ...',
    step1Title: 'ขั้นตอนที่ 1 / 3  —  การตั้งค่า Firebase Web',
    step1Info1: 'วิธีค้นหาค่าเหล่านี้:',
    step1Info2: '  1. เปิด https://console.firebase.google.com',
    step1Info3: '  2. เลือกโปรเจกต์ของคุณ',
    step1Info4: '  3. คลิกไอคอน ⚙️  → "การตั้งค่าโปรเจกต์"',
    step1Info5: '  4. เลื่อนลงไปที่ "แอปของคุณ" → คลิกแอป Web ของคุณ',
    step1Info6: '     (ถ้าไม่มีแอป Web ให้คลิก "เพิ่มแอป" → Web)',
    step1Info7: '  5. ใน "การตั้งค่า SDK" เลือก "Config"',
    step1Info8: '  6. คัดลอกค่าแต่ละรายการจากออบเจกต์ firebaseConfig',
    apiKey: 'Firebase API Key',
    authDomain: 'Auth Domain  (เช่น myproject.firebaseapp.com)',
    projectId: 'Project ID   (เช่น myproject-abc12)',
    storageBucket: 'Storage Bucket  (เช่น myproject.firebasestorage.app)',
    messagingSenderId: 'Messaging Sender ID  (ตัวเลขเท่านั้น)',
    appId: 'App ID  (เช่น 1:123456:web:abcdef)',
    step2Title: 'ขั้นตอนที่ 2 / 3  —  Expo Project ID',
    step2Info1: 'วิธีค้นหา Expo Project ID ของคุณ:',
    step2OptionA: '  ตัวเลือก A — จากเว็บไซต์:',
    step2A1: '    1. ไปที่ https://expo.dev → เข้าสู่ระบบ',
    step2A2: '    2. เปิดโปรเจกต์ของคุณ',
    step2A3: '    3. คัดลอก "Project ID" จากหน้า Overview',
    step2A4: '       (รูปแบบ: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
    step2OptionB: '  ตัวเลือก B — สร้างโปรเจกต์ใหม่ผ่าน CLI:',
    step2B2: '    จากนั้นตรวจสอบ Project ID ที่ expo.dev',
    expoProjectId: 'Expo Project ID',
    step3Title: 'ขั้นตอนที่ 3 / 3  —  ชื่อแพ็กเกจ Android',
    step3Info1: 'นี่คือตัวระบุเฉพาะของแอปบน Android',
    step3Info2: 'รูปแบบ  : com.yourname.appname  (ตัวพิมพ์เล็ก ตัวอักษร ตัวเลข จุด)',
    step3Info3: 'ตัวอย่าง : com.smith.familytalk',
    step3Warn: '⚠️  เมื่อเผยแพร่ APK แล้ว จะเปลี่ยนชื่อแพ็กเกจไม่ได้',
    androidPackage: 'ชื่อแพ็กเกจ Android',
    doneTitle: '✅  บันทึกการตั้งค่าแล้ว!',
    doneCreated: '  สร้าง src/user-config.js แล้ว',
    doneManual: 'ยังมีขั้นตอนด้วยตนเองอีกหนึ่งขั้น — ดาวน์โหลด google-services.json:',
    doneStep1: '  1. ไปที่ Firebase Console → การตั้งค่าโปรเจกต์',
    doneStep2: '  2. ใน "แอปของคุณ" ค้นหาหรือสร้างแอป Android',
    doneStep3: '  3. คลิก "ดาวน์โหลด google-services.json"',
    doneStep4: '  4. วางไฟล์ไว้ใน ROOT ของโปรเจกต์',
    doneStep4b: '     (โฟลเดอร์เดียวกับ package.json และ setup.js)',
    doneBuild: 'จากนั้นติดตั้ง dependencies และ build:',
    doneExpo: 'Expo จะให้ลิงก์ดาวน์โหลด APK เมื่อเสร็จสิ้น',
    doneShare: 'แชร์ลิงก์นั้นกับครอบครัวของคุณ!',
    doneGuide: '📖  คู่มือฉบับเต็ม: README.md',
    errorEmpty: 'ไม่สามารถเว้นว่างได้ กรุณาลองใหม่',
    errorFailed: 'การตั้งค่าล้มเหลว:',
  },
};

function validate(value, name, s) {
  if (!value) {
    console.log(`\n  ⚠️  ${name} ${s.errorEmpty}\n`);
    return false;
  }
  return true;
}

async function askRequired(prompt, name, s) {
  let value = '';
  while (!value) {
    value = await ask(`  ${prompt}: `);
    if (!validate(value, name, s)) value = '';
  }
  return value;
}

async function main() {
  console.clear();
  console.log('');

  // ─────────────────────────────────────────────
  // Language selection
  // ─────────────────────────────────────────────
  title('🏠  FamTalk Setup Wizard');
  console.log('');
  const langChoice = await ask(`  ${STRINGS.en.langPrompt}: `);
  const langMap = { '1': 'en', '2': 'it', '3': 'zh', '4': 'th' };
  const langCode = langMap[langChoice] || 'en';
  if (!langMap[langChoice]) info(STRINGS.en.langInvalid);
  const s = STRINGS[langCode];

  console.clear();
  console.log('');
  title('🏠  FamTalk Setup Wizard');
  console.log('');
  info(s.intro1);
  info(s.intro2);
  console.log('');
  info(s.intro3);
  hint(`  ${s.introFirebase}`);
  hint(`  ${s.introExpo}`);
  console.log('');
  info(s.introCancel);
  console.log('');
  await ask(`  ${s.pressEnter}`);

  // ─────────────────────────────────────────────
  // STEP 1 — Firebase Web Config
  // ─────────────────────────────────────────────
  title(s.step1Title);
  console.log('');
  info(s.step1Info1);
  info(s.step1Info2);
  info(s.step1Info3);
  info(s.step1Info4);
  info(s.step1Info5);
  info(s.step1Info6);
  info(s.step1Info7);
  info(s.step1Info8);
  console.log('');

  const apiKey            = await askRequired(s.apiKey, s.apiKey, s);
  const authDomain        = await askRequired(s.authDomain, 'Auth Domain', s);
  const projectId         = await askRequired(s.projectId, 'Project ID', s);
  const storageBucket     = await askRequired(s.storageBucket, 'Storage Bucket', s);
  const messagingSenderId = await askRequired(s.messagingSenderId, 'Messaging Sender ID', s);
  const appId             = await askRequired(s.appId, 'App ID', s);

  // ─────────────────────────────────────────────
  // STEP 2 — Expo Project ID
  // ─────────────────────────────────────────────
  title(s.step2Title);
  console.log('');
  info(s.step2Info1);
  info(s.step2OptionA);
  info(s.step2A1);
  info(s.step2A2);
  info(s.step2A3);
  info(s.step2A4);
  console.log('');
  info(s.step2OptionB);
  hint('    npm install -g eas-cli');
  hint('    npx eas init');
  info(s.step2B2);
  console.log('');

  const expoProjectId = await askRequired(s.expoProjectId, 'Expo Project ID', s);

  // ─────────────────────────────────────────────
  // STEP 3 — Android Package Name
  // ─────────────────────────────────────────────
  title(s.step3Title);
  console.log('');
  info(s.step3Info1);
  info(s.step3Info2);
  info(s.step3Info3);
  console.log('');
  hint(`  ${s.step3Warn}`);
  console.log('');

  const androidPackage = await askRequired(s.androidPackage, s.androidPackage, s);

  // ─────────────────────────────────────────────
  // Write src/user-config.js
  // ─────────────────────────────────────────────
  const configContent = `// ============================================================
// AUTO-GENERATED by setup.js — DO NOT COMMIT THIS FILE
// Run "node setup.js" again to update these values.
// ============================================================

module.exports = {

  // Firebase — https://console.firebase.google.com
  firebase: {
    apiKey:            '${apiKey}',
    authDomain:        '${authDomain}',
    projectId:         '${projectId}',
    storageBucket:     '${storageBucket}',
    messagingSenderId: '${messagingSenderId}',
    appId:             '${appId}',
  },

  // Expo — https://expo.dev
  expoProjectId: '${expoProjectId}',

  // Android identifier
  androidPackage: '${androidPackage}',
};
`;

  const configPath = path.join(__dirname, 'src', 'user-config.js');
  fs.writeFileSync(configPath, configContent, 'utf8');

  // ─────────────────────────────────────────────
  // Done — next steps
  // ─────────────────────────────────────────────
  title(s.doneTitle);
  console.log('');
  ok(s.doneCreated);
  console.log('');
  info(s.doneManual);
  info('');
  info(s.doneStep1);
  info(s.doneStep2);
  hint(`     ${androidPackage}`);
  info(s.doneStep3);
  info(s.doneStep4);
  hint(s.doneStep4b);
  info('');
  info(s.doneBuild);
  info('');
  hint('  npm install');
  hint('  npx eas build --platform android --profile preview');
  info('');
  info(s.doneExpo);
  info(s.doneShare);
  console.log('');
  info(s.doneGuide);
  console.log('');

  rl.close();
}

main().catch((err) => {
  const s = STRINGS.en;
  console.error(`\n  ${s.errorFailed}`, err.message);
  rl.close();
  process.exit(1);
});
