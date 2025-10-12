import { useState, useEffect, useCallback } from 'react';
import { Clock, Zap, Globe, Key, Calendar, Play, Pause, Trash2, Plus, X, Info, HelpCircle, Edit2 } from 'lucide-react';

interface TriggerConfig {
  cron?: string;
  timezone?: string;
  // UI-only metadata to improve edit defaults; stored but ignored by backend
  __ui?: {
    scheduleMode?: 'simple' | 'advanced';
    simple?: { frequency?: 'once' | 'daily' | 'weekly' | 'monthly'; date?: string; time?: string };
  };
  secret?: string;
  timeout?: number;
  retries?: number;
}

interface WorkflowTrigger {
  id: string;
  name: string;
  type: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'API' | 'EVENT';
  isActive: boolean;
  config: TriggerConfig;
  lastTriggeredAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowTriggersProps {
  workflowId: string;
  onTriggerExecuted?: (triggerId: string) => void;
  // Optional input payload to send when executing a trigger manually
  inputForTrigger?: Record<string, unknown>;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export default function WorkflowTriggers({ workflowId, onTriggerExecuted, inputForTrigger }: WorkflowTriggersProps) {
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<WorkflowTrigger | null>(null);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    type: 'MANUAL' as WorkflowTrigger['type'],
    config: {} as TriggerConfig
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: 'MANUAL' as WorkflowTrigger['type'],
    config: {} as TriggerConfig
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'simple' | 'advanced'>('simple');
  const [editScheduleMode, setEditScheduleMode] = useState<'simple' | 'advanced'>('simple');
  const [simpleSchedule, setSimpleSchedule] = useState({
    date: '',
    time: '',
    frequency: 'once' as 'once' | 'daily' | 'weekly' | 'monthly'
  });
  const [editSimpleSchedule, setEditSimpleSchedule] = useState({
    date: '',
    time: '',
    frequency: 'once' as 'once' | 'daily' | 'weekly' | 'monthly'
  });

  // Determine user's local IANA timezone once; fallback to UTC if unavailable
  const localTimezone = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz || 'UTC';
    } catch {
      return 'UTC';
    }
  })();

  // Parse a yyyy-mm-dd string into a local Date (avoids UTC shift issues)
  const parseLocalYyyyMmDd = (value: string): Date | null => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  // Helper function to get human-readable schedule description
  const getScheduleDescription = (cron: string) => {
    if (!cron) return '';
    // Common cron patterns with descriptions
    const patterns: Record<string, string> = {
      '0 0 * * *': 'Daily at midnight',
      '0 9 * * *': 'Daily at 9:00 AM',
      '0 9 * * 1-5': 'Weekdays at 9:00 AM',
      '0 0 * * 0': 'Weekly on Sunday at midnight',
      '0 0 1 * *': 'Monthly on the 1st at midnight',
      '*/15 * * * *': 'Every 15 minutes',
      '0 */6 * * *': 'Every 6 hours',
      '0 8-17 * * 1-5': 'Every hour during business hours (8 AM - 5 PM, weekdays)'
    };

    if (patterns[cron]) return patterns[cron];

    // Basic parsing for common patterns
    const parts = cron.split(' ');
    if (parts.length === 5) {
      const [minute, hour, day, month, weekday] = parts;
      if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
        return `Daily at ${hour}:00`;
      }
      if (minute === '0' && hour !== '*' && day === '*' && month === '*' && weekday !== '*') {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (weekday === '1-5') return `Weekdays at ${hour}:00`;
        if (weekday.length === 1) return `Weekly on ${days[parseInt(weekday)]} at ${hour}:00`;
      }
    }

    return 'Custom schedule';
  };

  // Toast notification system
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Helper function to generate cron expression from simple schedule
  const generateCronFromSimple = () => {
    if (!simpleSchedule.date || !simpleSchedule.time) return '';
    
    const [hours, minutes] = simpleSchedule.time.split(':');
    const date = parseLocalYyyyMmDd(simpleSchedule.date);
    if (!date || isNaN(date.getTime())) return '';
    
    switch (simpleSchedule.frequency) {
      case 'once':
        return `${minutes} ${hours} ${date.getDate()} ${date.getMonth() + 1} *`;
      case 'daily':
        return `${minutes} ${hours} * * *`;
      case 'weekly':
        return `${minutes} ${hours} * * ${date.getDay()}`;
      case 'monthly':
        return `${minutes} ${hours} ${date.getDate()} * *`;
      default:
        return '';
    }
  };

  // Friendly next-run label using nextRunAt and timezone if present
  const renderNextRun = (t: WorkflowTrigger) => {
    if (t.type !== 'SCHEDULED') return null;
    if (!t.nextRunAt) return <span className="ml-2">• Next run: pending</span>;
    const when = new Date(t.nextRunAt);
    const tz = t.config?.timezone || localTimezone;
    try {
      const formatted = when.toLocaleString(undefined, { timeZone: tz, hour12: true });
      return <span className="ml-2">• Next run: {formatted} ({tz})</span>;
    } catch {
      return <span className="ml-2">• Next run: {when.toLocaleString()}</span>;
    }
  };

  // Helper function to get trigger examples
  const getTriggerExamples = () => {
    return {
      MANUAL: {
        title: "Manual Triggers",
        description: "Execute workflows instantly with a click",
        examples: [
          "Processing urgent customer requests",
          "Running ad-hoc data analysis",
          "Testing workflow configurations"
        ]
      },
      SCHEDULED: {
        title: "Scheduled Triggers", 
        description: "Automate workflows with time-based execution",
        examples: [
          "Daily reports at 9 AM: 0 9 * * *",
          "Weekly backups on Sunday: 0 2 * * 0", 
          "Monthly invoice processing: 0 8 1 * *",
          "Every 15 minutes: */15 * * * *",
          "Hourly during business hours: 0 9-17 * * 1-5"
        ]
      },
      WEBHOOK: {
        title: "Webhook Triggers",
        description: "Respond to external HTTP requests securely",
        examples: [
          "GitHub repository push events",
          "Payment processing notifications",
          "Customer support ticket updates",
          "CRM contact form submissions",
          "Third-party service integrations"
        ]
      },
      API: {
        title: "API Triggers",
        description: "Programmatic workflow execution via REST API",
        examples: [
          "Triggered from mobile applications",
          "Integration with internal systems",
          "Bulk workflow processing",
          "Automated testing pipelines",
          "Multi-system orchestration"
        ]
      },
      EVENT: {
        title: "Event Triggers",
        description: "React to system events and state changes",
        examples: [
          "File upload completion events",
          "Database record changes",
          "User activity milestones",
          "System health monitoring",
          "Workflow completion chains"
        ]
      }
    };
  };

  // Fetch triggers for the workflow
  const fetchTriggers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      // If there's no token or it doesn't look like a JWT (header.payload.signature), skip fetching
      if (!token || token.split('.').length !== 3) {
        setTriggers([]);
        setLoading(false);
        return;
      }
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/workflows/${workflowId}/triggers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTriggers(data);
      } else {
        console.error('Failed to fetch triggers');
        showToast('error', 'Failed to load triggers');
      }
    } catch (error) {
      console.error('Error fetching triggers:', error);
      showToast('error', 'Error loading triggers');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Create a new trigger
  const createTrigger = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      // Build final payload ensuring cron is present for scheduled-simple
      let finalFormData = { ...createFormData };
      if (finalFormData.type === 'SCHEDULED') {
        if (scheduleMode === 'simple') {
          const generatedCron = generateCronFromSimple();
          if (!generatedCron) {
            showToast('error', 'Please select a valid date/time to generate a schedule');
            return;
          }
          finalFormData = {
            ...finalFormData,
            // Ensure timezone is set; default to local timezone for user expectations
            config: { timezone: localTimezone, ...finalFormData.config, cron: generatedCron, __ui: { scheduleMode: 'simple', simple: simpleSchedule } },
          };
        } else {
          // Advanced mode must provide cron
          if (!finalFormData.config.cron) {
            showToast('error', 'Cron expression is required for scheduled triggers');
            return;
          }
          // Default timezone if not provided in advanced mode
          finalFormData = {
            ...finalFormData,
            config: { timezone: localTimezone, ...finalFormData.config, __ui: { scheduleMode: 'advanced', simple: simpleSchedule } },
          };
        }
      }

      const response = await fetch(`${apiUrl}/api/workflows/${workflowId}/triggers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalFormData)
      });

      if (response.ok) {
        showToast('success', 'Trigger created successfully');
        setShowCreateDialog(false);
        setCreateFormData({ name: '', type: 'MANUAL', config: {} });
        fetchTriggers(); // Refresh the list
      } else {
        let errorMessage = 'Failed to create trigger';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        showToast('error', errorMessage);
      }
    } catch (error) {
      console.error('Error creating trigger:', error);
      showToast('error', 'Error creating trigger');
    }
  };

  // Execute a trigger manually
  const executeTrigger = async (triggerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/triggers/${triggerId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inputForTrigger ? { input: inputForTrigger } : {})
      });

      if (response.ok) {
        showToast('success', 'Trigger executed successfully');
        onTriggerExecuted?.(triggerId);
        fetchTriggers(); // Refresh to update last triggered time
      } else {
        let errorMessage = 'Failed to execute trigger';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        showToast('error', errorMessage);
      }
    } catch (error) {
      console.error('Error executing trigger:', error);
      showToast('error', 'Error executing trigger');
    }
  };

  // Toggle trigger active status
  const toggleTrigger = async (triggerId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/triggers/${triggerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (response.ok) {
        showToast('success', `Trigger ${!isActive ? 'activated' : 'deactivated'}`);
        fetchTriggers(); // Refresh the list
      } else {
        let errorMessage = 'Failed to update trigger';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        showToast('error', errorMessage);
      }
    } catch (error) {
      console.error('Error updating trigger:', error);
      showToast('error', 'Error updating trigger');
    }
  };

  // Delete a trigger
  const deleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/triggers/${triggerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showToast('success', 'Trigger deleted successfully');
        fetchTriggers(); // Refresh the list
      } else {
        let errorMessage = 'Failed to delete trigger';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        showToast('error', errorMessage);
      }
    } catch (error) {
      console.error('Error deleting trigger:', error);
      showToast('error', 'Error deleting trigger');
    }
  };

  // Start editing a trigger
  const startEditTrigger = (trigger: WorkflowTrigger) => {
    setEditingTrigger(trigger);
    setEditFormData({
      name: trigger.name,
      type: trigger.type,
      config: trigger.config || {}
    });
    
    // Set up edit schedule mode based on existing config
    if (trigger.type === 'SCHEDULED') {
      const preferredMode = trigger.config?.__ui?.scheduleMode;
      if (preferredMode) setEditScheduleMode(preferredMode);

      // Prefer saved UI metadata when available
      const uiSimple = trigger.config?.__ui?.simple;
      if (uiSimple && (uiSimple.time || uiSimple.frequency || uiSimple.date)) {
        setEditSimpleSchedule({
          frequency: (uiSimple.frequency as 'once' | 'daily' | 'weekly' | 'monthly') || 'once',
          time: uiSimple.time || '',
          date: uiSimple.date || ''
        });
      } else {
        // Fallback: Try to parse existing cron into simple schedule
        const cron = trigger.config?.cron || '';
        const parsed = parseCronToSimple(cron);
        if (parsed) setEditSimpleSchedule(parsed);
      }
    }
    
    setShowEditDialog(true);
  };

  // Update a trigger
  const updateTrigger = async () => {
    if (!editingTrigger) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      // Handle scheduled trigger cron generation for edit
      const finalFormData = { ...editFormData };
      if (editFormData.type === 'SCHEDULED' && editScheduleMode === 'simple') {
        const generatedCron = generateCronFromEditSimple();
        if (generatedCron) {
          finalFormData.config = { timezone: localTimezone, ...finalFormData.config, cron: generatedCron, __ui: { scheduleMode: 'simple', simple: editSimpleSchedule } };
        }
      }

      // For advanced mode, ensure timezone is present
      if (editFormData.type === 'SCHEDULED' && editScheduleMode === 'advanced') {
        if (!finalFormData.config) finalFormData.config = {} as TriggerConfig;
        if (!finalFormData.config.timezone) {
          finalFormData.config = { timezone: localTimezone, ...finalFormData.config };
        }
        finalFormData.config.__ui = { scheduleMode: 'advanced', simple: editSimpleSchedule };
      }

      const response = await fetch(`${apiUrl}/api/triggers/${editingTrigger.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalFormData)
      });

      if (response.ok) {
        showToast('success', 'Trigger updated successfully');
        setShowEditDialog(false);
        setEditingTrigger(null);
        setEditFormData({ name: '', type: 'MANUAL', config: {} });
        fetchTriggers(); // Refresh the list
      } else {
        let errorMessage = 'Failed to update trigger';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        showToast('error', errorMessage);
      }
    } catch (error) {
      console.error('Error updating trigger:', error);
      showToast('error', 'Error updating trigger');
    }
  };

  // Helper function to parse cron to simple schedule
  const parseCronToSimple = (cron: string) => {
    // This is a basic parser for common cron patterns
    // Returns null if pattern is too complex for simple mode
    const parts = cron.split(' ');
    if (parts.length !== 5) return null;

    const [minute, hour, day, month, weekday] = parts;

    // Daily at specific time
    if (day === '*' && month === '*' && weekday === '*' && minute !== '*' && hour !== '*') {
      return {
        frequency: 'daily' as const,
        time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
        date: ''
      };
    }

    return null; // Complex pattern, use advanced mode
  };

  // Helper function to generate cron from edit simple schedule
  const generateCronFromEditSimple = () => {
    if (!editSimpleSchedule.time) return null;

    const [hour, minute] = editSimpleSchedule.time.split(':');

    switch (editSimpleSchedule.frequency) {
      case 'once': {
        if (!editSimpleSchedule.date) return null;
        const date = parseLocalYyyyMmDd(editSimpleSchedule.date);
        if (!date || isNaN(date.getTime())) return null;
        return `${minute} ${hour} ${date.getDate()} ${date.getMonth() + 1} *`;
      }
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        // Use saved date (if any) to determine day-of-week; fallback to Sunday
        {
          const d = editSimpleSchedule.date ? parseLocalYyyyMmDd(editSimpleSchedule.date) : null;
          const dow = d && !isNaN(d.getTime()) ? d.getDay() : 0;
          return `${minute} ${hour} * * ${dow}`;
        }
      case 'monthly':
        // Use saved date (if any) to determine day-of-month; fallback to 1st
        {
          const d = editSimpleSchedule.date ? parseLocalYyyyMmDd(editSimpleSchedule.date) : null;
          const dom = d && !isNaN(d.getTime()) ? d.getDate() : 1;
          return `${minute} ${hour} ${dom} * *`;
        }
      default:
        return null;
    }
  };

  // Get trigger type icon
  const getTriggerIcon = (type: WorkflowTrigger['type']) => {
    switch (type) {
      case 'MANUAL': return <Zap className="h-4 w-4" />;
      case 'SCHEDULED': return <Clock className="h-4 w-4" />;
      case 'WEBHOOK': return <Globe className="h-4 w-4" />;
      case 'API': return <Key className="h-4 w-4" />;
      case 'EVENT': return <Calendar className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  // Get trigger type badge color classes
  const getTriggerBadgeColor = (type: WorkflowTrigger['type']) => {
    switch (type) {
      case 'MANUAL': return 'bg-blue-100 text-blue-800';
      case 'SCHEDULED': return 'bg-green-100 text-green-800';
      case 'WEBHOOK': return 'bg-purple-100 text-purple-800';
      case 'API': return 'bg-orange-100 text-orange-800';
      case 'EVENT': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Workflow Triggers</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500">Loading triggers...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg" data-testid="workflow-triggers">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ${
              toast.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === 'success' ? (
                    <div className="h-6 w-6 rounded-full bg-green-400 flex items-center justify-center">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-red-400 flex items-center justify-center">
                      <X className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className={`text-sm font-medium ${
                    toast.type === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {toast.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      toast.type === 'success' 
                        ? 'text-green-500 hover:bg-green-100 focus:ring-green-600' 
                        : 'text-red-500 hover:bg-red-100 focus:ring-red-600'
                    }`}
                    onClick={() => removeToast(toast.id)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Workflow Triggers</h3>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Trigger
        </button>
      </div>

      <div className="p-6">
        {triggers.length === 0 ? (
          <div className="text-center p-8">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">No triggers configured</h3>
            <p className="text-sm text-gray-500 mb-4">
              Add triggers to automate when this workflow runs.
            </p>
            <div className="text-left mb-4 p-3 bg-blue-50 rounded-md">
              <h4 className="text-xs font-medium text-blue-900 mb-2">💡 Quick Start Tips:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>Manual:</strong> For on-demand execution</li>
                <li>• <strong>Scheduled:</strong> For recurring automation (reports, backups)</li>
                <li>• <strong>Webhook:</strong> For external system integration</li>
                <li>• <strong>API:</strong> For programmatic control</li>
              </ul>
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first trigger
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {triggers.map((trigger) => (
              <div key={trigger.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 text-gray-400">
                      {getTriggerIcon(trigger.type)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">{trigger.name}</h4>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTriggerBadgeColor(trigger.type)}`}>
                          {trigger.type.toLowerCase()}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          trigger.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {trigger.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {trigger.lastTriggeredAt ? (
                          `Last triggered: ${new Date(trigger.lastTriggeredAt).toLocaleString()}`
                        ) : (
                          'Never triggered'
                        )}
                        {renderNextRun(trigger)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {trigger.type === 'MANUAL' && (
                      <button
                        onClick={() => executeTrigger(trigger.id)}
                        disabled={!trigger.isActive}
                        data-testid="trigger-run"
                        className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Run
                      </button>
                    )}
                    <button
                      onClick={() => toggleTrigger(trigger.id, trigger.isActive)}
                      data-testid="trigger-toggle"
                      className="inline-flex items-center p-1.5 border border-gray-300 shadow-sm rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      {trigger.isActive ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => startEditTrigger(trigger)}
                      data-testid="trigger-edit"
                      className="inline-flex items-center p-1.5 border border-gray-300 shadow-sm rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteTrigger(trigger.id)}
                      data-testid="trigger-delete"
                      className="inline-flex items-center p-1.5 border border-gray-300 shadow-sm rounded text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {trigger.type === 'SCHEDULED' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    {trigger.config?.cron && (
                      <>
                        <p className="text-xs text-gray-600">
                          Schedule: <code className="bg-gray-100 px-1 rounded text-xs">{trigger.config.cron}</code>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getScheduleDescription(trigger.config.cron)}
                        </p>
                      </>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      Timezone: <code className="bg-gray-100 px-1 rounded text-xs">{trigger.config?.timezone || 'UTC'}</code>
                    </p>
                  </div>
                )}
                {trigger.type === 'WEBHOOK' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      Webhook URL: <code className="bg-gray-100 px-1 rounded text-xs">
                        {import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/webhooks/{trigger.id}
                      </code>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Send POST requests to this endpoint to trigger the workflow
                    </p>
                  </div>
                )}
                {trigger.type === 'API' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      API Endpoint: <code className="bg-gray-100 px-1 rounded text-xs">
                        POST {import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/triggers/{trigger.id}/execute
                      </code>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Requires Authorization header with Bearer token
                    </p>
                  </div>
                )}
                {trigger.type === 'MANUAL' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Click the "Run" button to execute this workflow instantly
                    </p>
                  </div>
                )}
                {trigger.type === 'EVENT' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Automatically triggers when specified system events occur
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Trigger Modal */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40" data-testid="create-trigger-modal">
          <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Trigger</h3>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Section */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="trigger-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Trigger Name
                    </label>
                    <input
                      id="trigger-name"
                      type="text"
                      value={createFormData.name}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter trigger name"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="trigger-type" className="block text-sm font-medium text-gray-700 mb-1">
                      Trigger Type
                    </label>
                    <select
                      id="trigger-type"
                      data-testid="trigger-type"
                      value={createFormData.type}
                      onChange={(e) => setCreateFormData(prev => ({ 
                        ...prev, 
                        type: e.target.value as WorkflowTrigger['type'] 
                      }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="MANUAL">Manual - Execute instantly</option>
                      <option value="SCHEDULED">Scheduled - Time-based automation</option>
                      <option value="WEBHOOK">Webhook - HTTP request triggers</option>
                      <option value="API">API - Programmatic execution</option>
                      <option value="EVENT">Event - System event triggers</option>
                    </select>
                  </div>

                  {/* Type-specific configuration */}
                  {createFormData.type === 'SCHEDULED' && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center space-x-4 mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Schedule Configuration
                          </label>
                          <div className="flex bg-gray-100 rounded-md p-1">
                            <button
                              type="button"
                              onClick={() => setScheduleMode('simple')}
                              className={`px-3 py-1 text-xs rounded ${
                                scheduleMode === 'simple' 
                                  ? 'bg-white text-gray-900 shadow' 
                                  : 'text-gray-600'
                              }`}
                            >
                              Simple
                            </button>
                            <button
                              type="button"
                              onClick={() => setScheduleMode('advanced')}
                              className={`px-3 py-1 text-xs rounded ${
                                scheduleMode === 'advanced' 
                                  ? 'bg-white text-gray-900 shadow' 
                                  : 'text-gray-600'
                              }`}
                            >
                              Advanced
                            </button>
                          </div>
                        </div>

                        {scheduleMode === 'simple' ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={simpleSchedule.date}
                                  onChange={(e) => setSimpleSchedule(prev => ({ ...prev, date: e.target.value }))}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Time
                                </label>
                                <input
                                  type="time"
                                  value={simpleSchedule.time}
                                  onChange={(e) => setSimpleSchedule(prev => ({ ...prev, time: e.target.value }))}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Frequency
                              </label>
                              <select
                                value={simpleSchedule.frequency}
                                onChange={(e) => setSimpleSchedule(prev => ({ 
                                  ...prev, 
                                  frequency: e.target.value as typeof simpleSchedule.frequency 
                                }))}
                                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                              >
                                <option value="once">Once</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>
                            {(simpleSchedule.date || simpleSchedule.time) && (
                              <div className="p-2 bg-blue-50 rounded-md">
                                <p className="text-xs text-blue-800">
                                  Generated cron: <code className="bg-blue-100 px-1 rounded">{generateCronFromSimple()}</code>
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label htmlFor="cron-expression" className="block text-xs font-medium text-gray-600 mb-1">
                              Cron Expression
                            </label>
                            <input
                              id="cron-expression"
                              type="text"
                              value={createFormData.config.cron || ''}
                              onChange={(e) => setCreateFormData(prev => ({ 
                                ...prev, 
                                config: { ...prev.config, cron: e.target.value } 
                              }))}
                              placeholder="0 9 * * * (daily at 9 AM)"
                              className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Format: minute hour day month weekday
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {createFormData.type === 'WEBHOOK' && (
                    <div className="p-4 bg-yellow-50 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <Info className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Webhook Configuration
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>After creation, you'll receive a unique webhook URL that external services can POST to.</p>
                            <p className="mt-1">Include a secret header for security: <code>X-Webhook-Secret</code></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {createFormData.type === 'API' && (
                    <div className="p-4 bg-blue-50 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <Info className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">
                            API Trigger
                          </h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>Execute this workflow programmatically via REST API.</p>
                            <p className="mt-1">Requires authentication token for security.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {createFormData.type === 'EVENT' && (
                    <div className="p-4 bg-green-50 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <Info className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-green-800">
                            Event Trigger
                          </h3>
                          <div className="mt-2 text-sm text-green-700">
                            <p>Responds to system events and state changes.</p>
                            <p className="mt-1">Configure event filters after creation.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Examples Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <HelpCircle className="h-5 w-5 text-gray-400 mr-2" />
                    <h4 className="text-sm font-medium text-gray-900">
                      {getTriggerExamples()[createFormData.type]?.title}
                    </h4>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    {getTriggerExamples()[createFormData.type]?.description}
                  </p>

                  <div className="space-y-2">
                    <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                      Common Use Cases:
                    </h5>
                    <ul className="space-y-1">
                      {getTriggerExamples()[createFormData.type]?.examples.map((example, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start">
                          <span className="text-purple-500 mr-2">•</span>
                          <span>{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {createFormData.type === 'SCHEDULED' && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                        Common Cron Patterns:
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <code className="bg-gray-200 px-1 rounded">0 0 * * *</code>
                          <span className="text-gray-600">Daily at midnight</span>
                        </div>
                        <div className="flex justify-between">
                          <code className="bg-gray-200 px-1 rounded">0 9 * * 1-5</code>
                          <span className="text-gray-600">Weekdays at 9 AM</span>
                        </div>
                        <div className="flex justify-between">
                          <code className="bg-gray-200 px-1 rounded">*/15 * * * *</code>
                          <span className="text-gray-600">Every 15 minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <code className="bg-gray-200 px-1 rounded">0 2 1 * *</code>
                          <span className="text-gray-600">Monthly on 1st at 2 AM</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-6 border-t mt-6">
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Use generated cron if in simple mode
                    if (createFormData.type === 'SCHEDULED' && scheduleMode === 'simple') {
                      const generatedCron = generateCronFromSimple();
                      if (generatedCron) {
                        setCreateFormData(prev => ({
                          ...prev,
                          config: { ...prev.config, cron: generatedCron }
                        }));
                      }
                    }
                    createTrigger();
                  }}
                  disabled={!createFormData.name.trim()}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  Create Trigger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Trigger Modal */}
      {showEditDialog && editingTrigger && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40" data-testid="edit-trigger-modal">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 xl:w-2/5 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Trigger</h3>
                <button
                  onClick={() => setShowEditDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Trigger Name */}
                <div>
                  <label htmlFor="edit-trigger-name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    id="edit-trigger-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    placeholder="Enter trigger name"
                  />
                </div>

                {/* Trigger Type */}
                <div>
                  <label htmlFor="edit-trigger-type" className="block text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    id="edit-trigger-type"
                    data-testid="edit-trigger-type"
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value as WorkflowTrigger['type'], config: {} })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                  >
                    <option value="MANUAL">Manual - Execute instantly</option>
                    <option value="SCHEDULED">Scheduled - Time-based automation</option>
                    <option value="WEBHOOK">Webhook - HTTP request triggers</option>
                    <option value="API">API - Programmatic execution</option>
                    <option value="EVENT">Event - System event triggers</option>
                  </select>
                </div>

                {/* Type-specific configuration for Edit */}
                {editFormData.type === 'SCHEDULED' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center space-x-4 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Schedule Configuration
                        </label>
                        <div className="flex bg-gray-100 rounded-md p-1">
                          <button
                            type="button"
                            onClick={() => setEditScheduleMode('simple')}
                            className={`px-3 py-1 text-xs rounded ${
                              editScheduleMode === 'simple' 
                                ? 'bg-white shadow text-gray-900' 
                                : 'text-gray-600'
                            }`}
                          >
                            Simple
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditScheduleMode('advanced')}
                            className={`px-3 py-1 text-xs rounded ${
                              editScheduleMode === 'advanced' 
                                ? 'bg-white shadow text-gray-900' 
                                : 'text-gray-600'
                            }`}
                          >
                            Advanced
                          </button>
                        </div>
                      </div>

                      {editScheduleMode === 'simple' ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Frequency
                              </label>
                              <select
                                value={editSimpleSchedule.frequency}
                                onChange={(e) => setEditSimpleSchedule({ ...editSimpleSchedule, frequency: e.target.value as 'once' | 'daily' | 'weekly' | 'monthly' })}
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                              >
                                <option value="once">Once</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Time
                              </label>
                              <input
                                type="time"
                                value={editSimpleSchedule.time}
                                onChange={(e) => setEditSimpleSchedule({ ...editSimpleSchedule, time: e.target.value })}
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                              />
                            </div>
                          </div>
                          {editSimpleSchedule.frequency === 'once' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                                value={editSimpleSchedule.date}
                                onChange={(e) => setEditSimpleSchedule({ ...editSimpleSchedule, date: e.target.value })}
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Cron Expression
                          </label>
                          <input
                            type="text"
                            value={editFormData.config.cron || ''}
                            onChange={(e) => setEditFormData({ 
                              ...editFormData, 
                              config: { ...editFormData.config, cron: e.target.value } 
                            })}
                            className="w-full font-mono text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                            placeholder="0 9 * * *"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Format: minute hour day month weekday
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowEditDialog(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editFormData.type === 'SCHEDULED' && editScheduleMode === 'simple') {
                        const generatedCron = generateCronFromEditSimple();
                        if (generatedCron) {
                          setEditFormData(prev => ({
                            ...prev,
                            config: { ...prev.config, cron: generatedCron }
                          }));
                        }
                      }
                      updateTrigger();
                    }}
                    disabled={!editFormData.name.trim()}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    Update Trigger
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}