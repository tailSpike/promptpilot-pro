import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { promptsAPI, foldersAPI } from '../services/api';
import type { Prompt, Folder } from '../types';
import FolderTreeView, { type FolderTreeViewRef } from './FolderTreeView';
import FolderModal from './FolderModal';

export default function PromptList() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Folder-related state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalParentId, setFolderModalParentId] = useState<string | undefined>();
  
  // Ref to FolderTreeView for triggering refresh
  const folderTreeRef = useRef<FolderTreeViewRef>(null);

  const handlePromptDragStart = (e: React.DragEvent, prompt: Prompt) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'prompt',
      promptId: prompt.id,
      promptName: prompt.name
    }));
    e.dataTransfer.effectAllowed = 'move';
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
    try {
      setLoading(true);
      const response = await promptsAPI.getPrompts({
        page,
        limit: 10,
        search: search || undefined,
        folderId: selectedFolderId || undefined,
      });
      
      setPrompts(response.prompts);
      setTotalPages(response.pagination.pages);
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedFolderId]);

  useEffect(() => {
    loadPrompts();
    loadFolders();
  }, [loadPrompts, loadFolders]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      await promptsAPI.deletePrompt(id);
      loadPrompts(); // Reload the list
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to delete prompt');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadPrompts();
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setPage(1); // Reset to first page when changing folders
  };

  const handleCreateFolder = (parentId?: string) => {
    setFolderModalParentId(parentId);
    setShowFolderModal(true);
  };

  const handleFolderModalSuccess = () => {
    loadFolders(); // Reload folders
    setShowFolderModal(false);
  };

  const handleMovePromptToFolder = async (promptId: string, targetFolderId: string | null) => {
    try {
      // Get the current prompt data
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) return;

      // Update the prompt with the new folderId
      await promptsAPI.updatePrompt(promptId, {
        ...prompt,
        folderId: targetFolderId
      });

      // Refresh the prompts list
      loadPrompts();
      
      // Refresh the folder tree to update counts
      if (folderTreeRef.current) {
        await folderTreeRef.current.refreshFolders();
      }
      
      // Show success message briefly
      const folderName = targetFolderId 
        ? folders.find(f => f.id === targetFolderId)?.name || 'Unknown Folder'
        : 'No Folder';
      
      console.log(`Moved "${prompt.name}" to ${folderName}`);
      
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to move prompt');
    }
  };

  if (loading && prompts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar with folder tree */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex-shrink-0">
        <FolderTreeView
          ref={folderTreeRef}
          onFolderSelect={handleFolderSelect}
          selectedFolderId={selectedFolderId}
          onCreateFolder={handleCreateFolder}
          onMovePromptToFolder={handleMovePromptToFolder}
        />
      </div>

        {/* Main content area */}
        <div className="flex-1 px-4 py-6 sm:px-6">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {selectedFolderId === null ? 'All Prompts' : 'Folder Prompts'}
                </h1>
                <p className="mt-2 text-gray-600">
                  Manage your structured prompts with variables and metadata. Drag prompts to move them between folders.
                </p>
              </div>
              <Link
                to="/prompts/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Create New Prompt
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="mb-6">
            <form onSubmit={handleSearch} className="flex gap-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts..."
                className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Search
              </button>
            </form>
          </div>

          {prompts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No prompts found</h3>
            <p className="text-gray-500 mb-4">
              {search ? 'Try adjusting your search terms.' : 'Get started by creating your first prompt.'}
            </p>
            <Link
              to="/prompts/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Your First Prompt
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {prompts.map((prompt) => (
              <div 
                key={prompt.id} 
                className="bg-white shadow rounded-lg p-6 cursor-move hover:shadow-lg transition-shadow"
                draggable={true}
                onDragStart={(e) => handlePromptDragStart(e, prompt)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">{prompt.name}</h3>
                      {prompt.isPublic && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Public
                        </span>
                      )}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        v{prompt.version}
                      </span>
                    </div>
                    
                    {prompt.description && (
                      <p className="mt-2 text-sm text-gray-600">{prompt.description}</p>
                    )}
                    
                    <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                      <div>
                        Variables: {prompt.variables?.length || 0}
                      </div>
                      <div>
                        Executions: {prompt._count?.executions || 0}
                      </div>
                      <div>
                        Updated: {new Date(prompt.updatedAt).toLocaleDateString()}
                      </div>
                      {prompt.folder && (
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            📁 {prompt.folder.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex items-center space-x-2">
                    <Link
                      to={`/prompts/${prompt.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 bg-gray-50 rounded p-3">
                  <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap line-clamp-3">
                    {prompt.content}
                  </p>
                </div>
                
                {prompt.variables && prompt.variables.length > 0 && (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {prompt.variables.map((variable) => (
                        <span
                          key={variable.name}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {variable.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </nav>
          </div>
        )}

        {/* Folder Modal */}
        <FolderModal
          isOpen={showFolderModal}
          onClose={() => setShowFolderModal(false)}
          onSuccess={handleFolderModalSuccess}
          parentFolderId={folderModalParentId}
          allFolders={folders}
        />
      </div>
    </div>
  );
}