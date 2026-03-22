import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { t, LANGUAGES } from '../../i18n/index';
import colors from '../../theme/colors';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('it');

  const ui = (key) => t(lang, key);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(ui('error'), ui('errorEmptyFields'));
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      Alert.alert(ui('error'), ui('errorWrongCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Selettore lingua nell'angolo in alto */}
        <View style={styles.langPicker}>
          {LANGUAGES.map(({ code, flag }) => (
            <TouchableOpacity
              key={code}
              style={[styles.flagBtn, lang === code && styles.flagBtnActive]}
              onPress={() => setLang(code)}
            >
              <Text style={styles.flagText}>{flag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.logo}>FamilyTalk</Text>
        <Text style={styles.subtitle}>{ui('tagline')}</Text>

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
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{ui('login')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>{ui('noAccount')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  langPicker: {
    position: 'absolute',
    top: 52,
    right: 0,
    flexDirection: 'row',
    gap: 4,
  },
  flagBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  flagBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  flagText: { fontSize: 20 },
  logo: { fontSize: 38, fontWeight: 'bold', color: colors.primary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 48 },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
});
