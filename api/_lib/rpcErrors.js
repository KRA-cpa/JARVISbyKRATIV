/**
 * api/_lib/rpcErrors.js - errors an /api/rpc handler throws on purpose (migration step 0.6).
 * rpcCore.js turns them into { success: false, status: 'error', code, error } with their HTTP status; any other error
 * is a 500 "Server error" (its message goes to the log only, redacted).
 */

class RpcError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'RpcError';
    this.status = status;
    this.code = code;
  }
}

/** 400 - the request is wrong (missing / invalid payload field). */
const badRequest = message => new RpcError(400, 'BAD_REQUEST', message);
/** 403 - signed in, but not allowed. */
const forbidden = message => new RpcError(403, 'FORBIDDEN', message);
/** 404 - missing, or hidden from this user (a hidden ticket answers like a missing one - compliance A21). */
const notFound = message => new RpcError(404, 'NOT_FOUND', message);

/**
 * The handler needs a signed-in user. In AUTH_MODE warn / off the route lets anonymous requests through (as the proxy
 * does); a Postgres handler is the authority itself, so it refuses them here.
 * @returns {{ id: string, email: string|null }}
 */
function requireUser(ctx) {
  if (!ctx || !ctx.user || !ctx.user.id) throw new RpcError(401, 'NOT_SIGNED_IN', 'Not signed in');
  return ctx.user;
}

module.exports = { RpcError, badRequest, forbidden, notFound, requireUser };
