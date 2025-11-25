import logger from "../../../config/logger.js";

/**
 * Check virtual discount 05 status
 */
export async function vir_disc05_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.vir_disc05 || null;

  const passed = actualValue === rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue || "NULL"),
  };
}

/**
 * Check bebas PPN per sub BKP
 */
export async function bebasppn_persubbkp_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.bebasppn || null;

  const passed = actualValue === rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue || "NULL"),
  };
}

/**
 * Check flag produk potongan
 */
export async function mulai_flagprodpot_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.flagprodpot || null;

  const passed = actualValue === rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue || "NULL"),
  };
}

/**
 * Check konstanta PRD
 */
export async function const_prd_check(connection, context, rule) {
  const { strPrd } = context;

  const query = rule.query.sql.replace("{strPrd}", strPrd);
  const [rows] = await connection.query(query);
  const actualValue = rows.length > 0 && rows[0].const_prd ? rows[0].const_prd : null;

  const passed = actualValue === null;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage.replace("{actual}", actualValue),
  };
}

/**
 * Check konstanta CPI
 */
export async function const_cpi_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.const_cpi || null;

  // Check if not null and not '0000-00-00'
  const passed = actualValue !== null && actualValue !== "0000-00-00";

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue || "NULL"),
  };
}

/**
 * Check konstanta SHI
 */
export async function const_shi_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.period1_shi || null;

  const passed = actualValue !== null;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage,
  };
}

/**
 * Check konstanta HIH
 */
export async function const_hih_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.const_hih || null;

  const passed = actualValue !== null;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage,
  };
}

/**
 * Check konstanta BRK
 */
export async function const_brk_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.const_brk || null;

  const passed = actualValue === rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue || "NULL"),
  };
}

/**
 * Check SO produk khusus
 */
export async function so_produk_khusus_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.so_produk_khusus || 0;

  const passed = actualValue > rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage.replace("{actual}", actualValue)
      : rule.validation.failMessage.replace("{actual}", actualValue),
  };
}

/**
 * Check plastik berbayar
 */
export async function plastik_berbayar_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.berbayar || null;

  const passed = rule.validation.expected.includes(actualValue);

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed
      ? rule.validation.passMessage
      : rule.validation.failMessage.replace("{actual}", actualValue || "NULL"),
  };
}

/**
 * Check data initial
 */
export async function initial_data_check(connection, context, rule) {
  const query = rule.query.sql;
  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.tgl_initial || null;

  const passed = actualValue === null;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage.replace("{actual}", actualValue),
  };
}

/**
 * Check status pajak WS
 */
export async function pajak_ws_check(connection, context, rule) {
  const { strYear, strMonth } = context;

  const query = rule.query.sql.replace("{year}", strYear).replace("{month}", strMonth);

  const [rows] = await connection.query(query);
  const actualValue = rows[0]?.cek_pajak_ws || null;

  const passed = actualValue === rule.validation.expected;

  return {
    passed,
    expected: rule.validation.expected,
    actual: actualValue,
    message: passed ? rule.validation.passMessage : rule.validation.failMessage,
  };
}
