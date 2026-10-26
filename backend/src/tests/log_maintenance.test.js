jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logDir: "logs",
}));

import fsp from "fs/promises";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import dayjs from "dayjs";
import jwtConfig from "../config/jwt.js";
import LogMaintenanceService from "../modules/log-maintenance/log-maintenance.service.js";
import logMaintenanceRoutes from "../modules/log-maintenance/log-maintenance.routes.js";

let tempDir;
let service;

const user = { id: 1, username: "root", role: "superadmin" };

const filePath = name => path.join(tempDir, name);
const writeLog = (name, content) => fsp.writeFile(filePath(name), content);
const logLine = (timestamp, message, level = "info") =>
  JSON.stringify({ level, message, service: "test", timestamp });

beforeEach(async () => {
  tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "log-maintenance-"));
  service = new LogMaintenanceService({ logDir: tempDir });
});

afterEach(async () => {
  await fsp.rm(tempDir, { recursive: true, force: true });
});

describe("LogMaintenanceService listFiles", () => {
  test("only lists allowed log files and computes summary", async () => {
    await writeLog("app-2026-01-01.log", "app\n");
    await writeLog("error-2026-01-02.log", "error\n");
    await writeLog("app-2026-01-03.log.1.gz", "compressed");
    await writeLog("app-2026-01-03.log.audit.json", "{}");
    await writeLog("notes.txt", "ignore");

    const activeName = `app-${dayjs().format("YYYY-MM-DD")}.log`;
    await writeLog(activeName, "active\n");

    const result = await service.listFiles();
    const names = result.files.map(file => file.name).sort();

    expect(names).toEqual(
      ["app-2026-01-01.log", "app-2026-01-03.log.1.gz", activeName, "error-2026-01-02.log"].sort(),
    );

    expect(result.summary.totalFiles).toBe(4);
    expect(result.summary.app.count).toBe(3);
    expect(result.summary.error.count).toBe(1);
    expect(result.summary.totalSize).toBeGreaterThan(0);

    const active = result.files.find(file => file.name === activeName);
    expect(active.active).toBe(true);
    expect(active.deletable).toBe(false);

    const compressed = result.files.find(file => file.name.endsWith(".gz"));
    expect(compressed.compressed).toBe(true);
    expect(compressed.previewable).toBe(false);
  });
});

