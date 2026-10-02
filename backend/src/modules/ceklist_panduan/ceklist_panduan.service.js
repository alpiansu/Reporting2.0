/**
 * Ceklist Panduan Service
 * Menyimpan guide/checklist "Before Closing Bulanan" per cabang.
 * Data bersifat referensi (kredensial server/DB) — di-edit via halaman admin Panduan.
 */
import logger from "../../config/logger.js";
import { CeklistPanduanWrapper } from "./ceklist_panduan.model.js";

/**
 * Default guide dari JUKLAK "Before Closing Bulanan" (intranet)
 * http://192.168.133.3/regForum/public/d/382-juklak-berfore-closing-bulanan
 * Dipakai sekali saat tabel kosong; selanjutnya dikelola via halaman admin.
 */
const DEFAULT_PANDUAN = [
  {
    KDCAB: "G026",
    NAMACAB: "TANGERANG 1",
    OS: "WINDOWS",
    IP_BULANAN: "192.168.36.100",
    USER_BULANAN: "",
    PASS_BULANAN: "123",
    PORT_BULANAN: "",
    REMOTE_BULANAN: "VNC",
    DB_USER: "root",
    DB_PASS: "12345ui",
    DB_PORT: "3306",
    HDD_CHECK: "Drive D: min 20% atau 60 GB (via xampp-control)",
    IP_TAMPUNG: "192.168.36.134",
    USER_TAMPUNG: "SERVER FTP",
    PASS_TAMPUNG: "123456",
    REMOTE_TAMPUNG: "RDP",
    VNC_PASS_TAMPUNG: "",
    PATH_TAMPUNG: "E:\\G026\\BACKUP\\BULANAN",
    CATATAN: "Akses server bulanan via VNC, pass tampilan 123. VNC server tampung disable.",
  },
  {
    KDCAB: "G033",
    NAMACAB: "TANGERANG 2",
    OS: "WINDOWS",
    IP_BULANAN: "192.168.61.228",
    USER_BULANAN: "user",
    PASS_BULANAN: "147",
    PORT_BULANAN: "",
    REMOTE_BULANAN: "RDP",
    DB_USER: "cabang",
    DB_PASS: "edpg0332021",
    DB_PORT: "3306",
    HDD_CHECK: "Periksa service mysql80 via services.msc",
    IP_TAMPUNG: "192.168.61.204",
    USER_TAMPUNG: "ADMIN",
    PASS_TAMPUNG: "edptgr2oke",
    REMOTE_TAMPUNG: "RDP",
    VNC_PASS_TAMPUNG: "",
    PATH_TAMPUNG: "K:\\BLN\\CSV\\YYMM",
    CATATAN: null,
  },
  {
    KDCAB: "G113",
    NAMACAB: "BOGOR 1",
    OS: "LINUX",
    IP_BULANAN: "192.168.32.212",
    USER_BULANAN: "root",
    PASS_BULANAN: "eisg113",
    PORT_BULANAN: "",
    REMOTE_BULANAN: "SSH",
    DB_USER: "root",
    DB_PASS: "123456ui",
    DB_PORT: "3306",
    HDD_CHECK: "df -h /home (centos-home)",
    IP_TAMPUNG: "192.168.32.201",
    USER_TAMPUNG: "AMS_POOL",
    PASS_TAMPUNG: "ams@stl",
    REMOTE_TAMPUNG: "RDP",
    VNC_PASS_TAMPUNG: "",
    PATH_TAMPUNG: "E:\\G113\\BACKUP\\BULANAN",
    CATATAN: null,
  },
  {
    KDCAB: "G157",
    NAMACAB: "LEBAK",
    OS: "LINUX",
    IP_BULANAN: "192.168.89.33",
    USER_BULANAN: "edplbk157",
    PASS_BULANAN: "edplbk@157",
    PORT_BULANAN: "2808",
    REMOTE_BULANAN: "SSH",
    DB_USER: "root",
    DB_PASS: "3dpl3b4kju4r4",
    DB_PORT: "3306",
    HDD_CHECK: "df -h /dev/sda1, min 100 GB",
    IP_TAMPUNG: "192.168.89.29",
    USER_TAMPUNG: "server_tampung",
    PASS_TAMPUNG: "963",
    REMOTE_TAMPUNG: "RDP + VNC",
    VNC_PASS_TAMPUNG: "123",
    PATH_TAMPUNG: "K:\\BLN\\CSV\\YYMM",
    CATATAN: null,
  },
  {
    KDCAB: "G107",
    NAMACAB: "PARUNG",
    OS: "LINUX",
    IP_BULANAN: "192.168.23.211",
    USER_BULANAN: "edp",
    PASS_BULANAN: "edp@prg",
    PORT_BULANAN: "",
    REMOTE_BULANAN: "SSH",
    DB_USER: "root",
    DB_PASS: "12345ui",
    DB_PORT: "3306",
    HDD_CHECK: "df -h /home, min 50 GB (datadir /home/data/mysql/, mysql57)",
    IP_TAMPUNG: "192.168.23.200",
    USER_TAMPUNG: "Server_AMS",
    PASS_TAMPUNG: "200",
    REMOTE_TAMPUNG: "RDP + VNC",
    VNC_PASS_TAMPUNG: "200",
    PATH_TAMPUNG: "E:\\G107\\BACKUP\\BULANAN",
    CATATAN: null,
  },
  {
    KDCAB: "G117",
    NAMACAB: "BOGOR 2",
    OS: "LINUX",
    IP_BULANAN: "192.168.81.132",
    USER_BULANAN: "root",
    PASS_BULANAN: "12345ui",
    PORT_BULANAN: "22",
    REMOTE_BULANAN: "SSH",
    DB_USER: "root",
    DB_PASS: "12345ui",
    DB_PORT: "3306",
    HDD_CHECK: "df -h /home/home_lama",
    IP_TAMPUNG: "192.168.81.7",
    USER_TAMPUNG: "g117_server_7",
    PASS_TAMPUNG: "server7",
    REMOTE_TAMPUNG: "RDP + VNC",
    VNC_PASS_TAMPUNG: "123",
    PATH_TAMPUNG: "E:\\G117\\BACKUP\\BULANAN",
    CATATAN: null,
  },
  {
    KDCAB: "G295",
    NAMACAB: "DC SUKABUMI",
    OS: "LINUX",
    IP_BULANAN: "192.168.32.212",
    USER_BULANAN: "root",
    PASS_BULANAN: "eisg113",
    PORT_BULANAN: "",
    REMOTE_BULANAN: "SSH",
    DB_USER: "root",
    DB_PASS: "123456ui",
    DB_PORT: "3306",
    HDD_CHECK: "df -h /dev/mapper/centos-home",
    IP_TAMPUNG: "",
    USER_TAMPUNG: "",
    PASS_TAMPUNG: "",
    REMOTE_TAMPUNG: "",
    VNC_PASS_TAMPUNG: "",
    PATH_TAMPUNG: "",
    CATATAN: "IP server bulanan sama dengan G113 BOGOR 1 (192.168.32.212).",
  },
];

