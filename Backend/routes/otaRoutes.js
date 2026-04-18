import express from "express";
import { checkOta, getManifest, getAsset } from "../controllers/otaController.js";

const router = express.Router();

router.get("/check", checkOta);
router.get("/manifest", getManifest);
router.get("/assets/:apkVersion/:otaVersion/*", getAsset);

export default router;
