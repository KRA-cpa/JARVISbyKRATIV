/**
 * Google Sheets API Integration Layer
 * Handles all communication with Google Apps Script backend
 * Includes caching, error handling, and mock data fallback
 */

import { ValidationUtils } from './models';
import { apiConfig } from '../config/apiConfig';
import { auth } from '../config/firebase';

// API Configuration - Reduced retries to prevent resource exhaustion
const CONFIG = {
  APPS_SCRIPT_URL: apiConfig.baseURL,
  TIMEOUT: 15000, // Reduced timeout
  MAX_RETRIES: 1, // Reduced retries to prevent flooding
  RETRY_DELAY: 2000, // Increased delay between retries
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  // Identical reads with a payload within this window share one response, so the dashboard's widgets don't each
  // fetch getTickets (compliance F5). Short, so Refresh still gets fresh data
  READ_BURST_TTL: 10 * 1000,
  ENABLE_MOCK_DATA: apiConfig.mockMode
};

// Simple in-memory cache
class APICache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, data, ttl = CONFIG.CACHE_DURATION) {
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now() + ttl);
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() > timestamp) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }
}

const cache = new APICache();

// Reads in flight, by cache key: a second identical read waits for the first instead of sending again (F5)
const inFlightReads = new Map();
// Bumped by every write: a read that started before the write neither fills the cache nor is shared after it
// (review CR2-02 - an approval followed by a refetch showed the pre-approval list)
let cacheGeneration = 0;

/**
 * Firebase ID token of the signed-in user, for the proxy to verify (compliance F2). null when nobody is signed in
 * (development with DISABLE_AUTH): the backend then treats the call as unverified (AUTH_MODE warn logs it).
 */
async function getIdToken() {
  try {
    return auth && auth.currentUser ? await auth.currentUser.getIdToken() : null;
  } catch (error) {
    console.warn('Could not get the Firebase ID token:', error.message);
    return null;
  }
}

// Simple circuit breaker to prevent resource exhaustion
class CircuitBreaker {
  constructor() {
    this.failureCount = 0;
    this.failureThreshold = 5;
    this.timeout = 30000; // 30 seconds
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - too many failures');
      } else {
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      // v9.6: an auth refusal (401 / 403) is an answer, not an outage - it doesn't open the circuit
      if (!error.status || (error.status !== 401 && error.status !== 403)) this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

const circuitBreaker = new CircuitBreaker();

// v9.6: answers that mean "this sign-in can't continue". UserContext listens for the `jarvis-auth` window event,
// signs out and sends the user to /login with the matching notice. NOT_SIGNED_IN is left out: it is also what a
// request sent before Firebase restored the session gets.
export const AUTH_EVENT = 'jarvis-auth';
export const SIGN_OUT_CODES = ['NOT_INVITED', 'ACCOUNT_DISABLED', 'SESSION_MAX_AGE', 'SESSION_EXPIRED'];

/** An Error carrying the backend's code and the HTTP status (401 / 403 bodies are JSON with { code, error }). */
function apiError(message, code = null, status = null) {
  const error = new Error(message);
  if (code) error.code = code;
  if (status) error.status = status;
  return error;
}

/** A backend code: only strings count (a timeout's DOMException carries a numeric legacy code, e.g. 20). */
function backendCode(error) {
  return error && typeof error.code === 'string' ? error.code : null;
}

/** Tell the app about a code that ends the sign-in; message = the server's text (e.g. the cap's hours). */
function announceAuthCode(code, message = '') {
  if (!code || !SIGN_OUT_CODES.includes(code) || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { code, message } }));
  } catch (error) {
    console.warn('Could not announce the auth code:', error.message);
  }
}

// Request queue to limit concurrent API calls
class RequestQueue {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject
      });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

const requestQueue = new RequestQueue(2); // Limit to 2 concurrent requests

// Actions that already logged a [MOCK] fallback warning
const mockWarnedActions = new Set();

// HTTP Client with retry logic, circuit breaker, and request queue
class HTTPClient {
  static async request(url, options = {}) {
    return await requestQueue.add(async () => {
      return await circuitBreaker.execute(async () => {
      const config = {
        method: 'GET',
        timeout: CONFIG.TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      };

      // Debug logging moved to after URL construction

      let lastError;
      for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), config.timeout);

          const response = await fetch(url, {
            ...config,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            // v9.6: the proxy answers 401 / 403 with { code, error } - keep them, and don't retry (same answer again)
            if (response.status === 401 || response.status === 403) {
              let body = null;
              try {
                body = await response.json();
              } catch (parseError) {
                body = null;
              }
              throw apiError((body && body.error) || `HTTP ${response.status}: ${response.statusText}`,
                (body && body.code) || null, response.status);
            }
            throw apiError(`HTTP ${response.status}: ${response.statusText}`, null, response.status);
          }

          const data = await response.json();

          // Enhanced debug logging for response
          if (apiConfig.debugMode) {
            const timestamp = new Date().toISOString();
            console.log(`\n✅ [${timestamp}] API Response:`);
            console.log(`   Status: ${response.status} ${response.statusText}`);
            console.log(`   URL: ${url}`);
            console.log(`   Success: ${data.success || 'undefined'}`);

            if (data.data) {
              console.log(`   Data Count: ${Array.isArray(data.data) ? data.data.length : 'single item'}`);
              console.log(`   Data: ${JSON.stringify(data.data, null, 2)}`);
            }

            if (data.error) {
              console.log(`   Error: ${data.error}`);
            }
          }

          return data;
        } catch (error) {
          lastError = error;
          if (attempt < CONFIG.MAX_RETRIES && error.name !== 'AbortError' && error.status !== 401 && error.status !== 403) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
            continue;
          }
          throw error;
        }
      }

      throw lastError;
      });
    });
  }
}

// Base API class
class BaseAPI {
  constructor(entityName) {
    this.entityName = entityName;
  }

  getCacheKey(action, params = {}) {
    return `${this.entityName}_${action}_${JSON.stringify(params)}`;
  }

  async makeRequest(action, payload = null, useCache = true) {
    // POST bodies are flat ({ action, ...payload }): a payload key named `action` would replace the route
    // name - submitApproval's action: 'approve' did, so approvals never reached the backend (compliance A13)
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'action')) {
      throw new Error(`makeRequest('${action}'): the payload must not have an "action" key`);
    }

    const cacheKey = this.getCacheKey(action, payload);

    // Reads: a cached response, or the same read already in flight (F5). Before v9.4 only reads without a
    // payload were looked up, so every widget's getTickets({}) went to the backend
    if (useCache && action.startsWith('get')) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      if (inFlightReads.has(cacheKey)) return inFlightReads.get(cacheKey);
      const pending = this.sendRequest(action, payload, useCache, cacheKey)
        .finally(() => {
          if (inFlightReads.get(cacheKey) === pending) inFlightReads.delete(cacheKey);
        });
      inFlightReads.set(cacheKey, pending);
      return pending;
    }
    return this.sendRequest(action, payload, useCache, cacheKey);
  }

  /** Send one request (makeRequest handles the cache and in-flight reads). */
  async sendRequest(action, payload, useCache, cacheKey) {
    const generation = cacheGeneration;
    try {
      // Handle both absolute URLs (production) and relative paths (development)
      let url;
      let urlString;

      if (CONFIG.APPS_SCRIPT_URL.startsWith('http')) {
        // Absolute URL (production) - can use URL constructor
        url = new URL(CONFIG.APPS_SCRIPT_URL);
        urlString = CONFIG.APPS_SCRIPT_URL;
      } else {
        // Relative path (development) - use fetch directly without URL constructor
        urlString = CONFIG.APPS_SCRIPT_URL;
        url = null; // We'll build query params manually for relative URLs
      }

      // GET requests for read operations, POST for write operations
      // Must match the doGet routes - npm run check:api-contract checks it
      const readActions = [
        'ping', 'getCompanies', 'getTickets', 'getTicketTypes', 'getRoles',
        'getDropdownLists', 'getCustomFields', 'getWorkflowSteps', 'getSystemHealth',
        'getUserProfileTypes', 'getRoleTypes', // routed in doGet only - doPost has no case for them
        'getCompany', 'getDropdownOptions', 'getUserPreferences', // doGet only
        // AppScript v9.1 reads
        'getNextTicketNumber', 'getTicketType', 'getCustomField', 'getTicketLinks', 'validateTicketDependencies',
        'checkCompanyLockStatus', 'getCommentRequirements', 'getTicketHistory', 'getTicketsForApproval',
        // AppScript v9.2 reads
        'getStepConditions', 'getReportConfig', 'getReportData', 'getAdminActionLogs', 'getTicketActionLogs',
        // AppScript v9.3 reads
        'getDropdownCompanyAssignments', 'getCompanySLARules', 'getTags', 'getTicketTags', 'searchTicketsByTags',
        'getTicketShares', 'getSharedTickets',
        // AppScript v9.4 reads
        'getDashboard',
        // AppScript v9.5 reads (SLA escalation, notifications, holidays)
        'getSLAEscalationRules', 'getSLAEscalationEvents', 'testSLAEscalations', 'getNotifications',
        'getCompanyHolidays', 'getSLANotificationSettings',
        // AppScript v9.6 reads (invites, company email settings, ticket attachment links)
        'getUserInvites', 'getCompanyEmailSettings', 'getTicketAttachments',
        // AppScript v10.0 reads (ticket access)
        'getCreatableTicketTypes'
      ];

      const isGetRequest = readActions.includes(action);

      if (isGetRequest) {
        // GET request with query parameters
        if (url) {
          url.searchParams.set('action', action);
          // Add any payload as query params for GET requests
          if (payload && typeof payload === 'object') {
            Object.entries(payload).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
              }
            });
          }
          urlString = url.toString();
        } else {
          urlString += `?action=${encodeURIComponent(action)}`;
          // Add any payload as query params for relative URLs
          if (payload && typeof payload === 'object') {
            const queryParams = Object.entries(payload)
              .filter(([key, value]) => value !== undefined && value !== null)
              .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
              .join('&');
            if (queryParams) {
              urlString += `&${queryParams}`;
            }
          }
        }
      }

      // F2: identity goes in the Authorization header; the proxy verifies it (a body user_id is never proof)
      const idToken = await getIdToken();
      const headers = { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) };
      const options = isGetRequest
        ? { method: 'GET', headers }
        : {
            method: 'POST',
            headers,
            body: JSON.stringify({ action, ...(payload || {}) })
          };

      // Enhanced debug logging for development
      if (apiConfig.debugMode) {
        const timestamp = new Date().toISOString();
        console.log(`\n🔗 [${timestamp}] API Request Details:`);
        console.log(`   Action: ${action}`);
        console.log(`   Method: ${options.method}`);

        if (options.method === 'GET') {
          console.log(`   GET URL: ${urlString}`);
        } else if (options.method === 'POST' && options.body) {
          console.log(`   POST Body: ${options.body}`);
        }
      }

      const response = await HTTPClient.request(urlString, options);

      // AppScript v9.0+ sends success: false + status: 'error' for unknown actions and handler failures;
      // success: false alone (older deployments) is a failure too, not an empty result
      if (response.status === 'error' || response.success === false) {
        // v9.6: keep the backend's code (NOT_INVITED, ADMIN_ONLY, ...) for the caller and the auth listener
        throw apiError(response.error || 'API request failed', response.code || null);
      }

      // Cache successful reads: 5 minutes without a payload (lists like getCompanies), a short burst window with
      // one (getTickets({}), getTicket(id)) so Refresh stays fresh
      if (useCache && action.startsWith('get') && generation === cacheGeneration) {
        cache.set(cacheKey, response, payload ? CONFIG.READ_BURST_TTL : CONFIG.CACHE_DURATION);
      }

      // Any write clears the whole cache - not only this entity's keys: an approval (tickets) also changes
      // step_approvals, ticket history, the inbox... (review R-02, compliance F5)
      const isRead = isGetRequest || /^(get|can|check|validate)/.test(action);
      if (!isRead) {
        cacheGeneration++;
        cache.clear();
        inFlightReads.clear();
      }

      return response;
    } catch (error) {
      console.error(`API Error [${action}]:`, error);
      const code = backendCode(error);
      announceAuthCode(code, error.message);

      // Return mock data in development if API fails - say so once per action, so a broken route
      // doesn't hide behind mock data. Never for an auth refusal: that must reach the screen.
      if (CONFIG.ENABLE_MOCK_DATA && !code) {
        if (!mockWarnedActions.has(action)) {
          mockWarnedActions.add(action);
          console.warn(`[MOCK] ${action}: backend failed (${error.message}) - showing mock data`);
        }
        return this.getMockData(action, payload);
      }

      throw apiError(`Failed to ${action}: ${error.message}`, code, error.status || null);
    }
  }

  getMockData(action, payload) {
    console.warn(`Using mock data for ${this.entityName}.${action}`);
    return {
      status: 'success',
      data: null,
      timestamp: new Date().toISOString()
    };
  }
}

