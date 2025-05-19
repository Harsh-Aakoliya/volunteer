import pool from "../config/database.js";

const client = pool.connect();
const pollController = {
    createPoll: async (req, res) => {
        const { question, options, roomId, createdBy, multipleChoice } = req.body;
        try {
            const result = await client.query(
                `INSERT INTO poll (question, options, roomId, createdBy, multipleChoice) VALUES ($1, $2, $3, $4, $5)`,
                [question, options, roomId, createdBy, multipleChoice]
            );
            console.log("Poll created successfully",result.rows);
            res.status(200).json({ message: "Poll created successfully" });
        }
        catch (error) {
            console.error("Error creating poll:", error);
            res.status(500).json({ error: "Error creating poll" });
        }
    }
}

export default pollController;

