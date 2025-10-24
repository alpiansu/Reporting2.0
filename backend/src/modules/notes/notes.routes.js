import express from "express";
import { getAll, remove } from "./notes.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

router.get("/", getAll);
router.delete("/:unixKey", remove);

export default router;