// Company API
class CompanyAPI extends BaseAPI {
  constructor() {
    super('companies');
  }

  async getAll() {
    const response = await this.makeRequest('getCompanies');
    return response.data || [];
  }

  async getById(id) {
    const response = await this.makeRequest('getCompany', { companyId: id });
    return response.data;
  }

  async create(data) {
    if (!data.name?.trim() || !data.code?.trim()) {
      throw new Error('Company name and code are required');
    }

    if (!ValidationUtils.isValidCompanyCode(data.code)) {
      throw new Error('Company code must be 2-8 uppercase letters or numbers');
    }

    const response = await this.makeRequest('createCompany', {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim()
    });
    return response.data;
  }

  async update(id, data) {
    const response = await this.makeRequest('updateCompany', {
      id,
      name: data.name?.trim(),
      code: data.code?.toUpperCase().trim()
    });
    return response.data;
  }

  async delete(id) {
    const response = await this.makeRequest('deleteCompany', { id });
    return response.data;
  }

  async lock(id, reason = 'admin_lock', userId = null) {
    const response = await this.makeRequest('lockCompany', { id, reason, user_id: userId });
    return response.data;
  }

  // Admin override (spec 3.3): the backend requires a reason and logs it with the previous lock
  async unlock(id, reason, userId = null) {
    if (!reason?.trim()) {
      throw new Error('A reason is required to unlock a company code');
    }
    const response = await this.makeRequest('unlockCompany', { id, reason: reason.trim(), user_id: userId });
    return response.data;
  }

  async checkLockStatus(id) {
    const response = await this.makeRequest('checkCompanyLockStatus', { id });
    return response.data;
  }

