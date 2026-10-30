// Pari daily learning: every night Pari reviews the day's chats, finds where she let shoppers down,
// and writes short "lessons" (how to recommend / talk). Approved lessons are added to her instructions
// straight away — no code change or redeploy. Also lists info gaps for the team and products people
// asked for that the store doesn't sell.
//
// Safety: lessons can only change HOW Pari recommends and talks. Anything about offers, codes, prices,
// shipping or policies is rejected — those facts live only in knowledge.md, written by the team.
//
// Settings (Render environment variables):
//   AUTO_LESSONS=1        → new lessons switch on by themselves (default: wait for Approve on the dashboard)
//   LEARN_TIME_IST=23:30  → when the nightly review runs (India time)
import { db } from "./tracking.js";

const AUTO = process.env.AUTO_LESSONS === "1";
const LEARN_TIME = (process.env.LEARN_TIME_IST || "23:30").split(":").map(Number);
const MAX_ACTIVE = 30;
const TEST_SIDS = ["claudetest027", "setupcheck0001", "mvqckihk6weebx9p", "watestlive001"];
// Lessons may not touch facts the team owns (knowledge.md) — those must never be "learned" from chats.
const FORBIDDEN = /coupon|promo ?code|discount code|\bcode\b|% ?off|free shipping|shipping (fee|charge)|\bcod\b|refund|return policy|exchange policy|cancel|delivery (time|days)|dispatch/i;

let cache = { text: "", at: 0 };
let running = false;

export function autoLessons() { return AUTO; }

export async function initLearning() {
  const pool = db(); if (!pool) return;
  await pool.query(`
    create table if not exists pari.lessons (
      id bigserial primary key, created_at timestamptz not null default now(), day date,
      status text not null default 'suggested', lesson text not null, why text, example text, decided_at timestamptz
    );
    create table if not exists pari.reports (
      day date primary key, created_at timestamptz not null default now(), status text not null default 'running',
      chats int, summary text, gaps jsonb, missing jsonb, error text
    );`);
  console.log(`[learn] daily learning is on (${AUTO ? "auto-approve" : "needs approval"}, runs ${LEARN_TIME.join(":")} IST)`);
}

// Active lessons as text for Pari's instructions (cached 5 min).
export async function lessonsText() {
  const pool = db(); if (!pool) return "";
  if (Date.now() - cache.at < 5 * 60 * 1000) return cache.text;
  try {
    const { rows } = await pool.query(`select lesson from pari.lessons where status='active' order by id limit ${MAX_ACTIVE}`);
    cache = { text: rows.map((r) => `- ${r.lesson}`).join("\n"), at: Date.now() };
  } catch (e) { console.error("[learn] lessonsText:", e.message); }
  return cache.text;
}

export async function learningData() {
  const pool = db(); if (!pool) return { enabled: false };
  const q = (sql, a = []) => pool.query(sql, a).then((r) => r.rows);
  const lessons = await q(`select id, to_char(day,'YYYY-MM-DD') as day, status, lesson, why, example from pari.lessons
    where status in ('suggested','active') or decided_at > now() - interval '7 days' order by status, id desc limit 80`);
  const reports = await q(`select to_char(day,'YYYY-MM-DD') as day, status, chats, summary, gaps, missing, error
    from pari.reports order by day desc limit 7`);
  return { enabled: true, auto: AUTO, time: LEARN_TIME.map((n) => String(n).padStart(2, "0")).join(":"), lessons, reports };
}

export async function setLesson(id, action) {
  const pool = db(); if (!pool) return false;
  const status = { approve: "active", reject: "rejected", remove: "removed" }[action];
  if (!status || !/^\d+$/.test(String(id))) return false;
  if (status === "active") {
    const { rows } = await pool.query(`select count(*)::int as n from pari.lessons where status='active'`);
    if (rows[0].n >= MAX_ACTIVE) throw new Error(`Already ${MAX_ACTIVE} active lessons — remove one first.`);
  }
  await pool.query(`update pari.lessons set status=$1, decided_at=now() where id=$2`, [status, Number(id)]);
  cache.at = 0;
  return true;
}

