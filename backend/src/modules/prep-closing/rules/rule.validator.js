/**
 * Rule validation utility functions
 */
import logger from "../../../config/logger.js";

/**
 * Validate if a value is null
 */
export function validateIsNull(actual, expected) {
  return actual === null;
}

/**
 * Validate if a value is not null
 */
export function validateIsNotNull(actual, expected) {
  return actual !== null && actual !== undefined;
}

/**
 * Validate if values are equal
 */
export function validateEquals(actual, expected) {
  return actual === expected;
}

/**
 * Validate if values are not equal
 */
export function validateNotEquals(actual, expected) {
  return actual !== expected;
}

/**
 * Validate if actual is greater than expected
 */
export function validateGreaterThan(actual, expected) {
  return Number(actual) > Number(expected);
}

/**
 * Validate if actual is greater than or equal to expected
 */
export function validateGreaterThanOrEquals(actual, expected) {
  return Number(actual) >= Number(expected);
}

/**
 * Validate if actual is less than expected
 */
export function validateLessThan(actual, expected) {
  return Number(actual) < Number(expected);
}

/**
 * Validate if actual is in the expected list
 */
export function validateIn(actual, expectedList) {
  if (!Array.isArray(expectedList)) {
    return false;
  }
  return expectedList.includes(actual);
}

/**
 * Validate delta equals (with tolerance)
 */
export function validateDeltaEquals(actual, expected, tolerance = 0) {
  const delta = Math.abs(Number(actual) - Number(expected));
  return delta === tolerance;
}

/**
 * Validate delta within tolerance
 */
export function validateDeltaWithin(actual, expected, tolerance) {
  const delta = Math.abs(Number(actual) - Number(expected));
  return delta <= tolerance;
}

/**
 * Validate date is valid and not '0000-00-00'
 */
export function validateValidDate(actual) {
  if (!actual || actual === "0000-00-00" || actual === "0000-00-00 00:00:00") {
    return false;
  }

  // Try to parse as date
  const date = new Date(actual);
  return !isNaN(date.getTime());
}

/**
 * Generic validator that maps operator to validation function
 */
export function validate(operator, actual, expected, tolerance) {
  switch (operator) {
    case "IS_NULL":
      return validateIsNull(actual, expected);

    case "IS_NOT_NULL":
      return validateIsNotNull(actual, expected);

    case "EQUALS":
      return validateEquals(actual, expected);

    case "NOT_EQUALS":
      return validateNotEquals(actual, expected);

    case "GREATER_THAN":
      return validateGreaterThan(actual, expected);

    case "GREATER_THAN_OR_EQUALS":
      return validateGreaterThanOrEquals(actual, expected);

    case "LESS_THAN":
      return validateLessThan(actual, expected);

    case "IN":
      return validateIn(actual, expected);

    case "DELTA_EQUALS":
      return validateDeltaEquals(actual, expected, tolerance);

    case "DELTA_WITHIN":
      return validateDeltaWithin(actual, expected, tolerance);

    case "CUSTOM":
      // Custom validation should be handled by specific validator
      return true;

    default:
      logger.warn(`[rule.validator] Unknown operator: ${operator}`);
      return false;
  }
}
