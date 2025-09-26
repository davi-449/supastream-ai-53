import { useMemo } from 'react';

// Lightweight feature flags hook. In the future this can be backed by remote feature flag service.
export function useFeatureFlags() {
  // read from a global injected flags object if available (keeps it configurable without changing code)
  const flags = (typeof window !== 'undefined' && (window as any).__FEATURE_FLAGS__) || {};
  return useMemo(() => ({
    gemini: flags.gemini !== false, // Default to true, only disable if explicitly set to false
  }), [flags]);
}
