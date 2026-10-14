import mongoose from "mongoose";

/**
 * Connects to MongoDB using MONGODB_URI from the environment.
 * Call this once at server startup before handling requests.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("MongoDB connected.");
}
