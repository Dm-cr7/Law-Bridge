// backend/scripts/createarbitrator.js
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

async function createarbitrator() {
  try {
    const existing = await User.findOne({ email: "arbitrator@gmail.com" });
    if (existing) {
      console.log("⚠️ arbitrator already exists:", existing.email);
      return process.exit(0);
    }

    const arbitrator = await User.create({
      name: "Jane arbitrator",
      email: "arbitrator@gmail.com",
      password: "Password123!", // plain password; hashed by pre-save hook
      role: "arbitrator",
      status: "active",
    });

    console.log("✅ arbitrator created successfully!");
    console.log({
      id: arbitrator._id,
      name: arbitrator.name,
      email: arbitrator.email,
      role: arbitrator.role,
    });

    process.exit(0);
  } catch (err) {
    console.error("🛑 Failed to create arbitrator:", err);
    process.exit(1);
  }
}

createarbitrator();
