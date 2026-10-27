// Pari tracking: saves chats + add-to-carts to Postgres (schema "pari", kept apart from other apps' tables)
// and works out the numbers for the dashboard. If DATABASE_URL isn't set, tracking is simply switched off.
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "";
const SHOP = process.env.SHOPIFY_SHOP || "parulgargbeauty.myshopify.com";
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || ""; // optional: read_orders, to count purchases
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-01";

let pool = null;
let ready = false;

export function trackingEnabled() { return ready; }
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

export async function logChat({ sid, page, ua, cart, userText, reply, products, budget }) {
  if (!ready) return;
  sid = cleanSid(sid); if (!sid) return;
  try {
    await touchSession(sid, { page, ua, cart });
    await pool.query(`insert into pari.messages (sid, role, content, budget) values ($1,'user',$2,$3)`,
      [sid, redact(userText), budget || null]);
    await pool.query(`insert into pari.messages (sid, role, content, products) values ($1,'assistant',$2,$3)`,
      [sid, String(reply || "").slice(0, 1000), JSON.stringify((products || []).map((p) => ({ handle: p.handle, title: p.title, price: p.price })))]);
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
  const since = `now() - interval '${Math.max(1, Math.min(365, Number(days) || 7))} days'`;
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
      (select count(*) from pari.sessions s where s.messages>0 and s.started_at::date = d::date) as chats,
      (select count(*) from pari.events e where e.type='add_to_cart' and e.at::date = d::date) as atc
    from generate_series((${since})::date, now()::date, interval '1 day') d order by d`);

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

  const convos = await q(`
    select s.sid, s.started_at, s.device, s.first_page, s.add_to_carts,
      (select json_agg(json_build_object('role',m.role,'content',m.content,'products',m.products) order by m.id)
         from pari.messages m where m.sid = s.sid) as messages
    from pari.sessions s where s.messages > 0 and s.started_at >= ${since}
    order by s.started_at desc limit 60`);

  let purchases = null;
  if (SHOPIFY_TOKEN) {
    try { purchases = await purchaseStats(days); } catch (e) { purchases = { error: e.message.slice(0, 200) }; }
  }
  return { tracking: true, days: Number(days) || 7, kpi, daily, recommended, added, pages, whatsapp, links, convos, purchases, ordersEnabled: Boolean(SHOPIFY_TOKEN) };
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
// "Bought via Pari"   = order contains an item added from a Pari card (hidden item note _pari).
// "Bought after chat" = order's cart token matches a cart that chatted with Pari (bought anything).
let purchaseCache = { key: "", at: 0, data: null };
async function purchaseStats(days) {
  const key = String(days);
  if (purchaseCache.key === key && Date.now() - purchaseCache.at < 10 * 60 * 1000) return purchaseCache.data;
  const sinceDate = new Date(Date.now() - (Number(days) || 7) * 86400000).toISOString();
  const tokens = new Set((await pool.query(
    `select cart_token from pari.sessions where cart_token is not null and messages > 0 and started_at >= $1::timestamptz - interval '1 day'`,
    [sinceDate])).rows.map((r) => r.cart_token));

  let after = null, viaPari = [], afterChat = [], scanned = 0;
  for (let page = 0; page < 20; page++) {
    const body = {
      query: `query($q:String!,$after:String){ orders(first:100, after:$after, query:$q){
        nodes{ name createdAt totalPriceSet{shopMoney{amount}} customAttributes{key value}
          lineItems(first:50){ nodes{ title quantity customAttributes{key value} originalTotalSet{shopMoney{amount}} } } }
        pageInfo{ hasNextPage endCursor } } }`,
      variables: { q: `created_at:>=${sinceDate}`, after },
    };
    const res = await fetch(`https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST", headers: { "content-type": "application/json", "x-shopify-access-token": SHOPIFY_TOKEN },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.errors) throw new Error(`Shopify ${res.status}: ${JSON.stringify(data.errors || data).slice(0, 150)}`);
    const conn = data.data.orders;
    for (const o of conn.nodes) {
      scanned++;
      const total = Number(o.totalPriceSet.shopMoney.amount);
      const pariLines = o.lineItems.nodes.filter((li) => li.customAttributes.some((a) => a.key === "_pari"));
      const tokenAttr = o.customAttributes.find((a) => a.key === "shopifyCartToken");
      const tok = tokenAttr ? cleanToken(tokenAttr.value) : null;
      if (pariLines.length) {
        viaPari.push({ name: o.name, at: o.createdAt, total,
          items: pariLines.map((li) => li.title), pari_value: pariLines.reduce((s, li) => s + Number(li.originalTotalSet.shopMoney.amount), 0) });
      } else if (tok && tokens.has(tok)) {
        afterChat.push({ name: o.name, at: o.createdAt, total });
      }
    }
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  const data = {
    scanned,
    via_pari: viaPari.length,
    via_pari_value: viaPari.reduce((s, o) => s + o.pari_value, 0),
    after_chat: afterChat.length,
    after_chat_value: afterChat.reduce((s, o) => s + o.total, 0),
    orders: [...viaPari.map((o) => ({ ...o, kind: "via_pari" })), ...afterChat.map((o) => ({ ...o, kind: "after_chat" }))]
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50),
  };
  purchaseCache = { key, at: Date.now(), data };
  return data;
}
