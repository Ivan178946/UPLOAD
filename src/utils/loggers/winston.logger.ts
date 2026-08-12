import { createLogger } from 'winston';
import { prodLogger } from './prod-logger';
import { devLogger } from './dev-logger';

// export log instance based on the current environment
const instanceLogger =
  process.env.NODE_ENV === 'production' ? prodLogger : devLogger;

export const instance = createLogger(instanceLogger);
