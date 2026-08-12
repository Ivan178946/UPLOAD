import 'winston-daily-rotate-file';
import { format, transports } from 'winston';
const { timestamp, combine, errors, json } = format;
// for production environment
export const prodLogger = {
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    errors({
      stack: true,
    }),
    json(),
  ),
  transports: [
    new transports.Console(),
    new transports.DailyRotateFile({
      filename: `loggers-registrados/prod-%DATE%-error.log`,
      level: 'error',
      format: format.combine(format.timestamp(), format.json()),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false, // don't want to zip our logs
      maxFiles: '30d', // will keep log until they are older than 30 days
    }),
    // same for all levels
    new transports.DailyRotateFile({
      filename: `loggers-registrados/prod-%DATE%-combined.log`,
      format: format.combine(format.timestamp(), format.json()),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: '30d',
    }),
  ],
};
