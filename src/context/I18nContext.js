import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { t as translate } from '../i18n/index';

const I18nContext = createContext({});

export const useI18n = () => useContext(I18nContext);

export function I18nProvider({ children }) {
  const { userProfile } = useAuth();
  const uiLang = userProfile?.uiLanguage || 'it';

  const t = (key) => translate(uiLang, key);

  return (
    <I18nContext.Provider value={{ t, uiLang }}>
      {children}
    </I18nContext.Provider>
  );
}
