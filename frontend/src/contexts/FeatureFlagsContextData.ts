import { createContext } from 'react';

export interface FeatureFlagsContextValue {
  flags: Record<string, boolean>;
  loading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (flag: string) => boolean;
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);
