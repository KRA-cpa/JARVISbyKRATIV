/**
 * SLA Calculator Utility
 *
 * Handles Service Level Agreement (SLA) calculations for workflow steps
 * including due date calculations, status determination, and business hours logic.
 *
 * Business Rules:
 * - The server decides due dates and SLA status (compliance F1); this file previews them and labels them.
 * - Time zone (v10.1): the zone passed in, else the display zone (dateTime.js - the company's zone, Philippines /
 *   Asia/Manila by default). Day math runs on the zone's wall clock (wallClockIn) and results are real moments
 *   (fromWallClock). Before v10.1 a fixed "+8 h" was added to the real moment, which put a Manila browser 8 h ahead.
 * - Weekend exclusion means Saturday and Sunday are not counted (the preview; the server uses the country's weekend)
 * - Business hours: 8:00 AM to 5:00 PM (configurable)
 * - SLA status: "On Time", "Due Today", "Overdue", "No SLA"
 */

import {
  addHours,
  addDays,
  isWeekend,
  isAfter,
  differenceInHours,
  differenceInDays,
  format,
  parseISO
} from 'date-fns';
import { dayInZone, fromWallClock, resolveZone, wallClockIn } from './dateTime';

// Business hours configuration (24-hour format)
const BUSINESS_HOURS = {
  start: 8, // 8:00 AM
  end: 17,  // 5:00 PM
  hoursPerDay: 9 // 8 AM to 5 PM = 9 hours
};

/**
 * SLA Calculator Class
 * Core business logic for all SLA-related calculations
 */
export class SLACalculator {

