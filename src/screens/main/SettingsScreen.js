import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { clearSecretsCache } from '../../services/translation';
import { LANGUAGES } from '../../i18n/index';
import colors from '../../theme/colors';

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', labelKey: 'modelFast', emoji: '⚡ Haiku' },
  { id: 'claude-sonnet-4-6', labelKey: 'modelAccurate', emoji: '🎯 Sonnet' },
];

export default function SettingsScreen() {
  const { userProfile, updateUserProfile } = useAuth();
  const { t } = useI18n();
  const isAdmin = userProfile?.role === 'admin';

  // Language preferences
  const [translationLang, setTranslationLang] = useState(userProfile?.language || 'it');
  const [uiLanguage, setUiLanguage] = useState(userProfile?.uiLanguage || userProfile?.language || 'it');
  const [savingLangs, setSavingLangs] = useState(false);

  // Admin settings
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [loadingAdmin, setLoadingAdmin] = useState(isAdmin);
  const [savingAdmin, setSavingAdmin] = useState(false);

  useEffect(() => {
    if (isAdmin) loadAdminSettings();
  }, []);

  const loadAdminSettings = async () => {
    try {
      const snap = await getDoc(doc(db, 'config', 'secrets'));
      if (snap.exists()) {
        const data = snap.data();
        setAnthropicKey(data.anthropicKey || '');
        setOpenaiKey(data.openaiKey || '');
        setModel(data.model || 'claude-sonnet-4-6');
      }
    } catch {
      // nessuna impostazione ancora salvata
    } finally {
      setLoadingAdmin(false);
    }
  };

  const saveLanguages = async () => {
    setSavingLangs(true);
    try {
      await updateUserProfile({ language: translationLang, uiLanguage });
      Alert.alert(t('savedTitle'), t('savedLangsMessage'));
    } catch {
      Alert.alert(t('error'), 'Impossibile salvare.');
    } finally {
      setSavingLangs(false);
    }
  };

  const saveAdminSettings = async () => {
    if (!anthropicKey.startsWith('sk-ant-')) {
      Alert.alert(t('warning'), t('warningApiKey'));
      return;
    }
    setSavingAdmin(true);
    try {
      await setDoc(doc(db, 'config', 'secrets'), {
        anthropicKey,
        openaiKey,
        model,
        updatedAt: new Date().toISOString(),
      });
      clearSecretsCache();
      Alert.alert(t('savedTitle'), t('savedAdminMessage'));
    } catch {
      Alert.alert(t('error'), 'Impossibile salvare. Controlla le regole Firestore.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const langName = (code) => {
    const lang = LANGUAGES.find((l) => l.code === code);
    return lang ? t(lang.key) : code;
  };

  if (isAdmin && loadingAdmin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>

      {/* ── Lingue ── */}
      <Text style={styles.section}>{t('sectionLanguages')}</Text>

      <Text style={styles.label}>Lingua di traduzione / ภาษาสำหรับแปล / 翻译语言</Text>
      <Text style={styles.sublabel}>{t('labelTranslationLangSub')}</Text>
      <View style={styles.langRow}>
        {LANGUAGES.map(({ code, key }) => (
          <TouchableOpacity
            key={code}
            style={[styles.langBtn, translationLang === code && styles.langBtnActive]}
            onPress={() => setTranslationLang(code)}
          >
            <Text style={[styles.langLabel, translationLang === code && styles.langLabelActive]}>
              {t(key)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>Lingua interfaccia / ภาษาแอป / 界面语言</Text>
      <Text style={styles.sublabel}>{t('labelUiLangSub')}</Text>
      <View style={styles.langRow}>
        {LANGUAGES.map(({ code, key }) => (
          <TouchableOpacity
            key={code}
            style={[styles.langBtn, uiLanguage === code && styles.langBtnActive]}
            onPress={() => setUiLanguage(code)}
          >
            <Text style={[styles.langLabel, uiLanguage === code && styles.langLabelActive]}>
              {t(key)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={saveLanguages} disabled={savingLangs}>
        {savingLangs
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>{t('saveLangs')}</Text>
        }
      </TouchableOpacity>

      {/* ── Sezione Admin ── */}
      {isAdmin && (
        <>
          <Text style={[styles.section, { marginTop: 40 }]}>{t('sectionApi')}</Text>

          <Text style={styles.label}>{t('labelApiKey')} (Anthropic — traduzione testo)</Text>
          <TextInput
            style={styles.input}
            placeholder="sk-ant-..."
            placeholderTextColor={colors.textSecondary}
            value={anthropicKey}
            onChangeText={setAnthropicKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>OpenAI API Key (Whisper — messaggi vocali)</Text>
          <TextInput
            style={styles.input}
            placeholder="sk-..."
            placeholderTextColor={colors.textSecondary}
            value={openaiKey}
            onChangeText={setOpenaiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>{t('labelModel')}</Text>
          <View style={styles.modelRow}>
            {MODELS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelBtn, model === m.id && styles.modelBtnActive]}
                onPress={() => setModel(m.id)}
              >
                <Text style={[styles.modelLabel, model === m.id && styles.modelLabelActive]}>
                  {m.emoji}
                </Text>
                <Text style={styles.modelSub}>{t(m.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.button} onPress={saveAdminSettings} disabled={savingAdmin}>
            {savingAdmin
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t('saveAdmin')}</Text>
            }
          </TouchableOpacity>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background },
  inner: { padding: 24, paddingBottom: 48 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  section: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 4, marginTop: 4 },
  sublabel: { color: colors.textMuted, fontSize: 12, marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  langBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  langLabel: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  langLabelActive: { color: colors.primary, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  modelBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  modelLabel: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  modelLabelActive: { color: colors.primary },
  modelSub: { color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoBox: {
    marginTop: 32,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  infoTitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  infoCode: { color: colors.primary, fontSize: 28, fontWeight: 'bold', letterSpacing: 4, marginBottom: 8 },
  infoSub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
