# Security and Secrets Handling

This document outlines how PromptPilot Pro handles provider credentials and related security controls.

## Encryption at rest

- Secrets are encrypted using AES-256-GCM before being persisted.
- The `KeyVaultService` abstracts key management. In non-production environments, a local master key (via environment variable) is used; in production, configure a managed KMS adapter.
- Decryption happens in-memory only at the moment of use (e.g., when invoking a provider). Plaintext values are never logged.

## Access controls

- The Integration Keys API is authenticated; only authorized users can create, rotate, or revoke credentials within their workspace.
- The UI redacts secrets and shows only metadata such as label, provider, status, and timestamps.

## Audit logging

- Create, rotate, and revoke operations emit audit events with the actor ID and a hashed secret fingerprint (SHA-256 of the plaintext) for correlation without storing raw secrets.
- Execution logs may include the credential label and provider but do not include the secret.

## Rotation guidance

- Rotate credentials at least annually or upon suspicion of compromise.
- Use the Integration Keys UI or API to perform rotations; previous executions retain historical references without exposing old secrets.

## CI secrets vs. in-app credentials

- CI provider smoke runs use GitHub Actions secrets that are injected only at runtime for that job; they are not stored in the application database.
- In-app credentials are encrypted-at-rest and scoped to workspaces; use sandbox/test keys where possible and avoid production keys in shared environments.

## Logging and redaction

- Logs must never include raw secret values. Ensure error handling maps provider errors to safe messages and redacts sensitive headers.

## Data privacy

- Provide deletion and export mechanisms for stored credentials to support compliance needs.

## Enforcement: revoked credentials during previews

When previewing a workflow, if all targeted providers only have revoked credentials for the requester, the backend returns a 409 response to avoid accidental simulated runs and to surface a clear remediation path. The response includes a code and provider list:

```json
{
  "status": "FAILED",
  "error": {
    "code": "provider.credentials.revoked",
    "message": "Credential revoked",
    "providers": ["openai", "anthropic"]
  },
  "warnings": ["Credential revoked. Re-authorise before running this workflow."]
}
```

See `docs/INTEGRATIONS.md` for the full payload and guidance.