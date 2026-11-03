// Pari tracking: saves chats + add-to-carts to Postgres (schema "pari", kept apart from other apps' tables)
// and works out the numbers for the dashboard. If DATABASE_URL isn't set, tracking is simply switched off.
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "";
const SHOP = process.env.SHOPIFY_SHOP || "parulgargbeauty.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || ""; // optional: read_orders, to count purchases
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-01";
// Dashboard numbers start from this moment (older chats stay saved for learning, just not counted).
// Change in Render with DASHBOARD_FROM=YYYY-MM-DD (India time) to reset again.
const FROM_DAY = /^\d{4}-\d{2}-\d{2}$/.test(process.env.DASHBOARD_FROM || "") ? process.env.DASHBOARD_FROM : "2026-11-02";
const FROM_TS = `${FROM_DAY}T00:00:00+05:30`;
export function dashboardFrom() { return FROM_DAY; }

let pool = null;
let ready = false;

export function trackingEnabled() { return ready; }
export function db() { return ready ? pool : null; } // used by learning.js
export function ordersEnabled() { return Boolean(SHOPIFY_TOKEN); }

export async function initTracking() {
  if (!DATABASE_URL) { console.warn("[track] DATABASE_URL not set — chat tracking is off"); return; }
  // Render's internal URL (host without dots) doesn't use SSL; the external one does.
  const host = (DATABASE_URL.match(/@([^/:]+)/) || [])[1] || "";
  pool = new pg.Pool({
    connectionString: DATABASE_URL, max: 3,
    ssl: host.includes(".") ? { rejectUnauthorized: false } : false,
  });
  await pool.query(`
    create schema if not exists pari;
    create table if not exists pari.sessions (
      sid text primary key,
      started_at timestamptz not null default now(),
      last_at timestamptz not null default now(),
      first_page text, device text, cart_token text,
      messages int not null default 0, add_to_carts int not null default 0
    );
    create table if not exists pari.messages (
      id bigserial primary key, sid text not null, at timestamptz not null default now(),
      role text not null, content text not null, products jsonb, budget int
    );
    create table if not exists pari.events (
      id bigserial primary key, sid text not null, at timestamptz not null default now(),
      type text not null, data jsonb
    );
    alter table pari.messages add column if not exists suggestions jsonb;
    create index if not exists pari_messages_at on pari.messages (at);
    create index if not exists pari_messages_sid on pari.messages (sid);
    create index if not exists pari_events_at on pari.events (at);
    create index if not exists pari_sessions_at on pari.sessions (started_at);
  `);
  ready = true;
  console.log("[track] tracking is on (schema pari)");
}

// Privacy: never keep phone numbers or email addresses people type in.
export function redact(text) {
  return String(text || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email hidden]")
    .replace(/\+?\d(?:[\s-]?\d){9,}/g, "[number hidden]")
    .slice(0, 1000);
}

function cleanSid(sid) { return /^[A-Za-z0-9_-]{8,64}$/.test(String(sid || "")) ? String(sid) : null; }
function cleanToken(t) { return String(t || "").split("?")[0].slice(0, 80) || null; }
function deviceFrom(ua) { return /mobile|android|iphone|ipad/i.test(String(ua || "")) ? "mobile" : "desktop"; }

async function touchSession(sid, { page, ua, cart } = {}) {
  await pool.query(
    `insert into pari.sessions (sid, first_page, device, cart_token) values ($1,$2,$3,$4)
     on conflict (sid) do update set last_at = now(),
       cart_token = coalesce(excluded.cart_token, pari.sessions.cart_token)`,
    [sid, page ? String(page).slice(0, 200) : null, deviceFrom(ua), cleanToken(cart)]);
}

export async function logChat({ sid, page, ua, cart, userText, reply, products, budget, suggestions }) {
  if (!ready) return;
  sid = cleanSid(sid); if (!sid) return;
  try {
    await touchSession(sid, { page, ua, cart });
    await pool.query(`insert into pari.messages (sid, role, content, budget) values ($1,'user',$2,$3)`,
      [sid, redact(userText), budget || null]);
    await pool.query(`insert into pari.messages (sid, role, content, products, suggestions) values ($1,'assistant',$2,$3,$4)`,
      [sid, String(reply || "").slice(0, 1000), JSON.stringify((products || []).map((p) => ({ handle: p.handle, title: p.title, price: p.price }))),
       JSON.stringify(Array.isArray(suggestions) ? suggestions : [])]);
    await pool.query(`update pari.sessions set messages = messages + 1, last_at = now() where sid = $1`, [sid]);
  } catch (e) { console.error("[track] logChat:", e.message); }
}

