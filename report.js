// Daily email: "What customers asked Pari yesterday" — sent every morning to the team.
// Written for the business team (offers, products, website fixes), not as a tech report.
//
// Settings (Render → Environment). Nothing is sent until SMTP_USER, SMTP_PASS and REPORT_TO are set.
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=<sending address>  SMTP_PASS=<Gmail app password>
//   REPORT_TO=anubha@...,team@...   (comma separated)     REPORT_CC=... (optional)
//   REPORT_FROM="Pari (PGB AI) <tech@parulgargbeauty.com>" (optional, defaults to SMTP_USER)
//   REPORT_TIME_IST=09:30  (when the email for the previous day goes out)
//   REPORT_SUBJECT="Re: AI chatbot daily summary" (optional: use the email thread's subject so mail apps keep it in that thread)
import nodemailer from "nodemailer";
import { db } from "./tracking.js";

const TEST_SIDS = ["claudetest027", "setupcheck0001", "mvqckihk6weebx9p", "watestlive001"];
const REPORT_TIME = (process.env.REPORT_TIME_IST || "09:30").split(":").map(Number);
const list = (s) => String(s || "").split(",").map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
const TO = list(process.env.REPORT_TO), CC = list(process.env.REPORT_CC);
const SMTP_USER = process.env.SMTP_USER || "", SMTP_PASS = process.env.SMTP_PASS || "";
let sending = false;

export function emailConfigured() { return Boolean(SMTP_USER && SMTP_PASS && TO.length); }
export function emailSettings() {
  return { configured: emailConfigured(), to: TO, cc: CC, time: REPORT_TIME.map((n) => String(n).padStart(2, "0")).join(":") };
}

export async function initReport() {
  const pool = db(); if (!pool) return;
  await pool.query(`create table if not exists pari.emails (day date primary key, sent_at timestamptz, recipients text, error text)`);
  console.log(`[report] daily email ${emailConfigured() ? `on → ${TO.length + CC.length} people at ${emailSettings().time} IST` : "off (set SMTP_USER, SMTP_PASS, REPORT_TO)"}`);
}

function ist(offsetDays = 0) {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86400000);
  return { day: d.toISOString().slice(0, 10), mins: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// All the numbers for one India-time day.
async function dayData(day) {
  const pool = db();
  const q = (sql) => pool.query(sql, [day, TEST_SIDS]).then((r) => r.rows);
  const D = `(at at time zone 'Asia/Kolkata')::date = $1 and not (sid = any($2))`;
  const [k] = await q(`select
      (select count(distinct sid) from pari.events where type='open' and ${D}) as opens,
      (select count(distinct sid) from pari.messages where role='user' and ${D}) as chats,
      (select count(*) from pari.messages where role='user' and ${D}) as questions,
      (select count(distinct m.sid) from pari.messages m join pari.sessions s on s.sid=m.sid
         where m.role='user' and s.device='mobile' and (m.at at time zone 'Asia/Kolkata')::date = $1 and not (m.sid = any($2))) as mobile,
      (select count(*) from pari.events where type='add_to_cart' and ${D}) as atc,
      (select coalesce(sum((data->>'price')::numeric),0) from pari.events where type='add_to_cart' and ${D}) as atc_value,
      (select count(*) from pari.events where type='whatsapp' and ${D}) as whatsapp,
      (select count(*) from pari.events where type='link_click' and ${D}) as links`);
  const questions = (await q(`select content from pari.messages where role='user' and ${D} order by id limit 500`)).map((r) => r.content);
  const added = await q(`select data->>'title' as title, count(*) as n from pari.events where type='add_to_cart' and ${D} group by 1 order by 2 desc limit 5`);
  const shown = await q(`select p->>'title' as title, count(*) as n from pari.messages m, jsonb_array_elements(coalesce(m.products,'[]'::jsonb)) p
      where m.role='assistant' and (m.at at time zone 'Asia/Kolkata')::date = $1 and not (m.sid = any($2)) group by 1 order by 2 desc limit 6`);
  const tapped = await q(`select coalesce(data->>'label','?') as label, count(*) as n from pari.events where type='link_click' and ${D} group by 1 order by 2 desc limit 5`);
  const wa = (await q(`select coalesce(data->>'q','') as q from pari.events where type='whatsapp' and ${D} order by id limit 10`)).map((r) => r.q).filter(Boolean);
  const review = (await pool.query(`select summary, gaps, missing from pari.reports where day=$1 and status='done'`, [day])).rows[0] || null;
  return { day, k, questions, added, shown, tapped, wa, review };
}

const SUMMARY_TOOL = {
  name: "daily_summary",
  description: "Summary of one day of customer questions for the store's business team. Call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "One or two plain sentences: the main thing customers wanted today." },
      top_asks: {
        type: "array", maxItems: 6, description: "What customers asked about most, biggest first.",
        items: { type: "object", properties: {
          topic: { type: "string" }, count: { type: "integer", description: "Approximate number of questions." },
          example: { type: "string", description: "One real customer question, copied as typed." } }, required: ["topic", "count"] },
      },
      products_wanted: { type: "array", maxItems: 8, items: { type: "string" }, description: "Specific products, shades or finishes customers asked for (e.g. 'nude shades for dusky skin', 'long-lasting kajal')." },
      offer_ideas: { type: "array", maxItems: 5, items: { type: "string" }, description: "Signals useful for planning offers: budgets mentioned, coupon/discount questions, gifting occasions, bundles wanted. State the signal, then a short idea." },
      website_fixes: { type: "array", maxItems: 6, items: { type: "string" }, description: "Things on the website that confused customers or info they could not find (sizes, shelf life, delivery, shade info)." },
      not_sold: { type: "array", maxItems: 6, items: { type: "string" }, description: "Things customers wanted that the store doesn't sell." },
    },
    required: ["headline", "top_asks"],
  },
};

