import express from "express"
import tableController from "../controllers/tableController.js"

const router = express.Router();

router.post("/",tableController.createTable);
router.get("/:tableId",tableController.getTable);

export default router;