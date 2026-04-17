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
  // Gunakan rule.validation.expected, jika tak ada, gunakan cadangan rule.query.compareWith
  let rawExpected = expected !== undefined && expected !== null ? expected : (rule.query?.compareWith ?? null);
  let processedExpected = rawExpected;

  if (typeof rawExpected === "string") {
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      processedExpected = processedExpected.replace(regex, value ?? "");
    }
    // Cleanup tak tersisa: Apabila ada tag {...} yang datanya gaib/hilang dari WRC Server (e.g gara-gara store tak ada data), ganti ke 0
    processedExpected = processedExpected.replace(/\{[a-zA-Z0-9_]+\}/g, "0");
  }

  let passed = false;
  
  // Perhitungan Delta (kalkulasi simpangan selisih numerik)
  let numericActual = Number(actualValue);
  let numericExpected = Number(processedExpected);
  let deltaValue = (isNaN(numericActual) || isNaN(numericExpected)) ? null : Math.abs(numericActual - numericExpected);

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
    case "NOT_NULL":
    case "IS_NOT_NULL":
      // Dukungan Backward Compatibility untuk rule lama yang mensyaratkan "expected": "valid_date" di bawah bendera NOT_NULL
      if (String(processedExpected).toLowerCase() === "valid_date") {
        passed = actualValue !== null && 
                 actualValue !== undefined && 
                 actualValue !== "" && 
                 String(actualValue) !== "0000-00-00" && 
                 String(actualValue) !== "0000-00-00 00:00:00";
      } else {
        passed = actualValue !== null && actualValue !== undefined && actualValue !== "";
      }
      break;
    case "VALID_DATE":
      // Validasi Tanggal Khusus: Tolak null, undefined, string kosong, dan format tanggal invalid bawaan MySQL.
      passed = actualValue !== null && 
               actualValue !== undefined && 
               actualValue !== "" && 
               String(actualValue) !== "0000-00-00" && 
               String(actualValue) !== "0000-00-00 00:00:00";
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
    case "DELTA_EQUALS":
      // Toleransi harus sama persis dengan angka yang tertera di JSON (default: 0)
      passed = deltaValue !== null && deltaValue === (rule.validation.tolerance || 0);
      break;
    case "DELTA_WITHIN":
      // Hasil selisih tidak boleh melebihi batas toleransi maksimal di JSON
      passed = deltaValue !== null && deltaValue <= (rule.validation.tolerance || 0);
      break;
    case "CUSTOM":
      // Trigger logik manual (secara default di-fail-kan ke issues karena selalu butuh visualisasi manual stmast dsb)
      // Namun karena rata-rata tingkat errornya severity: "low", tidak menghalangi status isReady = true
      passed = false;
      break;
    default:
      logger.warn(`[GenericValidator] Unsupported operator '${operator}' in rule '${rule.key}'`);
      passed = false;
  }

  // Format message correctly
  const message = passed 
    ? (passMessage || "Validation passed") 
    : (failMessage || "Validation failed")
        .replace(/{actual}/g, actualValue !== null ? actualValue : "NULL")
        .replace(/{expected}/g, processedExpected !== null ? processedExpected : "NULL")
        .replace(/{delta}/g, deltaValue !== null ? deltaValue : "NULL");

  return {
    passed,
    expected: processedExpected,
    actual: actualValue,
    delta: deltaValue,
    message,
  };
}
