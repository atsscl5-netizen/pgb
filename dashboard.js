// Pari dashboard page (served by the backend at /dashboard?key=...).
// One self-contained page: PGB green + rose, serif headings, tabs, SVG charts. Same API endpoints as before.
export function dashboardHtml(name) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${name} Insights</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--g:#0c544e;--g2:#13756c;--g3:#e6f1ef;--rose:#c2557a;--rose2:#fbe9ef;--gold:#c9a14a;--ink:#17201f;--muted:#6b7674;--line:#e8ecea;--page:#f6f4f1;--card:#fff;--shadow:0 1px 2px rgba(16,40,37,.04),0 8px 24px -12px rgba(16,40,37,.12)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Manrope,system-ui,sans-serif;background:var(--page);color:var(--ink);font-size:14px;line-height:1.5}
h1,h2,.serif{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.01em}
button{font:inherit;cursor:pointer}a{color:inherit}
/* hero */
.hero{background:radial-gradient(1200px 300px at 85% -40%,rgba(194,85,122,.35),transparent 60%),linear-gradient(135deg,#0a4741,#0c544e 55%,#13756c);color:#fff;padding:22px 20px 70px}
.wrap{max-width:1200px;margin:0 auto}
.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.logo{width:44px;height:44px;border-radius:14px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);display:grid;place-items:center;font-family:Fraunces,serif;font-size:22px}
.top h1{margin:0;font-size:24px;flex:1;min-width:180px}.top h1 small{display:block;font-family:Manrope,sans-serif;font-weight:500;font-size:12.5px;opacity:.75;letter-spacing:0}
.live{display:inline-flex;align-items:center;gap:6px;font-size:12px;background:rgba(255,255,255,.12);border-radius:99px;padding:5px 11px}
.live i{width:7px;height:7px;border-radius:50%;background:#7ef0c4;box-shadow:0 0 0 0 rgba(126,240,196,.7);animation:pulse 2s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 8px rgba(126,240,196,0)}100%{box-shadow:0 0 0 0 rgba(126,240,196,0)}}
.seg{display:flex;background:rgba(255,255,255,.12);border-radius:99px;padding:3px}
.seg button{border:0;background:none;color:#fff;padding:6px 13px;border-radius:99px;font-size:13px;font-weight:600;opacity:.8}
.seg button.on{background:#fff;color:var(--g);opacity:1}
.ghostbtn{border:1px solid rgba(255,255,255,.4);color:#fff;background:none;border-radius:99px;padding:6px 14px;font-size:13px;font-weight:600;text-decoration:none}
/* tabs */
.tabs{display:flex;gap:4px;margin-top:22px;overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tabs button{border:0;background:none;color:rgba(255,255,255,.75);padding:8px 14px;border-radius:10px;font-weight:600;white-space:nowrap}
.tabs button.on{background:rgba(255,255,255,.16);color:#fff}
main{max-width:1200px;margin:-48px auto 0;padding:0 16px 60px}
.panel{display:none}.panel.on{display:block;animation:fade .25s ease}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
/* cards */
.card{background:var(--card);border-radius:18px;padding:18px 20px;box-shadow:var(--shadow);margin-bottom:16px;min-width:0}
.card h2{font-size:18px;margin:0}.sub{color:var(--muted);font-size:12.5px;margin:2px 0 14px}
.head{display:flex;align-items:flex-start;gap:10px;justify-content:space-between;flex-wrap:wrap}
.chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:99px;padding:3px 9px;background:var(--rose2);color:var(--rose)}
.chip.g{background:var(--g3);color:var(--g)}
.g2{display:grid;grid-template-columns:1.55fr 1fr;gap:16px}.g2e{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.g2,.g2e{grid-template-columns:1fr}}
/* kpis */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--card);border-radius:18px;padding:16px 18px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.kpi .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--g3);color:var(--g);margin-bottom:10px}
.kpi.rose .ic{background:var(--rose2);color:var(--rose)}.kpi.gold .ic{background:#f7efdc;color:#9c7a2c}
.kpi .l{font-size:12.5px;color:var(--muted);font-weight:600}.kpi .v{font-family:Fraunces,serif;font-size:30px;font-weight:600;line-height:1.15;margin-top:2px}
.kpi .s{font-size:12px;color:var(--muted);margin-top:2px}
.kpi svg.spark{position:absolute;right:12px;top:16px;opacity:.9}
/* chart */
.chartbox{position:relative;height:240px}.chartbox svg{width:100%;height:100%;display:block;overflow:visible}
.legend{display:flex;gap:14px;font-size:12px;color:var(--muted);font-weight:600}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.tip{position:fixed;pointer-events:none;background:#14211f;color:#fff;font-size:12px;padding:8px 10px;border-radius:10px;display:none;z-index:9;box-shadow:0 8px 20px rgba(0,0,0,.2);line-height:1.45}
/* funnel */
.fun{display:flex;flex-direction:column;gap:10px}
.fstep{display:grid;grid-template-columns:118px 1fr 104px;gap:10px;align-items:center;font-size:13px}
.fstep .bar{height:30px;border-radius:9px;background:var(--g3);overflow:hidden}
.fstep .bar div{height:100%;border-radius:9px;background:linear-gradient(90deg,var(--g),var(--g2));transition:width .6s ease}
.fstep:nth-child(4) .bar div{background:linear-gradient(90deg,var(--rose),#d97a9b)}.fstep:nth-child(5) .bar div{background:linear-gradient(90deg,#9c7a2c,var(--gold))}
.fstep .n{text-align:right;font-weight:700}.fstep .p{font-size:11px;color:var(--muted);font-weight:500;display:block}
/* ranked rows */
.rows{display:flex;flex-direction:column;gap:12px}
.row{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;font-size:13px}
.row .r{width:22px;height:22px;border-radius:7px;background:var(--g3);color:var(--g);font-size:11px;font-weight:700;display:grid;place-items:center}
.row .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}.row .n{font-weight:700}
.row .track{grid-column:2/4;height:5px;background:#f0f2f1;border-radius:4px;overflow:hidden;margin-top:-6px}
.row .fill{height:100%;background:var(--g);border-radius:4px}.rows.rose .fill{background:var(--rose)}.rows.rose .r{background:var(--rose2);color:var(--rose)}
.empty{color:var(--muted);font-size:13px}
/* list items */
.li{padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}.li:last-child{border:0}.li .m{font-size:11.5px;color:var(--muted);margin-top:2px}
.note{font-size:13px;color:#7a3a52;background:var(--rose2);border-radius:12px;padding:12px 14px}
/* buttons */
.btn{border:0;border-radius:99px;padding:9px 16px;font-weight:700;font-size:13px;background:var(--g);color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn:hover{background:var(--g2)}.btn:disabled{opacity:.6;cursor:wait}
.btn.line{background:#fff;color:var(--g);box-shadow:inset 0 0 0 1px var(--g)}.btn.line:hover{background:var(--g3)}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
/* summary + lessons */
.summary{white-space:pre-wrap;font-size:13.5px;line-height:1.65}
.lesson{border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px;font-size:13px;display:grid;grid-template-columns:28px 1fr;gap:10px}
.lesson .num{width:28px;height:28px;border-radius:9px;background:var(--g3);color:var(--g);display:grid;place-items:center;font-weight:700;font-size:12px}
.lesson .w{font-size:12px;color:var(--muted);margin-top:4px}.lesson .acts{display:flex;gap:6px;margin-top:8px}
.sbtn{border:1px solid var(--line);background:#fff;border-radius:99px;padding:4px 11px;font-size:12px;font-weight:600;color:var(--muted)}
.sbtn.ok{background:var(--g);border-color:var(--g);color:#fff}.sbtn:hover{border-color:var(--rose);color:var(--rose)}.sbtn.ok:hover{color:#fff}
.h3{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:16px 0 8px}
.dot{padding:5px 0 5px 16px;position:relative;font-size:13px}.dot:before{content:"";position:absolute;left:2px;top:12px;width:6px;height:6px;border-radius:50%;background:var(--rose)}
/* conversations */
.search{width:100%;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font:inherit;margin-bottom:12px;background:#fbfbfa}
.search:focus{outline:2px solid var(--g3);border-color:var(--g)}
.filters{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.filters button{border:1px solid var(--line);background:#fff;border-radius:99px;padding:5px 12px;font-size:12px;font-weight:600;color:var(--muted)}
.filters button.on{background:var(--ink);border-color:var(--ink);color:#fff}
.chatwrap{display:grid;grid-template-columns:340px 1fr;gap:16px;min-height:520px}@media(max-width:900px){.chatwrap{grid-template-columns:1fr}}
.clist{max-height:640px;overflow:auto;border-right:1px solid var(--line);padding-right:6px}@media(max-width:900px){.clist{border:0;max-height:360px}}
.citem{padding:11px 12px;border-radius:12px;cursor:pointer;margin-bottom:4px}.citem:hover{background:#f6f8f7}.citem.on{background:var(--g3)}
.citem .q{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.citem .m{font-size:11.5px;color:var(--muted);display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap}
.pill{font-size:10.5px;font-weight:700;border-radius:99px;padding:2px 8px;background:#f0f2f1;color:var(--muted)}.pill.cart{background:var(--rose);color:#fff}
.thread{display:flex;flex-direction:column;gap:8px;max-height:640px;overflow:auto;padding:4px}
.msg{font-size:13.5px;padding:10px 13px;border-radius:16px;max-width:82%}
.msg.user{background:var(--g);color:#fff;margin-left:auto;border-bottom-right-radius:5px}
.msg.assistant{background:#f3f4f2;border-bottom-left-radius:5px}
.msg .p{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.msg .p span{font-size:11px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:3px 8px;color:var(--ink)}
.tmeta{font-size:12px;color:var(--muted);margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:9px 4px;border-bottom:1px solid var(--line)}th{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.skel{background:linear-gradient(90deg,#f1f2f1,#f8f9f8,#f1f2f1);background-size:200% 100%;animation:sk 1.2s infinite;border-radius:10px;height:16px}
@keyframes sk{to{background-position:-200% 0}}
footer{text-align:center;color:var(--muted);font-size:12px;margin-top:24px}
</style></head><body>
<div class="hero"><div class="wrap">
  <div class="top">
    <div class="logo">${name.charAt(0)}</div>
    <h1>${name} Insights<small id="fromtxt">AI beauty advisor · Parul Garg Beauty</small></h1>
    <span class="live"><i></i>Live</span>
    <div class="seg" id="range"><button data-d="1">Today</button><button data-d="7" class="on">7 days</button><button data-d="30">30 days</button><button data-d="90">90 days</button></div>
    <a class="ghostbtn" id="csv" href="#">Export CSV</a>
  </div>
  <nav class="tabs" id="tabs">
    <button data-t="overview" class="on">Overview</button><button data-t="chats">Conversations</button>
    <button data-t="learning">Self-learning</button><button data-t="insights">Customer insights</button><button data-t="email">Daily email</button>
  </nav>
</div></div>
<main>
<!-- OVERVIEW -->
<section class="panel on" id="p-overview">
  <div class="kpis" id="kpis"><div class="kpi"><div class="skel"></div></div><div class="kpi"><div class="skel"></div></div><div class="kpi"><div class="skel"></div></div><div class="kpi"><div class="skel"></div></div></div>
  <div class="g2">
    <div class="card"><div class="head"><div><h2>Chats &amp; add-to-carts</h2><p class="sub">Per day, in this period</p></div>
      <div class="legend"><span><i style="background:var(--g)"></i>Chats</span><span><i style="background:var(--rose)"></i>Add to cart</span></div></div>
      <div class="chartbox" id="chart"></div></div>
    <div class="card"><div class="head"><div><h2>Shopper journey</h2><p class="sub">From opening the chat to buying</p></div></div><div class="fun" id="funnel"></div></div>
  </div>
  <div class="g2e">
    <div class="card"><div class="head"><div><h2>Sales from ${name}</h2><p class="sub">Orders matched to chats</p></div><span class="chip">Revenue</span></div><div id="purch"></div></div>
    <div class="card"><div class="head"><div><h2>Most added to cart</h2><p class="sub">Products shoppers added straight from the chat</p></div></div><div class="rows rose" id="added"></div></div>
  </div>
</section>
<!-- CONVERSATIONS -->
<section class="panel" id="p-chats">
  <div class="card"><div class="head"><div><h2>Conversations</h2><p class="sub">Latest 60 in this period · phone numbers &amp; emails are hidden automatically</p></div></div>
    <div class="chatwrap"><div><input class="search" id="q" placeholder="Search chats, e.g. sindoor, coupon, foundation">
      <div class="filters" id="cf"><button data-f="all" class="on">All</button><button data-f="cart">Added to cart</button><button data-f="mobile">Mobile</button></div>
      <div class="clist" id="clist"></div></div>
      <div><div class="tmeta" id="tmeta"></div><div class="thread" id="thread"><div class="empty">Pick a chat on the left.</div></div></div></div></div>
</section>
<!-- LEARNING -->
<section class="panel" id="p-learning">
  <div class="g2">
    <div class="card"><div class="head"><div><h2>${name}'s nightly review</h2><p class="sub" id="learnSub">Every night ${name} reviews the day's chats and writes lessons for tomorrow.</p></div><span class="chip g">Self-improving</span></div>
      <div class="h3" id="repHead">Latest review</div><div id="learnReport" class="summary empty">Loading…</div>
      <div class="h3">Info your team should add</div><div id="learnGaps" class="empty">–</div>
      <div class="h3">Shoppers wanted, we don't sell</div><div id="learnMissing" class="empty">–</div>
      <div class="btns"><button class="btn" id="learnBtn">Review today's chats now</button></div></div>
    <div class="card"><div class="head"><div><h2>Lessons ${name} follows</h2><p class="sub">Remove any you disagree with</p></div><span class="chip" id="lcount">0</span></div>
      <div id="lsugWrap" style="display:none"><div class="h3">Waiting for your OK</div><div id="lsug"></div></div>
      <div id="lact" class="empty">Loading…</div></div>
  </div>
</section>
<!-- INSIGHTS -->
<section class="panel" id="p-insights">
  <div class="card"><div class="head"><div><h2>What shoppers are asking</h2><p class="sub">${name} reads every question in this period and sums up the themes</p></div><span class="chip">AI summary</span></div>
    <div id="summary" class="summary empty">Tap the button to create a summary.</div><div class="btns"><button class="btn" id="sumBtn">Summarise questions</button></div></div>
  <div class="g2e">
    <div class="card"><h2>Most recommended</h2><p class="sub">Products ${name} showed most</p><div class="rows" id="rec"></div></div>
    <div class="card"><h2>Handed to WhatsApp team</h2><p class="sub">Questions ${name} passed to your team</p><div id="wa"></div></div>
    <div class="card"><h2>Pages where chats start</h2><p class="sub">Where shoppers open the chat</p><div class="rows" id="pages"></div></div>
    <div class="card"><h2>Links tapped in chat</h2><p class="sub">Promo bar, deal tabs, shortcuts &amp; links</p><div class="rows rose" id="links"></div></div>
  </div>
</section>
<!-- EMAIL -->
<section class="panel" id="p-email">
  <div class="card"><div class="head"><div><h2>Daily email to the team</h2><p class="sub" id="mailSub">Loading…</p></div><span class="chip g">Every morning</span></div>
    <div id="mailLog" class="empty"></div>
    <div class="btns"><a class="btn line" id="mailPrev" target="_blank" rel="noopener" href="#">Preview yesterday's email</a><button class="btn" id="mailSend">Send yesterday's email now</button></div></div>
</section>
<footer>${name} · built in-house for Parul Garg Beauty</footer>
</main>
<div class="tip" id="tip"></div>
<script>
var NAME=${JSON.stringify(name)};
var KEY=new URLSearchParams(location.search).get('key')||'';
var DAYS=7, CONVOS=[], CF='all', SEL=null;
function $(id){return document.getElementById(id);}
function api(p){return '/dashboard/'+p+(p.indexOf('?')>-1?'&':'?')+'key='+encodeURIComponent(KEY);}
function num(n){return (Number(n)||0).toLocaleString('en-IN');}
function inr(n){return '\\u20B9'+Math.round(Number(n)||0).toLocaleString('en-IN');}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function when(t){return new Date(t).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});}
var IC={chat:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
 cart:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h11l2-8H6.2"/></svg>',
 rupee:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12M6 9h12M14 20 7 13h3a4 4 0 0 0 0-8"/></svg>',
 eye:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'};
function spark(vals,color){if(!vals||vals.length<2)return '';var w=70,h=26,mx=Math.max.apply(null,vals.concat([1]));
  var pts=vals.map(function(v,i){return (i*w/(vals.length-1)).toFixed(1)+','+(h-2-(v/mx)*(h-4)).toFixed(1);}).join(' ');
  return '<svg class="spark" width="'+w+'" height="'+h+'"><polyline fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="'+pts+'"/></svg>';}
function kpis(k,daily){
  var chats=+k.chats||0, carts=+k.carting_chats||0;
  var c=daily.map(function(d){return +d.chats;}), a=daily.map(function(d){return +d.atc;});
  var t=[['','chat','Chats',num(chats),(+k.mobile_chats?Math.round(100*k.mobile_chats/Math.max(chats,1))+'% on mobile · ':'')+(chats?(k.questions/chats).toFixed(1)+' questions each':''),spark(c,'#0c544e')],
    ['rose','cart','Add to cart',num(k.add_to_carts),chats?Math.round(100*carts/chats)+'% of chats added something':'',spark(a,'#c2557a')],
    ['gold','rupee','Cart value added',inr(k.cart_value),'items added from '+NAME,''],
    ['','eye','Chat opened',num(k.opens),num(k.link_clicks)+' links tapped · '+num(k.whatsapp)+' to WhatsApp','']];
  $('kpis').innerHTML=t.map(function(x){return '<div class="kpi '+x[0]+'">'+x[5]+'<div class="ic">'+IC[x[1]]+'</div><div class="l">'+x[2]+'</div><div class="v">'+x[3]+'</div><div class="s">'+x[4]+'</div></div>';}).join('');
}
function chart(daily){
  var box=$('chart'); if(!daily.length){box.innerHTML='<div class="empty">No data yet.</div>';return;}
  var W=box.clientWidth||600,H=240,pl=30,pr=8,pt=12,pb=26,iw=W-pl-pr,ih=H-pt-pb;
  var mx=Math.max.apply(null,daily.map(function(d){return Math.max(+d.chats,+d.atc);}).concat([4])); mx=Math.ceil(mx/4)*4;
  var n=daily.length, x=function(i){return pl+(n===1?iw/2:i*iw/(n-1));}, y=function(v){return pt+ih-(v/mx)*ih;};
  function path(key){var p='';daily.forEach(function(d,i){var X=x(i),Y=y(+d[key]);if(!i){p='M'+X+','+Y;return;}var px=x(i-1),py=y(+daily[i-1][key]),cx=(px+X)/2;p+=' C'+cx+','+py+' '+cx+','+Y+' '+X+','+Y;});return p;}
  var s='<svg viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c544e" stop-opacity=".28"/><stop offset="1" stop-color="#0c544e" stop-opacity="0"/></linearGradient></defs>';
  for(var g=0;g<=4;g++){var gy=pt+ih*g/4;s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+gy+'" y2="'+gy+'" stroke="#eef0ef"/><text x="'+(pl-6)+'" y="'+(gy+4)+'" font-size="10" fill="#9aa3a1" text-anchor="end">'+Math.round(mx*(4-g)/4)+'</text>';}
  var cp=path('chats'); s+='<path d="'+cp+' L'+x(n-1)+','+(pt+ih)+' L'+x(0)+','+(pt+ih)+' Z" fill="url(#ga)"/>';
  s+='<path d="'+cp+'" fill="none" stroke="#0c544e" stroke-width="2.5" stroke-linecap="round"/>';
  s+='<path d="'+path('atc')+'" fill="none" stroke="#c2557a" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 0"/>';
  var step=Math.max(1,Math.ceil(n/7));
  daily.forEach(function(d,i){if(i%step===0||i===n-1){s+='<text x="'+x(i)+'" y="'+(H-6)+'" font-size="10.5" fill="#9aa3a1" text-anchor="middle">'+new Date(d.day+'T00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})+'</text>';}
    s+='<circle cx="'+x(i)+'" cy="'+y(+d.chats)+'" r="3.5" fill="#fff" stroke="#0c544e" stroke-width="2"/>';
    s+='<rect x="'+(x(i)-iw/n/2)+'" y="'+pt+'" width="'+(iw/n)+'" height="'+ih+'" fill="transparent" data-i="'+i+'"/>';});
  box.innerHTML=s+'</svg>';
  var tip=$('tip');
  box.querySelectorAll('rect[data-i]').forEach(function(r){var d=daily[+r.dataset.i];
    r.onmousemove=function(e){tip.style.display='block';tip.innerHTML='<b>'+new Date(d.day+'T00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})+'</b><br>'+d.chats+' chats · '+d.atc+' add-to-carts';tip.style.left=Math.min(e.clientX+14,innerWidth-170)+'px';tip.style.top=(e.clientY-44)+'px';};
    r.onmouseleave=function(){tip.style.display='none';};});
}
function funnel(k,p){
  var bought=p&&!p.error?(+p.via_pari||0)+(+p.after_chat||0):null;
  var st=[['Opened chat',+k.opens],['Asked a question',+k.chats],['Tapped a link',+k.link_clicks],['Added to cart',+k.carting_chats],['Bought',bought]];
  var top=Math.max(st[0][1]||0,1);
  $('funnel').innerHTML=st.map(function(s,i){var v=s[1];
    var pct=v==null?'':(i?Math.round(100*v/Math.max(st[i-1][1]||1,1))+'% of prev.':'100%');
    return '<div class="fstep"><span>'+s[0]+'</span><div class="bar"><div style="width:'+(v==null?0:Math.max(2,100*v/top))+'%"></div></div><span class="n">'+(v==null?'–':num(v))+'<span class="p">'+(v==null?'connect orders':pct)+'</span></span></div>';}).join('');
}
function rows(el,items,label,val,fmt){
  if(!items||!items.length){el.innerHTML='<div class="empty">Nothing yet.</div>';return;}
  var mx=Math.max.apply(null,items.map(function(i){return Number(i[val])||0;}).concat([1]));
  el.innerHTML=items.map(function(i,ix){return '<div class="row"><span class="r">'+(ix+1)+'</span><span class="t" title="'+esc(i[label])+'">'+esc(i[label])+'</span><span class="n">'+(fmt?fmt(i):num(i[val]))+'</span><div class="track"><div class="fill" style="width:'+(100*(Number(i[val])||0)/mx)+'%"></div></div></div>';}).join('');
}
function purchases(d){
  var el=$('purch');
  if(!d.ordersEnabled){el.innerHTML='<div class="note">Orders aren\\'t connected yet. Items added from '+esc(NAME)+'\\'s cards are already tagged, so once the Shopify token is added this fills in for past chats too.</div>';return;}
  var p=d.purchases||{}; if(p.error){el.innerHTML='<div class="note">Couldn\\'t read orders: '+esc(p.error)+'</div>';return;}
  el.innerHTML='<div class="kpis" style="grid-template-columns:1fr 1fr;margin:0 0 12px"><div class="kpi rose" style="box-shadow:none;background:var(--rose2)"><div class="l">Bought via '+esc(NAME)+'</div><div class="v">'+num(p.via_pari)+'</div><div class="s">'+inr(p.via_pari_value)+' of chat items</div></div><div class="kpi" style="box-shadow:none;background:var(--g3)"><div class="l">Bought after chatting</div><div class="v">'+num(p.after_chat)+'</div><div class="s">'+inr(p.after_chat_value)+' order value</div></div></div>'+
    (p.orders&&p.orders.length?'<table><tr><th>Order</th><th>Type</th><th>Value</th></tr>'+p.orders.slice(0,8).map(function(o){return '<tr><td><b>'+esc(o.name)+'</b><div class="m" style="font-size:11px;color:var(--muted)">'+when(o.at)+'</div></td><td><span class="pill'+(o.kind==='via_pari'?' cart':'')+'">'+(o.kind==='via_pari'?'Via chat card':'After chat')+'</span></td><td>'+inr(o.kind==='via_pari'?o.pari_value:o.total)+'</td></tr>';}).join('')+'</table>':'<div class="empty">No matched orders in this period yet ('+num(p.scanned)+' orders checked).</div>');
}
function firstQ(c){var m=c.messages||[];for(var i=0;i<m.length;i++)if(m[i].role==='user')return m[i].content;return '';}
function renderList(){
  var q=$('q').value.trim().toLowerCase();
  var list=CONVOS.filter(function(c){if(CF==='cart'&&!c.add_to_carts)return false;if(CF==='mobile'&&c.device!=='mobile')return false;
    if(!q)return true;return (c.messages||[]).some(function(m){return String(m.content).toLowerCase().indexOf(q)>-1;});});
  $('clist').innerHTML=list.length?list.map(function(c){return '<div class="citem'+(SEL===c.sid?' on':'')+'" data-s="'+esc(c.sid)+'"><div class="q">'+esc(firstQ(c)||'(no question)')+'</div><div class="m">'+when(c.started_at)+' · '+esc(c.device)+' · '+(c.messages||[]).filter(function(m){return m.role==='user';}).length+' msgs'+(c.add_to_carts?' <span class="pill cart">'+c.add_to_carts+' added</span>':'')+'</div></div>';}).join(''):'<div class="empty">No chats match.</div>';
  $('clist').querySelectorAll('.citem').forEach(function(el){el.onclick=function(){SEL=el.dataset.s;renderList();showThread();};});
}
function showThread(){
  var c=CONVOS.filter(function(x){return x.sid===SEL;})[0]; if(!c)return;
  $('tmeta').textContent='Started '+when(c.started_at)+' on '+(c.first_page||'?')+' · '+c.device;
  $('thread').innerHTML=(c.messages||[]).map(function(m){return '<div class="msg '+m.role+'">'+esc(m.content)+(m.products&&m.products.length?'<div class="p">'+m.products.map(function(p){return '<span>'+esc(p.title.length>48?p.title.slice(0,46)+'…':p.title)+(p.price?' · '+inr(p.price):'')+'</span>';}).join('')+'</div>':'')+'</div>';}).join('');
}
var LAST=null;
function load(){
  $('csv').href=api('export.csv?days='+DAYS);
  fetch(api('data?days='+DAYS)).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});}).then(function(x){var d=x.d;
    if(!x.ok){document.querySelector('main').innerHTML='<div class="card note">'+esc(d.error||'Not allowed')+'</div>';return;}
    if(!d.tracking){document.querySelector('main').innerHTML='<div class="card note">Tracking is off: the backend has no DATABASE_URL yet.</div>';return;}
    LAST=d; if(d.from)$('fromtxt').textContent='AI beauty advisor · counting from '+new Date(d.from+'T00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); kpis(d.kpi,d.daily); chart(d.daily); funnel(d.kpi,d.ordersEnabled?d.purchases:null); purchases(d);
    rows($('added'),d.added,'title','times',function(i){return num(i.times)+' · '+inr(i.value);});
    rows($('rec'),d.recommended,'title','times'); rows($('pages'),d.pages,'page','chats');
    rows($('links'),(d.links||[]).map(function(l){return {label:l.label+(l.where_from?' · '+l.where_from:''),times:l.times};}),'label','times');
    $('wa').innerHTML=(d.whatsapp&&d.whatsapp.length)?d.whatsapp.map(function(w){return '<div class="li">'+esc(w.q||'(no text)')+'<div class="m">'+when(w.at)+'</div></div>';}).join(''):'<div class="empty">None yet.</div>';
    CONVOS=d.convos||[]; if(!SEL&&CONVOS[0])SEL=CONVOS[0].sid; renderList(); showThread();
    $('summary').className='summary empty'; $('summary').textContent='Tap the button to create a summary.';
  }).catch(function(e){console.log(e);});
}
function loadLearning(){
  fetch(api('learning')).then(function(r){return r.json();}).then(function(d){
    if(!d.enabled){$('learnReport').textContent='Needs the tracking database.';return;}
    $('learnSub').textContent='Every night at '+d.time+' (India time) '+NAME+' reviews the day\\u2019s chats, finds where she let shoppers down and writes lessons. '+(d.auto?'New lessons switch on automatically and get merged when there are too many.':'New lessons wait for your OK.');
    var rep=(d.reports||[])[0];
    function li(a){return (a&&a.length)?a.map(function(x){return '<div class="dot">'+esc(x)+'</div>';}).join(''):'<div class="empty">Nothing.</div>';}
    if(rep){$('repHead').textContent='Latest review · '+rep.day+(rep.chats!=null?' · '+rep.chats+' chats':'');
      $('learnReport').className='summary'+(rep.summary?'':' empty');
      $('learnReport').textContent=rep.status==='running'?'Reviewing now…':rep.status==='error'?'Review failed: '+(rep.error||''):(rep.summary||'No summary.');
      $('learnGaps').innerHTML=li(rep.gaps);$('learnMissing').innerHTML=li(rep.missing);}
    else $('learnReport').textContent='No review yet. The first one runs tonight, or tap the button.';
    function card(l,i,btns){return '<div class="lesson"><span class="num">'+(i+1)+'</span><div><div>'+esc(l.lesson)+'</div>'+(l.why?'<div class="w">Why: '+esc(l.why)+(l.example?' · e.g. \\u201C'+esc(l.example)+'\\u201D':'')+'</div>':'')+'<div class="acts">'+btns+'</div></div></div>';}
    var sug=d.lessons.filter(function(l){return l.status==='suggested';}), act=d.lessons.filter(function(l){return l.status==='active';});
    $('lcount').textContent=act.length+' active';
    $('lsugWrap').style.display=sug.length?'':'none';
    $('lsug').innerHTML=sug.map(function(l,i){return card(l,i,'<button class="sbtn ok" data-id="'+l.id+'" data-a="approve">Approve</button><button class="sbtn" data-id="'+l.id+'" data-a="reject">Reject</button>');}).join('');
    $('lact').className=act.length?'':'empty';
    $('lact').innerHTML=act.length?act.map(function(l,i){return card(l,i,'<button class="sbtn" data-id="'+l.id+'" data-a="remove">Remove</button>');}).join(''):'None yet.';
    document.querySelectorAll('.sbtn[data-id]').forEach(function(b){b.onclick=function(){b.disabled=true;
      fetch(api('lessons?id='+b.dataset.id+'&action='+b.dataset.a),{method:'POST'}).then(function(r){if(!r.ok)return r.json().then(function(e){alert(e.error||'Could not save');});}).then(loadLearning);};});
  });
}
function loadMail(){
  fetch(api('report/status')).then(function(r){return r.json();}).then(function(d){
    $('mailPrev').href=api('report/preview');
    $('mailSub').textContent=d.configured?('Sent every day at '+d.time+' (India time) to '+d.to.join(', ')+(d.cc.length?' · cc '+d.cc.join(', '):'')+'. It covers the previous day.'):'Not switched on yet: add SMTP_USER, SMTP_PASS and REPORT_TO in Render \\u2192 Environment. You can already preview it.';
    $('mailSend').style.display=d.configured?'':'none';
    $('mailLog').className=(d.sent&&d.sent.length)?'':'empty';
    $('mailLog').innerHTML=(d.sent&&d.sent.length)?d.sent.map(function(x){return '<div class="li">'+esc(x.day)+' \\u2014 '+(x.sent_at?'\\u2713 sent to '+esc(x.recipients):'\\u2715 failed: '+esc(x.error||''))+'</div>';}).join(''):'No emails sent yet.';
  });
}
$('learnBtn').onclick=function(){var b=this;b.disabled=true;b.textContent='Reviewing today\\u2019s chats… (about a minute)';
  fetch(api('learning/run'),{method:'POST'}).then(function(r){return r.json().catch(function(){return {};}).then(function(d){if(!r.ok)alert(d.error||'Review failed');});}).then(function(){b.disabled=false;b.textContent='Review today\\u2019s chats now';loadLearning();});};
$('mailSend').onclick=function(){var b=this;b.disabled=true;b.textContent='Sending…';
  fetch(api('report/send'),{method:'POST'}).then(function(r){return r.json().catch(function(){return {};}).then(function(d){alert(r.ok?'Sent to '+d.to.concat(d.cc||[]).join(', '):(d.error||'Could not send'));});}).then(function(){b.disabled=false;b.textContent='Send yesterday\\u2019s email now';loadMail();});};
$('sumBtn').onclick=function(){var s=$('summary');s.className='summary empty';s.textContent='Reading the questions…';
  fetch(api('summary?days='+DAYS),{method:'POST'}).then(function(r){return r.json();}).then(function(d){s.className='summary'+(d.summary?'':' empty');s.textContent=d.summary||d.error||'No summary.';});};
document.querySelectorAll('#range button').forEach(function(b){b.onclick=function(){document.querySelectorAll('#range button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');DAYS=+b.dataset.d;SEL=null;load();};});
document.querySelectorAll('#tabs button').forEach(function(b){b.onclick=function(){document.querySelectorAll('#tabs button').forEach(function(x){x.classList.toggle('on',x===b);});
  document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('on',p.id==='p-'+b.dataset.t);});
  if(b.dataset.t==='overview'&&LAST)chart(LAST.daily);};});
$('q').oninput=renderList;
document.querySelectorAll('#cf button').forEach(function(b){b.onclick=function(){document.querySelectorAll('#cf button').forEach(function(x){x.classList.toggle('on',x===b);});CF=b.dataset.f;renderList();};});
var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){if(LAST)chart(LAST.daily);},150);});
load(); loadLearning(); loadMail();
</script></body></html>`;
}
