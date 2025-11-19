// backend/scripts/createParalegal.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js"; // adjust path if needed

dotenv.config();

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/legal_dashboard";

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

async function createParalegal() {
  try {
    const existing = await User.findOne({ email: "paralegal@gmail.com" });
    if (existing) {
      console.log("⚠️ Paralegal already exists:", existing.email);
      return process.exit(0);
    }

    const paralegal = await User.create({
      name: "Jane Paralegal",
      email: "paralegal@gmail.com",
      password: "Password123!", // plain password; hashed by pre-save hook
      role: "paralegal",
      status: "active",
    });

    console.log("✅ Paralegal created successfully!");
    console.log({
      id: paralegal._id,
      name: paralegal.name,
      email: paralegal.email,
      role: paralegal.role,
    });

    process.exit(0);
  } catch (err) {
    console.error("🛑 Failed to create paralegal:", err);
    process.exit(1);
  }
}

createParalegal();
