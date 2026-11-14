/**
 * api/_lib/handlers/index.js - the /api/rpc handler registry (migration step 0.6).
 *
 * Each group file exports { actionName: async (payload, ctx) => data }, ctx = { user, db, log, now }. A handler returns
 * the unwrapped data; rpcCore.js wraps it as { success: true, data }. An action listed here is answered from Postgres
 * (X-Backend: pg) once DATABASE_URL is set; every other action still goes to Apps Script (X-Backend: gas).
 *
 * Adding an action (Claude.md working rules): state its query count + indexes in the handler's comment, add an offline
 * test, then list the group here. An action name may exist only once (compliance A20) - merge() refuses duplicates.
 */

const GROUPS = {
  system: require('./system')
};

/**
 * @param {Object<string, Object<string, Function>>} groups - { groupName: { action: handler } }
 * @returns {Readonly<Object<string, Function>>}
 */
function mergeHandlers(groups) {
  const merged = {};
  const owner = {};
  for (const [group, actions] of Object.entries(groups)) {
    for (const [action, fn] of Object.entries(actions)) {
      if (typeof fn !== 'function') throw new Error(`handlers/${group}.js: ${action} is not a function`);
      if (owner[action]) throw new Error(`action ${action} is defined in both handlers/${owner[action]}.js and handlers/${group}.js`);
      owner[action] = group;
      merged[action] = fn;
    }
  }
  return Object.freeze(merged);
}

const handlers = mergeHandlers(GROUPS);

module.exports = { handlers, mergeHandlers, GROUPS };
