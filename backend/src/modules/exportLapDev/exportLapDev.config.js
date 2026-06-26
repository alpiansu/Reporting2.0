import mysqlSync from "mysql2/promise";
import logger from "../../config/logger.js";

export const connReporting = {
  host: "192.168.133.3",
  user: "edp",
  password: "cUm4l!h4t@datA",
  database: "web_reporting",
  timezone: "+00:00",
  dateStrings: true,
  multipleStatements: true,
};

export const strConnEDP = {
  host: "192.168.133.3",
  user: "edp",
  password: "cUm4l!h4t@datA",
  database: "db_edp",
  multipleStatements: true,
  timezone: "+00:00",
  dateStrings: true,
};

export const getConWRC = async (cab) => {
  let conDBEdp;
  try {
    conDBEdp = await mysqlSync.createConnection(strConnEDP);
    const [rows] = await conDBEdp.execute(
      `select * from db_edp.config_cabang where rkey='constringwrc' and kode_cab='${cab}'`
    );
    let constringWRC = {};
    if (rows.length > 0) {
      const rawString = rows[0].nilai;
      const pairs = rawString.split(";");
      const parsed = {};
      pairs.forEach((pair) => {
        const idx = pair.indexOf("=");
        if (idx === -1) return;
        const key = pair.substring(0, idx).trim().toLowerCase();
        const value = pair.substring(idx + 1).trim();
        parsed[key] = value;
      });
      constringWRC = {
        host: parsed["server"] || parsed["host"] || "",
        user: parsed["uid"] || parsed["user id"] || parsed["user"] || "",
        password: parsed["password"] || "",
        database: parsed["database"] || "poscabang",
        multipleStatements: true,
        dateStrings: ["DATE", "DATETIME"],
        waitForConnections: true,
        queueLimit: 0,
        connectionLimit: 5,
        keepAliveInitialDelay: 10000,
        enableKeepAlive: true,
      };
    }
    return constringWRC;
  } catch (err) {
    logger.error("[exportLapDev.config.getConWRC] " + err.message);
    return {};
  } finally {
    if (conDBEdp) {
      try { await conDBEdp.destroy(); } catch (e) { /* ignore */ }
    }
  }
};

export const conDataDC = async (kodeDC) => {
  kodeDC = kodeDC.toUpperCase();
  if (kodeDC == "G033") {
    return {
      host: "192.168.61.101",
      user: "cabang",
      password: "Server@tgr2",
      database: "dc",
      timezone: "+00:00",
      dateStrings: true,
      multipleStatements: true,
    };
  }
  return null;
};

export const branchApp = async (kodeDC) => {
  kodeDC = kodeDC.toUpperCase();
  if (kodeDC == "G033") {
    return {
      host: "192.168.61.224",
      user: "root",
      password: "456789",
      database: "dev",
      timezone: "+00:00",
      dateStrings: true,
      multipleStatements: true,
    };
  }
  return null;
};