export async function logEvent({ sid, type, data, page, ua, cart }) {
  if (!ready) return;
  sid = cleanSid(sid); if (!sid) return;
  if (!["open", "add_to_cart", "whatsapp", "link_click"].includes(type)) return;
  try {
    await touchSession(sid, { page, ua, cart });
    const d = data && typeof data === "object" ? {
      variant_id: data.variant_id ? Number(data.variant_id) : undefined,
      handle: data.handle ? String(data.handle).slice(0, 120) : undefined,
      title: data.title ? String(data.title).slice(0, 160) : undefined,
      price: data.price != null ? Number(data.price) : undefined,
      q: data.q ? redact(String(data.q)).slice(0, 200) : undefined, // question that led to a WhatsApp hand-off
      label: data.label ? String(data.label).slice(0, 80) : undefined, // promo bar / shortcut / link pill tapped
      url: data.url ? String(data.url).slice(0, 200) : undefined,
      where: data.where ? String(data.where).slice(0, 20) : undefined,
    } : null;
    await pool.query(`insert into pari.events (sid, type, data) values ($1,$2,$3)`, [sid, type, d ? JSON.stringify(d) : null]);
    if (type === "add_to_cart") await pool.query(`update pari.sessions set add_to_carts = add_to_carts + 1 where sid = $1`, [sid]);
  } catch (e) { console.error("[track] logEvent:", e.message); }
}

// ---------------- Dashboard numbers ----------------
export async function dashboardData(days) {
  if (!ready) return { tracking: false };
  const since = `greatest(now() - interval '${Math.max(1, Math.min(365, Number(days) || 7))} days', '${FROM_TS}'::timestamptz)`;
  const q = (sql, args = []) => pool.query(sql, args).then((r) => r.rows);

  const [kpi] = await q(`
    select
      (select count(distinct sid) from pari.events where type='open' and at >= ${since}) as opens,
      (select count(*) from pari.sessions where messages > 0 and started_at >= ${since}) as chats,
      (select count(*) from pari.messages where role='user' and at >= ${since}) as questions,
      (select count(*) from pari.events where type='add_to_cart' and at >= ${since}) as add_to_carts,
      (select count(distinct sid) from pari.events where type='add_to_cart' and at >= ${since}) as carting_chats,
      (select coalesce(sum((data->>'price')::numeric),0) from pari.events where type='add_to_cart' and at >= ${since}) as cart_value,
      (select count(*) from pari.sessions where messages > 0 and device='mobile' and started_at >= ${since}) as mobile_chats,
      (select count(*) from pari.events where type='whatsapp' and at >= ${since}) as whatsapp,
      (select count(*) from pari.events where type='link_click' and at >= ${since}) as link_clicks`);

  const daily = await q(`
    select to_char(d::date,'YYYY-MM-DD') as day,
      (select count(*) from pari.sessions s where s.messages>0 and s.started_at >= ${since} and (s.started_at at time zone 'Asia/Kolkata')::date = d::date) as chats,
      (select count(*) from pari.events e where e.type='add_to_cart' and e.at >= ${since} and (e.at at time zone 'Asia/Kolkata')::date = d::date) as atc
    from generate_series(((${since}) at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d order by d`);

  const recommended = await q(`
    select p->>'title' as title, count(*) as times
    from pari.messages m, jsonb_array_elements(coalesce(m.products,'[]'::jsonb)) p
    where m.role='assistant' and m.at >= ${since}
    group by 1 order by 2 desc limit 10`);

  const added = await q(`
    select data->>'title' as title, count(*) as times, coalesce(sum((data->>'price')::numeric),0) as value
    from pari.events where type='add_to_cart' and at >= ${since}
    group by 1 order by 2 desc limit 10`);

  const whatsapp = await q(`
    select at, coalesce(data->>'q','') as q from pari.events
    where type='whatsapp' and at >= ${since} order by at desc limit 20`);

  const links = await q(`
    select coalesce(data->>'label', data->>'url', '?') as label, coalesce(data->>'where','') as where_from, count(*) as times
    from pari.events where type='link_click' and at >= ${since}
    group by 1,2 order by 3 desc limit 10`);

  const pages = await q(`
    select coalesce(first_page,'?') as page, count(*) as chats from pari.sessions
    where messages>0 and started_at >= ${since} group by 1 order by 2 desc limit 8`);

  const convos = await convosPage(days, 0, 50);
  const [{ n: convoTotal }] = await q(`select count(*)::int as n from pari.sessions where messages > 0 and started_at >= ${since}`);

  let purchases = null;
  if (SHOPIFY_TOKEN) {
    try { purchases = await purchaseStats(days); } catch (e) { purchases = { error: e.message.slice(0, 200) }; }
  }
  return { tracking: true, days: Number(days) || 7, from: FROM_DAY, kpi, daily, recommended, added, pages, whatsapp, links, convos, convoTotal, purchases, ordersEnabled: Boolean(SHOPIFY_TOKEN) };
}

