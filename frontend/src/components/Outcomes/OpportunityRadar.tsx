/**
 * OpportunityRadar Component
 * Displays opportunity cards sorted by ROI score
 * Implements card-based opportunity visualization with selection state
 */

import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react';
import { OpportunityRadarProps, Opportunity } from '../../types/outcomes';
import { cn } from '../../utils/cn';

const OpportunityCard: React.FC<{
  opportunity: Opportunity;
  onClick: (opportunity: Opportunity) => void;
  selected: boolean;
}> = ({ opportunity, onClick, selected }) => {
  // Calculate score color based on ROI
  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600 dark:text-green-400';
    if (score >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Calculate risk color
  const getRiskColor = (risk: number) => {
    if (risk >= 0.7) return 'text-red-600 dark:text-red-400';
    if (risk >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div
      onClick={() => onClick(opportunity)}
      className={cn(
        'p-3 mb-2 rounded-lg border-2 cursor-pointer transition-all',
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-800'
      )}
    >
      {/* Title and ROI Score */}
      <div className="flex items-start justify-between mb-2">
        <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1 mr-2">
          {opportunity.title}
        </h5>
        <span className={cn('text-lg font-bold', getScoreColor(opportunity.roiScore))}>
          {(opportunity.roiScore * 100).toFixed(0)}%
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
        {opportunity.description}
      </p>

      {/* Metrics Row */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Confidence */}
        <div className="flex items-center space-x-1">
          <span className="text-gray-500 dark:text-gray-400">Confidence:</span>
          <span className={cn('font-medium', getScoreColor(opportunity.confidence))}>
            {(opportunity.confidence * 100).toFixed(0)}%
          </span>
        </div>

        {/* Risk Level */}
        <div className="flex items-center space-x-1">
          <AlertTriangle className={cn('w-3 h-3', getRiskColor(opportunity.riskLevel))} />
          <span className={cn('font-medium', getRiskColor(opportunity.riskLevel))}>
            {(opportunity.riskLevel * 100).toFixed(0)}%
          </span>
        </div>

        {/* Momentum */}
        {opportunity.momentum !== 0 && (
          <div className="flex items-center space-x-1">
            {opportunity.momentum > 0 ? (
              <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
            )}
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {Math.abs(opportunity.momentum * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* Policy Window */}
        {opportunity.policyWindow !== undefined && opportunity.policyWindow <= 30 && (
          <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">
            <Clock className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300 font-medium">
              {opportunity.policyWindow}d
            </span>
          </div>
        )}
      </div>

      {/* Sectors */}
      {opportunity.sector.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {opportunity.sector.slice(0, 3).map((sector) => (
            <span
              key={sector}
              className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
            >
              {sector}
            </span>
          ))}
          {opportunity.sector.length > 3 && (
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">
              +{opportunity.sector.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const OpportunityRadar: React.FC<OpportunityRadarProps> = ({
  opportunities,
  onOpportunityClick,
  selectedId,
}) => {
  // Sort opportunities by ROI score (descending)
  const sortedOpportunities = React.useMemo(() => {
    return [...opportunities].sort((a, b) => b.roiScore - a.roiScore);
  }, [opportunities]);

  return (
    <div className="p-3 space-y-2">
      {sortedOpportunities.map((opportunity) => (
        <OpportunityCard
          key={opportunity.id}
          opportunity={opportunity}
          onClick={onOpportunityClick}
          selected={opportunity.id === selectedId}
        />
      ))}
    </div>
  );
};

export default OpportunityRadar;