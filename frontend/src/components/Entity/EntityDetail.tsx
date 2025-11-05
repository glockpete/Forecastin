/**
 * Entity Detail Component
 * Displays detailed information about a selected entity
 */

import React from 'react';
import { 
  X, 
  Calendar, 
  MapPin, 
  Users, 
  Building, 
  FileText,
  Tag,
  Clock,
  TrendingUp,
  BarChart3
} from 'lucide-react';

import { useUIStore } from '../../store/uiStore';
import { useEntity, Entity } from '../../hooks/useHierarchy';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { cn } from '../../utils/cn';

export const EntityDetail: React.FC = () => {
  const { activeEntity, setActiveEntity } = useUIStore();
  
  const { data: entityData, isLoading, error } = useEntity(
    activeEntity?.id || ''
  );

  const entity = entityData || activeEntity;

  if (!entity) {
    return null;
  }

  const handleClose = () => {
    setActiveEntity(null);
  };

  const getEntityIcon = (type: string) => {
    const iconMap = {
      folder: FileText,
      document: FileText,
      person: Users,
      organization: Building,
      location: MapPin,
      default: FileText,
    };
    
    const IconComponent = iconMap[type as keyof typeof iconMap] || iconMap.default;
    return IconComponent;
  };

  const Icon = getEntityIcon(entity.type);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Entity Details
          </h2>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <LoadingSpinner message="Loading entity details..." />
        ) : error ? (
          <div className="text-center text-red-600 dark:text-red-400">
            <p>Failed to load entity details</p>
          </div>
        ) : (
          <>
            {/* Basic Info */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {entity.name}
              </h3>
              <div className="flex items-center space-x-2 mb-4">
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full capitalize">
                  {entity.type}
                </span>
                {entity.confidence && (
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full">
                    {(entity.confidence * 100).toFixed(0)}% confidence
                  </span>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Information
              </h4>
              
              <div className="space-y-3">
                {entity.id && (
                  <div className="flex items-center space-x-3">
                    <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">ID</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{entity.id}</p>
                    </div>
                  </div>
                )}

                {entity.path && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Path</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{entity.path}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Depth Level</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{entity.pathDepth}</p>
                  </div>
                </div>

                {entity.hasChildren && (
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Children Count</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{entity.childrenCount || 0}</p>
                    </div>
                  </div>
                )}

                {entity.createdAt && (
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(entity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {entity.updatedAt && (
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(entity.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Extended Metadata */}
            {entity.metadata && Object.keys(entity.metadata).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-3">
                  Additional Metadata
                </h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                    {JSON.stringify(entity.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Relationships */}
            {entity.parentId && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-3">
                  Relationships
                </h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Parent Entity: {entity.parentId}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EntityDetail;