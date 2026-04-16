import logger from "../../../config/logger.js";

/**
 * Generic validator to execute freeform SQL for new rules
 * It supports standard comparison operators.
 */
export async function generic_sql_check(connection, context, rule) {
  const { sql } = rule.query;
  const { expected, operator, passMessage, failMessage } = rule.validation;

  // Replace placeholders in SQL with context variables
  let processedSql = sql;
  for (const [key, value] of Object.entries(context)) {
    // Escape or apply value if it's string format (simple replacement for now)
    const regex = new RegExp(`\\{${key}\\}`, "g");
    processedSql = processedSql.replace(regex, value ?? "");
  }

  logger.debug(`[GenericValidator] Executing generic rule '${rule.key}' with query: ${processedSql}`);
  
  const [rows] = await connection.query(processedSql);
  
  // By default, assume the query returns a single row with a single column containing the value we want.
  // We'll extract the first value of the first row.
  let actualValue = null;
  if (rows && rows.length > 0) {
    const keys = Object.keys(rows[0]);
    if (keys.length > 0) {
      actualValue = rows[0][keys[0]];
    }
  }

  // Parse expected value if there's any dynamic context variable in it
  let processedExpected = expected;
  if (typeof expected === "string") {
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      processedExpected = processedExpected.replace(regex, value ?? "");
    }
  }

  let passed = false;

  // Execute Dynamic Operator Evaluation
  switch (operator) {
    case "EQUALS":
      passed = String(actualValue) === String(processedExpected);
      break;
    case "NOT_EQUALS":
      passed = String(actualValue) !== String(processedExpected);
      break;
    case "IS_NULL":
      passed = actualValue === null || actualValue === undefined || actualValue === "";
      break;
    case "IS_NOT_NULL":
      passed = actualValue !== null && actualValue !== undefined && actualValue !== "";
      break;
    case "GREATER_THAN":
      passed = Number(actualValue) > Number(processedExpected);
      break;
    case "GREATER_THAN_OR_EQUALS":
      passed = Number(actualValue) >= Number(processedExpected);
      break;
    case "LESS_THAN":
      passed = Number(actualValue) < Number(processedExpected);
      break;
    case "LESS_THAN_OR_EQUALS":
      passed = Number(actualValue) <= Number(processedExpected);
      break;
    case "IN":
      if (Array.isArray(processedExpected)) {
        passed = processedExpected.includes(actualValue);
      } else {
        passed = String(processedExpected).split(",").map(i => i.trim()).includes(String(actualValue));
      }
      break;
    default:
      logger.warn(`[GenericValidator] Unsupported operator '${operator}' in rule '${rule.key}'`);
      passed = false;
  }

  // Format message correctly
  const message = passed 
    ? (passMessage || "Validation passed") 
    : (failMessage || "Validation failed")
        .replace("{actual}", actualValue !== null ? actualValue : "NULL")
        .replace("{expected}", processedExpected !== null ? processedExpected : "NULL");

  return {
    passed,
    expected: processedExpected,
    actual: actualValue,
    message,
  };
}
