import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Constants from 'expo-constants';

// Notification behaviour while the app is in the foreground (mobile only)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications(uid) {
  if (Platform.OS === 'web') return;

  // Create Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4FC3F7',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.expoProjectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const pushToken = tokenData.data;

  // Save the token to Firestore
  await updateDoc(doc(db, 'users', uid), { pushToken });

  return pushToken;
}

export async function sendPushNotification(recipientUid, senderName, messageText) {
  try {
    const recipientDoc = await getDoc(doc(db, 'users', recipientUid));
    const pushToken = recipientDoc.data()?.pushToken;
    if (!pushToken) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        channelId: 'messages',
        title: senderName,
        body: messageText,
        sound: 'default',
        priority: 'high',
      }),
    });
  } catch (e) {
    // Notification failed — does not block message delivery
  }
}
