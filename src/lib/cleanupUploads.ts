import { unlink } from "node:fs/promises";
import type { Request } from "express";

const cleanupUploads = async (req: Request): Promise<void> => {
  const files = req.files;
  if (!files) return;

  const list = Array.isArray(files)
    ? files
    : Object.values(files).flatMap((entry) => entry ?? []);

  await Promise.all(
    list.map((file) => unlink(file.path).catch(() => undefined)),
  );
};

export default cleanupUploads;
