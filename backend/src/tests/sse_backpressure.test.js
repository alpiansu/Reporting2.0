/**
 * Unit Tests: Health fix issue #12 — SSE backpressure guard
 *   - sseWrite: client sehat tidak berubah; client lambat (write=false)
 *     → event droppable BERIKUTNYA ditahan, event non-droppable tetap ditulis,
 *     setelah 'drain' event droppable dilanjutkan.
 *   - progress.controller (streamAllProgress): chunk per event tetap satu,
 *     heartbeat jalan, cleanup on close.
 *   - GlobalProgressService.sendToClient: snapshot running boleh ditahan,
 *     status terminal selalu dikirim.
 *
 * Run with: npx jest --testPathPatterns sse_backpressure
 */

jest.mock("../config/logger.js", () => {
  // GlobalProgressService membuat interval module-level "auto cleanup" tiap 1 jam
  // saat di-import. Tanpa unref, worker jest tetap hidup setelah test selesai.
  // Wrap setInterval di sini (factory jalan sebelum body module) → timer hourly
  // langsung di-unref. Murni test-only, tidak menyentuh kode produksi.
  const originalSetInterval = global.setInterval;
  global.setInterval = function wrappedSetInterval(...args) {
    const timer = originalSetInterval.apply(this, args);
    if (args[1] >= 60 * 60 * 1000 && timer && typeof timer.unref === "function") timer.unref();
    return timer;
  };
  return {
    __esModule: true,
    default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
  };
});

// progress.service menyentuh fs untuk progress.json — tidak dipakai di sini
jest.mock("fs", () => ({ existsSync: jest.fn(() => true), mkdirSync: jest.fn(), writeFileSync: jest.fn() }));
jest.mock("fs/promises", () => ({ readFile: jest.fn(async () => "{}"), writeFile: jest.fn(async () => {}), rename: jest.fn(async () => {}) }));

import { sseWrite } from "../utils/sse.utils.js";
import progressService from "../modules/progress/progress.service.js";
import { streamAllProgress } from "../modules/progress/progress.controller.js";
import globalProgressService from "../services/progress/GlobalProgressService.js";

function makeRes({ writeReturns = true } = {}) {
  const res = {
    written: [],
    writableEnded: false,
    destroyed: false,
    sseBlocked: false,
    _drain: null,
    drainRegistrations: 0,
    write(chunk) {
      res.written.push(chunk);
      return writeReturns;
    },
    once(ev, fn) {
      if (ev === "drain") {
        res._drain = fn;
        res.drainRegistrations += 1;
      }
    },
    on() {},
    set() {},
    flushHeaders() {},
    end() {
      res.writableEnded = true;
    },
    triggerDrain() {
      if (res._drain) {
        const fn = res._drain;
        res._drain = null;
        fn();
      }
    },
  };
  return res;
}

// Semua handler "close" request dikumpulkan lalu dipicu di afterEach supaya
// heartbeat interval tidak menggantung dan worker jest bisa exit.
let openClosers = [];

