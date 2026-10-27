// Pari dashboard page (served by the backend at /dashboard?key=...). Styled like the PGB theme.
export function dashboardHtml(name) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${name} insights</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--g:#0c544e;--g2:#13756c;--pink:#b23a5b;--ink:#1f2328;--muted:#59636e;--line:rgba(26,26,26,.12);--page:#fafafa;--card:#fff}
*{box-sizing:border-box}body{margin:0;font-family:Poppins,sans-serif;background:var(--page);color:var(--ink)}
header{background:var(--g);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
header h1{font-size:18px;font-weight:600;margin:0;flex:1}
.av{width:36px;height:36px;border-radius:50%;background:#fff;color:var(--g);display:flex;align-items:center;justify-content:center;font-weight:700}
.range{display:flex;gap:6px}
.range button,.btn{font:inherit;font-size:13px;border:1px solid #fff;background:transparent;color:#fff;border-radius:60px;padding:6px 14px;cursor:pointer}
.range button.on{background:#fff;color:var(--g)}
main{max-width:1180px;margin:0 auto;padding:20px 16px 60px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.kpi{background:var(--card);border-radius:6px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.kpi .l{font-size:12px;color:var(--muted)}.kpi .v{font-size:26px;font-weight:600;margin-top:2px}.kpi .s{font-size:12px;color:var(--muted)}
.grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}@media(max-width:860px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border-radius:6px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.05);margin-bottom:16px;min-width:0}
.card h2{font-size:15px;font-weight:600;margin:0 0 4px}.card .sub{font-size:12px;color:var(--muted);margin:0 0 12px}
.tag{display:inline-block;background:var(--pink);color:#fff;font-size:10.5px;font-weight:700;text-transform:uppercase;border-radius:999px;padding:2px 8px;margin-left:6px;vertical-align:middle}
.chart{position:relative;height:190px;display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid var(--line);padding-top:10px}
.bar{flex:1;background:var(--g);border-radius:4px 4px 0 0;min-height:2px;position:relative;cursor:default}
.bar:hover{background:var(--g2)}
.xl{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px}
.tip{position:fixed;pointer-events:none;background:#1a1a1a;color:#fff;font-size:12px;padding:6px 9px;border-radius:6px;display:none;z-index:9}
.rows{display:flex;flex-direction:column;gap:8px}
.row{display:grid;grid-template-columns:1fr 46px;gap:10px;align-items:center;font-size:13px}
.row .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .track{grid-column:1/3;height:6px;background:#eef3f2;border-radius:4px;overflow:hidden;margin-top:-4px}
.row .fill{height:100%;background:var(--g);border-radius:4px}
.row .n{text-align:right;font-weight:600}
.summary{white-space:pre-wrap;font-size:13.5px;line-height:1.6}
.btn.dark{border-color:var(--g);background:var(--g);color:#fff}.btn.ghost{border-color:var(--g);color:var(--g)}
.convo{border-top:1px solid var(--line);padding:10px 0}
.convo summary{cursor:pointer;font-size:13px;display:flex;gap:8px;align-items:center;list-style:none}
.convo summary::-webkit-details-marker{display:none}
.convo .q{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill{font-size:11px;border-radius:999px;padding:2px 8px;background:#eef3f2;color:var(--g);white-space:nowrap}
.pill.cart{background:var(--g);color:#fff}
.msg{font-size:13px;margin:6px 0;padding:8px 11px;border-radius:10px;max-width:90%}
.msg.user{background:var(--g);color:#fff;margin-left:auto}.msg.assistant{background:#f2f2f2}
.msg .p{font-size:11.5px;color:var(--muted);margin-top:4px}
.note{font-size:13px;color:var(--muted);background:#fff7f9;border:1px solid #f1d3dc;border-radius:6px;padding:10px 12px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line)}
.empty{color:var(--muted);font-size:13px}
</style></head><body>
<header><div class="av">${name.charAt(0)}</div><h1>${name} &middot; insights</h1>
<div class="range"><button data-d="1">Today</button><button data-d="7" class="on">7 days</button><button data-d="30">30 days</button><button data-d="90">90 days</button></div>
<a class="btn" id="csv" href="#">Export CSV</a></header>
<main>
  <div class="kpis" id="kpis"></div>
  <div class="grid">
    <div>
      <div class="card"><h2>Chats per day</h2><p class="sub">Conversations where a shopper asked at least one question</p>
        <div class="chart" id="chart"></div><div class="xl" id="xl"></div></div>
      <div class="card"><h2>What shoppers are asking <span class="tag">AI summary</span></h2>
        <p class="sub">Pari reads the questions in this period and sums up the themes</p>
        <div id="summary" class="summary empty">Click the button to create a summary.</div>
        <p><button class="btn dark" id="sumBtn">Summarise questions</button></p></div>
      <div class="card"><h2>Conversations</h2><p class="sub">Latest 60 &middot; tap to read. Phone numbers &amp; emails are hidden automatically.</p><div id="convos"></div></div>
    </div>
    <div>
      <div class="card"><h2>Purchases from ${name}</h2><div id="purch"></div></div>
      <div class="card"><h2>Most added to cart from chat</h2><div class="rows" id="added"></div></div>
      <div class="card"><h2>Most recommended</h2><div class="rows" id="rec"></div></div>
      <div class="card"><h2>Handed to WhatsApp team</h2><p class="sub">Questions Pari couldn't answer (orders, returns, payments...)</p><div id="wa"></div></div>
      <div class="card"><h2>Pages where chats start</h2><div class="rows" id="pages"></div></div>
      <div class="card"><h2>Links tapped in chat</h2><p class="sub">Promo bar, shortcut buttons and links Pari shared (e.g. Karva Chauth Specials)</p><div class="rows" id="links"></div></div>
    </div>
  </div>
</main>
<div class="tip" id="tip"></div>
<script>
const KEY=new URLSearchParams(location.search).get('key')||'';
let DAYS=7;
const $=id=>document.getElementById(id);
const inr=n=>'\\u20B9 '+Math.round(Number(n)||0).toLocaleString('en-IN');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function rows(el,items,label,val,fmt){
  if(!items.length){el.innerHTML='<div class="empty">Nothing yet.</div>';return;}
  const max=Math.max(...items.map(i=>Number(i[val])||0),1);
  el.innerHTML=items.map(i=>'<div class="row"><span class="t" title="'+esc(i[label])+'">'+esc(i[label])+'</span><span class="n">'+(fmt?fmt(i):i[val])+'</span><div class="track"><div class="fill" style="width:'+(100*(Number(i[val])||0)/max)+'%"></div></div></div>').join('');
}
function kpis(k){
  const chats=+k.chats||0, carts=+k.carting_chats||0;
  const t=[['Chat opened',k.opens,'times the bubble was opened'],['Chats',chats,(+k.mobile_chats||0)+' on mobile'],
    ['Questions asked',k.questions,chats?(k.questions/chats).toFixed(1)+' per chat':''],
    ['Add to cart from chat',k.add_to_carts,chats?Math.round(100*carts/chats)+'% of chats added something':''],
    ['Cart value added',inr(k.cart_value),'value of items added from Pari'],
    ['Sent to WhatsApp team',k.whatsapp||0,'questions Pari handed to your team'],
    ['Links tapped',k.link_clicks||0,'promo bar, shortcuts & collection links']];
  $('kpis').innerHTML=t.map(x=>'<div class="kpi"><div class="l">'+x[0]+'</div><div class="v">'+x[1]+'</div><div class="s">'+x[2]+'</div></div>').join('');
}
function chart(daily){
  const max=Math.max(...daily.map(d=>+d.chats),1);
  $('chart').innerHTML=daily.map(d=>'<div class="bar" style="height:'+(100*d.chats/max)+'%" data-t="'+d.day+': '+d.chats+' chats, '+d.atc+' add-to-carts"></div>').join('');
  $('xl').innerHTML=daily.length?'<span>'+daily[0].day+'</span><span>'+daily[daily.length-1].day+'</span>':'';
  const tip=$('tip');
  $('chart').querySelectorAll('.bar').forEach(b=>{b.onmousemove=e=>{tip.style.display='block';tip.textContent=b.dataset.t;tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY-30)+'px'};b.onmouseleave=()=>tip.style.display='none';});
}
function purchases(d){
  const el=$('purch');
  if(!d.ordersEnabled){el.innerHTML='<div class="note">Purchases aren\\'t connected yet. Every item added from a '+${JSON.stringify(name)}+' card is already tagged, so once order access is added these numbers will fill in for past chats too.</div>';return;}
  const p=d.purchases||{};
  if(p.error){el.innerHTML='<div class="note">Couldn\\'t read orders: '+esc(p.error)+'</div>';return;}
  el.innerHTML='<div class="kpis" style="grid-template-columns:1fr 1fr;margin:0 0 10px"><div class="kpi"><div class="l">Bought via '+${JSON.stringify(name)}+'</div><div class="v">'+p.via_pari+'</div><div class="s">'+inr(p.via_pari_value)+' of chat items</div></div><div class="kpi"><div class="l">Bought after chatting</div><div class="v">'+p.after_chat+'</div><div class="s">'+inr(p.after_chat_value)+' order value</div></div></div>'+
   (p.orders&&p.orders.length?'<table><tr><th>Order</th><th>Type</th><th>Value</th></tr>'+p.orders.map(o=>'<tr><td>'+esc(o.name)+'</td><td>'+(o.kind==='via_pari'?'Via chat card':'After chat')+'</td><td>'+inr(o.kind==='via_pari'?o.pari_value:o.total)+'</td></tr>').join('')+'</table>':'<div class="empty">No orders yet in this period. Checked '+(p.scanned||0)+' orders.</div>');
}
function convos(list){
  if(!list.length){$('convos').innerHTML='<div class="empty">No chats yet in this period.</div>';return;}
  $('convos').innerHTML=list.map(c=>{const m=c.messages||[];const first=(m.find(x=>x.role==='user')||{}).content||'';
    return '<details class="convo"><summary><span class="q">'+esc(first)+'</span>'+(c.add_to_carts?'<span class="pill cart">'+c.add_to_carts+' added</span>':'')+'<span class="pill">'+esc(c.device)+'</span><span class="pill">'+new Date(c.started_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</span></summary>'+
    '<div style="display:flex;flex-direction:column">'+m.map(x=>'<div class="msg '+x.role+'">'+esc(x.content)+(x.products&&x.products.length?'<div class="p">Showed: '+x.products.map(p=>esc(p.title)).join(' · ')+'</div>':'')+'</div>').join('')+
    '<div class="msg" style="background:none;color:#59636e;font-size:11.5px;padding:0">Started on '+esc(c.first_page)+'</div></div></details>';}).join('');
}
async function load(){
  $('csv').href='/dashboard/export.csv?key='+encodeURIComponent(KEY)+'&days='+DAYS;
  const r=await fetch('/dashboard/data?key='+encodeURIComponent(KEY)+'&days='+DAYS); const d=await r.json();
  if(!r.ok){document.querySelector('main').innerHTML='<div class="card note">'+esc(d.error||'Not allowed')+'</div>';return;}
  if(!d.tracking){document.querySelector('main').innerHTML='<div class="card note">Tracking is off: the backend has no DATABASE_URL yet.</div>';return;}
  kpis(d.kpi);chart(d.daily);purchases(d);convos(d.convos);
  rows($('added'),d.added,'title','times',i=>i.times);
  rows($('rec'),d.recommended,'title','times');
  rows($('pages'),d.pages,'page','chats');
  rows($('links'),(d.links||[]).map(l=>({label:l.label+(l.where_from?' ('+l.where_from+')':''),times:l.times})),'label','times');
  $('wa').innerHTML=(d.whatsapp&&d.whatsapp.length)?d.whatsapp.map(w=>'<div class="row" style="display:block;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)">'+esc(w.q||'(no text)')+'<div style="font-size:11px;color:var(--muted)">'+new Date(w.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</div></div>').join(''):'<div class="empty">None yet.</div>';
  $('summary').className='summary empty';$('summary').textContent='Click the button to create a summary.';
}
document.querySelectorAll('.range button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.range button').forEach(x=>x.classList.remove('on'));b.classList.add('on');DAYS=+b.dataset.d;load();});
$('sumBtn').onclick=async()=>{const s=$('summary');s.className='summary empty';s.textContent='Reading the questions...';
  const r=await fetch('/dashboard/summary?key='+encodeURIComponent(KEY)+'&days='+DAYS,{method:'POST'});const d=await r.json();
  s.className='summary'+(d.summary?'':' empty');s.textContent=d.summary||d.error||'No summary.';};
load();
</script></body></html>`;
}
