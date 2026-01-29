import React from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { Chip } from '@heroui/react';
import { useSyncStatus } from '../contexts/SyncStatusContext';

export function SyncStatusIndicator() {
  const { isSyncing } = useSyncStatus();

  if (!isSyncing) {
    return null; // Don't show anything when synced
  }

  return (
    <Chip
      variant="flat"
      color="primary"
      size="sm"
      startContent={<RefreshCw className="w-3 h-3 animate-spin" />}
      className="text-xs"
    >
      Syncing...
    </Chip>
  );
}

/**
 * Hook to track Firebase snapshot sync status
 * Use this in components that have onSnapshot listeners
 * 
 * @example
 * const trackSync = useFirebaseSyncTracker('events-list');
 * 
 * useEffect(() => {
 *   const unsubscribe = onSnapshot(query, (snapshot) => {
 *     trackSync(snapshot.metadata.fromCache);
 *     // ... handle data
 *   });
 *   return () => unsubscribe();
 * }, []);
 */
export function useFirebaseSyncTracker(id: string) {
  const { registerSync, unregisterSync } = useSyncStatus();

  // Ensure we don't leave dangling registrations on unmount
  React.useEffect(() => {
    return () => {
      unregisterSync(id);
    };
  }, [id, unregisterSync]);

  // fromCache === true means data is served from cache (still syncing)
  // We want to show "Syncing..." while fromCache is true
  return React.useCallback((isFromCache: boolean) => {
    if (isFromCache) {
      registerSync(id);
    } else {
      unregisterSync(id);
    }
  }, [id, registerSync, unregisterSync]);
}

