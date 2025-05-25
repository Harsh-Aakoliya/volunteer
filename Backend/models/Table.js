import pool from "../config/database.js";

const initTableDB = async ()=>{
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS "table"(
                "id" SERIAL PRIMARY KEY,
                "roomId" INTEGER REFERENCES chatrooms("roomId"),
                "senderId" VARCHAR(50) REFERENCES users("userId"),
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "tableTitle" VARCHAR(255),
                "messageId" INTEGER REFERENCES chatmessages("id"),
                "tableData" JSONB
            )
        `)
    } catch (error) {
        console.error("Error initializing table database:", error);

    }finally {
        console.log("Table database initialized");
        client.release();
    }
}

export default initTableDB