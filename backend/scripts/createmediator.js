// backend/scripts/createMediator.js
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

async function createMediator() {
  try {
    const existing = await User.findOne({ email: "Mediator@gmail.com" });
    if (existing) {
      console.log("⚠️ Mediator already exists:", existing.email);
      return process.exit(0);
    }

    const Mediator = await User.create({
      name: "Benas Mediator",
      email: "Mediator@gmail.com",
      password: "Password123!", // plain password; hashed by pre-save hook
      role: "Mediator",
      status: "active",
    });

    console.log("✅ Mediator created successfully!");
    console.log({
      id: Mediator._id,
      name: Mediator.name,
      email: Mediator.email,
      role: Mediator.role,
    });

    process.exit(0);
  } catch (err) {
    console.error("🛑 Failed to create Mediator:", err);
    process.exit(1);
  }
}

createMediator();
