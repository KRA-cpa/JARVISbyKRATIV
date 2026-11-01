#!/usr/bin/env node

/**
 * API Testing Script for Google Apps Script Backend
 * Tests all endpoints and validates responses
 */

const https = require('https');
const { URL } = require('url');

// Configuration
const API_CONFIG = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbyeSHLU8sW3S87yEZ7BAGJWBdaMEvJfkz3OzjPjE8XaP0pOjmGxxYQWmUwvgoIvMQArXA/exec',
  timeout: 30000,
  retries: 3
};

// Test endpoints
const TEST_ENDPOINTS = {
  ping: {
    method: 'GET',
    params: { action: 'ping' },
    expectedStatus: 200,
    expectedResponse: { success: true }
  },
  getCompanies: {
    method: 'GET',
    params: { action: 'getCompanies' },
    expectedStatus: 200,
    expectedResponse: { success: true, data: Array }
  },
  getUsers: {
    method: 'GET',
    params: { action: 'getUsers' },
    expectedStatus: 200,
    expectedResponse: { success: true, data: Array }
  },
  getRoles: {
    method: 'GET',
    params: { action: 'getRoles' },
    expectedStatus: 200,
    expectedResponse: { success: true, data: Array }
  },
  getTickets: {
    method: 'GET',
    params: { action: 'getTickets' },
    expectedStatus: 200,
    expectedResponse: { success: true, data: Array }
  },
  getTicketTypes: {
    method: 'GET',
    params: { action: 'getTicketTypes' },
    expectedStatus: 200,
    expectedResponse: { success: true, data: Array }
  },
  getDropdownLists: {
    method: 'GET',
    params: { action: 'getDropdownLists' },
    expectedStatus: 200,
    expectedResponse: { success: true, data: Array }
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class APITester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async makeRequest(endpoint, config) {
    const { method, params } = config;
    const url = new URL(API_CONFIG.baseUrl);

    // Add query parameters for GET requests
    if (method === 'GET' && params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const body = method === 'POST' && params ? JSON.stringify(params) : null;
    return this.send(url, method, body, Date.now(), 0);
  }

  /**
   * One HTTP request, following redirects. Apps Script web apps always answer /exec with a 302 to
   * script.googleusercontent.com, so without this every check saw HTTP 302 and failed.
   * 301/302/303 continue as GET without a body (what browsers and fetch do); 307/308 keep method and body.
   */
  send(url, method, body, startTime, hops) {
    const MAX_REDIRECTS = 5;

    return new Promise((resolve, reject) => {
      const options = {
        method: method,
        timeout: API_CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Daloy-API-Tester/1.0'
        }
      };

      const req = https.request(url, options, (res) => {
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && location) {
          res.resume(); // discard the redirect body
          if (hops >= MAX_REDIRECTS) {
            reject({ error: `Too many redirects (${MAX_REDIRECTS})`, responseTime: Date.now() - startTime });
            return;
          }
          const keepMethod = res.statusCode === 307 || res.statusCode === 308;
          resolve(this.send(new URL(location, url), keepMethod ? method : 'GET', keepMethod ? body : null, startTime, hops + 1));
          return;
        }

        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: jsonData,
              redirects: hops,
              responseTime: Date.now() - startTime
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data,
              redirects: hops,
              error: 'Invalid JSON response',
              responseTime: Date.now() - startTime
            });
          }
        });
      });

      req.on('error', (error) => {
        reject({
          error: error.message,
          code: error.code,
          responseTime: Date.now() - startTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject({
          error: 'Request timeout',
          responseTime: API_CONFIG.timeout
        });
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  validateResponse(response, expected) {
    const issues = [];

    // Check status code
    if (response.status !== expected.expectedStatus) {
      issues.push(`Expected status ${expected.expectedStatus}, got ${response.status}`);
    }

    // Check response structure
    if (response.data && typeof response.data === 'object') {
      const { success, data, error } = response.data;

      // Check success field
      if (expected.expectedResponse.success !== undefined) {
        if (success !== expected.expectedResponse.success) {
          issues.push(`Expected success: ${expected.expectedResponse.success}, got: ${success}`);
        }
      }

      // Check data type
      if (expected.expectedResponse.data === Array) {
        if (!Array.isArray(data)) {
          issues.push(`Expected data to be an array, got: ${typeof data}`);
        }
      }

      // Check for errors
      if (error && success) {
        issues.push(`Response has error but success is true: ${error}`);
      }
    } else {
      issues.push('Response is not valid JSON object');
    }

    return issues;
  }

  async testEndpoint(name, config) {
    this.log(`🧪 Testing ${name}...`, 'blue');

    let attempt = 0;
    let lastError = null;

    while (attempt < API_CONFIG.retries) {
      try {
        const response = await this.makeRequest(name, config);
        const issues = this.validateResponse(response, config);

        const result = {
          endpoint: name,
          success: issues.length === 0,
          status: response.status,
          responseTime: response.responseTime,
          issues: issues,
          attempt: attempt + 1,
          data: response.data
        };

        if (result.success) {
          this.log(`✅ ${name} - PASSED (${response.responseTime}ms)`, 'green');
          this.results.passed++;
          this.results.details.push(result);
          return result;
        } else {
          this.log(`❌ ${name} - FAILED: ${issues.join(', ')}`, 'red');
          if (attempt === API_CONFIG.retries - 1) {
            this.results.failed++;
            this.results.details.push(result);
            return result;
          }
        }
      } catch (error) {
        lastError = error;
        this.log(`⚠️  ${name} - Error (attempt ${attempt + 1}): ${error.error}`, 'yellow');
      }

      attempt++;
      if (attempt < API_CONFIG.retries) {
        this.log(`🔄 Retrying ${name} in 2 seconds...`, 'cyan');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // All attempts failed
    const result = {
      endpoint: name,
      success: false,
      error: lastError,
      attempts: API_CONFIG.retries
    };

    this.results.failed++;
    this.results.details.push(result);
    return result;
  }

  async testAll() {
    this.log('🚀 Starting API endpoint tests...', 'bright');
    this.log(`📊 Testing ${Object.keys(TEST_ENDPOINTS).length} endpoints\n`, 'cyan');

    this.results.total = Object.keys(TEST_ENDPOINTS).length;

    for (const [name, config] of Object.entries(TEST_ENDPOINTS)) {
      await this.testEndpoint(name, config);
    }
  }

  generateReport() {
    const duration = Date.now() - this.startTime;

    this.log('\n📊 API TEST RESULTS', 'bright');
    this.log('=' .repeat(50), 'cyan');

    // Summary
    this.log(`Total Endpoints:  ${this.results.total}`, 'cyan');
    this.log(`Passed:           ${this.results.passed}`, 'green');
    this.log(`Failed:           ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'cyan');
    this.log(`Duration:         ${(duration / 1000).toFixed(2)}s`, 'cyan');

    // Detailed results
    this.log('\n📋 DETAILED RESULTS', 'bright');
    this.log('-' .repeat(30), 'cyan');

    for (const result of this.results.details) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const color = result.success ? 'green' : 'red';
      const time = result.responseTime ? `${result.responseTime}ms` : 'N/A';

      this.log(`${result.endpoint.padEnd(20)} ${status} (${time})`, color);

      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => {
          this.log(`  → ${issue}`, 'yellow');
        });
      }

      if (result.error) {
        this.log(`  → ${result.error.error}`, 'red');
      }
    }

    // Performance analysis
    const successfulResults = this.results.details.filter(r => r.success && r.responseTime);
    if (successfulResults.length > 0) {
      const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
      const maxResponseTime = Math.max(...successfulResults.map(r => r.responseTime));
      const minResponseTime = Math.min(...successfulResults.map(r => r.responseTime));

      this.log('\n⚡ PERFORMANCE ANALYSIS', 'bright');
      this.log('-' .repeat(25), 'cyan');
      this.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`, 'cyan');
      this.log(`Fastest Response:      ${minResponseTime}ms`, 'green');
      this.log(`Slowest Response:      ${maxResponseTime}ms`, maxResponseTime > 5000 ? 'yellow' : 'cyan');

      if (avgResponseTime > 2000) {
        this.log('⚠️  Average response time is high (>2s)', 'yellow');
      } else if (avgResponseTime < 500) {
        this.log('🚀 Excellent response times!', 'green');
      }
    }

    // Health recommendations
    this.log('\n💡 RECOMMENDATIONS', 'bright');
    this.log('-' .repeat(20), 'cyan');

    if (this.results.failed === 0) {
      this.log('🎉 All endpoints are working perfectly!', 'green');
    } else {
      this.log(`🔧 ${this.results.failed} endpoint(s) need attention`, 'yellow');
    }

    const slowEndpoints = successfulResults.filter(r => r.responseTime > 3000);
    if (slowEndpoints.length > 0) {
      this.log(`⚡ Consider optimizing: ${slowEndpoints.map(r => r.endpoint).join(', ')}`, 'yellow');
    }

    // Save detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: duration,
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: ((this.results.passed / this.results.total) * 100).toFixed(2) + '%'
      },
      endpoints: this.results.details,
      performance: successfulResults.length > 0 ? {
        averageResponseTime: avgResponseTime.toFixed(2),
        minResponseTime: minResponseTime,
        maxResponseTime: maxResponseTime
      } : null
    };

    const fs = require('fs');
    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results', { recursive: true });
    }

    fs.writeFileSync('test-results/api-test-report.json', JSON.stringify(reportData, null, 2));
    this.log('\n📄 Detailed report saved to: test-results/api-test-report.json', 'cyan');

    return this.results.failed === 0;
  }

  async runHealthCheck() {
    this.log('🏥 Running API health check...', 'blue');

    try {
      const result = await this.testEndpoint('ping', TEST_ENDPOINTS.ping);
      if (result.success) {
        this.log('✅ API is healthy and responding', 'green');
        return true;
      } else {
        this.log('❌ API health check failed', 'red');
        return false;
      }
    } catch (error) {
      this.log(`💥 Health check error: ${error.message}`, 'red');
      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const tester = new APITester();

  try {
    if (args.includes('--health')) {
      // Run health check only
      const healthy = await tester.runHealthCheck();
      process.exit(healthy ? 0 : 1);
    } else {
      // Run full test suite
      await tester.testAll();
      const success = tester.generateReport();
      process.exit(success ? 0 : 1);
    }
  } catch (error) {
    tester.log(`💥 API testing failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Help text
function showHelp() {
  console.log(`
🌐 API Endpoint Tester for React Ticketing System

Usage: node scripts/test-api.js [options]

Options:
  --health         Run health check only
  --help           Show this help

Examples:
  node scripts/test-api.js               # Run all endpoint tests
  node scripts/test-api.js --health      # Health check only

Test Endpoints:
${Object.keys(TEST_ENDPOINTS).map(name => `  ${name}`).join('\n')}
`);
}

// Run if called directly
if (require.main === module) {
  if (process.argv.includes('--help')) {
    showHelp();
  } else {
    main();
  }
}

module.exports = { APITester, TEST_ENDPOINTS };