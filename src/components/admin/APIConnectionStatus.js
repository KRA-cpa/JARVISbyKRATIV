import React, { useState, useEffect } from 'react';
import { getAPIHealthStatus, apiConfig, extractDeploymentId } from '../../config/apiConfig';
import { useToast } from '../shared/Toast';
import { useInfiniteLoopMonitor } from '../../utils/infiniteLoopPrevention';
import Icons from '../shared/Icons';
import { formatDateTime, formatTimeOnly } from '../../utils/dateTime';

const APIConnectionStatus = () => {
  const { success, error: showError } = useToast();
  const { isSystemHealthy, getSystemStats, reset, config } = useInfiniteLoopMonitor();
  const [connectionStatus, setConnectionStatus] = useState({
    status: 'checking',
    message: 'Checking API connection...',
    details: {}
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  // Details hidden by default for cleaner UI
  const [showDetails, setShowDetails] = useState(false);
  const [showInfiniteLoopDetails, setShowInfiniteLoopDetails] = useState(false);

  useEffect(() => {
    checkConnection();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const status = await getAPIHealthStatus();
      setConnectionStatus(status);
      setLastChecked(new Date());
    } catch (error) {
      setConnectionStatus({
        status: 'error',
        message: `Failed to check API status: ${error.message}`,
        details: { error: error.message }
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleManualCheck = async () => {
    await checkConnection();
    if (connectionStatus.status === 'healthy') {
      success('API connection verified successfully');
    } else {
      showError('API connection failed - check configuration');
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case 'healthy': return 'green';
      case 'unhealthy': return 'red';
      case 'checking': return 'yellow';
      default: return 'gray';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case 'healthy': return Icons.Success;
      case 'unhealthy': return Icons.Error;
      case 'checking': return Icons.Clock;
      default: return Icons.Warning;
    }
  };

  const StatusIcon = getStatusIcon();
  const statusColor = getStatusColor();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" key="api-connection-status">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Google Sheets API Connection
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center space-x-2"
          >
            <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
            {showDetails ? (
              <Icons.ChevronUp size={16} />
            ) : (
              <Icons.ChevronDown size={16} />
            )}
          </button>
          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {isChecking && (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>Check Now</span>
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`border rounded-lg p-4 mb-4 bg-${statusColor}-50 border-${statusColor}-200`}>
        <div className="flex items-center space-x-3">
          <StatusIcon
            size={24}
            className={`text-${statusColor}-600 ${connectionStatus.status === 'checking' ? 'animate-spin' : ''}`}
          />
          <div className="flex-1">
            <div className={`font-medium text-${statusColor}-900`}>
              {connectionStatus.status === 'healthy' ? 'Connected' :
               connectionStatus.status === 'unhealthy' ? 'Disconnected' :
               connectionStatus.status === 'checking' ? 'Checking...' : 'Unknown'}
            </div>
            <div className={`text-sm text-${statusColor}-700`}>
              {connectionStatus.message}
            </div>
            {lastChecked && (
              <div className={`text-xs text-${statusColor}-600 mt-1`}>
                Last checked: {formatTimeOnly(lastChecked, undefined, { seconds: true })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Infinite Loop Protection Status - Before Show Details */}
      <div className="border rounded-lg p-3 mb-4 bg-gray-50 border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Infinite Loop Protection:</span>
            <div className="flex items-center space-x-1">
              {isSystemHealthy() ? (
                <>
                  <Icons.CheckCircle size={16} className="text-green-500" />
                  <span className="text-sm text-green-600 font-medium">Healthy</span>
                </>
              ) : (
                <>
                  <Icons.Warning size={16} className="text-red-500" />
                  <span className="text-sm text-red-600 font-medium">Issues Detected</span>
                </>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Monitoring system health
          </div>
        </div>
      </div>


      {/* Collapsible Configuration & Connection Details */}
      {showDetails && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Configuration</h4>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Environment:</span>
                <span className="font-mono text-gray-900">
                  {process.env.NODE_ENV || 'development'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Deployment ID:</span>
                <span className="font-mono text-gray-900 text-xs">
                  {extractDeploymentId(apiConfig.baseURL)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Timeout:</span>
                <span className="font-mono text-gray-900">
                  {apiConfig.timeout}ms
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Mock Mode:</span>
                <span className={`font-mono ${apiConfig.mockMode ? 'text-yellow-600' : 'text-green-600'}`}>
                  {apiConfig.mockMode ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection Details */}
          {connectionStatus.details && Object.keys(connectionStatus.details).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Connection Details</h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {connectionStatus.details.responseTime && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Response Time:</span>
                    <span className="font-mono text-gray-900">
                      {connectionStatus.details.responseTime}ms
                    </span>
                  </div>
                )}
                {connectionStatus.details.serverTime && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Server Time:</span>
                    <span className="font-mono text-gray-900 text-xs">
                      {formatDateTime(connectionStatus.details.serverTime)}
                    </span>
                  </div>
                )}
                {connectionStatus.details.version && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">API Version:</span>
                    <span className="font-mono text-gray-900">
                      {connectionStatus.details.version}
                    </span>
                  </div>
                )}
                {connectionStatus.details.error && (
                  <div className="text-sm">
                    <span className="text-gray-600">Error:</span>
                    <div className="font-mono text-red-600 text-xs mt-1 p-2 bg-red-50 rounded border">
                      {connectionStatus.details.error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Monitor - Infinite Loop Details */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">System Monitor</h4>
              <button
                onClick={() => setShowInfiniteLoopDetails(!showInfiniteLoopDetails)}
                className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center space-x-1"
              >
                <span>{showInfiniteLoopDetails ? 'Hide' : 'Show'} Details</span>
                {showInfiniteLoopDetails ? (
                  <Icons.ChevronUp size={12} />
                ) : (
                  <Icons.ChevronDown size={12} />
                )}
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Infinite Loop Protection:</span>
                <div className="flex items-center space-x-2">
                  {isSystemHealthy() ? (
                    <>
                      <Icons.CheckCircle size={16} className="text-green-500" />
                      <span className="text-green-600 font-medium">Healthy</span>
                    </>
                  ) : (
                    <>
                      <Icons.Warning size={16} className="text-red-500" />
                      <span className="text-red-600 font-medium">Issues Detected</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Monitoring API calls and component renders for infinite loops
              </div>

              {/* Complete Infinite Loop Monitor Information */}
              {showInfiniteLoopDetails && (
                <div className="mt-4 pt-3 border-t border-gray-200 space-y-4">
                  {(() => {
                    const stats = getSystemStats();

                    return (
                      <>
                        {/* Reset Button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              reset();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 border border-blue-300 rounded hover:bg-blue-50"
                          >
                            Reset
                          </button>
                        </div>

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

                        {/* Component Render Statistics */}
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

                        {/* Configuration Limits */}
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
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Troubleshooting */}
      {connectionStatus.status === 'unhealthy' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
          <div className="flex items-start space-x-2">
            <Icons.Warning size={16} className="text-yellow-600 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-yellow-900">Troubleshooting</h5>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                <li>• Verify the Google Apps Script deployment URL is correct</li>
                <li>• Check that the script is deployed as a web app with proper permissions</li>
                <li>• Ensure CORS is configured in the Apps Script project</li>
                <li>• Verify environment variables are set correctly</li>
                <li>• Check network connectivity and firewall settings</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Mock Mode Warning */}
      {apiConfig.mockMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
          <div className="flex items-start space-x-2">
            <Icons.Warning size={16} className="text-yellow-600 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-yellow-900">Mock Mode Active</h5>
              <p className="text-sm text-yellow-700 mt-1">
                The application is currently using mock data instead of the live Google Sheets API.
                Disable mock mode in the API configuration to use real data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIConnectionStatus;