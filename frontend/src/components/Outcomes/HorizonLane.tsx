/**
 * HorizonLane Component
 * Displays opportunities and actions for a specific time horizon
 * Implements "Four Lanes by Horizon" architecture: Immediate | Short | Medium | Long
 */

import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { HorizonLaneProps, TimeHorizon } from '../../types/outcomes';
import { cn } from '../../utils/cn';
import OpportunityRadar from './OpportunityRadar';
import ActionQueue from './ActionQueue';
import { LoadingSpinner } from '../UI/LoadingSpinner';

const HorizonLane: React.FC<HorizonLaneProps> = ({
  horizon,
  opportunities,
  actions,
  selectedOpportunity,
  onOpportunitySelect,
  loading,
}) => {
  // Horizon configuration
  const horizonConfig: Record<TimeHorizon, { label: string; color: string; bgColor: string }> = {
    immediate: {
      label: 'Immediate (0-30d)',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/10',
    },
    short: {
      label: 'Short (1-3m)',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/10',
    },
    medium: {
      label: 'Medium (3-12m)',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
    },
    long: {
      label: 'Long (12m+)',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/10',
    },
  };

  const config = horizonConfig[horizon];

  if (loading) {
    return (
      <div className={cn('flex-1 border-r border-gray-200 dark:border-gray-700', config.bgColor)}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Clock className={cn('w-5 h-5', config.color)} />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {config.label}
            </h3>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 border-r border-gray-200 dark:border-gray-700', config.bgColor)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className={cn('w-5 h-5', config.color)} />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {config.label}
            </h3>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
              {opportunities.length} opp
            </span>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
              {actions.length} actions
            </span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
        {/* Opportunity Radar Section */}
        <div className="flex-1 overflow-y-auto border-b border-gray-200 dark:border-gray-700">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Opportunity Radar
            </h4>
          </div>
          {opportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-sm">No opportunities in this horizon</p>
            </div>
          ) : (
            <OpportunityRadar
              opportunities={opportunities}
              onOpportunityClick={onOpportunitySelect}
              selectedId={selectedOpportunity?.id}
            />
          )}
        </div>

        {/* Action Queue Section */}
        <div className="h-48 overflow-y-auto">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Action Queue
            </h4>
          </div>
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-500 dark:text-gray-400">
              <p className="text-xs">No actions generated</p>
            </div>
          ) : (
            <ActionQueue actions={actions} />
          )}
        </div>
      </div>
    </div>
  );
};

export default HorizonLane;