// Headers that tell the browser what this app's pages may do, as a second
// line of defence behind hostGuard.js. They matter because the app's data
// (feature properties, layer names) comes from files anyone could have made.

// The only other site the client talks to: OpenFreeMap serves the base map's
// style, tiles, sprites and fonts (see shared/themes.js).
const MAP_HOST = 'https://tiles.openfreemap.org';

/**
 * The Content Security Policy. Scripts, styles and fonts come only from this
 * app, and the page can't be framed by another site, so it can't be used for
 * clickjacking (a hidden frame tricking someone into clicking Delete).
 *
 * MapLibre runs its workers from blob: URLs and turns sprites into images
 * through blob: and data: URLs, and Vite inlines the smallest font files as
 * data: URLs, hence those sources.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${MAP_HOST}`,
  `connect-src 'self' ${MAP_HOST}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Express middleware that adds the security headers to every response. */
export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    // For browsers that don't support frame-ancestors.
    'X-Frame-Options': 'DENY',
    // Files are only ever treated as the type the server says they are.
    'X-Content-Type-Options': 'nosniff',
    // Addresses (which hold map ids) aren't sent to OpenFreeMap with each tile.
    'Referrer-Policy': 'same-origin',
  });
  next();
}
