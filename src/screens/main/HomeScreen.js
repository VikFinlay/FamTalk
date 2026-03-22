import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, query, where, onSnapshot, getDocs,
  doc, setDoc, deleteDoc, serverTimestamp, orderBy, getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { db, auth, storage } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { LANGUAGES } from '../../i18n/index';
import colors from '../../theme/colors';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 86400000) {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export default function HomeScreen({ navigation }) {
  const { user, userProfile, updateUserProfile } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const langName = (code) => {
    const lang = LANGUAGES.find((l) => l.code === code);
    return lang ? t(lang.key) : code;
  };
  const [chats, setChats] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [contactPhotos, setContactPhotos] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fabMenuVisible, setFabMenuVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsubs = [];
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChats(list);

      // Ascolta lo stato online di ogni contatto
      list.forEach((chat) => {
        const contactUid = chat.participants?.find((uid) => uid !== user.uid);
        if (!contactUid) return;
        const u = onSnapshot(doc(db, 'users', contactUid), (userSnap) => {
          const data = userSnap.data() || {};
          setOnlineStatus((prev) => ({ ...prev, [contactUid]: data.isOnline || false }));
          setContactPhotos((prev) => ({ ...prev, [contactUid]: data.photoURL || null }));
        });
        unsubs.push(u);
      });
    });
    return () => { unsub(); unsubs.forEach((u) => u()); };
  }, [user]);

  const pickProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `profilePictures/${user.uid}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await updateUserProfile({ photoURL: url });
    } catch {
      Alert.alert(t('error'), 'Upload foto fallito.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const confirmDeleteChat = (chatId) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('deleteChatConfirm'))) {
        deleteDoc(doc(db, 'chats', chatId)).catch(() => {});
      }
    } else {
      Alert.alert(t('deleteChat'), t('deleteChatConfirm'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => deleteDoc(doc(db, 'chats', chatId)).catch(() => {}) },
      ]);
    }
  };

  const addContact = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    setAdding(true);
    try {
      const q = query(collection(db, 'users'), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert(t('notFound'), t('userNotFound'));
        return;
      }
      const contactDoc = snap.docs[0];
      const contact = contactDoc.data();
      if (contact.uid === user.uid) {
        Alert.alert(t('error'), t('errorSelf'));
        return;
      }

      const chatId = getChatId(user.uid, contact.uid);
      await setDoc(doc(db, 'chats', chatId), {
        participants: [user.uid, contact.uid],
        participantNames: {
          [user.uid]: userProfile.name,
          [contact.uid]: contact.name,
        },
        participantLanguages: {
          [user.uid]: userProfile.language,
          [contact.uid]: contact.language,
        },
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      setModalVisible(false);
      setInviteCode('');
      navigation.navigate('Chat', { chatId, contactName: contact.name });
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally {
      setAdding(false);
    }
  };

  const renderChat = ({ item }) => {
    const isGroup = item.isGroup || false;
    const contactUid = !isGroup ? item.participants?.find((uid) => uid !== user.uid) : null;
    const contactName = isGroup
      ? item.groupName || 'Gruppo'
      : item.participantNames?.[contactUid] || 'Chat';
    const isOnline = !isGroup && (onlineStatus[contactUid] || false);
    const contactPhoto = !isGroup && (contactPhotos[contactUid] || null);

    return (
      <View style={styles.chatItemWrapper}>
        <TouchableOpacity
          style={styles.chatItem}
          onPress={() => navigation.navigate('Chat', { chatId: item.id, contactName })}
        >
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              {isGroup
                ? <Text style={styles.avatarText}>👥</Text>
                : contactPhoto
                  ? <Image source={{ uri: contactPhoto }} style={styles.avatarImage} />
                  : <Text style={styles.avatarText}>{contactName?.[0]?.toUpperCase()}</Text>
              }
            </View>
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.chatInfo}>
            <View style={styles.chatRow}>
              <Text style={styles.chatName}>{contactName}</Text>
              <Text style={styles.chatTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.chatLastMessage} numberOfLines={1}>
              {item.lastMessage || t('noMessages')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatMenuBtn}
          onPress={() => confirmDeleteChat(item.id)}
        >
          <Text style={styles.chatMenuBtnText}>⋯</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <Text style={styles.headerTitle}>FamilyTalk</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setProfileVisible(true)}>
            <Text style={styles.headerBtnText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => signOut(auth)}>
            <Text style={[styles.headerBtnText, { color: colors.text }]}>↩</Text>
          </TouchableOpacity>
        </View>
      </View>

      {chats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('noChatsYet')}</Text>
          <Text style={styles.emptySubText}>{t('noChatsSubtext')}</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChat}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {fabMenuVisible && (
        <View style={[styles.fabMenu, { bottom: 96 + insets.bottom }]}>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setFabMenuVisible(false); setModalVisible(true); }}
          >
            <Text style={styles.fabMenuText}>👤  {t('newContact')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => { setFabMenuVisible(false); navigation.navigate('CreateGroup'); }}
          >
            <Text style={styles.fabMenuText}>👥  {t('newGroup')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={[styles.fab, { bottom: 28 + insets.bottom }]} onPress={() => setFabMenuVisible((v) => !v)}>
        <Text style={styles.fabText}>{fabMenuVisible ? '✕' : '+'}</Text>
      </TouchableOpacity>

      <Modal visible={profileVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('yourProfile')}</Text>

            <TouchableOpacity style={styles.profileAvatarWrap} onPress={pickProfilePhoto} disabled={uploadingPhoto}>
              <View style={styles.profileAvatar}>
                {uploadingPhoto
                  ? <ActivityIndicator color={colors.primary} />
                  : userProfile?.photoURL
                    ? <Image source={{ uri: userProfile.photoURL }} style={styles.profileAvatarImage} />
                    : <Text style={styles.profileAvatarText}>{userProfile?.name?.[0]?.toUpperCase()}</Text>
                }
              </View>
              <Text style={styles.profileAvatarHint}>📷</Text>
            </TouchableOpacity>

            <Text style={styles.modalSub}>{t('labelName')}: {userProfile?.name}</Text>
            <Text style={styles.modalSub}>
              {t('labelLanguage')}: {langName(userProfile?.language)}
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>{t('yourInviteCode')}</Text>
              <Text style={styles.codeText}>{userProfile?.inviteCode}</Text>
              <Text style={styles.codeSub}>{t('shareCodeHint')}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalConfirm}
              onPress={() => setProfileVisible(false)}
            >
              <Text style={styles.modalConfirmText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('addContact')}</Text>
            <Text style={styles.modalSub}>{t('addContactHint')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="FMLY-XXXX"
              placeholderTextColor={colors.textSecondary}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setModalVisible(false); setInviteCode(''); }}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={addContact} disabled={adding}>
                {adding
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalConfirmText}>{t('add')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 8 },
  headerBtnText: { fontSize: 20 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  chatItemWrapper: { flexDirection: 'row', alignItems: 'center' },
  chatItem: { flex: 1, flexDirection: 'row', padding: 16, alignItems: 'center' },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: 'bold' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  profileAvatarWrap: { alignItems: 'center', marginBottom: 16 },
  profileAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary + '33',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: { width: 80, height: 80, borderRadius: 40 },
  profileAvatarText: { color: colors.primary, fontSize: 32, fontWeight: 'bold' },
  profileAvatarHint: { fontSize: 18, marginTop: 6 },
  chatInfo: { flex: 1 },
  chatRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  chatTime: { color: colors.textSecondary, fontSize: 12 },
  chatLastMessage: { color: colors.textSecondary, fontSize: 14 },
  chatMenuBtn: { padding: 8, justifyContent: 'center' },
  chatMenuBtnText: { color: colors.textSecondary, fontSize: 20, letterSpacing: 1 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  fabMenu: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    gap: 8,
  },
  fabMenuItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabMenuText: { color: colors.text, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modalSub: { color: colors.textSecondary, fontSize: 13, marginBottom: 20 },
  modalInput: {
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.border,
    letterSpacing: 2,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  modalCancelText: { color: colors.textSecondary, fontSize: 15 },
  modalConfirm: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  codeBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  codeText: { color: colors.primary, fontSize: 28, fontWeight: 'bold', letterSpacing: 4, marginBottom: 4 },
  codeSub: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
});