class CeklistPanduanService {
  /**
   * Seed panduan default (JUKLAK) jika tabel kosong.
   * Dipanggil saat module init; tidak pernah menimpa data existing.
   */
  async seedDefaults() {
    try {
      const count = await CeklistPanduanWrapper.count();
      if (count > 0) {
        logger.info(`[ceklist_panduan.service] seedDefaults: skipped, ${count} rows exist`);
        return { seeded: 0 };
      }
      await CeklistPanduanWrapper.bulkCreate(DEFAULT_PANDUAN, { ignoreDuplicates: true });
      logger.info(`[ceklist_panduan.service] seedDefaults: seeded ${DEFAULT_PANDUAN.length} rows`);
      return { seeded: DEFAULT_PANDUAN.length };
    } catch (error) {
      logger.error(`[ceklist_panduan.service] seedDefaults failed: ${error.message}`);
      return { seeded: 0, error: error.message };
    }
  }

  async getAll() {
    const rows = await CeklistPanduanWrapper.findAll({ order: [["KDCAB", "ASC"]] });
    return rows.map(r => r.dataValues ?? r);
  }

  async getByKdcab(kdcab) {
    const row = await CeklistPanduanWrapper.findByPk(kdcab);
    return row ? (row.dataValues ?? row) : null;
  }

  /**
   * Peta panduan { KDCAB: row } untuk backfill/autofill di modul ceklist.
   */
  async getPanduanMap() {
    const rows = await this.getAll();
    const map = {};
    for (const r of rows) map[r.KDCAB] = r;
    return map;
  }

  async create(data) {
    const kdcab = data.KDCAB ?? data.kdcab;
    if (!kdcab) throw new Error("kdcab wajib diisi");
    const existing = await CeklistPanduanWrapper.findByPk(kdcab);
    if (existing) throw new Error(`Panduan untuk ${kdcab} sudah ada`);
    const row = await CeklistPanduanWrapper.create(this.toColumns(data));
    return row.dataValues ?? row;
  }

  async update(kdcab, data) {
    const existing = await CeklistPanduanWrapper.findByPk(kdcab);
    if (!existing) throw new Error(`Panduan untuk ${kdcab} tidak ditemukan`);
    await existing.update(this.toColumns({ ...data, KDCAB: kdcab }));
    return existing.dataValues ?? existing;
  }

  async remove(kdcab) {
    const deleted = await CeklistPanduanWrapper.destroy({ where: { KDCAB: kdcab } });
    return { deleted };
  }

  toColumns(body) {
    const cols = [
      "KDCAB", "NAMACAB", "OS", "IP_BULANAN", "USER_BULANAN", "PASS_BULANAN",
      "PORT_BULANAN", "REMOTE_BULANAN", "DB_USER", "DB_PASS", "DB_PORT", "HDD_CHECK",
      "IP_TAMPUNG", "USER_TAMPUNG", "PASS_TAMPUNG", "REMOTE_TAMPUNG", "VNC_PASS_TAMPUNG",
      "PATH_TAMPUNG", "CATATAN",
    ];
    const row = {};
    for (const c of cols) {
      if (body[c] !== undefined) row[c] = body[c] === "" ? null : body[c];
    }
    return row;
  }
}

export default new CeklistPanduanService();