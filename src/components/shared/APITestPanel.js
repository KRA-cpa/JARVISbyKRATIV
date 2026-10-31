import React, { useState } from 'react';
import { useAPIConnection, useAPITest } from '../../hooks/useAPI';
import { APIUtils } from '../../api/googleSheet';
import Icons from './Icons';
import { formatTimeOnly } from '../../utils/dateTime';

const APITestPanel = () => {
  const { status, loading, lastChecked, checkConnection } = useAPIConnection();
  const { runTest, result, loading: testLoading, error: testError } = useAPITest();
  const [showDetails, setShowDetails] = useState(false);

  const handleRunTest = async () => {
    try {
      await runTest();
    } catch (error) {
      console.error('Test failed:', error);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'disconnected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Icons.Success size={20} className="text-green-600" />;
      case 'disconnected':
        return <Icons.Error size={20} className="text-red-600" />;
      default:
        return <Icons.Clock size={20} className="text-gray-600" />;
    }
  };

  const apiConfig = APIUtils.getStatus();

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <Icons.Info size={24} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-blue-800">
              API Integration Status
            </h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Connection Status */}
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Connection</p>
                  <p className={`text-sm ${getStatusColor()}`}>
                    {status === 'connected' ? 'Connected' :
                     status === 'disconnected' ? 'Disconnected' : 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon()}
                  <button
                    onClick={checkConnection}
                    disabled={loading}
                    className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    <Icons.Refresh size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              {lastChecked && (
                <p className="text-xs text-gray-500 mt-1">
                  Last checked: {formatTimeOnly(lastChecked, undefined, { seconds: true })}
                </p>
              )}
            </div>

            {/* Configuration Status */}
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Configuration</p>
                  <p className={`text-sm ${apiConfig.configured ? 'text-green-600' : 'text-yellow-600'}`}>
                    {apiConfig.configured ? 'Configured' : 'Mock Mode'}
                  </p>
                </div>
                {apiConfig.configured ? (
                  <Icons.Success size={20} className="text-green-600" />
                ) : (
                  <Icons.Warning size={20} className="text-yellow-600" />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Timeout: {apiConfig.timeout}ms
              </p>
            </div>
          </div>

          {showDetails && (
            <div className="mt-4 space-y-4">
              {/* API Test */}
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Schema Health Check (read-only)</h4>
                  <button
                    onClick={handleRunTest}
                    disabled={testLoading}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {testLoading ? 'Checking...' : 'Run Check'}
                  </button>
                </div>

                {testError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    Test Error: {testError}
                  </div>
                )}

                {result && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Results:</span>
                      <span className={`text-sm ${result.failed === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.passed}/{result.total} tables match the schema
                      </span>
                    </div>
                    {result.details && (
                      <p className="text-xs text-gray-600">{result.details}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Configuration Details */}
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Configuration Details</h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="font-medium text-gray-500">Configured:</dt>
                    <dd className={apiConfig.configured ? 'text-green-600' : 'text-red-600'}>
                      {apiConfig.configured ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Mock Mode:</dt>
                    <dd className={apiConfig.mockMode ? 'text-yellow-600' : 'text-green-600'}>
                      {apiConfig.mockMode ? 'Enabled' : 'Disabled'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Cache:</dt>
                    <dd className="text-green-600">
                      {apiConfig.cacheEnabled ? 'Enabled' : 'Disabled'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Retries:</dt>
                    <dd className="text-gray-900">{apiConfig.maxRetries}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default APITestPanel;