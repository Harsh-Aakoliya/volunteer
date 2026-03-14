// In-memory token validity cache so the auth middleware never blocks on a DB query
// for tokens it has already validated recently.
// TTL-based: entries expire after TOKEN_CACHE_TTL_MS so revocations propagate quickly.
import pool from "../config/database.js";

const TOKEN_CACHE_TTL_MS = 30_000; // 30 seconds – revocation delay is at most this

// Map<token, { valid: boolean, ts: number }>
const cache = new Map();

// Periodic cleanup of stale entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.ts > TOKEN_CACHE_TTL_MS * 3) cache.delete(k);
  }
}, 60_000);

const tokenStore = {
  // ─── Called on login / setPassword ───────────────────────────────────────
  async storeToken(userId, token, { deviceInfo = null, ipAddress = null } = {}) {
    await pool.query(
      `INSERT INTO auth_tokens (user_id, token, device_info, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, token, deviceInfo, ipAddress]
    );
    cache.set(token, { valid: true, ts: Date.now() });
  },

  // ─── Called on self-logout ──────────────────────────────────────────────
  async invalidateToken(token, reason = "self") {
    await pool.query(
      `UPDATE auth_tokens
          SET is_active = FALSE, logged_out_at = NOW(), logout_reason = $2
        WHERE token = $1 AND is_active = TRUE`,
      [token, reason]
    );
    cache.set(token, { valid: false, ts: Date.now() });
  },

  // ─── Called from monitoring dashboard (remote logout) ───────────────────
  async invalidateAllForUser(userId, reason = "remote") {
    const res = await pool.query(
      `UPDATE auth_tokens
          SET is_active = FALSE, logged_out_at = NOW(), logout_reason = $2
        WHERE user_id = $1 AND is_active = TRUE
        RETURNING token`,
      [userId, reason]
    );
    // Invalidate every cached entry for this user
    for (const row of res.rows) {
      cache.set(row.token, { valid: false, ts: Date.now() });
    }
    return res.rowCount;
  },

  // ─── Fast validity check (auth middleware hot path) ─────────────────────
  async isTokenActive(token) {
    // 1. Check in-memory cache first
    const cached = cache.get(token);
    if (cached && Date.now() - cached.ts < TOKEN_CACHE_TTL_MS) {
      return cached.valid;
    }

    // 2. Cache miss or stale → single fast indexed query
    const res = await pool.query(
      `SELECT 1 FROM auth_tokens WHERE token = $1 AND is_active = TRUE LIMIT 1`,
      [token]
    );
    const valid = res.rows.length > 0;
    cache.set(token, { valid, ts: Date.now() });
    return valid;
  },

  // ─── Monitoring queries ────────────────────────────────────────────────
  async getAllSessions() {
    const res = await pool.query(`
      SELECT
        at.id,
        at.user_id,
        sm."sevakname"   AS user_name,
        sm."mobileno"    AS mobile_number,
        at.device_info,
        at.ip_address,
        at.logged_in_at,
        at.logged_out_at,
        at.logout_reason,
        at.is_active
      FROM auth_tokens at
      LEFT JOIN "SevakMaster" sm ON sm."seid" = at.user_id::integer
      ORDER BY at.logged_in_at DESC
      LIMIT 500
    `);
    return res.rows;
  },

  async getActiveSessions() {
    const res = await pool.query(`
      SELECT
        at.id,
        at.user_id,
        sm."sevakname"   AS user_name,
        sm."mobileno"    AS mobile_number,
        at.device_info,
        at.ip_address,
        at.logged_in_at,
        at.is_active
      FROM auth_tokens at
      LEFT JOIN "SevakMaster" sm ON sm."seid" = at.user_id::integer
      WHERE at.is_active = TRUE
      ORDER BY at.logged_in_at DESC
    `);
    return res.rows;
  },
};

export default tokenStore;
