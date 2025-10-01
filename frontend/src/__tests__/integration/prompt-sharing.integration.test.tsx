import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import PromptList from '../../components/PromptList';
import * as api from '../../services/api';

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: { 'collaboration.sharing': true },
    loading: false,
    refresh: vi.fn(),
    isEnabled: (flag: string) => flag === 'collaboration.sharing',
  }),
}));

vi.mock('../../services/api', () => ({
  promptsAPI: {
    getPrompts: vi.fn(),
    deletePrompt: vi.fn(),
    updatePrompt: vi.fn(),
  },
  foldersAPI: {
    getFolders: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
  },
  libraryShareAPI: {
    getSharedWithMe: vi.fn(),
    getLibraryPrompts: vi.fn(),
    shareLibrary: vi.fn(),
    getLibraryShares: vi.fn(),
    revokeShare: vi.fn(),
    getLibraryDetails: vi.fn(),
  },
  usersAPI: {
    searchMembers: vi.fn(),
  },
}));

const mockedPromptsAPI = vi.mocked(api.promptsAPI);
const mockedFoldersAPI = vi.mocked(api.foldersAPI);
const mockedLibraryShareAPI = vi.mocked(api.libraryShareAPI);

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('PromptList sharing experiences', () => {
  const mockFolders = [
    {
      id: 'folder-1',
      name: 'Marketing',
      description: 'Marketing assets',
      color: '#1F2937',
      parentId: null,
      userId: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      _count: { prompts: 0, children: 0 },
      children: [],
    },
  ];

  const sharedLibraries = [
    {
      id: 'share-1',
      folder: {
        id: 'folder-shared',
        name: 'Design System',
        updatedAt: '2024-01-02T00:00:00Z',
        user: {
          id: 'user-owner',
          email: 'owner@example.com',
          name: 'Owner',
        },
      },
      invitedBy: {
        id: 'user-owner',
        email: 'owner@example.com',
        name: 'Owner',
      },
      createdAt: '2024-01-02T00:00:00Z',
    },
  ];

  const sharedPrompts = [
    {
      id: 'prompt-shared-1',
      name: 'Brand Voice',
      description: 'Use this to align copy with our brand voice.',
      content: 'Follow the brand guidelines strictly.',
      folderId: 'folder-shared',
      folder: {
        id: 'folder-shared',
        name: 'Design System',
      },
      version: 1,
      isPublic: false,
      variables: [],
      metadata: {},
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      user: {
        id: 'user-owner',
        email: 'owner@example.com',
      },
  accessScope: 'shared' as const,
      _count: {
        executions: 3,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    mockedPromptsAPI.getPrompts.mockResolvedValue({
      prompts: [],
      pagination: { page: 1, pages: 1, limit: 10, total: 0 },
    });
    mockedFoldersAPI.getFolders.mockResolvedValue({ folders: mockFolders });
    mockedLibraryShareAPI.getSharedWithMe.mockResolvedValue({ shares: sharedLibraries });
    mockedLibraryShareAPI.getLibraryPrompts.mockResolvedValue({ prompts: sharedPrompts });
  });

  it('allows switching to shared view and viewing shared prompts', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <PromptList />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    const sharedTab = screen.getByRole('button', { name: /shared with me/i });
    await user.click(sharedTab);

    await waitFor(() => {
      expect(mockedLibraryShareAPI.getSharedWithMe).toHaveBeenCalled();
    });

    expect(screen.getByText('Design System')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('prompt-list-toast')).toHaveTextContent(
        'Owner shared "Design System" with you',
      );
    });

    await user.click(screen.getByText('Design System'));

    await waitFor(() => {
      expect(mockedLibraryShareAPI.getLibraryPrompts).toHaveBeenCalledWith('folder-shared');
    });

  expect(screen.getByText('Brand Voice')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('shows share button when a folder is selected', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <PromptList />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /share library/i })).not.toBeInTheDocument();

    await user.click(screen.getByText('Marketing'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /share library/i })).toBeInTheDocument();
    });
  });

  it('does not repeat the new share toast once a library is acknowledged', async () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        'promptpilot.sharedLibraries.seen',
        JSON.stringify(sharedLibraries.map((share) => share.id)),
      );
    }

    const user = userEvent.setup();

    render(
      <Wrapper>
        <PromptList />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /shared with me/i }));

    await waitFor(() => {
      expect(mockedLibraryShareAPI.getSharedWithMe).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('prompt-list-toast')).not.toBeInTheDocument();
  });
});
