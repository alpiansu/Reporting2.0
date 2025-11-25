import logger from "../../../config/logger.js";

/**
 * Check saldo quantity accuracy (zero tolerance)
 */
export async function saldo_qty_accuracy(connection, context, rule) {
  const { tblFilet, saldoBlnQty } = context;

  const query = rule.query.sql.replace("{tblFilet}", tblFilet);
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.saldo || 0;
  const expectedValue = Number(saldoBlnQty);

  const delta = Math.abs(actualValue - expectedValue);
  const passed = delta === rule.validation.tolerance;

  return {
    passed,
    expected: expectedValue,
    actual: actualValue,
    delta: delta,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage
          .replace("{actual}", actualValue)
          .replace("{expected}", expectedValue)
          .replace("{delta}", delta),
  };
}

/**
 * Check saldo rupiah accuracy (tolerance ± 50)
 */
export async function saldo_rp_accuracy(connection, context, rule) {
  const { tblFilet, saldoBlnRp } = context;

  const query = rule.query.sql.replace("{tblFilet}", tblFilet);
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.rp_sld || 0;
  const expectedValue = Number(saldoBlnRp);

  const delta = Math.abs(actualValue - expectedValue);
  const passed = delta <= rule.validation.tolerance;

  return {
    passed,
    expected: expectedValue,
    actual: actualValue,
    delta: delta,
    message: passed
      ? rule.validation.passMessage.replace("{delta}", delta)
      : rule.validation.failMessage
          .replace("{actual}", actualValue.toLocaleString("id-ID"))
          .replace("{expected}", expectedValue.toLocaleString("id-ID"))
          .replace("{delta}", delta.toLocaleString("id-ID")),
  };
}

/**
 * Check saldo vs stmast (manual check required)
 */
export async function saldo_stmast_accuracy(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);

  const begbal = rows[0]?.begbal || 0;
  const rp_stmast = rows[0]?.rp_stmast || 0;

  // This is a manual check - always pass but return data for inspection
  const passed = true;

  return {
    passed,
    expected: rule.validation.expected,
    actual: { begbal, rp_stmast },
    message: passed ? rule.validation.passMessage : rule.validation.failMessage,
  };
}
