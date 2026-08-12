/**
 * localStorage with a versioned envelope.
 *
 * The version lives INSIDE the envelope, not in the key. Versioning the key
 * (`saltdog:checklist:v2`) orphans the old data where a migration can't reach
 * it; versioning inside means `migrate()` can actually read the old shape.
 *
 * Every access is wrapped: Safari private mode throws on setItem, storage can
 * be full, and a hand-edited value can be malformed JSON. None of those should
 * take down a reference site.
 */
const NS = "saltdog";

let warned = false;
function warnOnce(err) {
  if (warned) return;
  warned = true;
  console.warn("[saltdog] localStorage unavailable; entries will not persist.", err);
}

export const fullKey = (key) => `${NS}:${key}`;

/**
 * @param {string} key            short key, namespaced internally
 * @param {object} opts
 * @param {number} opts.version   current schema version
 * @param {(v:number,data:any)=>{v:number,data:any}} [opts.migrate]
 * @param {()=>any} opts.fallback fresh value when nothing is stored
 */
export function load(key, { version, migrate, fallback }) {
  try {
    const raw = localStorage.getItem(fullKey(key));
    if (!raw) return fallback();
    const parsed = JSON.parse(raw);
    let v = typeof parsed?.v === "number" ? parsed.v : 0;
    let data = parsed?.data;
    if (data === undefined) return fallback();
    // Step the migration chain one version at a time so each migration only
    // has to know how to get from N to N+1.
    let guard = 0;
    while (v < version) {
      if (!migrate) return fallback();
      const next = migrate(v, data);
      if (!next || typeof next.v !== "number" || next.v <= v) return fallback();
      ({ v, data } = next);
      if (++guard > 32) return fallback();
    }
    return data;
  } catch (err) {
    warnOnce(err);
    return fallback();
  }
}

export function save(key, version, data) {
  try {
    localStorage.setItem(
      fullKey(key),
      JSON.stringify({ v: version, data, updatedAt: new Date().toISOString() }),
    );
    return true;
  } catch (err) {
    warnOnce(err);
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(fullKey(key));
  } catch (err) {
    warnOnce(err);
  }
}

/** Every saltdog key currently in storage, with size and last-write time. */
export function inspect() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${NS}:`)) continue;
      const raw = localStorage.getItem(k) ?? "";
      let updatedAt = null;
      try {
        updatedAt = JSON.parse(raw)?.updatedAt ?? null;
      } catch {
        /* unparseable: still list it so the user can clear it */
      }
      out.push({ key: k.slice(NS.length + 1), bytes: raw.length, updatedAt });
    }
  } catch (err) {
    warnOnce(err);
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export function clearAll() {
  inspect().forEach((e) => remove(e.key));
}

/** Whole-store export, for the About page backup button. */
export function exportAll() {
  const data = {};
  try {
    for (const { key } of inspect()) {
      const raw = localStorage.getItem(fullKey(key));
      if (raw) data[key] = JSON.parse(raw);
    }
  } catch (err) {
    warnOnce(err);
  }
  return { app: NS, exportedAt: new Date().toISOString(), data };
}

/**
 * Restore an exportAll() payload. Returns the number of keys written.
 * Deliberately strict about shape — an accidental import of some other JSON
 * file should fail loudly rather than half-write.
 */
export function importAll(payload) {
  if (!payload || payload.app !== NS || typeof payload.data !== "object") {
    throw new Error("Not a SALTDOG backup file.");
  }
  let n = 0;
  for (const [key, envelope] of Object.entries(payload.data)) {
    if (!envelope || typeof envelope.v !== "number") continue;
    try {
      localStorage.setItem(fullKey(key), JSON.stringify(envelope));
      n++;
    } catch (err) {
      warnOnce(err);
      throw new Error("Could not write to browser storage.");
    }
  }
  return n;
}
