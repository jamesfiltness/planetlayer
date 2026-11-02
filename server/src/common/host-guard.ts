import type { NextFunction, Request, Response } from 'express';
import net from 'node:net';

// Plain Express middleware rather than a Nest guard, so it also covers the
// client's static files, which never reach Nest's router.
//
// Answers only to host names another website can't borrow. A site can point
// its own domain at this machine (DNS rebinding), but it can't make the
// browser send localhost, an IP address or a .local name as the Host.
export function hostGuard(allowedHosts: string[]) {
  const hostAllowed = (host: string) => {
    let name: string;
    try {
      name = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, '');
    } catch {
      return false;
    }
    return name === 'localhost' || name.endsWith('.local') || net.isIP(name) !== 0 || allowedHosts.includes(name);
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host ?? '';
    if (!hostAllowed(host)) {
      res.status(403).json({ error: `Unknown host "${host}". Add it to ALLOWED_HOSTS to use it.` });
      return;
    }
    // Browsers send Origin with every write. One from another site means a page
    // elsewhere is trying to change data here.
    const { origin } = req.headers;
    if (origin && req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(origin, host)) {
      res.status(403).json({ error: 'Cross-site request refused.' });
      return;
    }
    next();
  };
}

function sameOrigin(origin: string, host: string) {
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    return false; // includes Origin: null
  }
}
