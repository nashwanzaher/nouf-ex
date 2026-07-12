var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/db/pg-wrapper.ts
import { Pool } from "pg";
function normalizeSql(sql) {
  return sql.replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP").replace(/\b(is_\w+)\s*=\s*1\b/gi, "$1 = TRUE").replace(/\b(is_\w+)\s*=\s*0\b/gi, "$1 = FALSE");
}
function pgify(sql) {
  let out = "";
  let i = 0;
  let k = 0;
  const len = sql.length;
  const copyVerbatim = (end) => {
    out += sql.slice(k, end);
    k = end;
  };
  while (k < len) {
    const ch = sql[k];
    if (ch === "-" && sql[k + 1] === "-") {
      const eol = sql.indexOf("\n", k + 2);
      copyVerbatim(eol === -1 ? len : eol);
      continue;
    }
    if (ch === "/" && sql[k + 1] === "*") {
      let depth = 1;
      let cursor = k + 2;
      while (cursor < len && depth > 0) {
        if (sql[cursor] === "/" && sql[cursor + 1] === "*") {
          depth++;
          cursor += 2;
        } else if (sql[cursor] === "*" && sql[cursor + 1] === "/") {
          depth--;
          cursor += 2;
        } else {
          cursor++;
        }
      }
      copyVerbatim(cursor);
      continue;
    }
    if ((ch === "E" || ch === "e") && sql[k + 1] === "'") {
      out += ch + "'";
      k += 2;
      while (k < len) {
        const c = sql[k];
        if (c === "\\" && k + 1 < len) {
          out += c + sql[k + 1];
          k += 2;
          continue;
        }
        if (c === "'" && sql[k + 1] === "'") {
          out += "''";
          k += 2;
          continue;
        }
        if (c === "'") {
          out += c;
          k++;
          break;
        }
        out += c;
        k++;
      }
      continue;
    }
    if (ch === "'") {
      out += ch;
      k++;
      while (k < len) {
        const c = sql[k];
        if (c === "'" && sql[k + 1] === "'") {
          out += "''";
          k += 2;
          continue;
        }
        if (c === "'") {
          out += c;
          k++;
          break;
        }
        out += c;
        k++;
      }
      continue;
    }
    if (ch === '"') {
      out += ch;
      k++;
      while (k < len) {
        const c = sql[k];
        if (c === '"' && sql[k + 1] === '"') {
          out += '""';
          k += 2;
          continue;
        }
        if (c === '"') {
          out += c;
          k++;
          break;
        }
        out += c;
        k++;
      }
      continue;
    }
    if (ch === "$") {
      const tagMatch = sql.slice(k).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        out += tag;
        k += tag.length;
        const endIdx = sql.indexOf(tag, k);
        if (endIdx === -1) {
          copyVerbatim(len);
        } else {
          copyVerbatim(endIdx);
          out += tag;
          k = endIdx + tag.length;
        }
        continue;
      }
    }
    if (ch === "?") {
      i++;
      out += "$" + i;
      k++;
      continue;
    }
    out += ch;
    k++;
  }
  return out;
}
var PgStatement, PgTxDb, PgDb;
var init_pg_wrapper = __esm({
  "server/db/pg-wrapper.ts"() {
    PgStatement = class {
      pool;
      pgSql;
      constructor(pool, sql) {
        this.pool = pool;
        this.pgSql = pgify(normalizeSql(sql));
      }
      async _query(params) {
        const args = params && params.length ? Array.from(params) : [];
        const res = await this.pool.query(this.pgSql, args);
        return res;
      }
      /** Return all rows. */
      async all(...params) {
        const res = await this._query(params);
        return res.rows;
      }
      /** Return the first row or undefined. */
      async get(...params) {
        const res = await this._query(params);
        return res.rows[0];
      }
      /** Execute a non-SELECT (INSERT/UPDATE/DELETE). Returns { lastInsertRowid, changes }. */
      async run(...params) {
        const res = await this._query(params);
        const lastInsertRowid = res.rows && res.rows[0] && res.rows[0].id !== void 0 ? res.rows[0].id : null;
        return { lastInsertRowid, changes: res.rowCount || 0 };
      }
    };
    PgTxDb = class {
      client;
      constructor(client) {
        this.client = client;
      }
      prepare(sql) {
        const stmt = new PgStatement({ query: (s, p) => this.client.query(s, p) }, sql);
        return stmt;
      }
    };
    PgDb = class {
      pool;
      constructor(connectionString) {
        const config = {
          connectionString,
          // Pool size: default 20 (was 10). Override via DB_POOL_MAX env var.
          // 20 matches a typical 4-vCPU host under moderate load; raise
          // further for high-concurrency deployments.
          max: parseInt(process.env.DB_POOL_MAX || "20", 10),
          idleTimeoutMillis: 3e4,
          connectionTimeoutMillis: 5e3
        };
        if (process.env.DB_SSL === "true" || /sslmode=require/.test(connectionString)) {
          config.ssl = {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
          };
        }
        this.pool = new Pool(config);
      }
      /** Redact password from a postgres:// URL — safe to log. */
      static redactUrl(url) {
        return url.replace(/:[^:@/]+@/, ":***@");
      }
      prepare(sql) {
        return new PgStatement(this.pool, sql);
      }
      /** Execute `fn` inside a transaction. The callback receives a tx-scoped PgDb-like object. */
      async tx(fn) {
        const client = await this.pool.connect();
        try {
          await client.query("BEGIN", []);
          const txDb = new PgTxDb(client);
          const out = await fn(txDb);
          await client.query("COMMIT", []);
          return out;
        } catch (err) {
          try {
            await client.query("ROLLBACK", []);
          } catch (_) {
          }
          throw err;
        } finally {
          client.release();
        }
      }
      async close() {
        await this.pool.end();
      }
    };
  }
});

// server/lib/auth.ts
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}
async function verifyPassword(password, stored) {
  if (!stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
  const storedKey = Buffer.from(keyB64, "base64");
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}
var scrypt, SCRYPT_KEYLEN;
var init_auth = __esm({
  "server/lib/auth.ts"() {
    scrypt = promisify(scryptCb);
    SCRYPT_KEYLEN = 64;
  }
});

// server/lib/ratelimit.ts
function rateLimit(windowMs, max, bucket = "global") {
  return async (req, res, next) => {
    const route = req.route?.path || req.path.split("?")[0];
    const ip = req.ip || req.socket.remoteAddress || "anon";
    const key = `${bucket}:${req.method}:${route}:${ip}`;
    try {
      const row = await db.prepare("SELECT allowed, retry_after_ms FROM consume_rate_limit($1, $2, $3, $4)").get(bucket, key, windowMs, max);
      if (!row) return next();
      if (!row.allowed) {
        res.setHeader("Retry-After", Math.ceil(row.retry_after_ms / 1e3));
        const { sendError: sendError2 } = await Promise.resolve().then(() => (init_shared(), shared_exports));
        return sendError2(res, "Too many requests. Try again later.", 429, "RATE_LIMITED");
      }
    } catch (err) {
      const { log: log2 } = await Promise.resolve().then(() => (init_shared(), shared_exports));
      log2.warn({
        msg: "rate_limit_db_error",
        bucket,
        route,
        error: err.message
      });
    }
    next();
  };
}
var authLimiter;
var init_ratelimit = __esm({
  "server/lib/ratelimit.ts"() {
    init_shared();
    authLimiter = rateLimit(15 * 60 * 1e3, 20, "auth");
  }
});

// server/lib/sql-helpers.ts
function buildUpdateSet(fields) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (sets.length === 0) {
    throw new HttpError(400, "At least one updateable field must be provided.", {
      code: "EMPTY_UPDATE"
    });
  }
  return { sql: sets.join(", "), params };
}
var init_sql_helpers = __esm({
  "server/lib/sql-helpers.ts"() {
    init_middleware();
  }
});

// server/lib/validation.ts
import { z } from "zod";
function validate(schema, body) {
  const r = schema.safeParse(body);
  return r.success ? { ok: true, data: r.data } : {
    ok: false,
    error: r.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")
  };
}
function hasLower(s) {
  return /[a-z]/.test(s);
}
function hasUpper(s) {
  return /[A-Z]/.test(s);
}
function hasDigit(s) {
  return /\d/.test(s);
}
function hasSymbol(s) {
  return /[^A-Za-z0-9]/.test(s);
}
function classCount(s) {
  return (hasLower(s) ? 1 : 0) + (hasUpper(s) ? 1 : 0) + (hasDigit(s) ? 1 : 0) + (hasSymbol(s) ? 1 : 0);
}
function hasRepeatedRuns(s) {
  return /(.)\1{3,}/.test(s);
}
function hasSequentialRuns(s) {
  const lower = s.toLowerCase();
  for (let i = 0; i <= lower.length - 4; i++) {
    const a = lower.charCodeAt(i);
    const b = lower.charCodeAt(i + 1);
    const c = lower.charCodeAt(i + 2);
    const d = lower.charCodeAt(i + 3);
    if (b === a + 1 && c === b + 1 && d === c + 1) return true;
    if (b === a - 1 && c === b - 1 && d === c - 1) return true;
  }
  return false;
}
function evaluatePasswordStrength(password, email) {
  if (password.length < 10) {
    return "Password must be at least 10 characters long.";
  }
  if (password.length > 128) {
    return "Password must be at most 128 characters long.";
  }
  if (classCount(password) < 3) {
    return "Password must include at least 3 of: lowercase, uppercase, digit, symbol.";
  }
  if (hasRepeatedRuns(password)) {
    return 'Password contains a repeated character run (e.g. "aaaa").';
  }
  if (hasSequentialRuns(password)) {
    return 'Password contains a sequential run (e.g. "1234" or "abcd").';
  }
  const normalised = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalised)) {
    return "Password is too common. Please choose a different one.";
  }
  if (email) {
    const at = email.indexOf("@");
    const localPart = at > 0 ? email.slice(0, at).toLowerCase() : "";
    if (localPart.length >= 4 && normalised === localPart) {
      return "Password must not equal your email address.";
    }
  }
  return null;
}
function resolveOrderStoreId(requestedProductIds, productRows) {
  if (requestedProductIds.length === 0) {
    return { ok: false, code: "EMPTY_CART" };
  }
  const byId = /* @__PURE__ */ new Map();
  for (const p of productRows) byId.set(p.id, p);
  for (const pid of requestedProductIds) {
    const row = byId.get(pid);
    if (!row || !row.is_active || row.deleted_at) {
      return { ok: false, code: "PRODUCT_UNAVAILABLE", productId: pid };
    }
  }
  const storeIds = new Set(productRows.map((p) => p.store_id));
  if (storeIds.size > 1) {
    return { ok: false, code: "MIXED_STORES" };
  }
  const first = productRows[0];
  if (!first) {
    return { ok: false, code: "EMPTY_CART" };
  }
  return { ok: true, storeId: first.store_id };
}
var COMMON_PASSWORDS, emailSchema, passwordSchema, registerSchema, loginSchema, orderItemSchema, orderSchema, reviewSchema, addressSchema, profileUpdateSchema, passwordChangeSchema, paymentCreateSchema, refundCreateSchema, couponRedeemSchema, COUPON_COLUMNS, paginationSchema, adminUserUpdateSchema, adminStoreUpdateSchema, adminOrderStatusSchema, adminProductUpdateSchema, adminDisputeUpdateSchema, cartAddSchema, cartItemIdParamSchema, cartItemUpdateSchema, wishlistAddSchema, wishlistItemIdParamSchema, notificationIdParamSchema, sellerProductCreateSchema, sellerProductUpdateSchema, sellerProductIdParamSchema, sellerStoreUpdateSchema, sellerOrderStatusUpdateSchema, sellerProductImageAddSchema;
var init_validation = __esm({
  "server/lib/validation.ts"() {
    COMMON_PASSWORDS = /* @__PURE__ */ new Set([
      "password",
      "password1",
      "password123",
      "password1234",
      "password!",
      "qwerty",
      "qwerty123",
      "qwertyuiop",
      "iloveyou",
      "admin",
      "admin123",
      "admin1234",
      "admin@123",
      "12345678",
      "123456789",
      "1234567890",
      "12345678910",
      "11111111",
      "00000000",
      "abc12345",
      "abc123456",
      "abcdefgh",
      "abcd1234",
      "welcome",
      "welcome1",
      "welcome123",
      "monkey123",
      "letmein",
      "sunshine",
      "princess",
      "football",
      "baseball",
      "dragon",
      "master",
      "michael",
      "jordan",
      "tigger",
      "shadow",
      "trustno1",
      "hunter2",
      "hunter123",
      "passw0rd",
      "p@ssword",
      "p@ssword1",
      "p@ssw0rd",
      "nopassword",
      "starwars",
      "login",
      "changeme",
      "secret",
      "secret123",
      "mypass",
      "mypassword",
      "mysecret"
    ]);
    emailSchema = z.string().email().max(255);
    passwordSchema = z.string().min(10, "Password must be at least 10 characters long.").max(128, "Password must be at most 128 characters long.").refine(
      (p) => classCount(p) >= 3,
      "Password must include at least 3 of: lowercase, uppercase, digit, symbol."
    ).refine((p) => !hasRepeatedRuns(p), "Password contains a repeated character run.").refine(
      (p) => !hasSequentialRuns(p),
      'Password contains a sequential run (e.g. "1234" or "abcd").'
    ).refine(
      (p) => !COMMON_PASSWORDS.has(p.toLowerCase()),
      "Password is too common. Please choose a different one."
    );
    registerSchema = z.object({
      email: emailSchema,
      password: passwordSchema,
      name: z.string().trim().min(2).max(100)
    }).refine((data) => evaluatePasswordStrength(data.password, data.email) === null, {
      message: "Password does not meet strength requirements.",
      path: ["password"]
    });
    loginSchema = z.object({
      email: emailSchema,
      password: z.string().min(1).max(128)
    });
    orderItemSchema = z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().max(1e3),
      variant: z.unknown().optional()
    }).strict();
    orderSchema = z.object({
      storeId: z.number().int().positive().optional(),
      items: z.array(orderItemSchema).min(1).max(100),
      shippingAddress: z.record(z.string(), z.unknown()).optional(),
      paymentMethod: z.string().max(50).optional(),
      notes: z.string().max(1e3).optional(),
      couponCode: z.string().max(50).optional(),
      // Accepted but ignored — kept for backwards compatibility.
      // Server recomputes these from products.price.
      subtotal: z.number().nonnegative().optional(),
      shippingCost: z.number().nonnegative().optional(),
      discount: z.number().nonnegative().optional(),
      total: z.number().nonnegative().optional()
    }).strict();
    reviewSchema = z.object({
      productId: z.number().int().positive(),
      storeId: z.number().int().positive().optional(),
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().max(200).optional(),
      comment: z.string().trim().max(2e3).optional()
    });
    addressSchema = z.object({
      label: z.string().trim().min(1).max(50),
      full_name: z.string().trim().min(2).max(100),
      phone: z.string().trim().min(5).max(20),
      governorate: z.string().trim().min(2).max(50),
      city: z.string().trim().min(1).max(50),
      district: z.string().trim().max(80).optional(),
      street: z.string().trim().min(2).max(200),
      building: z.string().trim().max(50).optional(),
      notes: z.string().trim().max(500).optional(),
      is_default: z.boolean().optional()
    }).strict();
    profileUpdateSchema = z.object({
      full_name: z.string().trim().min(2).max(100).optional(),
      phone: z.string().trim().min(5).max(20).optional(),
      avatar: z.string().trim().url().max(500).optional().nullable(),
      preferred_language: z.enum(["ar", "en", "zh"]).optional(),
      gender: z.enum(["male", "female", "other"]).nullable().optional()
    }).strict();
    passwordChangeSchema = z.object({
      current_password: z.string().min(1).max(128),
      new_password: passwordSchema
    }).strict();
    paymentCreateSchema = z.object({
      order_id: z.number().int().positive(),
      amount: z.number().nonnegative(),
      currency: z.string().length(3).default("YER"),
      method: z.enum(["cod", "card", "wallet", "bank_transfer", "stripe", "paymob"]).default("cod"),
      transaction_id: z.string().trim().max(200).optional()
    });
    refundCreateSchema = z.object({
      order_id: z.number().int().positive(),
      amount: z.number().nonnegative(),
      reason: z.string().trim().min(3).max(1e3)
    });
    couponRedeemSchema = z.object({
      code: z.string().trim().min(1).max(50),
      user_id: z.number().int().positive(),
      order_subtotal: z.number().nonnegative()
    });
    COUPON_COLUMNS = "id, code, type, value, min_order_amount AS min_order, max_discount, usage_limit, usage_count, starts_at, expires_at";
    paginationSchema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0)
    });
    adminUserUpdateSchema = z.object({
      status: z.enum(["active", "suspended", "banned"]).optional(),
      role: z.enum(["customer", "merchant", "admin"]).optional(),
      is_verified: z.boolean().optional(),
      email_verified: z.boolean().optional(),
      phone_verified: z.boolean().optional()
    }).strict();
    adminStoreUpdateSchema = z.object({
      is_active: z.boolean().optional(),
      is_verified: z.boolean().optional(),
      trust_level: z.enum(["verified", "gold", "premium"]).optional()
    }).strict();
    adminOrderStatusSchema = z.object({
      status: z.enum([
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded"
      ]),
      note: z.string().trim().max(500).optional()
    }).strict();
    adminProductUpdateSchema = z.object({
      is_active: z.boolean().optional(),
      is_featured: z.boolean().optional()
    }).strict();
    adminDisputeUpdateSchema = z.object({
      // Matches the disputes_status_check constraint in schema-extra.sql:
      // 'open' → 'investigating' → {resolved_buyer, resolved_seller, closed, rejected}
      status: z.enum([
        "open",
        "investigating",
        "resolved_buyer",
        "resolved_seller",
        "closed",
        "rejected"
      ]),
      resolution: z.string().trim().min(3).max(2e3).optional(),
      refund_amount: z.number().nonnegative().optional()
    }).strict();
    cartAddSchema = z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(100),
      variant: z.record(z.string(), z.unknown()).optional()
    }).strict();
    cartItemIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
    cartItemUpdateSchema = z.object({
      quantity: z.number().int().positive().max(100),
      variant: z.record(z.string(), z.unknown()).optional()
    }).strict();
    wishlistAddSchema = z.object({
      productId: z.number().int().positive()
    }).strict();
    wishlistItemIdParamSchema = z.object({
      id: z.coerce.number().int().positive()
    });
    notificationIdParamSchema = z.object({
      id: z.coerce.number().int().positive()
    });
    sellerProductCreateSchema = z.object({
      name_ar: z.string().trim().min(2).max(200),
      name_en: z.string().trim().min(2).max(200).optional(),
      name_zh: z.string().trim().min(2).max(200).optional(),
      slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, or hyphens"),
      sku: z.string().trim().min(1).max(50).optional(),
      category_id: z.number().int().positive(),
      price: z.number().nonnegative(),
      original_price: z.number().nonnegative().optional(),
      stock: z.number().int().nonnegative().default(0),
      description: z.string().trim().max(4e3).optional(),
      main_image: z.string().trim().url().optional(),
      images: z.array(z.string().trim().url()).max(20).optional(),
      features: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
      badges: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }).strict();
    sellerProductUpdateSchema = z.object({
      name_ar: z.string().trim().min(2).max(200).optional(),
      name_en: z.string().trim().min(2).max(200).optional(),
      name_zh: z.string().trim().min(2).max(200).optional(),
      sku: z.string().trim().min(1).max(50).optional(),
      price: z.number().nonnegative().optional(),
      original_price: z.number().nonnegative().optional(),
      stock: z.number().int().nonnegative().optional(),
      description: z.string().trim().max(4e3).optional(),
      main_image: z.string().trim().url().optional(),
      images: z.array(z.string().trim().url()).max(20).optional(),
      features: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
      badges: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }).strict();
    sellerProductIdParamSchema = z.object({
      id: z.coerce.number().int().positive()
    });
    sellerStoreUpdateSchema = z.object({
      store_name: z.string().trim().min(2).max(100).optional(),
      name_ar: z.string().trim().min(2).max(100).optional(),
      name_en: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(4e3).optional(),
      logo_url: z.string().trim().url().optional(),
      banner_url: z.string().trim().url().optional(),
      phone: z.string().trim().min(5).max(20).optional(),
      city: z.string().trim().min(1).max(50).optional(),
      governorate: z.string().trim().min(2).max(50).optional()
    }).strict();
    sellerOrderStatusUpdateSchema = z.object({
      status: z.enum(["confirmed", "processing", "shipped", "delivered", "cancelled"]),
      tracking_number: z.string().trim().min(3).max(100).optional(),
      note: z.string().trim().max(500).optional()
    }).strict();
    sellerProductImageAddSchema = z.object({
      url: z.string().trim().url(),
      alt_text: z.string().trim().max(200).optional(),
      sort_order: z.number().int().nonnegative().default(0),
      is_primary: z.boolean().default(false)
    }).strict();
  }
});

// server/lib/audit.ts
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function todayIsoDate() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function redactSensitive(input) {
  if (input === null || input === void 0) return input;
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item));
  }
  if (typeof input !== "object") return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = REDACT_PLACEHOLDER;
    } else {
      out[k] = redactSensitive(v);
    }
  }
  return out;
}
async function appendAuditDlq(entry) {
  try {
    const fs2 = await import("node:fs");
    const path2 = await import("node:path");
    const logsDir = path2.resolve(process.cwd(), "logs");
    if (!fs2.existsSync(logsDir)) fs2.mkdirSync(logsDir, { recursive: true });
    const file = path2.join(logsDir, `audit-dlq-${todayIsoDate()}.jsonl`);
    fs2.appendFileSync(file, JSON.stringify(entry) + "\n", { encoding: "utf8" });
    const { log: log2 } = await Promise.resolve().then(() => (init_shared(), shared_exports));
    log2.error({ msg: "audit_log_dead_lettered", file });
  } catch (err) {
    const { log: log2 } = await Promise.resolve().then(() => (init_shared(), shared_exports));
    log2.error({
      msg: "audit_log_dlq_write_failed",
      error: err.message
    });
  }
}
async function writeAuditLog(req, action, entityType, entityId, oldValues, newValues) {
  const safeOld = oldValues ? redactSensitive(oldValues) : null;
  const safeNew = newValues ? redactSensitive(newValues) : null;
  const params = [
    req.user.id,
    action,
    entityType,
    String(entityId),
    safeOld ? JSON.stringify(safeOld) : null,
    safeNew ? JSON.stringify(safeNew) : null,
    req.ip,
    req.header("user-agent") ?? null
  ];
  let lastError = null;
  for (let attempt = 1; attempt <= AUDIT_DLQ_MAX_ATTEMPTS; attempt++) {
    try {
      await db.prepare(`SELECT write_audit_log($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`).run(...params);
      if (attempt > 1) {
        const { log: log2 } = await Promise.resolve().then(() => (init_shared(), shared_exports));
        log2.info({
          msg: "audit_log_recovered",
          attempt,
          entity: entityType
        });
      }
      return;
    } catch (err) {
      lastError = err;
      const { log: log2 } = await Promise.resolve().then(() => (init_shared(), shared_exports));
      log2.warn({
        msg: "audit_log_failed",
        attempt,
        entity: entityType,
        error: err.message
      });
      if (attempt < AUDIT_DLQ_MAX_ATTEMPTS) {
        await sleep(AUDIT_RETRY_BASE_MS * 2 ** (attempt - 1));
      }
    }
  }
  await appendAuditDlq({
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    user_id: params[0],
    action: params[1],
    entity_type: params[2],
    entity_id: params[3],
    old_values: params[4],
    new_values: params[5],
    ip: params[6],
    user_agent: params[7],
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });
}
var AUDIT_DLQ_MAX_ATTEMPTS, AUDIT_RETRY_BASE_MS, REDACT_KEYS, REDACT_PLACEHOLDER;
var init_audit = __esm({
  "server/lib/audit.ts"() {
    init_shared();
    AUDIT_DLQ_MAX_ATTEMPTS = 3;
    AUDIT_RETRY_BASE_MS = 100;
    REDACT_KEYS = /* @__PURE__ */ new Set([
      "password",
      "password_hash",
      "passwd",
      "pwd",
      "token",
      "auth_token",
      "access_token",
      "refresh_token",
      "api_key",
      "apikey",
      "secret",
      "client_secret",
      "private_key",
      "cvv",
      "cvc",
      "ssn",
      "authorization"
    ]);
    REDACT_PLACEHOLDER = "[REDACTED]";
  }
});

// server/lib/json.ts
function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") {
    if (Array.isArray(value) || typeof value === "object") {
      return value;
    }
    return fallback;
  }
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}
var getProductWithParsedFields;
var init_json = __esm({
  "server/lib/json.ts"() {
    getProductWithParsedFields = (product) => {
      if (!product) return null;
      return {
        ...product,
        features: parseJson(product.features, []),
        badges: parseJson(product.badges, []),
        specifications: parseJson(product.specifications, {}),
        colors: parseJson(product.colors, []),
        sizes: parseJson(product.sizes, [])
      };
    };
  }
});

