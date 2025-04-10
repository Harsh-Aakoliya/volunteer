// userController.ts
import pool from "../config/datebase.js";

const getPendingUsers = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, mobile_number, specific_id, full_name FROM users WHERE is_approved = FALSE ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const approveUser = async (req, res) => {
  // console.log("get request to approve user", req.body);
  const { mobileNumber, password } = req.body;
  try {
    await pool.query(
      "UPDATE users SET is_approved = TRUE, password = $1 WHERE mobile_number = $2",
      [password, mobileNumber]
    );

    res.json({ success: true, message: "User approved and SMS sent" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    // console.log("user id get", userId);
    
    const result = await pool.query(
      `SELECT 
        id, 
        mobile_number, 
        specific_id, 
        full_name, 
        xetra, 
        mandal, 
        role, 
        total_sabha, 
        present_count, 
        absent_count, 
        isadmin,
        is_approved
      FROM users 
      WHERE id = $1`,
      [userId]
    );

    // console.log("User profile result:", result);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const userProfile = result.rows[0];
    
    // Add additional profile details
    const attendanceResult = await pool.query(
      `SELECT date, time_slot, status, late_minutes 
       FROM attendance 
       WHERE user_id = $1 
       ORDER BY date DESC 
       LIMIT 10`,
      [userId]
    );

    res.json({
      ...userProfile,
      recent_attendance: attendanceResult.rows
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUserAttendance = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT 
        date, 
        time_slot, 
        status, 
        late_minutes 
      FROM attendance 
      WHERE user_id = $1 
      ORDER BY date DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      full_name, 
      xetra, 
      mandal, 
      role 
    } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET 
        full_name = $1, 
        xetra = $2, 
        mandal = $3, 
        role = $4 
       WHERE id = $5 
       RETURNING *`,
      [full_name, xetra, mandal, role, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default { 
  getPendingUsers, 
  approveUser, 
  updateUserProfile, 
  getUserProfile, 
  getUserAttendance 
};
// module.exports = { getPendingUsers, approveUser };

// import { createUserService, getAllUsersService, getUserByIdService, updateUserService } from "../models/userModel.js";

// const handleResponse=(res,status,message,data=null)=>{
//   res.status(status).json({
//       status,
//       message,
//       data
//   });
// }

// export const createUser=async(req,res,next)=>{
//   const {name,email}=req.body;
//   try {
//     const newUser=await createUserService(name,email);
//     handleResponse(res,201,"User created successfully",newUser);
//   } catch (err) {
//     next(err);
//   }
// }

// export const getAllUsers=async(req,res,next)=>{
//   try {
//     const usersList=await getAllUsersService();
//     handleResponse(res,200,"User featched successfully",usersList);
//   } catch (err) {
//     next(err);
//   }
// }

// export const getUserById=async(req,res,next)=>{
//   try {
//     const user=await getUserByIdService(req.params.id);
//     if(!user) return handleResponse(res,404,"User not found");
//     handleResponse(res,200,"User featched successfully",user);
//   } catch (err) {
//     next(err);
//   }
// }

// export const updateUser=async(req,res,next)=>{
//   const {name,email}=req.body;
//   try {
//     const updatedUser=await updateUserService(req.params.id,name,email);
//     if(!updatedUser) return handleResponse(res,404,"User not found");
//     handleResponse(res,200,"User updated successfully",updatedUser);
//   } catch (err) {
//     next(err);
//   }
// }

// export const deleteUser=async(req,res,next)=>{
//   try {
//     const deletedUser=await deleteUserService(req.params.id);
//     if(!deletedUser) return handleResponse(res,404,"User not found");
//     handleResponse(res,200,"User deleted successfully",deletedUser);
//   } catch (err) {
//     next(err);
//   }
// }