async function summarise(data, ask) {
  if (!data.questions.length) return null;
  const system = `You summarise one day of customer questions typed into "Pari", the AI beauty guide on parulgargbeauty.com (PARIÉ by Parul Garg Beauty, an Indian makeup brand). Readers are the business team (marketing, offers, website). Write in plain, simple English. Only use what the questions show — never invent numbers, products or quotes. Counts are approximate. Ignore test messages and gibberish. Questions may be in Hindi or Hinglish; summarise them in English.`;
  const user = `Date: ${data.day}. ${data.questions.length} customer questions:\n\n` + data.questions.map((x, i) => `${i + 1}. ${x}`).join("\n") +
    (data.review ? `\n\nNotes from Pari's own nightly review (info gaps and missing products she noticed): ${JSON.stringify({ gaps: data.review.gaps, missing: data.review.missing })}` : "");
  return ask(system, user.slice(0, 60000), SUMMARY_TOOL);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
function prettyDay(day) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function renderHtml(data, s, name) {
  const k = data.k;
  const section = (title, items) => items && items.length
    ? `<h3 style="font-size:15px;margin:22px 0 8px;color:#0c544e">${title}</h3><ul style="margin:0;padding-left:20px">${items.map((x) => `<li style="margin:4px 0">${x}</li>`).join("")}</ul>` : "";
  const tile = (v, l) => `<td style="padding:10px 12px;background:#f4f8f7;border-radius:6px;text-align:center"><div style="font-size:20px;font-weight:700;color:#1f2328">${v}</div><div style="font-size:11.5px;color:#59636e">${l}</div></td>`;
  const mobilePct = Number(k.chats) ? Math.round((100 * k.mobile) / k.chats) + "%" : "-";
  return `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:Arial,Helvetica,sans-serif;color:#1f2328">
<div style="max-width:640px;margin:0 auto;padding:20px 16px">
 <div style="background:#0c544e;color:#fff;border-radius:8px 8px 0 0;padding:16px 20px">
  <div style="font-size:12px;opacity:.85">${esc(name)} · AI beauty guide on parulgargbeauty.com</div>
  <div style="font-size:19px;font-weight:700;margin-top:4px">What customers asked · ${esc(prettyDay(data.day))}</div>
 </div>
 <div style="background:#fff;border-radius:0 0 8px 8px;padding:18px 20px;font-size:14px;line-height:1.55">
  ${!data.questions.length ? `<p>No customer chats on this day.</p>` : `
  <p style="font-size:15px;margin:0 0 14px">${esc(s?.headline || "")}</p>
  <table role="presentation" cellspacing="6" style="width:100%;border-collapse:separate"><tr>
   ${tile(k.chats, "chats")}${tile(k.questions, "questions")}${tile(k.atc, "added to cart")}${tile(inr(k.atc_value), "cart value added")}
  </tr><tr>
   ${tile(k.opens, "chat opened")}${tile(mobilePct, "on mobile")}${tile(k.whatsapp, "sent to WhatsApp")}${tile(k.links, "links tapped")}
  </tr></table>
  ${section("What customers asked about most", (s?.top_asks || []).map((a) => `<b>${esc(a.topic)}</b> — about ${Number(a.count) || 1}${a.example ? ` <span style="color:#59636e">(e.g. “${esc(a.example)}”)</span>` : ""}`))}
  ${section("Products &amp; shades customers wanted", (s?.products_wanted || []).map(esc))}
  ${section("Signals for planning offers", (s?.offer_ideas || []).map(esc))}
  ${section("Website improvements needed", (s?.website_fixes || []).map(esc))}
  ${section("Asked for, but we don’t sell", (s?.not_sold || []).map(esc))}
  ${section("Most added to cart from the chat", data.added.map((a) => `${esc(a.title)} — ${a.n}`))}
  ${section("Most recommended by Pari", data.shown.map((a) => `${esc(a.title)} — ${a.n}×`))}
  ${section("Promo bar &amp; shortcut taps", data.tapped.map((a) => `${esc(a.label)} — ${a.n}`))}
  ${section("Handed to the WhatsApp team", data.wa.map((q) => `“${esc(q)}”`))}`}
  <p style="font-size:12px;color:#59636e;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
   Sent automatically every morning by ${esc(name)}. Counts are approximate and summarised by AI from customer chats; phone numbers and emails are hidden. Test chats are excluded.</p>
 </div></div></body></html>`;
}

function renderText(data, s) {
  const k = data.k, L = [];
  L.push(`What customers asked Pari — ${prettyDay(data.day)}`, "");
  if (!data.questions.length) return L.concat("No customer chats on this day.").join("\n");
  L.push(s?.headline || "", "", `Chats: ${k.chats} | Questions: ${k.questions} | Added to cart: ${k.atc} (${inr(k.atc_value)}) | WhatsApp: ${k.whatsapp}`);
  const sec = (t, a) => { if (a && a.length) L.push("", t, ...a.map((x) => "- " + x)); };
  sec("What customers asked about most", (s?.top_asks || []).map((a) => `${a.topic} — about ${a.count}${a.example ? ` (e.g. "${a.example}")` : ""}`));
  sec("Products & shades wanted", s?.products_wanted); sec("Signals for offers", s?.offer_ideas);
  sec("Website improvements needed", s?.website_fixes); sec("Asked for, but we don't sell", s?.not_sold);
  sec("Most added to cart", data.added.map((a) => `${a.title} — ${a.n}`));
  return L.join("\n");
}

// Builds the email for a day. Used for the preview page and for sending.
export async function buildReport(day, ask, name) {
  if (!db()) throw new Error("Tracking database is off.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) day = ist(-1).day;
  const data = await dayData(day);
  const s = await summarise(data, ask);
  return { day, subject: process.env.REPORT_SUBJECT ? `${process.env.REPORT_SUBJECT}` : `${name} daily summary: what customers asked · ${prettyDay(day)}`, html: renderHtml(data, s, name), text: renderText(data, s), chats: Number(data.k.chats) };
}

export async function sendReport(day, ask, name) {
  if (!emailConfigured()) throw new Error("Email isn't set up yet: add SMTP_USER, SMTP_PASS and REPORT_TO on Render.");
  if (sending) throw new Error("Already sending — try again in a minute.");
  sending = true;
  const pool = db();
  try {
    const r = await buildReport(day, ask, name);
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await transport.sendMail({ from: process.env.REPORT_FROM || SMTP_USER, to: TO, cc: CC, subject: r.subject, html: r.html, text: r.text });
    await pool.query(`insert into pari.emails (day, sent_at, recipients, error) values ($1, now(), $2, null)
      on conflict (day) do update set sent_at=now(), recipients=$2, error=null`, [r.day, [...TO, ...CC].join(", ")]);
    console.log(`[report] sent ${r.day} to ${TO.length + CC.length} people`);
    return { ok: true, day: r.day, to: TO, cc: CC };
  } catch (e) {
    await pool.query(`insert into pari.emails (day, error) values ($1,$2) on conflict (day) do update set error=$2`,
      [/^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) ? day : ist(-1).day, e.message.slice(0, 300)]).catch(() => {});
    throw e;
  } finally { sending = false; }
}

// Called every 10 minutes: after REPORT_TIME (IST), send yesterday's email once.
export async function maybeSendDaily(ask, name) {
  const pool = db(); if (!pool || !emailConfigured() || sending) return;
  const now = ist(0);
  if (now.mins < REPORT_TIME[0] * 60 + (REPORT_TIME[1] || 0)) return;
  const day = ist(-1).day;
  const { rows } = await pool.query(`select sent_at, error from pari.emails where day=$1`, [day]);
  if (rows[0] && (rows[0].sent_at || rows[0].error)) return; // sent, or failed (shown on dashboard; use "Send now" to retry)
  await sendReport(day, ask, name).catch((e) => console.error("[report] daily send failed:", e.message));
}

export async function emailStatus() {
  const pool = db(); if (!pool) return [];
  return (await pool.query(`select to_char(day,'YYYY-MM-DD') as day, sent_at, recipients, error from pari.emails order by day desc limit 7`)).rows;
}