function makeReq() {
  return {
    on: (ev, fn) => {
      if (ev === "close") openClosers.push(fn);
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  openClosers = [];
});

afterEach(() => {
  openClosers.forEach(fn => fn());
  openClosers = [];
  jest.useRealTimers();
});

describe("sseWrite (util)", () => {
  test("client sehat: chunk tertulis, tidak ada listener drain", () => {
    const res = makeRes({ writeReturns: true });
    const ok = sseWrite(res, "event: update\ndata: {}\n\n", { droppable: true });
    expect(ok).toBe(true);
    expect(res.written).toEqual(["event: update\ndata: {}\n\n"]);
    expect(res._drain).toBeNull();
  });

  test("buffer penuh: droppable ditahan, non-droppable tetap ditulis, drain melanjutkan", () => {
    const res = makeRes({ writeReturns: false });

    // write pertama (non-droppable) tetap ditulis + menandai blocked
    expect(sseWrite(res, "event: init\ndata: {}\n\n")).toBe(false);
    expect(res.written).toHaveLength(1);
    expect(res.sseBlocked).toBe(true);
    expect(typeof res._drain).toBe("function");

    // droppable ditahan selama blocked
    expect(sseWrite(res, "event: update\ndata: {}\n\n", { droppable: true })).toBe(false);
    expect(res.written).toHaveLength(1);

    // non-droppable berikutnya tetap ditulis dan TIDAK mendaftar listener drain baru
    expect(sseWrite(res, ": heartbeat\n\n")).toBe(false);
    expect(res.written).toHaveLength(2);
    expect(res.drainRegistrations).toBe(1);

    // drain → blocked lepas → droppable ditulis lagi
    res.triggerDrain();
    expect(res.sseBlocked).toBe(false);
    expect(sseWrite(res, "event: update\ndata: {}\n\n", { droppable: true })).toBe(false);
    expect(res.written).toHaveLength(3);
  });

  test("response sudah ended/destroyed: tidak menulis, tidak throw", () => {
    const endedRes = makeRes();
    endedRes.writableEnded = true;
    expect(() => sseWrite(endedRes, "x")).not.toThrow();
    expect(sseWrite(endedRes, "x")).toBe(false);

    const destroyedRes = makeRes();
    destroyedRes.destroyed = true;
    expect(sseWrite(destroyedRes, "x")).toBe(false);

    expect(sseWrite(null, "x")).toBe(false);
  });
});

describe("streamAllProgress (progress.controller)", () => {
  test("emit event → satu chunk per event dengan format event+data yang sama", async () => {
    const res = makeRes({ writeReturns: true });
    await streamAllProgress(makeReq(), res);

    progressService.emit("progressUpdate", { id: "t1", status: "running" });
    expect(res.written.some(c => c.includes('event: update\ndata: {"id":"t1","status":"running"}'))).toBe(true);

    progressService.emit("progressStart", { id: "t2", status: "running" });
    expect(res.written.some(c => c.includes('event: start\ndata: {"id":"t2"'))).toBe(true);
  });

  test("heartbeat tiap 30 detik tetap terkirim", async () => {
    const res = makeRes({ writeReturns: true });
    await streamAllProgress(makeReq(), res);
    await jest.advanceTimersByTimeAsync(30000);
    expect(res.written.some(c => c.startsWith(": heartbeat"))).toBe(true);
  });

  test("client lambat: snapshot update ditahan, init tetap terkirim, drain melanjutkan", async () => {
    const res = makeRes({ writeReturns: false });
    await streamAllProgress(makeReq(), res);

    // init (non-droppable) tetap ditulis meski buffer penuh
    expect(res.written.some(c => c.startsWith("event: init"))).toBe(true);

    // snapshot update ditahan selama blocked
    progressService.emit("progressUpdate", { id: "t1", status: "running" });
    expect(res.written.some(c => c.startsWith("event: update"))).toBe(false);

    // drain → snapshot berikutnya diteruskan
    res.triggerDrain();
    progressService.emit("progressUpdate", { id: "t1", status: "running" });
    expect(res.written.some(c => c.startsWith("event: update"))).toBe(true);
  });

  test("close → res.end dipanggil (cleanup)", async () => {
    const res = makeRes({ writeReturns: true });
    const handlers = {};
    const req = { on: (ev, fn) => { handlers[ev] = fn; openClosers.push(fn); } };
    await streamAllProgress(req, res);

    handlers.close();
    expect(res.writableEnded).toBe(true);
  });
});

describe("GlobalProgressService.sendToClient", () => {
  test("client sehat: payload wrapped terkirim byte-identik", () => {
    const res = makeRes({ writeReturns: true });
    globalProgressService.sendToClient(res, { status: "running", processedItems: 1 });
    expect(res.written).toHaveLength(1);
    const payload = JSON.parse(res.written[0].replace("data: ", "").trim());
    expect(payload.type).toBe("progress");
    expect(payload.data.status).toBe("running");
  });

  test("client lambat: snapshot running berikutnya ditahan, status terminal tetap dikirim", () => {
    const res = makeRes({ writeReturns: false });

    // Event pertama tetap ditulis (masuk buffer socket) & menandai blocked
    globalProgressService.sendToClient(res, { status: "running" });
    expect(res.written).toHaveLength(1);

    // Snapshot running berikutnya ditahan selama buffer penuh
    globalProgressService.sendToClient(res, { status: "running", processedItems: 5 });
    expect(res.written).toHaveLength(1);

    // Status terminal tetap dikirim
    globalProgressService.sendToClient(res, { status: "complete" });
    expect(res.written).toHaveLength(2);
    expect(res.written[1]).toContain('"status":"complete"');
  });

  test("response sudah ended: tidak menulis", () => {
    const res = makeRes();
    res.writableEnded = true;
    expect(() => globalProgressService.sendToClient(res, { status: "running" })).not.toThrow();
    expect(res.written).toHaveLength(0);
  });
});
