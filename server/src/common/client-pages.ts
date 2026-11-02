import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';

// The client routes pages itself (/, /maps/3, …), so a page request that isn't
// for the API or one of the client's files gets index.html. This is what lets a
// map's address be reloaded or shared. Plain Express middleware, because a Nest
// catch-all route would also catch API routes registered after it.
export function clientPages(clientDir: string) {
  const index = path.join(clientDir, 'index.html');
  return (req: Request, res: Response, next: NextFunction) => {
    const api = req.path === '/api' || req.path.startsWith('/api/');
    if ((req.method === 'GET' || req.method === 'HEAD') && !api) res.sendFile(index);
    else next();
  };
}
