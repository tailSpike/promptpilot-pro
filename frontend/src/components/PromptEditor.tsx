import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { promptsAPI, foldersAPI } from '../services/api';
import type { Prompt, Variable, CreatePromptData, Folder } from '../types';
import VersionHistory from './VersionHistory';

export default function PromptEditor() {
  const [prompt, setPrompt] = useState<Partial<Prompt>>({
    name: '',
    description: '',
    content: '',
    variables: [],
    metadata: {},
    isPublic: false,
    folderId: '',
  });
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [commitMessage, setCommitMessage] = useState('');
  const [changeType, setChangeType] = useState<'PATCH' | 'MINOR' | 'MAJOR'>('PATCH');
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing && id) {
      loadPrompt(id);
    }
    loadFolders();
  }, [id, isEditing]);

  const loadFolders = async () => {
    try {
      const response = await foldersAPI.getFolders();
      setFolders(response.folders || []);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const buildFolderOptions = (folders: Folder[], level = 0): React.ReactElement[] => {
    const options: React.ReactElement[] = [];
    
    folders.forEach(folder => {
      const indent = '  '.repeat(level);
      options.push(
        <option key={folder.id} value={folder.id}>
          {indent}{folder.name}
        </option>
      );

      if (folder.children) {
        options.push(...buildFolderOptions(folder.children, level + 1));
      }
    });

    return options;
  };

  const loadPrompt = async (promptId: string) => {
    try {
      setLoading(true);
      const response = await promptsAPI.getPrompt(promptId);
      setPrompt(response.prompt);
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to load prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.name || !prompt.content) {
      setError('Name and content are required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isEditing && id) {
        // Include version control data when updating
        const updateData = {
          ...prompt,
          changeType,
          commitMessage: commitMessage || `Updated prompt: ${prompt.name}`
        };
        await promptsAPI.updatePrompt(id, updateData);
        setSuccess('Prompt updated successfully!');
        // Clear commit message after successful update
        setCommitMessage('');
      } else {
        await promptsAPI.createPrompt(prompt as CreatePromptData);
        setSuccess('Prompt created successfully!');
        setTimeout(() => {
          navigate('/prompts');
        }, 1500);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Failed to save prompt');
    } finally {
      setLoading(false);
    }
  };

  const addVariable = () => {
    const newVariable: Variable = {
      name: '',
      type: 'text',
      description: '',
      required: true,
    };
    setPrompt(prev => ({
      ...prev,
      variables: [...(prev.variables || []), newVariable],
    }));
  };

  const updateVariable = (index: number, field: keyof Variable, value: string | boolean | string[]) => {
    setPrompt(prev => ({
      ...prev,
      variables: prev.variables?.map((variable, i) => 
        i === index ? { ...variable, [field]: value } : variable
      ) || [],
    }));
  };

  const removeVariable = (index: number) => {
    setPrompt(prev => ({
      ...prev,
      variables: prev.variables?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleContentChange = (content: string) => {
    setPrompt(prev => ({ ...prev, content }));
  };

  const insertVariableIntoContent = (variableName: string) => {
    const textarea = document.getElementById('content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = prompt.content?.substring(0, start) || '';
      const after = prompt.content?.substring(end) || '';
      const newContent = before + `{{${variableName}}}` + after;
      
      handleContentChange(newContent);
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableName.length + 4, start + variableName.length + 4);
      }, 0);
    }
  };

  if (loading && isEditing) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
        </h1>
        <p className="mt-2 text-gray-600">
          Build structured prompts with variables that can be reused across workflows.
        </p>
        
        {/* Tab Navigation - only show for editing */}
        {isEditing && (
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('editor')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'editor'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📝 Editor
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🌳 Version History
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'editor' ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area - Left and Center Columns */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Prompt Name *
                </label>
                <input
                  type="text"
                  id="name"
                  data-testid="prompt-name"
                  value={prompt.name || ''}
                  onChange={(e) => setPrompt(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter a descriptive name for your prompt"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  data-testid="prompt-description"
                  rows={3}
                  value={prompt.description || ''}
                  onChange={(e) => setPrompt(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Describe what this prompt does and when to use it"
                />
              </div>

              <div>
                <label htmlFor="folder" className="block text-sm font-medium text-gray-700">
                  Folder
                </label>
                <select
                  id="folder"
                  value={prompt.folderId || ''}
                  onChange={(e) => setPrompt(prev => ({ ...prev, folderId: e.target.value || undefined }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">No folder (Root level)</option>
                  {buildFolderOptions(folders)}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Choose a folder to organize this prompt
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={prompt.isPublic || false}
                    onChange={(e) => setPrompt(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Make this prompt public</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Public prompts can be discovered and used by other users
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Prompt Content</h2>
            <p className="text-sm text-gray-600 mb-4">
              Write your prompt content here. Use {`{{variableName}}`} syntax to reference variables.
            </p>
            
            <textarea
              id="content"
              rows={16}
              value={prompt.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
              placeholder="Enter your prompt content here. Use {{variableName}} to reference variables..."
              required
            />
            
            <div className="mt-2 text-xs text-gray-500">
              Example: "Write a {'{tone}'} email about {'{topic}'} for {'{audience}'}"
            </div>
          </div>

          {/* Version Control Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Version Control</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="commitMessage" className="block text-sm font-medium text-gray-700">
                  Commit Message
                </label>
                <textarea
                  id="commitMessage"
                  rows={3}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Describe what changes you made..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Add a brief description of your changes for version history
                </p>
              </div>

              <div>
                <label htmlFor="changeType" className="block text-sm font-medium text-gray-700">
                  Change Type
                </label>
                <select
                  id="changeType"
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value as 'PATCH' | 'MINOR' | 'MAJOR')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="PATCH">Patch - Small fixes or improvements</option>
                  <option value="MINOR">Minor - New features or significant changes</option>
                  <option value="MAJOR">Major - Breaking changes or complete rewrites</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the type of change to help with semantic versioning
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/prompts')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : (isEditing ? 'Update Prompt' : 'Create Prompt')}
            </button>
          </div>
        </div>

        {/* Variables Panel - Right Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Variables</h2>
              <button
                type="button"
                onClick={addVariable}
                className="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                + Add
              </button>
            </div>
            
            <p className="text-xs text-gray-600 mb-4">
              Define variables to use in your prompt. Click variable names to insert into content.
            </p>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {(prompt.variables || []).map((variable, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Name</label>
                      <input
                        type="text"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, 'name', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="variableName"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Type</label>
                      <select
                        value={variable.type}
                        onChange={(e) => updateVariable(index, 'type', e.target.value as Variable['type'])}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="select">Select</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Description</label>
                      <input
                        type="text"
                        value={variable.description || ''}
                        onChange={(e) => updateVariable(index, 'description', e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Describe this variable"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={variable.required || false}
                          onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-xs text-gray-700">Required</span>
                      </label>
                      
                      <button
                        type="button"
                        onClick={() => removeVariable(index)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => insertVariableIntoContent(variable.name)}
                      disabled={!variable.name}
                      className="w-full text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-3 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Insert {variable.name ? `{{${variable.name}}}` : 'Variable'} into Content
                    </button>
                  </div>
                </div>
              ))}

              {(prompt.variables || []).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <p className="text-xs">No variables yet</p>
                  <p className="text-xs text-gray-400">Click "Add" to create your first variable</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </form>
      ) : (
        /* Version History Tab */
        <div className="max-w-4xl mx-auto">
          {isEditing && id ? (
            <VersionHistory 
              promptId={id}
              onRevert={() => {
                // Reload the prompt after revert
                if (id) loadPrompt(id);
                setActiveTab('editor'); // Switch back to editor
              }}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              Save the prompt first to see version history
            </div>
          )}
        </div>
      )}
    </div>
  );
}