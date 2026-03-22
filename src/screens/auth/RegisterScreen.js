import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { t, LANGUAGES } from '../../i18n/index';
import colors from '../../theme/colors';

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FMLY-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('it');
  const [loading, setLoading] = useState(false);

  // La UI della schermata di registrazione si adatta alla lingua selezionata
  const ui = (key) => t(language, key);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert(ui('error'), ui('errorFillFields'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(ui('error'), ui('errorPasswordShort'));
      return;
    }
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnap.empty;

      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        language,
        uiLanguage: language,
        role: isFirstUser ? 'admin' : 'user',
        inviteCode: generateInviteCode(),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(ui('error'), ui('errorEmailInUse'));
      } else {
        Alert.alert(ui('error'), ui('errorRegisterFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.logo}>FamilyTalk</Text>
        <Text style={styles.subtitle}>{ui('createAccount')}</Text>

        <TextInput
          style={styles.input}
          placeholder={ui('namePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={ui('passwordPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>{ui('translationLang')}</Text>
        <View style={styles.languageRow}>
          {LANGUAGES.map(({ code, key }) => (
            <TouchableOpacity
              key={code}
              style={[styles.langButton, language === code && styles.langButtonActive]}
              onPress={() => setLanguage(code)}
            >
              <Text style={[styles.langText, language === code && styles.langTextActive]}>
                {t(code, key)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{ui('register')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>{ui('hasAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 32 },
  logo: { fontSize: 38, fontWeight: 'bold', color: colors.primary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 4 },
  languageRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  langButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  langButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  langText: { color: colors.textSecondary, fontSize: 13 },
  langTextActive: { color: colors.primary, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
});
