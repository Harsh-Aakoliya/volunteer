import pool from "../config/database.js";

const client = pool.connect();
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
            const result = await pool.query(
                `INSERT INTO poll ("question", "options", "isMultipleChoiceAllowed", "pollEndTime", "roomId", "createdBy")
                VALUES ($1, $2::jsonb, $3, $4, $5, $6)
                RETURNING *`,
                [
                    question,
                    JSON.stringify(options), 
                    isMultipleChoiceAllowed,
                    new Date((new Date()).getTime() + 24 * 60 * 60 * 1000), //adding tomorrow date as default
                    roomId,
                    createdBy
                ]
            );
            console.log("result", result);
    
            console.log("Poll created successfully", result.rows);
            res.status(200).json({ message: "Poll created successfully", poll: result.rows[0] });
    
        } catch (error) {
            console.error("Error creating poll:", error);
            res.status(500).json({ error: "Error creating poll" });
        }
    }
    
}
export default pollController;

