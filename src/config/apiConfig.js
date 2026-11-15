/**
 * API Configuration (Apps Script proxy today; /api/rpc + Postgres after the migration - src/config/platform.js)
 * Handles connection settings, endpoints, and environment-specific configurations
 */
import { backendInfo } from './platform';

// Environment-based API configuration
const API_CONFIG = {
  development: {
    // LOCAL DEVELOPMENT: Use Vercel proxy to handle CORS issues (same as production)
    baseURL: process.env.REACT_APP_API_BASE_URL_DEV || 'https://jarvis-by-erp.vercel.app/api/appscript-proxy',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    debugMode: true,
    mockMode: false,
    connectionType: 'proxy' // For debugging purposes
  },

  production: {
    // VERCEL PRODUCTION: Use Vercel proxy to handle CORS issues
    baseURL: process.env.REACT_APP_API_BASE_URL || 'https://jarvis-by-erp.vercel.app/api/appscript-proxy',
    timeout: 45000,
    retryAttempts: 5,
    retryDelay: 2000,
    debugMode: false,
    mockMode: false,
    connectionType: 'proxy' // For debugging purposes
  }
};

// Get current environment configuration
const getCurrentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return API_CONFIG[env] || API_CONFIG.development;
};

// Export configuration
export const apiConfig = getCurrentConfig();

/**
 * Action names used inside this file (connection check, mock responses).
 * Not a route list: the frontend API is src/api/googleSheet.js, and npm run check:api-contract
 * checks that every action it sends has a route in the latest AppScript file.
 * (Until Oct 2026 this listed ~90 names, 26 of which no code called and no backend routed.)
 */
export const API_ENDPOINTS = {
  ping: 'ping',
  getCompanies: 'getCompanies',
  getTicketTypes: 'getTicketTypes'
};

/**
 * Extract deployment ID from Google Apps Script URL
 * @param {string} url - The full Apps Script URL
 * @returns {string} The deployment ID or the original URL if extraction fails
 */
export const extractDeploymentId = (url) => {
  try {
    if (!url) return 'Not configured';

    // Match pattern: https://script.google.com/macros/s/DEPLOYMENT_ID/exec
    const match = url.match(/\/s\/([a-zA-Z0-9_-]+)\/exec/);
    return match ? match[1] : url;
  } catch (error) {
    return url;
  }
};

/**
 * Get masked deployment information for display
 */
export const getDeploymentInfo = () => {
  const config = getCurrentConfig();
  const deploymentId = extractDeploymentId(config.baseURL);

  return {
    deploymentId,
    environment: process.env.NODE_ENV || 'development',
    connectionType: config.connectionType,
    mockMode: config.mockMode,
    timeout: config.timeout,
    baseURL: config.baseURL
  };
};

/**
 * API Connection Status Checker
 */
export const checkAPIConnection = async () => {
  try {
    const response = await fetch(apiConfig.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: API_ENDPOINTS.ping,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      connected: true,
      status: 'healthy',
      responseTime: data.responseTime || 0,
      serverTime: data.serverTime,
      version: data.version || 'unknown',
      // Which backend answered: X-Backend (pg | gas) from api/_lib/rpcCore.js / proxyCore.js; readable cross-origin
      // because the API exposes it (Access-Control-Expose-Headers). null = not sent (an old deployment)
      backend: response.headers.get('x-backend')
    };

  } catch (error) {
    return {
      connected: false,
      status: 'error',
      error: error.message,
      responseTime: null
    };
  }
};

/**
 * Mock API responses for development/testing
 */
export const mockAPIResponses = {
  [API_ENDPOINTS.ping]: {
    success: true,
    message: 'API connection successful',
    serverTime: new Date().toISOString(),
    responseTime: 150,
    version: '1.0.0-mock'
  },

  [API_ENDPOINTS.getCompanies]: {
    success: true,
    data: [
      { id: '1', name: 'Main Company', code: 'MAIN', created_at: new Date().toISOString() },
      { id: '2', name: 'Development Branch', code: 'DEV', created_at: new Date().toISOString() }
    ]
  },

  [API_ENDPOINTS.getTicketTypes]: {
    success: true,
    data: [
      { id: '1', name: 'Bug Report', code: 'BUG', company_id: '1' },
      { id: '2', name: 'Feature Request', code: 'FEAT', company_id: '1' }
    ]
  }
};

/**
 * Environment-specific API behavior
 */
export const getAPIBehavior = () => {
  const config = getCurrentConfig();

  return {
    shouldUseMocks: config.mockMode,
    enableRetries: config.retryAttempts > 0,
    enableLogging: config.debugMode,
    timeout: config.timeout,
    retryConfig: {
      attempts: config.retryAttempts,
      delay: config.retryDelay
    }
  };
};

/**
 * API Health Check Component Data
 */
export const getAPIHealthStatus = async () => {
  const connection = await checkAPIConnection();
  const backend = backendInfo(connection.backend);

  return {
    status: connection.connected ? 'healthy' : 'unhealthy',
    message: connection.connected
      ? `Connected: ${backend.name} (${backend.store} - ${connection.responseTime}ms)`
      : `API Connection Failed: ${connection.error}`,
    details: {
      deploymentId: extractDeploymentId(apiConfig.baseURL),
      environment: process.env.NODE_ENV,
      mockMode: apiConfig.mockMode,
      ...connection,
      backendName: backend.name,
      backendStore: backend.store
    }
  };
};

const APIConfigModule = {
  apiConfig,
  API_ENDPOINTS,
  checkAPIConnection,
  mockAPIResponses,
  getAPIBehavior,
  getAPIHealthStatus,
  extractDeploymentId,
  getDeploymentInfo
};

export default APIConfigModule;