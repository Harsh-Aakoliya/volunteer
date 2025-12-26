import express from "express"
import tableController from "../controllers/tableController.js"

const router = express.Router();

router.post("/",tableController.createTable);// ${API_URL}/api/table/  app/chat/table.tsx -> sendTableToChat
router.get("/:tableId",tableController.getTable); // why not used???

export default router;
