import express from "express";
import { exportLaporanDev } from "./exportLapDev.controller.js";

const router = express.Router();

router.get("/:lap/:cab/:tgl", exportLaporanDev);

export default router;
