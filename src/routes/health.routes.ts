import { Router } from "express";
import mongoose from "mongoose";

import type { Request, Response } from "express";

const router = Router();

const CONNECTED = 1;

const healthCheck = async (_req: Request, res: Response) => {
  const dbCheck = mongoose.connection.readyState === CONNECTED;

  return res.status(dbCheck ? 200 : 503).json({
    status: dbCheck ? "ok" : "db-error",
    db: dbCheck ? "up" : "down",
    uptime: Math.floor(process.uptime()),
  });
};

router.route("/health").get(healthCheck);

export default router;