// server/lib/shared.ts
var shared_exports = {};
__export(shared_exports, {
  COUPON_COLUMNS: () => COUPON_COLUMNS,
  HttpError: () => HttpError,
  addressSchema: () => addressSchema,
  adminDisputeUpdateSchema: () => adminDisputeUpdateSchema,
  adminOrderStatusSchema: () => adminOrderStatusSchema,
  adminProductUpdateSchema: () => adminProductUpdateSchema,
  adminStoreUpdateSchema: () => adminStoreUpdateSchema,
  adminUserUpdateSchema: () => adminUserUpdateSchema,
  authLimiter: () => authLimiter,
  buildUpdateSet: () => buildUpdateSet,
  cartAddSchema: () => cartAddSchema,
  cartItemIdParamSchema: () => cartItemIdParamSchema,
  cartItemUpdateSchema: () => cartItemUpdateSchema,
  computeCouponDiscount: () => computeCouponDiscount,
  couponRedeemSchema: () => couponRedeemSchema,
  db: () => db,
  emailSchema: () => emailSchema,
  evaluatePasswordStrength: () => evaluatePasswordStrength,
  getProductWithParsedFields: () => getProductWithParsedFields,
  hashPassword: () => hashPassword,
  log: () => log,
  loginSchema: () => loginSchema,
  notificationIdParamSchema: () => notificationIdParamSchema,
  orderItemSchema: () => orderItemSchema,
  orderSchema: () => orderSchema,
  paginationSchema: () => paginationSchema,
  parseJson: () => parseJson,
  passwordChangeSchema: () => passwordChangeSchema,
  passwordSchema: () => passwordSchema,
  paymentCreateSchema: () => paymentCreateSchema,
  profileUpdateSchema: () => profileUpdateSchema,
  rateLimit: () => rateLimit,
  redactSensitive: () => redactSensitive,
  refundCreateSchema: () => refundCreateSchema,
  registerSchema: () => registerSchema,
  requireAuth: () => requireAuth,
  requireRole: () => requireRole,
  resolveOrderStoreId: () => resolveOrderStoreId,
  reviewSchema: () => reviewSchema,
  sellerOrderStatusUpdateSchema: () => sellerOrderStatusUpdateSchema,
  sellerProductCreateSchema: () => sellerProductCreateSchema,
  sellerProductIdParamSchema: () => sellerProductIdParamSchema,
  sellerProductImageAddSchema: () => sellerProductImageAddSchema,
  sellerProductUpdateSchema: () => sellerProductUpdateSchema,
  sellerStoreUpdateSchema: () => sellerStoreUpdateSchema,
  sendError: () => sendError,
  sendSuccess: () => sendSuccess,
  validate: () => validate,
  verifyPassword: () => verifyPassword,
  wishlistAddSchema: () => wishlistAddSchema,
  wishlistItemIdParamSchema: () => wishlistItemIdParamSchema,
  writeAuditLog: () => writeAuditLog
});
async function computeCouponDiscount(coupon, orderSubtotal) {
  const row = await db.prepare(
    "SELECT coupon_discount_amount($1, $2::numeric, $3::numeric, $4::numeric) AS discount"
  ).get(coupon.type, coupon.value, coupon.max_discount, orderSubtotal);
  return row ? Number(row.discount) : 0;
}
var _databaseUrl, db;
var init_shared = __esm({
  "server/lib/shared.ts"() {
    init_pg_wrapper();
    init_middleware();
    init_auth();
    init_ratelimit();
    init_sql_helpers();
    init_validation();
    init_audit();
    init_json();
    init_validation();
    _databaseUrl = process.env.DATABASE_URL;
    if (!_databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Configure it in .env (local) or via docker-compose env_file (container)."
      );
    }
    db = new PgDb(_databaseUrl);
  }
});

// server/lib/error-codes.ts
function isErrorCode(value) {
  return typeof value === "string" && value in ErrorCodes;
}
var ErrorCodes, ErrorMessages, ErrorStatuses;
var init_error_codes = __esm({
  "server/lib/error-codes.ts"() {
    ErrorCodes = {
      // ─── 4xx Client errors ─────────────────────────────────────
      VALIDATION_ERROR: "VALIDATION_ERROR",
      // 400 — Zod failure / bad input
      UNAUTHORIZED: "UNAUTHORIZED",
      // 401 — missing or invalid auth token
      FORBIDDEN: "FORBIDDEN",
      // 403 — auth ok but role/permission insufficient
      NOT_FOUND: "NOT_FOUND",
      // 404 — resource doesn't exist (or not owned by user)
      CONFLICT: "CONFLICT",
      // 409 — unique constraint / state machine violation
      DUPLICATE: "DUPLICATE",
      // 409 — alias for CONFLICT, kept for semantic clarity
      PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
      // 413 — express.json() limit exceeded
      UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
      // 422 — semantic validation (e.g. stock < qty)
      RATE_LIMITED: "RATE_LIMITED",
      // 429 — bucket exceeded
      // ─── 5xx Server errors ─────────────────────────────────────
      INTERNAL_ERROR: "INTERNAL_ERROR",
      // 500 — generic catch-all
      DATABASE_ERROR: "DATABASE_ERROR",
      // 500 — unrecognised PG error code
      SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
      // 503 — DB unreachable (40P01)
      // ─── Mutation failures (DB-level) ─────────────────────────
      INSERT_FAILED: "INSERT_FAILED",
      // 500 — INSERT didn't return a row
      UPDATE_FAILED: "UPDATE_FAILED",
      // 500 — UPDATE matched 0 rows
      DELETE_FAILED: "DELETE_FAILED",
      // 500 — DELETE matched 0 rows
      // ─── Feature-specific state-machine codes ──────────────────
      // These are still universal in the sense that the frontend can
      // branch on them, but they encode business state rather than
      // generic HTTP semantics. The corresponding status is 409
      // (Conflict) for "already in the target state" patterns.
      ALREADY_ENABLED: "ALREADY_ENABLED",
      // 409 — feature flag already on (e.g. 2FA)
      NOT_ENABLED: "NOT_ENABLED",
      // 400/409 — prerequisite feature flag is off
      PARTIAL_INVALID: "PARTIAL_INVALID"
      // 401 — 2FA partial_token expired/tampered
    };
    ErrorMessages = {
      // 4xx
      [ErrorCodes.VALIDATION_ERROR]: "Invalid input.",
      [ErrorCodes.UNAUTHORIZED]: "Authentication required.",
      [ErrorCodes.FORBIDDEN]: "You do not have permission to perform this action.",
      [ErrorCodes.NOT_FOUND]: "Resource not found.",
      [ErrorCodes.CONFLICT]: "Conflict with the current state.",
      [ErrorCodes.DUPLICATE]: "This resource already exists.",
      [ErrorCodes.PAYLOAD_TOO_LARGE]: "Request body too large.",
      [ErrorCodes.UNPROCESSABLE_ENTITY]: "The request was well-formed but semantically invalid.",
      [ErrorCodes.RATE_LIMITED]: "Too many requests. Please slow down.",
      // 5xx
      [ErrorCodes.INTERNAL_ERROR]: "An unexpected error occurred.",
      [ErrorCodes.DATABASE_ERROR]: "A database error occurred.",
      [ErrorCodes.SERVICE_UNAVAILABLE]: "Service is temporarily unavailable.",
      // Mutations
      [ErrorCodes.INSERT_FAILED]: "Failed to create the resource.",
      [ErrorCodes.UPDATE_FAILED]: "Failed to update the resource.",
      [ErrorCodes.DELETE_FAILED]: "Failed to delete the resource.",
      // Feature-specific state-machine
      [ErrorCodes.ALREADY_ENABLED]: "This feature is already enabled.",
      [ErrorCodes.NOT_ENABLED]: "This feature is not enabled.",
      [ErrorCodes.PARTIAL_INVALID]: "The 2FA partial token is invalid or expired."
    };
    ErrorStatuses = {
      [ErrorCodes.VALIDATION_ERROR]: 400,
      [ErrorCodes.UNAUTHORIZED]: 401,
      [ErrorCodes.FORBIDDEN]: 403,
      [ErrorCodes.NOT_FOUND]: 404,
      [ErrorCodes.CONFLICT]: 409,
      [ErrorCodes.DUPLICATE]: 409,
      [ErrorCodes.PAYLOAD_TOO_LARGE]: 413,
      [ErrorCodes.UNPROCESSABLE_ENTITY]: 422,
      [ErrorCodes.RATE_LIMITED]: 429,
      [ErrorCodes.INTERNAL_ERROR]: 500,
      [ErrorCodes.DATABASE_ERROR]: 500,
      [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
      [ErrorCodes.INSERT_FAILED]: 500,
      [ErrorCodes.UPDATE_FAILED]: 500,
      [ErrorCodes.DELETE_FAILED]: 500,
      [ErrorCodes.ALREADY_ENABLED]: 409,
      [ErrorCodes.NOT_ENABLED]: 409,
      [ErrorCodes.PARTIAL_INVALID]: 401
    };
  }
});

// server/middleware.ts
var middleware_exports = {};
__export(middleware_exports, {
  ErrorCodes: () => ErrorCodes,
  ErrorMessages: () => ErrorMessages,
  ErrorStatuses: () => ErrorStatuses,
  HttpError: () => HttpError,
  PgDb: () => PgDb,
  __setCachedAuthForTests: () => __setCachedAuthForTests,
  configureTrustProxy: () => configureTrustProxy,
  errorHandler: () => errorHandler,
  healthRateLimit: () => healthRateLimit,
  invalidateAuthCache: () => invalidateAuthCache,
  invalidateTokenVersionCache: () => invalidateTokenVersionCache,
  isErrorCode: () => isErrorCode,
  loadEnv: () => loadEnv,
  log: () => log,
  notFoundHandler: () => notFoundHandler,
  optionalAuth: () => optionalAuth,
  parsePagination: () => parsePagination,
  requestId: () => requestId,
  requestLogger: () => requestLogger,
  requireAuth: () => requireAuth,
  requireRole: () => requireRole,
  resolveDatabaseUrl: () => resolveDatabaseUrl,
  securityHeaders: () => securityHeaders,
  sendError: () => sendError,
  sendSuccess: () => sendSuccess,
  signAuthToken: () => signAuthToken,
  verifyAuthToken: () => verifyAuthToken
});
import { createHmac, randomBytes as randomBytes2, randomUUID, timingSafeEqual as timingSafeEqual2 } from "crypto";
import { z as zod } from "zod";
function configureTrustProxy(app2) {
  const v = process.env.TRUST_PROXY;
  const isProd = process.env.NODE_ENV === "production";
  if (v == null || v === "") {
    if (isProd) {
      log.warn({
        msg: "trust_proxy_unset",
        hint: "Set TRUST_PROXY in production if you run behind nginx / k8s ingress / load balancer. Without it req.ip collapses to 127.0.0.1 for every request, breaking rate-limiting and audit logs."
      });
    }
    return;
  }
  app2.set("trust proxy", v);
  log.info({ msg: "trust_proxy_configured", value: v });
}
function shouldLog(level) {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}
function emit(level, obj) {
  if (!shouldLog(level)) return;
  process.stdout.write(JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), level, ...obj }) + "\n");
}
function asPg(err) {
  if (err && typeof err === "object") return err;
  return {};
}
function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64url(s) {
  const pad = s.length % 4 === 0 ? 0 : 4 - s.length % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}
function getAuthSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      `AUTH_SECRET env var is required (\u226532 random chars). Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
    );
  }
  return s;
}
function signAuthToken(payload) {
  const full = {
    ...payload,
    exp: Math.floor(Date.now() / 1e3) + TOKEN_TTL_SECONDS
  };
  const body = base64url(Buffer.from(JSON.stringify(full)));
  const sig = base64url(createHmac("sha256", getAuthSecret()).update(body).digest());
  return `${body}.${sig}`;
}
function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".", 2);
  if (!body || !sig) return null;
  const expected = base64url(createHmac("sha256", getAuthSecret()).update(body).digest());
  if (expected.length !== sig.length) return null;
  let ok = false;
  try {
    ok = timingSafeEqual2(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return null;
  }
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64url(body).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.sub !== "number" || typeof payload?.role !== "string" || typeof payload?.exp !== "number" || typeof payload?.ver !== "number") {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1e3)) return null;
  return payload;
}
async function fetchUserAuth(userId) {
  const cached2 = authCache.get(userId);
  if (cached2 && Date.now() - cached2.cachedAt < AUTH_CACHE_TTL_MS) {
    return { ver: cached2.ver, role: cached2.role };
  }
  try {
    const row = await db.prepare(
      "SELECT token_version, role FROM users WHERE id = ? AND deleted_at IS NULL"
    ).get(userId);
    if (!row) {
      return null;
    }
    authCache.set(userId, {
      ver: row.token_version,
      role: row.role,
      cachedAt: Date.now()
    });
    return { ver: row.token_version, role: row.role };
  } catch (err) {
    log.warn({
      msg: "auth_lookup_failed",
      user_id: userId,
      error: err.message
    });
    return null;
  }
}
function __setCachedAuthForTests(userId, ver, role) {
  authCache.set(userId, { ver, role, cachedAt: Date.now() });
}
function invalidateAuthCache(userId) {
  authCache.delete(userId);
}
function invalidateTokenVersionCache(userId) {
  invalidateAuthCache(userId);
}
function healthRateLimit(opts = {}) {
  const windowMs = opts.windowMs ?? 1e3;
  const max = opts.max ?? 30;
  const bucket = opts.bucket ?? "health";
  return (req, res, next) => {
    try {
      const ip = req.ip || req.socket && req.socket.remoteAddress || "anon";
      const key = `${bucket}:${ip}`;
      const now = Date.now();
      let entry = HEALTH_BUCKETS.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        HEALTH_BUCKETS.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > max) {
        const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1e3));
        res.setHeader("Retry-After", retryAfterSec);
        res.status(429).json({
          success: false,
          error: "Too many requests. Try again later.",
          code: "RATE_LIMITED",
          request_id: req.id
        });
        return;
      }
    } catch {
    }
    next();
  };
}
function sendSuccess(res, data, statusOrMessage = 200, message) {
  const isNumeric = typeof statusOrMessage === "number" && Number.isFinite(statusOrMessage);
  const status = isNumeric ? statusOrMessage : 200;
  const finalMessage = isNumeric ? message : statusOrMessage;
  res.status(status).json({
    success: true,
    ...data !== void 0 ? { data } : {},
    ...finalMessage ? { message: finalMessage } : {},
    request_id: res.req?.id
  });
}
function sendError(res, errorOrMessage, status = 500, code) {
  if (errorOrMessage instanceof Error) {
    const err = errorOrMessage;
    const asPg2 = err;
    if (asPg2.code && PG_TRANSLATION[asPg2.code]) {
      const t = PG_TRANSLATION[asPg2.code];
      log.warn({
        msg: "pg_error",
        pg_code: asPg2.code,
        pg_constraint: asPg2.constraint
      });
      res.status(t.status).json({
        success: false,
        error: t.msg,
        code: asPg2.code,
        request_id: res.req?.id
      });
      return;
    }
    if (err instanceof HttpError) {
      log.warn({ msg: "http_error", status: err.status, code: err.code });
      res.status(err.status).json({
        success: false,
        error: err.message,
        ...err.code ? { code: err.code } : {},
        request_id: res.req?.id
      });
      return;
    }
    log.error({
      msg: "unhandled_error",
      error_name: err.name,
      error_message: err.message
    });
    const isDev = process.env.NODE_ENV !== "production";
    res.status(status).json({
      success: false,
      error: isDev ? err.message : "Internal server error.",
      request_id: res.req?.id
    });
    return;
  }
  res.status(status).json({
    success: false,
    error: errorOrMessage,
    ...code ? { code } : {},
    request_id: res.req?.id
  });
}
function parsePagination(raw, maxLimit = 100) {
  const limitNum = Number(raw.limit);
  const offsetNum = Number(raw.offset ?? 0);
  const limit = Number.isFinite(limitNum) ? Math.min(Math.max(1, limitNum), maxLimit) : 20;
  const offset = Number.isFinite(offsetNum) ? Math.max(0, offsetNum) : 0;
  return { limit, offset };
}
function loadEnv() {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:
${issues}`);
  }
  _env = parsed.data;
  return _env;
}
function resolveDatabaseUrl(env2) {
  if (env2.DATABASE_URL) return env2.DATABASE_URL;
  if (env2.DB_HOST && env2.DB_NAME && env2.DB_USER && env2.DB_PASSWORD) {
    return `postgresql://${env2.DB_USER}:${env2.DB_PASSWORD}@${env2.DB_HOST}:${env2.DB_PORT}/${env2.DB_NAME}`;
  }
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (or set DATABASE_URL directly)."
  );
}
var requestId, securityHeaders, LOG_LEVEL, LEVELS, log, requestLogger, PG_TRANSLATION, HttpError, errorHandler, notFoundHandler, TOKEN_TTL_SECONDS, authCache, AUTH_CACHE_TTL_MS, optionalAuth, requireAuth, requireRole, HEALTH_BUCKETS, envSchema, _env;
var init_middleware = __esm({
  "server/middleware.ts"() {
    init_pg_wrapper();
    init_shared();
    init_error_codes();
    requestId = (req, res, next) => {
      const incoming = req.header("x-request-id");
      const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
      req.id = id;
      res.setHeader("x-request-id", id);
      next();
    };
    securityHeaders = (_req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader(
        "Permissions-Policy",
        [
          "accelerometer=()",
          "ambient-light-sensor=()",
          "autoplay=()",
          "battery=()",
          "camera=()",
          "display-capture=()",
          "document-domain=()",
          "encrypted-media=()",
          "execution-while-not-rendered=()",
          "execution-while-out-of-viewport=()",
          "fullscreen=()",
          "geolocation=()",
          "gyroscope=()",
          "hid=()",
          "identity-credentials-get=()",
          "idle-detection=()",
          "magnetometer=()",
          "microphone=()",
          "midi=()",
          "payment=()",
          "picture-in-picture=()",
          "publickey-credentials-create=()",
          "publickey-credentials-get=()",
          "screen-wake-lock=()",
          "serial=()",
          "speaker-selection=()",
          "storage-access=()",
          "usb=()",
          "web-share=()",
          "window-management=()",
          "xr-spatial-tracking=()"
        ].join(", ")
      );
      if (process.env.NODE_ENV === "production") {
        res.setHeader(
          "Strict-Transport-Security",
          "max-age=31536000; includeSubDomains; preload"
        );
      }
      const nonce = randomBytes2(16).toString("base64url");
      res.locals.cspNonce = nonce;
      const ALLOWED_IMG_HOSTS = (process.env.CSP_IMG_HOSTS ?? "cdn.nouf-ex.com,images.nouf-ex.com,fonts.gstatic.com").split(",").map((h) => h.trim()).filter(Boolean);
      const ALLOWED_CONNECT_HOSTS = (process.env.CSP_CONNECT_HOSTS ?? "wss://api.nouf-ex.com,https://api.nouf-ex.com").split(",").map((h) => h.trim()).filter(Boolean);
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          // Inline styles are common in React (style={{...}}) — nonced
          // style tags are allowed; everything else is blocked.
          `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
          `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
          "font-src 'self' data: https://fonts.gstatic.com",
          `img-src 'self' data: blob: ${ALLOWED_IMG_HOSTS.map((h) => `https://${h}`).join(" ")}`,
          `connect-src 'self' ${ALLOWED_CONNECT_HOSTS.join(" ")}`,
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          // Defense-in-depth: prevent click-jacking via frame/iframe.
          "object-src 'none'"
        ].join("; ")
      );
      next();
    };
    LOG_LEVEL = process.env.LOG_LEVEL || "info";
    LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
    log = {
      debug: (obj) => emit("debug", obj),
      info: (obj) => emit("info", obj),
      warn: (obj) => emit("warn", obj),
      error: (obj) => emit("error", obj)
    };
    requestLogger = (req, res, next) => {
      const start = process.hrtime.bigint();
      res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        log.info({
          msg: "request",
          request_id: req.id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: Math.round(durationMs * 100) / 100,
          // user_id is set by auth middleware (or undefined for anon).
          user_id: req.user?.id
        });
      });
      next();
    };
    PG_TRANSLATION = {
      "23505": { status: 409, msg: "A record with that unique value already exists." },
      "23503": { status: 409, msg: "Referenced record does not exist." },
      "23502": { status: 400, msg: "A required field is missing." },
      "23514": { status: 400, msg: "A field value violates a database constraint." },
      "22P02": { status: 400, msg: "Invalid input format (e.g. wrong type for an ID)." },
      "40001": { status: 409, msg: "Serialization failure \u2014 retry the transaction." },
      "40P01": { status: 503, msg: "Database is unreachable. Try again shortly." }
    };
    HttpError = class extends Error {
      status;
      code;
      details;
      constructor(status, message, opts = {}) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.code = opts.code;
        this.details = opts.details;
      }
    };
    errorHandler = (err, req, res, _next) => {
      const requestId2 = req.id;
      if (err && (err.type === "entity.too.large" || err.name === "PayloadTooLargeError")) {
        log.warn({
          msg: "payload_too_large",
          request_id: requestId2,
          limit_bytes: err.limit,
          length_bytes: err.length,
          path: req.path
        });
        return res.status(413).json({
          success: false,
          error: "Request body too large.",
          code: "PAYLOAD_TOO_LARGE",
          request_id: requestId2
        });
      }
      if (err instanceof HttpError) {
        log.warn({
          msg: "http_error",
          request_id: requestId2,
          status: err.status,
          code: err.code,
          path: req.path
        });
        return res.status(err.status).json({
          success: false,
          error: err.message,
          ...err.code ? { code: err.code } : {},
          ...err.details ? { details: err.details } : {},
          request_id: requestId2
        });
      }
      const pg = asPg(err);
      if (pg.code && PG_TRANSLATION[pg.code]) {
        const t = PG_TRANSLATION[pg.code];
        log.warn({
          msg: "pg_error",
          request_id: requestId2,
          pg_code: pg.code,
          pg_constraint: pg.constraint,
          path: req.path
        });
        return res.status(t.status).json({
          success: false,
          error: t.msg,
          code: pg.code,
          request_id: requestId2
        });
      }
      const zodErr = err;
      if (zodErr && (zodErr.name === "ZodError" || Array.isArray(zodErr.issues))) {
        log.warn({ msg: "validation_error", request_id: requestId2, path: req.path });
        return res.status(400).json({
          success: false,
          error: "Invalid input.",
          code: "VALIDATION_ERROR",
          details: zodErr.issues,
          request_id: requestId2
        });
      }
      log.error({
        msg: "unhandled_error",
        request_id: requestId2,
        path: req.path,
        method: req.method,
        error_name: err?.name,
        error_message: err?.message,
        stack: err?.stack
      });
      const isDev = process.env.NODE_ENV !== "production";
      res.status(500).json({
        success: false,
        error: isDev ? err?.message || "Internal error" : "Internal server error.",
        request_id: requestId2
      });
    };
    notFoundHandler = (req, res) => {
      res.status(404).json({
        success: false,
        error: `Not found: ${req.method} ${req.path}`,
        request_id: req.id
      });
    };
    TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
    authCache = /* @__PURE__ */ new Map();
    AUTH_CACHE_TTL_MS = 3e4;
    optionalAuth = async (req, _res, next) => {
      const header = req.header("authorization") || req.header("Authorization");
      if (header && /^Bearer\s+/i.test(header)) {
        const token = header.replace(/^Bearer\s+/i, "").trim();
        const payload = verifyAuthToken(token);
        if (payload) {
          const auth = await fetchUserAuth(payload.sub);
          if (auth !== null && auth.ver === payload.ver) {
            req.user = { id: payload.sub, role: auth.role };
          }
        }
      }
      next();
    };
    requireAuth = async (req, res, next) => {
      const header = req.header("authorization") || req.header("Authorization");
      if (!header || !/^Bearer\s+/i.test(header)) {
        return res.status(401).json({
          success: false,
          error: "Authentication required.",
          code: "AUTH_REQUIRED",
          request_id: req.id
        });
      }
      const token = header.replace(/^Bearer\s+/i, "").trim();
      const payload = verifyAuthToken(token);
      if (!payload) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired token.",
          code: "AUTH_INVALID",
          request_id: req.id
        });
      }
      const auth = await fetchUserAuth(payload.sub);
      if (auth === null) {
        return res.status(401).json({
          success: false,
          error: "User not found.",
          code: "AUTH_INVALID",
          request_id: req.id
        });
      }
      if (auth.ver !== payload.ver) {
        return res.status(401).json({
          success: false,
          error: "Token has been revoked. Please log in again.",
          code: "TOKEN_REVOKED",
          request_id: req.id
        });
      }
      req.user = { id: payload.sub, role: auth.role };
      next();
    };
    requireRole = (...allowed) => {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: "Authentication required.",
            code: "AUTH_REQUIRED",
            request_id: req.id
          });
        }
        if (!allowed.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            error: "Insufficient permissions.",
            code: "FORBIDDEN",
            request_id: req.id
          });
        }
        next();
      };
    };
    HEALTH_BUCKETS = /* @__PURE__ */ new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of HEALTH_BUCKETS) {
        if (v.resetAt <= now) HEALTH_BUCKETS.delete(k);
      }
    }, 3e4).unref();
    envSchema = zod.object({
      NODE_ENV: zod.enum(["development", "production", "test"]).default("development"),
      API_PORT: zod.coerce.number().int().positive().default(3e3),
      HOST: zod.string().default("0.0.0.0"),
      DATABASE_URL: zod.string().optional(),
      DB_HOST: zod.string().optional(),
      DB_PORT: zod.coerce.number().int().positive().default(5432),
      DB_NAME: zod.string().optional(),
      DB_USER: zod.string().optional(),
      DB_PASSWORD: zod.string().optional(),
      DB_SSL: zod.enum(["true", "false"]).default("false"),
      ALLOWED_ORIGINS: zod.string().default("http://localhost:3000,http://localhost:5173"),
      STATIC_PATH: zod.string().optional(),
      SERVE_STATIC: zod.enum(["true", "false"]).default("true"),
      AUTH_SECRET: zod.string().optional(),
      LOG_LEVEL: zod.enum(["debug", "info", "warn", "error"]).default("info"),
      TRUST_PROXY: zod.string().optional()
    });
    _env = null;
  }
});

