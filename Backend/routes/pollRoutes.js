import express from "express";
import pollController from "../controllers/pollController.js";

const router = express.Router();

// Create a new poll
router.post("/", pollController.createPoll);// ${API_URL}/api/poll app/chat/Polling.tsx -> sendPoll


// Get poll details
router.get("/:pollId", pollController.getPollDetails);// ${API_URL}/api/poll/${pollId} components/chat/GlobalPollModal.tsx -> fetchPollData

// Get detailed votes (creator only)
router.get("/:pollId/votes-details", pollController.getPollVotesDetails);

// Submit vote
router.post("/:pollId/vote", pollController.submitVote);// ${API_URL}/api/poll/${pollId}/vote  components/chat/GlobalPollModal.tsx -> handleOptionSelect


// Toggle poll status (activate/deactivate)
router.patch("/:pollId/toggle", pollController.togglePollStatus);//${API_URL}/api/poll/${pollId}/toggle components/chat/GlobalPollModal.tsx -> togglePollStatus


// Reactivate poll with new end time (for creators only)
router.patch("/:pollId/reactivate", pollController.reactivatePoll);// ${API_URL}/api/poll/${pollId}/reactivate components/chat/GlobalPollModal.tsx -> handleReactivatePoll

export default router;