// Conversations, 50 at a time, newest first (for "See more" on the dashboard).
export async function convosPage(days, offset, limit) {
  if (!ready) return [];
  const since = `greatest(now() - interval '${Math.max(1, Math.min(365, Number(days) || 7))} days', '${FROM_TS}'::timestamptz)`;
  return (await pool.query(`
    select s.sid, s.started_at, s.device, s.first_page, s.add_to_carts,
      (select json_agg(json_build_object('role',m.role,'content',m.content,'products',m.products,'suggestions',m.suggestions) order by m.id)
         from pari.messages m where m.sid = s.sid) as messages
    from pari.sessions s where s.messages > 0 and s.started_at >= ${since}
    order by s.started_at desc offset $1 limit $2`, [Math.max(0, offset | 0), Math.min(100, limit | 0 || 50)])).rows;
}

export async function questionsForSummary(days) {
  if (!ready) return [];
  const since = `now() - interval '${Math.max(1, Math.min(365, Number(days) || 7))} days'`;
  const rows = await pool.query(`select content from pari.messages where role='user' and at >= ${since} order by at desc limit 400`);
  return rows.rows.map((r) => r.content);
}

export async function exportCsv(days) {
  if (!ready) return "tracking off\n";
  const since = `now() - interval '${Math.max(1, Math.min(365, Number(days) || 30))} days'`;
  const rows = (await pool.query(`
    select m.at, m.sid, s.device, s.first_page, m.role, m.content,
      (select string_agg(p->>'title',' | ') from jsonb_array_elements(coalesce(m.products,'[]'::jsonb)) p) as products
    from pari.messages m join pari.sessions s using (sid) where m.at >= ${since} order by m.at`)).rows;
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return ["time,session,device,page,who,message,products_shown",
    ...rows.map((r) => [r.at.toISOString(), r.sid, r.device, r.first_page, r.role, r.content, r.products].map(esc).join(","))].join("\n");
}