  /**
   * Validate SLA configuration before calculations
   * @param {Object} slaConfig - SLA configuration to validate
   * @returns {Object} Validation result with errors array
   */
  static validateSLAConfig(slaConfig) {
    const errors = [];

    if (!slaConfig) {
      errors.push('SLA configuration is required');
      return { isValid: false, errors };
    }

    // Validate duration
    if (slaConfig.duration === null || slaConfig.duration === undefined) {
      errors.push('SLA duration is required');
    } else {
      const duration = parseFloat(slaConfig.duration);
      if (isNaN(duration) || duration <= 0) {
        errors.push('SLA duration must be a positive number');
      } else if (duration > 8760 && slaConfig.unit === 'hours') {
        errors.push('SLA duration cannot exceed 8760 hours (1 year)');
      } else if (duration > 365 && slaConfig.unit === 'days') {
        errors.push('SLA duration cannot exceed 365 days (1 year)');
      } else if (duration > 100000) {
        errors.push('SLA duration is unreasonably large');
      }
    }

    // Validate unit
    if (!slaConfig.unit) {
      errors.push('SLA unit is required');
    } else if (!['hours', 'days'].includes(slaConfig.unit.toLowerCase())) {
      errors.push('SLA unit must be "hours" or "days"');
    }

    // Validate logical combinations
    if (slaConfig.unit === 'hours' && slaConfig.duration > 24 && slaConfig.excludeWeekends) {
      console.warn('SLA: Using weekend exclusion with hours > 24 may lead to unexpected behavior');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Calculate due date for a workflow step with error handling
   * @param {Date|string} startDate - When the step started
   * @param {number} duration - SLA duration number
   * @param {string} unit - 'hours' or 'days'
   * @param {boolean} excludeWeekends - Whether to exclude weekends
   * @param {boolean} businessHoursOnly - Whether to only count business hours
   * @param {string} [zone] - IANA zone for the day math (default: the display zone)
   * @returns {Object} Result object with dueDate (a real moment) or error
   */
  static calculateDueDate(startDate, duration, unit = 'days', excludeWeekends = false, businessHoursOnly = false, zone = undefined) {
    try {
      // Validate inputs
      if (!startDate) {
        throw new Error('Start date is required for SLA calculation');
      }

      if (!duration || duration <= 0) {
        throw new Error('SLA duration must be a positive number');
      }

      // Validate SLA configuration
      const validation = this.validateSLAConfig({ duration, unit, excludeWeekends, businessHoursOnly });
      if (!validation.isValid) {
        throw new Error(`Invalid SLA configuration: ${validation.errors.join(', ')}`);
      }

      let start;
      try {
        start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
        if (isNaN(start.getTime())) {
          throw new Error('Invalid start date format');
        }
      } catch (dateError) {
        throw new Error('Failed to parse start date: ' + dateError.message);
      }

      // v10.1: the day math runs on the zone's wall clock; the answer is the real moment
      const tz = resolveZone(zone);
      const wallStart = wallClockIn(start, tz);

      let dueDate;
      if (unit === 'hours' && !excludeWeekends && !businessHoursOnly) {
        dueDate = addHours(start, duration); // plain hours: no wall clock needed
      } else if (unit === 'hours') {
        dueDate = fromWallClock(this._calculateHoursDueDate(wallStart, duration, excludeWeekends, businessHoursOnly), tz);
      } else if (unit === 'days') {
        dueDate = fromWallClock(this._calculateDaysDueDate(wallStart, duration, excludeWeekends), tz);
      } else {
        throw new Error(`Invalid SLA unit: ${unit}. Must be 'hours' or 'days'.`);
      }

      // Validate result
      if (!dueDate || isNaN(dueDate.getTime())) {
        throw new Error('SLA calculation resulted in invalid due date');
      }

      // Check for unreasonable future dates (> 2 years)
      const maxFutureDate = addDays(new Date(), 730); // 2 years
      if (dueDate > maxFutureDate) {
        console.warn('SLA due date is more than 2 years in the future:', dueDate);
      }

      return {
        success: true,
        dueDate,
        calculatedAt: new Date(),
        configuration: { duration, unit, excludeWeekends, businessHoursOnly, zone: tz }
      };

    } catch (error) {
      console.error('SLA Calculation Error:', error);
      return {
        success: false,
        error: error.message,
        dueDate: null,
        calculatedAt: new Date()
      };
    }
  }

  /**
   * Calculate due date for hours-based SLA
   * @private
   */
  static _calculateHoursDueDate(startDate, hours, excludeWeekends, businessHoursOnly) {
    if (!businessHoursOnly && !excludeWeekends) {
      // Simple case: just add hours
      return addHours(startDate, hours);
    }

    let currentDate = new Date(startDate);
    let remainingHours = hours;

    while (remainingHours > 0) {
      // Skip weekends if configured
      if (excludeWeekends && isWeekend(currentDate)) {
        currentDate = addDays(currentDate, 1);
        currentDate = this._setToBusinessStart(currentDate);
        continue;
      }

      if (businessHoursOnly) {
        const hoursUntilEndOfBusinessDay = this._getHoursUntilEndOfBusinessDay(currentDate);

        if (remainingHours <= hoursUntilEndOfBusinessDay) {
          // Can finish within current business day
          return addHours(currentDate, remainingHours);
        } else {
          // Move to next business day
          remainingHours -= hoursUntilEndOfBusinessDay;
          currentDate = addDays(currentDate, 1);
          currentDate = this._setToBusinessStart(currentDate);
        }
      } else {
        // Not business hours only, but may exclude weekends
        currentDate = addHours(currentDate, 1);
        remainingHours--;
      }
    }

    return currentDate;
  }

  /**
   * Calculate due date for days-based SLA
   * @private
   */
  static _calculateDaysDueDate(startDate, days, excludeWeekends) {
    if (!excludeWeekends) {
      // Simple case: just add days
      return addDays(startDate, days);
    }

    let currentDate = new Date(startDate);
    let remainingDays = days;

    while (remainingDays > 0) {
      currentDate = addDays(currentDate, 1);

      // Only count business days
      if (!isWeekend(currentDate)) {
        remainingDays--;
      }
    }

    return currentDate;
  }

  /**
   * Set time to business start (8:00 AM)
   * @private
   */
  static _setToBusinessStart(date) {
    const newDate = new Date(date);
    newDate.setHours(BUSINESS_HOURS.start, 0, 0, 0);
    return newDate;
  }

  /**
   * Get hours remaining until end of business day
   * @private
   */
  static _getHoursUntilEndOfBusinessDay(date) {
    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();

    if (currentHour < BUSINESS_HOURS.start) {
      // Before business hours - return full business day
      return BUSINESS_HOURS.hoursPerDay;
    } else if (currentHour >= BUSINESS_HOURS.end) {
      // After business hours - no time left today
      return 0;
    } else {
      // During business hours - calculate remaining
      const hoursLeft = BUSINESS_HOURS.end - currentHour;
      const minutesLeft = currentMinute > 0 ? -1 + (60 - currentMinute) / 60 : 0;
      return Math.max(0, hoursLeft + minutesLeft);
    }
  }

  /**
   * Determine SLA status for a ticket step
   * @param {Date|string|null} dueDate - When the step is due
   * @param {Date} currentDate - Current date/time (defaults to now)
   * @param {string} [zone] - Whose "today" (default: the display zone - the company's zone)
   * @returns {Object} SLA status object with type, label, color, and urgency
   */
  static getSLAStatus(dueDate, currentDate = new Date(), zone = undefined) {
    if (!dueDate) {
      return {
        type: 'no_sla',
        label: 'No SLA',
        color: 'gray',
        urgency: 0,
        isOverdue: false,
        isDueToday: false
      };
    }

    // v10.1: real moments for "overdue" and the durations; the zone only decides which day is today
    const due = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
    const now = currentDate instanceof Date ? currentDate : new Date(currentDate);
    if (!due || isNaN(due.getTime())) {
      return { type: 'no_sla', label: 'No SLA', color: 'gray', urgency: 0, isOverdue: false, isDueToday: false };
    }
    const tz = resolveZone(zone);

    // Check if overdue
    if (isAfter(now, due)) {
      const hoursOverdue = differenceInHours(now, due);
      return {
        type: 'overdue',
        label: `Overdue by ${this._formatDuration(hoursOverdue)}`,
        color: 'red',
        urgency: 3,
        isOverdue: true,
        isDueToday: false,
        hoursOverdue
      };
    }

    // Check if due today (in the zone)
    if (dayInZone(due, tz) === dayInZone(now, tz)) {
      const hoursUntilDue = differenceInHours(due, now);
      return {
        type: 'due_today',
        label: `Due in ${this._formatDuration(hoursUntilDue)}`,
        color: 'yellow',
        urgency: 2,
        isOverdue: false,
        isDueToday: true,
        hoursUntilDue
      };
    }

    // Due in the future
    const daysUntilDue = differenceInDays(due, now);
    return {
      type: 'on_time',
      label: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`,
      color: 'green',
      urgency: 1,
      isOverdue: false,
      isDueToday: false,
      daysUntilDue
    };
  }

  /**
   * Format duration in hours to human-readable format
   * @private
   */
  static _formatDuration(hours) {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      const roundedHours = Math.round(hours);
      return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.round(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Get SLA configuration for a step
   * @param {Object} step - Workflow step object
   * @returns {Object|null} SLA configuration or null if no SLA
   */
  static getStepSLAConfig(step) {
    if (!step || !step.sla_duration || !step.sla_unit) {
      return null;
    }

    return {
      duration: step.sla_duration,
      unit: step.sla_unit,
      excludeWeekends: step.exclude_weekends || false,
      businessHoursOnly: step.business_hours_only || false
    };
  }

  /**
   * Update ticket due date when moving to a new step
   * @param {Object} ticket - Current ticket object
   * @param {Object} newStep - New workflow step
   * @param {Date} transitionTime - When the transition occurred
   * @returns {Date|null} New due date or null if no SLA
   */
  static updateTicketDueDate(ticket, newStep, transitionTime = new Date()) {
    const slaConfig = this.getStepSLAConfig(newStep);

    if (!slaConfig) {
      return null;
    }

    return this.calculateDueDate(
      transitionTime,
      slaConfig.duration,
      slaConfig.unit,
      slaConfig.excludeWeekends,
      slaConfig.businessHoursOnly
    );
  }

  /**
   * Format a moment for the SLA preview in a zone (v10.1; was formatDatePhilippine with the +8 h shift)
   * @param {Date|string} date - Date to format
   * @param {string} formatString - date-fns pattern (default: 'MMM d, yyyy h:mm a')
   * @param {string} [zone] - IANA zone (default: the display zone)
   * @returns {string} Formatted date string
   */
  static formatSLADate(date, formatString = 'MMM d, yyyy h:mm a', zone = undefined) {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(wallClockIn(dateObj, resolveZone(zone)), formatString);
  }

  /**
   * Simulate SLA calculation for testing/validation purposes
   * @param {Object} slaConfig - SLA configuration to test
   * @param {Date} testStartDate - Optional start date for simulation (defaults to now)
   * @param {string} [zone] - IANA zone of the examples (default: the display zone)
   * @returns {Object} Simulation result with examples and validation
   */
  static simulateSLA(slaConfig, testStartDate = null, zone = undefined) {
    const startDate = testStartDate || new Date();
    const tz = resolveZone(zone);
    // the example starts ("Monday 9 AM") are wall-clock times in the zone
    const inZone = pick => fromWallClock(pick(wallClockIn(startDate, tz)), tz);
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      examples: [],
      configuration: slaConfig
    };

    try {
      // Validate configuration first
      const validation = this.validateSLAConfig(slaConfig);
      if (!validation.isValid) {
        results.isValid = false;
        results.errors = validation.errors;
        return results;
      }

      // Test calculation with current time
      const calculation = this.calculateDueDate(
        startDate,
        slaConfig.duration,
        slaConfig.unit,
        slaConfig.excludeWeekends,
        slaConfig.businessHoursOnly,
        tz
      );

      if (!calculation.success) {
        results.isValid = false;
        results.errors.push(`Calculation failed: ${calculation.error}`);
        return results;
      }

      // Generate example scenarios
      const scenarios = [
        { name: 'If started now', startDate: startDate },
        { name: 'If started Monday 9 AM', startDate: inZone(d => this._getNextMondayMorning(d)) },
        { name: 'If started Friday 4 PM', startDate: inZone(d => this._getNextFridayAfternoon(d)) },
        { name: 'If started on weekend', startDate: inZone(d => this._getNextSaturdayMorning(d)) }
      ];

      for (const scenario of scenarios) {
        const scenarioResult = this.calculateDueDate(
          scenario.startDate,
          slaConfig.duration,
          slaConfig.unit,
          slaConfig.excludeWeekends,
          slaConfig.businessHoursOnly,
          tz
        );

        if (scenarioResult.success) {
          results.examples.push({
            scenario: scenario.name,
            startDate: this.formatSLADate(scenario.startDate, undefined, tz),
            dueDate: this.formatSLADate(scenarioResult.dueDate, undefined, tz),
            duration: this._formatDuration(differenceInHours(scenarioResult.dueDate, scenario.startDate)),
            businessDaysOnly: slaConfig.excludeWeekends
          });
        }
      }

      // Add warnings for potential issues
      if (slaConfig.unit === 'hours' && slaConfig.duration > 168) {
        results.warnings.push('Duration exceeds 1 week (168 hours). Consider using days instead.');
      }

      if (slaConfig.excludeWeekends && slaConfig.unit === 'hours' && slaConfig.duration < 8) {
        results.warnings.push('Weekend exclusion with short durations may not have significant impact.');
      }

      if (!slaConfig.excludeWeekends && slaConfig.duration > 5 && slaConfig.unit === 'days') {
        results.warnings.push('Consider enabling weekend exclusion for durations longer than 5 days.');
      }

    } catch (error) {
      results.isValid = false;
      results.errors.push(`Simulation failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Helper methods for generating test scenarios
   * @private
   */
  static _getNextMondayMorning(fromDate) {
    const date = new Date(fromDate);
    const dayOfWeek = date.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // 0 = Sunday
    date.setDate(date.getDate() + daysUntilMonday);
    date.setHours(9, 0, 0, 0); // 9 AM
    return date;
  }

  static _getNextFridayAfternoon(fromDate) {
    const date = new Date(fromDate);
    const dayOfWeek = date.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
    date.setDate(date.getDate() + daysUntilFriday);
    date.setHours(16, 0, 0, 0); // 4 PM
    return date;
  }

  static _getNextSaturdayMorning(fromDate) {
    const date = new Date(fromDate);
    const dayOfWeek = date.getDay();
    const daysUntilSaturday = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
    date.setDate(date.getDate() + daysUntilSaturday);
    date.setHours(10, 0, 0, 0); // 10 AM
    return date;
  }
}

// Convenience functions for common operations
export const calculateSLADueDate = SLACalculator.calculateDueDate.bind(SLACalculator);
export const getSLAStatus = SLACalculator.getSLAStatus.bind(SLACalculator);
export const formatSLADate = SLACalculator.formatSLADate.bind(SLACalculator);

// Default export
export default SLACalculator;