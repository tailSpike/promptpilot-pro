import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { featureFlagsAPI } from '../services/api';

interface FeatureFlagsContextValue {
  flags: Record<string, boolean>;
  loading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (flag: string) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const fetched = await featureFlagsAPI.getFlags();
      setFlags(fetched);
    } catch (error) {
      console.error('Failed to fetch feature flags', error);
      setFlags({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      loading,
      refresh,
      isEnabled: (flag: string) => Boolean(flags[flag]),
    }),
    [flags, loading, refresh],
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
};

export const useFeatureFlags = (): FeatureFlagsContextValue => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
};
