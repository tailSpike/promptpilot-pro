import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FolderModal from '../../components/FolderModal';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  foldersAPI: {
    getFolders: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn()
  }
}));

const mockedFoldersAPI = vi.mocked(api.foldersAPI);

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Folder Modal Integration', () => {
  const mockFolders = [
    {
      id: 'folder1',
      name: 'Work',
      description: 'Work-related prompts',
      color: '#3B82F6',
      parentId: undefined,
      userId: 'user1',
      createdAt: '2023-12-31T09:00:00Z',
      updatedAt: '2023-12-31T09:00:00Z'
    },
    {
      id: 'folder2',
      name: 'Personal',  
      description: 'Personal prompts',
      color: '#10B981',
      parentId: undefined,
      userId: 'user1',
      createdAt: '2023-12-31T09:15:00Z',
      updatedAt: '2023-12-31T09:15:00Z'
    }
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    allFolders: mockFolders
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedFoldersAPI.createFolder.mockResolvedValue({
      message: 'Folder created successfully',
      folder: {
        id: 'new-folder',
        name: 'New Test Folder',
        description: 'Test description',
        color: '#EF4444',
        parentId: 'folder1',
        userId: 'user1',
        createdAt: '2023-12-31T11:00:00Z',
        updatedAt: '2023-12-31T11:00:00Z'
      }
    });
  });

  it('should display folder modal with form fields', async () => {
    render(
      <TestWrapper>
        <FolderModal {...defaultProps} />
      </TestWrapper>
    );

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText('Create New Folder')).toBeInTheDocument();
    });

    // Check for form fields
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should create folder successfully', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <FolderModal {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Create New Folder')).toBeInTheDocument();
    });

    // Fill in folder details
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'New Test Folder');

    // Submit form
    const createButton = screen.getByRole('button', { name: /create/i });
    await user.click(createButton);

    // Verify API was called
    await waitFor(() => {
      expect(mockedFoldersAPI.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Test Folder'
        })
      );
    });
  });

  it('should handle edit mode for existing folders', async () => {
    const existingFolder = mockFolders[0];
    const editProps = {
      ...defaultProps,
      folder: existingFolder
    };

    mockedFoldersAPI.updateFolder.mockResolvedValue({
      message: 'Folder updated successfully',
      folder: { ...existingFolder, name: 'Updated Work' }
    });

    render(
      <TestWrapper>
        <FolderModal {...editProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Folder')).toBeInTheDocument();
    });

    // Verify existing values are populated
    const nameInput = screen.getByDisplayValue('Work');
    expect(nameInput).toBeInTheDocument();
  });
});
