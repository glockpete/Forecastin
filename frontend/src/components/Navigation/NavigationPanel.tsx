/**
 * Navigation Panel Component
 * Side navigation with theme toggle and controls
 */

import React from 'react';
import { 
  Menu, 
  X, 
  Home, 
  Search, 
  Settings, 
  Moon, 
  Sun,
  Wifi,
  WifiOff,
  Database,
  BarChart3
} from 'lucide-react';

import { useUIStore } from '../../store/uiStore';
import { useResponsive } from '../../store/uiStore';
import { cn } from '../../utils/cn';

interface NavigationPanelProps {
  onClose?: () => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({ onClose }) => {
  const {
    theme,
    setTheme,
    searchPanelOpen,
    toggleSearchPanel,
    isMobile,
  } = useUIStore();

  const { isMobile: responsiveMobile } = useResponsive();

  const handleThemeToggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const navigationItems = [
    { icon: Home, label: 'Home', active: true },
    { icon: Search, label: 'Search', onClick: toggleSearchPanel },
    { icon: BarChart3, label: 'Analytics' },
    { icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Navigation
        </h2>
        {(isMobile || responsiveMobile) && onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item, index) => (
            <li key={index}>
              <button
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  'hover:bg-gray-200 dark:hover:bg-gray-700',
                  item.active
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                )}
                onClick={item.onClick}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Status & Controls */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Database</span>
          <div className="flex items-center space-x-2">
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">WebSocket</span>
          <div className="flex items-center space-x-2">
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          className={cn(
            'w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
            'hover:bg-gray-200 dark:hover:bg-gray-700',
            'text-gray-700 dark:text-gray-300'
          )}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 mr-2" />
              Dark Mode
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 mr-2" />
              Light Mode
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NavigationPanel;