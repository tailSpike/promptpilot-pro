import React, { useState, useEffect, useCallback } from 'react';

interface Variable {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
}

interface PromptVersion {
  id: string;
  versionNumber: string;
  name: string;
  description?: string;
  content: string;
  variables: Variable[];
  metadata?: Record<string, unknown>;
  commitMessage?: string;
  changeType: 'PATCH' | 'MINOR' | 'MAJOR';
  createdAt: string;
  createdByUser: {
    id: string;
    name: string;
    email: string;
  };
  parentVersion?: {
    id: string;
    versionNumber: string;
  };
}

interface VersionHistoryProps {
  promptId: string;
  onRevert?: (version: PromptVersion) => void;
  onPreview?: (version: PromptVersion) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ 
  promptId, 
  onRevert, 
  onPreview 
}) => {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersionHistory = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/prompts/${promptId}/versions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch version history');
      }

      const data = await response.json();
      setVersions(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    fetchVersionHistory();
  }, [fetchVersionHistory]);



  const handleRevert = async (version: PromptVersion) => {
    if (!window.confirm(`Are you sure you want to revert to version ${version.versionNumber}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/prompts/${promptId}/revert/${version.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to revert to version');
      }

      // Refresh version history and notify parent
      await fetchVersionHistory();
      if (onRevert) onRevert(version);
      
      alert(`Successfully reverted to version ${version.versionNumber}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revert');
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'MAJOR': return 'text-red-600 bg-red-50';
      case 'MINOR': return 'text-blue-600 bg-blue-50';
      case 'PATCH': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading version history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <button 
          onClick={fetchVersionHistory}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center">
          <span className="mr-2">🌳</span>
          Version History ({versions.length})
        </h3>
        <button 
          onClick={fetchVersionHistory}
          className="text-blue-600 hover:text-blue-800"
        >
          Refresh
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No versions found
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version, index) => (
            <div 
              key={version.id} 
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="font-mono text-lg font-semibold">
                      v{version.versionNumber}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChangeTypeColor(version.changeType)}`}>
                      {version.changeType}
                    </span>
                    {index === 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Current
                      </span>
                    )}
                  </div>

                  {version.commitMessage && (
                    <div className="flex items-start mb-2">
                      <span className="text-gray-400 mt-0.5 mr-2 flex-shrink-0">💬</span>
                      <p className="text-gray-700 text-sm">{version.commitMessage}</p>
                    </div>
                  )}

                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <div className="flex items-center">
                      <span className="mr-1">👤</span>
                      {version.createdByUser.name || version.createdByUser.email}
                    </div>
                    <div className="flex items-center">
                      <span className="mr-1">🕒</span>
                      {formatDate(version.createdAt)}
                    </div>
                  </div>

                  {version.parentVersion && (
                    <div className="mt-2 text-xs text-gray-500">
                      Based on v{version.parentVersion.versionNumber}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {onPreview && (
                    <button
                      onClick={() => onPreview(version)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Preview this version"
                    >
                      👁️
                    </button>
                  )}
                  
                  {index > 0 && onRevert && (
                    <button
                      onClick={() => handleRevert(version)}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                      title="Revert to this version"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionHistory;