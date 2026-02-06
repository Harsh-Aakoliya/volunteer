import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const isDev=true;
const isProd = false;
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
if(isProd){
    user=process.env.PROD_DB_USER;
    host=process.env.PROD_DB_HOST;
    database=process.env.PROD_DB_DATABASE;
    password=process.env.PROD_DB_PASSWORD;
}
console.log("Database configuration:",{
  user:user,
  host:host,
  database:database,
  password:password,
  port:port
});
const pool = new Pool({
    user:user,
    host:host,
    database:database,
    password:password,
    port:port
});

pool.on('connect', () => {});
export default pool;