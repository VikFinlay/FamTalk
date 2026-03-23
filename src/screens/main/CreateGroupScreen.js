import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import {
  collection, query, where, getDocs, onSnapshot,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import colors from '../../theme/colors';

export default function CreateGroupScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const { t } = useI18n();

  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [members, setMembers] = useState([]); // { uid, name, language }
  const [knownContacts, setKnownContacts] = useState([]); // { uid, name, language }
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);

  // Carica i contatti conosciuti dalle chat private esistenti
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      where('isGroup', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const contacts = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        const otherUid = data.participants?.find((uid) => uid !== user.uid);
        if (!otherUid) return;
        if (contacts.find((c) => c.uid === otherUid)) return;
        contacts.push({
          uid: otherUid,
          name: data.participantNames?.[otherUid] || otherUid,
          language: data.participantLanguages?.[otherUid] || '',
        });
      });
      setKnownContacts(contacts);
    });
    return () => unsub();
  }, [user]);

  const toggleKnownContact = (contact) => {
    const already = members.find((m) => m.uid === contact.uid);
    if (already) {
      setMembers((prev) => prev.filter((m) => m.uid !== contact.uid));
    } else {
      setMembers((prev) => [...prev, contact]);
    }
  };

  const addMember = async () => {
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
      const contact = snap.docs[0].data();
      if (contact.uid === user.uid) {
        Alert.alert(t('error'), t('errorSelf'));
        return;
      }
      if (members.find((m) => m.uid === contact.uid)) {
        Alert.alert(t('error'), t('alreadyAdded'));
        return;
      }
      setMembers((prev) => [...prev, { uid: contact.uid, name: contact.name, language: contact.language }]);
      setInviteCode('');
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeMember = (uid) => {
    setMembers((prev) => prev.filter((m) => m.uid !== uid));
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert(t('error'), t('groupNameRequired'));
      return;
    }
    if (members.length === 0) {
      Alert.alert(t('error'), t('groupMemberRequired'));
      return;
    }
    setCreating(true);
    try {
      const allMembers = [
        { uid: user.uid, name: userProfile.name, language: userProfile.language },
        ...members,
      ];
      const participants = allMembers.map((m) => m.uid);
      const participantNames = Object.fromEntries(allMembers.map((m) => [m.uid, m.name]));
      const participantLanguages = Object.fromEntries(allMembers.map((m) => [m.uid, m.language]));

      const chatId = `group_${user.uid}_${Date.now()}`;
      await setDoc(doc(db, 'chats', chatId), {
        isGroup: true,
        groupName: groupName.trim(),
        adminUid: user.uid,
        participants,
        participantNames,
        participantLanguages,
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      navigation.replace('Chat', { chatId, contactName: groupName.trim() });
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.label}>{t('groupNameLabel')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('groupNamePlaceholder')}
        placeholderTextColor={colors.textSecondary}
        value={groupName}
        onChangeText={setGroupName}
      />

      {/* Lista contatti conosciuti */}
      <Text style={[styles.label, { marginTop: 24 }]}>{t('addMembers')}</Text>
      <Text style={styles.sectionTitle}>{t('knownContacts')}</Text>
      {knownContacts.length === 0 ? (
        <Text style={styles.emptyText}>{t('noKnownContacts')}</Text>
      ) : (
        <View style={styles.contactList}>
          {knownContacts.map((contact) => {
            const selected = !!members.find((m) => m.uid === contact.uid);
            return (
              <TouchableOpacity
                key={contact.uid}
                style={[styles.contactItem, selected && styles.contactItemSelected]}
                onPress={() => toggleKnownContact(contact)}
                activeOpacity={0.7}
              >
                <View style={[styles.memberAvatar, selected && styles.memberAvatarSelected]}>
                  <Text style={[styles.memberAvatarText, selected && styles.memberAvatarTextSelected]}>
                    {contact.name[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.memberName, selected && styles.memberNameSelected]}>
                  {contact.name}
                </Text>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Aggiungi tramite codice invito */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('orAddByCode')}</Text>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder={t('inviteCodePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addMember} disabled={adding}>
          {adding
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.addBtnText}>+</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Lista membri selezionati */}
      {members.length > 0 && (
        <View style={styles.memberList}>
          <Text style={styles.memberListTitle}>
            {t('participants')} ({members.length + 1})
          </Text>
          {/* Io */}
          <View style={styles.memberItem}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{userProfile?.name?.[0]?.toUpperCase()}</Text>
            </View>
            <Text style={styles.memberName}>{userProfile?.name} {t('me')}</Text>
          </View>
          {members.map((m) => (
            <View key={m.uid} style={styles.memberItem}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{m.name[0].toUpperCase()}</Text>
              </View>
              <Text style={styles.memberName}>{m.name}</Text>
              <TouchableOpacity onPress={() => removeMember(m.uid)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.createBtn, (creating || !groupName.trim() || members.length === 0) && styles.createBtnDisabled]}
        onPress={createGroup}
        disabled={creating || !groupName.trim() || members.length === 0}
      >
        {creating
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.createBtnText}>{t('createGroup')}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 24, paddingBottom: 48 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  sectionTitle: { color: colors.textSecondary, fontSize: 12, marginBottom: 10 },
  emptyText: { color: colors.textSecondary, fontSize: 14, fontStyle: 'italic', marginBottom: 12 },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  contactList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactItemSelected: {
    backgroundColor: colors.primary + '18',
  },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 48,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, lineHeight: 28 },
  memberList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    marginBottom: 24,
  },
  memberListTitle: { color: colors.textSecondary, fontSize: 12, marginBottom: 12 },
  memberItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary + '33',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  memberAvatarSelected: {
    backgroundColor: colors.primary,
  },
  memberAvatarText: { color: colors.primary, fontWeight: 'bold', fontSize: 16 },
  memberAvatarTextSelected: { color: '#fff' },
  memberName: { flex: 1, color: colors.text, fontSize: 15 },
  memberNameSelected: { color: colors.primary, fontWeight: '600' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  removeBtn: { padding: 6 },
  removeBtnText: { color: colors.textSecondary, fontSize: 16 },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
