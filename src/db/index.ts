import mongoose from "mongoose";
import env from "../config/index.ts";
import logger from "../lib/logger.ts";

const dbConnect = async () => {
  try {
    const connection = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info({ host: connection.connection.host }, "MongoDB connected");
  } catch (err) {
    logger.fatal({ err }, "Error connecting to MongoDB");
    process.exit(1);
  }
};

export default dbConnect;
