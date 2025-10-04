import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import PromptEditor from './components/PromptEditor';
import PromptList from './components/PromptList';
import PromptDetail from './components/PromptDetail';
import WorkflowList from './components/WorkflowList';
import WorkflowEditor from './components/WorkflowEditor';
import WorkflowDetail from './components/WorkflowDetail';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return user ? <FeatureFlagsProvider>{children}</FeatureFlagsProvider> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" /> : <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/prompts" element={
              <ProtectedRoute>
                <Layout>
                  <PromptList />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/prompts/new" element={
              <ProtectedRoute>
                <Layout>
                  <PromptEditor />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/prompts/:id" element={
              <ProtectedRoute>
                <Layout>
                  <PromptDetail />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/prompts/:id/edit" element={
              <ProtectedRoute>
                <Layout>
                  <PromptEditor />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/workflows" element={
              <ProtectedRoute>
                <Layout>
                  <WorkflowList />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/workflows/new" element={
              <ProtectedRoute>
                <Layout>
                  <WorkflowEditor />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/workflows/:id" element={
              <ProtectedRoute>
                <Layout>
                  <WorkflowDetail />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/workflows/:id/edit" element={
              <ProtectedRoute>
                <Layout>
                  <WorkflowEditor />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
