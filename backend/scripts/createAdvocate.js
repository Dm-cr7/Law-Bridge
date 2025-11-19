// backend/scripts/createAdvocate.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js"; // adjust path if needed

dotenv.config();

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/legal_dashboard";

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

async function createAdvocate() {
  try {
    const existing = await User.findOne({ email: "advocate@gmail.com" });
    if (existing) {
      console.log("⚠️ Advocate already exists:", existing.email);
      return process.exit(0);
    }

    const advocate = await User.create({
      name: "John dAdvocate",
      email: "advocate@gmail.com",
      password: "Password123!", // raw password; your system will encrypt on save
      role: "advocate",
      status: "active",
    });

    console.log("✅ Advocate created successfully!");
    console.log({
      id: advocate._id,
      name: advocate.name,
      email: advocate.email,
      role: advocate.role,
    });

    process.exit(0);
  } catch (err) {
    console.error("🛑 Failed to create advocate:", err);
    process.exit(1);
  }
}

createAdvocate();