// server/lib/notifications/email.ts
import { connect } from "net";
import { connect as tlsConnect } from "tls";
function isConfigured() {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_FROM;
}
function buildMime(opts) {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    `Date: ${(/* @__PURE__ */ new Date()).toUTCString()}`
  ].join("\r\n");
  const body = Buffer.from(opts.text, "utf8").toString("base64");
  return `${headers}\r
\r
${body}\r
`;
}
async function smtpSend(opts) {
  const sock = opts.secure ? await new Promise((resolve, reject) => {
    const s = tlsConnect({ host: opts.host, port: opts.port });
    s.once("secureConnect", () => resolve(s));
    s.once("error", reject);
  }) : await new Promise((resolve, reject) => {
    const s = connect({ host: opts.host, port: opts.port });
    s.once("connect", () => resolve(s));
    s.once("error", reject);
  });
  const read = () => new Promise((resolve, reject) => {
    const chunks = [];
    const onData = (b) => chunks.push(b);
    const timer = setTimeout(() => {
      sock.off("data", onData);
      reject(new Error("SMTP read timeout"));
    }, 1e4);
    sock.on("data", (b) => {
      onData(b);
      const s = Buffer.concat(chunks).toString("utf8");
      if (/^\d{3} /m.test(s)) {
        clearTimeout(timer);
        sock.off("data", onData);
        resolve(s);
      }
    });
  });
  const write = (line) => new Promise((resolve) => {
    sock.write(line.endsWith("\r\n") ? line : `${line}\r
`);
    resolve();
  });
  const expect = (prefix) => read().then((resp) => {
    if (!resp.startsWith(prefix)) {
      sock.destroy();
      throw new Error(`SMTP expected ${prefix}, got: ${resp.trim()}`);
    }
    return resp;
  });
  try {
    await expect("220");
    await write(`EHLO nouf-ex.local`);
    const ehlo = await expect("250");
    const supportsStartTls = /\bSTARTTLS\b/m.test(ehlo) && !opts.secure;
    if (supportsStartTls) {
      await write("STARTTLS");
      await expect("220");
    }
    if (opts.user && opts.password) {
      await write("AUTH PLAIN");
      await expect("334");
      const authString = Buffer.from(`\0${opts.user}\0${opts.password}`).toString("base64");
      await write(authString);
      await expect("235");
    }
    await write(`MAIL FROM:<${opts.from}>`);
    await expect("250");
    await write(`RCPT TO:<${opts.to}>`);
    await expect("250");
    await write("DATA");
    await expect("354");
    await write(`${opts.mail}\r
.`);
    const dataResp = await expect("250");
    await write("QUIT");
    sock.end();
    const id = dataResp.match(/250[^"]*"?<[^>]+>/)?.[0] ?? `local-${Date.now()}`;
    return id;
  } catch (err) {
    sock.destroy();
    throw err;
  }
}
var emailChannel;
var init_email = __esm({
  "server/lib/notifications/email.ts"() {
    emailChannel = {
      name: "email",
      isConfigured: isConfigured(),
      shouldDeliver(notification) {
        const transactional = /* @__PURE__ */ new Set([
          "order",
          "refund",
          "dispute",
          "review",
          "system",
          "message"
        ]);
        if (transactional.has(notification.type)) return true;
        if (notification.type === "promo") {
          return Boolean(notification.data?.opt_in_promo);
        }
        return false;
      },
      async send(ctx) {
        if (!ctx.user.email) {
          return {
            channel: "email",
            ok: false,
            providerMessageId: null,
            error: "user has no email"
          };
        }
        const host = process.env.SMTP_HOST;
        const port = Number(
          process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? 465 : 587)
        );
        const secure = process.env.SMTP_SECURE === "true";
        const from = process.env.SMTP_FROM;
        const mail = buildMime({
          from,
          to: ctx.user.email,
          subject: ctx.notification.title,
          text: ctx.notification.body ?? "(no body)"
        });
        try {
          const id = await smtpSend({
            host,
            port,
            secure,
            user: process.env.SMTP_USER || null,
            password: process.env.SMTP_PASSWORD || null,
            from,
            to: ctx.user.email,
            mail
          });
          return { channel: "email", ok: true, providerMessageId: id, error: null };
        } catch (err) {
          return {
            channel: "email",
            ok: false,
            providerMessageId: null,
            error: err instanceof Error ? err.message : String(err)
          };
        }
      }
    };
  }
});

// server/lib/notifications/sms.ts
function isConfigured2() {
  return !!process.env.SMS_WEBHOOK_URL && !!process.env.SMS_FROM;
}
function normalizePhone(phone) {
  const trimmed = phone.replace(/[^\d+]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
  const cc = (process.env.SMS_DEFAULT_COUNTRY_CODE || "967").replace(/^\+/, "");
  const local = trimmed.replace(/^0+/, "");
  return `+${cc}${local}`;
}
var smsChannel;
var init_sms = __esm({
  "server/lib/notifications/sms.ts"() {
    smsChannel = {
      name: "sms",
      isConfigured: isConfigured2(),
      // SMS is reserved for high-urgency events. Promos and reviews go
      // to email (or in-app) only.
      shouldDeliver(notification) {
        return (/* @__PURE__ */ new Set(["order", "refund", "dispute", "system"])).has(notification.type);
      },
      async send(ctx) {
        if (!ctx.user.phone) {
          return {
            channel: "sms",
            ok: false,
            providerMessageId: null,
            error: "user has no phone"
          };
        }
        const url = process.env.SMS_WEBHOOK_URL;
        const from = process.env.SMS_FROM;
        const text = `${ctx.notification.title}${ctx.notification.body ? `: ${ctx.notification.body}` : ""}`.slice(
          0,
          320
        );
        const headers = {
          "Content-Type": "application/json"
        };
        if (process.env.SMS_WEBHOOK_AUTH) headers["Authorization"] = process.env.SMS_WEBHOOK_AUTH;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              from,
              to: normalizePhone(ctx.user.phone),
              text,
              notification_id: ctx.notification.id,
              user_id: ctx.user.id
            })
          });
          if (!res.ok) {
            return {
              channel: "sms",
              ok: false,
              providerMessageId: null,
              error: `SMS gateway ${res.status}: ${(await res.text()).slice(0, 200)}`
            };
          }
          const data = await res.json().catch(() => ({}));
          return {
            channel: "sms",
            ok: true,
            providerMessageId: data.id ?? data.sid ?? null,
            error: null
          };
        } catch (err) {
          return {
            channel: "sms",
            ok: false,
            providerMessageId: null,
            error: err instanceof Error ? err.message : String(err)
          };
        }
      }
    };
  }
});

