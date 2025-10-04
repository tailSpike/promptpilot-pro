export type LogMetadata = Record<string, unknown> | unknown;

export interface Logger {
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
}

const formatMetadata = (metadata?: LogMetadata): unknown[] => {
  if (metadata === undefined) {
    return [];
  }

  if (typeof metadata === 'string') {
    return [metadata];
  }

  try {
    return [JSON.stringify(metadata)];
  } catch {
    return [metadata];
  }
};

export const createLogger = (namespace: string): Logger => {
  return {
    info(message: string, metadata?: LogMetadata) {
      console.info(`[${namespace}]`, message, ...formatMetadata(metadata));
    },
    warn(message: string, metadata?: LogMetadata) {
      console.warn(`[${namespace}]`, message, ...formatMetadata(metadata));
    },
    error(message: string, metadata?: LogMetadata) {
      console.error(`[${namespace}]`, message, ...formatMetadata(metadata));
    },
    debug(message: string, metadata?: LogMetadata) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[${namespace}]`, message, ...formatMetadata(metadata));
      }
    },
  };
};