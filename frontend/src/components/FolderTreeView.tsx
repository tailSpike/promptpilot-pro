import React, { useState, useEffect } from 'react';
import { foldersAPI } from '../services/api';
import type { Folder } from '../types';

interface FolderTreeViewProps {
  onFolderSelect?: (folderId: string | null) => void;
  selectedFolderId?: string | null;
  onCreateFolder?: (parentId?: string) => void;
}

interface FolderNodeProps {
  folder: Folder;
  level: number;
  onFolderSelect?: (folderId: string | null) => void;
  selectedFolderId?: string | null;
  onCreateFolder?: (parentId?: string) => void;
}

const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  level,
  onFolderSelect,
  selectedFolderId,
  onCreateFolder
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;

  const handleClick = () => {
    onFolderSelect?.(folder.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCreateSubfolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateFolder?.(folder.id);
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer rounded-md group ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren && (
          <button
            onClick={handleToggle}
            className="mr-1 p-0.5 hover:bg-gray-200 rounded"
          >
            <svg
              className={`w-3 h-3 transform transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        
        <div className="flex items-center flex-1 min-w-0">
          <div
            className="w-4 h-4 rounded-sm mr-2 flex-shrink-0"
            style={{ backgroundColor: folder.color || '#6B7280' }}
          />
          <span className="truncate text-sm">{folder.name}</span>
          {folder._count && (
            <span className="ml-auto text-xs text-gray-400">
              {folder._count.prompts}
            </span>
          )}
        </div>

        <button
          onClick={handleCreateSubfolder}
          className="ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 transition-opacity"
          title="Create subfolder"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              onFolderSelect={onFolderSelect}
              selectedFolderId={selectedFolderId}
              onCreateFolder={onCreateFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FolderTreeView({
  onFolderSelect,
  selectedFolderId,
  onCreateFolder
}: FolderTreeViewProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const response = await foldersAPI.getFolders();
      setFolders(response.folders || []);
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const handleRootFolderSelect = () => {
    onFolderSelect?.(null);
  };

  const handleCreateRootFolder = () => {
    onCreateFolder?.();
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 text-sm">{error}</div>
        <button
          onClick={loadFolders}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">Folders</h3>
          <button
            onClick={handleCreateRootFolder}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Create new folder"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* All Prompts (Root) */}
        <div
          className={`flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer rounded-md mb-1 ${
            selectedFolderId === null ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
          }`}
          onClick={handleRootFolderSelect}
        >
          <div className="w-4 h-4 rounded-sm mr-2 bg-gray-400" />
          <span className="text-sm">All Prompts</span>
        </div>
      </div>

      {/* Folder Tree */}
      <div className="space-y-1">
        {folders.map((folder) => (
          <FolderNode
            key={folder.id}
            folder={folder}
            level={0}
            onFolderSelect={onFolderSelect}
            selectedFolderId={selectedFolderId}
            onCreateFolder={onCreateFolder}
          />
        ))}
      </div>

      {folders.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <p className="text-sm">No folders yet</p>
          <button
            onClick={handleCreateRootFolder}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Create your first folder
          </button>
        </div>
      )}
    </div>
  );
}