// server/lib/notifications/dispatcher.ts
async function fetchUser(userId) {
  const row = await db.prepare("SELECT id, email, phone, preferred_language FROM users WHERE id = ?").get(userId);
  return row ?? {
    id: userId,
    email: null,
    phone: null,
    preferred_language: "ar"
  };
}
async function dispatch(notification) {
  const user = await fetchUser(notification.user_id);
  const ctx = { notification, user };
  const results = [
    // In-app is implicit — the row exists in the DB. Record it for parity.
    { channel: "in_app", ok: true, providerMessageId: null, error: null }
  ];
  for (const ch of CHANNELS) {
    if (!ch.shouldDeliver(notification)) continue;
    if (!ch.isConfigured) {
      results.push({
        channel: ch.name,
        ok: false,
        providerMessageId: null,
        error: `${ch.name} channel not configured (set ${ch.name === "email" ? "SMTP_HOST" : "SMS_WEBHOOK_URL"})`
      });
      continue;
    }
    try {
      const r = await ch.send(ctx);
      results.push(r);
    } catch (err) {
      results.push({
        channel: ch.name,
        ok: false,
        providerMessageId: null,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return results;
}
var CHANNELS;
var init_dispatcher = __esm({
  "server/lib/notifications/dispatcher.ts"() {
    init_shared();
    init_email();
    init_sms();
    CHANNELS = [emailChannel, smsChannel];
  }
});

// server/lib/notifications/email-templates.ts
function render(input) {
  const lang = input.language ?? "en";
  const en = renderEN(input.event, input.data);
  const ar = renderAR(input.event, input.data);
  if (lang === "ar") return ar;
  if (lang === "zh") return { subject: en.subject, body: en.body };
  return en;
}
function renderEN(event, data) {
  switch (event) {
    case "order_placed":
      return {
        subject: `Order #${data.orderNumber} received`,
        body: [
          `Hi,`,
          ``,
          `Thanks for your order #${data.orderNumber} on Nouf-ex.`,
          ``,
          `  Total:        ${data.total} YER`,
          `  Items:        ${data.itemCount}`,
          `  Payment:      ${data.paymentMethod}`,
          ``,
          `We'll notify you when your order is confirmed and shipped.`,
          ``,
          `Track your order: ${data.trackingUrl}`,
          ``,
          `Thank you for shopping with us.`,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "order_confirmed":
      return {
        subject: `Order #${data.orderNumber} confirmed`,
        body: [
          `Hi,`,
          ``,
          `Good news! Your order #${data.orderNumber} has been confirmed by the seller.`,
          ``,
          `It's being prepared for shipment.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "order_shipped":
      return {
        subject: `Order #${data.orderNumber} shipped`,
        body: [
          `Hi,`,
          ``,
          `Your order #${data.orderNumber} is on its way!`,
          ``,
          `Tracking: ${data.trackingNumber ?? "pending"}`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "payment_confirmed":
      return {
        subject: `Payment for order #${data.orderNumber} confirmed`,
        body: [
          `Hi,`,
          ``,
          `We received your payment of ${data.amount} YER for order #${data.orderNumber}.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "refund_requested":
      return {
        subject: `Refund request received for order #${data.orderNumber}`,
        body: [
          `Hi,`,
          ``,
          `We received your refund request for order #${data.orderNumber}.`,
          `Amount: ${data.amount} YER`,
          ``,
          `Our team will review and respond within 2 business days.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "refund_approved":
      return {
        subject: `Refund approved for order #${data.orderNumber}`,
        body: [
          `Hi,`,
          ``,
          `Great news! Your refund of ${data.amount} YER for order #${data.orderNumber} has been approved.`,
          ``,
          `The amount will be credited back to your original payment method within 5-10 business days.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "refund_rejected":
      return {
        subject: `Refund request declined for order #${data.orderNumber}`,
        body: [
          `Hi,`,
          ``,
          `Unfortunately, your refund request for order #${data.orderNumber} was declined.`,
          ``,
          `Reason: ${data.reason ?? "not specified"}`,
          ``,
          `If you have questions, please contact our support.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "dispute_opened":
      return {
        subject: `Dispute opened on order #${data.orderNumber}`,
        body: [
          `Hi,`,
          ``,
          `A dispute has been opened on order #${data.orderNumber}.`,
          `Subject: ${data.subject ?? "not specified"}`,
          ``,
          `Our team will review and respond within 24 hours.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "dispute_resolved":
      return {
        subject: `Dispute resolved on order #${data.orderNumber}`,
        body: [
          `Hi,`,
          ``,
          `The dispute on order #${data.orderNumber} has been resolved.`,
          `Resolution: ${data.resolution ?? "see order details"}`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "review_posted":
      return {
        subject: `New review on ${data.productName ?? "your product"}`,
        body: [
          `Hi,`,
          ``,
          `A new ${data.rating}-star review was posted on your product "${data.productName ?? "N/A"}".`,
          ``,
          `Comment: ${data.comment ?? "(no comment)"}`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "message_received":
      return {
        subject: `New message from ${data.senderName ?? "a user"}`,
        body: [
          `Hi,`,
          ``,
          `You have a new message from ${data.senderName ?? "a user"}.`,
          ``,
          `Preview: ${data.preview ?? "(no preview)"}`,
          ``,
          `Reply: ${data.inboxUrl ?? "https://noufex.example.com/messages"}`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "welcome":
      return {
        subject: `Welcome to Nouf-ex, ${data.name ?? ""}!`,
        body: [
          `Hi ${data.name ?? "there"},`,
          ``,
          `Welcome to Nouf-ex \u2014 the trusted B2B/B2C marketplace for Yemen and the Middle East.`,
          ``,
          `Get started: browse products, follow your favorite stores, and enjoy secure payments.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
    case "password_reset":
      return {
        subject: `Reset your Nouf-ex password`,
        body: [
          `Hi,`,
          ``,
          `We received a request to reset your Nouf-ex password.`,
          ``,
          `Reset link (valid 1 hour): ${data.resetUrl ?? "https://noufex.example.com/reset"}`,
          ``,
          `If you didn't request this, you can safely ignore this email.`,
          ``,
          `\u2014 The Nouf-ex team`
        ].join("\n")
      };
  }
}
function renderAR(event, data) {
  switch (event) {
    case "order_placed":
      return {
        subject: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u0634\u0643\u0631\u0627\u064B \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber} \u0641\u064A \u0646\u0648\u0641-\u0625\u0643\u0633.`,
          ``,
          `  \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A:        ${data.total} \u0631\u064A\u0627\u0644`,
          `  \u0639\u062F\u062F \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A:   ${data.itemCount}`,
          `  \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639:    ${data.paymentMethod}`,
          ``,
          `\u0633\u0646\u064F\u0639\u0644\u0645\u0643 \u0641\u0648\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0637\u0644\u0628 \u0648\u0634\u062D\u0646\u0647.`,
          ``,
          `\u062A\u062A\u0628\u0639 \u0637\u0644\u0628\u0643: ${data.trackingUrl}`,
          ``,
          `\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0633\u0648\u0642\u0643 \u0645\u0639\u0646\u0627.`,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "order_confirmed":
      return {
        subject: `\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u0623\u062E\u0628\u0627\u0631 \u0633\u0627\u0631\u0629! \u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber} \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0628\u0627\u0626\u0639.`,
          ``,
          `\u064A\u062A\u0645 \u0627\u0644\u0622\u0646 \u062A\u062C\u0647\u064A\u0632\u0647 \u0644\u0644\u0634\u062D\u0646.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "order_shipped":
      return {
        subject: `\u062A\u0645 \u0634\u062D\u0646 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber} \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642 \u0625\u0644\u064A\u0643!`,
          ``,
          `\u0631\u0642\u0645 \u0627\u0644\u062A\u062A\u0628\u0639: ${data.trackingNumber ?? "\u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632"}`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "payment_confirmed":
      return {
        subject: `\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062F\u0641\u0639 \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u062F\u0641\u0639\u062A\u0643 \u0628\u0645\u0628\u0644\u063A ${data.amount} \u0631\u064A\u0627\u0644 \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "refund_requested":
      return {
        subject: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}.`,
          `\u0627\u0644\u0645\u0628\u0644\u063A: ${data.amount} \u0631\u064A\u0627\u0644`,
          ``,
          `\u0633\u064A\u0631\u0627\u062C\u0639 \u0641\u0631\u064A\u0642\u0646\u0627 \u0627\u0644\u0637\u0644\u0628 \u0648\u064A\u0631\u062F \u062E\u0644\u0627\u0644 \u064A\u0648\u0645\u064A \u0639\u0645\u0644.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "refund_approved":
      return {
        subject: `\u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u0623\u062E\u0628\u0627\u0631 \u0633\u0627\u0631\u0629! \u062A\u0645\u062A \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0633\u062A\u0631\u062F\u0627\u062F\u0643 \u0628\u0645\u0628\u0644\u063A ${data.amount} \u0631\u064A\u0627\u0644 \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}.`,
          ``,
          `\u0633\u064A\u062A\u0645 \u0631\u062F \u0627\u0644\u0645\u0628\u0644\u063A \u0625\u0644\u0649 \u0648\u0633\u064A\u0644\u0629 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u062E\u0644\u0627\u0644 5-10 \u0623\u064A\u0627\u0645 \u0639\u0645\u0644.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "refund_rejected":
      return {
        subject: `\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u0644\u0644\u0623\u0633\u0641\u060C \u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0644\u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}.`,
          ``,
          `\u0627\u0644\u0633\u0628\u0628: ${data.reason ?? "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}`,
          ``,
          `\u0644\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "dispute_opened":
      return {
        subject: `\u062A\u0645 \u0641\u062A\u062D \u0646\u0632\u0627\u0639 \u0639\u0644\u0649 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u062A\u0645 \u0641\u062A\u062D \u0646\u0632\u0627\u0639 \u0639\u0644\u0649 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}.`,
          `\u0627\u0644\u0645\u0648\u0636\u0648\u0639: ${data.subject ?? "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}`,
          ``,
          `\u0633\u064A\u0631\u0627\u062C\u0639 \u0641\u0631\u064A\u0642\u0646\u0627 \u0627\u0644\u0646\u0632\u0627\u0639 \u0648\u064A\u0631\u062F \u062E\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "dispute_resolved":
      return {
        subject: `\u062A\u0645 \u062D\u0644 \u0627\u0644\u0646\u0632\u0627\u0639 \u0639\u0644\u0649 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u062A\u0645 \u062D\u0644 \u0627\u0644\u0646\u0632\u0627\u0639 \u0639\u0644\u0649 \u0637\u0644\u0628\u0643 \u0631\u0642\u0645 #${data.orderNumber}.`,
          `\u0627\u0644\u062D\u0644: ${data.resolution ?? "\u0631\u0627\u062C\u0639 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628"}`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "review_posted":
      return {
        subject: `\u062A\u0642\u064A\u064A\u0645 \u062C\u062F\u064A\u062F \u0639\u0644\u0649 ${data.productName ?? "\u0645\u0646\u062A\u062C\u0643"}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u062A\u0645 \u0646\u0634\u0631 \u062A\u0642\u064A\u064A\u0645 \u062C\u062F\u064A\u062F ${data.rating} \u0646\u062C\u0648\u0645 \u0639\u0644\u0649 \u0645\u0646\u062A\u062C\u0643 "${data.productName ?? "\u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631"}".`,
          ``,
          `\u0627\u0644\u062A\u0639\u0644\u064A\u0642: ${data.comment ?? "(\u0628\u062F\u0648\u0646 \u062A\u0639\u0644\u064A\u0642)"}`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "message_received":
      return {
        subject: `\u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 ${data.senderName ?? "\u0645\u0633\u062A\u062E\u062F\u0645"}`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u0644\u062F\u064A\u0643 \u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 ${data.senderName ?? "\u0645\u0633\u062A\u062E\u062F\u0645"}.`,
          ``,
          `\u0645\u0639\u0627\u064A\u0646\u0629: ${data.preview ?? "(\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0639\u0627\u064A\u0646\u0629)"}`,
          ``,
          `\u0627\u0644\u0631\u062F: ${data.inboxUrl ?? "https://noufex.example.com/messages"}`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "welcome":
      return {
        subject: `\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643 \u0641\u064A \u0646\u0648\u0641-\u0625\u0643\u0633\u060C ${data.name ?? ""}!`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B ${data.name ?? ""}\u060C`,
          ``,
          `\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643 \u0641\u064A \u0646\u0648\u0641-\u0625\u0643\u0633 \u2014 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0648\u062B\u0648\u0642 B2B/B2C \u0644\u0644\u064A\u0645\u0646 \u0648\u0627\u0644\u0634\u0631\u0642 \u0627\u0644\u0623\u0648\u0633\u0637.`,
          ``,
          `\u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646: \u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A\u060C \u062A\u0627\u0628\u0639 \u0645\u062A\u0627\u062C\u0631\u0643 \u0627\u0644\u0645\u0641\u0636\u0644\u0629\u060C \u0648\u0627\u0633\u062A\u0645\u062A\u0639 \u0628\u0645\u062F\u0641\u0648\u0639\u0627\u062A \u0622\u0645\u0646\u0629.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
    case "password_reset":
      return {
        subject: `\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0641\u064A \u0646\u0648\u0641-\u0625\u0643\u0633`,
        body: [
          `\u0645\u0631\u062D\u0628\u0627\u064B\u060C`,
          ``,
          `\u062A\u0644\u0642\u0651\u064A\u0646\u0627 \u0637\u0644\u0628\u0627\u064B \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631\u0643 \u0641\u064A \u0646\u0648\u0641-\u0625\u0643\u0633.`,
          ``,
          `\u0631\u0627\u0628\u0637 \u0627\u0644\u0625\u0639\u0627\u062F\u0629 (\u0635\u0627\u0644\u062D \u0633\u0627\u0639\u0629): ${data.resetUrl ?? "https://noufex.example.com/reset"}`,
          ``,
          `\u0625\u0630\u0627 \u0644\u0645 \u062A\u0637\u0644\u0628 \u0630\u0644\u0643\u060C \u064A\u0645\u0643\u0646\u0643 \u062A\u062C\u0627\u0647\u0644 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0628\u0623\u0645\u0627\u0646.`,
          ``,
          `\u2014 \u0641\u0631\u064A\u0642 \u0646\u0648\u0641-\u0625\u0643\u0633`
        ].join("\n")
      };
  }
}
var init_email_templates = __esm({
  "server/lib/notifications/email-templates.ts"() {
  }
});

// server/lib/notifications/events.ts
var events_exports = {};
__export(events_exports, {
  fetchLanguage: () => fetchLanguage,
  fetchLanguages: () => fetchLanguages,
  onDisputeOpened: () => onDisputeOpened,
  onDisputeResolved: () => onDisputeResolved,
  onOrderPlaced: () => onOrderPlaced,
  onPaymentConfirmed: () => onPaymentConfirmed,
  onRefundRequested: () => onRefundRequested,
  onRefundResolved: () => onRefundResolved,
  onReviewPosted: () => onReviewPosted,
  onWelcome: () => onWelcome
});
async function fetchLanguages(userIds) {
  if (userIds.length === 0) return /* @__PURE__ */ new Map();
  const unique = [...new Set(userIds)];
  const placeholders = unique.map((_, i) => `$${i + 1}`).join(",");
  const rows = await db.prepare(`SELECT id, preferred_language FROM users WHERE id IN (${placeholders})`).all(...unique);
  return new Map(rows.map((r) => [r.id, r.preferred_language || "ar"]));
}
async function fetchLanguage(userId) {
  const row = await db.prepare("SELECT preferred_language FROM users WHERE id = $1").get(userId);
  return row?.preferred_language || "ar";
}
async function dispatchOne(userId, type, title, body, data) {
  try {
    const result = await db.prepare(
      `INSERT INTO notifications (user_id, type, title, body, data, is_read, created_at)
         VALUES (?, ?, ?, ?, ?::jsonb, FALSE, NOW())
         RETURNING id`
    ).get(userId, type, title, body, data ? JSON.stringify(data) : null);
    if (!result) return null;
    const row = await db.prepare(
      "SELECT id, user_id, type, title, body, data, is_read, read_at, created_at FROM notifications WHERE id = $1"
    ).get(result.id);
    if (!row) return null;
    await dispatch(row);
    return result.id;
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        t: (/* @__PURE__ */ new Date()).toISOString(),
        level: "error",
        msg: "event_notification_failed",
        user_id: userId,
        type,
        error: err instanceof Error ? err.message : String(err)
      }) + "\n"
    );
    return null;
  }
}
async function onOrderPlaced(input) {
  const langs = await fetchLanguages([input.customerId, input.merchantId]);
  const data = {
    orderNumber: input.orderNumber,
    total: String(input.total),
    itemCount: String(input.itemCount),
    paymentMethod: input.paymentMethod,
    trackingUrl: input.trackingUrl
  };
  {
    const lang = langs.get(input.customerId) ?? "ar";
    const tpl = render({ event: "order_placed", language: lang, data });
    await dispatchOne(input.customerId, "order", tpl.subject, tpl.body, {
      orderId: input.orderId,
      eventType: "order_placed"
    });
  }
  {
    const lang = langs.get(input.merchantId) ?? "ar";
    const tpl = render({ event: "order_placed", language: lang, data });
    const merchantSubject = lang === "ar" ? `\u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0631\u0642\u0645 #${input.orderNumber}` : `New order #${input.orderNumber}`;
    await dispatchOne(input.merchantId, "order", merchantSubject, tpl.body, {
      orderId: input.orderId,
      eventType: "order_placed",
      role: "merchant"
    });
  }
}
async function onPaymentConfirmed(input) {
  const lang = await fetchLanguage(input.customerId);
  const tpl = render({
    event: "payment_confirmed",
    language: lang,
    data: {
      orderNumber: input.orderNumber,
      amount: String(input.amount)
    }
  });
  await dispatchOne(input.customerId, "order", tpl.subject, tpl.body, {
    orderId: input.orderId,
    eventType: "payment_confirmed"
  });
}
async function onRefundRequested(input) {
  const langs = await fetchLanguages([input.customerId, input.merchantId]);
  const data = {
    orderNumber: input.orderNumber,
    amount: String(input.amount)
  };
  {
    const lang = langs.get(input.customerId) ?? "ar";
    const tpl = render({ event: "refund_requested", language: lang, data });
    await dispatchOne(input.customerId, "refund", tpl.subject, tpl.body, {
      orderId: input.orderId,
      eventType: "refund_requested"
    });
  }
  {
    const lang = langs.get(input.merchantId) ?? "ar";
    const tpl = render({ event: "refund_requested", language: lang, data });
    const merchantSubject = lang === "ar" ? `\u0637\u0644\u0628 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u062C\u062F\u064A\u062F \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628 \u0631\u0642\u0645 #${input.orderNumber}` : `New refund request for order #${input.orderNumber}`;
    await dispatchOne(input.merchantId, "refund", merchantSubject, tpl.body, {
      orderId: input.orderId,
      eventType: "refund_requested",
      role: "merchant"
    });
  }
}
async function onRefundResolved(input) {
  const lang = await fetchLanguage(input.customerId);
  const event = input.status === "approved" ? "refund_approved" : "refund_rejected";
  const tpl = render({
    event,
    language: lang,
    data: {
      orderNumber: input.orderNumber,
      amount: String(input.amount),
      reason: input.reason ?? ""
    }
  });
  await dispatchOne(input.customerId, "refund", tpl.subject, tpl.body, {
    orderId: input.orderId,
    eventType: event
  });
}
async function onDisputeOpened(input) {
  const lang = await fetchLanguage(input.merchantId);
  const tpl = render({
    event: "dispute_opened",
    language: lang,
    data: {
      orderNumber: input.orderNumber,
      subject: input.subject ?? ""
    }
  });
  await dispatchOne(input.merchantId, "dispute", tpl.subject, tpl.body, {
    orderId: input.orderId,
    eventType: "dispute_opened"
  });
}
async function onDisputeResolved(input) {
  const lang = await fetchLanguage(input.customerId);
  const tpl = render({
    event: "dispute_resolved",
    language: lang,
    data: {
      orderNumber: input.orderNumber,
      resolution: input.resolution ?? ""
    }
  });
  await dispatchOne(input.customerId, "dispute", tpl.subject, tpl.body, {
    orderId: input.orderId,
    eventType: "dispute_resolved"
  });
}
async function onReviewPosted(input) {
  const lang = await fetchLanguage(input.merchantId);
  const tpl = render({
    event: "review_posted",
    language: lang,
    data: {
      productName: input.productName,
      rating: String(input.rating),
      comment: input.comment ?? ""
    }
  });
  await dispatchOne(input.merchantId, "review", tpl.subject, tpl.body, {
    productId: input.productId,
    eventType: "review_posted"
  });
}
async function onWelcome(input) {
  const lang = await fetchLanguage(input.userId);
  const tpl = render({
    event: "welcome",
    language: lang,
    data: { name: input.name }
  });
  await dispatchOne(input.userId, "system", tpl.subject, tpl.body, {
    eventType: "welcome"
  });
}
var init_events = __esm({
  "server/lib/notifications/events.ts"() {
    init_shared();
    init_dispatcher();
    init_email_templates();
  }
});

// server/index.ts
init_pg_wrapper();
init_middleware();
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import "dotenv/config";

// server/routes/addresses.ts
init_shared();
init_middleware();
import { Router } from "express";
var addressesRouter = Router();
addressesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await db.prepare("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC").all(userId);
    sendSuccess(res, rows);
  } catch (err) {
    return sendError(res, err);
  }
});
addressesRouter.post("/", requireAuth, async (req, res) => {
  try {
    const v = validate(addressSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const data = v.data;
    const userId = req.user.id;
    if (data.is_default) {
      await db.prepare("UPDATE addresses SET is_default = FALSE WHERE user_id = ?").run(userId);
    }
    const result = await db.prepare(
      `INSERT INTO addresses (user_id, label, full_name, phone, governorate, city, district,
           street, building, notes, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, FALSE), NOW(), NOW())
         RETURNING *`
    ).get(
      userId,
      data.label,
      data.full_name,
      data.phone,
      data.governorate,
      data.city,
      data.district ?? null,
      data.street,
      data.building ?? null,
      data.notes ?? null,
      data.is_default ?? false
    );
    sendSuccess(res, result, "Address created");
  } catch (err) {
    return sendError(res, err);
  }
});
addressesRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendError(res, "Invalid id", 400);
    const userId = req.user.id;
    const result = await db.prepare("DELETE FROM addresses WHERE id = ? AND user_id = ? RETURNING id").get(id, userId);
    if (!result) return sendError(res, "Address not found", 404);
    sendSuccess(res, { id: result.id }, "Address deleted");
  } catch (err) {
    return sendError(res, err);
  }
});
addressesRouter.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendError(res, "Invalid id", 400);
    const v = validate(addressSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
    const data = v.data;
    const userId = req.user.id;
    const owned = await db.prepare("SELECT id FROM addresses WHERE id = ? AND user_id = ?").get(id, userId);
    if (!owned) return sendError(res, "Address not found", 404);
    if (data.is_default) {
      await db.prepare("UPDATE addresses SET is_default = FALSE WHERE user_id = ? AND id <> ?").run(userId, id);
    }
    const updated = await db.prepare(
      `UPDATE addresses
            SET label = ?, full_name = ?, phone = ?, governorate = ?, city = ?,
                district = ?, street = ?, building = ?, notes = ?,
                is_default = COALESCE(?, is_default), updated_at = NOW()
          WHERE id = ? AND user_id = ?
          RETURNING *`
    ).get(
      data.label,
      data.full_name,
      data.phone,
      data.governorate,
      data.city,
      data.district ?? null,
      data.street,
      data.building ?? null,
      data.notes ?? null,
      data.is_default ?? null,
      id,
      userId
    );
    if (!updated) return sendError(res, "Address not found", 404);
    sendSuccess(res, updated, "Address updated");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/admin-read.ts
init_shared();
import { Router as Router2 } from "express";
import { z as z2 } from "zod";
var adminReadRouter = Router2();
var adminAuth = [requireAuth, requireRole("admin")];
adminReadRouter.get("/users", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        role: z2.enum(["customer", "merchant", "admin"]).optional(),
        is_active: z2.enum(["active", "suspended", "banned"]).optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.role) {
      params.push(v.data.role);
      where.push(`role = $${params.length}`);
    }
    if (v.data.is_active) {
      params.push(v.data.is_active);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM users ${whereSql}`).get(...params);
    const total = countRow?.c ?? 0;
    params.push(v.data.limit, v.data.offset);
    const users = await db.prepare(
      `SELECT id, email, full_name, phone, role, status, is_verified,
				        email_verified, phone_verified, two_factor_enabled,
				        preferred_language, gender, last_login, created_at, updated_at
				 FROM users ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { users, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/stores", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        is_active: z2.enum(["true", "false"]).or(z2.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0),
        is_verified: z2.enum(["true", "false"]).or(z2.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0)
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.is_active !== void 0) {
      params.push(v.data.is_active);
      where.push(`is_active = $${params.length}`);
    }
    if (v.data.is_verified !== void 0) {
      params.push(v.data.is_verified);
      where.push(`is_verified = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM stores ${whereSql}`).get(...params);
    const total = countRow?.c ?? 0;
    params.push(v.data.limit, v.data.offset);
    const stores = await db.prepare(
      `SELECT * FROM stores ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { stores, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/products", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        is_active: z2.enum(["true", "false"]).or(z2.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0),
        is_featured: z2.enum(["true", "false"]).or(z2.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0),
        store_id: z2.coerce.number().int().positive().optional(),
        category_id: z2.coerce.number().int().positive().optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.is_active !== void 0) {
      params.push(v.data.is_active);
      where.push(`is_active = $${params.length}`);
    }
    if (v.data.is_featured !== void 0) {
      params.push(v.data.is_featured);
      where.push(`is_featured = $${params.length}`);
    }
    if (v.data.store_id !== void 0) {
      params.push(v.data.store_id);
      where.push(`store_id = $${params.length}`);
    }
    if (v.data.category_id !== void 0) {
      params.push(v.data.category_id);
      where.push(`category_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM products ${whereSql}`).get(...params);
    const total = countRow?.c ?? 0;
    params.push(v.data.limit, v.data.offset);
    const products = await db.prepare(
      `SELECT * FROM products ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, {
      products: products.map(getProductWithParsedFields),
      total,
      limit: v.data.limit,
      offset: v.data.offset
    });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/orders", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        status: z2.enum([
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
          "refunded"
        ]).optional(),
        payment_status: z2.enum(["pending", "paid", "failed", "refunded"]).optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.status) {
      params.push(v.data.status);
      where.push(`status = $${params.length}`);
    }
    if (v.data.payment_status) {
      params.push(v.data.payment_status);
      where.push(`payment_status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM orders ${whereSql}`).get(...params);
    const total = countRow?.c ?? 0;
    params.push(v.data.limit, v.data.offset);
    const orders = await db.prepare(
      `SELECT * FROM orders ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { orders, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/disputes", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        status: z2.enum(["open", "in_review", "resolved", "rejected"]).optional(),
        priority: z2.enum(["low", "normal", "high", "urgent"]).optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.status) {
      params.push(v.data.status);
      where.push(`status = $${params.length}`);
    }
    if (v.data.priority) {
      params.push(v.data.priority);
      where.push(`priority = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM disputes ${whereSql}`).get(...params);
    const total = countRow?.c ?? 0;
    params.push(v.data.limit, v.data.offset);
    const disputes = await db.prepare(
      `SELECT * FROM disputes ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { disputes, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/audit-log", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        entity_type: z2.string().trim().min(1).max(50).optional(),
        action: z2.string().trim().min(1).max(50).optional(),
        user_id: z2.coerce.number().int().positive().optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.entity_type) {
      params.push(v.data.entity_type);
      where.push(`entity_type = $${params.length}`);
    }
    if (v.data.action) {
      params.push(v.data.action);
      where.push(`action = $${params.length}`);
    }
    if (v.data.user_id !== void 0) {
      params.push(v.data.user_id);
      where.push(`user_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM admin_audit_log ${whereSql}`).get(...params);
    const total = countRow?.c ?? 0;
    params.push(v.data.limit, v.data.offset);
    const log2 = await db.prepare(
      `SELECT id, user_id, action, entity_type, entity_id, old_values,
				        new_values, ip_address, user_agent, created_at
				 FROM admin_audit_log ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { log: log2, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/stats", ...adminAuth, async (_req, res) => {
  try {
    const statsSql = `SELECT
			(SELECT COUNT(*)::int FROM users)                                  AS users,
			(SELECT COUNT(*)::int FROM stores)                                 AS stores,
			(SELECT COUNT(*)::int FROM products)                               AS products,
			(SELECT COUNT(*)::int FROM orders)                                 AS orders,
			(SELECT COUNT(*)::int FROM reviews)                                AS reviews,
			(SELECT COUNT(*)::int FROM disputes)                               AS disputes,
			(SELECT COUNT(*)::int FROM disputes WHERE status = 'open')         AS open_disputes,
			(SELECT COUNT(*)::int FROM orders  WHERE status = 'pending')       AS pending_orders,
			(SELECT COUNT(*)::int FROM orders  WHERE payment_status = 'paid')  AS paid_orders,
			(SELECT COUNT(*)::int FROM users   WHERE status <> 'active')       AS suspended_users,
			(SELECT COUNT(*)::int FROM stores  WHERE is_active = FALSE)        AS inactive_stores,
			(SELECT COUNT(*)::int FROM orders  WHERE created_at > NOW() - INTERVAL '7 days') AS recent_orders,
			(SELECT COUNT(*)::int FROM users   WHERE created_at > NOW() - INTERVAL '7 days') AS recent_users,
			COALESCE(
				(SELECT SUM(total)::numeric FROM orders WHERE payment_status = 'paid'),
				0
			)                                                                 AS revenue_yer`;
    const row = await db.prepare(statsSql).get();
    const r = row ?? {
      users: 0,
      stores: 0,
      products: 0,
      orders: 0,
      reviews: 0,
      disputes: 0,
      open_disputes: 0,
      pending_orders: 0,
      paid_orders: 0,
      suspended_users: 0,
      inactive_stores: 0,
      recent_orders: 0,
      recent_users: 0,
      revenue_yer: 0
    };
    return sendSuccess(res, {
      counts: {
        users: r.users,
        stores: r.stores,
        products: r.products,
        orders: r.orders,
        reviews: r.reviews,
        disputes: r.disputes
      },
      flags: {
        openDisputes: r.open_disputes,
        pendingOrders: r.pending_orders,
        paidOrders: r.paid_orders,
        suspendedUsers: r.suspended_users,
        inactiveStores: r.inactive_stores
      },
      recent7d: {
        orders: r.recent_orders,
        users: r.recent_users
      },
      revenueYer: Number(r.revenue_yer)
    });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/stats/timeseries", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      z2.object({
        metric: z2.enum(["revenue", "orders", "users", "disputes", "merchants"]).default("revenue"),
        bucket: z2.enum(["day", "week", "month"]).default("day"),
        days: z2.coerce.number().int().min(1).max(365).optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const { metric, bucket } = v.data;
    const horizonDays = v.data.days ?? (bucket === "day" ? 30 : bucket === "week" ? 84 : 365);
    const truncUnit = bucket === "day" ? "day" : bucket === "week" ? "week" : "month";
    const metricConfig = {
      revenue: { table: "orders", where: "payment_status = 'paid'" },
      orders: { table: "orders", where: "1=1" },
      users: { table: "users", where: "1=1" },
      disputes: { table: "disputes", where: "1=1" },
      merchants: { table: "users", where: "role = 'merchant'" }
    };
    const cfg = metricConfig[metric];
    const valueExpr = metric === "revenue" ? "COALESCE(SUM(total), 0)::numeric" : "COUNT(*)::int";
    const labelFormat = bucket === "day" ? "MM-DD" : bucket === "week" ? '"W"IW' : "YYYY-MM";
    const sql = `
			WITH series AS (
				SELECT generate_series(
					date_trunc($1, NOW() - ($2 || ' days')::interval),
					date_trunc($1, NOW()),
					('1 ' || $1)::interval
				) AS bucket_ts
			),
			data AS (
				SELECT date_trunc($1, created_at) AS bucket_ts,
				       ${valueExpr} AS v
				FROM ${cfg.table}
				WHERE ${cfg.where}
				  AND created_at >= NOW() - ($2 || ' days')::interval
				GROUP BY date_trunc($1, created_at)
			)
			SELECT to_char(s.bucket_ts, 'YYYY-MM-DD') AS ts,
			       to_char(s.bucket_ts, $3)            AS label,
			       COALESCE(d.v, 0)                     AS value
			FROM series s
			LEFT JOIN data d USING (bucket_ts)
			ORDER BY s.bucket_ts ASC
		`;
    const rows = await db.prepare(sql).all(truncUnit, String(horizonDays), labelFormat);
    return sendSuccess(res, {
      metric,
      bucket,
      horizonDays,
      points: rows.map((r) => ({
        ts: r.ts,
        label: r.label,
        value: Number(r.value)
      }))
    });
  } catch (err) {
    return sendError(res, err);
  }
});
adminReadRouter.get("/stats/by-governorate", ...adminAuth, async (req, res) => {
  try {
    const v = validate(
      z2.object({
        scope: z2.enum(["stores", "addresses", "merchants"]).default("stores"),
        top: z2.coerce.number().int().min(1).max(20).default(5)
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const { scope, top } = v.data;
    const sourceSql = {
      stores: {
        sql: `SELECT COALESCE(NULLIF(governorate, ''), 'Unknown') AS name,
				             COUNT(*)::int AS count
				      FROM stores
				      WHERE is_active = TRUE
				      GROUP BY COALESCE(NULLIF(governorate, ''), 'Unknown')`,
        where: ""
      },
      addresses: {
        sql: `SELECT COALESCE(NULLIF(governorate, ''), 'Unknown') AS name,
				             COUNT(*)::int AS count
				      FROM addresses
				      GROUP BY COALESCE(NULLIF(governorate, ''), 'Unknown')`,
        where: ""
      },
      merchants: {
        // Per-merchant governorate: prefer the merchant's own store
        // (most users in the test seed only have one store each),
        // fall back to "Unknown" if they have no store.
        sql: `SELECT COALESCE(s.governorate, 'Unknown') AS name,
				             COUNT(*)::int AS count
				      FROM users u
				      LEFT JOIN LATERAL (
				          SELECT governorate
				          FROM stores
				          WHERE owner_id = u.id
				          ORDER BY created_at ASC
				          LIMIT 1
				      ) s ON TRUE
				      WHERE u.role = 'merchant'
				      GROUP BY COALESCE(s.governorate, 'Unknown')`,
        where: ""
      }
    };
    const src = sourceSql[scope];
    const sql = `
			WITH counts AS (${src.sql}),
			ranked AS (
				SELECT name, count,
				       ROW_NUMBER() OVER (ORDER BY count DESC, name ASC) AS rn
				FROM counts
			),
			top_n AS (
				SELECT name, count FROM ranked WHERE rn <= $1
			),
			other AS (
				SELECT COALESCE(SUM(count), 0)::int AS count
				FROM ranked WHERE rn > $1
			)
			SELECT name, count, FALSE AS is_other FROM top_n
			UNION ALL
			SELECT 'Other', count, TRUE AS is_other FROM other
		`;
    const rows = await db.prepare(sql).all(top);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const governorates = rows.filter((r) => r.count > 0).map((r) => ({
      name: r.name,
      count: r.count,
      percent: total > 0 ? Math.round(r.count / total * 1e3) / 10 : 0
    }));
    return sendSuccess(res, {
      scope,
      top,
      total,
      governorates
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/admin.ts
init_shared();
import { Router as Router3 } from "express";
import { z as z3 } from "zod";
var adminRouter = Router3();
var adminAuth2 = [requireAuth, requireRole("admin")];
adminRouter.get("/users", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        role: z3.enum(["customer", "merchant", "admin"]).optional(),
        is_active: z3.enum(["active", "suspended", "banned"]).optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.role) {
      params.push(v.data.role);
      where.push(`role = $${params.length}`);
    }
    if (v.data.is_active) {
      params.push(v.data.is_active);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM users ${whereSql}`).get(...params);
    const total = countRow.c;
    params.push(v.data.limit, v.data.offset);
    const users = await db.prepare(
      `SELECT id, email, full_name, phone, role, status, is_verified,
				        email_verified, phone_verified, two_factor_enabled,
				        preferred_language, gender, last_login, created_at, updated_at
				 FROM users ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { users, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.get("/stores", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        is_active: z3.enum(["true", "false"]).or(z3.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0),
        is_verified: z3.enum(["true", "false"]).or(z3.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0)
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.is_active !== void 0) {
      params.push(v.data.is_active);
      where.push(`is_active = $${params.length}`);
    }
    if (v.data.is_verified !== void 0) {
      params.push(v.data.is_verified);
      where.push(`is_verified = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM stores ${whereSql}`).get(...params);
    const total = countRow.c;
    params.push(v.data.limit, v.data.offset);
    const stores = await db.prepare(
      `SELECT * FROM stores ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { stores, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.get("/products", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        is_active: z3.enum(["true", "false"]).or(z3.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0),
        is_featured: z3.enum(["true", "false"]).or(z3.literal("")).optional().transform((s) => s === "true" ? true : s === "false" ? false : void 0),
        store_id: z3.coerce.number().int().positive().optional(),
        category_id: z3.coerce.number().int().positive().optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.is_active !== void 0) {
      params.push(v.data.is_active);
      where.push(`is_active = $${params.length}`);
    }
    if (v.data.is_featured !== void 0) {
      params.push(v.data.is_featured);
      where.push(`is_featured = $${params.length}`);
    }
    if (v.data.store_id !== void 0) {
      params.push(v.data.store_id);
      where.push(`store_id = $${params.length}`);
    }
    if (v.data.category_id !== void 0) {
      params.push(v.data.category_id);
      where.push(`category_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM products ${whereSql}`).get(...params);
    const total = countRow.c;
    params.push(v.data.limit, v.data.offset);
    const products = await db.prepare(
      `SELECT * FROM products ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, {
      products: products.map(getProductWithParsedFields),
      total,
      limit: v.data.limit,
      offset: v.data.offset
    });
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.get("/orders", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        status: z3.enum([
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
          "refunded"
        ]).optional(),
        payment_status: z3.enum(["pending", "paid", "failed", "refunded"]).optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.status) {
      params.push(v.data.status);
      where.push(`status = $${params.length}`);
    }
    if (v.data.payment_status) {
      params.push(v.data.payment_status);
      where.push(`payment_status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM orders ${whereSql}`).get(...params);
    const total = countRow.c;
    params.push(v.data.limit, v.data.offset);
    const orders = await db.prepare(
      `SELECT * FROM orders ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { orders, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.get("/disputes", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        status: z3.enum(["open", "in_review", "resolved", "rejected"]).optional(),
        priority: z3.enum(["low", "normal", "high", "urgent"]).optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.status) {
      params.push(v.data.status);
      where.push(`status = $${params.length}`);
    }
    if (v.data.priority) {
      params.push(v.data.priority);
      where.push(`priority = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM disputes ${whereSql}`).get(...params);
    const total = countRow.c;
    params.push(v.data.limit, v.data.offset);
    const disputes = await db.prepare(
      `SELECT * FROM disputes ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { disputes, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.get("/audit-log", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(
      paginationSchema.extend({
        entity_type: z3.string().trim().min(1).max(50).optional(),
        action: z3.string().trim().min(1).max(50).optional(),
        user_id: z3.coerce.number().int().positive().optional()
      }),
      req.query
    );
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    const where = [];
    const params = [];
    if (v.data.entity_type) {
      params.push(v.data.entity_type);
      where.push(`entity_type = $${params.length}`);
    }
    if (v.data.action) {
      params.push(v.data.action);
      where.push(`action = $${params.length}`);
    }
    if (v.data.user_id !== void 0) {
      params.push(v.data.user_id);
      where.push(`user_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS c FROM admin_audit_log ${whereSql}`).get(...params);
    const total = countRow.c;
    params.push(v.data.limit, v.data.offset);
    const log2 = await db.prepare(
      `SELECT id, user_id, action, entity_type, entity_id, old_values,
					        new_values, ip_address, user_agent, created_at
					 FROM admin_audit_log ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
    ).all(...params);
    return sendSuccess(res, { log: log2, total, limit: v.data.limit, offset: v.data.offset });
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.post(
  "/maintenance/cleanup-audit-logs",
  ...adminAuth2,
  async (req, res) => {
    try {
      const v = validate(
        z3.object({
          admin_retention_days: z3.coerce.number().int().min(30).max(3650).optional(),
          search_retention_days: z3.coerce.number().int().min(7).max(365).optional()
        }).strict(),
        req.body
      );
      if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
      const adminDays = v.data.admin_retention_days ?? 730;
      const searchDays = v.data.search_retention_days ?? 90;
      const row = await db.prepare(`SELECT * FROM cleanup_audit_logs($1::interval, $2::interval)`).get(`${adminDays} days`, `${searchDays} days`);
      await writeAuditLog(req, "maintenance.audit_cleanup", "system", 0, null, {
        admin_retention_days: adminDays,
        search_retention_days: searchDays,
        deleted_admin: row?.deleted_admin ?? 0,
        deleted_search: row?.deleted_search ?? 0
      });
      return sendSuccess(res, {
        deleted_admin: Number(row?.deleted_admin ?? 0),
        deleted_search: Number(row?.deleted_search ?? 0),
        admin_retention_days: adminDays,
        search_retention_days: searchDays
      });
    } catch (err) {
      return sendError(res, err);
    }
  }
);
adminRouter.get("/stats", ...adminAuth2, async (_req, res) => {
  try {
    const row = await db.prepare(
      `SELECT
					(SELECT COUNT(*)::int FROM users)                                        AS users,
					(SELECT COUNT(*)::int FROM stores)                                       AS stores,
					(SELECT COUNT(*)::int FROM products)                                     AS products,
					(SELECT COUNT(*)::int FROM orders)                                       AS orders,
					(SELECT COUNT(*)::int FROM reviews)                                      AS reviews,
					(SELECT COUNT(*)::int FROM disputes)                                     AS disputes,
					(SELECT COUNT(*)::int FROM disputes   WHERE status = 'open')            AS open_disputes,
					(SELECT COUNT(*)::int FROM orders     WHERE status = 'pending')         AS pending_orders,
					(SELECT COUNT(*)::int FROM orders     WHERE payment_status = 'paid')    AS paid_orders,
					(SELECT COUNT(*)::int FROM users      WHERE status <> 'active')         AS suspended_users,
					(SELECT COUNT(*)::int FROM stores     WHERE is_active = FALSE)          AS inactive_stores,
					(SELECT COUNT(*)::int FROM orders
						WHERE created_at > NOW() - INTERVAL '7 days')                      AS recent_orders,
					(SELECT COUNT(*)::int FROM users
						WHERE created_at > NOW() - INTERVAL '7 days')                      AS recent_users,
					(SELECT COALESCE(SUM(total), 0)::numeric
						FROM orders WHERE payment_status = 'paid')                        AS revenue_yer`
    ).get();
    return sendSuccess(res, {
      counts: {
        users: row.users,
        stores: row.stores,
        products: row.products,
        orders: row.orders,
        reviews: row.reviews,
        disputes: row.disputes
      },
      flags: {
        openDisputes: row.open_disputes,
        pendingOrders: row.pending_orders,
        paidOrders: row.paid_orders,
        suspendedUsers: row.suspended_users,
        inactiveStores: row.inactive_stores
      },
      recent7d: {
        orders: row.recent_orders,
        users: row.recent_users
      },
      revenueYer: Number(row.revenue_yer)
    });
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.patch("/users/:id", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(adminUserUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, "Invalid user id", 400);
    }
    if (req.user.id === userId) {
      if (v.data.status === "banned") {
        return sendError(res, "You cannot ban your own account.", 400, "SELF_BAN");
      }
      if (v.data.role && v.data.role !== "admin") {
        return sendError(res, "You cannot remove your own admin role.", 400, "SELF_DEMOTE");
      }
    }
    const current = await db.prepare(
      "SELECT id, email, role, status, is_verified, email_verified, phone_verified FROM users WHERE id = $1"
    ).get(userId);
    if (!current) return sendError(res, "User not found", 404);
    const { sql: setSql, params } = buildUpdateSet(v.data);
    params.push(userId);
    const updated = await db.prepare(
      `UPDATE users SET ${setSql} WHERE id = $${params.length} RETURNING id, email, role, status, is_verified, email_verified, phone_verified`
    ).get(...params);
    await writeAuditLog(req, "update_user", "user", userId, current, updated);
    return sendSuccess(res, updated, "User updated");
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.patch("/stores/:id", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(adminStoreUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const storeId = Number(req.params.id);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return sendError(res, "Invalid store id", 400);
    }
    const current = await db.prepare(
      "SELECT id, owner_id, store_name, is_active, is_verified, trust_level FROM stores WHERE id = $1"
    ).get(storeId);
    if (!current) return sendError(res, "Store not found", 404);
    const { sql: setSql, params } = buildUpdateSet(v.data);
    params.push(storeId);
    const updated = await db.prepare(
      `UPDATE stores SET ${setSql} WHERE id = $${params.length} RETURNING id, store_name, is_active, is_verified, trust_level`
    ).get(...params);
    await writeAuditLog(req, "update_store", "store", storeId, current, updated);
    return sendSuccess(res, updated, "Store updated");
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.patch("/orders/:id/status", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(adminOrderStatusSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return sendError(res, "Invalid order id", 400);
    }
    const current = await db.prepare("SELECT id, status, payment_status, total FROM orders WHERE id = $1").get(orderId);
    if (!current) return sendError(res, "Order not found", 404);
    const updated = await db.prepare("UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status").get(v.data.status, orderId);
    if (!updated) return sendError(res, "Order update failed", 500);
    await writeAuditLog(req, "force_status", "order", orderId, current, {
      ...updated,
      note: v.data.note ?? null
    });
    return sendSuccess(res, updated, "Order status updated");
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.patch("/products/:id", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(adminProductUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return sendError(res, "Invalid product id", 400);
    }
    const current = await db.prepare(
      "SELECT id, name_en, name_ar, is_active, is_featured, deal_discount FROM products WHERE id = $1"
    ).get(productId);
    if (!current) return sendError(res, "Product not found", 404);
    const { sql: setSql, params } = buildUpdateSet(v.data);
    params.push(productId);
    const updated = await db.prepare(
      `UPDATE products SET ${setSql} WHERE id = $${params.length}
					 RETURNING id, name_en, name_ar, is_active, is_featured, deal_discount, updated_at`
    ).get(...params);
    await writeAuditLog(req, "update_product", "product", productId, current, updated);
    return sendSuccess(res, updated, "Product updated");
  } catch (err) {
    return sendError(res, err);
  }
});
adminRouter.patch("/disputes/:id", ...adminAuth2, async (req, res) => {
  try {
    const v = validate(adminDisputeUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const disputeId = Number(req.params.id);
    if (!Number.isInteger(disputeId) || disputeId <= 0) {
      return sendError(res, "Invalid dispute id", 400);
    }
    const current = await db.prepare(
      "SELECT id, status, priority, resolution, refund_amount, resolved_by, resolved_at FROM disputes WHERE id = $1"
    ).get(disputeId);
    if (!current) return sendError(res, "Dispute not found", 404);
    const TERMINAL_STATUSES = /* @__PURE__ */ new Set([
      "resolved_buyer",
      "resolved_seller",
      "closed",
      "rejected"
    ]);
    const patch = { status: v.data.status };
    if (v.data.resolution !== void 0) patch.resolution = v.data.resolution;
    if (v.data.refund_amount !== void 0) patch.refund_amount = v.data.refund_amount;
    if (TERMINAL_STATUSES.has(v.data.status)) {
      patch.resolved_by = req.user.id;
      patch.resolved_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    const { sql: setSql, params } = buildUpdateSet(patch);
    params.push(disputeId);
    const updated = await db.prepare(
      `UPDATE disputes SET ${setSql} WHERE id = $${params.length}
					 RETURNING id, status, priority, resolution, refund_amount, resolved_by, resolved_at`
    ).get(...params);
    await writeAuditLog(req, "update_dispute", "dispute", disputeId, current, updated);
    return sendSuccess(res, updated, "Dispute updated");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/auth-2fa.ts
import { Router as Router4 } from "express";
import { z as z4 } from "zod";

// server/lib/backup-codes.ts
import { scrypt as scryptCb2, randomBytes as randomBytes3, timingSafeEqual as timingSafeEqual3 } from "crypto";
import { promisify as promisify2 } from "util";
var scryptAsync = promisify2(scryptCb2);
var BACKUP_CODE_LENGTH = 10;
var BACKUP_CODE_COUNT = 10;
var BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var SCRYPT_KEYLEN2 = 32;
var SCRYPT_SALT_LEN = 16;
function pickChar() {
  return BACKUP_ALPHABET.charAt(
    // CSPRNG modulo the alphabet length. The alphabet is 31
    // characters (well under 256) so the modulo bias is at
    // most 31/256 ≈ 12% — acceptable for a non-cryptographic
    // identifier (the security is in the hash, not the code).
    randomBytes3(1)[0] % BACKUP_ALPHABET.length
  );
}
function generateBackupCode() {
  let s = "";
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) s += pickChar();
  return s;
}
function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  return Array.from({ length: count }, () => generateBackupCode());
}
async function hashBackupCode(code) {
  const salt = randomBytes3(SCRYPT_SALT_LEN);
  const derived = await scryptAsync(code, salt, SCRYPT_KEYLEN2);
  return "scrypt$" + salt.toString("base64") + "$" + derived.toString("base64");
}
function parseStoredHash(stored) {
  const parts = stored.split("$");
  if (parts.length !== 3) return null;
  if (parts[0] !== "scrypt") return null;
  try {
    const salt = Buffer.from(parts[1], "base64");
    const key = Buffer.from(parts[2], "base64");
    if (key.length !== SCRYPT_KEYLEN2) return null;
    return { salt, key };
  } catch {
    return null;
  }
}
async function verifyBackupCodeHash(code, stored) {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const derived = await scryptAsync(code, parsed.salt, SCRYPT_KEYLEN2);
  if (derived.length !== parsed.key.length) return false;
  return timingSafeEqual3(derived, parsed.key);
}
async function findBackupCode(code, storedHashes) {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  if (normalized.length !== BACKUP_CODE_LENGTH) return -1;
  let matched = -1;
  for (let i = 0; i < storedHashes.length; i++) {
    const ok = await verifyBackupCodeHash(normalized, storedHashes[i]);
    if (ok && matched === -1) matched = i;
  }
  return matched;
}
function arrayLiteral(hashes) {
  const escape = (s) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  return "{" + hashes.map(escape).join(",") + "}";
}

// server/routes/auth-2fa.ts
init_error_codes();

// server/lib/partial-token.ts
init_shared();
import { createHmac as createHmac2, randomBytes as randomBytes4, timingSafeEqual as timingSafeEqual4 } from "crypto";
var PARTIAL_TTL_SECONDS = 5 * 60;
function getAuthSecret2() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      `AUTH_SECRET env var is required (>=32 random chars). Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
    );
  }
  return s;
}
function base64url2(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64url2(s) {
  const pad = s.length % 4 === 0 ? 0 : 4 - s.length % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}
function signPartialToken(userId) {
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    sub: userId,
    purpose: "2fa",
    jti: base64url2(randomBytes4(16)),
    exp: now + PARTIAL_TTL_SECONDS
  };
  const body = base64url2(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = base64url2(createHmac2("sha256", getAuthSecret2()).update(body).digest());
  return body + "." + sig;
}
async function verifyPartialToken(token) {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = base64url2(createHmac2("sha256", getAuthSecret2()).update(body).digest());
  const expectedBuf = fromBase64url2(expected);
  const sigBuf = fromBase64url2(sig);
  if (expectedBuf.length !== sigBuf.length) return null;
  if (!timingSafeEqual4(expectedBuf, sigBuf)) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64url2(body).toString("utf8"));
  } catch {
    return null;
  }
  if (payload.purpose !== "2fa") return null;
  if (typeof payload.sub !== "number") return null;
  if (typeof payload.jti !== "string") return null;
  if (typeof payload.exp !== "number") return null;
  if (payload.exp <= Math.floor(Date.now() / 1e3)) return null;
  const expiresAt = new Date(payload.exp * 1e3).toISOString();
  const result = await db.prepare(
    `INSERT INTO used_jtis (jti, user_id, expires_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT (jti) DO NOTHING
			 RETURNING jti`
  ).get(payload.jti, payload.sub, expiresAt);
  if (!result) {
    return null;
  }
  return { sub: payload.sub };
}

// server/routes/auth-2fa.ts
init_shared();

// server/lib/totp.ts
import { createHmac as createHmac3, randomBytes as randomBytes5 } from "crypto";
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
var TOTP_STEP_SECONDS = 30;
var TOTP_DIGITS = 6;
function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = value << 8 | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[value << 5 - bits & 31];
  }
  return out;
}
function base32Decode(s) {
  const cleaned = s.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character: " + ch);
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      out.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function generateSecret() {
  return base32Encode(randomBytes5(20));
}
function normalizeOtp(input) {
  const stripped = input.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(stripped)) return null;
  return Number(stripped);
}
function totpAt(secret, unixSeconds) {
  const key = base32Decode(secret);
  const counter = Math.floor(unixSeconds / TOTP_STEP_SECONDS);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac3("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = (hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255;
  const otp = (code % 1e6).toString().padStart(TOTP_DIGITS, "0");
  return otp;
}
function timingSafeEqualStr(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
function verifyTotp(secret, code, now = Date.now()) {
  const normalized = normalizeOtp(code);
  if (normalized === null) return false;
  const expected = totpAt(secret, Math.floor(now / 1e3));
  const prev = totpAt(secret, Math.floor(now / 1e3) - TOTP_STEP_SECONDS);
  const next = totpAt(secret, Math.floor(now / 1e3) + TOTP_STEP_SECONDS);
  return timingSafeEqualStr(expected, normalized.toString().padStart(TOTP_DIGITS, "0")) || timingSafeEqualStr(prev, normalized.toString().padStart(TOTP_DIGITS, "0")) || timingSafeEqualStr(next, normalized.toString().padStart(TOTP_DIGITS, "0"));
}
function otpauthUrl(account, secret, issuer, period = TOTP_STEP_SECONDS, digits = TOTP_DIGITS) {
  const label = encodeURIComponent(issuer + ":" + account);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(period)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// server/routes/auth-2fa.ts
init_middleware();
var auth2faRouter = Router4();
var enableSchema = z4.object({
  code: z4.string().trim().min(6).max(20)
});
var disableSchema = z4.object({
  password: z4.string().min(1).max(200)
});
var verifySchema = z4.object({
  partial_token: z4.string().min(20).max(500),
  code: z4.string().trim().min(6).max(20)
});
async function checkRate(bucket, ip, windowMs, max) {
  try {
    const row = await db.prepare("SELECT allowed FROM consume_rate_limit($1, $2, $3, $4)").get(bucket, ip, windowMs, max);
    if (!row) return true;
    return row.allowed === true;
  } catch (err) {
    log.warn({
      msg: "rate_limit_db_error",
      bucket,
      ip,
      error: err.message
    });
    return true;
  }
}
function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "anon";
}
var RATE_LIMITS = {
  verify: {
    bucket: "2fa_verify",
    windowMs: 6e4,
    max: 5,
    message: "Too many 2FA attempts. Try again in a minute."
  },
  setup: {
    bucket: "2fa_setup",
    windowMs: 60 * 60 * 1e3,
    max: 10,
    message: "Too many 2FA setup requests. Try again in an hour."
  },
  enable: {
    bucket: "2fa_enable",
    windowMs: 6e4,
    max: 10,
    message: "Too many 2FA enable attempts. Try again in a minute."
  },
  disable: {
    bucket: "2fa_disable",
    windowMs: 6e4,
    max: 5,
    message: "Too many 2FA disable attempts. Try again in a minute."
  },
  backupCodes: {
    bucket: "2fa_backup_codes",
    windowMs: 6e4,
    max: 5,
    message: "Too many backup-code regenerations. Try again in a minute."
  }
};
function rateLimitMiddleware(bucket, windowMs, max, message) {
  return async (req, res, next) => {
    if (!await checkRate(bucket, clientIp(req), windowMs, max)) {
      return sendError(res, message, 429, "RATE_LIMITED");
    }
    next();
  };
}
var limitVerify = rateLimitMiddleware(
  RATE_LIMITS.verify.bucket,
  RATE_LIMITS.verify.windowMs,
  RATE_LIMITS.verify.max,
  RATE_LIMITS.verify.message
);
var limitSetup = rateLimitMiddleware(
  RATE_LIMITS.setup.bucket,
  RATE_LIMITS.setup.windowMs,
  RATE_LIMITS.setup.max,
  RATE_LIMITS.setup.message
);
var limitEnable = rateLimitMiddleware(
  RATE_LIMITS.enable.bucket,
  RATE_LIMITS.enable.windowMs,
  RATE_LIMITS.enable.max,
  RATE_LIMITS.enable.message
);
var limitDisable = rateLimitMiddleware(
  RATE_LIMITS.disable.bucket,
  RATE_LIMITS.disable.windowMs,
  RATE_LIMITS.disable.max,
  RATE_LIMITS.disable.message
);
var limitBackupCodes = rateLimitMiddleware(
  RATE_LIMITS.backupCodes.bucket,
  RATE_LIMITS.backupCodes.windowMs,
  RATE_LIMITS.backupCodes.max,
  RATE_LIMITS.backupCodes.message
);
async function loadUser(id) {
  const row = await db.prepare(
    `SELECT id, email, full_name, role, two_factor_enabled,
			        totp_secret, totp_backup_codes
			   FROM users
			  WHERE id = ? AND deleted_at IS NULL`
  ).get(id);
  return row ?? null;
}
function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    two_factor_enabled: u.two_factor_enabled
  };
}
auth2faRouter.post("/setup", limitSetup, requireAuth, async (req, res) => {
  try {
    const user = await loadUser(req.user.id);
    if (!user) throw new HttpError(404, "User not found", { code: ErrorCodes.NOT_FOUND });
    if (user.two_factor_enabled) {
      return sendError(
        res,
        "2FA is already enabled. Disable it first to re-enroll.",
        409,
        ErrorCodes.ALREADY_ENABLED
      );
    }
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(backupCodes.map(hashBackupCode));
    await db.prepare(
      `UPDATE users
				    SET totp_secret = ?,
				        totp_backup_codes = ?::text[],
				        two_factor_enabled = FALSE,
				        totp_enabled_at = NULL
				  WHERE id = ?`
    ).run(secret, arrayLiteral(hashed), user.id);
    const otpauth = otpauthUrl(user.email, secret, "Nouf-ex");
    sendSuccess(
      res,
      {
        secret,
        // base32 — for manual entry into the authenticator
        otpauth_url: otpauth,
        // otpauth:// — for QR-code generation by the client
        backup_codes: backupCodes,
        // plaintext — show to the user ONCE
        instructions: "1. Open your authenticator app (Google Authenticator, Authy, etc.).\n2. Either scan a QR of otpauth_url OR enter the secret manually.\n3. Confirm the 6-digit code via POST /api/auth/2fa/enable to activate 2FA.\n4. Save the backup codes in a safe place. They are shown only once."
      },
      200,
      "2FA setup ready. Confirm with /enable to activate."
    );
  } catch (err) {
    sendError(res, err);
  }
});
auth2faRouter.post("/enable", limitEnable, requireAuth, async (req, res) => {
  try {
    const v = enableSchema.safeParse(req.body);
    if (!v.success) {
      return sendError(res, "Invalid input: " + v.error.message, 400, ErrorCodes.VALIDATION_ERROR);
    }
    const user = await loadUser(req.user.id);
    if (!user) throw new HttpError(404, "User not found", { code: ErrorCodes.NOT_FOUND });
    if (user.two_factor_enabled) {
      return sendError(res, "2FA is already enabled.", 409, ErrorCodes.ALREADY_ENABLED);
    }
    if (!user.totp_secret) {
      return sendError(
        res,
        "2FA setup was not started. Call POST /api/auth/2fa/setup first.",
        400,
        "NOT_SET_UP"
      );
    }
    if (!verifyTotp(user.totp_secret, v.data.code)) {
      return sendError(res, "Invalid code.", 401, "TOTP_INVALID");
    }
    await db.prepare(
      `UPDATE users
				    SET two_factor_enabled = TRUE,
				        totp_enabled_at = CURRENT_TIMESTAMP
				  WHERE id = ?`
    ).run(user.id);
    log.info({
      msg: "totp_enabled",
      user_id: user.id
    });
    sendSuccess(
      res,
      { user: publicUser({ ...user, two_factor_enabled: true }) },
      200,
      "2FA enabled. Save your backup codes \u2014 they are not shown again."
    );
  } catch (err) {
    sendError(res, err);
  }
});
auth2faRouter.post("/verify", limitVerify, async (req, res) => {
  try {
    const v = verifySchema.safeParse(req.body);
    if (!v.success) {
      return sendError(res, "Invalid input: " + v.error.message, 400, ErrorCodes.VALIDATION_ERROR);
    }
    const partial = await verifyPartialToken(v.data.partial_token);
    if (!partial) {
      return sendError(res, "Invalid or expired partial token.", 401, ErrorCodes.PARTIAL_INVALID);
    }
    const user = await loadUser(partial.sub);
    if (!user || !user.two_factor_enabled || !user.totp_secret) {
      return sendError(res, "2FA is not enabled for this account.", 400, "NOT_2FA");
    }
    const code = v.data.code;
    const totpOk = verifyTotp(user.totp_secret, code);
    let backupIdx = -1;
    if (!totpOk && user.totp_backup_codes && user.totp_backup_codes.length > 0) {
      backupIdx = await findBackupCode(code, user.totp_backup_codes);
    }
    if (!totpOk && backupIdx < 0) {
      return sendError(res, "Invalid 2FA code.", 401, "CODE_INVALID");
    }
    if (!totpOk && backupIdx >= 0 && user.totp_backup_codes) {
      const remaining = user.totp_backup_codes.filter((_, i) => i !== backupIdx);
      await db.prepare("UPDATE users SET totp_backup_codes = ?::text[] WHERE id = ?").run(arrayLiteral(remaining), user.id);
      log.info({
        msg: "backup_code_used",
        user_id: user.id,
        remaining: remaining.length
      });
    }
    await db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").run(user.id).catch(() => void 0);
    const versionRow = await db.prepare("SELECT token_version FROM users WHERE id = ?").get(user.id);
    const token = signAuthToken({
      sub: user.id,
      role: user.role,
      ver: versionRow?.token_version ?? 0
    });
    sendSuccess(
      res,
      { token, user: publicUser(user), method: totpOk ? "totp" : "backup_code" },
      200,
      "2FA verified"
    );
  } catch (err) {
    sendError(res, err);
  }
});
auth2faRouter.post("/disable", limitDisable, requireAuth, async (req, res) => {
  try {
    const v = disableSchema.safeParse(req.body);
    if (!v.success) {
      return sendError(res, "Invalid input: " + v.error.message, 400, ErrorCodes.VALIDATION_ERROR);
    }
    const user = await db.prepare("SELECT id, password_hash FROM users WHERE id = ? AND deleted_at IS NULL").get(req.user.id);
    if (!user) throw new HttpError(404, "User not found", { code: ErrorCodes.NOT_FOUND });
    const verifyModule = await Promise.resolve().then(() => (init_middleware(), middleware_exports)).catch(() => null);
    const { scrypt: scryptCb3, timingSafeEqual: timingSafeEqual7 } = await import("crypto");
    const { promisify: promisify3 } = await import("util");
    const scryptAsync2 = promisify3(scryptCb3);
    const parts = user.password_hash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") {
      return sendError(res, "Invalid stored hash format.", 500, "INTERNAL");
    }
    const salt = Buffer.from(parts[1], "base64");
    const expected = Buffer.from(parts[2], "base64");
    const derived = await scryptAsync2(v.data.password, salt, expected.length);
    if (derived.length !== expected.length || !timingSafeEqual7(derived, expected)) {
      return sendError(res, "Invalid password.", 401, "AUTH_INVALID");
    }
    void verifyModule;
    await db.prepare(
      `UPDATE users
				    SET two_factor_enabled = FALSE,
				        totp_secret = NULL,
				        totp_backup_codes = '{}'::text[],
				        totp_enabled_at = NULL
				  WHERE id = ?`
    ).run(user.id);
    log.info({
      msg: "totp_disabled",
      user_id: user.id
    });
    sendSuccess(
      res,
      { user: publicUser({ ...await loadUser(user.id), two_factor_enabled: false }) },
      200,
      "2FA disabled"
    );
  } catch (err) {
    sendError(res, err);
  }
});
auth2faRouter.post(
  "/backup-codes/regenerate",
  limitBackupCodes,
  requireAuth,
  async (req, res) => {
    try {
      const user = await loadUser(req.user.id);
      if (!user) throw new HttpError(404, "User not found", { code: ErrorCodes.NOT_FOUND });
      if (!user.two_factor_enabled) {
        return sendError(res, "2FA is not enabled. Enable it first.", 400, ErrorCodes.NOT_ENABLED);
      }
      const newCodes = generateBackupCodes();
      const hashed = await Promise.all(newCodes.map(hashBackupCode));
      await db.prepare("UPDATE users SET totp_backup_codes = ?::text[] WHERE id = ?").run(arrayLiteral(hashed), user.id);
      log.info({
        msg: "backup_codes_regenerated",
        user_id: user.id,
        count: newCodes.length
      });
      sendSuccess(
        res,
        { backup_codes: newCodes },
        200,
        "New backup codes generated. Save them \u2014 they are not shown again."
      );
    } catch (err) {
      sendError(res, err);
    }
  }
);

// server/routes/auth.ts
import { Router as Router5 } from "express";
init_shared();
init_middleware();
init_error_codes();
var DUMMY_SCRYPT_HASH = "";
(async () => {
  DUMMY_SCRYPT_HASH = await hashPassword(
    `__login_timing_dummy_${Math.random().toString(36)}_${Date.now()}__`
  );
})();
var authRouter = Router5();
authRouter.post("/register", authLimiter, async (req, res) => {
  try {
    const v = validate(registerSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
    const { email, password, name } = v.data;
    const role = "customer";
    const passwordHash = await hashPassword(password);
    let userId;
    try {
      const result = await db.prepare(
        `INSERT INTO users (email, password_hash, full_name, role, status, is_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`
      ).run(email, passwordHash, name, role);
      if (result.lastInsertRowid == null) {
        throw new HttpError(500, "Failed to create user", { code: ErrorCodes.INSERT_FAILED });
      }
      userId = result.lastInsertRowid;
    } catch (err) {
      const pg = err;
      if (pg?.code === "23505") {
        return sendError(res, "Email already registered", 409, ErrorCodes.DUPLICATE);
      }
      throw err;
    }
    const safeUser = { id: userId, email, full_name: name, role };
    const userRow = await db.prepare("SELECT token_version FROM users WHERE id = ?").get(userId);
    const token = signAuthToken({ sub: userId, role, ver: userRow?.token_version ?? 0 });
    try {
      const { onWelcome: onWelcome2 } = await Promise.resolve().then(() => (init_events(), events_exports));
      await onWelcome2({ userId, name });
    } catch (notifyErr) {
      console.error("[auth.register] welcome notification failed:", notifyErr);
    }
    sendSuccess(res, { user: safeUser, token }, 201, "User registered successfully");
  } catch (err) {
    const pg = err;
    if (pg?.code === "23505") {
      return sendError(res, "Email already registered", 409, ErrorCodes.DUPLICATE);
    }
    throw err;
  }
});
authRouter.post("/login", authLimiter, async (req, res) => {
  const v = validate(loginSchema, req.body);
  if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
  const { email, password } = v.data;
  const user = await db.prepare(
    // SECURITY (C-3): select `token_version` so the freshly
    // signed token matches the user's current revocation
    // counter. A logout elsewhere will bump this number and
    // invalidate the token on its next use.
    "SELECT id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender, password_hash, last_login, created_at, token_version FROM users WHERE email = ?"
  ).get(email);
  if (!user) {
    await verifyPassword(password, DUMMY_SCRYPT_HASH).catch(() => false);
    return sendError(res, "Invalid email or password", 401, "AUTH_INVALID");
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return sendError(res, "Invalid email or password", 401, "AUTH_INVALID");
  }
  await db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").run(user.id).catch(() => void 0);
  const { password_hash: _omit, ...userWithoutPassword } = user;
  if (user.two_factor_enabled) {
    const partial_token = signPartialToken(user.id);
    return sendSuccess(
      res,
      {
        requires_2fa: true,
        partial_token,
        user_id: user.id
      },
      200,
      "Password OK. 2FA required \u2014 call /api/auth/2fa/verify with the code."
    );
  }
  const token = signAuthToken({ sub: user.id, role: user.role, ver: user.token_version });
  sendSuccess(res, { user: userWithoutPassword, token }, 200, "Login successful");
});
authRouter.post("/logout", requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    await db.prepare(
      "UPDATE users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(userId);
    try {
      const { invalidateTokenVersionCache: invalidateTokenVersionCache2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
      invalidateTokenVersionCache2(userId);
    } catch {
    }
    return sendSuccess(
      res,
      { revoked: true, message: "All sessions for this user have been revoked." },
      200
    );
  } catch (err) {
    return sendError(res, err);
  }
});
authRouter.get("/me", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const user = await db.prepare(
    "SELECT id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender, last_login, created_at FROM users WHERE id = ?"
  ).get(userId);
  if (!user) {
    throw new HttpError(404, "User not found", { code: ErrorCodes.NOT_FOUND });
  }
  sendSuccess(res, user);
});
authRouter.patch("/me", requireAuth, async (req, res) => {
  try {
    const v = validate(profileUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
    const updates = v.data;
    const userId = req.user.id;
    const fields = [];
    const params = [];
    if (updates.full_name !== void 0) {
      fields.push("full_name = ?");
      params.push(updates.full_name);
    }
    if (updates.phone !== void 0) {
      fields.push("phone = ?");
      params.push(updates.phone);
    }
    if (updates.avatar !== void 0) {
      fields.push("avatar = ?");
      params.push(updates.avatar);
    }
    if (updates.preferred_language !== void 0) {
      fields.push("preferred_language = ?");
      params.push(updates.preferred_language);
    }
    if (updates.gender !== void 0) {
      fields.push("gender = ?");
      params.push(updates.gender);
    }
    if (fields.length === 0) {
      return sendError(res, "No updatable fields supplied", 400, "EMPTY_UPDATE");
    }
    fields.push("updated_at = CURRENT_TIMESTAMP");
    params.push(userId);
    const updated = await db.prepare(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ? RETURNING id, email, full_name, avatar, role, status, is_verified, phone, preferred_language, gender, last_login, created_at`
    ).get(...params);
    if (!updated) throw new HttpError(404, "User not found", { code: ErrorCodes.NOT_FOUND });
    sendSuccess(res, updated, "Profile updated");
  } catch (err) {
    return sendError(res, err);
  }
});
authRouter.post("/change-password", requireAuth, async (req, res) => {
  try {
    const v = validate(passwordChangeSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
    const { current_password, new_password } = v.data;
    const userId = req.user.id;
    const row = await db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId);
    if (!row) throw new HttpError(404, "User not found", { code: ErrorCodes.NOT_FOUND });
    const ok = await verifyPassword(current_password, row.password_hash);
    if (!ok) {
      return sendError(res, "Current password is incorrect", 401, "WRONG_PASSWORD");
    }
    const sameAsCurrent = await verifyPassword(new_password, row.password_hash);
    if (sameAsCurrent) {
      return sendError(
        res,
        "New password must be different from the current password",
        400,
        "SAME_AS_CURRENT"
      );
    }
    const newHash = await hashPassword(new_password);
    await db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(newHash, userId);
    await db.prepare(
      "UPDATE users SET token_version = token_version + 1 WHERE id = ?"
    ).run(userId);
    try {
      const { invalidateTokenVersionCache: invalidateTokenVersionCache2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
      invalidateTokenVersionCache2(userId);
    } catch {
    }
    await writeAuditLog(req, "change_password", "user", userId, null, null);
    sendSuccess(res, { updated: true, sessions_invalidated: true }, 200, "Password changed");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/cart.ts
init_error_codes();
init_shared();
import { Router as Router6 } from "express";
var cartRouter = Router6();
cartRouter.delete("/clear/:userId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.prepare("DELETE FROM cart_items WHERE user_id = ? RETURNING id").run(userId);
    const removed = Number(result.changes ?? 0);
    return sendSuccess(res, { removed }, "Cart cleared");
  } catch (err) {
    return sendError(res, err);
  }
});
cartRouter.get("/count/:userId", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return sendError(res, "Invalid user id", 400);
    }
    if (req.user.id !== userId && req.user.role !== "admin") {
      return sendError(res, "Forbidden", 403, "FORBIDDEN");
    }
    const row = await db.prepare(
      "SELECT COALESCE(SUM(quantity), 0)::int AS c FROM cart_items WHERE user_id = $1"
    ).get(userId);
    return sendSuccess(res, { user_id: userId, count: row?.c ?? 0 });
  } catch (err) {
    return sendError(res, err);
  }
});
cartRouter.get("/:userId", requireAuth, async (req, res) => {
  try {
    const urlUserId = Number(req.params.userId);
    if (!Number.isInteger(urlUserId) || urlUserId <= 0) {
      return sendError(res, "Invalid user id", 400);
    }
    if (req.user.id !== urlUserId && req.user.role !== "admin") {
      return sendError(res, "Forbidden", 403, "FORBIDDEN");
    }
    const userId = req.user.id;
    const cartItems = await db.prepare(
      `SELECT ci.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.stock, s.store_name
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE ci.user_id = ?
         ORDER BY ci.created_at DESC`
    ).all(userId);
    sendSuccess(res, cartItems);
  } catch (err) {
    return sendError(res, err);
  }
});
cartRouter.post("/", requireAuth, async (req, res) => {
  try {
    const v = validate(cartAddSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
    const { productId, quantity, variant } = v.data;
    const userId = req.user.id;
    const existing = await db.prepare("SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?").get(userId, productId);
    if (existing) {
      await db.prepare("UPDATE cart_items SET quantity = quantity + ? WHERE id = ?").run(quantity, existing.id);
      return sendSuccess(res, { id: existing.id }, "Cart updated successfully");
    }
    const result = await db.prepare(
      `INSERT INTO cart_items (user_id, product_id, quantity, variant, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         RETURNING id`
    ).run(userId, productId, quantity, variant ? JSON.stringify(variant) : null);
    if (result.lastInsertRowid == null) {
      return sendError(res, "Failed to add item to cart", 500, ErrorCodes.INSERT_FAILED);
    }
    return sendSuccess(res, { id: result.lastInsertRowid }, "Item added to cart");
  } catch (err) {
    return sendError(res, err);
  }
});
cartRouter.patch("/:id", requireAuth, async (req, res) => {
  try {
    const idV = validate(cartItemIdParamSchema, req.params);
    if (!idV.ok) return sendError(res, "Invalid cart item id: " + idV.error, 400);
    const v = validate(cartItemUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
    const userId = req.user.id;
    const existing = await db.prepare("SELECT id, product_id FROM cart_items WHERE id = ? AND user_id = ?").get(idV.data.id, userId);
    if (!existing) return sendError(res, "Cart item not found", 404);
    const stock = await db.prepare("SELECT stock FROM products WHERE id = ? AND is_active = TRUE").get(existing.product_id);
    if (!stock) return sendError(res, "Product is no longer available", 404);
    if (stock.stock < v.data.quantity) {
      return sendError(
        res,
        `Insufficient stock for product ${existing.product_id} (have ${stock.stock}, need ${v.data.quantity})`,
        400,
        "INSUFFICIENT_STOCK"
      );
    }
    await db.prepare("UPDATE cart_items SET quantity = ?, variant = ? WHERE id = ? AND user_id = ?").run(
      v.data.quantity,
      v.data.variant ? JSON.stringify(v.data.variant) : null,
      idV.data.id,
      userId
    );
    return sendSuccess(
      res,
      { id: idV.data.id, quantity: v.data.quantity },
      "Cart item updated"
    );
  } catch (err) {
    return sendError(res, err);
  }
});
cartRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const v = validate(cartItemIdParamSchema, req.params);
    if (!v.ok) return sendError(res, "Invalid cart item id: " + v.error, 400);
    const cartItemId = v.data.id;
    const userId = req.user.id;
    const result = await db.prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ? RETURNING id").get(cartItemId, userId);
    if (!result) return sendError(res, "Cart item not found", 404);
    return sendSuccess(res, { id: result.id }, "Item removed from cart");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/catalog.ts
import { Router as Router7 } from "express";

// server/lib/search.ts
init_shared();
function normalizeQuery(raw) {
  return raw.toLowerCase().trim().replace(/\s+/g, " ").slice(0, 200);
}
function orderByFor(sort) {
  switch (sort) {
    case "price_asc":
      return "ORDER BY p.price ASC, RANK_PLACEHOLDER DESC";
    case "price_desc":
      return "ORDER BY p.price DESC, RANK_PLACEHOLDER DESC";
    case "newest":
      return "ORDER BY p.created_at DESC";
    case "relevance":
    default:
      return "ORDER BY RANK_PLACEHOLDER DESC, p.created_at DESC";
  }
}
async function runSearch(query, filters = {}) {
  const start = Date.now();
  const numLimit = Math.max(
    1,
    Math.min(100, Number.isFinite(filters.limit ?? NaN) ? filters.limit : 20)
  );
  const numOffset = Math.max(0, filters.offset ?? 0);
  const where = [
    "p.is_active = TRUE",
    "p.deleted_at IS NULL",
    "p.search_tsv @@ websearch_to_tsquery('simple', $1)"
  ];
  const params = [query];
  if (filters.category) {
    params.push(filters.category);
    where.push(
      "p.category_id = (SELECT id FROM categories WHERE slug = $" + params.length + ")"
    );
  }
  if (filters.storeId !== void 0) {
    params.push(filters.storeId);
    where.push("p.store_id = $" + params.length);
  }
  if (filters.minPrice !== void 0) {
    params.push(filters.minPrice);
    where.push("p.price >= $" + params.length);
  }
  if (filters.maxPrice !== void 0) {
    params.push(filters.maxPrice);
    where.push("p.price <= $" + params.length);
  }
  params.push(numLimit, numOffset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;
  const orderBy = orderByFor(filters.sort ?? "relevance").replace(
    "RANK_PLACEHOLDER",
    `ts_rank_cd(p.search_tsv, websearch_to_tsquery('simple', $1))`
  );
  const sql = `
		SELECT p.*, s.store_name,
		       ts_rank_cd(p.search_tsv, websearch_to_tsquery('simple', $1)) AS rank,
		       COUNT(*) OVER () AS total_count
		  FROM products p
		  JOIN stores s ON s.id = p.store_id
		 WHERE ${where.join(" AND ")}
		 ${orderBy}
		 LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  const rows = await db.prepare(sql).all(...params);
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
  const hits = rows.map((r) => {
    const { total_count: _t, ...rest } = r;
    void _t;
    return rest;
  });
  return { hits, total, took_ms: Date.now() - start };
}
async function logSearch(query, normalized, resultCount, durationMs, userId, requestId2) {
  try {
    await db.prepare(
      `INSERT INTO search_logs
				 (query, query_normalized, result_count, duration_ms, user_id, request_id)
				 VALUES (?, ?, ?, ?, ?, ?)`
    ).run(query, normalized, resultCount, durationMs, userId, requestId2);
  } catch (err) {
    log.warn({
      msg: "search_log_insert_failed",
      error: err.message
    });
  }
}

// server/routes/catalog.ts
init_shared();
init_middleware();
var catalogRouter = Router7();
var getProductImages = async (productId) => {
  return db.prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order").all(productId);
};
async function countProducts(where, params) {
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM products WHERE ${where.join(" AND ")}`).get(...params);
  return row ? Number(row.c) : 0;
}
catalogRouter.get("/products", async (req, res) => {
  try {
    const {
      category,
      search,
      store,
      minPrice,
      maxPrice,
      sort,
      limit = "20",
      offset = "0"
    } = req.query;
    const where = ["is_active = 1"];
    const params = [];
    if (category) {
      where.push("category_id = (SELECT id FROM categories WHERE slug = ?)");
      params.push(category);
    }
    if (store) {
      where.push("store_id = ?");
      params.push(Number(store));
    }
    if (minPrice) {
      where.push("price >= ?");
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      where.push("price <= ?");
      params.push(Number(maxPrice));
    }
    if (search) {
      const term = `%${search}%`;
      where.push(
        "(name_en LIKE ? OR name_ar LIKE ? OR name_zh LIKE ? OR description_en LIKE ?)"
      );
      params.push(term, term, term, term);
    }
    let orderBy = " ORDER BY created_at DESC";
    switch (sort) {
      case "price_asc":
        orderBy = " ORDER BY price ASC";
        break;
      case "price_desc":
        orderBy = " ORDER BY price DESC";
        break;
      case "popular":
        orderBy = " ORDER BY sold_count DESC";
        break;
      case "newest":
      default:
        orderBy = " ORDER BY created_at DESC";
        break;
    }
    const parsedLimit = Number(limit);
    const numLimit = Math.max(
      1,
      Math.min(100, Number.isFinite(parsedLimit) ? parsedLimit : 20)
    );
    const numOffset = Math.max(0, Number(offset) || 0);
    const sql = `SELECT *, COUNT(*) OVER () AS total_count
		             FROM products
		            WHERE ${where.join(" AND ")}
		            ${orderBy}
		            LIMIT ? OFFSET ?`;
    const rows = await db.prepare(sql).all(...params, numLimit, numOffset);
    const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : await countProducts(where, params);
    const products = rows.map((r) => {
      const { total_count: _omit, ...rest } = r;
      void _omit;
      return getProductWithParsedFields(rest);
    });
    return sendSuccess(res, {
      products,
      total,
      limit: numLimit,
      offset: numOffset
    });
  } catch (err) {
    return sendError(res, err);
  }
});
catalogRouter.get("/products/featured", async (_req, res) => {
  try {
    const rows = await db.prepare(
      "SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 10"
    ).all();
    const products = rows.map(getProductWithParsedFields);
    return sendSuccess(res, products);
  } catch (err) {
    return sendError(res, err);
  }
});
catalogRouter.get("/products/deals", async (_req, res) => {
  try {
    const rows = await db.prepare(
      "SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 10"
    ).all();
    const products = rows.map(getProductWithParsedFields);
    return sendSuccess(res, products);
  } catch (err) {
    return sendError(res, err);
  }
});
catalogRouter.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await db.prepare("SELECT * FROM products WHERE id = ?").get(Number(id));
    if (!product) {
      return sendError(res, "Product not found", 404);
    }
    const store = await db.prepare("SELECT * FROM stores WHERE id = ?").get(product.store_id);
    const reviews = await db.prepare(
      `SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC`
    ).all(Number(id));
    const images = await getProductImages(Number(id));
    const productParsed = getProductWithParsedFields(product);
    return sendSuccess(res, {
      ...productParsed,
      store,
      reviews,
      images
    });
  } catch (err) {
    return sendError(res, err);
  }
});
catalogRouter.get("/stores", async (_req, res) => {
  try {
    const stores = await db.prepare("SELECT * FROM stores ORDER BY rating DESC").all();
    return sendSuccess(res, stores);
  } catch (err) {
    return sendError(res, err);
  }
});
catalogRouter.get("/stores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const store = await db.prepare("SELECT * FROM stores WHERE id = ?").get(Number(id));
    if (!store) {
      return sendError(res, "Store not found", 404);
    }
    const products = await db.prepare("SELECT * FROM products WHERE store_id = ? AND is_active = 1").all(Number(id));
    return sendSuccess(res, {
      ...store,
      products: products.map(getProductWithParsedFields)
    });
  } catch (err) {
    log.error({ msg: "stores/:id", request_id: req.id, error: err.message });
    return sendError(res, err);
  }
});
catalogRouter.get("/stores/:id/reviews", async (req, res) => {
  try {
    const { id } = req.params;
    const reviews = await db.prepare(
      `SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar, p.name_en as product_name
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         LEFT JOIN products p ON r.product_id = p.id
         WHERE r.store_id = ? AND r.is_visible = TRUE
         ORDER BY r.created_at DESC`
    ).all(Number(id));
    return sendSuccess(res, reviews);
  } catch (err) {
    return sendError(res, err);
  }
});
catalogRouter.get("/categories", async (_req, res) => {
  try {
    const categories = await db.prepare(
      `SELECT c.*, COUNT(p.id) as product_count
         FROM categories c
         LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
         GROUP BY c.id
         ORDER BY c.sort_order ASC`
    ).all();
    return sendSuccess(res, categories);
  } catch (err) {
    return sendError(res, err);
  }
});
catalogRouter.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      return sendError(res, "Missing required query parameter: q", 400, ErrorCodes.VALIDATION_ERROR);
    }
    const result = await runSearch(q, {
      category: req.query.category ? String(req.query.category) : void 0,
      storeId: req.query.store ? Number(req.query.store) : void 0,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : void 0,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : void 0,
      sort: req.query.sort ?? "relevance",
      limit: req.query.limit !== void 0 ? Number(req.query.limit) : void 0,
      offset: req.query.offset !== void 0 ? Number(req.query.offset) : void 0
    });
    const userId = req.user?.id ?? null;
    const requestId2 = req.id ?? null;
    await logSearch(q, normalizeQuery(q), result.total, result.took_ms, userId, requestId2);
    const products = result.hits.map((r) => {
      const { rank: _r, ...rest } = r;
      void _r;
      return getProductWithParsedFields(rest);
    });
    sendSuccess(res, {
      query: q,
      total: result.total,
      limit: Number.isFinite(Number(req.query.limit)) ? Math.max(1, Math.min(100, Number(req.query.limit))) : 20,
      offset: Math.max(0, Number(req.query.offset) || 0),
      duration_ms: result.took_ms,
      products
    });
  } catch (err) {
    sendError(res, err);
  }
});
catalogRouter.get("/categories/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await db.prepare("SELECT * FROM categories WHERE slug = ?").get(slug);
    if (!category) {
      return sendError(res, "Category not found", 404);
    }
    const products = await db.prepare("SELECT * FROM products WHERE category_id = ? AND is_active = 1").all(category.id);
    return sendSuccess(res, {
      ...category,
      products: products.map(getProductWithParsedFields)
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/coupons.ts
init_shared();
import { Router as Router8 } from "express";
import { z as z5 } from "zod";
var couponsRouter = Router8();
couponsRouter.post("/validate", requireAuth, async (req, res) => {
  try {
    const v = validate(couponRedeemSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const { code, order_subtotal } = v.data;
    const coupon = await db.prepare(`SELECT ${COUPON_COLUMNS} FROM coupons WHERE code = ? AND is_active = TRUE`).get(code);
    if (!coupon) return sendError(res, "Coupon not found or inactive", 404);
    if (coupon.expires_at && new Date(coupon.expires_at) < /* @__PURE__ */ new Date()) {
      return sendError(res, "Coupon has expired", 400);
    }
    if (coupon.starts_at && new Date(coupon.starts_at) > /* @__PURE__ */ new Date()) {
      return sendError(res, "Coupon is not yet active", 400);
    }
    if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
      return sendError(res, "Coupon usage limit reached", 400);
    }
    if (coupon.min_order != null && order_subtotal < coupon.min_order) {
      return sendError(
        res,
        `Minimum order for this coupon is ${coupon.min_order.toLocaleString()}`,
        400
      );
    }
    const discount = await computeCouponDiscount(coupon, order_subtotal);
    sendSuccess(res, {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
      final_total: Math.round((order_subtotal - discount) * 100) / 100
    });
  } catch (err) {
    return sendError(res, err);
  }
});
couponsRouter.post("/redeem", requireAuth, async (req, res) => {
  try {
    const schema = couponRedeemSchema.extend({ order_id: z5.number().int().positive() });
    const v = validate(schema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const { code, order_id } = v.data;
    const user_id = req.user.id;
    const coupon = await db.prepare("SELECT id FROM coupons WHERE code = ? AND is_active = TRUE").get(code);
    if (!coupon) return sendError(res, "Coupon not found", 404);
    const orderOwner = await db.prepare("SELECT customer_id FROM orders WHERE id = ?").get(order_id);
    if (!orderOwner) return sendError(res, "Order not found", 404);
    if (orderOwner.customer_id !== user_id) return sendError(res, "Forbidden", 403);
    const already = await db.prepare(
      "SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ? AND order_id = ?"
    ).get(coupon.id, user_id, order_id);
    if (already)
      return sendSuccess(res, { id: already.id }, "Already redeemed");
    const result = await db.prepare(
      `INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount, used_at)
         VALUES (?, ?, ?, 0, NOW()) RETURNING id`
    ).get(coupon.id, user_id, order_id);
    await db.prepare("UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?").run(coupon.id);
    sendSuccess(res, result, "Coupon redeemed");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/messages.ts
init_shared();
import { Router as Router9 } from "express";
import { z as zod2 } from "zod";
var messagesRouter = Router9();
var sendMessageSchema = zod2.object({
  receiver_id: zod2.number().int().positive(),
  body: zod2.string().trim().min(1).max(4e3),
  // Optional context — links the message to a product, store, or order
  // so the inbox can group by topic.
  store_id: zod2.number().int().positive().optional(),
  product_id: zod2.number().int().positive().optional(),
  order_id: zod2.number().int().positive().optional(),
  attachments: zod2.array(zod2.string().url().max(500)).max(10).optional()
});
var conversationQuerySchema = zod2.object({
  peer_id: zod2.coerce.number().int().positive(),
  limit: zod2.coerce.number().int().min(1).max(100).default(50),
  before_id: zod2.coerce.number().int().positive().optional()
  // for pagination
});
var messageIdParamSchema = zod2.object({
  id: zod2.coerce.number().int().positive()
});
messagesRouter.post("/", requireAuth, async (req, res) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "Invalid input: " + parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "),
        400
      );
    }
    const input = parsed.data;
    if (input.receiver_id === req.user.id) {
      return sendError(res, "Cannot send a message to yourself", 400);
    }
    const receiver = await db.prepare("SELECT id, status FROM users WHERE id = ? AND deleted_at IS NULL").get(input.receiver_id);
    if (!receiver) return sendError(res, "Receiver not found", 404);
    if (receiver.status === "banned" || receiver.status === "suspended") {
      return sendError(res, "Receiver is not accepting messages", 403);
    }
    if (input.product_id) {
      const product = await db.prepare(
        "SELECT id FROM products WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL"
      ).get(input.product_id);
      if (!product) return sendError(res, "Product not found or inactive", 404);
    }
    if (input.store_id) {
      const store = await db.prepare("SELECT id FROM stores WHERE id = ? AND is_active = TRUE").get(input.store_id);
      if (!store) return sendError(res, "Store not found or inactive", 404);
    }
    if (input.order_id) {
      const order = await db.prepare("SELECT customer_id FROM orders WHERE id = ?").get(input.order_id);
      if (!order) return sendError(res, "Order not found", 404);
      if (req.user.role !== "admin" && order.customer_id !== req.user.id) {
        return sendError(res, "Cannot attach message to another user's order", 403);
      }
    }
    const result = await db.prepare(
      `INSERT INTO messages (sender_id, receiver_id, store_id, product_id, order_id, body, attachments, is_read, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, FALSE, NOW())
				 RETURNING id, created_at`
    ).get(
      req.user.id,
      input.receiver_id,
      input.store_id ?? null,
      input.product_id ?? null,
      input.order_id ?? null,
      input.body,
      JSON.stringify(input.attachments ?? [])
    );
    sendSuccess(res, { id: result.id, created_at: result.created_at }, "Message sent");
  } catch (err) {
    return sendError(res, err);
  }
});
messagesRouter.get("/inbox", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const beforeId = req.query.before_id ? Number(req.query.before_id) : null;
    const onlyUnread = req.query.unread === "1" || req.query.unread === "true";
    const params = [req.user.id];
    let where = `receiver_id = ?`;
    if (onlyUnread) where += ` AND is_read = FALSE`;
    if (beforeId) {
      where += ` AND id < ?`;
      params.push(beforeId);
    }
    params.push(limit + 1);
    const rows = await db.prepare(
      `SELECT m.id, m.sender_id, m.receiver_id, m.store_id, m.product_id, m.order_id,
				        m.body, m.attachments, m.is_read, m.read_at, m.created_at,
				        u.email AS sender_email, u.full_name AS sender_name
				 FROM messages m
				 JOIN users u ON u.id = m.sender_id
				 WHERE ${where}
				 ORDER BY m.id DESC
				 LIMIT ?`
    ).all(...params);
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      ...r,
      attachments: typeof r.attachments === "string" ? JSON.parse(r.attachments) : r.attachments
    }));
    const unread = await db.prepare(
      "SELECT COUNT(*)::int AS c FROM messages WHERE receiver_id = ? AND is_read = FALSE"
    ).get(req.user.id);
    sendSuccess(res, {
      items,
      next_cursor: hasMore ? items[items.length - 1].id : null,
      unread_count: unread.c
    });
  } catch (err) {
    return sendError(res, err);
  }
});
messagesRouter.get("/sent", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const beforeId = req.query.before_id ? Number(req.query.before_id) : null;
    const params = [req.user.id];
    let where = `sender_id = ?`;
    if (beforeId) {
      where += ` AND id < ?`;
      params.push(beforeId);
    }
    params.push(limit + 1);
    const rows = await db.prepare(
      `SELECT m.id, m.sender_id, m.receiver_id, m.store_id, m.product_id, m.order_id,
				        m.body, m.attachments, m.is_read, m.read_at, m.created_at,
				        u.email AS receiver_email, u.full_name AS receiver_name
				 FROM messages m
				 JOIN users u ON u.id = m.receiver_id
				 WHERE ${where}
				 ORDER BY m.id DESC
				 LIMIT ?`
    ).all(...params);
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      ...r,
      attachments: typeof r.attachments === "string" ? JSON.parse(r.attachments) : r.attachments
    }));
    sendSuccess(res, {
      items,
      next_cursor: hasMore ? items[items.length - 1].id : null
    });
  } catch (err) {
    return sendError(res, err);
  }
});
messagesRouter.get("/conversation", requireAuth, async (req, res) => {
  try {
    const parsed = conversationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        res,
        "Invalid query: " + parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "),
        400
      );
    }
    const { peer_id, limit, before_id } = parsed.data;
    if (peer_id === req.user.id) {
      return sendError(res, "Cannot have a conversation with yourself", 400);
    }
    const params = [req.user.id, peer_id, peer_id, req.user.id];
    let extra = "";
    if (before_id) {
      extra = " AND m.id < ?";
      params.push(before_id);
    }
    params.push(limit + 1);
    const rows = await db.prepare(
      `SELECT m.id, m.sender_id, m.receiver_id, m.store_id, m.product_id, m.order_id,
				        m.body, m.attachments, m.is_read, m.read_at, m.created_at
				 FROM messages m
				 WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))${extra}
				 ORDER BY m.id ASC
				 LIMIT ?`
    ).all(...params);
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      ...r,
      attachments: typeof r.attachments === "string" ? JSON.parse(r.attachments) : r.attachments
    }));
    try {
      await db.prepare(
        `UPDATE messages SET is_read = TRUE, read_at = NOW()
					 WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE`
      ).run(peer_id, req.user.id);
    } catch (markErr) {
      console.error("[messages] mark-read failed:", markErr);
    }
    sendSuccess(res, {
      items,
      next_cursor: hasMore ? items[0]?.id : null,
      // for ASC pagination, cursor is the oldest id loaded
      has_more: hasMore
    });
  } catch (err) {
    return sendError(res, err);
  }
});
messagesRouter.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const row = await db.prepare(
      "SELECT COUNT(*)::int AS c FROM messages WHERE receiver_id = ? AND is_read = FALSE"
    ).get(req.user.id);
    sendSuccess(res, { unread_count: row.c });
  } catch (err) {
    return sendError(res, err);
  }
});
messagesRouter.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const parsed = messageIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendError(res, "Invalid message id", 400);
    }
    const id = parsed.data.id;
    const updated = await db.prepare(
      `UPDATE messages SET is_read = TRUE, read_at = NOW()
				 WHERE id = ? AND receiver_id = ? AND is_read = FALSE
				 RETURNING id, read_at`
    ).get(id, req.user.id);
    if (!updated) {
      const exists = await db.prepare("SELECT id FROM messages WHERE id = ?").get(id);
      if (!exists) return sendError(res, "Message not found", 404);
      return sendSuccess(res, { id, read_at: null, already_read: true }, "Already read");
    }
    sendSuccess(res, updated, "Marked as read");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/notifications.ts
init_shared();
import { Router as Router10 } from "express";
var notificationsRouter = Router10();
notificationsRouter.get("/:userId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await db.prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).all(userId);
    sendSuccess(res, items);
  } catch (err) {
    return sendError(res, err);
  }
});
notificationsRouter.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const v = validate(notificationIdParamSchema, req.params);
    if (!v.ok) return sendError(res, "Invalid notification id: " + v.error, 400);
    const notificationId = v.data.id;
    const userId = req.user.id;
    const updated = await db.prepare(
      `UPDATE notifications
            SET is_read = TRUE,
                read_at  = COALESCE(read_at, NOW())
          WHERE id = $1 AND user_id = $2
          RETURNING id, user_id, type, title, body, data, is_read, read_at, created_at`
    ).get(notificationId, userId);
    if (!updated) return sendError(res, "Notification not found", 404);
    return sendSuccess(res, updated, "Notification marked as read");
  } catch (err) {
    return sendError(res, err);
  }
});
notificationsRouter.get(
  "/unread-count/:userId",
  requireAuth,
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        return sendError(res, "Invalid user id", 400);
      }
      if (req.user.id !== userId && req.user.role !== "admin") {
        return sendError(res, "Forbidden", 403, "FORBIDDEN");
      }
      const row = await db.prepare(
        "SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE"
      ).get(userId);
      return sendSuccess(res, { user_id: userId, unread: row?.c ?? 0 });
    } catch (err) {
      return sendError(res, err);
    }
  }
);

// server/routes/orders.ts
init_error_codes();
import { randomUUID as randomUUID2 } from "crypto";
import { Router as Router11 } from "express";

// server/lib/settings.ts
init_shared();
var CACHE_TTL_MS = 6e4;
var FALLBACK = Object.freeze({
  DEFAULT_CURRENCY: "YER",
  FREE_SHIPPING_THRESHOLD: "10000",
  FLAT_SHIPPING_COST: "500"
});
var cache = /* @__PURE__ */ new Map();
async function getSetting(key) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.loadedAt < CACHE_TTL_MS) {
    return hit.value;
  }
  try {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
    const value = row?.value ?? FALLBACK[key] ?? "";
    cache.set(key, { value, loadedAt: now });
    return value;
  } catch (err) {
    const fallback = FALLBACK[key] ?? hit?.value ?? "";
    if (!hit) {
      cache.set(key, { value: fallback, loadedAt: now });
    }
    const { log: log2 } = await Promise.resolve().then(() => (init_shared(), shared_exports));
    log2.warn({
      msg: "app_settings_db_error",
      key,
      error: err.message
    });
    return fallback;
  }
}

// server/routes/orders.ts
init_shared();
var ordersRouter = Router11();
ordersRouter.get("/", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const requestedCustomerId = req.query.customerId ? Number(req.query.customerId) : null;
    let sql = `SELECT o.*, s.store_name as store_name, s.logo as store_logo
               FROM orders o
               LEFT JOIN stores s ON o.store_id = s.id
               WHERE 1=1`;
    const params = [];
    if (isAdmin && requestedCustomerId && Number.isInteger(requestedCustomerId)) {
      sql += " AND o.customer_id = ?";
      params.push(requestedCustomerId);
    } else {
      sql += " AND o.customer_id = ?";
      params.push(req.user.id);
    }
    sql += " ORDER BY o.created_at DESC";
    const orders = await db.prepare(sql).all(...params);
    sendSuccess(res, orders);
  } catch (err) {
    return sendError(res, err);
  }
});
ordersRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const order = await db.prepare(
      `SELECT o.*, s.store_name as store_name, s.logo as store_logo
         FROM orders o
         LEFT JOIN stores s ON o.store_id = s.id
         WHERE o.id = ?`
    ).get(orderId);
    if (!order) {
      return sendError(res, "Order not found", 404);
    }
    if (req.user.role !== "admin" && order.customer_id !== req.user.id) {
      return sendError(res, "Forbidden", 403);
    }
    const items = await db.prepare(
      `SELECT oi.*, p.name_en as product_name, p.name_ar as product_name_ar, p.main_image as product_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
    ).all(orderId);
    sendSuccess(res, { ...order, items });
  } catch (err) {
    return sendError(res, err);
  }
});
ordersRouter.post("/", requireAuth, async (req, res) => {
  try {
    const v = validate(orderSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const {
      storeId: _ignoredStoreId,
      items,
      shippingAddress,
      paymentMethod,
      notes,
      couponCode
    } = v.data;
    const customerId = req.user.id;
    const productIds = items.map((i) => i.productId);
    const productRows = await db.prepare(
      `SELECT id, store_id, is_active, deleted_at, price, currency, stock, name_en, name_ar
				   FROM products
				  WHERE id = ANY(?)
				  ORDER BY id`
    ).all(productIds);
    const storeResult = resolveOrderStoreId(productIds, productRows);
    if (!storeResult.ok) {
      if (storeResult.code === "PRODUCT_UNAVAILABLE") {
        return sendError(
          res,
          `Product ${storeResult.productId} is unavailable`,
          400,
          "PRODUCT_UNAVAILABLE"
        );
      }
      if (storeResult.code === "MIXED_STORES") {
        return sendError(
          res,
          "All items in an order must come from a single store. Split the cart and try again.",
          400,
          "MIXED_STORES"
        );
      }
      return sendError(res, "No products to order.", 400, "EMPTY_CART");
    }
    const resolvedStoreId = storeResult.storeId;
    const productById = /* @__PURE__ */ new Map();
    for (const p of productRows) {
      productById.set(p.id, {
        price: Number(p.price),
        currency: p.currency,
        stock: p.stock,
        name_ar: p.name_ar,
        name_en: p.name_en
      });
    }
    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        return sendError(
          res,
          `Product ${item.productId} is unavailable`,
          400,
          "PRODUCT_UNAVAILABLE"
        );
      }
      if (product.stock < item.quantity) {
        return sendError(
          res,
          `Product ${item.productId} has insufficient stock (requested ${item.quantity}, available ${product.stock})`,
          400,
          "OUT_OF_STOCK"
        );
      }
    }
    const normalisedPaymentMethod = paymentMethod === "cash" || !paymentMethod ? "cod" : paymentMethod;
    const [defaultCurrencyRaw, freeShipRaw, flatShipRaw] = await Promise.all([
      getSetting("DEFAULT_CURRENCY"),
      getSetting("FREE_SHIPPING_THRESHOLD"),
      getSetting("FLAT_SHIPPING_COST")
    ]);
    const FREE_SHIPPING_THRESHOLD = Number.parseInt(freeShipRaw, 10) || 1e4;
    const FLAT_SHIPPING_COST = Number.parseInt(flatShipRaw, 10) || 500;
    const DEFAULT_CURRENCY = defaultCurrencyRaw || "YER";
    let resolvedSubtotal = 0;
    for (const item of items) {
      const product = productById.get(item.productId);
      resolvedSubtotal += product.price * item.quantity;
    }
    resolvedSubtotal = Math.round(resolvedSubtotal * 100) / 100;
    const resolvedShippingCost = resolvedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
    let resolvedDiscount = 0;
    const resolvedCouponCode = couponCode ? String(couponCode) : null;
    if (resolvedCouponCode && resolvedSubtotal <= 0) {
      return sendError(res, "Cannot apply a coupon without a positive subtotal.", 400);
    }
    const {
      id: orderId,
      orderNumber,
      finalDiscount,
      finalTotal
    } = await db.tx(async (txDb) => {
      if (resolvedCouponCode) {
        const coupon = await txDb.prepare(
          `SELECT ${COUPON_COLUMNS}
                             FROM coupons
                            WHERE code = ? AND is_active = TRUE
                            FOR UPDATE`
        ).get(resolvedCouponCode);
        if (!coupon) {
          throw new Error("Coupon not found or inactive.");
        }
        if (coupon.expires_at && new Date(coupon.expires_at) < /* @__PURE__ */ new Date()) {
          throw new Error("Coupon has expired.");
        }
        if (coupon.starts_at && new Date(coupon.starts_at) > /* @__PURE__ */ new Date()) {
          throw new Error("Coupon is not yet active.");
        }
        if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
          throw new Error("Coupon usage limit reached.");
        }
        if (coupon.min_order != null && resolvedSubtotal < coupon.min_order) {
          throw new Error(
            `Minimum order for this coupon is ${coupon.min_order.toLocaleString()}.`
          );
        }
        resolvedDiscount = await computeCouponDiscount(coupon, resolvedSubtotal);
      }
      const finalDiscount2 = Math.round(resolvedDiscount * 100) / 100;
      const finalTotal2 = Math.max(
        0,
        Math.round((resolvedSubtotal + resolvedShippingCost - finalDiscount2) * 100) / 100
      );
      const orderNumber2 = `ORD-${randomUUID2().slice(0, 8).toUpperCase()}`;
      const result = await txDb.prepare(
        `INSERT INTO orders
			        (customer_id, store_id, order_number, status, payment_method,
			         payment_status, subtotal, shipping_cost, discount,
			         coupon_code, discount_amount, total, currency,
			         shipping_address, notes)
			       VALUES (?, ?, ?, 'pending', ?, 'pending',
			               ?, ?, ?, ?, ?, ?, ?,
			               ?, ?)
			       RETURNING id`
      ).run(
        customerId,
        resolvedStoreId,
        orderNumber2,
        normalisedPaymentMethod,
        resolvedSubtotal,
        resolvedShippingCost,
        finalDiscount2,
        resolvedCouponCode,
        finalDiscount2,
        finalTotal2,
        DEFAULT_CURRENCY,
        JSON.stringify(shippingAddress),
        notes || null
      );
      if (result.lastInsertRowid == null) {
        throw new HttpError(500, "Failed to create order", { code: ErrorCodes.INSERT_FAILED });
      }
      const newOrderId = result.lastInsertRowid;
      const productIds2 = items.map((i) => i.productId);
      const productRows2 = await txDb.prepare(
        `SELECT id, name_ar, name_en, price, currency, stock
						 FROM products
						WHERE id = ANY($1) AND is_active = TRUE AND deleted_at IS NULL
						FOR UPDATE`
      ).all(productIds2);
      const productById2 = /* @__PURE__ */ new Map();
      for (const p of productRows2) {
        productById2.set(p.id, {
          name_ar: p.name_ar,
          name_en: p.name_en,
          price: Number(p.price),
          currency: p.currency,
          stock: p.stock
        });
      }
      const insertItem = txDb.prepare(
        `INSERT INTO order_items
			        (order_id, product_id, variant_id, product_name, quantity,
			         unit_price, total_price)
			       VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      let serverSubtotal = 0;
      for (const item of items) {
        if (item.quantity <= 0) {
          throw new Error(
            `Invalid quantity ${item.quantity} for product ${item.productId}`
          );
        }
        const product = productById2.get(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} is unavailable`);
        }
        if (product.stock < item.quantity) {
          throw new Error(
            `Product ${item.productId} has insufficient stock (requested ${item.quantity}, available ${product.stock})`
          );
        }
        const unitPrice = product.price;
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
        serverSubtotal += lineTotal;
        await insertItem.run(
          newOrderId,
          item.productId,
          null,
          product.name_en || product.name_ar,
          item.quantity,
          unitPrice,
          lineTotal
        );
      }
      serverSubtotal = Math.round(serverSubtotal * 100) / 100;
      const serverDiscount = Math.round(resolvedDiscount * 100) / 100;
      const serverShippingCost = serverSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
      const serverFinalTotal = Math.max(
        0,
        Math.round((serverSubtotal + serverShippingCost - serverDiscount) * 100) / 100
      );
      await txDb.prepare(
        `UPDATE orders
					    SET subtotal = ?, shipping_cost = ?, discount = ?, total = ?
					  WHERE id = ?`
      ).run(
        serverSubtotal,
        serverShippingCost,
        serverDiscount,
        serverFinalTotal,
        newOrderId
      );
      return {
        id: newOrderId,
        orderNumber: orderNumber2,
        finalDiscount: serverDiscount,
        finalTotal: serverFinalTotal
      };
    });
    sendSuccess(
      res,
      { id: orderId, orderNumber, discount: finalDiscount, total: finalTotal },
      "Order created successfully"
    );
    try {
      const { onOrderPlaced: onOrderPlaced2 } = await Promise.resolve().then(() => (init_events(), events_exports));
      const [storeRow, firstProductRow] = await Promise.all([
        db.prepare("SELECT owner_id, store_name FROM stores WHERE id = ?").get(resolvedStoreId),
        items.length >= 1 ? db.prepare("SELECT name_en, name_ar FROM products WHERE id = $1").get(items[0].productId) : Promise.resolve(void 0)
      ]);
      const merchantId = storeRow?.owner_id;
      const productName = firstProductRow?.name_en ?? firstProductRow?.name_ar ?? (items.length === 1 ? "item" : `${items.length} items`);
      if (merchantId) {
        await onOrderPlaced2({
          orderId,
          customerId,
          merchantId,
          orderNumber,
          total: finalTotal,
          itemCount: items.length,
          paymentMethod: normalisedPaymentMethod,
          trackingUrl: `https://noufex.example.com/orders/${orderId}`,
          productName
        });
      }
    } catch (notifyErr) {
      console.error("[orders] notification dispatch failed:", notifyErr);
    }
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/payments.ts
init_error_codes();
import { Router as Router12 } from "express";

