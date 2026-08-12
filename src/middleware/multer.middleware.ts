import multer, { FileFilterCallback } from "multer";
import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import env from "../config/index.ts";
import ApiError from "../lib/ApiError.ts";

const TMP_DIR = resolve(process.cwd(), env.UPLOAD_TMP_DIR);
mkdirSync(TMP_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".webm",
  ".mov",
]);

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    cb(null, TMP_DIR);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : "";
    cb(null, `${Date.now()}-${randomUUID()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 2,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(
        ApiError.badRequest(`Unsupported file type: ${ext || "unknown"}`, {
          field: file.fieldname,
          allowed: [...ALLOWED_EXTENSIONS],
        }),
      );
      return;
    }
    cb(null, true);
  },
});

export default upload;
