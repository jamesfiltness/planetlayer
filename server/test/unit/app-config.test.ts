import { AppConfig, parseAllowedHosts } from '../../src/config/app-config.js';

describe('AppConfig', () => {
  test('defaults to this computer only', () => {
    expect(AppConfig.fromEnv({})).toMatchObject({ listenAddress: '127.0.0.1', port: 8080, allowedHosts: [] });
  });

  test('reads the environment', () => {
    const config = AppConfig.fromEnv({ DATABASE_URL: 'postgres://db/x', LISTEN_ADDRESS: '0.0.0.0', PORT: '9000', ALLOWED_HOSTS: 'mybox' });
    expect(config).toMatchObject({ databaseUrl: 'postgres://db/x', listenAddress: '0.0.0.0', port: 9000, allowedHosts: ['mybox'] });
  });

  test('ALLOWED_HOSTS is a comma-separated list, trimmed and lower-cased', () => {
    expect(parseAllowedHosts(' MyBox , mybox.lan,, ')).toEqual(['mybox', 'mybox.lan']);
    expect(parseAllowedHosts(undefined)).toEqual([]);
  });
});
