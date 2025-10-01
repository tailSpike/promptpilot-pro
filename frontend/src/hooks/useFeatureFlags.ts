import { useContext } from 'react';
import { FeatureFlagsContext } from '../contexts/FeatureFlagsContextData';
import type { FeatureFlagsContextValue } from '../contexts/FeatureFlagsContextData';

export const useFeatureFlags = (): FeatureFlagsContextValue => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
};
