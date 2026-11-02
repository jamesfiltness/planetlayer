import net from 'node:net';

export function parseAllowedHosts(value) {
  return (value ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

export function hostGuard(allowedHosts) {
  // Answers only to host names another website can't borrow. A site can point
  // its own domain at this machine (DNS rebinding), but it can't make the
  // browser send localhost, an IP address or a .local name as the Host.
  function hostAllowed(host) {
    let name;
    try {
      name = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, '');
    } catch {
      return false;
    }
    return name === 'localhost' || name.endsWith('.local') || net.isIP(name) !== 0 || allowedHosts.includes(name);
  }

  return (req, res, next) => {
    const host = req.headers.host ?? '';
    if (!hostAllowed(host)) {
      return res.status(403).json({ error: `Unknown host "${host}". Add it to ALLOWED_HOSTS to use it.` });
    }
    // Browsers send Origin with every write. One from another site means a page
    // elsewhere is trying to change data here.
    const { origin } = req.headers;
    if (origin && req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(origin, host)) {
      return res.status(403).json({ error: 'Cross-site request refused.' });
    }
    next();
  };
}

function sameOrigin(origin, host) {
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    return false; // includes Origin: null
  }
}
