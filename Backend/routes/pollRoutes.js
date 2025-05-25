import express from "express";
import pollController from "../controllers/pollController.js";

const router = express.Router();

// Create a new poll
router.post("/", pollController.createPoll);

// Get poll details
router.get("/:pollId", pollController.getPollDetails);

// Submit vote
router.post("/:pollId/vote", pollController.submitVote);

// Toggle poll status (activate/deactivate)
router.patch("/:pollId/toggle", pollController.togglePollStatus);

// Update poll (for creators only)
router.put("/:pollId", pollController.updatePoll);

export default router;