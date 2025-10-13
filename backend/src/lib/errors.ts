export class ProviderCredentialRevokedError extends Error {
  public readonly code = 'provider.credentials.revoked'
  public readonly providers: string[]

  constructor(message = 'Credential revoked', providers: string[] = []) {
    super(message)
    this.name = 'ProviderCredentialRevokedError'
    this.providers = providers
  }
}
