/** useNetworkStatus.js - Estado de conectividad en tiempo real (NetInfo). */
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export default function useNetworkStatus() {
  // Optimista hasta que NetInfo informe (isInternetReachable puede ser null al inicio)
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}
