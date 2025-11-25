import logger from "../../../config/logger.js";

/**
 * Check if filet table exists for current period
 */
export async function filet_table_check(connection, context, rule) {
  const { tblFilet } = context;

  const query = rule.query.sql.replace("{tblFilet}", tblFilet);
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.filet_lama || 0;

  const passed = actualValue > rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage.replace("{tblFilet}", tblFilet),
  };
}

/**
 * Check if filet table for next period doesn't exist (premature)
 */
export async function filetbaru_check(connection, context, rule) {
  const { tblFiletMaju } = context;

  const query = rule.query.sql.replace("{tblFiletMaju}", tblFiletMaju);
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.filetbaru_baru || 0;

  const passed = actualValue === rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage.replace("{tblFiletMaju}", tblFiletMaju),
  };
}

/**
 * Check if backup database exists
 */
export async function db_backup_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.db_backup || 0;

  const passed = actualValue > rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage,
  };
}
