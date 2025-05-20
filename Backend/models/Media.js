import pool from "../config/database.js";

const initMediaDB = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS media (
                "id" SERIAL PRIMARY KEY,
                "roomId" INTEGER REFERENCES chatrooms("roomId"),
                "senderId" VARCHAR(50) REFERENCES users("userId"),
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "caption" VARCHAR(255),
                "messageId" INTEGER REFERENCES chatmessages("id"),
                "driveUrlObject" JSONB
            );
        `);
    } catch (error) {
        console.error("Error initializing media database:", error);
    } finally {
        console.log("Media database initialized");
        client.release();
    }
};
export default initMediaDB;