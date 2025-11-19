// backend/scripts/createAdmin.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js"; // adjust path if needed

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const createAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Check if an admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("⚠️ Admin user already exists:", existingAdmin.email);
      process.exit(0);
    }

    const admin = new User({
      name: "Super Admin",
      email: "admin@example.com", // change if you want
      password: "AdminPassword201025!", // will be hashed automatically
      role: "admin",
      status: "active",
    });

    await admin.save();
    console.log("✅ Admin user created successfully!");
    console.log({
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });

    process.exit(0);
  } catch (err) {
    console.error("🛑 Failed to create admin:", err);
    process.exit(1);
  }
};

createAdmin();
