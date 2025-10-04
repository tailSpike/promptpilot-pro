import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { promptsAPI, promptCommentsAPI } from '../services/api';
import type { Prompt, PromptComment, PromptExecution } from '../types';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../hooks/useAuth';

interface ApiError extends Error {
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
      };
    };
  };
}

export default function PromptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [comments, setComments] = useState<PromptComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentAccessMessage, setCommentAccessMessage] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [commentValidationError, setCommentValidationError] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(new Set());

  const commentsEnabled = useMemo(() => isEnabled('collaboration.comments'), [isEnabled]);

  useEffect(() => {
    if (!id) {
      navigate('/prompts');
      return;
    }

    const fetchPrompt = async () => {
      try {
        setLoadingPrompt(true);
        setPromptError(null);
        const response = await promptsAPI.getPrompt(id);
        setPrompt(response.prompt);
      } catch (error) {
        const apiError = error as ApiError;
        const message =
          apiError.response?.data?.error?.message ||
          (apiError.response?.status === 404 ? 'Prompt not found' : 'Failed to load prompt');
        setPromptError(message);
      } finally {
        setLoadingPrompt(false);
      }
    };

    void fetchPrompt();
  }, [id, navigate]);

  const loadComments = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      setCommentsLoading(true);
      setCommentsError(null);
      setCommentAccessMessage(null);

      const data = await promptCommentsAPI.list(id);
      setComments(data.comments);
    } catch (error) {
      const apiError = error as ApiError;
      const status = apiError.response?.status;
      const message = apiError.response?.data?.error?.message;

      if (status === 403) {
        setCommentAccessMessage(message || 'You do not have permission to view feedback for this prompt.');
      } else if (status === 404) {
        setCommentAccessMessage(message || 'Feedback is unavailable for this prompt.');
      } else {
        setCommentsError(message || 'Failed to load feedback. Please try again.');
      }
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!prompt || flagsLoading) {
      return;
    }

    if (!commentsEnabled) {
      setCommentAccessMessage('Feedback is disabled by feature flags.');
      return;
    }

    if (!prompt.folderId) {
      setCommentAccessMessage('Feedback threads are only available for shared libraries.');
      return;
    }

    void loadComments();
  }, [commentsEnabled, flagsLoading, loadComments, prompt]);

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCommentValidationError(null);

    const trimmed = commentBody.trim();
    if (!trimmed) {
      setCommentValidationError('Please enter a comment before submitting.');
      return;
    }

    if (!id) {
      return;
    }

    try {
      setCommentSubmitting(true);
      const comment = await promptCommentsAPI.create(id, trimmed);
      setComments((prev) => [comment, ...prev]);
      setCommentBody('');
    } catch (error) {
      const apiError = error as ApiError;
      const message = apiError.response?.data?.error?.message || 'Unable to post feedback. Please try again.';
      setCommentValidationError(message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingCommentIds((prev) => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });

    try {
      await promptCommentsAPI.delete(commentId);
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    } catch (error) {
      const apiError = error as ApiError;
      const message = apiError.response?.data?.error?.message || 'Failed to delete feedback. Please try again.';
      setCommentsError(message);
    } finally {
      setDeletingCommentIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  const canManageComments = useMemo(() => {
    if (!prompt || !user) {
      return new Set<string>();
    }

    const managedIds = new Set<string>();
    comments.forEach((comment) => {
      if (comment.author.id === user.id || prompt.user.id === user.id) {
        managedIds.add(comment.id);
      }
    });
    return managedIds;
  }, [comments, prompt, user]);

  const renderComments = () => {
    if (!prompt) {
      return null;
    }

    const commentsUnavailableMessage =
      commentAccessMessage ||
      (!commentsEnabled
        ? 'Feedback is disabled by feature flags.'
        : !prompt.folderId
          ? 'Feedback threads are only available for shared libraries.'
          : null);

    const commentsAvailable = commentsEnabled && Boolean(prompt.folderId) && !commentsUnavailableMessage;

    return (
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Feedback</h2>
            <button
              type="button"
              onClick={() => void loadComments()}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              disabled={commentsLoading || !commentsAvailable}
            >
              Refresh
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Share feedback with teammates who have access to this library.
          </p>
        </div>

        {commentsUnavailableMessage ? (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            {commentsUnavailableMessage}
          </div>
        ) : (
          <form onSubmit={handleCommentSubmit} className="space-y-3">
            {commentValidationError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {commentValidationError}
              </div>
            )}
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              className="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Leave feedback for collaborators..."
              rows={4}
              disabled={commentSubmitting}
            />
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={commentSubmitting}
                className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commentSubmitting ? 'Posting…' : 'Post feedback'}
              </button>
            </div>
          </form>
        )}

        {commentsError && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {commentsError}
          </div>
        )}

        <div className="space-y-4">
          {commentsAvailable && commentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
          ) : !commentsAvailable ? null : comments.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
              No feedback yet. Be the first to share your thoughts.
            </div>
          ) : (
            comments.map((comment) => {
              const canDelete = canManageComments.has(comment.id);
              const isDeleting = deletingCommentIds.has(comment.id);

              return (
                <div key={comment.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {comment.author.name || comment.author.email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteComment(comment.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:text-gray-400"
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Removing…' : 'Delete'}
                      </button>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{comment.body}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (loadingPrompt) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (promptError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-xl font-semibold">Unable to load prompt</h1>
          <p className="mt-2 text-sm">{promptError}</p>
          <div className="mt-6">
            <Link
              to="/prompts"
              className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Back to prompts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!prompt) {
    return null;
  }

  const isOwner = user?.id === prompt.user.id;
  const recentExecutions: PromptExecution[] = prompt.executions ?? [];

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/prompts" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              ← Back to prompts
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{prompt.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>Owner: {prompt.user.name || prompt.user.email}</span>
              <span aria-hidden="true">•</span>
              <span>Last updated {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}</span>
              {prompt.accessScope && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Access: {prompt.accessScope}
                  </span>
                </>
              )}
              {prompt.isPublic && (
                <>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Public
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isOwner && (
              <Link
                to={`/prompts/${prompt.id}/edit`}
                className="inline-flex items-center rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                Edit prompt
              </Link>
            )}
          </div>
        </div>

        {prompt.description && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Description</h2>
            <p className="mt-3 text-sm text-gray-700">{prompt.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Prompt content</h2>
              <p className="mt-3 whitespace-pre-wrap font-mono text-sm text-gray-800">{prompt.content}</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Variables</h2>
                <span className="text-sm text-gray-500">{prompt.variables?.length ?? 0} defined</span>
              </div>
              {prompt.variables && prompt.variables.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {prompt.variables.map((variable) => (
                    <li key={variable.name} className="rounded border border-gray-200 bg-gray-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-gray-900">{variable.name}</div>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {variable.type}
                        </span>
                      </div>
                      {variable.description && (
                        <p className="mt-2 text-xs text-gray-600">{variable.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>{variable.required ? 'Required' : 'Optional'}</span>
                        {variable.defaultValue !== undefined && variable.defaultValue !== '' && (
                          <span>Default: {String(variable.defaultValue)}</span>
                        )}
                        {Array.isArray(variable.options) && variable.options.length > 0 && (
                          <span>Options: {variable.options.join(', ')}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-gray-500">This prompt does not use any variables.</p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Recent executions</h2>
              {recentExecutions.length > 0 ? (
                <ul className="mt-4 space-y-4">
                  {recentExecutions.map((execution) => (
                    <li key={execution.id} className="rounded border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                        <span>Model: {execution.model}</span>
                        <span>{formatDistanceToNow(new Date(execution.createdAt), { addSuffix: true })}</span>
                      </div>
                      <div className="mt-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Input</h3>
                        <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-gray-700 shadow-inner">
{JSON.stringify(execution.input, null, 2)}
                        </pre>
                      </div>
                      <div className="mt-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Output</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{execution.output}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-gray-500">This prompt has not been executed yet.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">{renderComments()}</div>
        </div>
      </div>
    </div>
  );
}