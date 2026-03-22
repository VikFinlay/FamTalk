import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { registerForPushNotifications } from '../services/notifications';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const updateUserProfile = async (data) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setUserProfile((prev) => ({ ...prev, ...data }));
    } catch {}
  };

  const setOnlineStatus = async (uid, isOnline) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isOnline,
        lastSeen: serverTimestamp(),
      });
    } catch {}
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (profileDoc.exists()) {
          setUserProfile(profileDoc.data());
        }
        setOnlineStatus(firebaseUser.uid, true);
        registerForPushNotifications(firebaseUser.uid);
      } else {
        if (user) setOnlineStatus(user.uid, false);
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Rileva cambio stato app (mobile) o visibilità tab (web)
  useEffect(() => {
    if (!user) return;

    if (Platform.OS === 'web') {
      const handleVisibility = () => {
        setOnlineStatus(user.uid, document.visibilityState === 'visible');
      };
      const handleUnload = () => setOnlineStatus(user.uid, false);
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('beforeunload', handleUnload);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('beforeunload', handleUnload);
      };
    } else {
      const sub = AppState.addEventListener('change', (state) => {
        setOnlineStatus(user.uid, state === 'active');
      });
      return () => sub.remove();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
