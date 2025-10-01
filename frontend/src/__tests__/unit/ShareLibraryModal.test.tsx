import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ShareLibraryModal from '../../components/ShareLibraryModal';
import { SHARE_SEARCH_MIN_QUERY_LENGTH } from '../../constants/shareLibrary';
import * as api from '../../services/api';

vi.mock('../../services/api', () => ({
  libraryShareAPI: {
    getLibraryShares: vi.fn(),
    shareLibrary: vi.fn(),
    revokeShare: vi.fn(),
  },
  usersAPI: {
    searchMembers: vi.fn(),
  },
}));

const mockedLibraryShareAPI = vi.mocked(api.libraryShareAPI);
const mockedUsersAPI = vi.mocked(api.usersAPI);

describe('ShareLibraryModal', () => {
  const defaultShare = {
    id: 'share-1',
    folderId: 'folder-1',
    invitedUserId: 'user-2',
    invitedById: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    invitedUser: {
      id: 'user-2',
      email: 'teammate@example.com',
      name: 'Teammate',
    },
    invitedBy: {
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
    },
    folder: {
      id: 'folder-1',
      name: 'Product Launch',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedLibraryShareAPI.getLibraryShares.mockResolvedValue({ shares: [defaultShare] });
    mockedLibraryShareAPI.shareLibrary.mockResolvedValue({ message: 'ok' });
    mockedLibraryShareAPI.revokeShare.mockResolvedValue({ message: 'ok' });
    mockedUsersAPI.searchMembers.mockResolvedValue({ users: [] });
  });

  it('loads existing shares when opened', async () => {
    render(
      <ShareLibraryModal
        isOpen
        onClose={() => null}
        libraryId="folder-1"
        libraryName="Product Launch"
      />,
    );

    await waitFor(() => {
      expect(mockedLibraryShareAPI.getLibraryShares).toHaveBeenCalledWith('folder-1');
    });

  expect(screen.getByText('teammate@example.com')).toBeInTheDocument();
  expect(screen.getByText(/invited by owner/i)).toBeInTheDocument();
  });

  it('searches members and shares library invite', async () => {
    const onShareUpdate = vi.fn();
    mockedUsersAPI.searchMembers.mockResolvedValue({
      users: [
        { id: 'user-3', email: 'new@team.com', name: 'New Teammate' },
      ],
    });

    render(
      <ShareLibraryModal
        isOpen
        onClose={() => null}
        libraryId="folder-1"
        libraryName="Product Launch"
        onShareUpdate={onShareUpdate}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search by email');
    const validQuery = 'n'.repeat(SHARE_SEARCH_MIN_QUERY_LENGTH);
    fireEvent.change(searchInput, { target: { value: validQuery } });

    await waitFor(() => {
      expect(mockedUsersAPI.searchMembers).toHaveBeenCalledWith(validQuery);
    });

    const shareButton = await screen.findByRole('button', { name: /share$/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockedLibraryShareAPI.shareLibrary).toHaveBeenCalledWith('folder-1', 'new@team.com');
      expect(onShareUpdate).toHaveBeenCalledWith({ type: 'shared', email: 'new@team.com' });
    });

    expect(mockedLibraryShareAPI.getLibraryShares).toHaveBeenCalledTimes(2);
    expect(searchInput).toHaveValue('');
  });

  it('revokes a collaborator', async () => {
    const onShareUpdate = vi.fn();

    render(
      <ShareLibraryModal
        isOpen
        onClose={() => null}
        libraryId="folder-1"
        libraryName="Product Launch"
        onShareUpdate={onShareUpdate}
      />,
    );

    const revokeButton = await screen.findByRole('button', { name: /revoke/i });
    fireEvent.click(revokeButton);

    await waitFor(() => {
      expect(mockedLibraryShareAPI.revokeShare).toHaveBeenCalledWith('folder-1', 'share-1');
      expect(onShareUpdate).toHaveBeenCalledWith({ type: 'revoked', email: 'teammate@example.com' });
    });
  });
});
