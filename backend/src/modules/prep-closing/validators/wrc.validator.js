import logger from "../../../config/logger.js";

/**
 * Check if bln_sls matches expected value
 */
export async function bln_sls_check(connection, context, rule) {
  const { strYear, strMonth, strBlnSlsWrc } = context;

  const query = rule.query.sql
    .replace("{year}", strYear)
    .replace("{month}", strMonth)
    .replace("{strBlnSlsWrc}", strBlnSlsWrc);

  const [rows] = await connection.query(query);
  const actualValue = rows.length > 0 && rows[0].bln_sls ? rows[0].bln_sls : null;

  const passed = actualValue === null;

  return {
    passed,
    expected: strBlnSlsWrc,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue || "NULL"),
  };
}

/**
 * Check if ada_bln_akt exists
 */
export async function ada_bln_akt_check(connection, context, rule) {
  const { strYear, strMonth } = context;

  const query = rule.query.sql.replace("{year}", strYear).replace("{month}", strMonth);

  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.ada_bln_akt || 0;

  const passed = actualValue > rule.validation.expected;

  return {
    passed,
    expected: `> ${rule.validation.expected}`,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage,
  };
}

/**
 * Check if terakhir_bln_akt matches WRC
 */
export async function terakhir_bln_akt_check(connection, context, rule) {
  const { strMaxBlnAktWrc } = context;

  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.terakhir_bln_akt || null;

  const passed = actualValue === strMaxBlnAktWrc;

  return {
    passed,
    expected: strMaxBlnAktWrc,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue).replace("{expected}", strMaxBlnAktWrc),
  };
}
