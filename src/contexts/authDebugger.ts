import { createLogger } from '@/utils/logging';

const authLogger = createLogger('AUTH_DEBUG');

export const debug = (msg: string, extra = {}) =>
  authLogger.debug(msg, extra);