// ---------------- Purchases (needs SHOPIFY_ADMIN_TOKEN with read_orders) ----------------
// If the token also has write_orders, matched orders get a visible tag in Shopify admin
// ("Pari" = bought an item added from Pari's cards, "Pari chat" = chatted with Pari, then bought).
const tagged = new Set();
let canTag = true;
async function tagOrder(o, tag) {
  if (!canTag || tagged.has(o.id) || (o.tags || []).includes(tag)) return;
  tagged.add(o.id);
  try {
    const res = await fetch(`https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST", headers: { "content-type": "application/json", "x-shopify-access-token": SHOPIFY_TOKEN },
      body: JSON.stringify({ query: `mutation($id:ID!,$t:[String!]!){ tagsAdd(id:$id, tags:$t){ userErrors{ message } } }`, variables: { id: o.id, t: [tag] } }),
    });
    const d = await res.json();
    if (d.errors && JSON.stringify(d.errors).match(/access|scope|denied/i)) { canTag = false; console.warn("[track] no write_orders scope, order tagging off"); }
  } catch (e) { console.error("[track] tagOrder:", e.message); }
}
// "Bought via Pari"   = order contains an item added from a Pari card (hidden item note _pari).
// "Bought after chat" = order's cart token matches a cart that chatted with Pari (bought anything).
// Matched orders are saved in pari.orders, so any date range is instant and nothing is missed.
// Every hour (and when the dashboard opens, at most every 10 min) the last ~2 days of orders are scanned.
let lastScan = 0, scanning = null, ordersTable = false;
async function ensureOrdersTable() {
  if (ordersTable) return;
  await pool.query(`create table if not exists pari.orders (
    name text primary key, order_id text, at timestamptz not null, total numeric not null default 0,
    kind text not null, items jsonb, pari_value numeric not null default 0, sid text, matched_at timestamptz not null default now());
    create index if not exists pari_orders_at on pari.orders (at);`);
  ordersTable = true;
}
export async function checkOrders() { if (ready && SHOPIFY_TOKEN) await scanOrders(true); }
async function scanOrders(force) {
  if (!force && Date.now() - lastScan < 10 * 60 * 1000) return;
  if (scanning) return scanning;
  scanning = (async () => {
    await ensureOrdersTable();
    const { rows: [m] } = await pool.query(`select max(at) as at from pari.orders`);
    // From the reset day on the first run, then the last 2 days (orders can be placed a while after a chat).
    const start = Math.max(Date.parse(FROM_TS), Date.now() - 2 * 86400000);
    const sinceDate = new Date(m && m.at ? start : Date.parse(FROM_TS)).toISOString();
    const tok = new Map((await pool.query(
      `select cart_token, sid from pari.sessions where cart_token is not null and messages > 0 and started_at >= $1::timestamptz - interval '2 days'`,
      [sinceDate])).rows.map((r) => [r.cart_token, r.sid]));
    let after = null;
    for (let page = 0; page < 60; page++) {
      const res = await fetch(`https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: "POST", headers: { "content-type": "application/json", "x-shopify-access-token": SHOPIFY_TOKEN },
        body: JSON.stringify({
          query: `query($q:String!,$after:String){ orders(first:100, after:$after, query:$q){
            nodes{ id name tags createdAt totalPriceSet{shopMoney{amount}} customAttributes{key value}
              lineItems(first:50){ nodes{ title customAttributes{key value} originalTotalSet{shopMoney{amount}} } } }
            pageInfo{ hasNextPage endCursor } } }`,
          variables: { q: `created_at:>='${sinceDate}'`, after },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.errors) throw new Error(`Shopify ${res.status}: ${JSON.stringify(data.errors || data).slice(0, 150)}`);
      const conn = data.data.orders;
      for (const o of conn.nodes) {
        const pariLines = o.lineItems.nodes.filter((li) => li.customAttributes.some((a) => a.key === "_pari"));
        const ta = o.customAttributes.find((a) => a.key === "shopifyCartToken");
        const t = ta ? cleanToken(ta.value) : null;
        const sid = t && tok.has(t) ? tok.get(t) : null;
        if (!pariLines.length && !sid) continue;
        const kind = pariLines.length ? "via_pari" : "after_chat";
        tagOrder(o, kind === "via_pari" ? "Pari" : "Pari chat");
        await pool.query(
          `insert into pari.orders (name, order_id, at, total, kind, items, pari_value, sid) values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (name) do update set total=excluded.total, kind=excluded.kind, items=excluded.items, pari_value=excluded.pari_value`,
          [o.name, o.id.split("/").pop(), o.createdAt, Number(o.totalPriceSet.shopMoney.amount), kind,
           JSON.stringify(pariLines.map((li) => li.title)), pariLines.reduce((s, li) => s + Number(li.originalTotalSet.shopMoney.amount), 0), sid]);
      }
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    lastScan = Date.now();
  })().finally(() => { scanning = null; });
  return scanning;
}
async function purchaseStats(days) {
  await scanOrders(false);
  const since = `greatest(now() - interval '${Math.max(1, Math.min(365, Number(days) || 7))} days', '${FROM_TS}'::timestamptz)`;
  const rows = (await pool.query(`select order_id as id, name, at, total, kind, items, pari_value from pari.orders where at >= ${since} order by at desc limit 300`)).rows
    .map((r) => ({ ...r, at: r.at.toISOString(), total: Number(r.total), pari_value: Number(r.pari_value) }));
  const via = rows.filter((r) => r.kind === "via_pari"), aft = rows.filter((r) => r.kind === "after_chat");
  return {
    scanned: null, last_scan: lastScan ? new Date(lastScan).toISOString() : null,
    via_pari: via.length, via_pari_value: via.reduce((s, o) => s + o.pari_value, 0),
    after_chat: aft.length, after_chat_value: aft.reduce((s, o) => s + o.total, 0),
    orders: rows,
  };
}
