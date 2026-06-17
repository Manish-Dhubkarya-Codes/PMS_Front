import { useEffect, useState } from 'react';
import { getData, postData } from '../BackendConnections/FetchBackendServices';  // FIXED: Use your wrappers

export const usePushNotifications = (userId: string, userType: 'head') => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionAttempted, setSubscriptionAttempted] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>('');

  useEffect(() => {
    // FIXED: Use getData for VAPID (with leading '/' if your wrapper needs it)
    getData('vapid-public-key')
      .then((data) => {
        if (!data.status) {
          // console.error('VAPID fetch failed:', data.message || 'Unknown error');
          throw new Error(`VAPID failed: ${data.message || 'No status'}`);
        }
        if (!data.data?.publicKey) throw new Error('No publicKey in response');
        setVapidPublicKey(data.data.publicKey);
        setSubscriptionAttempted(true);
        // console.log('VAPID fetched successfully');
      })
      .catch(() => {
        // console.error('Failed to fetch VAPID key:', err);
        // Don't set attempted=true on error – retry on remount
      });
  }, []);

  useEffect(() => {
    if (!subscriptionAttempted || !vapidPublicKey || !userId) return;

    const registerAndSubscribe = async () => {
      try {
        // Register SW globally (if not already)
        const registration = await navigator.serviceWorker.register('/sw.js');
        // console.log('SW registered:', registration);

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          // console.log('Notification permission denied');
          return;
        }

        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey,
        });

        // FIXED: Use postData for save
        const response = await postData('clientproject/save-push-subscription', {
          userId,
          userType,
          subscription: JSON.stringify(subscription),
        });

        if (response.status) {
          setIsSubscribed(true);
        } else {
        }
      } catch (error) {
        console.error('Push subscription error:', error);
      }
    };

    registerAndSubscribe();
  }, [subscriptionAttempted, vapidPublicKey, userId]);

  return { isSubscribed, vapidPublicKey };
};