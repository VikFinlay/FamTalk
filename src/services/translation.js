import { doc, getDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebase/config';

const LANG_NAMES = {
  it: 'Italian',
  th: 'Thai',
  zh: 'Chinese (Simplified)',
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese (Brazilian)',
  ru: 'Russian',
};

// Cache in memoria — evita un getDoc Firestore ad ogni traduzione
let cachedSecrets = null;

async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;
  const snap = await getDoc(doc(db, 'config', 'secrets'));
  if (!snap.exists()) throw new Error('API key non configurata nelle impostazioni admin');
  cachedSecrets = snap.data();
  return cachedSecrets;
}

export function clearSecretsCache() {
  cachedSecrets = null;
}

// Traduce in più lingue con una sola chiamata API — usato per i gruppi
export async function translateTextMultiple(text, fromLang, toLangs, context = '') {
  const targets = [...new Set(toLangs)].filter((l) => l !== fromLang);
  if (targets.length === 0) return {};
  if (targets.length === 1) {
    const result = await translateText(text, fromLang, targets[0], context);
    return { [targets[0]]: result };
  }

  const { anthropicKey, model } = await getSecrets();
  const targetDesc = targets.map((l) => `"${l}": ${LANG_NAMES[l]}`).join(', ');
  const contextLine = context?.trim() ? `\nContext: ${context.trim()}\n` : '';
  const exampleJson = targets.map((l) => `"${l}": "..."`).join(', ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Translate from ${LANG_NAMES[fromLang]} to multiple languages.\nReturn ONLY valid JSON with keys: ${targetDesc}.\nExample format: {${exampleJson}}${contextLine}\nText: ${text}`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Errore traduzione');
    }

    const data = await response.json();
    const raw = data.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON non trovato nella risposta');
    return JSON.parse(jsonMatch[0]);
  } finally {
    clearTimeout(timeout);
  }
}

// Trascrive un file audio con OpenAI Whisper.
// Su native: audioSource è un URI locale (string).
// Su web: audioSource è un Blob.
// language: codice ISO-639-1 della lingua del mittente (es. 'it', 'th', 'zh').
// Ref: WHISPER_API_REFERENCE.md nella root del progetto.
export async function transcribeAudio(audioSource, language) {
  const { openaiKey } = await getSecrets();
  if (!openaiKey) throw new Error('OpenAI API key non configurata. Aggiungila nelle impostazioni admin.');

  const formData = new FormData();

  if (Platform.OS === 'web') {
    // Su web audioSource è un Blob — NON impostare Content-Type manualmente
    formData.append('file', audioSource, 'audio.webm');
  } else {
    // Su native audioSource è un URI locale — oggetto { uri, type, name }
    formData.append('file', { uri: audioSource, type: 'audio/m4a', name: 'audio.m4a' });
  }

  formData.append('model', 'whisper-1');
  formData.append('language', language);
  formData.append('response_format', 'json');

  // IMPORTANTE: non impostare Content-Type — fetch lo imposta automaticamente con il boundary
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.text?.trim() || '';
}

export async function translateText(text, fromLang, toLang, context = '') {
  if (fromLang === toLang) return text;

  const { anthropicKey, model } = await getSecrets();

  const contextLine = context?.trim()
    ? `\nAdditional context: ${context.trim()}\n`
    : '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 secondi max

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Translate from ${LANG_NAMES[fromLang]} to ${LANG_NAMES[toLang]}. Return ONLY the translated text.${contextLine}\n${text}`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Errore traduzione');
    }

    const data = await response.json();
    return data.content[0].text.trim();
  } finally {
    clearTimeout(timeout);
  }
}
