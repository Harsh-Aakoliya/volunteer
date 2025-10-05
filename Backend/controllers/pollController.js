import pool from "../config/database.js";

const pollController = {
    createPoll: async (req, res) => {
        const {
            question,
            options,
            isMultipleChoiceAllowed,
            pollEndTime,
            roomId,
            createdBy,
        } = req.body;
    
        try {
            // Default poll end time: 24 hours from now in IST
            const defaultEndTime = pollEndTime 
                ? new Date(pollEndTime) 
                : new Date(Date.now() + 24 * 60 * 60 * 1000);

            const result = await pool.query(
                `INSERT INTO poll ("question", "options", "isMultipleChoiceAllowed", "pollEndTime", "roomId", "createdBy", "createdAt")
                VALUES ($1, $2::jsonb, $3, $4, $5, $6, NOW() AT TIME ZONE 'Asia/Kolkata')
                RETURNING *`,
                [
                    question,
                    JSON.stringify(options), 
                    isMultipleChoiceAllowed,
                    defaultEndTime,
                    roomId,
                    createdBy
                ]
            );

            const pollId = result.rows[0].id;
            console.log("Poll created successfully", result.rows[0]);
            
            res.status(200).json({ 
                message: "Poll created successfully", 
                poll: result.rows[0] 
            });
    
        } catch (error) {
            console.error("Error creating poll:", error);
            res.status(500).json({ error: "Error creating poll" });
        }
    },

    getPollDetails: async (req, res) => {
        let { pollId } = req.params;
        pollId = parseInt(pollId);
        
        try {
            const result = await pool.query(
                `SELECT * FROM poll WHERE "id" = $1`,
                [pollId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Poll not found" });
            }

            const pollData = result.rows[0];
            console.log("poll data",typeof pollData.votes);
            // Parse votes if they exist
            // if (pollData.votes) {
            //     console.log("we have votes");
            //     // try {
            //         pollData.votes = JSON.parse(pollData.votes);
            //     // } catch (e) {
            //     //     pollData.votes = {};
            //     // }
            // } else {
            //     console.log("No voes found");
            //     pollData.votes = {};
            // }

            // Parse options
            if (typeof pollData.options === 'string') {
                pollData.options = JSON.parse(pollData.options);
            }

            console.log("Poll details fetched:", pollData);
            res.status(200).json({ polldata: pollData });

        } catch (error) {
            console.error("Error while fetching poll details:", error);
            res.status(500).json({ error: "Error fetching poll details" });
        }
    },

    submitVote: async (req, res) => {
        const { pollId } = req.params;
        const { userId, selectedOptions } = req.body;

        try {
            // First, get the current poll data
            const pollResult = await pool.query(
                `SELECT * FROM poll WHERE "id" = $1`,
                [parseInt(pollId)]
            );

            if (pollResult.rows.length === 0) {
                return res.status(404).json({ error: "Poll not found" });
            }

            const poll = pollResult.rows[0];

            // Check if poll is active
            if (!poll.isActive) {
                return res.status(400).json({ error: "Poll is not active" });
            }

            // Check if poll has ended
            const now = new Date();
            const pollEndTime = new Date(poll.pollEndTime);
            if (now > pollEndTime) {
                return res.status(400).json({ error: "Poll has ended" });
            }

            // Parse current votes
            let currentVotes = {};
            if (poll.votes) {
                try {
                    currentVotes = JSON.parse(poll.votes);
                } catch (e) {
                    currentVotes = {};
                }
            }

            // Remove user's previous votes if not multiple choice
            if (!poll.isMultipleChoiceAllowed) {
                Object.keys(currentVotes).forEach(optionId => {
                    currentVotes[optionId] = currentVotes[optionId].filter(
                        voteUserId => voteUserId !== userId
                    );
                });
            }

            // Add new votes
            selectedOptions.forEach(optionId => {
                if (!currentVotes[optionId]) {
                    currentVotes[optionId] = [];
                }
                
                // Check if user already voted for this option
                if (!currentVotes[optionId].includes(userId)) {
                    currentVotes[optionId].push(userId);
                }
            });

            // Update the poll with new votes
            const updateResult = await pool.query(
                `UPDATE poll SET "votes" = $1 WHERE "id" = $2 RETURNING *`,
                [JSON.stringify(currentVotes), parseInt(pollId)]
            );

            res.status(200).json({ 
                message: "Vote submitted successfully", 
                poll: updateResult.rows[0] 
            });

        } catch (error) {
            console.error("Error submitting vote:", error);
            res.status(500).json({ error: "Error submitting vote" });
        }
    },

    togglePollStatus: async (req, res) => {
        const { pollId } = req.params;
        const { userId } = req.body;

        try {
            // First check if user is the creator
            const pollResult = await pool.query(
                `SELECT * FROM poll WHERE "id" = $1`,
                [parseInt(pollId)]
            );

            if (pollResult.rows.length === 0) {
                return res.status(404).json({ error: "Poll not found" });
            }

            const poll = pollResult.rows[0];

            if (poll.createdBy !== userId) {
                return res.status(403).json({ error: "Only poll creator can toggle status" });
            }

            // Toggle the status
            const newStatus = !poll.isActive;
            const updateResult = await pool.query(
                `UPDATE poll SET "isActive" = $1 WHERE "id" = $2 RETURNING *`,
                [newStatus, parseInt(pollId)]
            );

            res.status(200).json({ 
                message: `Poll ${newStatus ? 'activated' : 'deactivated'} successfully`, 
                poll: updateResult.rows[0] 
            });

        } catch (error) {
            console.error("Error toggling poll status:", error);
            res.status(500).json({ error: "Error toggling poll status" });
        }
    },

    updatePoll: async (req, res) => {
        const { pollId } = req.params;
        const { userId, question, options, isMultipleChoiceAllowed, pollEndTime } = req.body;

        try {
            // First check if user is the creator
            const pollResult = await pool.query(
                `SELECT * FROM poll WHERE "id" = $1`,
                [parseInt(pollId)]
            );

            if (pollResult.rows.length === 0) {
                return res.status(404).json({ error: "Poll not found" });
            }

            const poll = pollResult.rows[0];

            if (poll.createdBy !== userId) {
                return res.status(403).json({ error: "Only poll creator can edit poll" });
            }

            // Update the poll
            const updateResult = await pool.query(
                `UPDATE poll SET 
                    "question" = COALESCE($1, "question"),
                    "options" = COALESCE($2::jsonb, "options"),
                    "isMultipleChoiceAllowed" = COALESCE($3, "isMultipleChoiceAllowed"),
                    "pollEndTime" = COALESCE($4, "pollEndTime")
                WHERE "id" = $5 RETURNING *`,
                [
                    question,
                    options ? JSON.stringify(options) : null,
                    isMultipleChoiceAllowed,
                    pollEndTime ? new Date(pollEndTime) : null,
                    parseInt(pollId)
                ]
            );

            res.status(200).json({ 
                message: "Poll updated successfully", 
                poll: updateResult.rows[0] 
            });

        } catch (error) {
            console.error("Error updating poll:", error);
            res.status(500).json({ error: "Error updating poll" });
        }
    },

    reactivatePoll: async (req, res) => {
        const { pollId } = req.params;
        const { userId, pollEndTime } = req.body;

        try {
            // First check if user is the creator
            const pollResult = await pool.query(
                `SELECT * FROM poll WHERE "id" = $1`,
                [parseInt(pollId)]
            );

            if (pollResult.rows.length === 0) {
                return res.status(404).json({ error: "Poll not found" });
            }

            const poll = pollResult.rows[0];

            if (poll.createdBy !== userId) {
                return res.status(403).json({ error: "Only poll creator can reactivate poll" });
            }

            if (!pollEndTime) {
                return res.status(400).json({ error: "Poll end time is required" });
            }

            // Validate that the new end time is in the future
            const newEndTime = new Date(pollEndTime);
            const now = new Date();
            if (newEndTime <= now) {
                return res.status(400).json({ error: "Poll end time must be in the future" });
            }

            // Reactivate the poll with new end time
            const updateResult = await pool.query(
                `UPDATE poll SET 
                    "isActive" = true,
                    "pollEndTime" = $1
                WHERE "id" = $2 RETURNING *`,
                [newEndTime, parseInt(pollId)]
            );

            console.log("Poll reactivated successfully:", updateResult.rows[0]);
            
            res.status(200).json({ 
                message: "Poll reactivated successfully", 
                poll: updateResult.rows[0] 
            });

        } catch (error) {
            console.error("Error reactivating poll:", error);
            res.status(500).json({ error: "Error reactivating poll" });
        }
    }
};

export default pollController;