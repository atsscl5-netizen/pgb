/* PGB Beauty Advisor - chat panel. Loaded only after the shopper taps the launcher. */
(function () {
  if (window.PGBAdvisor) return;

  var API = "", NAME = "Pari", launcher = null, panel, backdrop, list, form, input, sendBtn;
  var history = []; // [{role, content}] sent to the backend
  var busy = false;
  var STORE_KEY = "pgbAdvisorChat";
  var STARTERS = ["Diwali gifts under ₹999", "Bridal / festive look"];
  // Shortcut buttons under the header. Edited in the theme editor (PGB Beauty Advisor > Shortcut buttons).
  // "deals:60" = in-stock products 60%+ off; "deals:50-59" = 50–59% off (picked live from prices by the backend).
  var DEFAULT_LINKS = "60% OFF | deals:60\n50% OFF | deals:50-59\nBuy 3 @ ₹999 | /collections/sale\nOffers & coupons | ask\nBestsellers | /collections/bestsellers";
  var PROMO_TEXT = "", PROMO_URL = "", LINKS = DEFAULT_LINKS;
  var mobile = window.matchMedia("(max-width: 749px)");
  var SID = "", CART = "";
  // Customer team on WhatsApp (same number as the footer / FAQ "Still have questions?"). Shown when Pari can't help.
  var WA_NUMBER = "919599001222";
  var HUMAN_Q = /\b(order|orders|track|tracking|deliver|delivery|shipping|ship|shipped|courier|refund|return|replace|replacement|exchange|damag|broken|leak|wrong item|missing|cancel|payment|paid|cod|cash on delivery|invoice|policy|policies|complain|complaint|coupon|discount code|bulk|wholesale|franchise|contact|customer care|support)/i;
  var HUMAN_A = /(can'?t|cannot|unable to|not able to|don'?t have|do not have|not sure|no information|customer (support|care|team)|contact page|reach out|get in touch|our team|whatsapp)/i;
  // Questions Pari now answers herself (offers, coupons, shipping, policies) — no WhatsApp button for these
  // unless her reply says she can't help.
  var SELF_Q = /\b(coupon|discount code|offer|shipping|cod|cash on delivery|policy|policies|return|exchange|cancel)/i;

  // ---- Tracking (anonymous): a random chat ID per browser session, sent with each message/event ----
  function sessionId() {
    try {
      var s = sessionStorage.getItem("pgbAdvisorSid");
      if (!s) {
        s = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem("pgbAdvisorSid", s);
      }
      return s;
    } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  }
  function cartToken() {
    var root = (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";
    return fetch(root + "cart.js", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (c) { CART = (c && c.token) || ""; return CART; })
      .catch(function () { return ""; });
  }
  function track(type, data) {
    try {
      var body = JSON.stringify({ sid: SID, type: type, data: data || null, page: location.pathname, cart: CART });
      var url = API.replace(/\/$/, "") + "/event";
      // text/plain keeps it a "simple" request: no extra preflight, and it survives page changes.
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
      else fetch(url, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } });
    } catch (e) {}
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function rupees(n) {
    var v = Number(n);
    return "₹ " + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-20))); } catch (e) {}
  }
  function restore() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]") || []; } catch (e) { return []; }
  }
  // Only same-store links: "/collections/x" or a full parulgargbeauty.com URL.
  function safeHref(u) {
    u = String(u || "").trim();
    if (/^\/(?!\/)/.test(u)) return u;
    try { var a = new URL(u); if (a.hostname === location.hostname || /(^|\.)parulgargbeauty\.com$/.test(a.hostname)) return a.pathname + a.search; } catch (e) {}
    return "";
  }
  // Tapping a link opens the page; the chat stays saved and reopens from the bubble.
  function linkPill(label, href, where, cls) {
    var a = el("a", cls || "pgba-link", label);
    a.href = href;
    a.addEventListener("click", function () { track("link_click", { label: label, url: href, where: where }); });
    return a;
  }

  function build() {
    backdrop = el("div", "pgba-backdrop");
    backdrop.addEventListener("click", hide);

    panel = el("div", "pgba");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", NAME + ", PARIÉ beauty guide");

    var grab = el("button", "pgba-grab");
    grab.type = "button";
    grab.setAttribute("aria-label", "Close chat");
    grab.addEventListener("click", hide);

    var head = el("div", "pgba-head");
    var avatar = el("div", "pgba-avatar", NAME.charAt(0).toUpperCase());
    var title = el("div", "pgba-title");
    title.appendChild(el("strong", null, NAME));
    var sub = el("span", null, "PARIÉ beauty guide");
    sub.insertBefore(el("i", "pgba-dot"), sub.firstChild);
    title.appendChild(sub);
    var close = el("button", "pgba-x", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    close.addEventListener("click", hide);
    head.appendChild(avatar);
    head.appendChild(title);
    head.appendChild(close);

    // ---- Promo bar (e.g. Diwali Gift Packs) + shortcut buttons, always visible under the header ----
    var promo = null, promoHref = safeHref(PROMO_URL);
    if (PROMO_TEXT && promoHref) {
      promo = linkPill(PROMO_TEXT, promoHref, "promo_bar", "pgba-promo");
      promo.appendChild(el("span", "pgba-promo-go", "→"));
    }
    var quick = el("div", "pgba-quick");
    String(LINKS || DEFAULT_LINKS).split(/\r?\n/).forEach(function (line) {
      var parts = line.split("|"), label = (parts[0] || "").trim(), target = (parts[1] || "").trim();
      if (!label) return;
      var deal = target.match(/^deals:(\d{1,2})(?:-(\d{1,2}))?$/i);
      if (deal) {
        var d = el("button", "pgba-qbtn pgba-deal", label);
        d.type = "button";
        d.addEventListener("click", function () { track("link_click", { label: label, where: "deal_tab" }); showDeals(label, deal[1], deal[2]); });
        quick.appendChild(d);
      } else if (/^ask$/i.test(target) || !target) {
        var q = el("button", "pgba-qbtn", label);
        q.type = "button";
        q.addEventListener("click", function () { track("link_click", { label: label, where: "shortcut" }); ask(label); });
        quick.appendChild(q);
      } else {
        var href = safeHref(target);
        if (href) quick.appendChild(linkPill(label, href, "shortcut", "pgba-qbtn"));
      }
    });

    list = el("div", "pgba-list");
    list.setAttribute("aria-live", "polite");

    form = el("form", "pgba-form");
    input = el("input");
    input.type = "text";
    input.maxLength = 500;
    input.placeholder = "Ask " + NAME + " about shades, offers, gifts...";
    input.setAttribute("aria-label", "Your message");
    input.setAttribute("enterkeyhint", "send");
    sendBtn = el("button", null);
    sendBtn.type = "submit";
    sendBtn.setAttribute("aria-label", "Send");
    sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';
    form.appendChild(input);
    form.appendChild(sendBtn);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      ask(input.value);
    });

    var foot = el("div", "pgba-foot", "AI suggestions · please check product details before buying");

    panel.appendChild(grab);
    panel.appendChild(head);
    if (promo) panel.appendChild(promo);
    if (quick.children.length) panel.appendChild(quick);
    panel.appendChild(list);
    panel.appendChild(form);
    panel.appendChild(foot);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) hide();
    });

    var old = restore();
    if (old.length) {
      history = old;
      old.forEach(function (m) { bubble(m.role === "user" ? "me" : "bot", m.content.replace(/\s*\[(Showed|Links): [^\]]*\]/g, "")); });
    } else {
      welcome();
    }
  }

  function welcome() {
    var w = el("div", "pgba-welcome");
    w.appendChild(el("span", "pgba-wtag", "AI beauty guide"));
    w.appendChild(el("div", "pgba-wbig", "Hi, I'm " + NAME + " ✨"));
    w.appendChild(el("p", null, "Your PARIÉ beauty guide. Ask me about shades, gifts, offers & coupons, or any product question — I'll pick from our range for you."));
    list.appendChild(w);
    chips(STARTERS);
  }

  function bubble(who, text) {
    var b = el("div", "pgba-msg pgba-" + who, text);
    list.appendChild(b);
    list.scrollTop = list.scrollHeight;
    return b;
  }

  function waLink(q) {
    var msg = "Hi PARIÉ team, I need help" + (q ? ": " + String(q).slice(0, 300) : ".");
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg);
  }
  function waButton(q) {
    var a = el("a", "pgba-wa", "Chat with our team on WhatsApp");
    a.href = waLink(q);
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", function () { track("whatsapp", { q: String(q || "").slice(0, 200) }); });
    list.appendChild(a);
    list.scrollTop = list.scrollHeight;
    return a;
  }

  function chips(items) {
    if (!items || !items.length) return;
    var row = el("div", "pgba-chips");
    items.forEach(function (t) {
      var c = el("button", "pgba-chip", t);
      c.type = "button";
      c.addEventListener("click", function () { row.remove(); ask(t); });
      row.appendChild(c);
    });
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
  }

  // Store links Pari shares in a reply (collections, policies), shown as tappable pills.
  // Deal tab tapped: show in-stock products in that discount range straight in the chat.
  function showDeals(label, min, max) {
    if (busy) return;
    busy = true;
    bubble("me", label);
    var typing = typingDots();
    fetch(API.replace(/\/$/, "") + "/deals?min=" + encodeURIComponent(min) + (max ? "&max=" + encodeURIComponent(max) : ""))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typing.remove();
        var items = (d && d.products) || [];
        var text = items.length
          ? label + " right now — " + items.length + " pick" + (items.length > 1 ? "s" : "") + ", lowest price already applied:"
          : "Nothing in " + label + " right now. Have a look at our Buy 3 @ ₹999 store instead!";
        bubble("bot", text);
        if (items.length) cards(items); else links([{ title: "Buy 3 @ ₹999", url: "/collections/sale" }]);
        history.push({ role: "user", content: label });
        history.push({ role: "assistant", content: text + (items.length ? " [Showed: " + items.map(function (p) { return p.title; }).join("; ") + "]" : "") });
        save();
      })
      .catch(function () { typing.remove(); bubble("bot", "Sorry, I couldn't load the deals. Please try again."); })
      .then(function () { busy = false; });
  }

  function links(items) {
    if (!items || !items.length) return;
    var row = el("div", "pgba-links");
    items.forEach(function (l) {
      var href = safeHref(l.url);
      if (href) row.appendChild(linkPill((l.title || "Shop now") + " →", href, "reply"));
    });
    if (row.children.length) { list.appendChild(row); list.scrollTop = list.scrollHeight; }
  }

  function cards(products) {
    if (!products || !products.length) return;
    var wrap = el("div", "pgba-cards");
    products.forEach(function (p) {
      var card = el("div", "pgba-card");
      var a = el("a", "pgba-img");
      a.href = p.url;
      if (p.image) {
        var img = el("img");
        img.src = p.image; img.alt = p.title; img.loading = "lazy"; img.width = 120; img.height = 120;
        a.appendChild(img);
      }
      card.appendChild(a);
      var body = el("div", "pgba-body");
      var t = el("a", "pgba-name", p.title);
      t.href = p.url;
      body.appendChild(t);
      if (p.shade) body.appendChild(el("div", "pgba-shade", p.shade));
      // Price row like the store's own cards: "↓13%  ₹ 1,490  ₹ 1,290"
      var price = el("div", "pgba-price");
      var now = Number(p.price), was = Number(p.compare_at);
      if (was && was > now) {
        price.appendChild(el("span", "pgba-off", "↓" + Math.round((1 - now / was) * 100) + "%"));
        price.appendChild(el("s", null, rupees(was)));
      }
      price.appendChild(el("span", "pgba-now", rupees(now)));
      body.appendChild(price);
      var add = el("button", "pgba-add", "Add to cart");
      add.type = "button";
      add.addEventListener("click", function () { addToCart(p, add); });
      body.appendChild(add);
      card.appendChild(body);
      wrap.appendChild(card);
    });
    list.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
  }

  function addToCart(p, btn) {
    if (!p.variant_id) { window.location.href = p.url; return; }
    btn.disabled = true;
    btn.textContent = "Adding...";
    var root = (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";
    fetch(root + "cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // "_pari" is a hidden item note (underscore = not shown to shoppers). It travels into the order, so the
      // dashboard can count purchases that came from a Pari card.
      body: JSON.stringify({ items: [{ id: p.variant_id, quantity: 1, properties: { _pari: SID } }] })
    })
      .then(function (r) {
        if (!r.ok) { var e = new Error("add failed"); e.soldOut = r.status === 422; throw e; }
        return r.json();
      })
      .then(function () {
        btn.textContent = "Added ✓";
        track("add_to_cart", { variant_id: p.variant_id, handle: p.handle, title: p.title, price: p.price });
        // Shiprocket (Fastrr) smart cart: open its side cart, which re-reads the cart and shows the new item.
        // The chat closes first so it doesn't cover the cart; the bubble reopens it with the conversation kept.
        if (typeof window.slideShiprocketSmartCartInFrame === "function") {
          hide();
          try { window.slideShiprocketSmartCartInFrame(); return; } catch (e) {}
        }
        // Any other cart: ask it to refresh (harmless if nothing listens) and offer a link.
        try { document.documentElement.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true })); } catch (e) {}
        var link = el("a", "pgba-cartlink", "View cart →");
        link.href = root + "cart";
        btn.insertAdjacentElement("afterend", link);
      })
      .catch(function (err) {
        if (err && err.soldOut) { btn.textContent = "Sold out"; return; } // Shopify returns 422 when stock runs out
        btn.disabled = false;
        btn.textContent = "Add to cart";
        window.location.href = p.url; // fall back to the product page
      });
  }

  function typingDots() {
    var t = el("div", "pgba-msg pgba-bot pgba-typing");
    t.setAttribute("aria-label", NAME + " is typing");
    t.innerHTML = "<i></i><i></i><i></i>";
    list.appendChild(t);
    list.scrollTop = list.scrollHeight;
    return t;
  }

  function ask(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true;
    sendBtn.disabled = true;
    input.value = "";
    bubble("me", text);
    history.push({ role: "user", content: text });
    var typing = typingDots();

    fetch(API.replace(/\/$/, "") + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12), sid: SID, page: location.pathname, cart: CART })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        typing.remove();
        if (!res.ok) { var se = new Error(res.d && res.d.error); se.fromServer = true; throw se; }
        var d = res.d;
        bubble("bot", d.reply || "Here's what I found:");
        links(d.links);
        var noProducts = !(d.products && d.products.length);
        var answered = SELF_Q.test(text) && d.links && d.links.length && !HUMAN_A.test(d.reply || "");
        if (noProducts && !answered && (HUMAN_Q.test(text) || HUMAN_A.test(d.reply || ""))) waButton(text);
        cards(d.products);
        chips(d.suggestions);
        var memo = d.reply || "";
        if (d.products && d.products.length) {
          memo += " [Showed: " + d.products.map(function (p) { return p.title; }).join("; ") + "]";
        }
        history.push({ role: "assistant", content: memo });
        save();
      })
      .catch(function (err) {
        typing.remove();
        history.pop(); // drop the unanswered question so the next try starts clean
        var friendly = err && err.fromServer && err.message ? err.message : "Sorry, I couldn't connect. Please try again.";
        bubble("bot", friendly);
        waButton(text);
      })
      .then(function () {
        busy = false;
        sendBtn.disabled = false;
        if (!mobile.matches) input.focus();
      });
  }

  function show() {
    window.PGBAdvisorOpen = true;
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    if (mobile.matches) document.documentElement.classList.add("pgba-lock");
    if (launcher) launcher.style.display = "none";
    // On phones, don't pop the keyboard up straight away - let the shopper read and tap a chip first.
    if (!mobile.matches) setTimeout(function () { input.focus(); }, 50);
  }
  function hide() {
    window.PGBAdvisorOpen = false;
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.documentElement.classList.remove("pgba-lock");
    if (launcher) { launcher.style.display = ""; launcher.focus(); }
  }

  window.PGBAdvisor = {
    init: function (opts) {
      API = opts.api;
      SID = sessionId();
      NAME = opts.name || NAME;
      launcher = opts.launcher;
      // Promo bar: shown only when the theme passes text (an empty value = turned off in the theme editor).
      // Older snippet without the setting → Diwali default.
      if (opts.promoText === undefined) { PROMO_TEXT = "🪔 Diwali Gift Packs — Shop now"; PROMO_URL = "/collections/festive-gift-packs"; }
      else { PROMO_TEXT = opts.promoText || ""; PROMO_URL = opts.promoUrl || ""; }
      LINKS = opts.links && opts.links.trim() ? opts.links : DEFAULT_LINKS;
      build();
      show();
      cartToken().then(function () { track("open"); });
    },
    open: function () { show(); track("open"); }
  };
})();
