import express from "express";
import pollController from "../controllers/pollController.js";

const router = express.Router();



router.post("/", pollController.createPoll);

export default router;

