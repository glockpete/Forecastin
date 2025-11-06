/**
 * StakeholderMap Component
 * Scatter plot visualization of stakeholders by influence × alignment
 * Interactive visualization with quadrant-based positioning
 */

import React from 'react';
import { Users } from 'lucide-react';
import { StakeholderMapProps } from '../../types/outcomes';
import { cn } from '../../utils/cn';

const StakeholderMap: React.FC<StakeholderMapProps> = ({
  stakeholders,
  selectedStakeholder,
  onStakeholderClick,
  height = 300,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Calculate position for scatter plot (0-1 scale to pixel coordinates)
  const getPosition = (influence: number, alignment: number) => {
    return {
      x: influence * 100, // percentage
      y: (1 - alignment) * 100, // inverted Y axis
    };
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center space-x-2 mb-3">
        <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Stakeholder Map
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({stakeholders.length})
        </span>
      </div>

      {/* Scatter Plot Container */}
      <div
        ref={containerRef}
        className="relative bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        style={{ height: `${height}px` }}
      >
        {/* Axis Labels */}
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 dark:text-gray-400">
          High Influence →
        </div>
        <div className="absolute top-1/2 -left-20 transform -translate-y-1/2 -rotate-90 text-xs text-gray-600 dark:text-gray-400">
          High Alignment →
        </div>

        {/* Quadrant Lines */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 border-t border-gray-300 dark:border-gray-600" />
          <div className="absolute left-1/2 top-0 bottom-0 border-l border-gray-300 dark:border-gray-600" />
        </div>

        {/* Quadrant Labels */}
        <div className="absolute top-2 left-2 text-xs text-gray-500 dark:text-gray-400">Low Influence<br/>High Alignment</div>
        <div className="absolute top-2 right-2 text-xs text-gray-500 dark:text-gray-400 text-right">High Influence<br/>High Alignment</div>
        <div className="absolute bottom-2 left-2 text-xs text-gray-500 dark:text-gray-400">Low Influence<br/>Low Alignment</div>
        <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400 text-right">High Influence<br/>Low Alignment</div>

        {/* Stakeholder Points */}
        {stakeholders.map((stakeholder) => {
          const pos = getPosition(stakeholder.influence, stakeholder.alignment);
          const isSelected = selectedStakeholder?.id === stakeholder.id;

          return (
            <div
              key={stakeholder.id}
              className={cn(
                'absolute w-3 h-3 rounded-full cursor-pointer transition-all transform -translate-x-1/2 -translate-y-1/2',
                isSelected
                  ? 'bg-blue-600 dark:bg-blue-400 scale-150 z-10'
                  : 'bg-gray-600 dark:bg-gray-400 hover:bg-blue-500 dark:hover:bg-blue-500 hover:scale-125'
              )}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
              onClick={() => onStakeholderClick(stakeholder)}
              title={`${stakeholder.name} - ${stakeholder.role}`}
            />
          );
        })}
      </div>

      {/* Selected Stakeholder Info */}
      {selectedStakeholder && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {selectedStakeholder.name}
          </h5>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {selectedStakeholder.role}
            {selectedStakeholder.organization && ` • ${selectedStakeholder.organization}`}
          </p>
          <div className="flex items-center space-x-4 mt-2 text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              Influence: <span className="font-medium">{(selectedStakeholder.influence * 100).toFixed(0)}%</span>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Alignment: <span className="font-medium">{(selectedStakeholder.alignment * 100).toFixed(0)}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StakeholderMap;