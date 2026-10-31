import React, { useState, useEffect, memo } from 'react';
import { useInfiniteLoopMonitor } from '../../utils/infiniteLoopPrevention';
import Icons from './Icons';
import { formatTimeOnly } from '../../utils/dateTime';

/**
 * InfiniteLoopMonitor Component
 *
 * Displays real-time monitoring of API calls and render loops
 * Provides debugging information and system health status
 */
const InfiniteLoopMonitor = ({ minimized = true, className = '' }) => {
  const { getSystemStats, reset, isSystemHealthy, config } = useInfiniteLoopMonitor();
  const [stats, setStats] = useState(null);
  const [expanded, setExpanded] = useState(!minimized);

  useEffect(() => {
    const updateStats = () => {
      setStats(getSystemStats());
    };

    // Initial update
    updateStats();

    // Set up periodic updates
    const interval = setInterval(updateStats, 2000); // Update every 2 seconds

    return () => {
      clearInterval(interval);
    };
  }, [getSystemStats]);

  const healthy = isSystemHealthy();

  if (!stats) {
    return null;
  }

  const hasAPIIssues = Object.values(stats.api).some(stat =>
    stat.circuitBreaker.state === 'OPEN' ||
    stat.rateLimiter.callsInLastSecond > config.MAX_CALLS_PER_SECOND / 2
  );

  const hasRenderIssues = Object.values(stats.renders).some(stat =>
    stat.rendersInLastSecond > config.MAX_RENDERS_PER_SECOND / 2
  );

  if (minimized && healthy) {
    return (
      <div className={`inline-flex items-center space-x-1 ${className}`}>
        <Icons.CheckCircle size={16} className="text-green-500" />
        <span className="text-xs text-green-600">System Healthy</span>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border rounded-lg shadow-sm ${className}`}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2">
          {healthy ? (
            <Icons.CheckCircle size={16} className="text-green-500" />
          ) : (
            <Icons.Warning size={16} className="text-red-500" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Infinite Loop Monitor
          </span>
          {(hasAPIIssues || hasRenderIssues) && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              Issues Detected
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              reset();
              // Let the interval update the stats to avoid immediate re-render
            }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Reset
          </button>
          <Icons.ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-4">
          {/* API Call Statistics */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              API Call Statistics
            </h4>
            {Object.keys(stats.api).length === 0 ? (
              <p className="text-xs text-gray-500">No API calls tracked</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.api).map(([endpoint, stat]) => (
                  <div key={endpoint} className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {endpoint}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full ${
                          stat.circuitBreaker.state === 'CLOSED'
                            ? 'bg-green-100 text-green-800'
                            : stat.circuitBreaker.state === 'OPEN'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {stat.circuitBreaker.state}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Calls/sec:</span> {stat.rateLimiter.callsInLastSecond}
                      </div>
                      <div>
                        <span className="font-medium">Calls/min:</span> {stat.rateLimiter.callsInLastMinute}
                      </div>
                      <div>
                        <span className="font-medium">Recent:</span> {stat.recentCallCount}
                      </div>
                      <div>
                        <span className="font-medium">Failures:</span> {stat.circuitBreaker.failureCount}
                      </div>
                    </div>
                    {stat.circuitBreaker.state === 'OPEN' && stat.circuitBreaker.nextAttempt && (
                      <div className="mt-1 text-xs text-red-600">
                        Next attempt: {formatTimeOnly(stat.circuitBreaker.nextAttempt, undefined, { seconds: true })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Render Statistics */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Component Render Statistics
            </h4>
            {Object.keys(stats.renders).length === 0 ? (
              <p className="text-xs text-gray-500">No component renders tracked</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.renders).map(([component, stat]) => (
                  <div key={component} className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {component}
                      </span>
                      {stat.rendersInLastSecond > config.MAX_RENDERS_PER_SECOND / 2 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          High Frequency
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Renders/sec:</span> {stat.rendersInLastSecond}
                      </div>
                      <div>
                        <span className="font-medium">Renders/min:</span> {stat.rendersInLastMinute}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Last render:</span> {formatTimeOnly(stat.lastRender, undefined, { seconds: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuration */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Configuration Limits
            </h4>
            <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium">Max API calls/sec:</span> {config.MAX_CALLS_PER_SECOND}
                </div>
                <div>
                  <span className="font-medium">Max API calls/min:</span> {config.MAX_CALLS_PER_MINUTE}
                </div>
                <div>
                  <span className="font-medium">Max renders/sec:</span> {config.MAX_RENDERS_PER_SECOND}
                </div>
                <div>
                  <span className="font-medium">Circuit breaker threshold:</span> {config.CIRCUIT_BREAKER_FAILURE_THRESHOLD}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Last updated: {formatTimeOnly(stats.timestamp, undefined, { seconds: true })}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(InfiniteLoopMonitor);