import express from "express";
import { authenticateJWT } from "../../middlewares/index.js";
import * as controller from "./ntb_vs_glslp.controller.js";

const router = express.Router();
router.use(authenticateJWT);

router.get("/", controller.getRecords);
router.get("/all", controller.getAllRecords);
router.get("/summary", controller.getSummary);
router.get("/branches", controller.getBranches);
router.patch("/record", controller.updateRecord);

export default router;
