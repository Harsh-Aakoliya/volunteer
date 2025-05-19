import pool from "../config/database.js";

const initPollDB = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS poll (
                "id" SERIAL PRIMARY KEY,
                "question" TEXT NOT NULL,
                "options" JSONB NOT NULL,
                "votes" JSONB,
                "roomId" INTEGER REFERENCES chatrooms("roomId"),
                "isActive" BOOLEAN DEFAULT TRUE,
                "finishedAt" TIMESTAMP WITH TIME ZONE,
                "multipleChoice" BOOLEAN DEFAULT FALSE,
                "createdBy" VARCHAR(50) REFERENCES users("userId"),
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
    } catch (error) {
        console.error("Error initializing poll database:", error);
    } finally {
        console.log("Poll database initialized");
        client.release();
    }
};
export default initPollDB ;