describe("LogMaintenanceService getChunk", () => {
  test("reads tail and older chunks without losing lines", async () => {
    const lines = Array.from(
      { length: 200 },
      (_, index) => `line-${String(index).padStart(3, "0")}-${"x".repeat(40)}`,
    );
    const content = `${lines.join("\n")}\n`;
    await writeLog("app-2026-01-04.log", content);

    const pieces = [];
    let cursor;
    let guard = 0;

    while (guard < 100) {
      const chunk = await service.getChunk("app-2026-01-04.log", {
        cursor,
        maxBytes: 4096,
      });

      pieces.unshift(chunk.text);
      cursor = chunk.nextCursor;
      guard += 1;

      if (!chunk.hasMore) break;
    }

    expect(guard).toBeGreaterThan(1);
    expect(pieces.join("")).toBe(content);
  });

  test("rejects compressed log preview", async () => {
    await writeLog("app-2026-01-05.log.gz", "compressed");

    await expect(service.getChunk("app-2026-01-05.log.gz")).rejects.toMatchObject({
      statusCode: 415,
    });
  });

  test("rejects path traversal and non-log filenames", async () => {
    await expect(service.getChunk("../app-2026-01-04.log")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service.getChunk("notes.txt")).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.getChunk("app-2026-01-04.log.audit.json"),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("LogMaintenanceService hours", () => {
  test("indexes lines per hour and reads only the selected hour range", async () => {
    await writeLog(
      "app-2026-01-12.log",
      `${[
        logLine("2026-01-12 10:05:00", "ten-start"),
        logLine("2026-01-12 10:55:00", "ten-end"),
        logLine("2026-01-12 12:01:00", "twelve-start"),
        logLine("2026-01-12 12:30:00", "twelve-end"),
      ].join("\n")}\n`,
    );

    const index = await service.getHours("app-2026-01-12.log");

    expect(index.totalLines).toBe(4);
    expect(index.hours[10]).toMatchObject({ hour: 10, lines: 2 });
    expect(index.hours[11].lines).toBe(0);
    expect(index.hours[12]).toMatchObject({ hour: 12, lines: 2 });
    expect(index.hours[10].startOffset).toBe(0);
    expect(index.hours[10].endOffset).toBe(index.hours[12].startOffset);

    const chunk = await service.getChunk("app-2026-01-12.log", {
      startOffset: index.hours[10].startOffset,
      endOffset: index.hours[10].endOffset,
      maxBytes: 4096,
    });

    expect(chunk.text).toContain("ten-start");
    expect(chunk.text).toContain("ten-end");
    expect(chunk.text).not.toContain("twelve");
    expect(chunk.rangeStart).toBe(index.hours[10].startOffset);
    expect(chunk.rangeEnd).toBe(index.hours[10].endOffset);
  });

  test("rejects compressed files", async () => {
    await writeLog("app-2026-01-12.log.gz", "compressed");

    await expect(service.getHours("app-2026-01-12.log.gz")).rejects.toMatchObject({
      statusCode: 415,
    });
  });
});

describe("LogMaintenanceService search", () => {
  test("returns newest matches first and paginates without duplicates", async () => {
    const lines = Array.from({ length: 10 }, (_, index) =>
      logLine(
        `2026-01-13 10:${String(index).padStart(2, "0")}:00`,
        index % 3 === 0 ? `ERROR match-${index}` : `info other-${index}`,
      ),
    );
    await writeLog("app-2026-01-13.log", `${lines.join("\n")}\n`);

    const first = await service.search("app-2026-01-13.log", {
      q: "error",
      limit: 2,
    });

    expect(first.results.map(result => result.message)).toEqual([
      "ERROR match-9",
      "ERROR match-6",
    ]);
    expect(first.hasMore).toBe(true);

    const second = await service.search("app-2026-01-13.log", {
      q: "error",
      limit: 2,
      cursor: first.nextCursor,
    });

    expect(second.results.map(result => result.message)).toEqual([
      "ERROR match-3",
      "ERROR match-0",
    ]);
    expect(second.hasMore).toBe(false);
  });

  test("rejects short queries and compressed files", async () => {
    await writeLog("app-2026-01-13.log", `${logLine("2026-01-13 10:00:00", "x")}\n`);
    await writeLog("app-2026-01-13.log.gz", "compressed");

    await expect(service.search("app-2026-01-13.log", { q: "x" })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(service.search("app-2026-01-13.log.gz", { q: "error" })).rejects.toMatchObject({
      statusCode: 415,
    });
  });
});

describe("LogMaintenanceService download ticket", () => {
  test("creates and verifies a superadmin download ticket", async () => {
    await writeLog("app-2026-01-06.log", "download me\n");

    const { ticket, expiresIn } = await service.createDownloadTicket(
      "app-2026-01-06.log",
      user,
    );
    const target = await service.getDownloadTarget(ticket);

    expect(expiresIn).toBe(60);
    expect(target.filename).toBe("app-2026-01-06.log");
    expect(target.size).toBe(Buffer.byteLength("download me\n"));
  });

  test("rejects non-superadmin and invalid tickets", async () => {
    await writeLog("app-2026-01-06.log", "download me\n");

    await expect(
      service.createDownloadTicket("app-2026-01-06.log", { id: 2, role: "admin" }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(service.getDownloadTarget("invalid-ticket")).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe("LogMaintenanceService delete", () => {
  test("deletes an archived log file", async () => {
    await writeLog("app-2026-01-07.log", "delete me\n");

    const result = await service.deleteFile("app-2026-01-07.log", user, {
      ip: "127.0.0.1",
    });

    expect(result.filename).toBe("app-2026-01-07.log");
    expect(result.size).toBe(Buffer.byteLength("delete me\n"));
    await expect(fsp.access(filePath("app-2026-01-07.log"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("rejects delete from non-superadmin", async () => {
    await writeLog("app-2026-01-07.log", "delete me\n");

    await expect(
      service.deleteFile("app-2026-01-07.log", { id: 2, role: "admin" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.bulkDelete(["app-2026-01-07.log"], { id: 2, role: "admin" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(fsp.access(filePath("app-2026-01-07.log"))).resolves.toBeUndefined();
  });

  test("never deletes the active log file", async () => {
    const activeName = `app-${dayjs().format("YYYY-MM-DD")}.log`;
    await writeLog(activeName, "active\n");

    await expect(service.deleteFile(activeName, user)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("LogMaintenanceService bulkDelete", () => {
  test("deletes valid files and skips active, missing, and invalid files", async () => {
    const activeName = `error-${dayjs().format("YYYY-MM-DD")}.log`;
    await writeLog("app-2026-01-08.log", "a\n");
    await writeLog("app-2026-01-09.log.gz", "compressed");
    await writeLog(activeName, "active\n");

    const result = await service.bulkDelete(
      [
        "app-2026-01-08.log",
        "app-2026-01-09.log.gz",
        activeName,
        "../evil.log",
        "error-2026-01-10.log",
      ],
      user,
    );

    expect(result.deleted).toHaveLength(2);
    expect(result.skipped).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    await expect(fsp.access(filePath("app-2026-01-08.log"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fsp.access(filePath(activeName))).resolves.toBeUndefined();
  });
});

describe("LogMaintenance routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/log-maintenance", logMaintenanceRoutes);

  const tokenFor = role =>
    jwt.sign({ id: 1, username: "root", role }, jwtConfig.JWT_SECRET, {
      expiresIn: "1m",
    });

  test("requires authentication and superadmin role", async () => {
    await request(app).get("/api/log-maintenance/files").expect(401);
    await request(app)
      .get("/api/log-maintenance/files")
      .set("Authorization", `Bearer ${tokenFor("admin")}`)
      .expect(403);

    const response = await request(app)
      .get("/api/log-maintenance/files")
      .set("Authorization", `Bearer ${tokenFor("superadmin")}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.files)).toBe(true);
  });

  test("download endpoint rejects missing ticket without JWT", async () => {
    const response = await request(app).get("/api/log-maintenance/download").expect(401);

    expect(response.body.success).toBe(false);
  });
});
