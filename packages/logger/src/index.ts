import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import DailyRotateFile from "winston-daily-rotate-file";
import winston from "winston";

const logDir = resolve(process.env.LOG_DIR ?? "logs");
mkdirSync(logDir, { recursive: true });

const level = process.env.LOG_LEVEL ?? "info";

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, service, module, ...meta }) => {
    const scope = [service, module].filter(Boolean).join(":");
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}${scope ? ` [${scope}]` : ""} ${message}${rest}`;
  })
);

export const logger = winston.createLogger({
  level,
  defaultMeta: {
    service: "information-radar",
    pid: process.pid
  },
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new DailyRotateFile({
      filename: "app-%DATE%.log",
      dirname: logDir,
      datePattern: "YYYY-MM-DD",
      maxSize: process.env.LOG_MAX_SIZE ?? "20m",
      maxFiles: process.env.LOG_MAX_FILES ?? "14d",
      format: jsonFormat
    }),
    new DailyRotateFile({
      filename: "error-%DATE%.log",
      dirname: logDir,
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: process.env.LOG_MAX_SIZE ?? "20m",
      maxFiles: process.env.LOG_MAX_FILES ?? "30d",
      format: jsonFormat
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: "exceptions-%DATE%.log",
      dirname: logDir,
      datePattern: "YYYY-MM-DD",
      maxFiles: process.env.LOG_MAX_FILES ?? "30d",
      format: jsonFormat
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: "rejections-%DATE%.log",
      dirname: logDir,
      datePattern: "YYYY-MM-DD",
      maxFiles: process.env.LOG_MAX_FILES ?? "30d",
      format: jsonFormat
    })
  ]
});

export function createChildLogger(module: string) {
  return logger.child({ module });
}

export function errorMeta(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { message: String(error) };
}
