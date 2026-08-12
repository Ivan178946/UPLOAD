import { format, transports } from 'winston';
const { timestamp, combine, errors, printf } = format;
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} | level: ${level} | message: ${message || stack}`;
});
// for development environment
export const devLogger = {
  format: combine(
    format.colorize(),
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    errors({
      stack: true,
    }),
    logFormat,
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      maxsize: 1048576,
      filename: `${__dirname}/../../../../loggers-registrados/dev-loggers.log`,
    }),
  ],
};
