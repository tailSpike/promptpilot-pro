import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { promptsAPI } from '../services/api';
import type { Prompt, Variable, CreatePromptData } from '../types';

export default function PromptEditor() {
  const [prompt, setPrompt] = useState<Partial<Prompt>>({
    name: '',
    description: '',
    content: '',
    variables: [],
    metadata: {},
    isPublic: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing && id) {
      loadPrompt(id);
    }
  }, [id, isEditing]);

  const loadPrompt = async (promptId: string) => {
    try {
      setLoading(true);
      const response = await promptsAPI.getPrompt(promptId);
      setPrompt(response.prompt);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load prompt');
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
        await promptsAPI.updatePrompt(id, prompt);
        setSuccess('Prompt updated successfully!');
      } else {
        await promptsAPI.createPrompt(prompt as CreatePromptData);
        setSuccess('Prompt created successfully!');
        setTimeout(() => {
          navigate('/prompts');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save prompt');
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

  const updateVariable = (index: number, field: keyof Variable, value: any) => {
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
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
        </h1>
        <p className="mt-2 text-gray-600">
          Build structured prompts with variables that can be reused across workflows.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                rows={3}
                value={prompt.description || ''}
                onChange={(e) => setPrompt(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Describe what this prompt does and when to use it"
              />
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Variables</h2>
            <button
              type="button"
              onClick={addVariable}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Variable
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Define variables that can be replaced in your prompt content. Use {`{{variableName}}`} syntax in your content.
          </p>

          {(prompt.variables || []).map((variable, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={variable.name}
                    onChange={(e) => updateVariable(index, 'name', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="variableName"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={variable.type}
                    onChange={(e) => updateVariable(index, 'type', e.target.value as Variable['type'])}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="select">Select</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    value={variable.description || ''}
                    onChange={(e) => updateVariable(index, 'description', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Describe this variable"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={variable.required || false}
                    onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Required</span>
                </label>
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => insertVariableIntoContent(variable.name)}
                    disabled={!variable.name}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    Insert into Content
                  </button>
                  <button
                    type="button"
                    onClick={() => removeVariable(index)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(prompt.variables || []).length === 0 && (
            <div className="text-center py-6 text-gray-500">
              No variables defined. Click "Add Variable" to get started.
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Prompt Content</h2>
          <p className="text-sm text-gray-600 mb-4">
            Write your prompt content here. Use {`{{variableName}}`} syntax to reference variables.
          </p>
          
          <textarea
            id="content"
            rows={12}
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
      </form>
    </div>
  );
}