function istToday() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { day: d.toISOString().slice(0, 10), mins: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// Called every 10 minutes by server.js: runs once a day after LEARN_TIME (IST).
export async function maybeRunNightly(ask, ctx) {
  const pool = db(); if (!pool || running) return;
  const { day, mins } = istToday();
  if (mins < LEARN_TIME[0] * 60 + (LEARN_TIME[1] || 0)) return;
  // Skip only if tonight's full-day review already ran. A daytime "Review now" (partial day) doesn't count.
  const { rows } = await pool.query(`select 1 from pari.reports where day=$1 and status in ('done','running')
    and created_at >= ($1::date + $2::time) at time zone 'Asia/Kolkata'`, [day, LEARN_TIME.map((n) => String(n || 0).padStart(2, "0")).join(":")]);
  if (rows.length) return;
  await runLearning({ day, ask, ctx }).catch((e) => console.error("[learn] nightly:", e.message));
}

// ask(system, userText, tool) → tool input object. ctx = { rules, catalogTitles }
export async function runLearning({ day, ask, ctx }) {
  const pool = db(); if (!pool) throw new Error("Tracking database is off.");
  if (running) throw new Error("A review is already running — try again in a minute.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) day = istToday().day;
  running = true;
  try {
    await pool.query(`insert into pari.reports (day, status) values ($1,'running')
      on conflict (day) do update set status='running', error=null, created_at=now()`, [day]);

    const chats = (await pool.query(`
      select m.sid, min(s.first_page) as page,
        json_agg(json_build_object('r', m.role, 'c', m.content, 'p', m.products) order by m.id) as msgs
      from pari.messages m left join pari.sessions s on s.sid = m.sid
      where (m.at at time zone 'Asia/Kolkata')::date = $1 and not (m.sid = any($2))
      group by m.sid order by min(m.id) limit 150`, [day, TEST_SIDS])).rows;
    const wa = (await pool.query(`select coalesce(data->>'q','') as q from pari.events
      where type='whatsapp' and (at at time zone 'Asia/Kolkata')::date = $1 and not (sid = any($2))`, [day, TEST_SIDS])).rows;

    if (!chats.length) {
      await pool.query(`update pari.reports set status='done', chats=0, summary='No chats on this day.', gaps='[]', missing='[]' where day=$1`, [day]);
      return { day, chats: 0, lessons: 0 };
    }

    let transcript = chats.map((c, i) => `CHAT ${i + 1} (started on ${c.page || "?"})\n` + c.msgs.map((m) => {
      if (m.r === "user") return `  Shopper: ${m.c}`;
      const shown = Array.isArray(m.p) && m.p.length ? `  [cards shown: ${m.p.map((p) => `${p.title} ₹${p.price}`).join("; ")}]` : "  [no product cards shown]";
      return `  Pari: ${m.c.replace(/\s*\[Showed:[^\]]*\]/, "")}\n${shown}`;
    }).join("\n")).join("\n\n");
    if (transcript.length > 70000) transcript = transcript.slice(0, 70000) + "\n...(more chats cut)";

    const active = await lessonsText();
    const system = `You review one day of chats between shoppers and "Pari", the AI beauty guide of an Indian makeup store (PARIÉ by Parul Garg Beauty). Your job: make Pari better tomorrow.

Find moments where Pari let a shopper down, for example: answered with no product cards when products would help; asked a question instead of showing products; repeated the same products after the shopper said no; missed the budget; showed only packs or only single products when both would help; misunderstood Hinglish; gave a vague answer; the shopper left right after a weak answer.

Then write LESSONS: short, specific behaviour rules Pari should follow from now on. Good lesson: "When a shopper asks for 'bold' lipsticks, show the Signature Trio of Bold Statement Lipsticks plus 2 single bold shades like Hibiscus 01." Use exact product titles from the CATALOG when naming products.
Lesson rules:
- Max 5 lessons, each under 250 characters, written as an instruction to Pari. Only for problems you actually saw in these chats. Return none if Pari did well.
- Never write lessons about offers, coupon codes, discounts, prices of offers, shipping, COD, delivery times, returns, refunds or cancellations — those facts are owned by the store team, not learned.
- Never invent products, shades or facts. Don't repeat or contradict Pari's RULES or ACTIVE LESSONS.
Also list INFO GAPS (facts the team should add to product pages or the store knowledge because shoppers asked and Pari couldn't answer, e.g. "Add potli capacity — 3 shoppers asked if 250g dry fruits fit") and MISSING PRODUCTS (things shoppers wanted that the catalog doesn't have).
Write in simple English for a busy store team.`;
    const user = `PARI'S RULES:\n${ctx.rules}\n\nACTIVE LESSONS:\n${active || "(none yet)"}\n\nCATALOG (title | price):\n${ctx.catalogTitles}\n\n` +
      `QUESTIONS HANDED TO THE WHATSAPP TEAM TODAY: ${wa.length ? wa.map((w) => `"${w.q}"`).join("; ") : "none"}\n\n` +
      `TODAY'S CHATS (${day}, ${chats.length} chats):\n\n${transcript}`;

    const out = await ask(system, user, REVIEW_TOOL);

    const existing = new Set((await pool.query(`select lower(lesson) as l from pari.lessons where status in ('active','suggested','rejected')`)).rows.map((r) => r.l));
    const { rows: [{ n: activeCount }] } = await pool.query(`select count(*)::int as n from pari.lessons where status='active'`);
    let added = 0, made = activeCount;
    for (const l of (out.lessons || []).slice(0, 5)) {
      const text = String(l.lesson || "").replace(/\s+/g, " ").trim().slice(0, 300);
      if (text.length < 15 || FORBIDDEN.test(text) || existing.has(text.toLowerCase())) continue;
      const status = AUTO && made < MAX_ACTIVE ? "active" : "suggested";
      if (status === "active") made++;
      await pool.query(`insert into pari.lessons (day, status, lesson, why, example, decided_at) values ($1,$2,$3,$4,$5,$6)`,
        [day, status, text, String(l.why || "").slice(0, 400), String(l.example || "").slice(0, 200), status === "active" ? new Date() : null]);
      added++;
    }
    cache.at = 0;
    const clean = (a) => JSON.stringify((Array.isArray(a) ? a : []).slice(0, 8).map((x) => String(x).slice(0, 240)));
    await pool.query(`update pari.reports set status='done', chats=$2, summary=$3, gaps=$4, missing=$5 where day=$1`,
      [day, chats.length, String(out.summary || "").slice(0, 1500), clean(out.info_gaps), clean(out.missing_products)]);
    console.log(`[learn] ${day}: ${chats.length} chats reviewed, ${added} lessons ${AUTO ? "added" : "suggested"}`);
    return { day, chats: chats.length, lessons: added };
  } catch (e) {
    await pool.query(`update pari.reports set status='error', error=$2 where day=$1`, [day, e.message.slice(0, 300)]).catch(() => {});
    throw e;
  } finally { running = false; }
}

const REVIEW_TOOL = {
  name: "daily_review",
  description: "Report the review of today's chats. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "3-5 short sentences: how Pari did today, the biggest problems, what shoppers wanted most." },
      lessons: {
        type: "array", maxItems: 5,
        items: {
          type: "object",
          properties: {
            lesson: { type: "string", description: "Instruction to Pari, under 250 characters." },
            why: { type: "string", description: "What went wrong today, in one sentence." },
            example: { type: "string", description: "A shopper message from today that shows the problem." },
          },
          required: ["lesson", "why"],
        },
      },
      info_gaps: { type: "array", maxItems: 6, items: { type: "string" }, description: "Facts the team should add (to product pages or knowledge.md)." },
      missing_products: { type: "array", maxItems: 6, items: { type: "string" }, description: "Things shoppers wanted that the catalog doesn't have." },
    },
    required: ["summary", "lessons"],
  },
};
