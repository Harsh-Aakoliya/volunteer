import pool from "../config/database.js";

function normalizeVotes(votes) {
    // Supports legacy shape:
    // { [optionId]: string[] }
    // and new shape:
    // { [optionId]: Array<{ userId: string, votedAt: string }> }
    if (!votes) return {};
    if (typeof votes === "string") {
        try {
            votes = JSON.parse(votes);
        } catch {
            return {};
        }
    }
    if (typeof votes !== "object" || Array.isArray(votes)) return {};

    const normalized = {};
    for (const [optionId, arr] of Object.entries(votes)) {
        if (!Array.isArray(arr)) {
            normalized[optionId] = [];
            continue;
        }
        normalized[optionId] = arr
            .map((v) => {
                if (!v) return null;
                if (typeof v === "string") return { userId: v, votedAt: null };
                if (typeof v === "object" && typeof v.userId === "string") {
                    return { userId: v.userId, votedAt: v.votedAt || null };
                }
                return null;
            })
            .filter(Boolean);
    }
    return normalized;
}

function toLegacyVotesObject(normalizedVotes) {
    const legacyVotes = {};
    for (const [optionId, voters] of Object.entries(normalizedVotes || {})) {
        legacyVotes[optionId] = (voters || []).map((v) => v.userId);
    }
    return legacyVotes;
}

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
            // Normalize votes to legacy shape for existing clients:
            // { [optionId]: string[] }
            pollData.votes = toLegacyVotesObject(normalizeVotes(pollData.votes));

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

    getPollVotesDetails: async (req, res) => {
        let { pollId } = req.params;
        pollId = parseInt(pollId);
        const { userId } = req.query;

        try {
            const result = await pool.query(
                `SELECT * FROM poll WHERE "id" = $1`,
                [pollId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Poll not found" });
            }

            const poll = result.rows[0];

            if (typeof poll.options === "string") {
                poll.options = JSON.parse(poll.options);
            }

            // Only creator can view detailed vote list
            if (!userId || String(poll.createdBy) !== String(userId)) {
                return res.status(403).json({ error: "Only poll creator can view votes" });
            }

            const normalizedVotes = normalizeVotes(poll.votes);

            // Collect all unique userIds from votes
            const allUserIds = new Set();
            Object.values(normalizedVotes).forEach((arr) => {
                arr.forEach((v) => allUserIds.add(String(v.userId)));
            });

            // Fetch names for userIds (SevakMaster.seid matches app userId usage)
            let userMap = {};
            const userIdsArray = Array.from(allUserIds);
            if (userIdsArray.length > 0) {
                const usersRes = await pool.query(
                    `SELECT seid::text AS "userId", COALESCE(sevakname, '') AS "fullName"
                     FROM "SevakMaster"
                     WHERE seid::text = ANY($1::text[])`,
                    [userIdsArray]
                );
                userMap = usersRes.rows.reduce((acc, row) => {
                    acc[row.userId] = row.fullName || row.userId;
                    return acc;
                }, {});
            }

            const options = (poll.options || []).map((opt) => {
                const voters = normalizedVotes[opt.id] || [];
                const enriched = voters
                    .map((v) => ({
                        userId: String(v.userId),
                        fullName: userMap[String(v.userId)] || String(v.userId),
                        votedAt: v.votedAt,
                    }))
                    .sort((a, b) => {
                        const ta = a.votedAt ? new Date(a.votedAt).getTime() : 0;
                        const tb = b.votedAt ? new Date(b.votedAt).getTime() : 0;
                        return tb - ta;
                    });

                return {
                    id: opt.id,
                    text: opt.text,
                    voteCount: enriched.length,
                    voters: enriched,
                };
            });

            const uniqueVoters = new Set();
            options.forEach((opt) => opt.voters.forEach((v) => uniqueVoters.add(v.userId)));

            res.status(200).json({
                poll: {
                    id: poll.id,
                    question: poll.question,
                    isMultipleChoiceAllowed: poll.isMultipleChoiceAllowed,
                    createdBy: poll.createdBy,
                    roomId: poll.roomId,
                    createdAt: poll.createdAt,
                },
                votedMembers: uniqueVoters.size,
                options,
            });
        } catch (error) {
            console.error("Error while fetching poll votes details:", error);
            res.status(500).json({ error: "Error fetching poll votes details" });
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

            // Normalize current votes (supports legacy + new)
            let currentVotes = normalizeVotes(poll.votes);

            // Parse options (needed for multi-select "exact set" behavior)
            let pollOptions = poll.options;
            if (typeof pollOptions === "string") {
                try { pollOptions = JSON.parse(pollOptions); } catch { pollOptions = []; }
            }
            const allOptionIds = Array.isArray(pollOptions) ? pollOptions.map((o) => o.id) : [];

            // Ensure option buckets exist
            allOptionIds.forEach((optId) => {
                if (!currentVotes[optId]) currentVotes[optId] = [];
            });

            const normalizedSelected = Array.isArray(selectedOptions) ? selectedOptions.map(String) : [];
            const nowIso = new Date().toISOString();

            // For both single and multi choice, make the user's selection EXACTLY match selectedOptions
            // (this also allows "unselect" in multi-choice).
            Object.keys(currentVotes).forEach((optionId) => {
                currentVotes[optionId] = (currentVotes[optionId] || []).filter((v) => String(v.userId) !== String(userId));
            });

            // Add new votes with timestamps
            normalizedSelected.forEach((optionId) => {
                if (!currentVotes[optionId]) currentVotes[optionId] = [];
                // Prevent duplicates
                if (!currentVotes[optionId].some((v) => String(v.userId) === String(userId))) {
                    currentVotes[optionId].push({ userId: String(userId), votedAt: nowIso });
                }
            });

            // Update the poll with new votes
            const updateResult = await pool.query(
                `UPDATE poll SET "votes" = $1 WHERE "id" = $2 RETURNING *`,
                [JSON.stringify(currentVotes), parseInt(pollId)]
            );

            // Return legacy votes shape for mobile clients
            const updatedPoll = updateResult.rows[0];
            updatedPoll.votes = toLegacyVotesObject(normalizeVotes(updatedPoll.votes));

            res.status(200).json({ 
                message: "Vote submitted successfully", 
                poll: updatedPoll 
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

            const updatedPoll = updateResult.rows[0];
            updatedPoll.votes = toLegacyVotesObject(normalizeVotes(updatedPoll.votes));

            res.status(200).json({ 
                message: `Poll ${newStatus ? 'activated' : 'deactivated'} successfully`, 
                poll: updatedPoll 
            });

        } catch (error) {
            console.error("Error toggling poll status:", error);
            res.status(500).json({ error: "Error toggling poll status" });
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

            const updatedPoll = updateResult.rows[0];
            updatedPoll.votes = toLegacyVotesObject(normalizeVotes(updatedPoll.votes));
            
            res.status(200).json({ 
                message: "Poll reactivated successfully", 
                poll: updatedPoll 
            });

        } catch (error) {
            console.error("Error reactivating poll:", error);
            res.status(500).json({ error: "Error reactivating poll" });
        }
    }
};

export default pollController;