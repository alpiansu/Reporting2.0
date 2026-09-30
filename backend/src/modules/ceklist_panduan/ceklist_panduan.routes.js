/**
 * Routes for Ceklist Panduan
 */
import express from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import { getAll, getByKdcab, create, update, remove } from "./ceklist_panduan.controller.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

router.get("/", getAll);
router.get("/:kdcab", getByKdcab);
router.post("/", create);
router.put("/:kdcab", update);
router.delete("/:kdcab", remove);

export default router;