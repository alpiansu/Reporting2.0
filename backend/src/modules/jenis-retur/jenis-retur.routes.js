import express from "express";
import * as jenisReturController from "./jenis-retur.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();
router.use(authenticateJWT);

router.get("/", jenisReturController.getAll);
router.get("/:kode", jenisReturController.getByKode);
router.post("/", jenisReturController.create);
router.put("/:kode", jenisReturController.update);
router.delete("/:kode", jenisReturController.remove);

export default router;
