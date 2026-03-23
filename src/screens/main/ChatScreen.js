import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Modal, TouchableWithoutFeedback, ScrollView, Share, Dimensions,
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc, getDoc,
  arrayRemove, deleteDoc,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { db, storage, auth, STORAGE_BUCKET } from '../../firebase/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { translateText, translateTextMultiple, transcribeAudio } from '../../services/translation';
import { sendPushNotification } from '../../services/notifications';
import colors from '../../theme/colors';

const REACTIONS_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REACTIONS_ALL = [
  '👍','❤️','😂','😮','😢','🙏',
  '🔥','🎉','😍','🥰','😘','💯',
  '👏','🙌','💪','✅','🤝','👌',
  '😭','🤣','😅','😊','😎','🤗',
  '💕','💫','⭐','🌟','🎊','🥳',
  '😬','🤔','🫡','🥹','😴','😤',
  '👀','💀','🫶','🤩','😇','🫠',
];

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ route, navigation }) {
  const { chatId } = route.params;
  const { user, userProfile } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [isGroup, setIsGroup] = useState(false);
  const [groupParticipantLanguages, setGroupParticipantLanguages] = useState({});
  const [groupParticipants, setGroupParticipants] = useState([]);
  const [contactOnline, setContactOnline] = useState(false);
  const [contactPhoto, setContactPhoto] = useState(null);
  const [contactTyping, setContactTyping] = useState(false);
  const [contactName, setContactName] = useState(route.params?.contactName || '');
  const [contactUid, setContactUid] = useState(null);
  const [chatDeliveredTo, setChatDeliveredTo] = useState({});
  const [chatReadBy, setChatReadBy] = useState({});
  const [translationContext, setTranslationContext] = useState('');
  const [showContextModal, setShowContextModal] = useState(false);
  const [contextDraft, setContextDraft] = useState('');
  const [photoViewer, setPhotoViewer] = useState({ visible: false, uri: null });
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const flatListRef = useRef(null);
  const typingTimer = useRef(null);
  const recordingRef = useRef(null);   // expo-av Recording (native)
  const mediaRecorderRef = useRef(null); // MediaRecorder (web)
  const audioChunksRef = useRef([]);    // chunks web

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });
    return unsub;
  }, [chatId]);

  // Listener: stato online, typing, readBy, deliveredTo
  useEffect(() => {
    if (!user) return;
    let resolvedContactUid = null;

    const initChat = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      const chatData = chatDoc.data();

      if (chatData.isGroup) {
        setIsGroup(true);
        setGroupParticipants(chatData.participants || []);
        setGroupParticipantLanguages(chatData.participantLanguages || {});
      }

      resolvedContactUid = chatData.participants.find((uid) => uid !== user.uid);
      setContactUid(resolvedContactUid);

      // Carica contesto traduzione
      const savedContext = chatData.translationContext?.[user.uid] || '';
      setTranslationContext(savedContext);
      setContextDraft(savedContext);

      // Segna come letto quando si apre la chat
      updateDoc(doc(db, 'chats', chatId), {
        [`readBy.${user.uid}`]: serverTimestamp(),
      }).catch(() => {});

      // Online status
      const unsubOnline = onSnapshot(doc(db, 'users', resolvedContactUid), (snap) => {
        const data = snap.data() || {};
        setContactOnline(data.isOnline || false);
        setContactPhoto(data.photoURL || null);
      });

      // Typing + readBy + deliveredTo
      const unsubChat = onSnapshot(doc(db, 'chats', chatId), (snap) => {
        const data = snap.data() || {};
        const typing = data.typing || {};
        const ts = typing[resolvedContactUid];
        if (ts) {
          const age = Date.now() - (ts.toMillis ? ts.toMillis() : ts);
          setContactTyping(age < 5000);
        } else {
          setContactTyping(false);
        }
        setChatDeliveredTo(data.deliveredTo || {});
        setChatReadBy(data.readBy || {});
      });

      return () => { unsubOnline(); unsubChat(); };
    };

    const cleanup = initChat();
    return () => { cleanup.then((fn) => fn && fn()); };
  }, [chatId, user]);

  // Aggiorna readBy quando arriva un nuovo messaggio o quando torni sulla tab
  const lastMessageId = messages[messages.length - 1]?.id;
  const markAsRead = () => {
    if (!user?.uid) return;
    const isVisible = Platform.OS !== 'web' || document.visibilityState === 'visible';
    if (!isVisible) return;
    updateDoc(doc(db, 'chats', chatId), {
      [`readBy.${user.uid}`]: serverTimestamp(),
    }).catch(() => {});
  };
  useEffect(() => {
    if (!lastMessageId) return;
    markAsRead();
  }, [lastMessageId]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.addEventListener('visibilitychange', markAsRead);
    return () => document.removeEventListener('visibilitychange', markAsRead);
  }, [chatId, user?.uid]);

  const setTyping = async (isTyping) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`typing.${user.uid}`]: isTyping ? serverTimestamp() : null,
      });
    } catch {}
  };

  const handleTextChange = (val) => {
    setText(val);
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  };

  const getChatData = async () => {
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    return chatDoc.data();
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    const currentReply = replyTo;
    setReplyTo(null);
    setSending(true);
    try {
      const chatData = await getChatData();
      const myLanguage = userProfile.language;

      // Calcola destinatari e lingue target
      const otherUids = chatData.participants.filter((uid) => uid !== user.uid);
      const targetLanguages = [...new Set(
        otherUids.map((uid) => chatData.participantLanguages?.[uid]).filter(Boolean)
      )].filter((l) => l !== myLanguage);
      const needsTranslation = targetLanguages.length > 0;

      const messageData = {
        senderId: user.uid,
        senderName: userProfile.name,
        type: 'text',
        originalText: trimmed,
        originalLanguage: myLanguage,
        translations: { [myLanguage]: trimmed },
        translating: needsTranslation,
        timestamp: serverTimestamp(),
        reactions: {},
      };
      if (currentReply) {
        messageData.replyTo = {
          messageId: currentReply.id,
          senderName: currentReply.senderName,
          text: currentReply.translations?.[userProfile.language] || currentReply.originalText,
        };
      }

      // Invia subito — spinner si ferma qui
      const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      setSending(false);

      updateDoc(doc(db, 'chats', chatId), {
        lastMessage: trimmed,
        lastMessageAt: serverTimestamp(),
      }).catch(() => {});

      // Traduzione in background — non blocca l'UI
      if (needsTranslation) {
        translateTextMultiple(trimmed, myLanguage, targetLanguages, translationContext)
          .then((translations) => {
            updateDoc(doc(db, 'chats', chatId, 'messages', docRef.id), {
              ...Object.fromEntries(Object.entries(translations).map(([l, v]) => [`translations.${l}`, v])),
              translating: false,
            }).catch(() => {});
          })
          .catch(() => {
            updateDoc(doc(db, 'chats', chatId, 'messages', docRef.id), {
              translating: false,
            }).catch(() => {});
          });
      }

      otherUids.forEach((uid) => sendPushNotification(uid, userProfile.name, trimmed));
    } catch (e) {
      setSending(false);
      setText(trimmed);
      alert('Errore invio: ' + e.message);
    }
  };

  const uploadAndSendPhoto = async (uri, base64 = null) => {
    setUploadingPhoto(true);
    try {
      const chatData = await getChatData();
      const otherUids = chatData.participants.filter((uid) => uid !== user.uid);
      const filename = `chats/${chatId}/${user.uid}_${Date.now()}.jpg`;
      let imageUrl;
      if (Platform.OS === 'web' || !base64) {
        const blob = await uriToBlob(uri);
        imageUrl = await uploadDataToStorage(blob, filename, 'image/jpeg');
      } else {
        const buffer = base64ToArrayBuffer(base64);
        imageUrl = await uploadDataToStorage(buffer, filename, 'image/jpeg');
      }
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: userProfile.name,
        type: 'image',
        imageUrl,
        originalText: '📷 Foto',
        originalLanguage: userProfile.language,
        translations: {},
        timestamp: serverTimestamp(),
        reactions: {},
      });
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: '📷 Foto',
        lastMessageAt: serverTimestamp(),
      });
      otherUids.forEach((uid) => sendPushNotification(uid, userProfile.name, '📷 Foto'));
    } catch (e) {
      alert('Errore invio foto: ' + e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Su web, fetch locale funziona. Su Android, file:// è bloccato — usiamo base64 dall'ImagePicker
  const uriToBlob = (uri) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  const base64ToArrayBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  // Carica su Firebase Storage tramite REST API + XHR. data = Blob (web) o ArrayBuffer (native)
  const uploadDataToStorage = async (data, path, contentType) => {
    const token = await auth.currentUser.getIdToken();
    const encodedPath = encodeURIComponent(path);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status === 200) {
          const resp = JSON.parse(xhr.responseText);
          resolve(`https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${resp.downloadTokens}`);
        } else {
          reject(new Error(`Storage error ${xhr.status}: ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodedPath}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(data);
    });
  };

  const pickFromGallery = async () => {
    setShowPhotoMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    await uploadAndSendPhoto(result.assets[0].uri, result.assets[0].base64);
  };

  const pickFromCamera = async () => {
    setShowPhotoMenu(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Permesso fotocamera negato. Abilitalo nelle impostazioni del telefono.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    await uploadAndSendPhoto(result.assets[0].uri, result.assets[0].base64);
  };

  const sendVoiceMessage = async (audioSource) => {
    setUploadingVoice(true);
    try {
      const chatData = await getChatData();
      const myLanguage = userProfile.language;
      const otherUids = chatData.participants.filter((uid) => uid !== user.uid);
      const targetLanguages = [...new Set(
        otherUids.map((uid) => chatData.participantLanguages?.[uid]).filter(Boolean)
      )].filter((l) => l !== myLanguage);

      // Upload audio in Storage e trascrizione Whisper in parallelo
      // Su Android saltiamo lo Storage — mandiamo il file direttamente a Whisper tramite FormData
      // Su web carichiamo su Storage come appoggio temporaneo
      let audioUrl = null;
      let transcription;

      if (Platform.OS === 'web') {
        const ext = 'webm';
        const filename = `chats/${chatId}/voice_${user.uid}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, filename);
        const [url, tx] = await Promise.all([
          uploadDataToStorage(audioSource, filename, 'audio/webm'),
          transcribeAudio(audioSource, myLanguage),
        ]);
        audioUrl = url;
        transcription = tx;
        deleteObject(storageRef).catch(() => {});
      } else {
        transcription = await transcribeAudio(audioSource, myLanguage);
      }

      if (!transcription) {
        if (Platform.OS === 'web') {
          window.alert('Audio non riconosciuto. Riprova parlando più vicino al microfono.');
        } else {
          alert('Audio non riconosciuto. Riprova parlando più vicino al microfono.');
        }
        return;
      }

      const needsTranslation = targetLanguages.length > 0;
      const messageData = {
        senderId: user.uid,
        senderName: userProfile.name,
        type: 'voice',
        audioUrl,
        originalText: transcription,
        originalLanguage: myLanguage,
        translations: { [myLanguage]: transcription },
        translating: needsTranslation,
        timestamp: serverTimestamp(),
        reactions: {},
      };

      const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

      updateDoc(doc(db, 'chats', chatId), {
        lastMessage: '🎤 ' + transcription.slice(0, 60),
        lastMessageAt: serverTimestamp(),
      }).catch(() => {});

      if (needsTranslation) {
        translateTextMultiple(transcription, myLanguage, targetLanguages, translationContext)
          .then((translations) => {
            updateDoc(doc(db, 'chats', chatId, 'messages', docRef.id), {
              ...Object.fromEntries(Object.entries(translations).map(([l, v]) => [`translations.${l}`, v])),
              translating: false,
            }).catch(() => {});
          })
          .catch(() => {
            updateDoc(doc(db, 'chats', chatId, 'messages', docRef.id), { translating: false }).catch(() => {});
          });
      }

      otherUids.forEach((uid) => sendPushNotification(uid, userProfile.name, '🎤 ' + transcription.slice(0, 60)));
    } catch (e) {
      alert('Errore messaggio vocale: ' + e.message);
    } finally {
      setUploadingVoice(false);
    }
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await sendVoiceMessage(blob);
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setIsRecording(true);
      } catch (e) {
        alert('Impossibile accedere al microfono: ' + e.message);
      }
    } else {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) { alert('Permesso microfono negato.'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
      } catch (e) {
        alert('Errore avvio registrazione: ' + e.message);
      }
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (Platform.OS === 'web') {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      // sendVoiceMessage viene chiamato nell'handler onstop del MediaRecorder
    } else {
      try {
        const recording = recordingRef.current;
        recordingRef.current = null;
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = recording.getURI();
        await sendVoiceMessage(uri);
      } catch (e) {
        alert('Errore stop registrazione: ' + e.message);
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleReaction = async (message, emoji) => {
    setSelectedMessage(null);
    const reactions = message.reactions || {};
    const users = reactions[emoji] || [];
    const alreadyReacted = users.includes(user.uid);
    const updatedUsers = alreadyReacted
      ? users.filter((uid) => uid !== user.uid)
      : [...users, user.uid];
    const updatedReactions = { ...reactions, [emoji]: updatedUsers };
    if (updatedUsers.length === 0) delete updatedReactions[emoji];
    await updateDoc(doc(db, 'chats', chatId, 'messages', message.id), {
      reactions: updatedReactions,
    });
  };

  const tsToMillis = (ts) => {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    return 0;
  };

  const getMessageStatus = (item) => {
    if (item.senderId !== user.uid || !contactUid) return null;
    const msgTime = tsToMillis(item.timestamp);
    if (!msgTime) return 'sent';
    const readTime = tsToMillis(chatReadBy[contactUid]);
    const deliveredTime = tsToMillis(chatDeliveredTo[contactUid]);
    if (readTime && msgTime <= readTime) return 'read';
    if (deliveredTime && msgTime <= deliveredTime) return 'delivered';
    return 'sent';
  };

  const renderTicks = (status) => {
    if (!status) return null;
    if (status === 'sent') return <Text style={styles.tick}>✓</Text>;
    if (status === 'delivered') return <Text style={styles.tick}>✓✓</Text>;
    if (status === 'read') return <Text style={styles.tickRead}>✓✓</Text>;
    return null;
  };

  const renderReactions = (reactions) => {
    if (!reactions || Object.keys(reactions).length === 0) return null;
    return (
      <View style={styles.reactionsRow}>
        {Object.entries(reactions).map(([emoji, users]) =>
          users.length > 0 ? (
            <View key={emoji} style={[
              styles.reactionBadge,
              users.includes(user.uid) && styles.reactionBadgeActive,
            ]}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {users.length > 1 && <Text style={styles.reactionCount}>{users.length}</Text>}
            </View>
          ) : null
        )}
      </View>
    );
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === user.uid;
    const isTranslated = item.type !== 'image' && item.originalLanguage !== userProfile.language;
    const displayText = item.translations?.[userProfile.language] || item.originalText;
    const status = getMessageStatus(item);

    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowRight : styles.messageRowLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleSent : styles.bubbleReceived]}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setSelectedMessage(item)}
          >
            <Text style={styles.menuBtnText}>···</Text>
          </TouchableOpacity>

          {isGroup && !isMine && (
            <Text style={styles.groupSenderName}>{item.senderName}</Text>
          )}

          {item.replyTo && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyName}>{item.replyTo.senderName}</Text>
              <Text style={styles.replyText} numberOfLines={1}>{item.replyTo.text}</Text>
            </View>
          )}

          {item.type === 'image' ? (
            <TouchableOpacity onPress={() => setPhotoViewer({ visible: true, uri: item.imageUrl })}>
              <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : item.type === 'voice' ? (
            <>
              <Text style={styles.voiceLabel}>🎤 Messaggio vocale</Text>
              <Text style={styles.messageText}>{displayText}</Text>
              {item.translating && (
                <Text style={styles.translatingText}>⏳ traduzione in corso...</Text>
              )}
              {isTranslated && !item.translating && (
                <Text style={styles.originalText}>{item.originalText}</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.messageText}>{displayText}</Text>
              {item.translating && (
                <Text style={styles.translatingText}>⏳ traduzione in corso...</Text>
              )}
              {isTranslated && !item.translating && (
                <Text style={styles.originalText}>{item.originalText}</Text>
              )}
            </>
          )}
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
            {renderTicks(status)}
          </View>
        </View>
        {renderReactions(item.reactions)}
      </View>
    );
  };

  const leaveGroup = () => {
    Alert.alert(
      t('leaveGroup'),
      t('leaveGroupConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('leaveGroup'),
          style: 'destructive',
          onPress: async () => {
            try {
              const chatRef = doc(db, 'chats', chatId);
              const chatSnap = await getDoc(chatRef);
              const chatData = chatSnap.data();
              const remaining = chatData.participants.filter((uid) => uid !== user.uid);

              if (remaining.length === 0) {
                await deleteDoc(chatRef);
              } else {
                const updates = {
                  participants: arrayRemove(user.uid),
                  [`participantNames.${user.uid}`]: null,
                  [`participantLanguages.${user.uid}`]: null,
                };
                // Trasferisci admin se necessario
                if (chatData.adminUid === user.uid) {
                  updates.adminUid = remaining[0];
                }
                await updateDoc(chatRef, updates);
              }
              navigation.replace('Home');
            } catch (e) {
              Alert.alert(t('error'), e.message);
            }
          },
        },
      ]
    );
  };

  const showGroupOptions = () => {
    Alert.alert(
      contactName,
      null,
      [
        { text: t('leaveGroup'), style: 'destructive', onPress: leaveGroup },
        { text: t('cancel'), style: 'cancel' },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
    >
      <View style={[styles.chatHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          {isGroup
            ? <Text style={styles.headerAvatarEmoji}>👥</Text>
            : contactPhoto
              ? <Image source={{ uri: contactPhoto }} style={styles.headerAvatarImage} />
              : <Text style={styles.headerAvatarInitial}>{contactName?.[0]?.toUpperCase()}</Text>
          }
          {!isGroup && (
            <View style={[styles.headerOnlineDot, contactOnline ? styles.onlineDotActive : styles.onlineDotInactive]} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.chatHeaderName}>{contactName}</Text>
          <Text style={styles.chatHeaderStatus}>
            {isGroup
              ? `${groupParticipants.length} ${t('participantsCount')}`
              : contactTyping ? t('typing') : contactOnline ? t('online') : t('offline')
            }
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.contextBtn, translationContext ? styles.contextBtnActive : null]}
          onPress={() => { setContextDraft(translationContext); setShowContextModal(true); }}
        >
          <Text style={styles.contextBtnText}>🌐</Text>
        </TouchableOpacity>
        {isGroup && (
          <TouchableOpacity style={styles.groupOptionsBtn} onPress={showGroupOptions}>
            <Text style={styles.groupOptionsBtnText}>⋮</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        style={styles.messageList}
        inverted
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={10}
        removeClippedSubviews={false}
      />

      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarName}>{replyTo.senderName}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyTo.translations?.[userProfile.language] || replyTo.originalText}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyBarClose}>
            <Text style={styles.replyBarCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.photoBtn} onPress={() => setShowPhotoMenu(true)} disabled={uploadingPhoto}>
          {uploadingPhoto
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Text style={styles.photoBtnText}>📷</Text>
          }
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Scrivi un messaggio..."
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={handleTextChange}
          multiline
          maxLength={1000}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
              sendMessage();
            }
          }}
        />
        {text.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendBtnText}>➤</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, isRecording && styles.micBtnRecording]}
            onPress={toggleRecording}
            disabled={uploadingVoice}
          >
            {uploadingVoice
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendBtnText}>{isRecording ? '⏹' : '🎤'}</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={photoViewer.visible} transparent={false} animationType="fade" statusBarTranslucent>
        <View style={styles.photoViewerContainer}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.photoViewerScroll}
            minimumZoomScale={1}
            maximumZoomScale={5}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: photoViewer.uri }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          </ScrollView>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setPhotoViewer({ visible: false, uri: null })}
          >
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoViewerSave}
            onPress={() => Share.share(Platform.OS === 'ios' ? { url: photoViewer.uri } : { message: photoViewer.uri })}
          >
            <Text style={styles.photoViewerSaveText}>💾 Condividi / Salva</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showContextModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowContextModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.contextModal}>
                <Text style={styles.contextModalTitle}>Contesto traduzione</Text>
                <Text style={styles.contextModalSub}>
                  Opzionale. Descrivi tono, argomento o note per aiutare la traduzione.
                </Text>
                <TextInput
                  style={styles.contextInput}
                  placeholder="es. stiamo parlando delle vacanze, tono informale..."
                  placeholderTextColor={colors.textSecondary}
                  value={contextDraft}
                  onChangeText={setContextDraft}
                  multiline
                  maxLength={300}
                />
                <View style={styles.contextButtons}>
                  <TouchableOpacity
                    style={styles.contextClearBtn}
                    onPress={() => {
                      setContextDraft('');
                      setTranslationContext('');
                      setShowContextModal(false);
                      updateDoc(doc(db, 'chats', chatId), {
                        [`translationContext.${user.uid}`]: '',
                      }).catch(() => {});
                    }}
                  >
                    <Text style={styles.contextClearText}>Cancella</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contextSaveBtn}
                    onPress={() => {
                      setTranslationContext(contextDraft);
                      setShowContextModal(false);
                      updateDoc(doc(db, 'chats', chatId), {
                        [`translationContext.${user.uid}`]: contextDraft,
                      }).catch(() => {});
                    }}
                  >
                    <Text style={styles.contextSaveText}>Salva</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={showPhotoMenu} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowPhotoMenu(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.photoMenu}>
                <TouchableOpacity style={styles.photoMenuItem} onPress={pickFromCamera}>
                  <Text style={styles.photoMenuIcon}>📷</Text>
                  <Text style={styles.photoMenuText}>Fotocamera</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.photoMenuItem} onPress={pickFromGallery}>
                  <Text style={styles.photoMenuIcon}>🖼️</Text>
                  <Text style={styles.photoMenuText}>Galleria</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={!!selectedMessage} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setSelectedMessage(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.reactionModal}>
                <Text style={styles.reactionModalTitle}>Reazione rapida</Text>
                <View style={styles.quickReactionsRow}>
                  {REACTIONS_QUICK.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.emojiBtn}
                      onPress={() => toggleReaction(selectedMessage, emoji)}
                    >
                      <Text style={styles.emojiTextLarge}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.divider} />
                <Text style={styles.reactionModalTitle}>Tutte le emoji</Text>

                <ScrollView style={styles.emojiGrid} showsVerticalScrollIndicator={false}>
                  <View style={styles.emojiGridInner}>
                    {REACTIONS_ALL.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.emojiBtn}
                        onPress={() => toggleReaction(selectedMessage, emoji)}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.replyBtn}
                  onPress={() => { setReplyTo(selectedMessage); setSelectedMessage(null); }}
                >
                  <Text style={styles.replyBtnText}>↩  Rispondi</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 20, paddingBottom: 8, paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 6 },
  backBtnText: { color: colors.primary, fontSize: 22 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary + '33',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', position: 'relative',
  },
  headerAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarInitial: { color: colors.primary, fontSize: 18, fontWeight: 'bold' },
  headerAvatarEmoji: { fontSize: 20 },
  headerOnlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: colors.surface,
  },
  onlineDotActive: { backgroundColor: colors.primary },
  onlineDotInactive: { backgroundColor: colors.textMuted },
  chatHeaderName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  chatHeaderStatus: { color: colors.textSecondary, fontSize: 12 },
  groupSenderName: { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 3 },
  messageList: { flex: 1 },
  messagesList: { padding: 12, paddingBottom: 8 },
  messageRow: { marginVertical: 3, maxWidth: '80%' },
  messageRowRight: { alignSelf: 'flex-end' },
  messageRowLeft: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleSent: { backgroundColor: colors.bubbleSent, borderBottomRightRadius: 4 },
  bubbleReceived: { backgroundColor: colors.bubbleReceived, borderBottomLeftRadius: 4 },
  menuBtn: { alignSelf: 'flex-end', marginBottom: 2 },
  menuBtnText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, letterSpacing: 2 },
  messageText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  messageImage: { width: 220, height: 220, borderRadius: 10 },
  originalText: {
    color: colors.textSecondary, fontSize: 12, marginTop: 4,
    fontStyle: 'italic', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4,
  },
  translatingText: {
    color: colors.textSecondary, fontSize: 11, marginTop: 4, fontStyle: 'italic',
  },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  messageTime: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  tick: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  tickRead: { color: '#4FC3F7', fontSize: 11, fontWeight: '600' },
  replyPreview: {
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    paddingLeft: 8, marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 4, padding: 6,
  },
  replyName: { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  replyText: { color: colors.textSecondary, fontSize: 12 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 3, gap: 4 },
  reactionBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  reactionBadgeActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: colors.textSecondary, fontSize: 11, marginLeft: 3 },
  replyBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: 10, paddingHorizontal: 16,
  },
  replyBarContent: { flex: 1, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 10 },
  replyBarName: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  replyBarText: { color: colors.textSecondary, fontSize: 12 },
  replyBarClose: { padding: 6 },
  replyBarCloseText: { color: colors.textSecondary, fontSize: 16 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, paddingBottom: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border, gap: 8,
  },
  photoBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  photoBtnText: { fontSize: 20 },
  input: {
    flex: 1, backgroundColor: colors.surfaceElevated, color: colors.text,
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 16, maxHeight: 120, borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { color: '#fff', fontSize: 18 },
  micBtnRecording: { backgroundColor: '#e53935' },
  voiceLabel: { color: colors.primary, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  photoViewerContainer: { flex: 1, backgroundColor: '#000' },
  photoViewerScroll: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoViewerImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  photoViewerClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 10,
  },
  photoViewerCloseText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  photoViewerSave: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  photoViewerSaveText: { color: '#fff', fontSize: 16 },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    justifyContent: 'center', alignItems: 'center',
  },
  reactionModal: {
    backgroundColor: colors.surface, borderRadius: 20,
    padding: 16, width: 320,
    borderWidth: 1, borderColor: colors.border,
    maxHeight: 480,
  },
  reactionModalTitle: {
    color: colors.textSecondary, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 10,
  },
  quickReactionsRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12,
  },
  emojiGrid: { maxHeight: 200 },
  emojiGridInner: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  emojiBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  emojiTextLarge: { fontSize: 30 },
  emojiText: { fontSize: 24 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  replyBtn: { paddingVertical: 10, alignItems: 'center' },
  replyBtnText: { color: colors.text, fontSize: 16 },
  contextBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  groupOptionsBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 6,
  },
  groupOptionsBtnText: {
    color: colors.textSecondary, fontSize: 22, lineHeight: 26,
  },
  contextBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  contextBtnText: { fontSize: 18 },
  contextModal: {
    backgroundColor: colors.surface, borderRadius: 20,
    padding: 20, width: 340,
    borderWidth: 1, borderColor: colors.border,
  },
  contextModalTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  contextModalSub: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
  contextInput: {
    backgroundColor: colors.surfaceElevated, color: colors.text,
    borderRadius: 12, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
    minHeight: 80, textAlignVertical: 'top', marginBottom: 14,
  },
  contextButtons: { flexDirection: 'row', gap: 10 },
  contextClearBtn: {
    flex: 1, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  contextClearText: { color: colors.textSecondary, fontSize: 14 },
  contextSaveBtn: {
    flex: 1, padding: 12, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  contextSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  photoMenu: {
    backgroundColor: colors.surface, borderRadius: 16,
    width: 220, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  photoMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, paddingHorizontal: 20,
  },
  photoMenuIcon: { fontSize: 22 },
  photoMenuText: { color: colors.text, fontSize: 16 },
});
