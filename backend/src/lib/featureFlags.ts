export class FeatureDisabledError extends Error {
  constructor(public readonly flag: string) {
    super(`Feature flag disabled: ${flag}`);
    this.name = 'FeatureDisabledError';
  }
}

const NORMALISED_TRUE = new Set(['1', 'true', 'on', 'enabled', 'yes']);

export const COLLABORATION_SHARING_FLAG = 'collaboration.sharing';
export const COLLABORATION_COMMENTS_FLAG = 'collaboration.comments';

const flagLoaders: Record<string, () => string | undefined> = {
  [COLLABORATION_SHARING_FLAG]: () => process.env.FEATURE_FLAG_COLLABORATION_SHARING,
  [COLLABORATION_COMMENTS_FLAG]: () => process.env.FEATURE_FLAG_COLLABORATION_COMMENTS,
};

function normalise(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value.trim().toLowerCase();
}

export function isFeatureEnabled(flag: string): boolean {
  const loader = flagLoaders[flag];
  const rawValue = loader ? loader() : undefined;

  if (rawValue === undefined) {
    // Default to enabled for development/test/e2e to keep walking skeleton usable
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'e2e'
    ) {
      return true;
    }
    return false;
  }

  return NORMALISED_TRUE.has(normalise(rawValue) ?? '');
}

export function assertFeatureEnabled(flag: string): void {
  if (!isFeatureEnabled(flag)) {
    throw new FeatureDisabledError(flag);
  }
}

export function getFeatureFlags(): Record<string, boolean> {
  return {
    [COLLABORATION_SHARING_FLAG]: isFeatureEnabled(COLLABORATION_SHARING_FLAG),
    [COLLABORATION_COMMENTS_FLAG]: isFeatureEnabled(COLLABORATION_COMMENTS_FLAG),
  };
}
