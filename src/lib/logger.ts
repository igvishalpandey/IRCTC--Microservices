import pino from "pino";
import env from "../config/index.ts";

const isProduction = env.NODE_ENV === "production";

const logger = pino({
  level: env.LOG_LEVEL,

  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
      },

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "req.body.password",
      "req.body.newPassword",
      "req.body.currentPassword",
      "req.body.oldPassword",
      "req.body.token",
      "req.body.refreshToken",
    ],
    censor: "[REDACTED]",
  },
});

export default logger;
