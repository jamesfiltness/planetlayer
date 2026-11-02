/**
 * Errors that carry an HTTP status. The error handler in app.js sends their
 * message to the client as `{ error }`; any other error is logged and becomes
 * a 500, so only throw these with messages fit for the person using the app.
 */

/** A request the client should fix: bad input, unsupported file, and so on. */
export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

/** Something the request names (a map, a layer, a route) doesn't exist. */
export function notFound(message) {
  return Object.assign(new Error(message), { status: 404 });
}
