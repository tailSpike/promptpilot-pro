import { COLLABORATION_COMMENTS_FLAG, isFeatureEnabled } from '../../lib/featureFlags';

describe('feature flag defaults', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlagValue = process.env.FEATURE_FLAG_COLLABORATION_COMMENTS;

  const restoreEnvironment = () => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalFlagValue === undefined) {
      delete process.env.FEATURE_FLAG_COLLABORATION_COMMENTS;
    } else {
      process.env.FEATURE_FLAG_COLLABORATION_COMMENTS = originalFlagValue;
    }
  };

  afterEach(() => {
    restoreEnvironment();
  });

  it('defaults to enabled when NODE_ENV is not set', () => {
    delete process.env.NODE_ENV;
    delete process.env.FEATURE_FLAG_COLLABORATION_COMMENTS;

    expect(isFeatureEnabled(COLLABORATION_COMMENTS_FLAG)).toBe(true);
  });

  it('defaults to disabled in production when the flag is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FEATURE_FLAG_COLLABORATION_COMMENTS;

    expect(isFeatureEnabled(COLLABORATION_COMMENTS_FLAG)).toBe(false);
  });

  it('respects explicit environment overrides', () => {
    process.env.FEATURE_FLAG_COLLABORATION_COMMENTS = 'off';
    expect(isFeatureEnabled(COLLABORATION_COMMENTS_FLAG)).toBe(false);

    process.env.FEATURE_FLAG_COLLABORATION_COMMENTS = 'enabled';
    expect(isFeatureEnabled(COLLABORATION_COMMENTS_FLAG)).toBe(true);
  });
});