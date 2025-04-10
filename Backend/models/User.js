import pool from "../config/datebase.js";

//state
//city

//role=>dept
//leave sabha not count
//leave list
//joining date


const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        mobile_number VARCHAR(15) UNIQUE NOT NULL,
        isAdmin BOOLEAN DEFAULT FALSE,
        specific_id VARCHAR(50) NOT NULL,
        full_name VARCHAR(100),
        xetra VARCHAR(100),
        mandal VARCHAR(100),
        role VARCHAR(50),
        password VARCHAR(100),
        is_approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_sabha INTEGER DEFAULT 0,
        present_count INTEGER DEFAULT 0,
        absent_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE NOT NULL,
        time_slot VARCHAR(50),
        status VARCHAR(20),
        late_minutes INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INT DEFAULT 0,
        dislikes INT DEFAULT 0
      );
      

    `);
  } finally {
    client.release();
  }
};

export default initDB;