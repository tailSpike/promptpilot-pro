// Utility to determine if provider-keys spec should run, centralizing env parsing.
export function shouldRunProviderKeys(): boolean {
  const v = Cypress.env('RUN_PROVIDER_KEYS');
  if (v === true) return true;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  return false;
}
