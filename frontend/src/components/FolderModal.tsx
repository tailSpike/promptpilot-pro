import React, { useState, useEffect } from 'react';
import { foldersAPI } from '../services/api';
import type { Folder, CreateFolderData, UpdateFolderData } from '../types';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  folder?: Folder; // If provided, edit mode
  parentFolderId?: string; // If provided, create as child
  allFolders?: Folder[]; // For parent selection
}

const predefinedColors = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#84CC16', // Lime
];

export default function FolderModal({
  isOpen,
  onClose,
  onSuccess,
  folder,
  parentFolderId,
  allFolders = []
}: FolderModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(predefinedColors[0]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = Boolean(folder);

  useEffect(() => {
    if (isOpen) {
      if (folder) {
        // Edit mode - populate with existing folder data
        setName(folder.name);
        setDescription(folder.description || '');
        setColor(folder.color || predefinedColors[0]);
        setSelectedParentId(folder.parentId || '');
      } else {
        // Create mode - reset form
        setName('');
        setDescription('');
        setColor(predefinedColors[0]);
        setSelectedParentId(parentFolderId || '');
      }
      setError('');
    }
  }, [isOpen, folder, parentFolderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const folderData = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        parentId: selectedParentId || undefined
      };

      if (isEditMode && folder) {
        await foldersAPI.updateFolder(folder.id, folderData as UpdateFolderData);
      } else {
        await foldersAPI.createFolder(folderData as CreateFolderData);
      }

      onSuccess();
      onClose();
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || `Failed to ${isEditMode ? 'update' : 'create'} folder`);
    } finally {
      setLoading(false);
    }
  };

  const buildFolderOptions = (folders: Folder[], currentFolderId?: string, level = 0): React.ReactElement[] => {
    const options: React.ReactElement[] = [];
    
    folders.forEach(f => {
      // Don't show the current folder or its descendants in parent selection
      if (currentFolderId && (f.id === currentFolderId)) {
        return;
      }

      const indent = '  '.repeat(level);
      options.push(
        <option key={f.id} value={f.id}>
          {indent}{f.name}
        </option>
      );

      if (f.children) {
        options.push(...buildFolderOptions(f.children, currentFolderId, level + 1));
      }
    });

    return options;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {isEditMode ? 'Edit Folder' : 'Create New Folder'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter folder name"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Optional description"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex space-x-2">
              {predefinedColors.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => setColor(colorOption)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    color === colorOption ? 'border-gray-400' : 'border-gray-200'
                  } hover:border-gray-400 transition-colors`}
                  style={{ backgroundColor: colorOption }}
                  title={colorOption}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="parentId" className="block text-sm font-medium text-gray-700 mb-1">
              Parent Folder
            </label>
            <select
              id="parentId"
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">None (Root level)</option>
              {buildFolderOptions(allFolders, folder?.id)}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Choose a parent folder to organize this folder hierarchically
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditMode ? 'Update Folder' : 'Create Folder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}