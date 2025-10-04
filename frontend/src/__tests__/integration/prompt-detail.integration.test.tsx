import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptDetail, { PROMPT_FEEDBACK_LAST_SEEN_STORAGE_PREFIX } from '../../components/PromptDetail';
import type { Prompt, PromptComment } from '../../types';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-owner',
      email: 'owner@example.com',
      name: 'Owner',
    },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

const featureFlagsMock: {
  flags: Record<string, boolean>;
  loading: boolean;
  refresh: ReturnType<typeof vi.fn>;
  isEnabled: (flag: string) => boolean;
} = {
  flags: { 'collaboration.comments': true },
  loading: false,
  refresh: vi.fn(),
  isEnabled: () => true,
};

featureFlagsMock.isEnabled = (flag: string) => Boolean(featureFlagsMock.flags[flag]);

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => featureFlagsMock,
}));

const mocks = vi.hoisted(() => ({
  promptsAPI: {
    getPrompt: vi.fn(),
  },
  promptCommentsAPI: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

const { promptsAPI, promptCommentsAPI } = mocks;

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual<typeof import('../../services/api')>('../../services/api');
  return {
    ...actual,
    promptsAPI: mocks.promptsAPI,
    promptCommentsAPI: mocks.promptCommentsAPI,
  };
});

const renderWithRouter = () =>
  render(
    <MemoryRouter initialEntries={[`/prompts/prompt-1`]}>
      <Routes>
        <Route path="/prompts/:id" element={<PromptDetail />} />
      </Routes>
    </MemoryRouter>,
  );

const basePrompt: Prompt = {
  id: 'prompt-1',
  name: 'Welcome Email',
  description: 'Draft a friendly welcome email.',
  content: 'Hello {{name}}, welcome to our platform!',
  variables: [
    {
      name: 'name',
      type: 'text',
      required: true,
      description: 'Recipient name',
    },
  ],
  metadata: {},
  version: 2,
  isPublic: false,
  folderId: 'folder-shared',
  createdAt: '2025-10-01T12:00:00.000Z',
  updatedAt: '2025-10-02T09:30:00.000Z',
  user: {
    id: 'user-owner',
    email: 'owner@example.com',
    name: 'Owner',
  },
  folder: {
    id: 'folder-shared',
    name: 'Onboarding',
  },
  accessScope: 'shared',
  executions: [],
};

const viewerComment: PromptComment = {
  id: 'comment-1',
  promptId: 'prompt-1',
  libraryId: 'folder-shared',
  body: 'Looks great! Maybe add a CTA? 😊',
  createdAt: '2025-10-02T10:00:00.000Z',
  author: {
    id: 'user-viewer',
    email: 'viewer@example.com',
    name: 'Viewer',
  },
};

describe('PromptDetail', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    featureFlagsMock.flags['collaboration.comments'] = true;

    promptsAPI.getPrompt.mockResolvedValue({ prompt: basePrompt });
    promptCommentsAPI.list.mockResolvedValue({ comments: [viewerComment], libraryId: 'folder-shared' });
    promptCommentsAPI.create.mockResolvedValue({
      ...viewerComment,
      id: 'comment-2',
      body: 'Thanks for the quick turnaround!',
      author: {
        id: 'user-owner',
        email: 'owner@example.com',
        name: 'Owner',
      },
      createdAt: '2025-10-02T11:00:00.000Z',
    });
    promptCommentsAPI.delete.mockResolvedValue(undefined);
  });

  it('renders prompt details and supports creating and deleting comments', async () => {
    const user = userEvent.setup();

    renderWithRouter();

    await waitFor(() => {
      expect(promptsAPI.getPrompt).toHaveBeenCalledWith('prompt-1');
      expect(promptCommentsAPI.list).toHaveBeenCalledWith('prompt-1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('prompt-detail-toast')).toHaveTextContent(
        'New feedback on Onboarding/Welcome Email',
      );
    });

    expect(screen.getByRole('heading', { name: 'Welcome Email' })).toBeInTheDocument();
    expect(screen.getByText('Draft a friendly welcome email.')).toBeInTheDocument();
    expect(screen.getByText('Looks great! Maybe add a CTA? 😊')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('Leave feedback for collaborators...');
    await user.type(textarea, 'Thanks for iterating on this.');
    await user.click(screen.getByRole('button', { name: /post feedback/i }));

    await waitFor(() => {
      expect(promptCommentsAPI.create).toHaveBeenCalledWith('prompt-1', 'Thanks for iterating on this.');
    });

    await waitFor(() => {
      expect(screen.getByText('Thanks for the quick turnaround!')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[1]);

    await waitFor(() => {
      expect(promptCommentsAPI.delete).toHaveBeenCalledWith('comment-1');
    });
  });

  it('informs users when comments are disabled via feature flags', async () => {
    featureFlagsMock.flags['collaboration.comments'] = false;

    renderWithRouter();

    await waitFor(() => {
      expect(promptsAPI.getPrompt).toHaveBeenCalledWith('prompt-1');
    });

    expect(
      screen.getByText('Feedback is disabled by feature flags.'),
    ).toBeInTheDocument();

    featureFlagsMock.flags['collaboration.comments'] = true;
  });

  it('suppresses the toast when feedback has already been acknowledged', async () => {
    const storageKey = `${PROMPT_FEEDBACK_LAST_SEEN_STORAGE_PREFIX}.user-owner`;
    const futureTimestamp = new Date('2025-10-02T12:30:00.000Z').getTime();
    window.localStorage.setItem(storageKey, JSON.stringify({ 'prompt-1': futureTimestamp }));

    renderWithRouter();

    await waitFor(() => {
      expect(promptsAPI.getPrompt).toHaveBeenCalledWith('prompt-1');
    });

    await waitFor(() => {
      expect(promptCommentsAPI.list).toHaveBeenCalledWith('prompt-1');
    });

    expect(screen.queryByTestId('prompt-detail-toast')).not.toBeInTheDocument();
  });
});