// server/lib/payments/stub.ts
import { randomUUID as randomUUID3 } from "crypto";
var stubProvider = {
  method: "stripe",
  // overridden per-method in the registry
  displayName: "Stub (no real keys configured)",
  isConfigured: false,
  async initiate(input) {
    const transactionId = `stub_${input.method}_${randomUUID3().replace(/-/g, "")}`;
    return {
      accepted: true,
      transactionId,
      redirectUrl: null,
      clientSecret: null,
      message: `Stub ${input.method} charge accepted for order ${input.orderId}. No real payment provider was contacted because the corresponding API keys are not configured. Use /api/payments/{id}/confirm to mark this payment as completed manually.`,
      raw: {
        provider: "stub",
        method: input.method,
        amount: input.amount,
        currency: input.currency,
        stub: true
      }
    };
  },
  async verifyWebhook() {
    return { valid: false, transactionId: null, status: null, raw: { stub: true } };
  }
};

// server/lib/payments/stripe.ts
import { createHmac as createHmac4, timingSafeEqual as timingSafeEqual5 } from "crypto";
var STRIPE_API = "https://api.stripe.com/v1";
function isLive() {
  return !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_");
}
async function stripeFetch(path2, body) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) params.append(k, v);
  const res = await fetch(`${STRIPE_API}${path2}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${path2} ${res.status}: ${text}`);
  }
  return res.json();
}
var stripeProvider = {
  method: "stripe",
  displayName: "Stripe",
  isConfigured: isLive(),
  async initiate(input) {
    if (!isLive()) {
      throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
    }
    const amountMinor = Math.round(input.amount * 100);
    const session = await stripeFetch("/checkout/sessions", {
      "payment_method_types[0]": "card",
      mode: "payment",
      success_url: `${process.env.PUBLIC_BASE_URL || "http://localhost:3000"}/checkout/success?order=${input.orderId}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL || "http://localhost:3000"}/checkout/cancel?order=${input.orderId}`,
      client_reference_id: String(input.orderId),
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(amountMinor),
      "line_items[0][price_data][product_data][name]": input.description.slice(0, 120),
      "metadata[order_id]": String(input.orderId),
      "metadata[user_id]": String(input.userId)
    });
    return {
      accepted: true,
      transactionId: session.id,
      redirectUrl: session.url,
      clientSecret: null,
      message: "Stripe Checkout Session created",
      raw: { provider: "stripe", session_id: session.id }
    };
  },
  async verifyWebhook(headers, rawBody) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sigHeader = headers["stripe-signature"];
    if (!secret || !sigHeader)
      return { valid: false, transactionId: null, status: null, raw: {} };
    const parts = sigHeader.split(",").reduce((acc, p) => {
      const [k, v] = p.split("=");
      acc[k] = v;
      return acc;
    }, {});
    const ts = parts["t"];
    const sig = parts["v1"];
    if (!ts || !sig) return { valid: false, transactionId: null, status: null, raw: {} };
    const expected = createHmac4("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual5(a, b)) {
      return { valid: false, transactionId: null, status: null, raw: {} };
    }
    const evt = JSON.parse(rawBody);
    const obj = evt.data?.object;
    const id = obj?.id ?? null;
    let status = null;
    if (evt.type === "checkout.session.completed" || evt.type === "payment_intent.succeeded") {
      status = "completed";
    } else if (evt.type?.endsWith(".payment_failed")) {
      status = "failed";
    } else if (evt.type === "charge.refunded") {
      status = "refunded";
    }
    return { valid: true, transactionId: id, status, raw: evt };
  }
};

