/**
 * ActionQueue Component
 * Displays generated actions based on business rules
 * Shows action priority, status, and metadata
 */

import React from 'react';
import { CheckCircle, Circle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { ActionQueueProps, Action } from '../../types/outcomes';
import { cn } from '../../utils/cn';
import { useUpdateActionStatus } from '../../hooks/useOutcomes';

const ActionItem: React.FC<{
  action: Action;
  onStatusChange?: (actionId: string, status: Action['status']) => void;
}> = ({ action, onStatusChange }) => {
  const { mutate: updateStatus } = useUpdateActionStatus();

  const getPriorityColor = (priority: Action['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getStatusIcon = (status: Action['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'blocked':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleStatusToggle = () => {
    const newStatus: Action['status'] = 
      action.status === 'pending' ? 'in_progress' :
      action.status === 'in_progress' ? 'completed' :
      'pending';
    
    updateStatus({ actionId: action.id, status: newStatus });
    onStatusChange?.(action.id, newStatus);
  };

  return (
    <div className="p-2 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
      <div className="flex items-start space-x-2">
        <button
          onClick={handleStatusToggle}
          className="mt-0.5 flex-shrink-0 hover:opacity-75 transition-opacity"
        >
          {getStatusIcon(action.status)}
        </button>
        
        <div className="flex-1 min-w-0">
          {/* Title and Priority */}
          <div className="flex items-start justify-between mb-1">
            <h6 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex-1">
              {action.title}
            </h6>
            <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium ml-2', getPriorityColor(action.priority))}>
              {action.priority}
            </span>
          </div>
          
          {/* Description */}
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 line-clamp-2">
            {action.description}
          </p>
          
          {/* Metadata */}
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
              {action.type.replace('_', ' ')}
            </span>
            <span>•</span>
            <span>{action.businessRule.replace('_', ' ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActionQueue: React.FC<ActionQueueProps> = ({ actions, onActionClick, onActionStatusChange }) => {
  // Sort actions by priority and status
  const sortedActions = React.useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = { pending: 0, in_progress: 1, blocked: 2, completed: 3 };
    
    return [...actions].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [actions]);

  const actionsByStatus = React.useMemo(() => {
    return {
      pending: sortedActions.filter(a => a.status === 'pending').length,
      in_progress: sortedActions.filter(a => a.status === 'in_progress').length,
      completed: sortedActions.filter(a => a.status === 'completed').length,
      blocked: sortedActions.filter(a => a.status === 'blocked').length,
    };
  }, [sortedActions]);

  return (
    <div className="p-3">
      {/* Status Summary */}
      <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-1 text-xs">
          <Circle className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">{actionsByStatus.pending}</span>
        </div>
        <div className="flex items-center space-x-1 text-xs">
          <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span className="text-blue-600 dark:text-blue-400">{actionsByStatus.in_progress}</span>
        </div>
        <div className="flex items-center space-x-1 text-xs">
          <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
          <span className="text-green-600 dark:text-green-400">{actionsByStatus.completed}</span>
        </div>
        {actionsByStatus.blocked > 0 && (
          <div className="flex items-center space-x-1 text-xs">
            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span className="text-red-600 dark:text-red-400">{actionsByStatus.blocked}</span>
          </div>
        )}
      </div>

      {/* Actions List */}
      <div className="space-y-1">
        {sortedActions.map((action) => (
          <ActionItem
            key={action.id}
            action={action}
            onStatusChange={onActionStatusChange}
          />
        ))}
      </div>
    </div>
  );
};

export default ActionQueue;