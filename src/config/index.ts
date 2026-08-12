import dotenv from "dotenv";
import z from "zod";

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce
      .number()
      .int("PORT must be an integer")
      .min(1)
      .max(65535)
      .default(4000),

    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required")
      .startsWith("mongodb", "must be a mongodb:// or mongodb+srv:// URI"),

    CORS_ORIGIN: z
      .string()
      .default("")
      .transform((raw) =>
        raw
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("30d"),

    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),
    UPLOAD_TMP_DIR: z.string().default("./public/temp"),
  })
  .refine((cfg) => cfg.JWT_ACCESS_SECRET !== cfg.JWT_REFRESH_SECRET, {
    message:
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ, otherwise an " +
      "access token can be replayed as a refresh token",
    path: ["JWT_REFRESH_SECRET"],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  console.error("\nSee .env.example for the expected variables.");
  process.exit(1);
}

const env = Object.freeze(parsed.data);

export type Env = typeof env;
export default env;
