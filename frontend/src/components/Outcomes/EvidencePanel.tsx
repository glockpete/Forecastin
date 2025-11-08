/**
 * EvidencePanel Component
 * Displays citations and provenance for opportunities
 * Shows source information, confidence scores, and excerpts
 */

import React from 'react';
import { FileText, ExternalLink, Calendar, TrendingUp } from 'lucide-react';
import type { EvidencePanelProps } from '../../types/outcomes';
import { cn } from '../../utils/cn';
import { LoadingSpinner } from '../UI/LoadingSpinner';

const EvidenceItem: React.FC<{
  evidence: {
    id: string;
    title: string;
    source: string;
    sourceType: 'report' | 'news' | 'data' | 'expert' | 'internal';
    url?: string;
    excerpt: string;
    confidence: number;
    date: string;
    citations: number;
  };
  onClick?: () => void;
}> = ({ evidence, onClick }) => {
  const getSourceTypeColor = (type: typeof evidence.sourceType) => {
    switch (type) {
      case 'report':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'news':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'data':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'expert':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'internal':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 mb-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg',
        onClick && 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start space-x-2 flex-1">
          <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h6 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
              {evidence.title}
            </h6>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {evidence.source}
            </p>
          </div>
        </div>
        <span className={cn('px-2 py-1 rounded text-xs font-medium ml-2 flex-shrink-0', getSourceTypeColor(evidence.sourceType))}>
          {evidence.sourceType}
        </span>
      </div>

      {/* Excerpt */}
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-3 italic">
        "{evidence.excerpt}"
      </p>

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          {/* Date */}
          <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>{new Date(evidence.date).toLocaleDateString()}</span>
          </div>

          {/* Confidence */}
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300 font-medium">
              {(evidence.confidence * 100).toFixed(0)}%
            </span>
          </div>

          {/* Citations */}
          <div className="text-gray-500 dark:text-gray-400">
            {evidence.citations} citation{evidence.citations !== 1 ? 's' : ''}
          </div>
        </div>

        {/* External Link */}
        {evidence.url && (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <span>View</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

const EvidencePanel: React.FC<EvidencePanelProps> = ({
  evidence,
  opportunityId,
  loading,
  onEvidenceClick,
}) => {
  // Group evidence by source type - must be called before any early returns
  const evidenceByType = React.useMemo(() => {
    const grouped = evidence.reduce((acc, item) => {
      if (!acc[item.sourceType]) {
        acc[item.sourceType] = [];
      }
      acc[item.sourceType]!.push(item);
      return acc;
    }, {} as Record<string, typeof evidence>);

    // Sort each group by confidence
    Object.keys(grouped).forEach((type) => {
      grouped[type]!.sort((a, b) => b.confidence - a.confidence);
    });

    return grouped;
  }, [evidence]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <LoadingSpinner />
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
        <FileText className="w-12 h-12 mb-2" />
        <p className="text-sm">No evidence available</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Summary Stats */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Evidence & Citations
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {evidence.length} source{evidence.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Evidence by Type */}
      {Object.entries(evidenceByType).map(([type, items]) => (
        <div key={type} className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {type} ({items.length})
            </h5>
          </div>
          {items.map((item) => (
            <EvidenceItem
              key={item.id}
              evidence={item}
              {...(onEvidenceClick && { onClick: () => onEvidenceClick(item) })}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default EvidencePanel;