  getMockData(action) {
    const mockCompanies = [
      {
        id: '1',
        name: 'Main Office',
        code: 'MAIN',
        code_locked: true,
        code_locked_at: '2025-01-15T10:30:00.000Z',
        code_locked_reason: 'first_ticket_created',
        ticket_count: 25,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: '2',
        name: 'Production Division',
        code: 'PROD',
        code_locked: false,
        code_locked_at: null,
        code_locked_reason: null,
        ticket_count: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: '3',
        name: 'Sales Department',
        code: 'SALES',
        code_locked: true,
        code_locked_at: '2025-01-20T14:15:00.000Z',
        code_locked_reason: 'first_ticket_created',
        ticket_count: 8,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    switch (action) {
      case 'getCompanies':
        return { status: 'success', data: mockCompanies };
      case 'getCompany':
        return { status: 'success', data: mockCompanies[0] };
      case 'createCompany':
      case 'updateCompany':
        return { status: 'success', data: { ...mockCompanies[0], id: Date.now().toString() } };
      case 'deleteCompany':
        return { status: 'success', data: { deleted: true } };
      case 'lockCompany':
        return {
          status: 'success',
          data: {
            locked: true,
            locked_at: new Date().toISOString(),
            reason: 'first_ticket_created',
            message: 'Company code locked successfully'
          }
        };
      case 'unlockCompany':
        return {
          status: 'success',
          data: {
            unlocked: true,
            unlocked_at: new Date().toISOString(),
            reason: 'admin_override',
            message: 'Company code unlocked successfully'
          }
        };
      case 'checkCompanyLockStatus':
        return {
          status: 'success',
          data: {
            id: '1',
            code_locked: true,
            code_locked_at: '2025-01-15T10:30:00.000Z',
            code_locked_reason: 'first_ticket_created',
            ticket_count: 25
          }
        };
      default:
        return super.getMockData(action);
    }
  }
}

// Role API
class RoleAPI extends BaseAPI {
  constructor() {
    super('roles');
  }

  async getAll(companyId = null) {
    const response = await this.makeRequest('getRoles', companyId ? { companyId } : {});
    return response.data || [];
  }

  async create(data) {
    if (!data.name?.trim()) {
      throw new Error('Role name is required');
    }

    const response = await this.makeRequest('createRole', {
      name: data.name.trim(),
      company_id: data.company_id === 'global' ? null : data.company_id
    });
    return response.data;
  }

  async update(id, data) {
    const response = await this.makeRequest('updateRole', {
      id,
      name: data.name?.trim(),
      company_id: data.company_id === 'global' ? null : data.company_id
    });
    return response.data;
  }

  async delete(id) {
    const response = await this.makeRequest('deleteRole', { id });
    return response.data;
  }

  getMockData(action) {
    const mockRoles = [
      { id: '1', name: 'System Admin', company_id: null, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
      { id: '2', name: 'Company Admin', company_id: '1', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
      { id: '3', name: 'Manager', company_id: '1', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
      { id: '4', name: 'User', company_id: '1', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' }
    ];

    switch (action) {
      case 'getRoles':
        return { status: 'success', data: mockRoles };
      case 'createRole':
      case 'updateRole':
        return { status: 'success', data: { ...mockRoles[0], id: Date.now().toString() } };
      case 'deleteRole':
        return { status: 'success', data: { deleted: true } };
      default:
        return super.getMockData(action);
    }
  }
}

// Dropdown API
class DropdownAPI extends BaseAPI {
  constructor() {
    super('dropdowns');
  }

  async getLists(companyId = null) {
    const response = await this.makeRequest('getDropdownLists', {
      company_id: companyId
    });
    return response.data || [];
  }

  async getOptions(listId) {
    const response = await this.makeRequest('getDropdownOptions', { listId });
    return response.data || [];
  }

  async createList(data) {
    if (!data.name?.trim()) {
      throw new Error('Dropdown list name is required');
    }

    if (!data.options || data.options.length === 0) {
      throw new Error('At least one option is required');
    }

    const response = await this.makeRequest('createDropdownList', {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      company_id: data.company_id || null,
      options: data.options
    });
    return response.data;
  }

  async updateList(id, data) {
    const response = await this.makeRequest('updateDropdownList', {
      id,
      name: data.name?.trim(),
      description: data.description?.trim() || '',
      company_id: data.company_id || null,
      options: data.options
    });
    return response.data;
  }

  async deleteList(id) {
    const response = await this.makeRequest('deleteDropdownList', { id });
    return response.data;
  }

  // Company Assignment Methods
  async getCompanyAssignments(listId) {
    const response = await this.makeRequest('getDropdownCompanyAssignments', {
      dropdown_list_id: listId
    });
    return response.data || [];
  }

  async assignToCompany(listId, companyId) {
    const response = await this.makeRequest('assignDropdownToCompany', {
      dropdown_list_id: listId,
      company_id: companyId
    });
    return response.data;
  }

  async assignGlobally(listId) {
    const response = await this.makeRequest('assignDropdownGlobally', {
      dropdown_list_id: listId
    });
    return response.data;
  }

  async removeCompanyAssignment(listId, companyId) {
    const response = await this.makeRequest('removeDropdownCompanyAssignment', {
      dropdown_list_id: listId,
      company_id: companyId
    });
    return response.data;
  }

  async updateCompanyAssignments(listId, assignments) {
    const response = await this.makeRequest('updateDropdownCompanyAssignments', {
      dropdown_list_id: listId,
      assignments
    });
    return response.data;
  }

  getMockData(action) {
    const mockLists = [
      {
        id: '1',
        name: 'Priority Levels',
        company_id: '1',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        options: [
          { id: '1', label: 'Low', value: 'low', parent_option_id: '' },
          { id: '2', label: 'Medium', value: 'medium', parent_option_id: '' },
          { id: '3', label: 'High', value: 'high', parent_option_id: '' },
          { id: '4', label: 'Critical', value: 'critical', parent_option_id: '' }
        ]
      },
      {
        id: '2',
        name: 'Departments',
        company_id: '1',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        options: [
          { id: '5', label: 'IT', value: 'it', parent_option_id: '' },
          { id: '6', label: 'HR', value: 'hr', parent_option_id: '' },
          { id: '7', label: 'Finance', value: 'finance', parent_option_id: '' },
          { id: '8', label: 'Operations', value: 'operations', parent_option_id: '' }
        ]
      },
      {
        id: '3',
        name: 'Global Categories',
        company_id: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        options: [
          { id: '9', label: 'Software', value: 'software', parent_option_id: '' },
          { id: '10', label: 'Hardware', value: 'hardware', parent_option_id: '' },
          { id: '11', label: 'Service', value: 'service', parent_option_id: '' }
        ]
      }
    ];

    switch (action) {
      case 'getDropdownLists':
        // Filter by company_id if provided
        const { company_id } = arguments[1] || {};
        let filteredLists = mockLists;
        if (company_id !== undefined) {
          filteredLists = mockLists.filter(list =>
            company_id === null
              ? list.company_id === null
              : list.company_id === company_id || list.company_id === null
          );
        }
        return { status: 'success', data: filteredLists };
      case 'getDropdownOptions':
        return { status: 'success', data: mockLists[0].options };
      case 'createDropdownList':
      case 'updateDropdownList':
        return { status: 'success', data: { ...mockLists[0], id: Date.now().toString() } };
      case 'deleteDropdownList':
        return { status: 'success', data: { deleted: true } };
      default:
        return super.getMockData(action);
    }
  }
}

// Ticket API
class TicketAPI extends BaseAPI {
  constructor() {
    super('tickets');
  }

  // One page of tickets, newest first (AppScript v10.0 M3): { items, next_cursor, has_more }. filters go to the server:
  // status (one or a list, 'open' / 'closed' too), company_id, ticket_type_id, requester_id, mine, involved,
  // date_from, date_to, q (ticket number prefix or title words). Only the tickets the user may see come back.
  async getPage({ limit = 50, cursor = null, filters = {} } = {}) {
    const clean = Object.fromEntries(Object.entries(filters || {}).filter(([, v]) => v !== undefined && v !== null && v !== '' &&
      !(Array.isArray(v) && v.length === 0)));
    const response = await this.makeRequest('getTickets', {
      limit,
      ...(cursor ? { cursor } : {}),
      ...(Object.keys(clean).length ? { filters: JSON.stringify(clean) } : {})
    });
    const data = response.data;
    if (Array.isArray(data)) return { items: data, next_cursor: null, has_more: false }; // mock / older backend
    return { items: (data && data.items) || [], next_cursor: (data && data.next_cursor) || null, has_more: Boolean(data && data.has_more) };
  }

  // Every matching ticket as an array, read page by page (v10.0: getTickets is never called without a limit - its old
  // array answer goes away in v10.1). Capped at maxPages x 100 tickets; pass filters (e.g. { status: 'open' }) to keep
  // it small. Lists on screen should use getPage + "Load more" instead.
  async getAll(filters = {}, { maxPages = 10 } = {}) {
    const all = [];
    let cursor = null;
    let more = false;
    for (let page = 0; page < maxPages; page++) {
      const result = await this.getPage({ limit: 100, cursor, filters });
      all.push(...result.items);
      more = Boolean(result.has_more && result.next_cursor);
      if (!more) break;
      cursor = result.next_cursor;
    }
    // v10.0 review CR4-07: say so when the cap cut the list (callers can read all.truncated)
    all.truncated = more;
    if (more) console.warn(`Tickets.getAll stopped at ${all.length} tickets (${maxPages} pages) - narrow the filters`, filters);
    return all;
  }

  async getById(id) {
    const response = await this.makeRequest('getTicket', { ticketId: id });
    return response.data;
  }

  // v10.0 M4: an admin reads a Restricted ticket they are outside the chain of (logged with the reason; the ticket
  // type's admin access may refuse) -> { ticket, field_values, history }
  async reveal(ticketId, reason, userId = null) {
    const response = await this.makeRequest('revealConfidential', { ticket_id: ticketId, reason: reason || '', user_id: userId });
    return response.data;
  }

  // v10.0 M4: admin - make one ticket Restricted (every share removed) or not (shares are not restored); reason logged
  async setRestricted(ticketId, isConfidential, reason, userId = null) {
    const response = await this.makeRequest('setTicketRestricted', { ticket_id: ticketId, is_confidential: Boolean(isConfidential),
      reason: reason || '', user_id: userId });
    cache.invalidate('tickets');
    return response.data;
  }

  async create(data) {
    if (!data.title?.trim()) {
      throw new Error('Ticket title is required');
    }

    if (!data.ticket_type_id) {
      throw new Error('Ticket type is required');
    }

    if (!data.company_id) {
      throw new Error('Company ID is required');
    }

    if (!data.requester_id) {
      throw new Error('Requester ID is required');
    }

    const response = await this.makeRequest('createTicket', {
      title: data.title.trim(),
      description: data.description || '',
      ticket_type_id: data.ticket_type_id,
      company_id: data.company_id,
      requester_id: data.requester_id,
      priority: data.priority || 'medium',
      // custom field id -> value (AppScript createTicket writes them with setCustomFieldValue)
      customData: data.customData || data.custom_fields || {},
      // v10.0 M4: the requester's Restricted tick (types in 'optional' mode; the server decides off / always)
      ...(data.is_confidential ? { is_confidential: true } : {})
    });

    // Clear tickets cache since we added a new ticket
    cache.invalidate('tickets');

    return response.data;
  }

  /**
   * Get next ticket number preview for a company/ticket type combination
   * @param {string} companyId - Company ID
   * @param {string} ticketTypeId - Ticket type ID
   * @returns {Promise<string>} Next ticket number preview
   */
  async getNextTicketNumber(companyId, ticketTypeId) {
    const response = await this.makeRequest('getNextTicketNumber', {
      company_id: companyId,
      ticket_type_id: ticketTypeId
    });
    return response.data?.ticket_number || 'XXX-XXX-YYYY-XXXX';
  }

  /**
   * Generate and reserve a ticket number
   * @param {string} companyId - Company ID
   * @param {string} ticketTypeId - Ticket type ID
   * @returns {Promise<string>} Generated ticket number
   */
  async generateTicketNumber(companyId, ticketTypeId) {
    const response = await this.makeRequest('generateTicketNumber', {
      company_id: companyId,
      ticket_type_id: ticketTypeId
    });
    return response.data?.ticket_number;
  }

  async update(id, data) {
    const response = await this.makeRequest('updateTicket', {
      id,
      ...data
    });
    return response.data;
  }

  // Only 'Cancelled' and 'Reopened' are direct status changes; approvals go through StepApprovals.submitApproval
  async updateStatus(id, status, comment = '', userId = null) {
    const response = await this.makeRequest('updateTicketStatus', {
      id,
      status,
      comment: comment.trim(),
      user_id: userId
    });
    cache.invalidate('tickets');
    return response.data;
  }

  // ticket_history rows, newest first (AppScript v9.1)
  async getHistory(ticketId) {
    const response = await this.makeRequest('getTicketHistory', { ticket_id: ticketId });
    return response.data || [];
  }

  // Approver inbox: open tickets whose current step this user can approve now (AppScript v9.1)
  async getForApproval(userId) {
    const response = await this.makeRequest('getTicketsForApproval', { user_id: userId });
    return response.data || [];
  }

  // Dashboard data besides the ticket list, in one call (AppScript v9.4 getDashboard, compliance F5):
  // { companies, ticket_types, approval_inbox, counts }
  async getDashboard(userId) {
    const response = await this.makeRequest('getDashboard', { user_id: userId });
    return response.data || { companies: [], ticket_types: [], approval_inbox: [], counts: {} };
  }

  getMockData(action, params = {}) {
    // Handle getNextTicketNumber mock request
    if (action === 'getNextTicketNumber') {
      const companyId = params.company_id || '1';
      const ticketTypeId = params.ticket_type_id || 'purchase_request';

      // Mock company and ticket type lookup
      const mockCompanies = { '1': { code: 'ABC' }, '2': { code: 'XYZ' } };
      const mockTicketTypes = {
        'purchase_request': { code: 'PR' },
        'it_request': { code: 'IT' },
        'maintenance': { code: 'MNT' }
      };

      const company = mockCompanies[companyId] || { code: 'UNK' };
      const ticketType = mockTicketTypes[ticketTypeId] || { code: 'TKT' };
      const year = new Date().getFullYear();
      const nextSequence = Math.floor(Math.random() * 100) + 1; // Mock next sequence

      return {
        success: true,
        data: {
          ticket_number: `${company.code}-${ticketType.code}-${year}-${nextSequence.toString().padStart(4, '0')}`
        }
      };
    }

    const mockTickets = [
      {
        id: '1',
        ticket_number: 'ABC-PR-2025-0001',
        title: 'Purchase Request - Office Supplies',
        ticket_type_id: 'purchase_request',
        requester_id: 'user123',
        status: 'New',
        current_step_id: null,
        step_due_date: null,
        created_at: '2025-01-15T08:00:00.000Z',
        updated_at: '2025-01-15T08:00:00.000Z',
        company_id: '1',
        children: [],
        parent: null
      },
      {
        id: '2',
        ticket_number: 'ABC-IT-2025-0002',
        title: 'Software License Renewal',
        ticket_type_id: 'it_request',
        requester_id: 'user456',
        status: 'In Progress',
        current_step_id: 'step1',
        step_due_date: '2025-01-20T17:00:00.000Z',
        created_at: '2025-01-14T10:30:00.000Z',
        updated_at: '2025-01-15T09:15:00.000Z',
        company_id: '1',
        children: [],
        parent: null
      }
    ];

    switch (action) {
      case 'getTickets':
        return { status: 'success', data: mockTickets };
      case 'getTicket':
        return { status: 'success', data: mockTickets[0] };
      case 'createTicket':
        return {
          status: 'success',
          data: {
            ...mockTickets[0],
            id: Date.now().toString(),
            ticket_number: `MAIN-PR-2025-${String(Date.now()).slice(-8)}`
          }
        };
      case 'updateTicket':
      case 'updateTicketStatus':
        return { status: 'success', data: mockTickets[0] };
      default:
        return super.getMockData(action);
    }
  }
}

// User API
class UserAPI extends BaseAPI {
  constructor() {
    super('users');
  }

  async getProfile(userId) {
    const response = await this.makeRequest('getUserProfile', { userId });
    return response.data;
  }

  async updateProfile(userId, data) {
    const response = await this.makeRequest('updateUserProfile', {
      userId,
      ...data
    });
    return response.data;
  }

  async getRoles(userId) {
    const response = await this.makeRequest('getUserRoles', { userId });
    return response.data || [];
  }

  // assignmentData (optional): ticket_type_id, assignment_type, effective_start_date, effective_end_date,
  // auto_expire_days, approval_required, assignment_notes
  async assignRole(userId, roleId, companyId = null, assignmentData = {}) {
    const response = await this.makeRequest('assignUserRole', {
      ...assignmentData,
      userId,
      roleId,
      companyId
    });
    return response.data;
  }

  // Soft-deletes one assignment (removeRole removes every assignment of the role in the company)
  async deleteRoleAssignment(assignmentId, reason = 'Removed by admin') {
    const response = await this.makeRequest('deleteUserRoleAssignment', {
      assignment_id: assignmentId,
      reason
    });
    return response.data;
  }

  async updateRoleAssignment(assignmentId, changes) {
    const response = await this.makeRequest('updateUserRoleAssignment', {
      ...changes,
      assignment_id: assignmentId
    });
    return response.data;
  }

  async getExpiringAssignments(daysAhead = 30) {
    const response = await this.makeRequest('getExpiringAssignments', { days_ahead: daysAhead });
    return response.data || [];
  }

  // { general_role: 'maker' | 'approver' | 'both' | 'viewer', approver_role_ids, other_role_ids }
  async getGeneralRole(userId, companyId = null) {
    const response = await this.makeRequest('getUserGeneralRole', { userId, company_id: companyId });
    return response.data || null;
  }

  async removeRole(userId, roleId, companyId = null) {
    const response = await this.makeRequest('removeUserRole', {
      userId,
      roleId,
      companyId
    });
    return response.data;
  }

  // Bulk role assignment method for the dialog
  async assignRoleBulk(assignmentData) {
    const response = await this.makeRequest('bulkAssignRole', {
      user_email: assignmentData.user_email,
      company_id: assignmentData.company_id,
      ticket_type_id: assignmentData.ticket_type_id,
      role_id: assignmentData.role_id,
      validity_end_date: assignmentData.validity_end_date,
      notify_user: assignmentData.notify_user,
      create_audit_log: assignmentData.create_audit_log
    });
    return response.data;
  }

  async replaceUserRoles(assignmentData) {
    const response = await this.makeRequest('replaceUserRoles', {
      user_email: assignmentData.user_email,
      company_id: assignmentData.company_id,
      ticket_type_id: assignmentData.ticket_type_id,
      role_id: assignmentData.role_id,
      validity_end_date: assignmentData.validity_end_date,
      notify_user: assignmentData.notify_user,
      create_audit_log: assignmentData.create_audit_log
    });
    return response.data;
  }

  async getPreferences(userId) {
    const response = await this.makeRequest('getUserPreferences', {
      user_id: userId
    });
    return response.data || {};
  }

  async updatePreferences(userId, preferences) {
    const response = await this.makeRequest('updateUserPreferences', {
      user_id: userId,
      preferences: preferences
    });
    cache.invalidate('user_preferences');
    return response.data;
  }

  async getAll() {
    const response = await this.makeRequest('getUsers');
    return response.data || [];
  }

  getMockData(action) {
    const mockUser = {
      id: 'user123',
      email: 'admin@example.com',
      displayName: 'System Administrator',
      photoURL: '',
      roles: [
        { id: '1', name: 'System Admin', company_id: null, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' }
      ],
      companies: [
        { id: '1', name: 'Main Office', code: 'MAIN', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' }
      ]
    };

    switch (action) {
      case 'getUserProfile':
        return { status: 'success', data: mockUser };
      case 'updateUserProfile':
        return { status: 'success', data: mockUser };
      case 'getUserRoles':
        return { status: 'success', data: mockUser.roles };
      case 'assignUserRole':
      case 'removeUserRole':
        return { status: 'success', data: { success: true } };
      case 'bulkAssignRole':
        return {
          success: true,
          message: 'Role assigned successfully',
          data: {
            assignment_id: `assign_${Date.now()}`,
            user_email: 'user@example.com',
            role_assigned: true,
            notification_sent: true,
            audit_log_created: true,
            timestamp: new Date().toISOString()
          }
        };
      case 'replaceUserRoles':
        return {
          success: true,
          message: 'User roles replaced successfully',
          data: {
            replacement_id: `replace_${Date.now()}`,
            user_email: 'user@example.com',
            roles_replaced: 3,
            new_roles_assigned: 2,
            notification_sent: true,
            audit_log_created: true,
            timestamp: new Date().toISOString()
          }
        };
      case 'getUserPreferences':
        return {
          success: true,
          data: {
            dark_mode: false,
            timezone: 'Asia/Manila',
            language: 'en',
            email_notifications: true,
            desktop_notifications: true,
            dashboard_layout: 'grid',
            items_per_page: 20,
            auto_refresh: true,
            refresh_interval: 30000,
            updated_at: '2025-01-15T10:30:00.000Z'
          }
        };
      case 'updateUserPreferences':
        return {
          success: true,
          message: 'User preferences updated successfully',
          data: {
            user_id: 'user123',
            updated_at: new Date().toISOString(),
            preferences_updated: Object.keys(arguments[1] || {}).length
          }
        };
      case 'getUsers':
        return {
          success: true,
          data: [
            {
              id: 'user123',
              email: 'admin@example.com',
              displayName: 'System Administrator',
              roles: ['Admin'],
              companies: ['Main Office'],
              created_at: '2025-01-01T00:00:00.000Z'
            },
            {
              id: 'user456',
              email: 'user@example.com',
              displayName: 'Regular User',
              roles: ['User'],
              companies: ['Main Office'],
              created_at: '2025-01-02T00:00:00.000Z'
            }
          ]
        };
      default:
        return super.getMockData(action);
    }
  }
}

// System API
class SystemAPI extends BaseAPI {
  constructor() {
    super('system');
  }

  async ping() {
    const response = await this.makeRequest('ping');
    return response;
  }

  async recordLogin(userData) {
    const response = await this.makeRequest('recordLogin', {
      userId: userData.id,
      email: userData.email,
      ipAddress: userData.ipAddress || 'unknown'
    });
    return response.data;
  }

  async getSystemHealth() {
    const response = await this.makeRequest('getSystemHealth');
    return response.data;
  }

  // Health check of every table against TABLE_SCHEMAS (read-only getSystemHealth). AppScript's
  // runCompleteAPITest creates and deletes real rows, so it stays an editor-only function (compliance A4).
  async runTest() {
    const health = await this.getSystemHealth();
    const tables = health?.tables || {};
    const total = (tables.ok || 0) + (tables.missing || 0) + (tables.schema_differs || 0) + (tables.errors || 0);
    return {
      passed: tables.ok || 0,
      failed: total - (tables.ok || 0),
      total,
      details: (health?.issues || []).length
        ? health.issues.join('; ')
        : `All tables match the schema (API ${health?.api_version || 'unknown'})`
    };
  }

  // Admins only (AppScript v9.3 checks user_id). Read-only; sent by POST because ticket_type_ids is a list.
  async exportConfiguration(params) {
    const response = await this.makeRequest('exportConfiguration', {
      user_id: params.user_id,
      company_id: params.company_id,
      ticket_type_ids: params.ticket_type_ids,
      include_workflows: params.include_workflows,
      include_custom_fields: params.include_custom_fields,
      include_sla_rules: params.include_sla_rules,
      include_roles: params.include_roles,
      include_dropdowns: params.include_dropdowns
    });
    return response;
  }

  // Company-to-company copy; dry_run (default true) only reports the planned actions
  // -> { dry_run, actions: [{ area, ticket_type_id, action, detail }], counts }
  async importConfiguration(params) {
    const response = await this.makeRequest('importConfiguration', {
      user_id: params.user_id,
      dry_run: params.dry_run !== false,
      source_company_id: params.source_company_id,
      target_company_id: params.target_company_id,
      ticket_type_ids: params.ticket_type_ids,
      include_workflows: params.include_workflows,
      include_custom_fields: params.include_custom_fields,
      include_sla_rules: params.include_sla_rules,
      include_roles: params.include_roles,
      include_dropdowns: params.include_dropdowns,
      overwrite_existing: params.overwrite_existing
    });
    cache.invalidate('workflow_steps');
    cache.invalidate('custom_fields');
    cache.invalidate('roles');
    cache.invalidate('dropdown_lists');
    return response;
  }

  // Saves the company's export as a JSON file in the script owner's Drive -> { file_id, url, name, size }
  async createConfigurationBackup(params) {
    const response = await this.makeRequest('createConfigurationBackup', {
      user_id: params.user_id,
      company_id: params.company_id,
      backup_name: params.backup_name
    });
    return response;
  }

  getMockData(action) {
    switch (action) {
      case 'ping':
        return {
          status: 'success',
          data: { message: 'API is healthy', timestamp: new Date().toISOString() }
        };
      case 'recordLogin':
        return {
          status: 'success',
          data: { recorded: true, timestamp: new Date().toISOString() }
        };
      case 'getSystemHealth':
        return {
          status: 'success',
          data: {
            status: 'healthy',
            uptime: '99.9%',
            lastCheck: new Date().toISOString()
          }
        };
      case 'exportConfiguration':
        return {
          success: true,
          message: 'Configuration exported successfully',
          data: {
            export_id: `export_${Date.now()}`,
            company_id: '1',
            timestamp: new Date().toISOString(),
            workflows: [
              { id: 'step_1', name: 'Manager Approval', step_type: 'approval' },
              { id: 'step_2', name: 'Finance Review', step_type: 'approval' }
            ],
            custom_fields: [
              { id: 'field_1', name: 'item_description', type: 'paragraph' },
              { id: 'field_2', name: 'estimated_cost', type: 'amount' }
            ],
            sla_rules: [
              { step_id: 'step_1', duration: 24, unit: 'hours' },
              { step_id: 'step_2', duration: 48, unit: 'hours' }
            ],
            roles: [
              { id: 'role_1', name: 'Manager', permissions: ['approve', 'view'] },
              { id: 'role_2', name: 'Finance', permissions: ['approve', 'edit'] }
            ],
            dropdowns: [
              { id: 'dropdown_1', name: 'Vendor Categories', options: ['IT', 'Office', 'Facilities'] }
            ]
          }
        };
      case 'importConfiguration':
        return {
          success: true,
          message: 'Configuration imported successfully',
          data: {
            import_id: `import_${Date.now()}`,
            source_company_id: '1',
            target_company_id: '2',
            imported_items: {
              workflows: 2,
              custom_fields: 2,
              sla_rules: 2,
              roles: 2,
              dropdowns: 1
            },
            conflicts_resolved: 0,
            backup_created: true,
            timestamp: new Date().toISOString()
          }
        };
      case 'createConfigurationBackup':
        return {
          success: true,
          message: 'Configuration backup created successfully',
          data: {
            backup_id: `backup_${Date.now()}`,
            company_id: '2',
            backup_name: `pre-import-${new Date().toISOString().split('T')[0]}`,
            created_at: new Date().toISOString(),
            size_kb: 45.7
          }
        };
      default:
        return super.getMockData(action);
    }
  }
}

// Workflow Steps API
class WorkflowStepsAPI extends BaseAPI {
  constructor() {
    super('workflow_steps');
  }

  async getByTicketType(ticketTypeId, companyId = null) {
    const response = await this.makeRequest('getWorkflowSteps', {
      ticket_type_id: ticketTypeId,
      company_id: companyId
    });
    return response.data || [];
  }

  async getById(stepId) {
    const response = await this.makeRequest('getWorkflowStep', {
      step_id: stepId
    });
    return response.data;
  }

  // Conditional routing (AppScript v9.2): { step_id, enabled, routes: [{ conditions, target_step_id, is_default }] }
  async getConditions(stepId) {
    const response = await this.makeRequest('getStepConditions', { step_id: stepId });
    return response.data || { step_id: stepId, enabled: false, routes: [] };
  }

  // Replaces the step's routes; enabled false clears them. target_step_id '__end__' ends the workflow.
  async saveConditions(stepId, routes, enabled = true, userId = null) {
    const response = await this.makeRequest('saveStepConditions', {
      step_id: stepId,
      enabled,
      routes,
      user_id: userId
    });
    cache.invalidate('workflow_steps');
    return response.data;
  }

  async create(data) {
    if (!data.ticket_type_id) {
      throw new Error('Ticket type ID is required');
    }

    if (!data.company_id) {
      throw new Error('Company ID is required');
    }

    if (!data.name?.trim()) {
      throw new Error('Step name is required');
    }

    if (!data.step_type) {
      throw new Error('Step type is required');
    }

    const response = await this.makeRequest('createWorkflowStep', {
      ticket_type_id: data.ticket_type_id,
      company_id: data.company_id,
      name: data.name.trim(),
      status_on_reach: data.status_on_reach || 'in_progress',
      step_type: data.step_type,
      approver_logic: data.approver_logic || 'any',
      sort_order: data.sort_order || 1,
      next_ticket_type_id: data.next_ticket_type_id || null,
      external_app_url: data.external_app_url || null,
      completion_action_name: data.completion_action_name || null,
      sla_duration: data.sla_duration || null,
      sla_unit: data.sla_unit || null,
      exclude_weekends: data.exclude_weekends || false
    });

    cache.invalidate('workflow_steps');
    return response.data;
  }

  async update(stepId, data) {
    const response = await this.makeRequest('updateWorkflowStep', {
      step_id: stepId,
      ...data
    });

    cache.invalidate('workflow_steps');
    return response.data;
  }

  async delete(stepId) {
    const response = await this.makeRequest('deleteWorkflowStep', {
      step_id: stepId
    });

    cache.invalidate('workflow_steps');
    return response.data;
  }

  async getStepApprovers(stepId) {
    const response = await this.makeRequest('getStepApprovers', {
      step_id: stepId
    });
    return response.data || [];
  }

  async setStepApprovers(stepId, roleIds) {
    const response = await this.makeRequest('setStepApprovers', {
      step_id: stepId,
      role_ids: roleIds
    });

    cache.invalidate('step_approvers');
    return response.data;
  }

  // Copy workflow steps from one company to another
  async copyFromCompany(ticketTypeId, sourceCompanyId, targetCompanyId) {
    if (!ticketTypeId || !sourceCompanyId || !targetCompanyId) {
      throw new Error('Ticket type ID, source company ID, and target company ID are required');
    }

    const response = await this.makeRequest('copyWorkflowSteps', {
      ticket_type_id: ticketTypeId,
      source_company_id: sourceCompanyId,
      target_company_id: targetCompanyId
    });
    cache.invalidate('workflow_steps');
    return response.data;
  }

  // Create default workflow steps for a company
  async createDefaultForCompany(ticketTypeId, companyId) {
    if (!ticketTypeId || !companyId) {
      throw new Error('Ticket type ID and company ID are required');
    }

    const response = await this.makeRequest('createDefaultWorkflow', {
      ticket_type_id: ticketTypeId,
      company_id: companyId
    });
    cache.invalidate('workflow_steps');
    return response.data;
  }

  // Get workflows by company and ticket type
  async getByCompany(ticketTypeId, companyId) {
    return this.getByTicketType(ticketTypeId, companyId);
  }

  getMockData(action, params = {}) {
    if (action === 'getWorkflowSteps') {
      const ticketTypeId = params.ticket_type_id;

      const mockSteps = {
        'purchase_request': [
          {
            id: 'step_pr_1',
            ticket_type_id: 'purchase_request',
            company_id: '1',
            name: 'Manager Approval',
            status_on_reach: 'pending_approval',
            step_type: 'approval',
            approver_logic: 'any',
            sort_order: 1,
            sla_duration: 24,
            sla_unit: 'hours',
            exclude_weekends: false
          },
          {
            id: 'step_pr_2',
            ticket_type_id: 'purchase_request',
            company_id: '1',
            name: 'Finance Review',
            status_on_reach: 'pending_finance',
            step_type: 'approval',
            approver_logic: 'all',
            sort_order: 2,
            sla_duration: 48,
            sla_unit: 'hours',
            exclude_weekends: true
          },
          {
            id: 'step_pr_3',
            ticket_type_id: 'purchase_request',
            name: 'Procurement Processing',
            status_on_reach: 'in_procurement',
            step_type: 'task',
            sort_order: 3,
            external_app_url: 'https://procurement.company.com/process/{ticket_id}',
            completion_action_name: 'Mark Procurement Complete'
          }
        ],
        'it_request': [
          {
            id: 'step_it_1',
            ticket_type_id: 'it_request',
            company_id: '1',
            name: 'IT Manager Review',
            status_on_reach: 'pending_it_approval',
            step_type: 'approval',
            approver_logic: 'any',
            sort_order: 1,
            sla_duration: 4,
            sla_unit: 'hours',
            exclude_weekends: false
          },
          {
            id: 'step_it_2',
            ticket_type_id: 'it_request',
            company_id: '1',
            name: 'Implementation',
            status_on_reach: 'in_implementation',
            step_type: 'task',
            sort_order: 2,
            external_app_url: 'https://ticketing.company.com/implement/{ticket_id}',
            completion_action_name: 'Mark Implementation Complete'
          }
        ]
      };

      // Filter by company_id if provided
      let steps = mockSteps[ticketTypeId] || [];
      const { company_id } = params;

      if (company_id !== undefined) {
        steps = steps.filter(step =>
          company_id === null
            ? step.company_id === null
            : step.company_id === company_id
        );
      }

      return {
        success: true,
        data: steps
      };
    }

    if (action === 'copyWorkflowSteps') {
      return {
        success: true,
        data: {
          copied: true,
          source_company_id: params.source_company_id,
          target_company_id: params.target_company_id,
          ticket_type_id: params.ticket_type_id,
          steps_copied: 2
        }
      };
    }

    if (action === 'createDefaultWorkflow') {
      return {
        success: true,
        message: 'Default workflow created successfully',
        data: {
          created_steps: 2,
          ticket_type_id: params.ticket_type_id,
          company_id: params.company_id,
          steps: [
            {
              id: `step_${params.ticket_type_id}_${params.company_id}_1`,
              name: 'Initial Review',
              step_type: 'approval',
              sort_order: 1
            },
            {
              id: `step_${params.ticket_type_id}_${params.company_id}_2`,
              name: 'Final Approval',
              step_type: 'approval',
              sort_order: 2
            }
          ]
        }
      };
    }

    if (action === 'getStepApprovers') {
      return {
        success: true,
        data: [
          { id: 'role_manager', name: 'Manager' },
          { id: 'role_finance', name: 'Finance Team' }
        ]
      };
    }

    return super.getMockData(action, params);
  }
}

// Custom Fields API
class CustomFieldsAPI extends BaseAPI {
  constructor() {
    super('custom_fields');
  }

  async getAll() {
    const response = await this.makeRequest('getCustomFields');
    return response.data || [];
  }

  async getByTicketType(ticketTypeId) {
    const response = await this.makeRequest('getCustomFields', {
      ticket_type_id: ticketTypeId
    });
    return response.data || [];
  }

  // Universal Entity Architecture support
  async getByEntity(entityTypeId, entityCategory = 'ticket') {
    const response = await this.makeRequest('getCustomFields', {
      entityTypeId: entityTypeId,
      entityCategory: entityCategory
    });
    return response.data || [];
  }

  async getById(id) {
    const response = await this.makeRequest('getCustomField', {
      field_id: id
    });
    return response.data;
  }

  async create(data) {
    // Universal Entity Architecture: Support both old (ticket_type_id) and new (entityTypeId + entityCategory) formats
    const entityTypeId = data.entityTypeId || data.ticket_type_id;
    const entityCategory = data.entityCategory || 'ticket';

    if (!entityTypeId) {
      throw new Error(`${entityCategory === 'ticket' ? 'Ticket type' : 'Entity type'} ID is required`);
    }

    if (!data.name?.trim()) {
      throw new Error('Field name is required');
    }

    if (!data.label?.trim()) {
      throw new Error('Field label is required');
    }

    if (!data.type) {
      throw new Error('Field type is required');
    }

    const response = await this.makeRequest('createCustomField', {
      entityTypeId: entityTypeId,
      entityCategory: entityCategory,
      // Keep backward compatibility
      ticket_type_id: entityCategory === 'ticket' ? entityTypeId : null,
      name: data.name.trim(),
      label: data.label.trim(),
      type: data.type,
      is_required: data.is_required || false,
      is_hidden: data.is_hidden || false,
      sort_order: data.sort_order || 1,
      dropdown_list_id: data.dropdown_list_id || null,
      depends_on_field_id: data.depends_on_field_id || null,
      // v10.0 M4: Restricted ticket field - its value is shown only to the ticket's approval chain
      is_confidential: entityCategory === 'ticket' && Boolean(data.is_confidential)
    });
    return response.data;
  }

  async update(id, data) {
    if (!id) {
      throw new Error('Field ID is required');
    }

    const response = await this.makeRequest('updateCustomField', {
      field_id: id,
      ...data
    });
    return response.data;
  }

  async delete(id) {
    if (!id) {
      throw new Error('Field ID is required');
    }

    const response = await this.makeRequest('deleteCustomField', {
      field_id: id
    });
    return response.data;
  }

  getMockData(action, params = {}) {
    const mockCustomFields = [
      {
        id: '1',
        ticket_type_id: 'tt_1',
        name: 'item_description',
        label: 'Item Description',
        type: 'paragraph',
        is_required: true,
        is_hidden: false,
        sort_order: 1,
        dropdown_list_id: null,
        depends_on_field_id: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: '2',
        ticket_type_id: 'tt_1',
        name: 'estimated_cost',
        label: 'Estimated Cost',
        type: 'amount',
        is_required: true,
        is_hidden: false,
        sort_order: 2,
        dropdown_list_id: null,
        depends_on_field_id: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: '3',
        ticket_type_id: 'tt_1',
        name: 'vendor_category',
        label: 'Vendor Category',
        type: 'dropdown',
        is_required: false,
        is_hidden: false,
        sort_order: 3,
        dropdown_list_id: '1',
        depends_on_field_id: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    switch (action) {
      case 'getCustomFields':
        if (params.ticket_type_id) {
          return {
            status: 'success',
            data: mockCustomFields.filter(f => f.ticket_type_id === params.ticket_type_id)
          };
        }
        return { status: 'success', data: mockCustomFields };
      case 'getCustomField':
        const field = mockCustomFields.find(f => f.id === params.field_id);
        return { status: 'success', data: field };
      case 'createCustomField':
      case 'updateCustomField':
        return {
          status: 'success',
          data: {
            ...mockCustomFields[0],
            id: Date.now().toString(),
            ...params
          }
        };
      case 'deleteCustomField':
        return { status: 'success', data: { deleted: true } };
      default:
        return super.getMockData(action, params);
    }
  }
}

/**
 * Unwrap a Phase 10.0 AppScript handler result.
 * Those handlers return { status, data, message }, and doGet / createHandlerResponse wrap that again
 * in { success, data }, so response.data is the handler result rather than the records.
 * Mock data has no outer wrapper (response.data is already the records), so it passes through.
 * @param {Object} response - makeRequest() response
 * @returns {*} The records / record, or undefined when the handler returned none
 */
/**
 * is_active as a boolean: Sheets can return 'FALSE' (a truthy string) for a deactivated row, and a blank
 * cell counts as active (same rule as AppScript isActiveFlag).
 * @param {Object} record - Record from the backend
 * @returns {Object} The record with a boolean is_active
 */
const normalizeIsActive = (record) => (record && typeof record === 'object'
  ? { ...record, is_active: !(record.is_active === false || String(record.is_active).trim().toUpperCase() === 'FALSE') }
  : record);

const unwrapHandlerResult = (response) => {
  const result = response?.data;
  const isHandlerResult = result && !Array.isArray(result) && typeof result.status === 'string'
    && ('data' in result || 'message' in result);

  if (!isHandlerResult) return result;
  if (result.status === 'error') {
    // doGet reports handler failures as success: true, so makeRequest() doesn't throw for them
    throw new Error(result.message || 'Request failed');
  }
  return result.data;
};

// User Profile Types API - Universal Entity Architecture
class UserProfileTypesAPI extends BaseAPI {
  constructor() {
    super('user_profile_types');
  }

  // includeInactive: the admin list shows deactivated types too (AppScript v9.0+ include_inactive)
  async getAll(companyId = null, includeInactive = false) {
    const params = {};
    if (companyId) params.company_id = companyId;
    if (includeInactive) params.include_inactive = true;
    const response = await this.makeRequest('getUserProfileTypes', params);
    return (unwrapHandlerResult(response) || []).map(normalizeIsActive);
  }

  // AppScript has no single-record route, so look the record up in the list (inactive included, so they can be edited)
  async getById(id) {
    const userProfileTypes = await this.getAll(null, true);
    return userProfileTypes.find(upt => upt.id === id) || null;
  }

  async create(data) {
    if (!data.name?.trim()) {
      throw new Error('User profile type name is required');
    }

    const response = await this.makeRequest('createUserProfileType', {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      code: data.code?.trim() || '',
      company_id: data.company_id || null,
      is_active: data.is_active === undefined ? true : Boolean(data.is_active)
    });
    return unwrapHandlerResult(response);
  }

  async update(id, data) {
    if (!id) {
      throw new Error('User profile type ID is required');
    }

    const response = await this.makeRequest('updateUserProfileType', {
      user_profile_type_id: id,
      name: data.name?.trim(),
      description: data.description?.trim(),
      code: data.code?.trim(),
      company_id: data.company_id,
      is_active: data.is_active
    });
    return unwrapHandlerResult(response);
  }

  async delete(id) {
    if (!id) {
      throw new Error('User profile type ID is required');
    }

    const response = await this.makeRequest('deleteUserProfileType', {
      user_profile_type_id: id
    });
    return unwrapHandlerResult(response);
  }

  getMockData(action, params = {}) {
    const mockUserProfileTypes = [
      {
        id: 'upt_1',
        name: 'Employee',
        description: 'Regular full-time employee',
        code: 'EMP',
        company_id: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'upt_2',
        name: 'Contractor',
        description: 'External contractor or consultant',
        code: 'CTR',
        company_id: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'upt_3',
        name: 'Manager',
        description: 'Department or team manager',
        code: 'MGR',
        company_id: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    switch (action) {
      case 'getUserProfileTypes':
        return { status: 'success', data: mockUserProfileTypes };
      case 'createUserProfileType':
      case 'updateUserProfileType':
        return {
          status: 'success',
          data: {
            ...mockUserProfileTypes[0],
            id: `upt_${Date.now()}`,
            ...params
          }
        };
      case 'deleteUserProfileType':
        return { status: 'success', data: { deleted: true } };
      default:
        return super.getMockData(action, params);
    }
  }
}

// Role Types API - Universal Entity Architecture
class RoleTypesAPI extends BaseAPI {
  constructor() {
    super('role_types');
  }

  // includeInactive: the admin list shows deactivated types too (AppScript v9.0+ include_inactive)
  async getAll(companyId = null, includeInactive = false) {
    const params = {};
    if (companyId) params.company_id = companyId;
    if (includeInactive) params.include_inactive = true;
    const response = await this.makeRequest('getRoleTypes', params);
    return (unwrapHandlerResult(response) || []).map(normalizeIsActive);
  }

  // AppScript has no single-record route, so look the record up in the list (inactive included, so they can be edited)
  async getById(id) {
    const roleTypes = await this.getAll(null, true);
    return roleTypes.find(rt => rt.id === id) || null;
  }

  async create(data) {
    if (!data.name?.trim()) {
      throw new Error('Role type name is required');
    }

    const response = await this.makeRequest('createRoleType', {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      code: data.code?.trim() || '',
      company_id: data.company_id || null,
      is_active: data.is_active === undefined ? true : Boolean(data.is_active)
    });
    return unwrapHandlerResult(response);
  }

  async update(id, data) {
    if (!id) {
      throw new Error('Role type ID is required');
    }

    const response = await this.makeRequest('updateRoleType', {
      role_type_id: id,
      name: data.name?.trim(),
      description: data.description?.trim(),
      code: data.code?.trim(),
      company_id: data.company_id,
      is_active: data.is_active
    });
    return unwrapHandlerResult(response);
  }

  async delete(id) {
    if (!id) {
      throw new Error('Role type ID is required');
    }

    const response = await this.makeRequest('deleteRoleType', {
      role_type_id: id
    });
    return unwrapHandlerResult(response);
  }

  getMockData(action, params = {}) {
    const mockRoleTypes = [
      {
        id: 'rt_1',
        name: 'Approver',
        description: 'Can approve tickets and requests',
        code: 'APR',
        company_id: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'rt_2',
        name: 'Administrator',
        description: 'System administrator with full access',
        code: 'ADM',
        company_id: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'rt_3',
        name: 'Viewer',
        description: 'Read-only access to tickets and data',
        code: 'VWR',
        company_id: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    switch (action) {
      case 'getRoleTypes':
        return { status: 'success', data: mockRoleTypes };
      case 'createRoleType':
      case 'updateRoleType':
        return {
          status: 'success',
          data: {
            ...mockRoleTypes[0],
            id: `rt_${Date.now()}`,
            ...params
          }
        };
      case 'deleteRoleType':
        return { status: 'success', data: { deleted: true } };
      default:
        return super.getMockData(action, params);
    }
  }
}

// Ticket Types API
class TicketTypesAPI extends BaseAPI {
  constructor() {
    super('ticket_types');
  }

  async getAll(companyId = null) {
    const response = await this.makeRequest('getTicketTypes', {
      company_id: companyId
    });
    return response.data || [];
  }

  async getById(id) {
    const response = await this.makeRequest('getTicketType', {
      ticket_type_id: id
    });
    return response.data;
  }

  // The ticket types the signed-in user may create (AppScript v10.0: a role on the type + company is needed - the
  // server decides). Each carries creatable_company_ids. companyId narrows the list to one company.
  async getCreatable(companyId = null) {
    const response = await this.makeRequest('getCreatableTicketTypes', {
      company_id: companyId
    });
    return response.data || [];
  }

  async create(data) {
    if (!data.transaction_id?.trim()) {
      throw new Error('Transaction ID is required');
    }

    if (!data.code?.trim()) {
      throw new Error('Code is required');
    }

    if (!data.name?.trim()) {
      throw new Error('Name is required');
    }

    // Check for duplicate names (case-insensitive)
    await this.validateNameUniqueness(data.name.trim());

    const response = await this.makeRequest('createTicketType', {
      transaction_id: data.transaction_id.trim(),
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      description: data.description || '',
      is_active: data.is_active !== false,
      require_attachment_on_create: data.require_attachment_on_create || false,
      company_id: data.company_id || null
    });
    return response.data;
  }

  async update(id, data) {
    if (!id) {
      throw new Error('Ticket type ID is required');
    }

    // Check for duplicate names if name is being updated (case-insensitive)
    if (data.name?.trim()) {
      await this.validateNameUniqueness(data.name.trim(), id);
    }

    const response = await this.makeRequest('updateTicketType', {
      ticket_type_id: id,
      ...data
    });
    return response.data;
  }

  async delete(id) {
    if (!id) {
      throw new Error('Ticket type ID is required');
    }

    const response = await this.makeRequest('deleteTicketType', {
      ticket_type_id: id
    });
    return response.data;
  }

  // Which actions need a comment: { source: 'company' | 'global' | 'none', require_on_approve, require_on_return,
  // require_on_reject, require_on_cancel } - a company's row wins over the global one (AppScript v9.1)
  async getCommentRequirements(ticketTypeId, companyId = null) {
    const response = await this.makeRequest('getCommentRequirements', {
      ticket_type_id: ticketTypeId,
      company_id: companyId
    });
    return response.data || null;
  }

  // Save comment requirements for a ticket type; companyId null = the global row for every company
  async saveCommentRequirements(ticketTypeId, requirements = {}, companyId = null) {
    if (!ticketTypeId) {
      throw new Error('Ticket type ID is required');
    }
    const response = await this.makeRequest('saveCommentRequirements', {
      ticket_type_id: ticketTypeId,
      company_id: companyId || '',
      require_on_approve: Boolean(requirements.require_on_approve),
      require_on_return: Boolean(requirements.require_on_return),
      require_on_reject: Boolean(requirements.require_on_reject),
      require_on_cancel: Boolean(requirements.require_on_cancel)
    });
    return response.data;
  }

  // Tags / sharing switches (AppScript v9.3): off by default; turning one off is refused once it is in use.
  // v10.0: visibility 'private' (default) | 'collaborative' - who sees the type's tickets; it can change any time.
  // features: { enable_tags, enable_sharing, visibility } (only the keys sent change)
  // -> { ticket_type_id, enable_tags, enable_sharing, tags_locked, sharing_locked, visibility }
  async setFeatures(ticketTypeId, features = {}, userId = null) {
    const response = await this.makeRequest('setTicketTypeFeatures', {
      ticket_type_id: ticketTypeId,
      ...(features.enable_tags !== undefined ? { enable_tags: Boolean(features.enable_tags) } : {}),
      ...(features.enable_sharing !== undefined ? { enable_sharing: Boolean(features.enable_sharing) } : {}),
      ...(features.visibility !== undefined ? { visibility: String(features.visibility) } : {}),
      // v10.0 M4: Restricted mode (off | optional | always) and admin access (reveal_with_reason | always | never)
      ...(features.confidential_mode !== undefined ? { confidential_mode: String(features.confidential_mode) } : {}),
      ...(features.confidential_admin_access !== undefined ? { confidential_admin_access: String(features.confidential_admin_access) } : {}),
      user_id: userId
    });
    cache.invalidate('ticket_types');
    return response.data;
  }

  // Validate ticket type name uniqueness (case-insensitive)
  async validateNameUniqueness(name, excludeId = null) {
    if (!name?.trim()) return;

    const existingTicketTypes = await this.getAll();
    const trimmedName = name.trim().toLowerCase();

    const duplicate = existingTicketTypes.find(ticketType =>
      ticketType.name.toLowerCase() === trimmedName &&
      ticketType.id !== excludeId
    );

    if (duplicate) {
      throw new Error(`A ticket type with the name "${name}" already exists (case-insensitive)`);
    }
  }

  getMockData(action, params = {}) {
    const mockTicketTypes = [
      {
        id: 'tt_1',
        transaction_id: 'TR001',
        code: 'PR',
        name: 'Purchase Request',
        description: 'Request for purchasing items',
        is_active: true,
        require_attachment_on_create: true,
        company_id: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'tt_2',
        transaction_id: 'TR002',
        code: 'IT',
        name: 'IT Request',
        description: 'Request for IT support',
        is_active: true,
        require_attachment_on_create: false,
        company_id: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'tt_3',
        transaction_id: 'TR003',
        code: 'LV',
        name: 'Leave Request',
        description: 'Request for time off',
        is_active: true,
        require_attachment_on_create: false,
        company_id: '1',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    switch (action) {
      case 'getTicketTypes':
        return { status: 'success', data: mockTicketTypes };
      case 'getCreatableTicketTypes':
        // v10.0 mock: every active type, creatable in its own company (the server decides in live mode)
        return { status: 'success', data: mockTicketTypes.filter(tt => tt.is_active !== false)
          .map(tt => ({ ...tt, visibility: 'private', creatable_company_ids: [String(tt.company_id || '1')] })) };
      case 'getTicketType':
        const ticketType = mockTicketTypes.find(tt => tt.id === params.ticket_type_id);
        return { status: 'success', data: ticketType };
      case 'createTicketType':
      case 'updateTicketType':
        return {
          status: 'success',
          data: {
            ...mockTicketTypes[0],
            id: Date.now().toString(),
            ...params
          }
        };
      case 'deleteTicketType':
        return { status: 'success', data: { deleted: true } };
      default:
        return super.getMockData(action, params);
    }
  }
}

// Step Approvals API
class StepApprovalsAPI extends BaseAPI {
  constructor() {
    super('step_approvals');
  }

  async getStepApprovals(ticketId, stepId) {
    const response = await this.makeRequest('getStepApprovals', {
      ticket_id: ticketId,
      step_id: stepId
    });
    return response.data || [];
  }

  // Returns { new_status, next_step, partial, approved_role_ids, required_role_ids, ... }
  async submitApproval(ticketId, stepId, userId, decision, comment = '') {
    const response = await this.makeRequest('submitStepApproval', {
      ticket_id: ticketId,
      step_id: stepId,
      user_id: userId,
      decision, // 'approve' | 'reject' | 'return' | 'complete' - not `action`, which is the route name
      comment: comment.trim(),
      timestamp: new Date().toISOString()
    });

    // Module-level cache: `this.cache` doesn't exist and threw after the backend had saved the approval (review R-01)
    cache.invalidate('step_approvals');
    cache.invalidate('tickets');
    return response.data;
  }

  async canUserApprove(userId, stepId, ticketId = null) {
    const eligibility = await this.getApprovalEligibility(userId, stepId, ticketId);
    return eligibility?.can_approve || false;
  }

  // { can_approve, can_act, already_approved, approver_logic, eligible_role_ids, required_role_ids, approved_role_ids }
  // can_act (AppScript v9.1): may reject / return - true for a partial approver under 'all' too
  async getApprovalEligibility(userId, stepId, ticketId = null) {
    const response = await this.makeRequest('canUserApprove', {
      user_id: userId,
      step_id: stepId,
      ticket_id: ticketId
    });
    return response.data || null;
  }

  getMockData(action, params = {}) {
    if (action === 'getStepApprovals') {
      return {
        success: true,
        data: [
          {
            id: 'approval_1',
            ticket_id: params.ticket_id,
            step_id: params.step_id,
            user_id: 'user123',
            user_name: 'John Manager',
            action: 'approve',
            comment: 'Budget approved',
            timestamp: '2025-01-15T10:30:00.000Z'
          }
        ]
      };
    }

    if (action === 'canUserApprove') {
      return {
        success: true,
        data: { can_approve: true }
      };
    }

    return super.getMockData(action, params);
  }
}

// SLA API
class SLAAPI extends BaseAPI {
  constructor() {
    super('sla');
  }

  async getCompanyRules(companyId, ticketTypeId) {
    const response = await this.makeRequest('getCompanySLARules', {
      company_id: companyId,
      ticket_type_id: ticketTypeId
    });
    return response.data || [];
  }

  async createCompanyRule(ruleData) {
    const response = await this.makeRequest('createCompanySLARule', {
      company_id: ruleData.company_id,
      ticket_type_id: ruleData.ticket_type_id,
      step_name: ruleData.step_name,
      duration: ruleData.duration,
      unit: ruleData.unit,
      exclude_weekends: ruleData.exclude_weekends,
      exclude_holidays: ruleData.exclude_holidays,
      escalation_enabled: ruleData.escalation_enabled,
      escalation_delay: ruleData.escalation_delay,
      escalation_unit: ruleData.escalation_unit,
      escalation_recipients: ruleData.escalation_recipients,
      warning_threshold: ruleData.warning_threshold,
      business_hours_start: ruleData.business_hours_start,
      business_hours_end: ruleData.business_hours_end,
      business_days: ruleData.business_days,
      timezone: ruleData.timezone
    });
    cache.invalidate('sla');
    return response.data;
  }

  async updateCompanyRule(ruleId, ruleData) {
    const response = await this.makeRequest('updateCompanySLARule', {
      rule_id: ruleId,
      ...ruleData
    });
    cache.invalidate('sla');
    return response.data;
  }

  async deleteCompanyRule(ruleId) {
    const response = await this.makeRequest('deleteCompanySLARule', {
      rule_id: ruleId
    });
    cache.invalidate('sla');
    return response.data;
  }

  // AppScript v9.5: escalation rules - levels per company + ticket type + step (blank step = every step).
  // The rule's own field is escalation_action ('notify' | 'escalate_role'): a payload key `action` would replace
  // the route name (compliance A13). user_id is for the admin check; under AUTH_MODE enforce the token decides.
  async getEscalationRules(companyId, ticketTypeId = null, stepId = null) {
    const response = await this.makeRequest('getSLAEscalationRules', {
      company_id: companyId,
      ticket_type_id: ticketTypeId,
      step_id: stepId
    });
    return response.data || [];
  }

  async createEscalationRule(userId, rule) {
    const response = await this.makeRequest('createSLAEscalationRule', { ...rule, user_id: userId });
    return response.data;
  }

  async updateEscalationRule(userId, ruleId, rule) {
    const response = await this.makeRequest('updateSLAEscalationRule', { ...rule, rule_id: ruleId, user_id: userId });
    return response.data;
  }

  async deleteEscalationRule(userId, ruleId, reason = 'admin_request') {
    const response = await this.makeRequest('deleteSLAEscalationRule', { rule_id: ruleId, reason, user_id: userId });
    return response.data;
  }

  // What fired on a ticket (ticket timeline)
  async getEscalationEvents(ticketId) {
    const response = await this.makeRequest('getSLAEscalationEvents', { ticket_id: ticketId });
    return response.data || [];
  }

  // Admin preview: what would fire now (read-only)
  async testEscalations(userId) {
    const response = await this.makeRequest('testSLAEscalations', { user_id: userId }, false);
    return response.data;
  }

  // Admin: run the escalation pass now (dry run unless dryRun is false)
  async runEscalationsNow(userId, dryRun = true) {
    const response = await this.makeRequest('runSLAEscalationsNow', { user_id: userId, dry_run: dryRun });
    return response.data;
  }

  // Holidays: a company's own plus the ones for every company (blank company_id)
  async getHolidays(companyId = null, year = null) {
    const response = await this.makeRequest('getCompanyHolidays', { company_id: companyId, year });
    return response.data || [];
  }

  async createHoliday(userId, holiday) {
    const response = await this.makeRequest('createCompanyHoliday', { ...holiday, user_id: userId });
    return response.data;
  }

  async deleteHoliday(userId, holidayId) {
    const response = await this.makeRequest('deleteCompanyHoliday', { id: holidayId, user_id: userId });
    return response.data;
  }

  // Philippine holidays of a year; a dry run (preview) unless dryRun is false
  async addPhilippineHolidays(userId, year, companyId = '', dryRun = true) {
    const response = await this.makeRequest('addPhilippineHolidays', { user_id: userId, year, company_id: companyId, dry_run: dryRun });
    return response.data;
  }

  // Email for SLA notices: global default (on / off) + per ticket type (default / on / off)
  async getNotificationSettings() {
    const response = await this.makeRequest('getSLANotificationSettings', {}, false);
    return response.data;
  }

  async saveNotificationSettings(userId, settings) {
    const response = await this.makeRequest('saveSLANotificationSettings', { ...settings, user_id: userId });
    return response.data;
  }

  getMockData(action, params = {}) {
    const mockSLARules = [
      {
        id: 'sla_1',
        company_id: '1',
        ticket_type_id: 'tt_1',
        step_name: 'Manager Approval',
        duration: 24,
        unit: 'hours',
        exclude_weekends: false,
        exclude_holidays: true,
        escalation_enabled: true,
        escalation_delay: 4,
        escalation_unit: 'hours',
        escalation_recipients: ['manager@company.com', 'supervisor@company.com'],
        warning_threshold: 75,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        timezone: 'Asia/Manila',
        created_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 'sla_2',
        company_id: '1',
        ticket_type_id: 'tt_1',
        step_name: 'Finance Review',
        duration: 48,
        unit: 'business_hours',
        exclude_weekends: true,
        exclude_holidays: true,
        escalation_enabled: false,
        warning_threshold: 80,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        timezone: 'Asia/Manila',
        created_at: '2025-01-01T00:00:00.000Z'
      }
    ];

    switch (action) {
      case 'getCompanySLARules':
        return {
          success: true,
          data: mockSLARules.filter(rule =>
            rule.company_id === params.company_id &&
            rule.ticket_type_id === params.ticket_type_id
          )
        };
      case 'createCompanySLARule':
        return {
          success: true,
          message: 'SLA rule created successfully',
          data: {
            id: `sla_${Date.now()}`,
            ...params,
            created_at: new Date().toISOString()
          }
        };
      case 'updateCompanySLARule':
        return {
          success: true,
          message: 'SLA rule updated successfully',
          data: {
            id: params.rule_id,
            updated_at: new Date().toISOString()
          }
        };
      case 'deleteCompanySLARule':
        return {
          success: true,
          message: 'SLA rule deleted successfully',
          data: { deleted: true }
        };
      default:
        return super.getMockData(action, params);
    }
  }
}

// Main API object
// Ticket Links API
class TicketLinksAPI extends BaseAPI {
  constructor() {
    super('ticket_links');
  }

  async getAll(criteria = {}) {
    const response = await this.makeRequest('getTicketLinks', {
      ticket_number: criteria.ticketNumber,
      company_id: criteria.companyId,
      ticket_type_id: criteria.ticketTypeId,
      status: criteria.status,
      include_linked: criteria.includeLinked
    });
    return response.data || [];
  }

  async create(linkData) {
    const response = await this.makeRequest('createTicketLink', {
      parent_ticket_number: linkData.parent_ticket_number,
      child_ticket_number: linkData.child_ticket_number,
      link_type: linkData.link_type,
      description: linkData.description,
      enforce_blocking_rules: linkData.enforce_blocking_rules,
      sync_status: linkData.sync_status,
      notify_on_update: linkData.notify_on_update
    });
    cache.invalidate('ticket_links');
    return response.data;
  }

  async delete(linkId) {
    const response = await this.makeRequest('deleteTicketLink', {
      link_id: linkId
    });
    cache.invalidate('ticket_links');
    return response.data;
  }

  async validateDependencies() {
    const response = await this.makeRequest('validateTicketDependencies');
    return response.data;
  }

  getMockData(action, params = {}) {
    const mockLinks = [
      {
        id: 'link_1',
        parent_ticket_number: 'ABC-PR-2025-0001',
        child_ticket_number: 'XYZ-IT-2025-0010',
        link_type: 'blocks',
        description: 'Purchase request must be approved before IT setup',
        enforce_blocking_rules: true,
        sync_status: false,
        notify_on_update: true,
        created_at: '2025-01-15T08:00:00.000Z'
      },
      {
        id: 'link_2',
        parent_ticket_number: 'DEF-BUD-2025-0005',
        child_ticket_number: 'ABC-PR-2025-0001',
        link_type: 'depends_on',
        description: 'Purchase depends on budget approval',
        enforce_blocking_rules: true,
        sync_status: true,
        notify_on_update: true,
        created_at: '2025-01-14T10:30:00.000Z'
      }
    ];

    switch (action) {
      case 'getTicketLinks':
        return {
          success: true,
          data: mockLinks.filter(link => {
            if (params.ticket_number &&
                !link.parent_ticket_number.includes(params.ticket_number) &&
                !link.child_ticket_number.includes(params.ticket_number)) {
              return false;
            }
            return true;
          })
        };
      case 'createTicketLink':
        return {
          success: true,
          message: 'Ticket link created successfully',
          data: {
            id: `link_${Date.now()}`,
            ...params,
            created_at: new Date().toISOString()
          }
        };
      case 'deleteTicketLink':
        return {
          success: true,
          message: 'Ticket link deleted successfully',
          data: { deleted: true }
        };
      case 'validateTicketDependencies':
        return {
          success: true,
          data: {
            total_links: 5,
            circular_dependencies: [],
            orphaned_tickets: [],
            validation_passed: true
          }
        };
      default:
        return super.getMockData(action, params);
    }
  }
}

/**
 * Ticket tags (AppScript v9.3). A ticket type must have tags turned on (TicketTypes.setFeatures) before its
 * tickets can be tagged; tags are global or belong to one company.
 */
class TagsAPI extends BaseAPI {
  constructor() {
    super('tags');
  }

  // Live tags; with companyId only the ones that company can use (its own + global)
  async getAll(companyId = null) {
    const response = await this.makeRequest('getTags', { company_id: companyId || undefined });
    return response.data || [];
  }

  // { name, color (#RRGGBB), description, tag_category, company_id ('' = global) }
  async create(tag, userId = null) {
    const response = await this.makeRequest('createTag', {
      name: tag.name,
      color: tag.color,
      description: tag.description,
      tag_category: tag.tag_category,
      company_id: tag.company_id || '',
      user_id: userId
    });
    cache.invalidate('tags');
    return response.data;
  }

  async update(tagId, changes, userId = null) {
    const response = await this.makeRequest('updateTag', { tag_id: tagId, ...changes, user_id: userId });
    cache.invalidate('tags');
    return response.data;
  }

  async delete(tagId, userId = null, reason = '') {
    const response = await this.makeRequest('deleteTag', { tag_id: tagId, user_id: userId, reason });
    cache.invalidate('tags');
    return response.data;
  }

  async getForTicket(ticketId) {
    const response = await this.makeRequest('getTicketTags', { ticket_id: ticketId });
    return response.data || [];
  }

  // Both return the ticket's tags after the change
  async assign(ticketId, tagIds, userId, notes = '') {
    const response = await this.makeRequest('assignTags', { ticket_id: ticketId, tag_ids: tagIds, user_id: userId, notes });
    cache.invalidate('tags');
    return response.data || [];
  }

  async remove(ticketId, tagIds, userId, reason = '') {
    const response = await this.makeRequest('removeTags', { ticket_id: ticketId, tag_ids: tagIds, user_id: userId, reason });
    cache.invalidate('tags');
    return response.data || [];
  }

  // Ticket ids with ANY (OR) / ALL (AND) of tagIds and none of excludeTagIds
  async search({ tagIds = [], excludeTagIds = [], operator = 'OR', companyId = null }) {
    const response = await this.makeRequest('searchTicketsByTags', {
      tag_ids: tagIds.join(','),
      exclude_tag_ids: excludeTagIds.join(','),
      operator,
      company_id: companyId || undefined
    });
    return response.data?.ticket_ids || [];
  }
}

/**
 * Ticket sharing (AppScript v9.3): the requester or an admin gives one user or one company view (or view +
 * comment) access, optionally until a date. The ticket type must have sharing turned on.
 */
class SharingAPI extends BaseAPI {
  constructor() {
    super('sharing');
  }

  // { shared_with_user_id | shared_with_company_id, permission_level: 'view' | 'comment', expiration_date, share_reason }
  async share(ticketId, share, userId) {
    const response = await this.makeRequest('shareTicket', {
      ticket_id: ticketId,
      shared_with_user_id: share.shared_with_user_id || '',
      shared_with_company_id: share.shared_with_company_id || '',
      permission_level: share.permission_level || 'view',
      expiration_date: share.expiration_date || '',
      share_reason: share.share_reason || '',
      user_id: userId
    });
    cache.invalidate('sharing');
    return response.data;
  }

  async getForTicket(ticketId) {
    const response = await this.makeRequest('getTicketShares', { ticket_id: ticketId });
    return response.data || [];
  }

  async revoke(shareId, userId, reason = '') {
    const response = await this.makeRequest('revokeTicketShare', { collaboration_id: shareId, user_id: userId, reason });
    cache.invalidate('sharing');
    return response.data;
  }

  // Tickets shared with the user (directly or through a company they have a role in), each with .share
  async getSharedWithMe(userId) {
    const response = await this.makeRequest('getSharedTickets', { user_id: userId });
    return response.data || [];
  }
}

/**
 * Reports (AppScript v9.2, spec 3.3 / 3.4): the report columns of a ticket type (company config wins over the
 * global one) and the report rows. Non-admins only get the tickets they requested, acted on or can approve.
 */
// In-app notifications (AppScript v9.5): the caller's own; the server decides whose (actorId)
class NotificationsAPI extends BaseAPI {
  constructor() {
    super('notifications');
  }

  // AppScript v10.0: paged (cursor -> next_cursor / has_more) and it includes the notifications of the user's roles
  // (role_notification: true - one row for a whole role above 25 approvers; marking it read is per user)
  async getAll(userId, { unreadOnly = false, limit = 50, cursor = null } = {}) {
    const response = await this.makeRequest('getNotifications', { user_id: userId, unread_only: unreadOnly, limit, ...(cursor ? { cursor } : {}) });
    return response.data || { items: [], unread_count: 0, total: 0, next_cursor: null, has_more: false };
  }

  // ids: the notifications to mark; null / undefined = all of them; [] = nothing (review CR2-06)
  async markRead(userId, ids = null) {
    if (Array.isArray(ids) && ids.length === 0) return { marked: 0 };
    const response = await this.makeRequest('markNotificationsRead', Array.isArray(ids) ? { user_id: userId, ids } : { user_id: userId, all: true });
    return response.data;
  }
}

class ReportsAPI extends BaseAPI {
  constructor() {
    super('reports');
  }

  // { ticket_type_id, company_id, source: 'company' | 'global' | 'default', columns, available }
  async getConfig(ticketTypeId, companyId = null) {
    const response = await this.makeRequest('getReportConfig', {
      ticket_type_id: ticketTypeId,
      company_id: companyId
    });
    return response.data;
  }

  // columns: [{ field_name, display_name }] in display order; companyId '' = the global configuration
  async saveConfig(ticketTypeId, companyId, columns, userId = null) {
    const response = await this.makeRequest('saveReportConfig', {
      ticket_type_id: ticketTypeId,
      company_id: companyId || '',
      columns,
      user_id: userId
    });
    cache.invalidate('reports');
    return response.data;
  }

  // { columns, rows: [{ ticket_id, <field_name>: text }], total, scope }; status: 'open' | 'closed' | a status
  async getData({ userId, ticketTypeId, companyId, status, dateFrom, dateTo }) {
    const response = await this.makeRequest('getReportData', {
      user_id: userId,
      ticket_type_id: ticketTypeId,
      company_id: companyId || undefined,
      status: status || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined
    });
    return response.data || { columns: [], rows: [], total: 0 };
  }
}

/**
 * Audit log reads (AppScript v9.2, spec 3.5) - admins only; the backend checks user_id's roles.
 */
class AuditLogAPI extends BaseAPI {
  constructor() {
    super('audit_logs');
  }

  // { logs, total, limit, offset, action_types, target_entities }
  async getAdminLogs({ userId, actionType, targetEntity, targetId, dateFrom, dateTo, limit = 50, offset = 0 }) {
    const response = await this.makeRequest('getAdminActionLogs', {
      user_id: userId,
      action_type: actionType || undefined,
      target_entity: targetEntity || undefined,
      target_id: targetId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit,
      offset
    });
    return response.data || { logs: [], total: 0, limit, offset, action_types: [], target_entities: [] };
  }

  async getTicketLogs(ticketId, userId) {
    const response = await this.makeRequest('getTicketActionLogs', {
      ticket_id: ticketId,
      user_id: userId
    });
    return response.data || [];
  }
}

/**
 * User invites (AppScript v9.6, admins only): an invited person signs in with Google using the invited email and
 * the backend creates their profile and roles. No token in the email - the Google sign-in is the proof.
 */
class InvitesAPI extends BaseAPI {
  constructor() {
    super('invites');
  }

  // status: 'pending' (default) | 'accepted' | 'revoked' | 'expired' | 'all'
  async getAll({ status = 'pending', companyId } = {}) {
    const response = await this.makeRequest('getUserInvites', { status, company_id: companyId || undefined });
    return response.data || [];
  }

  // { email, display_name, company_id, user_profile_type_id, role_grants: [{ role_id, ticket_type_id }],
  //   immediate_approver_id, backup_approver_id, send_email }
  async create(invite) {
    const response = await this.makeRequest('createUserInvite', invite);
    cache.invalidate('invites');
    return response.data;
  }

  async resend(inviteId) {
    const response = await this.makeRequest('resendUserInvite', { invite_id: inviteId });
    cache.invalidate('invites');
    return response.data;
  }

  async revoke(inviteId, reason = '') {
    const response = await this.makeRequest('revokeUserInvite', { invite_id: inviteId, reason });
    cache.invalidate('invites');
    return response.data;
  }
}

/** Company email settings (AppScript v9.6, admins only): on/off over the ticket type, sender name, Reply-To, CC, footer. */
class CompanyEmailAPI extends BaseAPI {
  constructor() {
    super('company_email');
  }

  async get(companyId) {
    const response = await this.makeRequest('getCompanyEmailSettings', { company_id: companyId });
    return response.data;
  }

  // settings: { email_enabled: 'default' | 'on' | 'off', email_sender_name, email_reply_to, email_cc, email_footer }
  async save(companyId, settings) {
    const response = await this.makeRequest('saveCompanyEmailSettings', { company_id: companyId, ...settings });
    cache.invalidate('company_email');
    return response.data;
  }

  // to: optional; the backend defaults to the admin's own address
  async sendTest(companyId, to = '') {
    const response = await this.makeRequest('sendCompanyTestEmail', { company_id: companyId, to: to || undefined });
    return response.data;
  }
}

/**
 * Ticket attachment links (AppScript v9.6): URL + name on a ticket. The server decides who may add / remove / fix
 * (requester, current approvers, admin) and returns can_manage; anyone who can see the ticket may report a link broken.
 */
class AttachmentsAPI extends BaseAPI {
  constructor() {
    super('attachments');
  }

  // { ticket_id, can_manage, closed, attachments: [{ id, file_name, file_url, description, link_status, report_note, ... }] }
  async getForTicket(ticketId) {
    const response = await this.makeRequest('getTicketAttachments', { ticket_id: ticketId });
    return response.data || { ticket_id: String(ticketId), can_manage: false, closed: false, attachments: [] };
  }

  async addLink(ticketId, { fileUrl, fileName, description = '', stepId = '' }) {
    const response = await this.makeRequest('addTicketAttachmentLink', {
      ticket_id: ticketId, file_url: fileUrl, file_name: fileName, description, step_id: stepId || undefined
    });
    cache.invalidate('attachments');
    return response.data;
  }

  async remove(attachmentId, reason = '') {
    const response = await this.makeRequest('removeTicketAttachment', { attachment_id: attachmentId, reason });
    cache.invalidate('attachments');
    return response.data;
  }

  async reportBroken(attachmentId, note = '') {
    const response = await this.makeRequest('reportAttachmentLinkBroken', { attachment_id: attachmentId, note });
    cache.invalidate('attachments');
    return response.data;
  }

  // Only while the link is reported broken; saving clears the report
  async fixLink(attachmentId, { fileUrl, fileName, description }) {
    const response = await this.makeRequest('updateAttachmentLink', {
      attachment_id: attachmentId, file_url: fileUrl, file_name: fileName, description
    });
    cache.invalidate('attachments');
    return response.data;
  }
}

export const API = {
  Companies: new CompanyAPI(),
  Roles: new RoleAPI(),
  Dropdowns: new DropdownAPI(),
  Tickets: new TicketAPI(),
  TicketTypes: new TicketTypesAPI(),
  CustomFields: new CustomFieldsAPI(),
  Users: new UserAPI(),
  System: new SystemAPI(),
  WorkflowSteps: new WorkflowStepsAPI(),
  StepApprovals: new StepApprovalsAPI(),
  SLA: new SLAAPI(),
  TicketLinks: new TicketLinksAPI(),
  Reports: new ReportsAPI(),
  Notifications: new NotificationsAPI(),
  AuditLogs: new AuditLogAPI(),
  Tags: new TagsAPI(),
  Sharing: new SharingAPI(),
  // AppScript v9.6
  Invites: new InvitesAPI(),
  CompanyEmail: new CompanyEmailAPI(),
  Attachments: new AttachmentsAPI(),
  // Universal Entity Architecture APIs
  UserProfileTypes: new UserProfileTypesAPI(),
  RoleTypes: new RoleTypesAPI()
};

// Individual API exports for backward compatibility
export const companyAPI = API.Companies;
export const roleAPI = API.Roles;
export const dropdownAPI = API.Dropdowns;
export const ticketAPI = API.Tickets;
export const ticketTypesAPI = API.TicketTypes;
export const customFieldsAPI = API.CustomFields;
export const userAPI = API.Users;
export const systemAPI = API.System;
export const workflowStepsAPI = API.WorkflowSteps;
export const stepApprovalsAPI = API.StepApprovals;
export const slaAPI = API.SLA;
export const ticketLinksAPI = API.TicketLinks;
export const reportsAPI = API.Reports;
export const auditLogAPI = API.AuditLogs;
export const tagsAPI = API.Tags;
export const sharingAPI = API.Sharing;
export const invitesAPI = API.Invites;
export const companyEmailAPI = API.CompanyEmail;
export const attachmentsAPI = API.Attachments;
export const userProfileTypesAPI = API.UserProfileTypes;
export const roleTypesAPI = API.RoleTypes;

// Utility functions
export const APIUtils = {
  /**
   * Clear all cached data
   */
  clearCache() {
    cache.clear();
    console.log('API cache cleared');
  },

  /**
   * Check if API is configured
   */
  isConfigured() {
    return !!CONFIG.APPS_SCRIPT_URL;
  },

  /**
   * Get API configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      mockMode: CONFIG.ENABLE_MOCK_DATA,
      cacheEnabled: true,
      timeout: CONFIG.TIMEOUT,
      maxRetries: CONFIG.MAX_RETRIES
    };
  },

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await API.System.ping();
      return {
        success: true,
        message: 'API connection successful',
        data: response
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        mockMode: CONFIG.ENABLE_MOCK_DATA
      };
    }
  }
};

export default API;