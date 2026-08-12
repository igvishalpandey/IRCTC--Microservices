import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "../config/index.ts";
import { pinoHttp } from "pino-http";
import logger from "../lib/logger.ts";
import healthRoutes from "../routes/health.routes.ts";
import notFound from "../middleware/notFound.middleware.ts";
import errorHandler from "../middleware/errorHandler.middleware.ts";

const app = express();

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: env.CORS_ORIGIN.length > 0 ? env.CORS_ORIGIN : false,
    credentials: true,
  }),
);

app.use(pinoHttp({ logger }));

app.use(rateLimiter);
app.use(express.json({ limit: "10kb" }));

app.use(cookieParser());

app.use(healthRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
