import { useEffect, useCallback } from 'react';
import { getData, postData } from '../BackendConnections/FetchBackendServices';

interface PushResult {
  status: 'success' | 'permission_denied' | 'save_failed' | 'error' | 'retrying';
  permission?: NotificationPermission;
  response?: any;
  error?: Error;
}

// Utility to convert base64url VAPID key to Uint8Array (standard for pushManager.subscribe)
function urlBase64ToUint8Array(base64String:string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const useGlobalPush = (userId: string, userType: string) => {
  const initPush = useCallback(async (retryCount = 0): Promise<PushResult> => {
    const maxRetries = 3;
    try {
      // console.log(`Push init attempt ${retryCount + 1}/${maxRetries} for ${userType} ${userId}`);
      
      // Register SW (permission-independent)
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // console.log('✅ Global SW registered for', userType, registration.scope);

      // Fetch VAPID (permission-independent)
      const vapidRes = await getData('vapid-public-key');
      // console.log('VAPID full response:', vapidRes);
      if (!vapidRes.status) {
        throw new Error(`VAPID failed: ${vapidRes.message || 'No status'}`);
      }
      const publicKey = vapidRes.data?.publicKey;
      if (!publicKey) {
        throw new Error('No publicKey in VAPID response');
      }
      // console.log('Extracted publicKey length:', publicKey.length);

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // console.log('✅ Reusing existing subscription');
      } else {
        // Request permission (must be in user gesture for Chrome)
        const permission = await Notification.requestPermission();
        // console.log('Permission state:', permission);
        
        if (permission !== 'granted') {
          // console.log(`❌ Global push: Permission ${permission} for ${userType}`);
          return { status: 'permission_denied', permission };
        }

        // console.log('✅ Permission granted – subscribing...');
        // Convert publicKey to Uint8Array before subscribing
        const convertedKey = urlBase64ToUint8Array(publicKey);
        
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,  // Use Uint8Array here
        });
        // console.log('✅ New subscription created:', subscription.endpoint);
      }

      // Save subscription
      const saveRes = await postData('clientproject/save-push-subscription', {
        userId,
        userType,
        subscription: JSON.stringify(subscription),
      });
      // console.log('Save responseeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee:', saveRes);

      if (saveRes.success) {
        // console.log(`✅ Global push: Subscription saved for ${userType} ${userId}`);
        return { status: 'success' };
      } else {
        // console.error(`❌ Save failed:`, saveRes.message || 'Unknown');
        if ((saveRes.statusCode || !saveRes.success) >= 500 && retryCount < maxRetries - 1) {
          setTimeout(() => initPush(retryCount + 1), 1000 * Math.pow(2, retryCount));
          return { status: 'retrying' };
        }
        return { status: 'save_failed', response: saveRes };
      }
    } catch (error: any) {
      // console.error(`❌ Push init error for ${userType} ${userId}:`, error);
      if ((error.name === 'AbortError' || error.message.includes('Registration failed')) && retryCount < maxRetries - 1) {
        // console.log(`🔄 Retrying push init...`);
        setTimeout(() => initPush(retryCount + 1), 2000);
        return { status: 'retrying', error };
      }
      return { status: 'error', error };
    }
  }, [userId, userType]);

  // Manual trigger for user gesture (e.g., button click)
  const requestPermission = useCallback(async (): Promise<PushResult> => {
    return await initPush();
  }, [initPush]);

  // Auto-init if already granted (no prompt needed)
  useEffect(() => {
    if (!userId) return;
    const checkAndInit = async () => {
      const existingPermission = Notification.permission;
      // console.log(`Auto-check permission for ${userType}: ${existingPermission}`);
      if (existingPermission === 'granted') {
        await initPush();
      } else if (existingPermission === 'default') {
        // console.log(`⚠️ Permission default for ${userType} – trigger manually`);
      } else {
        // console.log(`❌ Permission denied for ${userType} – reset in browser settings`);
      }
    };
    checkAndInit();
  }, [userId, initPush, userType]);

  return { requestPermission };
};