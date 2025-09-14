import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const isDev=true;
let user=process.env.DB_USER;
let host=process.env.DB_HOST;
let database=process.env.DB_DATABASE;
let password=process.env.DB_PASSWORD;
let port=process.env.DB_PORT;
if(isDev){
  user=process.env.PGUSER;
  host=process.env.PGHOST;
  database=process.env.PGDATABASE;
  password=process.env.PGPASSWORD;
}
console.log("Database configuration:",{
  user:user,
  host:host,
  database:database,
  password:password,
  port:port
});
const pool = new Pool({
  user: user,
  host: host,
  database: database,
  password: password,
  port: port
});

pool.on('connect', () => {console.log('Connected to the database');});
export default pool;