// server/lib/payments/paymob.ts
import { createHmac as createHmac5, timingSafeEqual as timingSafeEqual6 } from "crypto";
var PAYMOB_API = "https://accept.paymob.com/api";
var cached = null;
function isLive2() {
  return !!process.env.PAYMOB_API_KEY && !!process.env.PAYMOB_INTEGRATION_ID;
}
async function authToken() {
  if (cached && cached.expiresAt > Date.now() + 3e4) return cached.token;
  const res = await fetch(`${PAYMOB_API}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY })
  });
  if (!res.ok) throw new Error(`Paymob auth ${res.status}`);
  const j = await res.json();
  cached = { token: j.token, expiresAt: Date.now() + 55 * 60 * 1e3 };
  return j.token;
}
var paymobProvider = {
  method: "paymob",
  displayName: "Paymob",
  isConfigured: isLive2(),
  async initiate(input) {
    if (!isLive2()) throw new Error("Paymob is not configured (PAYMOB_API_KEY missing)");
    const token = await authToken();
    const amountMinor = Math.round(input.amount * 100);
    const order = await fetch(`${PAYMOB_API}/ecommerce/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: false,
        amount_cents: amountMinor,
        currency: input.currency,
        merchant_order_id: String(input.orderId)
      })
    }).then((r) => r.json());
    const paymentKey = await fetch(`${PAYMOB_API}/acceptance/payment_keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: amountMinor,
        expiration: 3600,
        order_id: order.id,
        billing_data: {
          apartment: "NA",
          email: "customer@nouf-ex.local",
          floor: "NA",
          first_name: "Customer",
          last_name: String(input.userId),
          phone_number: "+967700000000",
          city: "Sanaa",
          country: "YE",
          state: "NA",
          street: "NA"
        },
        currency: input.currency,
        integration_id: Number(process.env.PAYMOB_INTEGRATION_ID)
      })
    }).then((r) => r.json());
    const iframeId = process.env.PAYMOB_IFRAME_ID || "631568";
    return {
      accepted: true,
      transactionId: String(order.id),
      redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey.token}`,
      clientSecret: paymentKey.token,
      message: "Paymob payment key issued",
      raw: { provider: "paymob", paymob_order_id: order.id }
    };
  },
  async verifyWebhook(headers, rawBody) {
    const secret = process.env.PAYMOB_HMAC_SECRET;
    if (!secret) return { valid: false, transactionId: null, status: null, raw: {} };
    const params = new URLSearchParams(rawBody);
    const fields = [
      "amount_cents",
      "created_at",
      "currency",
      "error_occured",
      "has_parent_transaction",
      "id",
      "integration_id",
      "is_3d_secure",
      "is_auth",
      "is_capture",
      "is_refunded",
      "is_standalone_payment",
      "is_voided",
      "order",
      "owner",
      "pending",
      " Source_data_pan",
      " Source_data_sub_type",
      " Source_data_type",
      "success"
    ];
    const concat = fields.map((f) => params.get(f) ?? "").join("");
    const expected = createHmac5("sha512", secret).update(concat).digest("hex");
    const got = headers["hmac"] ?? "";
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(got, "hex");
    if (a.length !== b.length || !timingSafeEqual6(a, b)) {
      return { valid: false, transactionId: null, status: null, raw: {} };
    }
    const txnId = params.get("id");
    const success = params.get("success") === "true";
    const status = success ? "completed" : "failed";
    return {
      valid: true,
      transactionId: txnId,
      status,
      raw: Object.fromEntries(params.entries())
    };
  }
};

// server/lib/payments/registry.ts
var REGISTRY = {
  // Real providers — only active when env keys are configured.
  stripe: stripeProvider,
  paymob: paymobProvider,
  // Offline / cash methods — never go through a network provider.
  // They are handled directly by the payments route (record + wait
  // for admin confirmation).
  cod: null,
  card: null,
  wallet: null,
  bank_transfer: null
};
function selectProvider(method) {
  if (method === "cod" || method === "card" || method === "wallet" || method === "bank_transfer") {
    return null;
  }
  const provider = REGISTRY[method];
  if (provider && provider.isConfigured) return provider;
  return stubProvider;
}
function hasProvider(method) {
  return method === "stripe" || method === "paymob";
}
function listProviders() {
  return ["stripe", "paymob"].map((m) => ({
    method: m,
    displayName: REGISTRY[m].displayName,
    live: REGISTRY[m].isConfigured
  }));
}

// server/routes/payments.ts
init_shared();
var paymentsRouter = Router12();
var webhookLimiter = rateLimit(6e4, 120, "webhook");
paymentsRouter.get("/methods", (_req, res) => {
  try {
    sendSuccess(res, listProviders());
  } catch (err) {
    return sendError(res, err);
  }
});
paymentsRouter.post("/webhook/:method", webhookLimiter, async (req, res) => {
  try {
    const method = req.params.method;
    const provider = selectProvider(method);
    if (!provider) return sendError(res, `No provider for method ${method}`, 400);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers[k.toLowerCase()] = v;
    }
    const raw = req.rawBody ?? "";
    const verification = await provider.verifyWebhook(headers, raw);
    if (!verification.valid || !verification.status || !verification.transactionId) {
      return sendError(res, "Webhook signature rejected", 400);
    }
    const eventId = verification.eventId ?? verification.transactionId;
    const eventType = verification.status;
    const claimed = await db.prepare(
      `INSERT INTO webhook_events
                    (provider, event_id, transaction_id, event_type, payload)
                 VALUES ($1, $2, $3, $4, $5::jsonb)
                 ON CONFLICT (provider, event_id, transaction_id, event_type)
                    DO NOTHING
                 RETURNING id`
    ).get(
      method,
      eventId,
      verification.transactionId,
      eventType,
      JSON.stringify({
        header_count: Object.keys(headers).length,
        body_len: raw.length
      })
    );
    if (!claimed) {
      const existing = await db.prepare(
        `SELECT processing_state, processed_at
                       FROM webhook_events
                      WHERE provider = $1
                        AND event_id  = $2
                        AND transaction_id = $3
                        AND event_type = $4`
      ).get(method, eventId, verification.transactionId, eventType);
      console.info(
        JSON.stringify({
          event: "webhook_duplicate",
          method,
          event_id: eventId,
          txn_id: verification.transactionId,
          processing_state: existing?.processing_state
        })
      );
      return sendSuccess(res, {
        updated: true,
        idempotent: true,
        duplicate: true,
        first_processed_at: existing?.processed_at ?? null
      });
    }
    await db.tx(async (txDb) => {
      const upd = await txDb.prepare(
        `UPDATE payments
                            SET status    = $1,
                                updated_at = NOW()
                          WHERE provider_txn_id = $2
                          RETURNING id`
      ).get(verification.status, verification.transactionId);
      await txDb.prepare(
        `UPDATE webhook_events
                            SET processing_state = 'processed',
                                processed_at      = NOW()
                          WHERE id = $1`
      ).run(claimed.id);
      if (!upd) {
        console.warn(
          JSON.stringify({
            event: "webhook_no_local_payment",
            method,
            txn_id: verification.transactionId
          })
        );
      }
    });
    sendSuccess(res, {
      updated: true,
      idempotent: true,
      duplicate: false,
      status: verification.status
    });
  } catch (err) {
    return sendError(res, err);
  }
});
paymentsRouter.post("/", authLimiter, requireAuth, async (req, res) => {
  try {
    const v = validate(paymentCreateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const { order_id, amount, currency, method, transaction_id } = v.data;
    const order = await db.prepare("SELECT id, customer_id, total, status FROM orders WHERE id = ?").get(order_id);
    if (!order) return sendError(res, "Order not found", 404);
    if (req.user.role !== "admin" && order.customer_id !== req.user.id) {
      return sendError(res, "Forbidden", 403);
    }
    const existing = await db.prepare("SELECT id, status FROM payments WHERE order_id = ? AND method = ?").get(order_id, method);
    if (existing) {
      return sendSuccess(res, { id: existing.id, status: existing.status, idempotent: true });
    }
    let txnId = transaction_id ?? null;
    let providerMeta = null;
    let initialStatus;
    let redirectUrl = null;
    let clientSecret = null;
    if (hasProvider(method)) {
      const provider = selectProvider(method);
      const result2 = await provider.initiate({
        orderId: order_id,
        userId: order.customer_id,
        amount,
        currency,
        method,
        description: `Nouf-ex order #${order_id}`
      });
      if (!result2.accepted) {
        return sendError(res, `Provider rejected: ${result2.message}`, 402);
      }
      txnId = result2.transactionId;
      providerMeta = result2.raw;
      redirectUrl = result2.redirectUrl;
      clientSecret = result2.clientSecret;
      initialStatus = "processing";
    } else if (method === "cod") {
      initialStatus = "pending";
    } else {
      initialStatus = "pending";
    }
    const result = await db.prepare(
      `INSERT INTO payments (order_id, user_id, amount, currency, method, status, provider_txn_id, provider_meta, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, NOW(), NOW())
         RETURNING id`
    ).run(
      order_id,
      order.customer_id,
      amount,
      currency,
      method,
      initialStatus,
      txnId,
      providerMeta ? JSON.stringify(providerMeta) : "{}"
    );
    if (result.lastInsertRowid == null) {
      return sendError(res, "Failed to record payment", 500, ErrorCodes.INSERT_FAILED);
    }
    const newPaymentId = result.lastInsertRowid;
    if (initialStatus === "processing" && method !== "cod" && hasProvider(method)) {
      const provider = selectProvider(method);
      if (provider.isConfigured) {
      } else {
        await db.prepare(
          `UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`
        ).run(order_id);
      }
    }
    sendSuccess(
      res,
      {
        id: newPaymentId,
        status: initialStatus,
        transaction_id: txnId,
        redirect_url: redirectUrl,
        client_secret: clientSecret
      },
      "Payment recorded"
    );
  } catch (err) {
    return sendError(res, err);
  }
});
paymentsRouter.get("/order/:orderId", requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return sendError(res, "Invalid order id", 400);
    }
    const order = await db.prepare("SELECT customer_id FROM orders WHERE id = ?").get(orderId);
    if (!order) return sendError(res, "Order not found", 404);
    if (req.user.role !== "admin" && order.customer_id !== req.user.id) {
      return sendError(res, "Forbidden", 403);
    }
    const payments = await db.prepare(
      `SELECT id, order_id, amount, currency, status, method,
				        reference, created_at, updated_at
				 FROM payments
				 WHERE order_id = ?
				 ORDER BY created_at DESC`
    ).all(orderId);
    sendSuccess(res, payments);
  } catch (err) {
    return sendError(res, err);
  }
});
paymentsRouter.post("/:id/confirm", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendError(res, "Invalid payment id", 400);
    const payment = await db.prepare("SELECT order_id FROM payments WHERE id = ?").get(id);
    if (!payment) return sendError(res, "Payment not found", 404);
    const order = await db.prepare("SELECT customer_id FROM orders WHERE id = ?").get(payment.order_id);
    if (!order) return sendError(res, "Order not found", 404);
    if (req.user.role !== "admin") {
      return sendError(res, "Forbidden", 403);
    }
    const result = await db.prepare(
      `UPDATE payments SET status = 'completed', paid_at = NOW(), updated_at = NOW()
          WHERE id = ? RETURNING order_id, amount`
    ).get(id);
    await db.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`).run(result.order_id);
    try {
      const { onPaymentConfirmed: onPaymentConfirmed2 } = await Promise.resolve().then(() => (init_events(), events_exports));
      const orderRow = await db.prepare("SELECT order_number, customer_id FROM orders WHERE id = ?").get(result.order_id);
      if (orderRow) {
        await onPaymentConfirmed2({
          orderId: result.order_id,
          customerId: orderRow.customer_id,
          orderNumber: orderRow.order_number,
          amount: Number(result.amount)
        });
      }
    } catch (notifyErr) {
      console.error("[payments] notification dispatch failed:", notifyErr);
    }
    sendSuccess(res, { order_id: result.order_id }, "Payment confirmed");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/refunds.ts
init_shared();
import { Router as Router13 } from "express";
var refundsRouter = Router13();
refundsRouter.post("/", requireAuth, async (req, res) => {
  try {
    const v = validate(refundCreateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const { order_id, amount, reason } = v.data;
    const userId = req.user.id;
    const order = await db.prepare("SELECT id, customer_id, total, payment_status FROM orders WHERE id = ?").get(order_id);
    if (!order) return sendError(res, "Order not found", 404);
    if (order.customer_id !== userId) return sendError(res, "Forbidden", 403);
    if (order.payment_status !== "paid") {
      return sendError(res, "Only paid orders are eligible for refund", 400);
    }
    if (amount > order.total) {
      return sendError(res, "Refund amount exceeds order total", 400);
    }
    const result = await db.prepare(
      `INSERT INTO refunds (order_id, user_id, amount, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'requested', NOW(), NOW()) RETURNING id`
    ).get(order_id, userId, amount, reason);
    try {
      const { onRefundRequested: onRefundRequested2 } = await Promise.resolve().then(() => (init_events(), events_exports));
      const orderRow = await db.prepare("SELECT order_number, customer_id, store_id FROM orders WHERE id = ?").get(order_id);
      if (orderRow) {
        const storeRow = orderRow.store_id ? await db.prepare("SELECT owner_id FROM stores WHERE id = ?").get(orderRow.store_id) : void 0;
        if (storeRow) {
          await onRefundRequested2({
            orderId: order_id,
            orderNumber: orderRow.order_number,
            customerId: orderRow.customer_id,
            merchantId: storeRow.owner_id,
            amount
          });
        }
      }
    } catch (notifyErr) {
      console.error("[refunds] notification dispatch failed:", notifyErr);
    }
    sendSuccess(res, result, "Refund requested");
  } catch (err) {
    return sendError(res, err);
  }
});
refundsRouter.post(
  "/:id/resolve",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return sendError(res, "Invalid id", 400);
      const status = req.body?.status || "";
      if (status !== "approved" && status !== "rejected") {
        return sendError(res, "status must be approved or rejected", 400);
      }
      const adminNotes = req.body?.admin_notes ?? null;
      const finalStatus = status === "approved" ? "processed" : "rejected";
      const result = await db.prepare(
        `UPDATE refunds
            SET status = ?, admin_notes = ?, resolved_at = NOW(), updated_at = NOW()
          WHERE id = ? AND status IN ('requested', 'approved')
          RETURNING order_id, amount`
      ).get(finalStatus, adminNotes, id);
      if (!result) return sendError(res, "Refund not found or already resolved", 404);
      if (finalStatus === "processed") {
        await db.prepare(
          `UPDATE payments SET status = 'refunded', updated_at = NOW()
            WHERE order_id = ? AND status = 'completed'`
        ).run(result.order_id);
        const order = await db.prepare("SELECT store_id FROM orders WHERE id = ?").get(result.order_id);
        if (order?.store_id) {
          await db.prepare(
            `INSERT INTO transactions (store_id, type, amount, balance_after, reference_type, reference_id, description, created_at)
             VALUES (?, 'refund', ?, 0, 'refund', ?, ?, NOW())`
          ).run(
            order.store_id,
            -result.amount,
            id,
            `Refund #${id} for order ${result.order_id}`
          );
        }
      }
      try {
        const { onRefundResolved: onRefundResolved2 } = await Promise.resolve().then(() => (init_events(), events_exports));
        const orderRow = await db.prepare("SELECT order_number, customer_id FROM orders WHERE id = ?").get(result.order_id);
        if (orderRow) {
          await onRefundResolved2({
            orderId: result.order_id,
            orderNumber: orderRow.order_number,
            customerId: orderRow.customer_id,
            amount: result.amount,
            status: finalStatus === "processed" ? "approved" : "rejected",
            reason: adminNotes ?? void 0
          });
        }
      } catch (notifyErr) {
        console.error("[refunds] resolve notification failed:", notifyErr);
      }
      sendSuccess(res, { id, status: finalStatus }, "Refund resolved");
    } catch (err) {
      return sendError(res, err);
    }
  }
);

