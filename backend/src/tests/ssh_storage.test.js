/**
 * Unit Tests for SshStorageService:
 * - extractDefaultPath from various guide texts
 * - parseDfOutput for POSIX single-line format
 * - checkStorage matching logic
 * - fallback mechanisms
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("../modules/ceklist_panduan/ceklist_panduan.service.js", () => ({
  __esModule: true,
  default: {
    getOne: jest.fn(),
    getAll: jest.fn(),
  },
}));

jest.mock("../modules/ceklist-prep-closing/services/space_hdd.service.js", () => ({
  __esModule: true,
  default: {
    upsert: jest.fn().mockImplementation(async (payload) => payload),
  },
}));

import sshStorageService from "../modules/ceklist-prep-closing/services/ssh_storage.service.js";
import ceklistPanduanService from "../modules/ceklist_panduan/ceklist_panduan.service.js";
import spaceHddService from "../modules/ceklist-prep-closing/services/space_hdd.service.js";

describe("SshStorageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("extractDefaultPath", () => {
    it("extracts path from 'df -h /home'", () => {
      expect(sshStorageService.extractDefaultPath("df -h /home")).toBe("/home");
    });

    it("extracts path from 'cek partisi /home/home_lama'", () => {
      expect(sshStorageService.extractDefaultPath("cek partisi /home/home_lama")).toBe("/home/home_lama");
    });

    it("extracts path from 'df -h /dev/sda1'", () => {
      expect(sshStorageService.extractDefaultPath("df -h /dev/sda1")).toBe("/dev/sda1");
    });

    it("extracts path from 'df -h /dev/mapper/centos-home'", () => {
      expect(sshStorageService.extractDefaultPath("df -h /dev/mapper/centos-home")).toBe("/dev/mapper/centos-home");
    });

    it("defaults to /home when input is empty or null", () => {
      expect(sshStorageService.extractDefaultPath("")).toBe("/home");
      expect(sshStorageService.extractDefaultPath(null)).toBe("/home");
    });
  });

  describe("parseDfOutput", () => {
    it("parses POSIX -P standard df output correctly", () => {
      const stdout = [
        "Filesystem 1048576-blocks Used Available Capacity Mounted on",
        "/dev/sda1 51200 10240 40960 20% /",
        "/dev/mapper/centos-home 204800 51200 153600 25% /home",
      ].join("\n");

      const mounts = sshStorageService.parseDfOutput(stdout);
      expect(mounts).toHaveLength(2);

      expect(mounts[0]).toEqual(
        expect.objectContaining({
          filesystem: "/dev/sda1",
          size: 51200,
          used: 10240,
          available: 40960,
          availGb: 40,
          freeSpaceStr: "40 GB",
          capacity: "20%",
          mounted: "/",
          mountedOn: "/",
        })
      );

      expect(mounts[1]).toEqual(
        expect.objectContaining({
          filesystem: "/dev/mapper/centos-home",
          size: 204800,
          used: 51200,
          available: 153600,
          availGb: 150,
          freeSpaceStr: "150 GB",
          capacity: "25%",
          mounted: "/home",
          mountedOn: "/home",
        })
      );
    });

    it("handles empty or invalid output gracefully", () => {
      expect(sshStorageService.parseDfOutput("")).toEqual([]);
      expect(sshStorageService.parseDfOutput("header only")).toEqual([]);
    });
  });

  describe("checkStorage logic with mock SSH", () => {
    it("throws when branch guide is not found or not Linux/SSH", async () => {
      ceklistPanduanService.getOne.mockResolvedValueOnce(null);

      await expect(
        sshStorageService.checkStorage({ kdcab: "G999", periode: "2026-10" })
      ).rejects.toThrow("Data panduan untuk cabang G999 tidak ditemukan");
    });

    it("throws when branch is Windows/RDP instead of Linux/SSH", async () => {
      ceklistPanduanService.getOne.mockResolvedValueOnce({
        KDCAB: "G026",
        NAMACAB: "TANGERANG 1",
        OS: "WINDOWS",
        REMOTE_BULANAN: "VNC",
        IP_BULANAN: "192.168.1.1",
      });

      await expect(
        sshStorageService.checkStorage({ kdcab: "G026", periode: "2026-10" })
      ).rejects.toThrow("tidak menggunakan SSH");
    });

    it("executes SSH df command and persists free space to DB", async () => {
      ceklistPanduanService.getOne.mockResolvedValueOnce({
        KDCAB: "G107",
        OS: "LINUX",
        REMOTE_BULANAN: "SSH",
        IP_BULANAN: "192.168.23.211",
        USER_BULANAN: "edp",
        PASS_BULANAN: "edp@prg",
        HDD_CHECK: "df -h /home",
      });

      // Mock executeSshCommand to avoid real network call
      const dfOutput = [
        "Filesystem 1048576-blocks Used Available Capacity Mounted on",
        "/dev/sda1 51200 10240 40960 20% /",
        "/dev/sdb1 307200 102400 204800 33% /home",
      ].join("\n");

      jest.spyOn(sshStorageService, "executeSshCommand").mockResolvedValueOnce({ stdout: dfOutput, stderr: "" });

      const result = await sshStorageService.checkStorage({
        kdcab: "G107",
        periode: "2026-10",
        targetPath: "/home",
      });

      expect(result.success).toBe(true);
      expect(result.freeSpace).toBe("200 GB"); // 204800 MB / 1024 = 200 GB
      expect(result.targetPath).toBe("/home");
      expect(result.matchedMount).toBe("/home");

      // Verify DB upsert was called via spaceHddService
      expect(spaceHddService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          kdcab: "G107",
          periode: "2026-10",
          freeSpace: "200 GB",
          os: "LINUX",
          ip: "192.168.23.211",
        })
      );
    });

    it("falls back to / or first mount when custom target path is not found", async () => {
      ceklistPanduanService.getOne.mockResolvedValueOnce({
        KDCAB: "G107",
        OS: "LINUX",
        REMOTE_BULANAN: "SSH",
        IP_BULANAN: "192.168.23.211",
        USER_BULANAN: "edp",
        PASS_BULANAN: "edp@prg",
        HDD_CHECK: "df -h /nonexistent",
      });

      const dfOutput = [
        "Filesystem 1048576-blocks Used Available Capacity Mounted on",
        "/dev/sda1 51200 10240 40960 20% /",
      ].join("\n");

      jest.spyOn(sshStorageService, "executeSshCommand").mockResolvedValueOnce({ stdout: dfOutput, stderr: "" });

      const result = await sshStorageService.checkStorage({
        kdcab: "G107",
        periode: "2026-10",
        targetPath: "/nonexistent",
      });

      expect(result.success).toBe(true);
      expect(result.freeSpace).toBe("40 GB"); // 40960 / 1024 = 40 GB
      expect(result.matchedMount).toBe("/");
    });
  });

  describe("checkBatchStorage", () => {
    it("processes all SSH branches with concurrency limit and returns summary", async () => {
      ceklistPanduanService.getAll.mockResolvedValueOnce([
        { KDCAB: "G107", OS: "LINUX", REMOTE_BULANAN: "SSH" },
        { KDCAB: "G026", OS: "WINDOWS", REMOTE_BULANAN: "VNC" },
        { KDCAB: "G113", OS: "LINUX", REMOTE_BULANAN: "SSH" },
      ]);

      jest.spyOn(sshStorageService, "checkStorage")
        .mockResolvedValueOnce({ success: true, freeSpace: "150 GB", targetPath: "/home" })
        .mockResolvedValueOnce({ success: true, freeSpace: "85.2 GB", targetPath: "/home" });

      const batchResult = await sshStorageService.checkBatchStorage("2026-10");

      expect(batchResult.total).toBe(2); // only G107 & G113
      expect(batchResult.successCount).toBe(2);
      expect(batchResult.failedCount).toBe(0);
      expect(batchResult.results).toHaveLength(2);
    });
  });
});
