/**
 * SSE write helper: guard koneksi + backpressure (health fix issue 12).
 *
 * res.write() mengembalikan false ketika buffer socket penuh (client lambat
 * / macet). Jika dipaksa terus, memori server menumpuk tanpa batas. Strategy:
 * - Event DROPPABLE (snapshot yang event berikutnya menimpa — progress/job
 *   update) ditahan selama buffer penuh dan dilanjutkan setelah 'drain'.
 * - Event non-droppable (init, terminal complete/fail/cancelled, remove,
 *   heartbeat) tetap ditulis — jumlahnya kecil dan klien membutuhkannya.
 * - Client sehat (write selalu true) tidak mengalami perubahan apa pun;
 *   payload per event tetap byte-identik.
 */

/**
 * @param {import('http').ServerResponse} res - response SSE
 * @param {string} chunk - payload event yang sudah utuh (event+data atau comment)
 * @param {{ droppable?: boolean }} [options] - true untuk snapshot yang boleh ditahan
 * @returns {boolean} true jika chunk tertulis ke stream
 */
export function sseWrite(res, chunk, { droppable = false } = {}) {
  if (!res || res.writableEnded || res.destroyed) return false;
  if (droppable && res.sseBlocked) return false;

  const ok = res.write(chunk);

  if (!ok && !res.sseBlocked) {
    res.sseBlocked = true;
    res.once("drain", () => {
      res.sseBlocked = false;
    });
  }

  return ok;
}
