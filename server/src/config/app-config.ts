import path from 'node:path';

export class AppConfig {
  databaseUrl = 'postgres://spatial:spatial@localhost:5432/spatial';
  // Local-only unless told otherwise. In Docker this is 0.0.0.0 and the
  // published port decides who can reach it.
  listenAddress = '127.0.0.1';
  port = 8080;
  allowedHosts: string[] = [];
  clientDir = path.join(import.meta.dirname, '../../../client/dist');

  constructor(values: Partial<AppConfig> = {}) {
    Object.assign(this, values);
  }

  static fromEnv(env = process.env): AppConfig {
    const defaults = new AppConfig();
    return new AppConfig({
      databaseUrl: env.DATABASE_URL ?? defaults.databaseUrl,
      listenAddress: env.LISTEN_ADDRESS ?? defaults.listenAddress,
      port: env.PORT ? Number(env.PORT) : defaults.port,
      allowedHosts: parseAllowedHosts(env.ALLOWED_HOSTS),
    });
  }
}

export function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
}
