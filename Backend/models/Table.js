import pool from "../config/database.js";

const initTableDB = async ()=>{
    await createTableTable();
}

export default initTableDB


const createTableTable = async () => {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'table'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("Table table already exists");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "table" (
            "id" SERIAL PRIMARY KEY,
            "roomId" INTEGER,
            "senderId" VARCHAR(50),
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            "tableTitle" VARCHAR(255),
            "messageId" INTEGER,
            "tableData" JSONB
        );
    `);
    console.log("Table table created successfully");
  } catch (error) {
    console.error("Error while creating Table table:", error);
  } finally {
    client.release();
  }
};