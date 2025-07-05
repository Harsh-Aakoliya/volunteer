// import { idText } from "typescript";
import pool from "../config/database.js"


const tableController ={
    createTable: async (req,res) => {
        const {
            roomId,
            senderId,
            tableTitle,
            tableData
        } = req.body;
        console.log("room id",typeof roomId,roomId)
        console.log("sender",typeof senderId,senderId)
        console.log("table title",typeof tableTitle,tableTitle);
        console.log("table data",typeof tableData,tableData);
        // Convert to IST timezone
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const istNow = new Date(now.getTime() + istOffset);
        
        try {
            const result = await pool.query(`
                INSERT INTO "table" ("roomId","senderId","createdAt","tableTitle","tableData")
                VALUES ($1,$2,$3,$4,$5::jsonb)
                RETURNING *`,
                [
                    roomId,
                    senderId,
                    istNow,
                    tableTitle,
                    JSON.stringify(tableData)
                ]
            )
            console.log("result",result.rows[0]);
            res.status(201).json({message:"Table created successfully",result:result.rows[0]});
        } catch (error) {
            console.log("error",error);
            res.status(500).json({error:error});
        }
    },
    getTable: async (req,res) => {
        try {
            const {tableId}=req.params;
            const result= await pool.query(`
                select * from "table" where "id"=$1    
            `,[parseInt(tableId)]);
            console.log("result ",result.rows[0]);
            res.status(201).json({result:result.rows[0]});
        } catch (error) {
            
        }
    }
}

export default tableController;