export class FeatureDisabledError extends Error {
  constructor(public readonly flag: string) {
    super(`Feature flag disabled: ${flag}`);
    this.name = 'FeatureDisabledError';
  }
}

const NORMALISED_TRUE = new Set(['1', 'true', 'on', 'enabled', 'yes']);
const DEFAULT_ENABLED_ENVS = new Set(['development', 'test', 'e2e']);

export const COLLABORATION_SHARING_FLAG = 'collaboration.sharing';
export const COLLABORATION_COMMENTS_FLAG = 'collaboration.comments';
export const BUILDER_V2_LINEAR_FLAG = 'builder.v2.linear';
export const BUILDER_V2_CANVAS_FLAG = 'builder.v2.canvas';
export const WORKFLOW_RUN_INLINE_FLAG = 'workflow.run.inline';
const flagLoaders: Record<string, () => string | undefined> = {
  [COLLABORATION_SHARING_FLAG]: () => process.env.FEATURE_FLAG_COLLABORATION_SHARING,
  [COLLABORATION_COMMENTS_FLAG]: () => process.env.FEATURE_FLAG_COLLABORATION_COMMENTS,
  [BUILDER_V2_LINEAR_FLAG]: () => process.env.FEATURE_FLAG_BUILDER_V2_LINEAR,
  [BUILDER_V2_CANVAS_FLAG]: () => process.env.FEATURE_FLAG_BUILDER_V2_CANVAS,
  [WORKFLOW_RUN_INLINE_FLAG]: () => process.env.FEATURE_FLAG_WORKFLOW_RUN_INLINE,
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
    const env = normalise(process.env.NODE_ENV ?? '') ?? '';
    // Default to enabled when running in dev/test/e2e or when NODE_ENV is not set (common in local tooling)
    if (env === '' || DEFAULT_ENABLED_ENVS.has(env)) {
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
    [BUILDER_V2_LINEAR_FLAG]: isFeatureEnabled(BUILDER_V2_LINEAR_FLAG),
    [BUILDER_V2_CANVAS_FLAG]: isFeatureEnabled(BUILDER_V2_CANVAS_FLAG),
    [WORKFLOW_RUN_INLINE_FLAG]: isFeatureEnabled(WORKFLOW_RUN_INLINE_FLAG),
  };
}
