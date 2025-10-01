import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { foldersAPI, libraryShareAPI, promptsAPI } from '../services/api';
import type { Folder, Prompt, SharedLibrarySummary } from '../types';
import FolderTreeView, { type FolderTreeViewRef } from './FolderTreeView';
import FolderModal from './FolderModal';
import ShareLibraryModal from './ShareLibraryModal';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { DEFAULT_TOAST_DISMISS_MS } from '../constants/notifications';
import { FOLDER_REFRESH_DELAY_MS } from '../constants/folders';

type ViewMode = 'mine' | 'shared';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

const SHARED_LIBRARY_STORAGE_KEY = 'promptpilot.sharedLibraries.seen';

const readSeenSharedLibraryIds = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SHARED_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch (error) {
    console.warn('Failed to read shared library cache', error);
    return [];
  }
};

const writeSeenSharedLibraryIds = (ids: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SHARED_LIBRARY_STORAGE_KEY, JSON.stringify(ids));
  } catch (error) {
    console.warn('Failed to persist shared library cache', error);
  }
};

export default function PromptList() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [sharedPrompts, setSharedPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const { isEnabled } = useFeatureFlags();
  const sharingEnabled = isEnabled('collaboration.sharing');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'uncategorized'>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalParentId, setFolderModalParentId] = useState<string | undefined>();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetFolderId, setShareTargetFolderId] = useState<string | null>(null);
  const [shareTargetFolderName, setShareTargetFolderName] = useState<string | undefined>();
  const [sharedLibraries, setSharedLibraries] = useState<SharedLibrarySummary[]>([]);
  const [sharedLibrariesLoading, setSharedLibrariesLoading] = useState(false);
  const [sharedLibraryLoading, setSharedLibraryLoading] = useState(false);
  const [selectedSharedLibraryId, setSelectedSharedLibraryId] = useState<string | null>(null);

  const folderTreeRef = useRef<FolderTreeViewRef>(null);
  const announceNewShares = useCallback(
    (shares: SharedLibrarySummary[]) => {
      if (shares.length === 0) {
        writeSeenSharedLibraryIds([]);
        return;
      }

      const previouslySeen = new Set(readSeenSharedLibraryIds());
      const unseenShares = shares.filter((share) => !previouslySeen.has(share.id));

      if (unseenShares.length > 0) {
        const firstShare = unseenShares[0];
        const inviterName = firstShare.invitedBy.name || firstShare.invitedBy.email;
        const message =
          unseenShares.length === 1
            ? `${inviterName} shared "${firstShare.folder.name}" with you`
            : `${unseenShares.length} new libraries were shared with you`;

        setToast({ type: 'success', message });
      }

      writeSeenSharedLibraryIds(shares.map((share) => share.id));
    },
    [setToast],
  );

  const initiateShareForFolder = useCallback(
    (folderId: string, folderName?: string) => {
      if (!sharingEnabled) {
        return;
      }

      setShareTargetFolderId(folderId);
      setShareTargetFolderName(folderName);
      setShareModalOpen(true);
    },
    [sharingEnabled],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }

  const timer = setTimeout(() => setToast(null), DEFAULT_TOAST_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!sharingEnabled && viewMode === 'shared') {
      setViewMode('mine');
    }
  }, [sharingEnabled, viewMode]);

  const handlePromptDragStart = (event: React.DragEvent, prompt: Prompt) => {
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'prompt', promptId: prompt.id, promptName: prompt.name }),
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const loadFolders = useCallback(async () => {
    try {
      const response = await foldersAPI.getFolders();
      setFolders(response.folders || []);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, []);

  const loadPrompts = useCallback(async () => {
    if (viewMode !== 'mine') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      let folderIdParam: string | undefined;
      if (selectedFolderId === 'uncategorized') {
        folderIdParam = 'null';
      } else if (selectedFolderId === null) {
        folderIdParam = undefined;
      } else {
        folderIdParam = selectedFolderId;
      }

      const response = await promptsAPI.getPrompts({
        page,
        limit: 10,
        search: search || undefined,
        folderId: folderIdParam,
      });

      setPrompts(response.prompts);
      setTotalPages(response.pagination.pages);
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedFolderId, viewMode]);

  const loadSharedLibraries = useCallback(async () => {
    if (!sharingEnabled) {
      return;
    }

    try {
      setSharedLibrariesLoading(true);
      const { shares } = await libraryShareAPI.getSharedWithMe();
      setSharedLibraries(shares);
      setSharedError(null);
      announceNewShares(shares);

      setSelectedSharedLibraryId((previous) => {
        if (!previous) {
          return previous;
        }
        return shares.some((share) => share.id === previous) ? previous : null;
      });

      if (shares.length === 0) {
        setSharedPrompts([]);
      }
    } catch (err) {
      console.error('Failed to load shared libraries:', err);
      setSharedError('Failed to load shared libraries. Please try again later.');
      setSharedLibraries([]);
    } finally {
      setSharedLibrariesLoading(false);
    }
  }, [sharingEnabled, announceNewShares]);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (viewMode === 'shared') {
      void loadSharedLibraries();
    }
  }, [viewMode, loadSharedLibraries]);

  useEffect(() => {
    if (viewMode !== 'shared') {
      setSelectedSharedLibraryId(null);
      setSharedPrompts([]);
      setSharedError(null);
    }
  }, [viewMode]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      await promptsAPI.deletePrompt(id);
      void loadPrompts();
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || 'Failed to delete prompt');
    }
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (viewMode !== 'mine') {
      return;
    }
    setPage(1);
    void loadPrompts();
  };

  const handleFolderSelect = (folderId: string | null | 'uncategorized') => {
    setSelectedFolderId(folderId);
    setPage(1);
  };

  const handleCreateFolder = (parentId?: string) => {
    setFolderModalParentId(parentId);
    setShowFolderModal(true);
  };

  const handleFolderModalSuccess = async () => {
  await new Promise((resolve) => setTimeout(resolve, FOLDER_REFRESH_DELAY_MS));

    void loadFolders();
    if (folderTreeRef.current) {
      await folderTreeRef.current.refreshFolders();
    }
    setShowFolderModal(false);
  };

  const handleMovePromptToFolder = async (promptId: string, targetFolderId: string | null) => {
    try {
      const prompt = prompts.find((item) => item.id === promptId);
      if (!prompt) {
        return;
      }

      await promptsAPI.updatePrompt(promptId, {
        ...prompt,
        folderId: targetFolderId,
      });

      void loadPrompts();
      if (folderTreeRef.current) {
        await folderTreeRef.current.refreshFolders();
      }
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      setError(apiError.response?.data?.error?.message || 'Failed to move prompt');
    }
  };

  const handleSelectSharedLibrary = async (share: SharedLibrarySummary) => {
    setSelectedSharedLibraryId(share.id);
    try {
      setSharedLibraryLoading(true);
      const { prompts: sharedPromptResponse } = await libraryShareAPI.getLibraryPrompts(share.folder.id);
      setSharedPrompts(
        sharedPromptResponse.map((prompt) => ({
          ...prompt,
          accessScope: 'shared',
        })),
      );
      setSharedError(null);
    } catch (err) {
      console.error('Failed to load shared prompts:', err);
      setSharedError('Failed to load prompts for this library.');
      setSharedPrompts([]);
    } finally {
      setSharedLibraryLoading(false);
    }
  };

  const handleShareFolder = useCallback(
    (folder: Folder) => {
      if (!sharingEnabled) {
        return;
      }

      setSelectedFolderId(folder.id);
      initiateShareForFolder(folder.id, folder.name);
    },
    [initiateShareForFolder, sharingEnabled],
  );

  const openShareModal = () => {
    if (!sharingEnabled || typeof selectedFolderId !== 'string') {
      return;
    }

    const folder = folders.find((item) => item.id === selectedFolderId);
    if (!folder) {
      return;
    }

    initiateShareForFolder(folder.id, folder.name);
  };

  const handleShareUpdate = ({ type, email }: { type: 'shared' | 'revoked'; email: string }) => {
    setToast({
      type: 'success',
      message: type === 'shared' ? `Shared library with ${email}` : `Revoked access for ${email}`,
    });
  };

  const selectedFolder = useMemo(() => {
    if (typeof selectedFolderId !== 'string') {
      return null;
    }
    return folders.find((folder) => folder.id === selectedFolderId) ?? null;
  }, [folders, selectedFolderId]);

  const selectedSharedLibrary = useMemo(() => {
    if (!selectedSharedLibraryId) {
      return null;
    }
    return sharedLibraries.find((share) => share.id === selectedSharedLibraryId) ?? null;
  }, [selectedSharedLibraryId, sharedLibraries]);

  const renderPromptCard = (
    prompt: Prompt,
    options?: { allowActions?: boolean; badge?: string; hint?: React.ReactNode },
  ) => {
    const badgeLabel = options?.badge ?? (prompt.accessScope === 'shared' ? 'Shared' : undefined);

    return (
    <div
      key={prompt.id}
      className={`rounded-lg bg-white p-6 shadow transition-shadow ${
        options?.allowActions !== false ? 'cursor-move hover:shadow-lg' : ''
      }`}
      draggable={options?.allowActions !== false}
      onDragStart={options?.allowActions !== false ? (event) => handlePromptDragStart(event, prompt) : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-medium text-gray-900">{prompt.name}</h3>
            {badgeLabel && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {badgeLabel}
              </span>
            )}
            {prompt.isPublic && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Public
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
              v{prompt.version}
            </span>
          </div>

          {options?.hint}

          {prompt.description && <p className="mt-2 text-sm text-gray-600">{prompt.description}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div>Variables: {prompt.variables?.length || 0}</div>
            <div>Executions: {prompt._count?.executions || 0}</div>
            <div>Updated: {new Date(prompt.updatedAt).toLocaleDateString()}</div>
            <div className="flex items-center">
              {prompt.folder ? (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                  📁 {prompt.folder.name}
                </span>
              ) : selectedFolderId === null ? (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                  📄 Uncategorized
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {options?.allowActions !== false && (
          <div className="ml-4 flex items-center space-x-2">
            <Link to={`/prompts/${prompt.id}/edit`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void handleDelete(prompt.id)}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 rounded bg-gray-50 p-3">
        <p className="line-clamp-3 whitespace-pre-wrap font-mono text-sm text-gray-700">{prompt.content}</p>
      </div>

      {prompt.variables && prompt.variables.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {prompt.variables.map((variable) => (
              <span
                key={variable.name}
                className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
              >
                {variable.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
    );
  };

  if (loading && prompts.length === 0 && viewMode === 'mine') {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="h-24 w-24 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      {toast && (
        <div
          className={`mx-6 my-4 rounded-md px-4 py-3 text-sm ${
            toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
          data-testid="prompt-list-toast"
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-1">
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50">
          {viewMode === 'mine' ? (
            <FolderTreeView
              ref={folderTreeRef}
              onFolderSelect={handleFolderSelect}
              selectedFolderId={selectedFolderId}
              onCreateFolder={handleCreateFolder}
              onMovePromptToFolder={handleMovePromptToFolder}
              onFolderChange={loadPrompts}
                sharingEnabled={sharingEnabled}
                onShareFolder={handleShareFolder}
            />
          ) : (
            <div className="flex h-full flex-col overflow-hidden" data-testid="shared-library-sidebar">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-700">Shared libraries</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {sharedLibrariesLoading ? (
                  <p className="text-sm text-gray-500">Loading shared libraries…</p>
                ) : sharedError ? (
                  <p className="text-sm text-red-600">{sharedError}</p>
                ) : sharedLibraries.length === 0 ? (
                  <p className="text-sm text-gray-500">No libraries have been shared with you yet.</p>
                ) : (
                  <ul className="space-y-3" data-testid="shared-library-list">
                    {sharedLibraries.map((share) => {
                      const isActive = share.id === selectedSharedLibraryId;
                      return (
                        <li key={share.id}>
                          <button
                            type="button"
                            onClick={() => void handleSelectSharedLibrary(share)}
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                              isActive
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                            data-testid="shared-library-list-item"
                            data-library-id={share.folder.id}
                          >
                            <div className="font-medium">{share.folder.name}</div>
                            <div className="text-xs text-gray-500">
                              Owner: {share.folder.user.name || share.folder.user.email}
                            </div>
                            <div className="text-xs text-gray-400">
                              Updated {new Date(share.folder.updatedAt).toLocaleDateString()}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 px-4 py-6 sm:px-6">
          {sharingEnabled && (
            <div className="mb-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('mine')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'mine'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-200 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                }`}
                data-testid="view-mode-mine"
              >
                My libraries
              </button>
              <button
                type="button"
                onClick={() => setViewMode('shared')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'shared'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-200 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                }`}
                data-testid="view-mode-shared"
              >
                Shared with me
              </button>
            </div>
          )}

          {viewMode === 'mine' ? (
            <>
              <div className="mb-8">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {selectedFolderId === null
                        ? 'All Prompts'
                        : selectedFolderId === 'uncategorized'
                          ? 'Uncategorized Prompts'
                          : selectedFolder?.name || 'Folder Prompts'}
                    </h1>
                    <p className="mt-2 text-gray-600">
                      {selectedFolderId === null
                        ? 'View all your prompts across all folders. Drag prompts to move them between folders.'
                        : selectedFolderId === 'uncategorized'
                          ? "Prompts that haven't been organized into folders yet. Drag them to folders to organize."
                          : 'Manage your structured prompts with variables and metadata. Drag prompts to move them between folders.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {sharingEnabled && typeof selectedFolderId === 'string' && (
                      <button
                        type="button"
                        onClick={openShareModal}
                        className="inline-flex items-center rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                        data-testid="share-library-button"
                      >
                        Share library
                      </button>
                    )}
                    <Link
                      to="/prompts/new"
                      className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Create New Prompt
                    </Link>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
              )}

              <div className="mb-6">
                <form onSubmit={handleSearch} className="flex gap-4">
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search prompts..."
                    className="flex-1 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Search
                  </button>
                </form>
              </div>

              {prompts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mb-4 text-gray-500">
                    <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-gray-900">No prompts found</h3>
                  <p className="mb-4 text-gray-500">
                    {search ? 'Try adjusting your search terms.' : 'Get started by creating your first prompt.'}
                  </p>
                  <Link
                    to="/prompts/new"
                    className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Create Your First Prompt
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">{prompts.map((prompt) => renderPromptCard(prompt))}</div>
              )}

              {totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                    <button
                      type="button"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Shared with me</h1>
                <p className="mt-2 text-gray-600">Libraries that teammates have shared with you.</p>
              </div>

              {sharedError && (
                <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{sharedError}</div>
              )}

              {!sharedLibrariesLoading && sharedLibraries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                  <h3 className="text-lg font-medium text-gray-900">Nothing shared yet</h3>
                  <p className="mt-2 text-sm text-gray-500">When teammates share a library with you, it will appear here.</p>
                </div>
              ) : selectedSharedLibrary ? (
                <div className="space-y-6" data-testid="shared-library-content">
                  <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm" data-testid="shared-library-detail">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold text-gray-900">{selectedSharedLibrary.folder.name}</h2>
                        <p className="text-sm text-gray-600">
                          Owner: {selectedSharedLibrary.folder.user.name || selectedSharedLibrary.folder.user.email}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        Invited by {selectedSharedLibrary.invitedBy.name || selectedSharedLibrary.invitedBy.email}
                      </div>
                    </div>

                    {sharedLibraryLoading ? (
                      <div className="mt-6 flex min-h-48 items-center justify-center" data-testid="shared-library-loading">
                        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                      </div>
                    ) : sharedPrompts.length === 0 ? (
                      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center" data-testid="shared-library-empty">
                        <h3 className="text-lg font-medium text-gray-900">No prompts available</h3>
                        <p className="mt-2 text-sm text-gray-500">This shared library doesn’t have any prompts yet.</p>
                      </div>
                    ) : (
                      <div className="relative mt-6" data-testid="shared-library-prompts">
                        <div className="absolute left-3 top-0 bottom-3 w-px bg-gray-200" aria-hidden="true"></div>
                        <div className="space-y-4 pl-8">
                          {sharedPrompts.map((prompt) => (
                            <div key={prompt.id} className="relative">
                              <div className="absolute -left-8 top-6 h-px w-8 border-t border-gray-200" aria-hidden="true"></div>
                              {renderPromptCard(prompt, {
                                allowActions: false,
                                hint: (
                                  <p className="mt-2 text-xs font-medium text-gray-500">
                                    Read-only • Owner: {prompt.user.name || prompt.user.email}
                                  </p>
                                ),
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : sharedLibrariesLoading ? (
                <div className="flex min-h-48 items-center justify-center" data-testid="shared-library-skeleton">
                  <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                  <h3 className="text-lg font-medium text-gray-900">Select a shared library</h3>
                  <p className="mt-2 text-sm text-gray-500">Choose a library from the sidebar to view its prompts.</p>
                </div>
              )}
            </>
          )}

          <FolderModal
            isOpen={showFolderModal}
            onClose={() => setShowFolderModal(false)}
            onSuccess={handleFolderModalSuccess}
            parentFolderId={folderModalParentId}
            allFolders={folders}
          />
        </div>
      </div>

      {shareModalOpen && shareTargetFolderId && (
        <ShareLibraryModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          libraryId={shareTargetFolderId}
          libraryName={shareTargetFolderName}
          onShareUpdate={handleShareUpdate}
        />
      )}
    </div>
  );
}