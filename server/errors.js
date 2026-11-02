// Their messages are shown to the user. Any other error is logged and becomes a 500.

export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function notFound(message) {
  return Object.assign(new Error(message), { status: 404 });
}
