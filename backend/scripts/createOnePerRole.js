/**
 * createOnePerRole.js
 *
 * Creates (or updates) **one** user per role in your User model.
 *
 * Usage:
 *  node backend/scripts/createOnePerRole.js \
 *    --password=Password123! \
 *    --domain=example.com \
 *    [--force]   // if provided, update existing accounts with new password/info
 *
 * Behavior:
 *  - For each role in the roles list it will use email: <role>@<domain>
 *  - Name is Title Case of role (e.g. "Advocate Advocate")
 *  - If user exists:
 *      - if --force provided => update name, password (triggers pre-save hash), status, role
 *      - otherwise => skip
 *  - Uses User model so your pre('save') password hashing runs
 *  - Produces a CSV (seed-one-per-role-<ts>.csv) with email,password,role,_id
 *
 * IMPORTANT:
 *  - Ensure MONGO_URI in env
 *  - Do NOT run on production unless you know what you're doing (--force allowed)
 */

import dotenv from "dotenv";
dotenv.config();

import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import User from "../models/User.js";

const argv = process.argv.slice(2);
const getArg = (key, def) => {
  const idx = argv.indexOf(key);
  if (idx === -1) {
    // support --key=value
    const kv = argv.find((a) => a.startsWith(`${key}=`));
    if (kv) return kv.split("=")[1];
    return def;
  }
  return argv[idx + 1] ?? def;
};

const password = getArg("--password", getArg("--pwd", "Password123!"));
const domain = getArg("--domain", "example.com");
const force = argv.includes("--force") || argv.includes("-f");

const roles = [
  "advocate",
  "paralegal",
  "mediator",
  "arbitrator",
  "reconciliator",
  "client",
  "respondent",
  "admin",
];

function titleCase(s) {
  return s
    .split(/[\s-_]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/legal_dashboard";

async function main() {
  const env = process.env.NODE_ENV || "development";
  if (env === "production" && !force) {
    console.error("Refusing to run in production without --force. Add --force if you really want to proceed.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }

  const results = [];

  for (const role of roles) {
    const email = `${role}@${domain}`.toLowerCase();
    const name = `${titleCase(role)} ${titleCase(role)}`; // e.g., "Advocate Advocate"

    try {
      const existing = await User.findOne({ email }).collation({ locale: "en", strength: 2 });

      if (existing) {
        if (!force) {
          console.log(`⚠️ Skipping existing: ${email}`);
          results.push({ email, password: "[existing]", role, id: existing._id.toString(), action: "skipped" });
          continue;
        }

        // update existing: set password and other fields and save (pre-save will hash)
        existing.name = name;
        existing.role = role;
        existing.status = "active";
        existing.password = password;
        if (!existing.createdBy) existing.createdBy = null;
        await existing.save();
        console.log(`🔁 Updated existing user: ${email}`);
        results.push({ email, password, role, id: existing._id.toString(), action: "updated" });
        continue;
      }

      // create new user (use .create so pre-save triggers)
      const u = await User.create({
        name,
        email,
        password,
        role,
        status: "active",
        profileCompleted: false,
      });

      console.log(`✅ Created: ${email} (${u._id})`);
      results.push({ email, password, role, id: u._id.toString(), action: "created" });
    } catch (err) {
      console.error(`❌ Error processing ${email}:`, err.message || err);
      results.push({ email, password: "[error]", role, id: "", action: "error", error: err.message });
    }
  }

  // write CSV (safely)
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outFile = path.join(process.cwd(), `seed-one-per-role-${ts}.csv`);
    const csvLines = ["email,password,role,_id,action"];
    for (const r of results) {
      // mask passwords if skipped/error for safety
      const pw = r.action === "created" || r.action === "updated" ? r.password : "";
      csvLines.push(`${r.email},${pw},${r.role},${r.id},${r.action}`);
    }
    fs.writeFileSync(outFile, csvLines.join("\n"), { mode: 0o600 });
    console.log(`\n📄 CSV written to: ${outFile}  (treat as sensitive)`);
  } catch (err) {
    console.error("❌ Failed to write CSV:", err.message || err);
  }

  await mongoose.disconnect();
  console.log("🏁 Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
