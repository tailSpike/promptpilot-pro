import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { libraryShareAPI, usersAPI } from '../services/api';
import { DEFAULT_TOAST_DISMISS_MS } from '../constants/notifications';
import { SHARE_MODAL_TOAST_DISMISS_MS, SHARE_SEARCH_MIN_QUERY_LENGTH } from '../constants/shareLibrary';
import type { PromptLibraryShare, UserSummary } from '../types';

interface ShareLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryId: string | null;
  libraryName?: string;
  onShareUpdate?: (summary: { type: 'shared' | 'revoked'; email: string }) => void;
}

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

const ShareLibraryModal: React.FC<ShareLibraryModalProps> = ({
  isOpen,
  onClose,
  libraryId,
  libraryName,
  onShareUpdate,
}) => {
  const [shares, setShares] = useState<PromptLibraryShare[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const resetState = useCallback(() => {
    setShares([]);
    setSearchQuery('');
    setSearchResults([]);
    setIsLoadingShares(false);
    setIsSearching(false);
    setIsSubmitting(false);
    setError(null);
    setToast(null);
  }, []);

  const loadShares = useCallback(async () => {
    if (!libraryId) {
      return;
    }

    try {
      setIsLoadingShares(true);
      const { shares: shareList } = await libraryShareAPI.getLibraryShares(libraryId);
      setShares(shareList);
      setError(null);
    } catch (err) {
      console.error('Failed to load shares', err);
      setError('Failed to load shares. Please try again later.');
    } finally {
      setIsLoadingShares(false);
    }
  }, [libraryId]);

  useEffect(() => {
    if (isOpen && libraryId) {
      void loadShares();
    } else if (!isOpen) {
      resetState();
    }
  }, [isOpen, libraryId, loadShares, resetState]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const dismissDelay = SHARE_MODAL_TOAST_DISMISS_MS ?? DEFAULT_TOAST_DISMISS_MS;
    const timer = setTimeout(() => setToast(null), dismissDelay);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredSearchResults = useMemo(() => {
    const invitedIds = new Set(shares.map((share) => share.invitedUser.id));
    return searchResults.filter((user) => !invitedIds.has(user.id));
  }, [searchResults, shares]);

  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);
    setError(null);

    const trimmed = value.trim();
    if (trimmed.length < SHARE_SEARCH_MIN_QUERY_LENGTH) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const { users } = await usersAPI.searchMembers(trimmed);
      setSearchResults(users);
    } catch (err) {
      console.error('Search members error', err);
      setError('Failed to search users. Please try again later.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleShare = async (user: UserSummary) => {
    if (!libraryId || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      await libraryShareAPI.shareLibrary(libraryId, user.email);
      setToast({ type: 'success', message: `Shared ${libraryName ?? 'library'} with ${user.email}` });
      await loadShares();
      setSearchQuery('');
      setSearchResults([]);
      onShareUpdate?.({ type: 'shared', email: user.email });
    } catch (err) {
      console.error('Share library error', err);
      setToast({ type: 'error', message: 'Unable to share library. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (shareId: string, email: string) => {
    if (!libraryId) {
      return;
    }

    try {
      await libraryShareAPI.revokeShare(libraryId, shareId);
      setToast({ type: 'success', message: `Access revoked for ${email}` });
      await loadShares();
      onShareUpdate?.({ type: 'revoked', email });
    } catch (err) {
      console.error('Revoke share error', err);
      setToast({ type: 'error', message: 'Unable to revoke access. Please try again.' });
    }
  };

  if (!isOpen || !libraryId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      data-testid="share-library-modal"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Share library</h2>
            {libraryName && <p className="text-sm text-gray-500">{libraryName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close share modal"
          >
            ×
          </button>
        </div>

        {toast && (
          <div
            className={`mx-6 mt-4 rounded-md px-4 py-2 text-sm ${
              toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
            data-testid="share-modal-toast"
          >
            {toast.message}
          </div>
        )}

        <div className="px-6 py-4">
          <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="share-search">
            Invite teammate by email
          </label>
          <input
            id="share-search"
            type="email"
            value={searchQuery}
            onChange={(event) => void handleSearchChange(event.target.value)}
            placeholder="Search by email"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery.trim().length > 0 && searchQuery.trim().length < SHARE_SEARCH_MIN_QUERY_LENGTH && (
            <p className="mt-2 text-xs text-gray-500">Type at least {SHARE_SEARCH_MIN_QUERY_LENGTH} characters to search.</p>
          )}
          {isSearching && <p className="mt-2 text-sm text-gray-500">Searching teammates…</p>}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {filteredSearchResults.length > 0 && (
            <div className="mt-3 space-y-2" data-testid="share-search-results">
              {filteredSearchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                  data-testid="share-search-result"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    {user.name && <p className="text-xs text-gray-500">{user.name}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleShare(user)}
                    disabled={isSubmitting}
                    className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    data-testid="share-search-invite"
                  >
                    Share
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700">People with access</h3>
            {isLoadingShares ? (
              <p className="mt-2 text-sm text-gray-500">Loading…</p>
            ) : shares.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No collaborators yet.</p>
            ) : (
              <ul className="mt-3 space-y-2" data-testid="share-member-list">
                {shares.map((share) => (
                  <li
                    key={share.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                    data-testid="share-member"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{share.invitedUser.email}</p>
                      <p className="text-xs text-gray-500">
                        Invited by {share.invitedBy.name || share.invitedBy.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRevoke(share.id, share.invitedUser.email)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            data-testid="share-modal-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareLibraryModal;
