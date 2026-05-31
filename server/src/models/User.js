import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    prompt: { type: String },
    analysis: { type: Object },
    stage: { type: String, default: "analyzed" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: 6,
      select: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    projects: [projectSchema],
    resetCode: {
      type: String,
      default: null,
    },
    resetCodeExpiry: {
      type: Date,
      default: null,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);


// const userSchema = new mongoose.Schema({
//   username: {
//     type: String,
//     required: true,
//   },

//   email: {
//     type: String,
//     required: true,
//     unique: true,
//   },

//   password: {
//     type: String,
//     default: null,   // 🔥 IMPORTANT
//   },

//   googleId: {
//     type: String,
//     default: null,
//   },

//   authProvider: {
//     type: String,
//     enum: ["local", "google"],
//     default: "local",
//   },

//   verified: {
//     type: Boolean,
//     default: false,
//   },
// }, { timestamps: true });
