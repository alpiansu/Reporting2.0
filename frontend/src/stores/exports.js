import { defineStore } from "pinia";
import monthlyReportsService from "@/services/monthlyReports.service";

// Berapa lama job terminal (failed/cancelled) dipertahankan di UI sebelum dihapus
const TERMINAL_HOLD_MS = 3000;

/**
 * Store Export Laporan — SELF-CONTAINED (tidak memakai modul progress/screening).
 *
 * Tanggung jawab:
 *   1. Monitor semua job export milik user via SSE (GET /export/stream).
 *   2. Mulai & batalkan job (DELETE /export/:taskId).
 *   3. Auto-download saat job selesai (dari halaman mana pun — store hidup
 *      di level aplikasi, bukan di satu view).
 *   4. Notifikasi global via window event 'export-notify' (ditampilkan widget).
 *   5. Daftar "File Siap Diunduh" (completed) untuk panel cadangan.
 */
export const useExportsStore = defineStore("exports", {
  state: () => ({
    jobs: {}, // taskId → job { taskId, status, percentage, message, queuePosition, reportName, cab, prd, fileName, error, createdAt, updatedAt }
    eventSource: null,
    isInitialized: false,
    autoExpandOnNewTask: true,
  }),

  getters: {
    allJobs: (state) =>
      Object.values(state.jobs).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    activeJobs: (state) =>
      Object.values(state.jobs).filter((j) =>
        ["queued", "processing"].includes(j.status),
      ),
    hasActiveJobs: (getters) => getters.activeJobs.length > 0,
    readyJobs: (state) =>
      Object.values(state.jobs).filter((j) => j.status === "completed"),
    hasReadyJobs: (getters) => getters.readyJobs.length > 0,
    totalPercentage: (getters) => {
      const active = getters.activeJobs;
      if (active.length === 0) return 0;
      const sum = active.reduce((acc, j) => acc + (j.percentage || 0), 0);
      return Math.round(sum / active.length);
    },
    // Job paling relevan untuk widget (terbaru dari yang aktif)
    mainJob: (getters) =>
      getters.activeJobs[getters.activeJobs.length - 1] || null,
  },

  actions: {
    /** Mulai monitoring SSE global export (dipanggil sekali dari widget/layout). */
    initMonitoring() {
      if (this.isInitialized && this.eventSource) return;
      this.isInitialized = true;

      this.eventSource = monthlyReportsService.monitorExports({
        onInit: (jobs) => {
          (jobs || []).forEach((j) => this._upsertJob(j, false));
        },
        onUpdate: (job) => this._upsertJob(job, true),
        onRemove: ({ taskId }) => {
          delete this.jobs[taskId];
        },
      });

      this.eventSource.onerror = (err) => {
        console.error("❌ Export SSE Connection Error:", err);
        // Coba sambung ulang setelah 5 detik
        setTimeout(() => {
          if (this.isInitialized) {
            this.stopMonitoring();
            this.initMonitoring();
          }
        }, 5000);
      };
    },

    stopMonitoring() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.isInitialized = false;
    },

    /**
     * Gabungkan update job ke state + efek samping:
     * auto-download (completed) & notifikasi (terminal).
     */
    _upsertJob(job, expand) {
      if (!job?.taskId) return;
      const prevStatus = this.jobs[job.taskId]?.status;
      this.jobs[job.taskId] = { ...job };

      if (
        expand &&
        ["queued", "processing"].includes(job.status) &&
        this.autoExpandOnNewTask
      ) {
        window.dispatchEvent(new CustomEvent("progress-widget-expand"));
      }

      // Efek samping (auto-download + notifikasi) HANYA untuk transisi LIVE via SSE
      // (expand=true). Data historis dari init/refresh (expand=false) tidak boleh
      // memicu unduhan/toast mendadak saat halaman dimuat.
      if (expand && prevStatus !== job.status) {
        // Baru saja selesai → unduh otomatis
        if (job.status === "completed") {
          this._autoDownload(job);
        }

        // Transisi ke status terminal → notifikasi global
        if (["completed", "failed", "cancelled"].includes(job.status)) {
          this._notifyTerminal(job);
          if (job.status === "failed" || job.status === "cancelled") {
            setTimeout(() => {
              if (this.jobs[job.taskId]?.status === job.status) {
                delete this.jobs[job.taskId];
              }
            }, TERMINAL_HOLD_MS);
          }
        }
      }
    },

    /** Unduh file otomatis saat job completed (dari halaman mana pun). */
    async _autoDownload(job) {
      try {
        const res = await monthlyReportsService.downloadExportFile(job.taskId);
        this.triggerDownload(res, job.reportName || job.taskId);
      } catch (err) {
        console.error("Auto-download gagal:", err);
        this._notify(
          "error",
          "Unduh Gagal",
          `${job.reportName || "Laporan"}: ${err.response?.data?.message || err.message}`,
        );
      }
    },

    _notifyTerminal(job) {
      if (job.status === "completed") {
        this._notify(
          "success",
          "Export Selesai",
          `"${job.reportName}" siap diunduh.`,
        );
      } else if (job.status === "failed") {
        this._notify(
          "error",
          "Export Gagal",
          `"${job.reportName}": ${job.error || "Terjadi kesalahan"}`,
        );
      } else if (job.status === "cancelled") {
        this._notify("info", "Dibatalkan", `Export "${job.reportName}" dibatalkan.`);
      }
    },

    /** Broadcast notifikasi global — ditampilkan FloatingProgressWidget (toast). */
    _notify(type, title, message) {
      window.dispatchEvent(
        new CustomEvent("export-notify", { detail: { type, title, message } }),
      );
    },

    /**
     * Mulai export via backend (masuk antrian FIFO). Entry optimis ditambahkan
     * agar UI langsung responsif; SSE akan menyempurnakan state.
     * @returns {Promise<string>} taskId
     */
    async startExport(id, { cab, prd, reportName }) {
      const res = await monthlyReportsService.startExport(id, { cab, prd });
      const taskId = res.data?.taskId;
      if (!taskId) throw new Error("Backend tidak mengembalikan taskId");

      if (!this.jobs[taskId]) {
        const now = new Date().toISOString();
        this.jobs[taskId] = {
          taskId,
          status: "queued",
          percentage: 0,
          message: "Menunggu giliran proses...",
          queuePosition: 0,
          reportName: reportName || "Laporan",
          reportId: id,
          cab,
          prd,
          error: null,
          createdAt: now,
          updatedAt: now,
        };
      }
      return taskId;
    },

    /** Batalkan job (initiator/admin; backend memvalidasi). */
    async cancelTask(taskId) {
      await monthlyReportsService.cancelExport(taskId);
      // Status akan dikoreksi via SSE; optimis set 'cancelled' agar UI langsung merespons
      if (this.jobs[taskId]) {
        this.jobs[taskId].status = "cancelled";
        this.jobs[taskId].message = "Membatalkan...";
      }
    },

    /** Sinkronisasi daftar job dari backend (panel "File Siap Diunduh"). */
    async refreshReadyJobs() {
      try {
        const res = await monthlyReportsService.listExports();
        const jobs = res.data?.data?.jobs || [];
        jobs.forEach((j) => this._upsertJob(j, false));
        return this.readyJobs;
      } catch (err) {
        console.error("Gagal memuat daftar export:", err);
        return [];
      }
    },

    /**
     * Trigger download Blob ke browser (nama file dari Content-Disposition).
     * Dipakai auto-download & tombol manual panel "File Siap Diunduh".
     */
    triggerDownload(res, fallbackName) {
      const contentType = res.headers?.["content-type"] || "";
      const contentDisp = res.headers?.["content-disposition"] || "";

      let fileExt = ".xlsx";
      let mimeType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (contentType.includes("application/pdf")) {
        fileExt = ".pdf";
        mimeType = "application/pdf";
      } else if (contentType.includes("text/csv")) {
        fileExt = ".csv";
        mimeType = "text/csv;charset=utf-8";
      }

      let fileName = `${fallbackName || "laporan"}${fileExt}`;
      const filenameMatch = contentDisp.match(/filename="?([^";\n]+)"?/);
      if (filenameMatch) {
        fileName = decodeURIComponent(filenameMatch[1]);
      }

      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  },
});
