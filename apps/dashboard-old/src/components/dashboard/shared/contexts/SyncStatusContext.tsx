import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

interface SyncStatusContextType {
  isSyncing: boolean;
  syncCount: number;
  registerSync: (id: string) => void;
  unregisterSync: (id: string) => void;
}

const SyncStatusContext = createContext<SyncStatusContextType | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
  const [activeSyncs, setActiveSyncs] = useState<Set<string>>(new Set());

  const registerSync = useCallback((id: string) => {
    setActiveSyncs(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  }, []);

  const unregisterSync = useCallback((id: string) => {
    setActiveSyncs(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  // Cleanup any active sync registrations when provider unmounts
  useEffect(() => {
    return () => {
      setActiveSyncs(new Set());
    };
  }, []);


  const value: SyncStatusContextType = useMemo(() => ({
    isSyncing: activeSyncs.size > 0,
    syncCount: activeSyncs.size,
    registerSync,
    unregisterSync,
  }), [activeSyncs.size, registerSync, unregisterSync]);

  return (
    <SyncStatusContext.Provider value={value}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);
  if (context === undefined) {
    throw new Error('useSyncStatus must be used within a SyncStatusProvider');
  }
  return context;
}

