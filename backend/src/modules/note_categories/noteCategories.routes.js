import express from "express";
import { getAll, getById, getByModule, create, update, remove } from "./noteCategories.controller.js";
import { authenticateJWT } from "../../middlewares/index.js";

const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

router.get("/", getAll);
router.get("/:id", getById);
router.post("/getModule", getByModule);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
