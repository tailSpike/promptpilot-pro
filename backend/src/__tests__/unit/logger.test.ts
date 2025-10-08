import { createLogger } from '../../lib/logger';

describe('createLogger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('writes messages with namespace and no metadata', () => {
    const logger = createLogger('test');

    logger.info('hello');
    logger.warn('warned');
    logger.error('failed');

    expect(console.info).toHaveBeenCalledWith('[test]', 'hello');
    expect(console.warn).toHaveBeenCalledWith('[test]', 'warned');
    expect(console.error).toHaveBeenCalledWith('[test]', 'failed');
  });

  it('formats string and object metadata correctly', () => {
    const logger = createLogger('meta');
    const circular: any = { value: 42 };
    circular.self = circular;

    logger.info('with string', 'details');
    expect(console.info).toHaveBeenCalledWith('[meta]', 'with string', 'details');

    logger.warn('with object', { reason: 'test', count: 3 });
    expect(console.warn).toHaveBeenCalledWith('[meta]', 'with object', '{"reason":"test","count":3}');

    logger.error('fallback metadata', circular);
    expect(console.error).toHaveBeenCalledWith('[meta]', 'fallback metadata', circular);
  });

  it('only logs debug output outside production', () => {
    const logger = createLogger('env');

    process.env.NODE_ENV = 'development';
    logger.debug('visible');
    expect(console.debug).toHaveBeenCalledWith('[env]', 'visible');

    (console.debug as jest.Mock).mockClear();
    process.env.NODE_ENV = 'production';
    logger.debug('hidden');
    expect(console.debug).not.toHaveBeenCalled();
  });
});
