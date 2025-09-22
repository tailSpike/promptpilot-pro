import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name || user?.email}!
        </h1>
        <p className="mt-2 text-gray-600">
          Create and manage your AI prompts with variables and workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">+</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Prompt</h3>
                <p className="text-sm text-gray-500">Build structured prompts with variables</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                to="/prompts/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">📝</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">View All Prompts</h3>
                <p className="text-sm text-gray-500">Browse and manage your prompt library</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                to="/prompts"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Browse Prompts
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">🔄</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Workflows</h3>
                <p className="text-sm text-gray-500">Chain prompts into automated workflows</p>
              </div>
            </div>
            <div className="mt-4">
              <button
                disabled
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}