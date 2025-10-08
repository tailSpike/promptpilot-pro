import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { integrationsAPI, type IntegrationCredential, type IntegrationProviderConfig } from '../services/api';

interface FormState {
  provider: string;
  label: string;
  secret: string;
  metadata: string;
}

const emptyForm: FormState = {
  provider: '',
  label: '',
  secret: '',
  metadata: '',
};

function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function parseMetadata(raw: string): Record<string, unknown> | undefined {
  if (!raw.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse metadata JSON', error);
    throw new Error('Metadata must be valid JSON');
  }
}

export default function IntegrationSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<IntegrationProviderConfig[]>([]);
  const [credentials, setCredentials] = useState<IntegrationCredential[]>([]);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);

  const providerOptions = useMemo(() => providers.map((provider) => ({
    value: provider.id,
    label: provider.name,
  })), [providers]);

  const selectedProvider = providers.find((provider) => provider.id === form.provider);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [providersResponse, credentialsResponse] = await Promise.all([
        integrationsAPI.getProviders(),
        integrationsAPI.getCredentials(),
      ]);
      setProviders(providersResponse.providers);
      setCredentials(credentialsResponse.credentials);
    } catch (err) {
      console.error('Failed to load integration settings', err);
      setError(err instanceof Error ? err.message : 'Failed to load integration settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.provider || !form.label || !form.secret) {
      setError('Provider, label, and secret are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const metadata = parseMetadata(form.metadata ?? '');
      await integrationsAPI.createCredential({
        provider: form.provider,
        label: form.label,
        secret: form.secret,
        metadata,
      });
  setForm({ ...emptyForm });
      await loadData();
    } catch (err) {
      console.error('Failed to create credential', err);
      setError(err instanceof Error ? err.message : 'Failed to create credential');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotate = async (credential: IntegrationCredential) => {
    const nextSecret = window.prompt(`Enter new secret for ${credential.label}`);
    if (!nextSecret) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await integrationsAPI.updateCredential(credential.id, { secret: nextSecret });
      await loadData();
    } catch (err) {
      console.error('Failed to rotate credential', err);
      setError(err instanceof Error ? err.message : 'Failed to rotate credential');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (credential: IntegrationCredential) => {
    const confirmed = window.confirm(`Revoke credential “${credential.label}”? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await integrationsAPI.revokeCredential(credential.id);
      await loadData();
    } catch (err) {
      console.error('Failed to revoke credential', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke credential');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Integration Keys</h1>
        <p className="mt-2 text-gray-600">Securely manage provider API credentials used for workflow previews and live verifications.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900">Add credential</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Provider</label>
            <select
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={form.provider}
              onChange={handleChange('provider')}
              required
              disabled={submitting}
            >
              <option value="">Select a provider</option>
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedProvider && (
              <p className="mt-2 text-sm text-gray-500">
                <a
                  className="text-blue-600 hover:underline"
                  href={selectedProvider.documentationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Provider documentation
                </a>
                {selectedProvider.sandbox ? ' · Sandbox friendly' : ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Label</label>
            <input
              type="text"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={form.label}
              onChange={handleChange('label')}
              placeholder="e.g. QA Sandbox"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Secret</label>
            <input
              type="password"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={form.secret}
              onChange={handleChange('secret')}
              placeholder="Paste provider API key"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Metadata (optional)</label>
            <textarea
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              value={form.metadata}
              onChange={handleChange('metadata')}
              placeholder='{"sandbox": true, "usageTag": "ci-smoke"}'
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-gray-500">JSON formatted metadata. Useful for tagging CI usage or marking sandbox keys.</p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save credential'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Stored credentials</h2>
          <p className="mt-1 text-sm text-gray-500">Secrets are encrypted at rest. Rotate keys regularly to stay compliant.</p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-sm text-gray-500">Loading credentials…</div>
        ) : credentials.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-500">No credentials configured yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last rotated</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {credentials.map((credential) => (
                  <tr key={credential.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{credential.provider.replace('_', ' ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{credential.label}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          credential.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : credential.status === 'EXPIRING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {credential.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(credential.lastRotatedAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-3">
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => handleRotate(credential)}
                        disabled={submitting}
                      >
                        Rotate
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleRevoke(credential)}
                        disabled={submitting || credential.status === 'REVOKED'}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
