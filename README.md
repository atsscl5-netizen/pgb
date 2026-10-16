# PGB Beauty Advisor (AI chat for parulgargbeauty.com)

A chat bubble on the store. Shoppers ask things like *"wheatish skin, nude matte for office, under ₹600"*
and get a short answer plus real product cards with **Add to cart**.

## How it works

```
Shopper taps "Beauty Advisor" bubble
   → chat code loads (only now, never on page load)
   → message goes to the backend on Render
       → backend has your product list (read from your store every 30 min)
       → asks Claude (claude-haiku-5-5), which may only pick products from that list
   → reply + product cards shown in the chat → Add to cart uses Shopify's /cart/add.js
```

**Why a backend at all?** The Claude API key is a secret. Anything inside the Shopify theme is visible to
everyone, so the key must live on a small server. Render runs that server.

**Site speed:** on page load the theme only adds one small button (~1.5 KB, inline, **0 extra network
requests** — tested). The chat JS/CSS (~10 KB) download only after a shopper taps the bubble.

## Folder

| File | Goes where |
|---|---|
| `shopify-theme/sections/pgb-advisor.liquid` | Theme → Sections (on/off switch + backend URL in theme editor) |
| `shopify-theme/snippets/pgb-advisor.liquid` | Theme → Snippets (the chat button) |
| `shopify-theme/assets/pgb-advisor.js` | Theme → Assets |
| `shopify-theme/assets/pgb-advisor.css` | Theme → Assets |
| `shopify-theme/templates/collection.advisor-feed.liquid` | Theme → Templates (product list for the backend) |
| `backend/` | Deploy to Render as a Web Service |

## Setup — step by step

### 1. Add files to the DRAFT theme first
Online Store → Themes → draft theme → **⋯ → Edit code**:
1. **Templates → Add a new template** → type *collection*, name `advisor-feed`, choose **liquid** → paste the template file.
2. **Assets → Add a new asset** → upload `pgb-advisor.js` and `pgb-advisor.css`.
3. **Snippets → Add a new snippet** → `pgb-advisor` → paste the snippet.
4. **Sections → Add a new section** → `pgb-advisor` → paste the section file. Then in the theme editor,
   *Overlay group → Add section → PGB Beauty Advisor*. (No edit to `theme.liquid` needed.)
   Already done on the theme **"new theme updated 16oct26"**.

Check the feed: open `https://parulgargbeauty.com/collections/all?view=advisor-feed`
(it uses the **live** theme, so this only works once the template is in the live theme — see step 4).
You should see JSON starting with `{"per_page":250,...`.

### 2. Get a Claude API key
platform.claude.com → API keys → create key. Add some credit.

### 3. Deploy the backend on Render
1. Put the `backend/` folder in a GitHub repo.
2. Render → New → **Web Service** → pick the repo. Build command: *(empty)*, Start command: `node server.js`.
3. Environment variables:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key |
| `STORE_URL` | `https://parulgargbeauty.com` |
| `ALLOWED_ORIGINS` | `https://parulgargbeauty.com,https://www.parulgargbeauty.com` (+ your theme-preview domain while testing, e.g. `https://xxxx.myshopify.com`) |
| `MODEL` | `claude-haiku-5-5` (optional; default) |

4. Open `https://YOUR-SERVICE.onrender.com/health` → should show `"products": <number>`.

### 4. Connect theme → backend
Theme editor → Overlay group → **PGB Beauty Advisor** → paste the Render URL into *Advisor backend URL*.
The bubble stays hidden until this URL is filled in.
While testing on an unpublished theme, also set `FEED_THEME_ID` on Render to that theme's ID (e.g. `188602941660`).
Preview the draft theme, test, then publish (or copy the 4 files into the live theme).

## Changing things
- **Colours:** top of `pgb-advisor.css` (3 variables).
- **Starter buttons:** `STARTERS` at the top of `pgb-advisor.js`.
- **What the advisor says / rules:** `INSTRUCTIONS` in `backend/server.js`.
- **Hide on some pages:** wrap the render line, e.g. `{% unless template contains 'cart' %}{% render 'pgb-advisor' %}{% endunless %}`.

## Safety built in
- AI can only show products that exist in your live catalog (unknown handles are dropped by the backend).
- Only your domain can call the backend (CORS allow-list); 25 messages per 5 min per visitor.
- No orders, customer data or checkout access — product info only.
- No medical claims; order/return questions are sent to support.

## Local test (no API key needed)
```
cd backend
MOCK=1 MOCK_FEED_FILE=sample-feed.json node server.js
curl localhost:3000/health
```

## Things to verify on the real store
- Cart drawer refresh after "Add to cart": the widget fires a `cart:refresh` event. I'm not certain Impact
  listens for exactly that event — if the cart count doesn't update, the "View cart →" link still works.
- Render **free** plan sleeps when idle, so the first message after a quiet period can take ~30–60 s.
  A paid plan avoids that — check current pricing on render.com.
