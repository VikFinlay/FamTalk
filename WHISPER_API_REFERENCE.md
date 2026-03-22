# OpenAI Whisper API Reference — marzo 2026

> Fonte: documentazione ufficiale OpenAI. Da consultare SEMPRE prima di scrivere o debuggare la chiamata a Whisper.

## Endpoint

```http
POST https://api.openai.com/v1/audio/transcriptions
```

## Autenticazione

```http
Authorization: Bearer OPENAI_API_KEY
Content-Type: multipart/form-data
```

La API key NON va esposta lato client. Va salvata in un key management system (nel nostro caso: Firestore `/config/secrets`).

## Parametri

### Obbligatori

| Campo | Valore |
|-------|--------|
| `file` | File audio binario (formati: `flac`, `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `ogg`, `wav`, `webm`) |
| `model` | `whisper-1` (obbligatorio — basato su Whisper V2 open source) |

### Opzionali utili

| Campo | Valori | Note |
|-------|--------|------|
| `language` | ISO-639-1 (`it`, `th`, `zh`, `en`, ...) | Raccomandato: migliora accuratezza e latenza |
| `response_format` | `json`, `text`, `srt`, `vtt`, `verbose_json` | Default: `json` |
| `temperature` | `0`–`1` | 0 = più deterministico |
| `prompt` | stringa | Guida stile/terminologia, stessa lingua dell'audio |
| `timestamp_granularities[]` | `word`, `segment` | Solo con `response_format=verbose_json` |

### Parametri NON supportati da whisper-1

- `stream=true` → **ignorato**, non usarlo

## Risposta (response_format=json)

```json
{
  "text": "Questo è il testo trascritto."
}
```

## Risposta (response_format=verbose_json)

```json
{
  "language": "italian",
  "duration": 4.2,
  "text": "Questo è il testo trascritto.",
  "segments": [...],
  "words": [...]
}
```

## Esempio JavaScript fetch (React Native / Expo)

```javascript
// audioUri = URI locale del file registrato (es. file:///...)
// openaiKey = stringa sk-...

const formData = new FormData();
formData.append('file', {
  uri: audioUri,
  type: 'audio/m4a',   // o 'audio/webm' su web
  name: 'audio.m4a',
});
formData.append('model', 'whisper-1');
formData.append('language', senderLanguage); // es. 'it', 'th', 'zh'
formData.append('response_format', 'json');

const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiKey}`,
    // NON impostare Content-Type manualmente con FormData — fetch lo imposta da solo con il boundary
  },
  body: formData,
});

if (!res.ok) {
  const errText = await res.text();
  throw new Error(`Whisper error ${res.status}: ${errText}`);
}

const data = await res.json();
const transcription = data.text; // stringa
```

## Avvertenze critiche per React Native

1. **Non impostare `Content-Type` manualmente** quando usi `FormData` — fetch lo imposta automaticamente con il `boundary` corretto. Se lo imposti a mano, la richiesta fallisce.
2. **Il campo `file` in FormData su React Native** vuole un oggetto `{ uri, type, name }`, NON un Blob come nel browser.
3. **Su web (browser)** invece serve un Blob: `new Blob([arrayBuffer], { type: 'audio/webm' })`.
4. **Formato audio su Android** con expo-av: di default produce `.m4a` (AAC). Whisper lo accetta.
5. **Formato audio su Web** con MediaRecorder: di default produce `.webm`. Whisper lo accetta.
6. **`whisper-1` non supporta streaming** — aspetta la risposta completa.
7. **Specificare sempre `language`** con la lingua del mittente per accuratezza massima.

## Flusso nel progetto FamilyTalk

```
Registra audio (expo-av / MediaRecorder)
  → Upload in Firebase Storage (chats/{chatId}/voice_{uid}_{ts}.m4a)
  → Chiama Whisper → ottieni trascrizione (testo)
  → Chiama Claude → traduci nelle lingue dei destinatari
  → Salva in Firestore: { type: 'voice', audioUrl, originalText: trascrizione, translations: {...} }
```

## Costi indicativi

- Whisper: ~$0.006/minuto di audio
- Per una famiglia con uso normale: pochi centesimi al mese