// server/routes/reviews.ts
init_error_codes();
init_shared();
import { Router as Router14 } from "express";
var reviewsRouter = Router14();
reviewsRouter.get("/", async (req, res) => {
  try {
    const { productId, storeId } = req.query;
    let sql = `SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar,
                      p.name_en as product_name, s.store_name as store_name
               FROM reviews r
               LEFT JOIN users u ON r.customer_id = u.id
               LEFT JOIN products p ON r.product_id = p.id
               LEFT JOIN stores s ON r.store_id = s.id
               WHERE r.is_visible = TRUE`;
    const params = [];
    if (productId) {
      sql += " AND r.product_id = ?";
      params.push(Number(productId));
    }
    if (storeId) {
      sql += " AND r.store_id = ?";
      params.push(Number(storeId));
    }
    sql += " ORDER BY r.created_at DESC";
    const reviews = await db.prepare(sql).all(...params);
    sendSuccess(res, reviews);
  } catch (err) {
    return sendError(res, err);
  }
});
reviewsRouter.post("/", requireAuth, async (req, res) => {
  try {
    const v = validate(reviewSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const { productId, storeId, rating, title, comment } = v.data;
    const customerId = req.user.id;
    const purchased = await db.prepare(
      `SELECT 1 AS found FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
            WHERE o.customer_id = ? AND oi.product_id = ?
            LIMIT 1`
    ).get(customerId, productId);
    const isVerified = Boolean(purchased);
    const productRow = await db.prepare("SELECT store_id FROM products WHERE id = ? AND deleted_at IS NULL").get(productId);
    if (!productRow) return sendError(res, "Product not found", 404);
    const resolvedStoreId = productRow.store_id;
    if (storeId !== void 0 && storeId !== resolvedStoreId) {
      return sendError(res, "storeId does not match product", 400, "STORE_MISMATCH");
    }
    const result = await db.prepare(
      `INSERT INTO reviews (product_id, store_id, customer_id, rating, title, comment, helpful_count, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`
    ).run(
      productId,
      resolvedStoreId,
      customerId,
      rating,
      title ?? null,
      comment ?? null,
      isVerified
    );
    if (result.lastInsertRowid == null) {
      return sendError(res, "Failed to create review", 500, ErrorCodes.INSERT_FAILED);
    }
    const ratingData = await db.prepare(
      "SELECT AVG(rating)::numeric as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ? AND is_visible = TRUE"
    ).get(productId);
    const avg = Number(ratingData.avg_rating) || 0;
    await db.prepare("UPDATE products SET rating = ?, review_count = ? WHERE id = ?").run(avg.toFixed(1), ratingData.count, productId);
    try {
      const { onReviewPosted: onReviewPosted2 } = await Promise.resolve().then(() => (init_events(), events_exports));
      const productInfo = await db.prepare("SELECT name_en, name_ar, store_id FROM products WHERE id = ?").get(productId);
      if (productInfo) {
        const storeRow = await db.prepare("SELECT owner_id FROM stores WHERE id = ?").get(productInfo.store_id);
        if (storeRow) {
          await onReviewPosted2({
            productId,
            productName: productInfo.name_en ?? productInfo.name_ar,
            merchantId: storeRow.owner_id,
            rating,
            comment: comment ?? void 0
          });
        }
      }
    } catch (notifyErr) {
      console.error("[reviews] notification dispatch failed:", notifyErr);
    }
    sendSuccess(res, { id: result.lastInsertRowid }, "Review submitted successfully");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/seller.ts
init_shared();
import { Router as Router15 } from "express";
var sellerRouter = Router15();
var sellerAuth = [requireAuth, requireRole("merchant", "admin")];
async function getMerchantStoreId(req, res) {
  if (res.locals.merchantStoreId != null) return res.locals.merchantStoreId;
  const row = await db.prepare("SELECT id FROM stores WHERE owner_id = $1 LIMIT 1").get(req.user.id);
  const id = row?.id ?? null;
  res.locals.merchantStoreId = id;
  return id;
}
sellerRouter.get("/stores/me", ...sellerAuth, async (req, res) => {
  try {
    const storeId = await getMerchantStoreId(req, res);
    if (storeId == null) return sendError(res, "You do not have a store yet", 404);
    const row = await db.prepare("SELECT * FROM stores WHERE id = $1").get(storeId);
    if (!row) return sendError(res, "Store not found", 404);
    return sendSuccess(res, row);
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.patch("/stores/:id", ...sellerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendError(res, "Invalid id", 400);
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null || myStoreId !== id) {
      return sendError(res, "Store not found", 404);
    }
    const v = validate(sellerStoreUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const updates = v.data;
    const { sql, params } = buildUpdateSet(updates);
    if (!sql) return sendError(res, "No updatable fields supplied", 400);
    params.push(id);
    const updated = await db.prepare(
      `UPDATE stores SET ${sql}, updated_at = NOW()
           WHERE id = $${params.length} RETURNING *`
    ).get(...params);
    if (!updated) return sendError(res, "Store not found", 404);
    await writeAuditLog(req, "store.update", "stores", id, null, updates);
    return sendSuccess(res, updated, "Store updated");
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.post("/products", ...sellerAuth, async (req, res) => {
  try {
    const storeId = await getMerchantStoreId(req, res);
    if (storeId == null) return sendError(res, "You do not have a store yet", 404);
    const v = validate(sellerProductCreateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const data = v.data;
    const result = await db.prepare(
      `INSERT INTO products
             (store_id, category_id, name_ar, name_en, name_zh, slug, sku,
              price, original_price, stock, description, main_image,
              images, features, badges, metadata, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, TRUE, NOW(), NOW())
           RETURNING id`
    ).get(
      storeId,
      data.category_id,
      data.name_ar,
      data.name_en ?? null,
      data.name_zh ?? null,
      data.slug,
      data.sku ?? null,
      data.price,
      data.original_price ?? null,
      data.stock,
      data.description ?? null,
      data.main_image ?? null,
      JSON.stringify(data.images ?? []),
      JSON.stringify(data.features ?? []),
      JSON.stringify(data.badges ?? []),
      JSON.stringify(data.metadata ?? {})
    );
    await writeAuditLog(req, "product.create", "products", result.id, null, data);
    return sendSuccess(res, { id: result.id }, "Product created");
  } catch (err) {
    const pg = err;
    if (pg?.code === "23505") return sendError(res, "Product slug already in use", 409);
    return sendError(res, err);
  }
});
sellerRouter.get("/products", ...sellerAuth, async (req, res) => {
  try {
    const storeId = await getMerchantStoreId(req, res);
    if (storeId == null) return sendError(res, "You do not have a store yet", 404);
    const v = validate(paginationSchema, req.query);
    if (!v.ok) return sendError(res, "Invalid pagination: " + v.error, 400);
    const { limit, offset } = v.data;
    const rows = await db.prepare(
      `SELECT * FROM products
           WHERE store_id = $1 AND deleted_at IS NULL
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`
    ).all(storeId, limit, offset);
    const products = rows.map((r) => getProductWithParsedFields(r));
    return sendSuccess(res, { items: products, limit, offset });
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.get("/products/:id", ...sellerAuth, async (req, res) => {
  try {
    const v = validate(sellerProductIdParamSchema, req.params);
    if (!v.ok) return sendError(res, "Invalid id", 400);
    const id = v.data.id;
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const row = await db.prepare(
      "SELECT * FROM products WHERE id = $1 AND store_id = $2 AND deleted_at IS NULL"
    ).get(id, myStoreId);
    if (!row) return sendError(res, "Product not found", 404);
    return sendSuccess(res, getProductWithParsedFields(row));
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.patch("/products/:id", ...sellerAuth, async (req, res) => {
  try {
    const v = validate(sellerProductIdParamSchema, req.params);
    if (!v.ok) return sendError(res, "Invalid id", 400);
    const id = v.data.id;
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const v2 = validate(sellerProductUpdateSchema, req.body);
    if (!v2.ok) return sendError(res, "Invalid input: " + v2.error, 400);
    const updates = v2.data;
    const { sql, params } = buildUpdateSet(updates);
    if (!sql) return sendError(res, "No updatable fields supplied", 400);
    params.push(id, myStoreId);
    const updated = await db.prepare(
      `UPDATE products SET ${sql}, updated_at = NOW()
           WHERE id = $${params.length - 1} AND store_id = $${params.length} AND deleted_at IS NULL
           RETURNING *`
    ).get(...params);
    if (!updated) return sendError(res, "Product not found", 404);
    await writeAuditLog(req, "product.update", "products", id, null, updates);
    return sendSuccess(res, getProductWithParsedFields(updated), "Product updated");
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.delete("/products/:id", ...sellerAuth, async (req, res) => {
  try {
    const v = validate(sellerProductIdParamSchema, req.params);
    if (!v.ok) return sendError(res, "Invalid id", 400);
    const id = v.data.id;
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const result = await db.prepare(
      `UPDATE products
           SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
         WHERE id = $1 AND store_id = $2 AND deleted_at IS NULL
         RETURNING id`
    ).get(id, myStoreId);
    if (!result) return sendError(res, "Product not found", 404);
    await writeAuditLog(req, "product.delete", "products", id, null, { soft: true });
    return sendSuccess(res, { id: result.id }, "Product deleted");
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.post("/products/:id/images", ...sellerAuth, async (req, res) => {
  try {
    const v = validate(sellerProductIdParamSchema, req.params);
    if (!v.ok) return sendError(res, "Invalid product id", 400);
    const productId = v.data.id;
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const product = await db.prepare(
      "SELECT id FROM products WHERE id = $1 AND store_id = $2 AND deleted_at IS NULL"
    ).get(productId, myStoreId);
    if (!product) return sendError(res, "Product not found", 404);
    const v2 = validate(sellerProductImageAddSchema, req.body);
    if (!v2.ok) return sendError(res, "Invalid input: " + v2.error, 400);
    const data = v2.data;
    const result = await db.prepare(
      `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary, created_at)
           VALUES (?, ?, ?, ?, ?, NOW()) RETURNING id`
    ).get(productId, data.url, data.alt_text ?? null, data.sort_order, data.is_primary);
    await writeAuditLog(req, "product.image.add", "products", productId, null, {
      imageId: result.id
    });
    return sendSuccess(res, { id: result.id }, "Image added");
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.get("/orders", ...sellerAuth, async (req, res) => {
  try {
    const storeId = await getMerchantStoreId(req, res);
    if (storeId == null) return sendError(res, "You do not have a store yet", 404);
    const v = validate(paginationSchema, req.query);
    if (!v.ok) return sendError(res, "Invalid pagination: " + v.error, 400);
    const { limit, offset } = v.data;
    const status = req.query.status ?? null;
    let sql = `SELECT o.*, u.email AS customer_email
             FROM orders o
             JOIN users u ON o.customer_id = u.id
            WHERE o.store_id = $1`;
    const params = [storeId];
    if (status) {
      sql += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }
    sql += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const rows = await db.prepare(sql).all(...params);
    return sendSuccess(res, { items: rows, limit, offset });
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.get("/orders/:id", ...sellerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendError(res, "Invalid id", 400);
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const row = await db.prepare("SELECT * FROM orders WHERE id = $1 AND store_id = $2").get(id, myStoreId);
    if (!row) return sendError(res, "Order not found", 404);
    const items = await db.prepare("SELECT * FROM order_items WHERE order_id = $1").all(id);
    return sendSuccess(res, { ...row, items });
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.post("/orders/:id/status", ...sellerAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendError(res, "Invalid id", 400);
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const order = await db.prepare("SELECT id, status FROM orders WHERE id = $1 AND store_id = $2").get(id, myStoreId);
    if (!order) return sendError(res, "Order not found", 404);
    const v = validate(sellerOrderStatusUpdateSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400);
    const data = v.data;
    const allowed = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: []
    };
    if (!allowed[order.status]?.includes(data.status)) {
      return sendError(
        res,
        `Cannot transition order from '${order.status}' to '${data.status}'`,
        400,
        "INVALID_STATE_TRANSITION"
      );
    }
    const updated = await db.prepare(
      `UPDATE orders
                SET status = $1, updated_at = NOW(),
                    timeline = COALESCE(timeline, '[]'::jsonb) || jsonb_build_array(
                        jsonb_build_object('status', $1, 'note', $2, 'at', NOW()::text, 'by', $3)
                    )
              WHERE id = $4
              RETURNING id, status, timeline, updated_at`
    ).get(data.status, data.note ?? null, req.user.id, id);
    if (!updated) return sendError(res, "Order not found", 404);
    await writeAuditLog(
      req,
      "order.status.update",
      "orders",
      id,
      { from: order.status },
      {
        to: data.status,
        tracking_number: data.tracking_number
      }
    );
    return sendSuccess(res, updated, "Order status updated");
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.get("/analytics", ...sellerAuth, async (req, res) => {
  try {
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const totals = await db.prepare(
      `SELECT
             COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'refunded'))::int AS total_orders,
             COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
             COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
             COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0)::numeric AS gross_revenue,
             COALESCE(SUM(total), 0)::numeric AS total_revenue,
             COUNT(DISTINCT customer_id)::int AS unique_customers
         FROM orders
        WHERE store_id = $1`
    ).get(myStoreId);
    const today = await db.prepare(
      `SELECT COUNT(*)::int AS n
             FROM orders
            WHERE store_id = $1
              AND created_at >= CURRENT_DATE`
    ).get(myStoreId);
    return sendSuccess(res, {
      store_id: myStoreId,
      total_orders: totals?.total_orders ?? 0,
      delivered_orders: totals?.delivered_orders ?? 0,
      cancelled_orders: totals?.cancelled_orders ?? 0,
      unique_customers: totals?.unique_customers ?? 0,
      today_orders: today?.n ?? 0,
      gross_revenue: Number(totals?.gross_revenue ?? 0),
      total_revenue: Number(totals?.total_revenue ?? 0)
    });
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.get("/inventory", ...sellerAuth, async (req, res) => {
  try {
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const rows = await db.prepare(
      `SELECT id, name_ar, name_en, sku, stock, sold_count, is_active,
                CASE
                  WHEN stock = 0 THEN 'out_of_stock'
                  WHEN stock < 10 THEN 'low_stock'
                  ELSE 'in_stock'
                END AS stock_status
           FROM products
          WHERE store_id = $1 AND deleted_at IS NULL
          ORDER BY stock ASC, name_en ASC NULLS LAST`
    ).all(myStoreId);
    return sendSuccess(res, { items: rows });
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.get("/payouts", ...sellerAuth, async (req, res) => {
  try {
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const v = validate(paginationSchema, req.query);
    if (!v.ok) return sendError(res, "Invalid pagination: " + v.error, 400);
    const { limit, offset } = v.data;
    const rows = await db.prepare(
      `SELECT id, type, amount, balance_after, reference_type, reference_id,
                description, created_at
           FROM transactions
          WHERE store_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`
    ).all(myStoreId, limit, offset);
    const balance = await db.prepare("SELECT available, pending FROM store_balance WHERE store_id = $1").get(myStoreId);
    return sendSuccess(res, {
      balance: balance ?? { available: 0, pending: 0 },
      items: rows,
      limit,
      offset
    });
  } catch (err) {
    return sendError(res, err);
  }
});
sellerRouter.get("/dashboard", ...sellerAuth, async (req, res) => {
  try {
    req.url = "/analytics";
    const myStoreId = await getMerchantStoreId(req, res);
    if (myStoreId == null) return sendError(res, "You do not have a store yet", 404);
    const totals = await db.prepare(
      `SELECT
             COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'refunded'))::int AS active_orders,
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
             COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0)::numeric AS revenue
         FROM orders WHERE store_id = $1`
    ).get(myStoreId);
    const lowStock = await db.prepare(
      `SELECT COUNT(*)::int AS n FROM products
          WHERE store_id = $1 AND deleted_at IS NULL AND stock < 10`
    ).get(myStoreId);
    return sendSuccess(res, {
      store_id: myStoreId,
      active_orders: totals?.active_orders ?? 0,
      pending_orders: totals?.pending_orders ?? 0,
      revenue: Number(totals?.revenue ?? 0),
      low_stock_products: lowStock?.n ?? 0
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/shipping.ts
init_shared();
import { Router as Router16 } from "express";
var shippingRouter = Router16();
shippingRouter.get("/methods", async (req, res) => {
  try {
    const weight = Math.max(0, Number(req.query.weight_kg) || 1);
    const rows = await db.prepare(
      "SELECT id, name_ar, name_en, base_cost, per_kg_cost, estimated_days FROM shipping_methods WHERE is_active = TRUE ORDER BY base_cost ASC"
    ).all();
    const enriched = rows.map((m) => ({
      ...m,
      estimated_total: Math.round((m.base_cost + (m.per_kg_cost ?? 0) * weight) * 100) / 100
    }));
    sendSuccess(res, enriched);
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/stats.ts
init_shared();
import { Router as Router17 } from "express";
var statsRouter = Router17();
statsRouter.get("/home", async (_req, res) => {
  try {
    const pick = (row) => row?.count ?? 0;
    const productsCount = pick(
      await db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1").get()
    );
    const storesCount = pick(
      await db.prepare("SELECT COUNT(*) as count FROM stores WHERE is_active = 1").get()
    );
    const ordersCount = pick(await db.prepare("SELECT COUNT(*) as count FROM orders").get());
    const usersCount = pick(await db.prepare("SELECT COUNT(*) as count FROM users").get());
    const featuredProducts = await db.prepare(
      "SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 6"
    ).all();
    const dealsProducts = await db.prepare(
      "SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 6"
    ).all();
    sendSuccess(res, {
      counts: {
        products: productsCount,
        stores: storesCount,
        orders: ordersCount,
        users: usersCount
      },
      featured: featuredProducts.map(getProductWithParsedFields),
      deals: dealsProducts.map(getProductWithParsedFields)
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/store-followers.ts
init_shared();
import { Router as Router18 } from "express";
import { z as z6 } from "zod";
var storeFollowersRouter = Router18();
var checkFollowSchema = z6.object({
  store_id: z6.coerce.number().int().positive(),
  user_id: z6.coerce.number().int().positive()
});
storeFollowersRouter.get("/check", requireAuth, async (req, res) => {
  try {
    const v = validate(checkFollowSchema, req.query);
    if (!v.ok) return sendError(res, "Invalid query: " + v.error, 400);
    if (req.user.id !== v.data.user_id && req.user.role !== "admin") {
      return sendError(res, "Forbidden", 403, "FORBIDDEN");
    }
    const row = await db.prepare(
      `SELECT id, notify_new_products, notify_offers, created_at
				 FROM store_followers
				 WHERE store_id = $1 AND user_id = $2`
    ).get(v.data.store_id, v.data.user_id);
    return sendSuccess(res, {
      store_id: v.data.store_id,
      user_id: v.data.user_id,
      following: row !== void 0,
      preferences: row ? {
        notify_new_products: row.notify_new_products,
        notify_offers: row.notify_offers,
        since: row.created_at
      } : null
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// server/routes/wishlist.ts
init_error_codes();
init_shared();
import { Router as Router19 } from "express";
var wishlistRouter = Router19();
wishlistRouter.get("/:userId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await db.prepare(
      `SELECT w.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.rating, p.review_count, s.store_name
         FROM wishlist w
         JOIN products p ON w.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE w.user_id = ?
         ORDER BY w.created_at DESC`
    ).all(userId);
    return sendSuccess(res, items);
  } catch (err) {
    return sendError(res, err);
  }
});
wishlistRouter.post("/", requireAuth, async (req, res) => {
  try {
    const v = validate(wishlistAddSchema, req.body);
    if (!v.ok) return sendError(res, "Invalid input: " + v.error, 400, ErrorCodes.VALIDATION_ERROR);
    const { productId } = v.data;
    const userId = req.user.id;
    const existing = await db.prepare("SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?").get(userId, productId);
    if (existing) {
      return sendSuccess(res, null, "Already in wishlist");
    }
    const result = await db.prepare(
      "INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) RETURNING id"
    ).run(userId, productId);
    if (result.lastInsertRowid == null) {
      return sendError(res, "Failed to add to wishlist", 500, ErrorCodes.INSERT_FAILED);
    }
    return sendSuccess(res, { id: result.lastInsertRowid }, "Added to wishlist");
  } catch (err) {
    return sendError(res, err);
  }
});
wishlistRouter.delete("/:id", requireAuth, async (req, res) => {
  try {
    const v = validate(wishlistItemIdParamSchema, req.params);
    if (!v.ok) return sendError(res, "Invalid wishlist item id: " + v.error, 400);
    const wishlistItemId = v.data.id;
    const userId = req.user.id;
    const result = await db.prepare("DELETE FROM wishlist WHERE id = ? AND user_id = ? RETURNING id").get(wishlistItemId, userId);
    if (!result) return sendError(res, "Wishlist item not found", 404);
    return sendSuccess(res, { id: result.id }, "Removed from wishlist");
  } catch (err) {
    return sendError(res, err);
  }
});

// server/index.ts
var env = loadEnv();
var __dirname = (() => {
  try {
    if (typeof import.meta.url === "string" && import.meta.url.length > 0) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {
  }
  return process.cwd();
})();
var app = express();
var PORT = env.API_PORT;
var DATABASE_URL = resolveDatabaseUrl(env);
var STATIC_PATH = env.STATIC_PATH || path.resolve(__dirname, "dist");
var db2 = new PgDb(DATABASE_URL);
configureTrustProxy(app);
app.use(requestId);
app.use(securityHeaders);
var ALLOWED_ORIGINS = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
  })
);
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
app.use((req, _res, next) => {
  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.startsWith("application/x-www-form-urlencoded")) {
    return next();
  }
  let buf = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => buf += chunk);
  req.on("end", () => {
    req.rawBody = buf;
    try {
      req.body = Object.fromEntries(new URLSearchParams(buf));
    } catch {
      req.body = {};
    }
    next();
  });
  req.on("error", next);
});
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(optionalAuth);
app.use(requestLogger);
var healthLimiter = healthRateLimit({ windowMs: 1e3, max: 30, bucket: "health" });
app.get("/api/health", healthLimiter, (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime_s: Math.round(process.uptime()),
    ts: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var READY_STARTED_AT = Date.now();
app.get("/api/ready", healthLimiter, async (_req, res) => {
  const checks = {};
  const startedAt = Date.now();
  let timeoutId;
  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("db timeout")), 2e3);
    });
    const result = await Promise.race([db2.prepare("SELECT 1 AS ok").get(), timeout]);
    if (timeoutId) clearTimeout(timeoutId);
    checks.db = { ok: !!result, ms: Date.now() - startedAt };
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    checks.db = { ok: false, ms: Date.now() - startedAt, detail: e.message };
  }
  const allOk = Object.values(checks).every((c) => c.ok);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ready" : "degraded",
    uptime_s: Math.round((Date.now() - READY_STARTED_AT) / 1e3),
    checks
  });
});
setInterval(async () => {
  try {
    const r = await db2.prepare("SELECT cleanup_rate_limits() AS n").get();
    if (r && r.n > 0) log.debug({ msg: "rate_limit_cleanup", deleted: r.n });
  } catch {
  }
  const j = await db2.prepare("SELECT cleanup_used_jtis() AS n").get();
  if (j && j.n > 0) log.debug({ msg: "used_jtis_cleanup", deleted: j.n });
}, 60 * 1e3).unref();
function cacheControl(seconds, router) {
  const cacheMw = (req, res, next) => {
    if (!res.getHeader("Cache-Control") && req.method === "GET") {
      res.setHeader(
        "Cache-Control",
        `public, max-age=${seconds}, stale-while-revalidate=${Math.floor(seconds / 2)}`
      );
    }
    next();
  };
  const composed = [cacheMw, router];
  return composed;
}
app.use("/api/admin", adminRouter);
app.use("/api", cacheControl(60, catalogRouter));
app.use("/api/auth", authRouter);
app.use("/api/auth/2fa", auth2faRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/refunds", refundsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/stats", cacheControl(30, statsRouter));
app.use("/api/shipping", cacheControl(300, shippingRouter));
app.use("/api/store-followers", storeFollowersRouter);
app.use("/api/addresses", addressesRouter);
app.use("/api/admin", adminReadRouter);
if (process.env.NODE_ENV === "production" || process.env.SERVE_STATIC === "true") {
  app.use(express.static(STATIC_PATH, { index: false }));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexPath = path.join(STATIC_PATH, "index.html");
    fs.access(indexPath, fs.constants.R_OK, (err) => {
      if (err) return next();
      fs.readFile(indexPath, "utf8", (readErr, html) => {
        if (readErr) return next();
        const nonce = res.locals.cspNonce;
        if (!nonce) return res.send(html);
        const inject = ` nonce="${nonce}"`;
        const patched = html.replace(/<script(\s)/g, `<script${inject}$1`).replace(/<script>/g, `<script${inject}>`).replace(/<style(\s)/g, `<style${inject}$1`).replace(/<style>/g, `<style${inject}>`).replace(/<head>/i, `<head><meta name="csp-nonce" content="${nonce}">`);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(patched);
      });
    });
  });
}
app.use(notFoundHandler);
app.use(errorHandler);
process.on("SIGTERM", async () => {
  await db2.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await db2.close();
  process.exit(0);
});
var __isMainModule = (() => {
  try {
    const here = import.meta.url;
    const argv1 = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
    return here === argv1;
  } catch {
    return false;
  }
})();
if (__isMainModule) {
  app.listen(PORT, () => {
    log.info({
      msg: "server_started",
      port: PORT,
      database: PgDb.redactUrl(DATABASE_URL),
      static_path: STATIC_PATH,
      env: process.env.NODE_ENV || "development"
    });
  });
}
var index_default = app;
export {
  index_default as default
};
