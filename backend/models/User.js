/**
 * User.js
 * ------------------------------------------------------------
 * User Model — Core Identity Layer
 * ------------------------------------------------------------
 * Supports advocates, clients, arbitrators, respondents, admins, etc.
 * Integrated with Case Management, Collaboration, and Audit systems.
 * ------------------------------------------------------------
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";

/* =======================================================
   🧠 USER SCHEMA
   ======================================================= */
const userSchema = new mongoose.Schema(
  {
    /* =======================================================
       👤 BASIC INFO
       ======================================================= */
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [120, "Name too long"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        message: "Invalid email format",
      },
    },

    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{7,14}$/, "Invalid phone number format"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never returned in queries by default
    },

    /* =======================================================
       🏷️ ROLE & STATUS
       ======================================================= */
    role: {
      type: String,
      enum: [
        "advocate",
        "paralegal",
        "mediator",
        "arbitrator",
        "reconciliator",
        "client",
        "respondent", // ✅ Added for completeness
        "admin",
      ],
      default: "client",
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    /* =======================================================
       🏛️ PROFESSIONAL INFO (Optional)
       ======================================================= */
    organization: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    specialization: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    barNumber: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    /* =======================================================
       🌍 CONTACT & PROFILE DETAILS (Optional)
       ======================================================= */
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      country: { type: String, trim: true },
    },

    /* =======================================================
       🔐 AUTH & SECURITY
       ======================================================= */
    otp: { type: String },
    otpExpires: { type: Date },
    passwordChangedAt: { type: Date },

    /* =======================================================
       🧾 AUDIT
       ======================================================= */
    lastLogin: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin or advocate who created the account
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* =======================================================
   📘 INDEXES
   ======================================================= */
// Case-insensitive unique email
userSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

/* =======================================================
   🔒 PASSWORD HASHING
   ======================================================= */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now() - 1000; // Slight delay ensures JWT validity
    next();
  } catch (err) {
    next(err);
  }
});

/* =======================================================
   🔐 METHODS
   ======================================================= */

// Compare entered password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changed = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changed;
  }
  return false;
};

// Role helper (for guards & authorization)
userSchema.methods.hasRole = function (roles = []) {
  return roles.map((r) => r.toLowerCase()).includes(this.role.toLowerCase());
};

// Safe JSON output (hides sensitive data)
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpires;
  return obj;
};

/* =======================================================
   🧩 VIRTUALS
   ======================================================= */
userSchema.virtual("fullAddress").get(function () {
  const { street, city, country } = this.address || {};
  return [street, city, country].filter(Boolean).join(", ");
});

/* =======================================================
   ✅ EXPORT MODEL
   ======================================================= */
const User = mongoose.model("User", userSchema);
export default User;
