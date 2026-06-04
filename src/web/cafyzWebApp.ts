export function getCafyzWebAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>Cafyz — Restaurant Management Platform</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg0:#030d1a;--bg1:#0a1628;--bg2:#07111f;--bg3:#0f1d38;--bg-sidebar:#040c17;
  --p:#3b82f6;--ps:#93c5fd;
  --pl:rgba(59,130,246,0.15);--pl2:rgba(59,130,246,0.28);
  --pbg:rgba(59,130,246,0.08);--pbg2:rgba(59,130,246,0.12);
  --t0:#F5F5F0;--t1:#B8B8C2;--t2:#8A8A9A;--t3:#5A5A6A;
  --ok:#2ECC8A;--warn:#F0A500;--err:#E84545;
  --line:rgba(255,255,255,0.06);--line2:rgba(255,255,255,0.1);
}
html,body{height:100%;background:var(--bg0);color:var(--t0);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
.serif{font-family:'Playfair Display',Georgia,serif}
.mono{font-family:'JetBrains Mono',monospace}
.hidden{display:none!important}

/* ─── APP SHELL ─── */
#app{display:flex;height:100vh;width:100vw;overflow:hidden}
.panel{display:none;flex:1;min-width:0;height:100%;overflow:hidden;flex-direction:column}
.panel.active{display:flex}

/* ─── SIDEBAR ─── */
.sidebar{width:240px;min-width:240px;background:var(--bg-sidebar);border-right:0.5px solid var(--pl);display:flex;flex-direction:column;padding:12px 12px 20px}
.sb-brand{display:flex;align-items:center;gap:12px;padding:8px;padding-bottom:22px;border-bottom:0.5px solid var(--pl);margin-bottom:16px}
.sb-logo{width:36px;height:36px;border-radius:8px;background:var(--p);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sb-logo span{font-family:'Playfair Display',serif;font-size:20px;color:#030d1a;font-weight:700}
.sb-name{font-family:'Playfair Display',serif;font-size:18px;color:var(--t0)}
.sb-sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t3);letter-spacing:1.5px;margin-top:4px}
.sb-nav{flex:1;display:flex;flex-direction:column;gap:2px}
.sb-item{display:flex;align-items:center;height:40px;padding:0 14px;border-radius:8px;cursor:pointer;position:relative;gap:14px;text-decoration:none}
.sb-item:hover{background:var(--pbg)}
.sb-item.active{background:rgba(59,130,246,0.08)}
.sb-item.active::before{content:'';position:absolute;left:-1px;top:8px;bottom:8px;width:2px;background:var(--p);border-radius:2px}
.sb-item span{font-size:13px;font-weight:500;color:var(--t2);flex:1}
.sb-item.active span{color:var(--p)}
.sb-badge{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--p)}
.sb-footer{border-top:0.5px solid var(--pl);padding-top:14px;margin-top:10px;display:flex;align-items:center;gap:12px;padding-left:4px}
.sb-avatar{width:32px;height:32px;border-radius:8px;background:#100B1E;border:0.5px solid var(--pl2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sb-avatar span{font-family:'Playfair Display',serif;font-size:13px;color:var(--p)}
.sb-uname{font-size:13px;font-weight:500;color:var(--t0)}
.sb-urole{font-size:11px;color:var(--t2);margin-top:1px}

/* ─── TOPBAR ─── */
.topbar{height:56px;display:flex;align-items:center;padding:0 28px;border-bottom:0.5px solid var(--pl);background:rgba(7,6,15,0.6);flex-shrink:0;gap:16px}
.tb-crumb{flex:1;display:flex;align-items:center;gap:8px}
.tb-parent{font-size:10px;font-weight:500;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px}
.tb-sep{color:var(--t3);font-size:12px}
.tb-current{font-size:13px;font-weight:500;color:var(--t0)}
.tb-pill{display:flex;align-items:center;gap:10px;padding:6px 14px;border-radius:999px;border:0.5px solid var(--pl);background:rgba(59,130,246,0.04)}
.tb-dot{width:6px;height:6px;border-radius:3px;background:var(--ok);flex-shrink:0}
.tb-cover{font-size:12px;color:var(--t1)}
.tb-clock{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--p)}
.tb-actions{display:flex;align-items:center;justify-content:flex-end;flex:1;gap:8px}
.icon-btn{width:34px;height:34px;border-radius:8px;border:0.5px solid var(--line2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;font-size:14px}
.notif-dot{position:absolute;top:6px;right:8px;width:6px;height:6px;border-radius:3px;background:var(--err)}

/* ─── TAB BAR (mobile) ─── */
.tabbar{height:64px;border-top:0.5px solid var(--pl);display:flex;padding:6px 12px 10px;background:rgba(7,6,15,0.92);flex-shrink:0}
.tab-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:relative;padding-top:4px}
.tab-item.active::before{content:'';position:absolute;top:0;width:20px;height:2px;border-radius:2px;background:var(--p)}
.tab-emoji{font-size:18px;line-height:1}
.tab-label{font-size:10px;color:var(--t2);letter-spacing:0.4px}
.tab-item.active .tab-label{color:var(--p);font-weight:500}

/* ─── MAIN CONTENT AREA ─── */
.main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.scroll-content{flex:1;overflow-y:auto;overflow-x:hidden}

/* ─── CARDS + COMMON ─── */
.card{background:var(--bg1);border:0.5px solid var(--pl);border-radius:12px;padding:16px}
.eyebrow{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--p);margin-bottom:6px}
.btn{height:40px;padding:0 16px;border-radius:8px;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;border:0.5px solid var(--line2);background:transparent;color:var(--t1);cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--pl2);color:var(--ps)}
.btn-primary{background:var(--p);border-color:var(--p);color:#030d1a}
.btn-primary:hover{background:#7C3AED}
.btn-secondary{border-color:var(--pl2);color:var(--ps)}
.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:600;text-transform:uppercase}
.badge-paid{background:rgba(46,204,138,0.16);color:#2ECC8A}
.badge-pending{background:rgba(240,165,0,0.16);color:#F0A500}
.badge-new{background:rgba(59,130,246,0.16);color:#3b82f6}
.badge-cancel{background:rgba(232,69,69,0.18);color:#E84545}
.badge-open{background:rgba(240,165,0,0.16);color:#F0A500}
.pill{height:36px;padding:0 16px;border-radius:999px;border:0.5px solid var(--pl);background:transparent;color:var(--t1);font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.8px}
.pill:hover{border-color:var(--pl2)}
.pill.active{background:var(--p);border-color:var(--p);color:#030d1a}
.pill-count{font-family:'JetBrains Mono',monospace;font-size:10px;opacity:0.7}
input,textarea{background:var(--bg2);border:0.5px solid var(--line2);border-radius:8px;padding:0 16px;color:var(--t0);font-family:Inter,sans-serif;font-size:14px;outline:none}
input:focus{border-color:var(--pl2)}

/* ─── LOGIN ─── */
#panel-login .login-wrap{display:flex;height:100%;width:100%}
.login-left{flex:1;border-right:0.5px solid var(--pl);padding:56px;display:flex;flex-direction:column;justify-content:space-between}
.login-brand{display:flex;align-items:center;gap:14px;margin-bottom:40px}
.login-logo{width:44px;height:44px;border-radius:12px;background:var(--p);display:flex;align-items:center;justify-content:center}
.login-logo span{font-family:'Playfair Display',serif;font-size:24px;color:#030d1a;font-weight:700}
.login-brand-name{font-family:'Playfair Display',serif;font-size:22px;color:var(--t0)}
.login-brand-sub{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t3);letter-spacing:2px;margin-top:4px}
.stats-row{display:flex;gap:28px;margin-bottom:32px}
.stat-n{font-family:'Playfair Display',serif;font-size:32px;color:var(--p);letter-spacing:-0.5px}
.stat-l{font-size:10px;font-weight:500;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px;margin-top:6px}
.hero-copy{flex:1;justify-content:center;display:flex;flex-direction:column;max-width:480px;margin-bottom:32px}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(32px,4vw,48px);color:var(--t0);line-height:1.12;letter-spacing:-1px;margin-bottom:22px}
.hero-title em{color:var(--p);font-style:italic}
.hero-sub{font-size:15px;color:var(--t2);line-height:1.7;max-width:420px}
.quote-card{padding:20px;border:0.5px solid var(--pl);border-radius:12px;background:rgba(14,11,28,0.6);max-width:440px}
.quote-text{font-family:'Playfair Display',serif;font-size:15px;color:var(--t0);line-height:1.6;font-style:italic;margin-bottom:14px}
.quote-author{display:flex;align-items:center;gap:12px}
.quote-av{width:32px;height:32px;border-radius:16px;background:#130F28;border:0.5px solid var(--pl2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.quote-av span{font-family:'Playfair Display',serif;font-size:12px;color:var(--p)}
.quote-name{font-size:12px;font-weight:500;color:var(--t0)}
.quote-role{font-size:11px;color:var(--t2);margin-top:1px}
.michelin{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--p);letter-spacing:1px;margin-left:auto}
.login-right{flex:0.8;overflow-y:auto;padding:64px}
.sign-title{font-family:'Playfair Display',serif;font-size:40px;color:var(--t0);letter-spacing:-0.8px;margin:8px 0 12px;line-height:1.1}
.sign-sub{font-size:14px;color:var(--t2);line-height:1.6;margin-bottom:36px}
.field-group{margin-bottom:18px}
.field-label{font-size:11px;font-weight:500;color:var(--p);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;display:block}
.field-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.field-input{width:100%;height:44px;display:block}
.forgot{font-size:11px;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px;font-weight:500;cursor:pointer}
.sign-btn{width:100%;height:56px;background:var(--p);border:none;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:12px;cursor:pointer;margin:28px 0 24px}
.sign-btn:hover{background:#7C3AED}
.sign-btn-text{font-family:'Playfair Display',serif;font-size:17px;color:#030d1a;font-weight:600}
.divider-row{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.divider-line{flex:1;height:0.5px;background:var(--pl)}
.divider-label{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:2px}
.alt-btns{display:flex;gap:10px;margin-bottom:32px}
.alt-btn{flex:1;height:44px;border:0.5px solid var(--line2);border-radius:8px;background:transparent;color:var(--t1);font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:1.2px;cursor:pointer}
.alt-btn:hover{border-color:var(--pl2)}
.login-footer{display:flex;justify-content:space-between;padding-top:16px}
.login-footer span{font-size:11px;color:var(--t3)}

/* ─── MANAGER / DASHBOARD ─── */
.panel-inner{display:flex;flex:1;min-height:0;overflow:hidden}
.dash-panel{padding:24px 28px 40px;max-width:1200px;width:100%}
.metrics-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:20px}
.metric-top{display:flex;justify-content:space-between;margin-bottom:12px}
.metric-icon{width:36px;height:36px;border-radius:8px;background:var(--pbg);display:flex;align-items:center;justify-content:center;font-size:18px}
.delta{font-size:10px;font-weight:600;padding:4px 8px;border-radius:6px}
.delta-up{background:rgba(46,204,138,0.14);color:#2ECC8A}
.delta-flat{background:rgba(255,255,255,0.06);color:var(--t3)}
.delta-down{background:rgba(232,69,69,0.14);color:#E84545}
.metric-label{font-size:10px;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
.metric-value{font-family:'Playfair Display',serif;font-size:28px;color:var(--p)}
.metric-sub{font-size:12px;color:var(--t3);margin-top:8px}
.chart-row{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:20px}
@media(min-width:900px){.chart-row{grid-template-columns:1.4fr 1fr}}
.chart-header{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}
.chart-title{font-family:'Playfair Display',serif;font-size:18px;color:var(--t0)}
.chart-sub{font-size:10px;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px}
.ranges{display:flex;gap:4px}
.range{height:32px;padding:0 12px;border-radius:8px;border:none;background:transparent;color:var(--t2);font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase}
.range.active{background:var(--pbg2);color:var(--p)}
.bars{display:flex;align-items:flex-end;gap:3px;height:160px}
.bar-col{flex:1;min-width:4px;border-radius:3px 3px 0 0;background:rgba(59,130,246,0.25)}
.bar-col.peak{background:var(--p)}
.x-labels{display:flex;justify-content:space-between;margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t3)}
.side-stack{display:flex;flex-direction:column;gap:14px}
.side-label{font-size:10px;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px}
.performer{padding:10px 0;border-bottom:0.5px solid var(--line)}
.performer:last-child{border:none}
.performer-row{display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:var(--t0)}
.bar-track{height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden}
.bar-fill{height:100%;background:linear-gradient(90deg,var(--p),var(--ps))}
.res-row{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:0.5px solid var(--line)}
.res-time{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--p);width:44px;flex-shrink:0}
.res-name{font-size:13px;color:var(--t0)}
.res-note{font-size:11px;color:var(--t2);margin-top:2px}
.orders-card{padding:0;overflow:hidden}
.orders-head{padding:20px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;border-bottom:0.5px solid var(--pl)}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:12px 16px;font-size:9px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;border-bottom:0.5px solid var(--pl)}
td{padding:14px 16px;border-bottom:0.5px solid rgba(255,255,255,0.04);color:var(--t0)}
tr:nth-child(even) td{background:rgba(255,255,255,0.02)}
.ticket{font-family:'JetBrains Mono',monospace;color:var(--p);font-weight:500}
.placeholder{padding:48px 24px;text-align:center;color:var(--t2);border:0.5px dashed var(--pl2);border-radius:12px;margin-top:8px}
.placeholder-title{font-size:18px;color:var(--p);margin-bottom:8px}

/* ─── POS ─── */
.pos-layout{display:flex;flex:1;min-height:0;overflow:hidden}
.pos-grid{flex:1;padding:20px;display:flex;flex-direction:column;overflow:hidden}
.pills-scroll{display:flex;gap:8px;overflow-x:auto;margin-bottom:16px;padding-bottom:4px;flex-shrink:0}
.pills-scroll::-webkit-scrollbar{display:none}
.search-box{display:flex;align-items:center;height:36px;padding:0 14px;border-radius:999px;border:0.5px solid var(--pl);background:var(--bg2);min-width:180px;gap:8px;flex-shrink:0}
.search-box input{background:none;border:none;padding:0;font-size:13px;color:var(--t0);flex:1;height:100%}
.search-kbd{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t3);padding:2px 6px;border:0.5px solid var(--line2);border-radius:4px}
.dish-grid{display:flex;flex-wrap:wrap;gap:14px;overflow-y:auto;flex:1;align-content:flex-start;padding-bottom:16px}
.dish-card{width:calc(33.33% - 10px);min-width:140px;background:var(--bg1);border-radius:12px;border:0.5px solid var(--pl);overflow:hidden;cursor:pointer;transition:border-color 0.15s}
.dish-card:hover{border-color:var(--pl2)}
.dish-card.in-order{border-color:rgba(59,130,246,0.55)}
.plate-area{height:110px;background:var(--bg0);display:flex;align-items:center;justify-content:center;border-bottom:0.5px solid var(--pl);position:relative}
.plate{width:76px;height:76px;border-radius:50%;background:#130F2A;display:flex;align-items:center;justify-content:center}
.plate-sym{font-family:'Playfair Display',serif;font-size:22px;color:rgba(196,181,253,0.8)}
.popular-badge{position:absolute;top:8px;left:8px;background:rgba(7,6,15,0.8);border-radius:6px;padding:3px 8px;font-size:10px;font-weight:600;color:var(--p);text-transform:uppercase;letter-spacing:0.8px;border:0.5px solid var(--pl2)}
.qty-overlay{position:absolute;top:8px;right:8px;background:var(--p);border-radius:999px;padding:3px 8px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#030d1a}
.dish-info{padding:12px;display:flex;flex-direction:column;gap:3px}
.dish-name{font-family:'Playfair Display',serif;font-size:15px;color:var(--t0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dish-price{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--p)}
.dish-sub{font-size:12px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Order Summary Panel */
.order-panel{width:340px;min-width:340px;border-left:0.5px solid var(--pl);background:var(--bg1);display:flex;flex-direction:column;overflow:hidden}
.op-header{padding:18px 20px;border-bottom:0.5px solid var(--pl);display:flex;align-items:flex-start;gap:12px}
.op-sub{font-size:10px;font-weight:500;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
.op-title{font-family:'Playfair Display',serif;font-size:20px;color:var(--t0)}
.op-meta{display:flex;gap:8px;margin-top:8px;font-size:12px;color:var(--t2)}
.op-time{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--p)}
.op-items{flex:1;overflow-y:auto;padding:0 16px}
.op-items::-webkit-scrollbar{width:4px}
.op-items::-webkit-scrollbar-track{background:transparent}
.op-items::-webkit-scrollbar-thumb{background:var(--pl2);border-radius:2px}
.order-item{display:flex;gap:12px;padding:12px 0;border-bottom:0.5px solid var(--pl)}
.qty-badge{width:28px;height:28px;border-radius:6px;background:var(--pbg);border:0.5px solid var(--pl2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--p)}
.item-name{font-size:14px;font-weight:500;color:var(--t0);flex:1}
.item-price{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--t0)}
.item-mod{font-size:11px;color:var(--t2);line-height:1.5;margin-top:2px}
.qty-btns{display:flex;gap:4px;margin-top:6px}
.qty-btn{width:26px;height:26px;border-radius:6px;border:0.5px solid var(--line2);background:transparent;color:var(--t1);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.qty-btn:hover{border-color:var(--pl2)}
.extra-btns{display:flex;gap:6px;padding:12px 0}
.extra-btn{height:34px;padding:0 12px;border-radius:8px;border:0.5px solid var(--line2);background:transparent;color:var(--t1);font-size:11px;font-weight:500;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px}
.extra-btn:hover{border-color:var(--pl2)}
.extra-btn.active{border-color:var(--pl2);background:var(--pbg)}
.op-totals{border-top:0.5px solid var(--pl);padding:16px 20px;background:rgba(0,0,0,0.18)}
.total-row{display:flex;justify-content:space-between;padding:2px 0;font-size:13px}
.total-row-label{color:var(--t2)}
.total-row-val{font-family:'JetBrains Mono',monospace;color:var(--t1)}
.total-divider{height:1px;background:var(--pl);margin:10px 0}
.total-final{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
.total-label{font-size:10px;font-weight:500;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px}
.total-amount{font-family:'Playfair Display',serif;font-size:32px;color:var(--p);letter-spacing:-0.8px}
.charge-btn{width:100%;height:54px;background:var(--p);border:none;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;margin-bottom:10px}
.charge-btn:hover{background:#7C3AED}
.charge-btn.done{background:var(--ok)}
.charge-btn-text{font-family:'Playfair Display',serif;font-size:17px;color:#030d1a;font-weight:600}
.charge-total{font-family:'JetBrains Mono',monospace;font-size:15px;color:#030d1a}
.alt-pay{display:flex;gap:8px}
.alt-pay-btn{flex:1;height:42px;border:0.5px solid var(--line2);border-radius:8px;background:transparent;color:var(--t1);font-size:12px;font-weight:500;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px}
.alt-pay-btn:hover{border-color:var(--pl2)}
.alt-pay-btn.done{border-color:rgba(46,204,138,0.4);color:var(--ok)}

/* ─── KDS ─── */
#panel-kds{background:#07060F}
.kds-header{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:0.5px solid var(--pl);background:rgba(7,6,15,0.7);flex-shrink:0}
.kds-hl{display:flex;align-items:center;gap:16px;flex:1;min-width:0}
.kds-logo{width:36px;height:36px;border-radius:10px;background:var(--p);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.kds-logo span{font-family:'Playfair Display',serif;font-size:20px;color:#030d1a;font-weight:700}
.kds-eyebrow{font-size:9px;font-weight:600;color:var(--p);text-transform:uppercase;letter-spacing:2px}
.kds-chef{font-size:11px;color:var(--t2);margin-top:2px}
.kds-divv{width:1px;height:32px;background:var(--pl);margin:0 4px;flex-shrink:0}
.stations-scroll{display:flex;gap:4px;overflow-x:auto;flex-shrink:1}
.stations-scroll::-webkit-scrollbar{display:none}
.station-btn{height:32px;padding:0 14px;border-radius:8px;background:transparent;border:none;color:var(--t2);font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px;white-space:nowrap}
.station-btn.active{background:var(--pbg2);border:0.5px solid var(--pl2);color:var(--p)}
.kds-hr{display:flex;align-items:center;gap:20px;flex-shrink:0}
.kpi{display:flex;flex-direction:column;align-items:flex-end}
.kpi-val{font-family:'JetBrains Mono',monospace;font-size:22px;color:var(--t0);line-height:1.2}
.kpi-lbl{font-size:9px;font-weight:500;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;margin-top:3px}
.kds-clock{font-family:'JetBrains Mono',monospace;font-size:20px;color:var(--p);letter-spacing:0.5px}
.kds-clock-sub{font-size:9px;font-weight:500;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;margin-top:3px;text-align:right}
.kanban{display:flex;gap:16px;padding:16px;flex:1;overflow:hidden}
.kds-col{flex:1;border-radius:14px;border:0.5px solid var(--pl);background:rgba(255,255,255,0.01);display:flex;flex-direction:column;overflow:hidden}
.kds-col-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:0.5px solid var(--pl)}
.kds-col-left{display:flex;align-items:center;gap:10px}
.col-dot{width:8px;height:8px;border-radius:4px}
.col-title{font-family:'Playfair Display',serif;font-size:18px;color:var(--t0)}
.col-count{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--t2)}
.kds-cards{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.kds-cards::-webkit-scrollbar{width:4px}
.kds-cards::-webkit-scrollbar-thumb{background:var(--pl2);border-radius:2px}
.kds-card{background:var(--bg1);border:0.5px solid var(--pl2);border-radius:12px;overflow:hidden}
.kds-card.red{border-color:rgba(232,69,69,0.5)}
.kds-card.ready{background:rgba(46,204,138,0.06)}
.kds-top-glow{height:2px;background:var(--p)}
.kds-card-head{display:flex;justify-content:space-between;padding:14px;border-bottom:0.5px solid var(--pl)}
.order-no{font-family:'JetBrains Mono',monospace;font-size:20px;color:var(--p);letter-spacing:0.4px}
.vip-badge{background:var(--err);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:0.8px;margin-left:10px}
.card-meta{font-size:12px;color:var(--t2);margin-top:3px}
.timer{font-family:'JetBrains Mono',monospace;font-size:20px;letter-spacing:0.8px}
.timer-state{font-size:9px;font-weight:500;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;margin-top:3px;text-align:right}
.kds-items{padding:8px 14px}
.kds-item-row{display:flex;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--line);align-items:flex-start}
.kds-item-row:last-child{border:none}
.kds-item-row.done{opacity:0.4}
.kds-qty{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--p);width:16px;text-align:right;flex-shrink:0;margin-top:2px}
.kds-item-name{font-size:15px;font-weight:500;color:var(--t0);flex:1}
.kds-item-name.done{text-decoration:line-through}
.kds-mod{font-size:12px;color:var(--t2);margin-top:2px}
.kds-station{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t3);flex-shrink:0;margin-top:3px}
.kds-action{padding:0 14px 14px}
.kds-action-btn{width:100%;height:44px;border-radius:8px;border:0.5px solid var(--pl2);background:transparent;color:var(--p);font-size:12px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px}
.kds-action-btn.fire{background:var(--p);border-color:var(--p);color:#030d1a}
.kds-action-btn.ready{background:var(--ok);border-color:var(--ok);color:#030d1a}
.kds-action-btn.delivered{border-color:rgba(46,204,138,0.4);color:var(--ok)}

/* ─── WAITER / FLOOR PLAN ─── */
.waiter-header{height:64px;display:flex;align-items:center;padding:0 20px;border-bottom:0.5px solid var(--pl);gap:14px;flex-shrink:0}
.waiter-menu-btn{width:40px;height:40px;border-radius:10px;background:var(--bg1);border:0.5px solid var(--pl);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:var(--t1)}
.waiter-title{font-family:'Playfair Display',serif;font-size:20px;color:var(--t0)}
.view-tabs{display:flex;gap:4px;flex:1;overflow-x:auto}
.view-tabs::-webkit-scrollbar{display:none}
.view-tab{height:36px;padding:0 18px;border-radius:8px;background:transparent;border:none;color:var(--t2);font-size:12px;font-weight:500;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px;white-space:nowrap}
.view-tab.active{background:var(--pbg2);border:0.5px solid var(--pl2);color:var(--p)}
.waiter-user{display:flex;align-items:center;gap:12px}
.waiter-uname{font-size:12px;font-weight:500;color:var(--t1);text-align:right}
.waiter-uinfo{font-size:11px;color:var(--t3);text-align:right;margin-top:1px}
.waiter-uav{width:40px;height:40px;border-radius:10px;background:#100B1E;border:0.5px solid var(--pl2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.waiter-uav span{font-family:'Playfair Display',serif;font-size:14px;color:var(--p)}
.stats-strip{display:flex;overflow-x:auto;border-bottom:0.5px solid var(--pl);flex-shrink:0}
.stats-strip::-webkit-scrollbar{display:none}
.stat-cell{display:flex;align-items:baseline;gap:10px;padding:12px 24px;min-width:100px;border-right:0.5px solid var(--pl)}
.stat-cell:last-child{border-right:none}
.stat-val{font-family:'JetBrains Mono',monospace;font-size:20px;color:var(--t0)}
.stat-lbl{font-size:9px;font-weight:500;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px}
.floor-wrap{flex:1;position:relative;overflow:hidden}
.floor-scroll{height:100%;overflow-y:auto;padding:16px;padding-bottom:24px}
.zone-label{font-size:9px;font-weight:500;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin:12px 0 6px 4px}
.table-group{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:4px}
.table-card{width:90px;height:90px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-width:1px;border-style:solid;cursor:pointer;position:relative;gap:2px;transition:border-color 0.15s}
.table-card.round{border-radius:45px}
.table-card.selected{border-color:var(--p)!important;border-width:2px!important}
.table-id{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:0.5px}
.table-course,.table-cov{font-size:10px;color:var(--t2);text-align:center}
.table-time{font-family:'JetBrains Mono',monospace;font-size:10px;opacity:0.7}
.alert-dot{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:9px;background:var(--err);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff}
.floor-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:20px;padding:12px;background:rgba(7,6,15,0.6);border:0.5px solid var(--pl);border-radius:10px}
.legend-item{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--t2)}
.legend-sw{width:14px;height:14px;border-radius:4px;border:1px solid}
/* Order sheet */
.order-sheet{position:absolute;left:0;right:0;bottom:0;max-height:65%;min-height:280px;background:rgba(14,11,28,0.97);border-top-left-radius:24px;border-top-right-radius:24px;border-top:0.5px solid var(--pl2);display:flex;flex-direction:column;overflow:hidden;transition:transform 0.2s}
.order-sheet.hidden{transform:translateY(100%)}
.sheet-handle{width:48px;height:4px;border-radius:4px;background:rgba(59,130,246,0.4);margin:12px auto}
.sheet-header{padding:0 24px 16px;border-bottom:0.5px solid var(--pl);display:flex;align-items:flex-end;gap:16px}
.sheet-title{font-family:'Playfair Display',serif;font-size:26px;color:var(--t0);letter-spacing:-0.5px}
.sheet-meta{display:flex;gap:10px;margin-top:8px;font-size:13px;color:var(--t2);flex-wrap:wrap}
.sheet-time{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--p)}
.sheet-btns{display:flex;gap:8px;flex-shrink:0}
.sheet-add-btn{height:40px;padding:0 16px;border-radius:8px;border:0.5px solid var(--line2);background:transparent;color:var(--t1);font-size:12px;font-weight:500;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px}
.sheet-send-btn{height:40px;padding:0 16px;border-radius:8px;border:0.5px solid var(--p);background:transparent;color:var(--p);font-size:12px;font-weight:500;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px}
.sheet-send-btn.done{border-color:rgba(46,204,138,0.4);color:var(--ok)}
.sheet-items{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px}
.sheet-item{display:flex;align-items:center;gap:14px;padding:12px;background:var(--bg2);border:0.5px solid var(--pl);border-radius:12px}
.sheet-qty{width:34px;height:34px;border-radius:8px;background:var(--pbg);border:0.5px solid var(--pl2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--p)}
.sheet-item-name{font-size:15px;font-weight:500;color:var(--t0)}
.sheet-item-sub{font-size:12px;color:var(--t2);margin-top:2px}
.sheet-item-price{font-family:'JetBrains Mono',monospace;font-size:15px;color:var(--t0);flex-shrink:0;margin-left:auto}
.sheet-sent{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:1px;margin-top:3px}
.sheet-footer{border-top:0.5px solid var(--pl);padding:14px 16px;display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.18)}
.sheet-total{flex:1}
.sheet-total-label{font-size:9px;font-weight:500;color:var(--t2);text-transform:uppercase;letter-spacing:1.5px}
.sheet-total-amount{font-family:'Playfair Display',serif;font-size:26px;color:var(--p);letter-spacing:-0.5px;margin-top:2px}
.sheet-action-btn{height:46px;padding:0 16px;border-radius:8px;background:var(--p);border:none;color:#030d1a;font-size:12px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px;white-space:nowrap}
.sheet-action-btn:hover{background:#7C3AED}

/* ─── MOBILE ORDERS ─── */
#panel-mobile-orders{background:var(--bg0)}
.mob-header{padding:16px 24px 14px}
.mob-title-row{display:flex;align-items:flex-end;justify-content:space-between}
.mob-title{font-family:'Playfair Display',serif;font-size:28px;color:var(--t0);letter-spacing:-0.5px}
.mob-count{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--t2)}
.mob-pills{display:flex;gap:8px;overflow-x:auto;padding:0 20px 12px;flex-shrink:0}
.mob-pills::-webkit-scrollbar{display:none}
.mob-pill{height:32px;padding:0 14px;border-radius:999px;border:0.5px solid var(--pl);background:transparent;color:var(--t1);font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:0.8px}
.mob-pill.active{background:var(--p);border-color:var(--p);color:#030d1a}
.mob-pill.red{border-color:rgba(232,69,69,0.5);color:var(--err)}
.mob-list{flex:1;overflow-y:auto;padding:0 16px 100px}
.mob-card{display:flex;gap:14px;padding:14px;background:var(--bg1);border:0.5px solid var(--pl);border-radius:14px;margin-bottom:10px;cursor:pointer;align-items:center}
.mob-card:hover{border-color:var(--pl2)}
.mob-card.alert{border-color:rgba(232,69,69,0.45)}
.mob-table-icon{width:48px;height:48px;border-radius:12px;background:var(--pbg);border:0.5px solid var(--pl2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--p);letter-spacing:0.4px}
.mob-card-info{flex:1;min-width:0}
.mob-name-row{display:flex;align-items:center;gap:6px;margin-bottom:3px}
.status-dot{width:6px;height:6px;border-radius:3px;flex-shrink:0}
.mob-name{font-size:15px;font-weight:500;color:var(--t0)}
.mob-cov{font-size:11px;color:var(--t3)}
.mob-course{font-size:12px;color:var(--t2)}
.mob-course.alert{color:var(--err);font-weight:500}
.mob-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0}
.mob-time{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--p);letter-spacing:0.4px}
.mob-chevron{color:var(--t3);font-size:18px}
.mob-fab{position:absolute;bottom:80px;right:18px;width:60px;height:60px;border-radius:30px;background:var(--p);border:none;cursor:pointer;font-size:28px;color:#030d1a;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(59,130,246,0.5)}
.mob-fab:hover{background:#7C3AED}

/* ─── RESPONSIVE ─── */
@media(max-width:767px){
  .sidebar,.login-left{display:none}
  .login-right{flex:1;padding:32px 24px}
  .pos-layout{flex-direction:column}
  .order-panel{display:none}
  .dish-card{width:calc(50% - 7px)}
  .kds-hr .kpi:nth-child(n+3){display:none}
  .waiter-user{display:none}
}
</style>
</head>
<body>
<div id="app">

<!-- ═══════════════ LOGIN ═══════════════ -->
<div id="panel-login" class="panel active">
  <div class="login-wrap">
    <div class="login-left">
      <div>
        <div class="login-brand">
          <div class="login-logo"><span>C</span></div>
          <div>
            <div class="login-brand-name">Cafyz</div>
            <div class="login-brand-sub">RESTAURANT MANAGEMENT PLATFORM</div>
          </div>
        </div>
        <div class="stats-row">
          <div><div class="stat-n serif">240+</div><div class="stat-l">Houses</div></div>
          <div><div class="stat-n serif">11</div><div class="stat-l">Countries</div></div>
          <div><div class="stat-n serif">99.99</div><div class="stat-l">Uptime · %</div></div>
        </div>
        <div class="hero-copy">
          <div class="eyebrow">Service · Mise en place</div>
          <div class="hero-title serif">Run the room<br>like it's <em>your kitchen</em>.</div>
          <div class="hero-sub">Cafyz is the operating system used by 240+ restaurants from Lyon to Tokyo — front of house, the line, and the back office in one tempered ecosystem.</div>
        </div>
      </div>
      <div class="quote-card">
        <div class="quote-text serif">"Order flow became smooth again. We won an hour back in operations in the first month."</div>
        <div class="quote-author">
          <div class="quote-av"><span>HL</span></div>
          <div>
            <div class="quote-name">Henri Lecomte</div>
            <div class="quote-role">Chef de cuisine · Saint, Paris</div>
          </div>
          <div class="michelin">★★ MICHELIN</div>
        </div>
      </div>
    </div>
    <div class="login-right">
      <div class="eyebrow">Sign In · Concierge</div>
      <div class="sign-title serif">Welcome back,<br>Mireille.</div>
      <div class="sign-sub">Doors open at 18:30. The kitchen has flagged two reservations awaiting your approval.</div>
      <div class="field-group">
        <label class="field-label">Work email</label>
        <input class="field-input" type="email" value="mireille@saint.paris"/>
      </div>
      <div class="field-group">
        <div class="field-row">
          <label class="field-label" style="margin-bottom:0">Passphrase</label>
          <span class="forgot">Forgot</span>
        </div>
        <input class="field-input" type="password" placeholder="••••••••••••"/>
      </div>
      <button class="sign-btn" onclick="navigate('manager')">
        <span class="sign-btn-text serif">Enter Cafyz</span>
        <span style="font-size:16px;color:#030d1a">→</span>
      </button>
      <div class="divider-row"><div class="divider-line"></div><span class="divider-label">Or</span><div class="divider-line"></div></div>
      <div class="alt-btns">
        <button class="alt-btn">SSO · Workspace</button>
        <button class="alt-btn">Pair Device</button>
      </div>
      <div class="login-footer">
        <span>© Cafyz Restaurant Management Solutions · 2026</span>
        <span class="mono">v 04.2 · MICHELIN</span>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════ MANAGER PANEL ═══════════════ -->
<div id="panel-manager" class="panel">
  <div class="panel-inner">
    <div class="sidebar">
      <div class="sb-brand">
        <div class="sb-logo"><span>C</span></div>
        <div><div class="sb-name">Cafyz</div><div class="sb-sub">SAINT · PARIS 6e</div></div>
      </div>
      <div class="sb-nav">
        <div class="sb-item active" onclick="switchSection('overview')"><span>Overview</span></div>
        <div class="sb-item" onclick="navigate('pos')"><span>Point of Sale</span></div>
        <div class="sb-item" onclick="navigate('waiter')"><span>Tables</span></div>
        <div class="sb-item" onclick="navigate('kds')"><span>Kitchen</span><span class="sb-badge">14</span></div>
        <div class="sb-item" onclick="switchSection('inventory')"><span>Inventory</span></div>
        <div class="sb-item" onclick="switchSection('staff')"><span>Staff</span></div>
        <div class="sb-item" onclick="switchSection('reports')"><span>Reports</span></div>
      </div>
      <div class="sb-footer">
        <div class="sb-avatar"><span>MV</span></div>
        <div><div class="sb-uname">Mireille Vasseur</div><div class="sb-urole">Maître d'hôtel</div></div>
      </div>
    </div>
    <div class="main">
      <div class="topbar">
        <div class="tb-crumb"><span class="tb-parent">Operations</span><span class="tb-sep">›</span><span class="tb-current" id="mgr-crumb">Overview</span></div>
        <div class="tb-pill"><div class="tb-dot"></div><span class="tb-cover">Saint · Paris 6e</span><span style="color:var(--t3)">·</span><span class="tb-clock mono" id="mgr-clock">19:42</span></div>
        <div class="tb-actions"><button class="icon-btn">🔔<div class="notif-dot"></div></button></div>
      </div>
      <div class="scroll-content">
        <!-- Overview Section -->
        <div id="mgr-overview" class="dash-panel">
          <div class="eyebrow" id="mgr-date">Operations</div>
          <h1 class="serif" style="font-size:clamp(24px,3vw,34px);letter-spacing:-0.5px;margin-bottom:8px">Good evening, Mireille.</h1>
          <p style="font-size:14px;color:var(--t2);max-width:520px;line-height:1.5;margin-bottom:20px">Service is at <strong style="color:var(--t0)">84% capacity</strong>. Three reservations expected after 21:00.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px">
            <button class="btn">Export</button>
            <button class="btn btn-secondary">Daily Report</button>
            <button class="btn btn-primary" onclick="navigate('pos')">+ New Order</button>
          </div>
          <div class="metrics-grid">
            <div class="card"><div class="metric-top"><div class="metric-icon">💰</div><span class="delta delta-up">↑ 12.4%</span></div><div class="metric-label">Revenue · Today</div><div class="metric-value serif">$18,624</div><div class="metric-sub">vs. yesterday</div></div>
            <div class="card"><div class="metric-top"><div class="metric-icon">🧾</div><span class="delta delta-up">↑ 6.1%</span></div><div class="metric-label">Orders</div><div class="metric-value serif">142</div><div class="metric-sub">84 covers</div></div>
            <div class="card"><div class="metric-top"><div class="metric-icon">⏱</div><span class="delta delta-down">↓ 3.2%</span></div><div class="metric-label">Avg. Table Time</div><div class="metric-value serif">58m</div><div class="metric-sub">↓ 4m vs. last week</div></div>
            <div class="card"><div class="metric-top"><div class="metric-icon">👥</div><span class="delta delta-flat">—</span></div><div class="metric-label">Staff On</div><div class="metric-value serif">14</div><div class="metric-sub">2 on break</div></div>
          </div>
          <div class="chart-row">
            <div class="card">
              <div class="chart-header">
                <div><div class="chart-sub">Revenue Cadence</div><div class="chart-title serif">Today's service · hourly</div></div>
                <div class="ranges" id="ranges">
                  <button class="range active" onclick="setRange(this)">1D</button>
                  <button class="range" onclick="setRange(this)">1W</button>
                  <button class="range" onclick="setRange(this)">1M</button>
                  <button class="range" onclick="setRange(this)">YTD</button>
                </div>
              </div>
              <div class="bars" id="rev-bars"></div>
              <div class="x-labels"><span>11A</span><span>1P</span><span>3P</span><span>5P</span><span>7P</span><span>9P</span><span>11P</span></div>
            </div>
            <div class="side-stack">
              <div class="card">
                <div class="side-label">Top performers</div>
                <div class="performer"><div class="performer-row"><span>Black Cod Miso</span><span>28×</span></div><div class="bar-track"><div class="bar-fill" style="width:92%"></div></div></div>
                <div class="performer"><div class="performer-row"><span>Côte de Bœuf</span><span>19×</span></div><div class="bar-track"><div class="bar-fill" style="width:78%"></div></div></div>
                <div class="performer"><div class="performer-row"><span>Lobster Linguine</span><span>16×</span></div><div class="bar-track"><div class="bar-fill" style="width:64%"></div></div></div>
                <div class="performer"><div class="performer-row"><span>Tarte Tatin</span><span>22×</span></div><div class="bar-track"><div class="bar-fill" style="width:52%"></div></div></div>
              </div>
              <div class="card">
                <div class="side-label">Reservations · Tonight <span style="float:right;color:var(--p)">18 / 22</span></div>
                <div class="res-row"><span class="res-time mono">20:15</span><div><div class="res-name">Bernard, J. · 2 cov</div><div class="res-note">Anniversary</div></div></div>
                <div class="res-row"><span class="res-time mono">20:30</span><div><div class="res-name">Park, S. · 4 cov</div><div class="res-note">VIP · No nuts</div></div></div>
                <div class="res-row"><span class="res-time mono">21:00</span><div><div class="res-name">Wei, L. · 6 cov</div><div class="res-note">Private corner</div></div></div>
              </div>
            </div>
          </div>
          <div class="card orders-card">
            <div class="orders-head">
              <div><div class="chart-sub">Recent Orders</div><div class="chart-title serif">Last 60 minutes · 18 tickets</div></div>
              <div style="display:flex;gap:8px"><button class="btn">Filter</button><button class="btn">View all</button></div>
            </div>
            <div class="table-wrap">
              <table><thead><tr><th>Ticket</th><th>Table</th><th>Server</th><th>Items</th><th>Opened</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td class="ticket">#A-0427</td><td>T·12</td><td>Jules Renaud</td><td>11</td><td>00:41</td><td>$184.50</td><td><span class="badge badge-pending">Open</span></td></tr>
                <tr><td class="ticket">#A-0426</td><td>T·08</td><td>Inès Marchal</td><td>6</td><td>00:18</td><td>$92.00</td><td><span class="badge badge-paid">Paid</span></td></tr>
                <tr><td class="ticket">#A-0425</td><td>BAR</td><td>Tomás Lévy</td><td>3</td><td>00:14</td><td>$54.00</td><td><span class="badge badge-paid">Paid</span></td></tr>
                <tr><td class="ticket">#A-0424</td><td>T·04</td><td>Inès Marchal</td><td>8</td><td>00:09</td><td>$142.50</td><td><span class="badge badge-new">New</span></td></tr>
                <tr><td class="ticket">#A-0423</td><td>T·17</td><td>Léo Dauphin</td><td>9</td><td>00:06</td><td>$218.00</td><td><span class="badge badge-pending">Open</span></td></tr>
                <tr><td class="ticket">#A-0422</td><td>T·02</td><td>Jules Renaud</td><td>5</td><td>00:03</td><td>$78.50</td><td><span class="badge badge-cancel">Voided</span></td></tr>
              </tbody></table>
            </div>
          </div>
        </div>
        <!-- Alt sections -->
        <div id="mgr-alt" class="dash-panel hidden">
          <div class="eyebrow">Operations</div>
          <h1 class="serif" id="mgr-alt-title" style="font-size:clamp(24px,3vw,34px);letter-spacing:-0.5px;margin-bottom:24px"></h1>
          <div class="placeholder"><div class="placeholder-title" id="mgr-alt-sub"></div><p>Module view · connect Turso for live data.</p></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════ POS ═══════════════ -->
<div id="panel-pos" class="panel">
  <div class="panel-inner">
    <div class="sidebar">
      <div class="sb-brand">
        <div class="sb-logo"><span>C</span></div>
        <div><div class="sb-name">Cafyz</div><div class="sb-sub">SAINT · PARIS 6e</div></div>
      </div>
      <div class="sb-nav">
        <div class="sb-item" onclick="navigate('manager')"><span>Overview</span></div>
        <div class="sb-item active" onclick="navigate('pos')"><span>Point of Sale</span></div>
        <div class="sb-item" onclick="navigate('waiter')"><span>Tables</span></div>
        <div class="sb-item" onclick="navigate('kds')"><span>Kitchen</span><span class="sb-badge">14</span></div>
        <div class="sb-item" onclick="navigate('manager')"><span>Menu</span></div>
        <div class="sb-item" onclick="navigate('manager')"><span>Inventory</span></div>
        <div class="sb-item" onclick="navigate('manager')"><span>Staff</span></div>
        <div class="sb-item" onclick="navigate('manager')"><span>Reports</span></div>
      </div>
      <div class="sb-footer"><div class="sb-avatar"><span>MV</span></div><div><div class="sb-uname">Mireille Vasseur</div><div class="sb-urole">Maître d'hôtel</div></div></div>
    </div>
    <div class="main">
      <div class="topbar">
        <div class="tb-crumb"><span class="tb-parent">Service</span><span class="tb-sep">›</span><span class="tb-current">Point of Sale</span></div>
        <div class="tb-pill"><div class="tb-dot"></div><span class="tb-cover">Dinner Service · Cover 84</span><span style="color:var(--t3)">·</span><span class="tb-clock mono">19:42</span></div>
        <div class="tb-actions"><button class="icon-btn">🔔<div class="notif-dot"></div></button></div>
      </div>
      <div class="pos-layout">
        <div class="pos-grid">
          <div class="pills-scroll" id="pos-pills">
            <button class="pill active" onclick="posSetCat(this,'all')">All <span class="pill-count">12</span></button>
            <button class="pill" onclick="posSetCat(this,'starters')">Starters <span class="pill-count">3</span></button>
            <button class="pill" onclick="posSetCat(this,'mains')">Mains <span class="pill-count">6</span></button>
            <button class="pill" onclick="posSetCat(this,'desserts')">Desserts <span class="pill-count">3</span></button>
            <button class="pill" onclick="posSetCat(this,'wine')">Wine <span class="pill-count">14</span></button>
            <div class="search-box"><span>🔍</span><input type="text" placeholder="Search the menu"/><span class="search-kbd mono">⌘K</span></div>
          </div>
          <div class="dish-grid" id="dish-grid"></div>
        </div>
        <div class="order-panel">
          <div class="op-header">
            <div style="flex:1">
              <div class="op-sub">Active Check</div>
              <div class="op-title serif">Table 12 · Vasseur</div>
              <div class="op-meta"><span>4 guests</span><span style="color:var(--t3)">·</span><span>Jules R.</span><span style="color:var(--t3)">·</span><span class="op-time mono" id="op-timer">00:41</span></div>
            </div>
            <span class="badge badge-open">Open</span>
          </div>
          <div class="op-items" id="op-items"></div>
          <div class="op-totals">
            <div class="total-row"><span class="total-row-label">Subtotal</span><span class="total-row-val mono" id="pos-subtotal">$226.00</span></div>
            <div class="total-row"><span class="total-row-label">Service · 18%</span><span class="total-row-val mono" id="pos-service">$40.68</span></div>
            <div class="total-row"><span class="total-row-label">Tax · 8.75%</span><span class="total-row-val mono" id="pos-tax">$19.78</span></div>
            <div class="total-divider"></div>
            <div class="total-final"><span class="total-label">Total Due</span><span class="total-amount serif" id="pos-total">$286.46</span></div>
            <button class="charge-btn" id="pos-charge-btn" onclick="posCharge()">
              <span style="font-size:16px">💳</span>
              <span class="charge-btn-text serif" id="pos-charge-label">Charge</span>
              <span style="color:rgba(7,6,15,0.55);font-size:16px">·</span>
              <span class="charge-total mono" id="pos-charge-total">$286.46</span>
            </button>
            <div class="alt-pay">
              <button class="alt-pay-btn" id="pos-cash-btn" onclick="posAltPay('cash')">💵  Cash</button>
              <button class="alt-pay-btn" id="pos-send-btn" onclick="posAltPay('send')">🧾  Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════ KDS ═══════════════ -->
<div id="panel-kds" class="panel" style="flex-direction:column">
  <div class="kds-header">
    <div class="kds-hl">
      <div class="kds-logo"><span>C</span></div>
      <div><div class="kds-eyebrow">Kitchen Display · Pass</div><div class="kds-chef">Chef de Cuisine · Henri Lecomte</div></div>
      <div class="kds-divv"></div>
      <div class="stations-scroll">
        <button class="station-btn active" onclick="kdsStation(this)">All</button>
        <button class="station-btn" onclick="kdsStation(this)">Grill</button>
        <button class="station-btn" onclick="kdsStation(this)">Poisson</button>
        <button class="station-btn" onclick="kdsStation(this)">Pasta</button>
        <button class="station-btn" onclick="kdsStation(this)">Garde</button>
        <button class="station-btn" onclick="kdsStation(this)">Pâtisserie</button>
      </div>
    </div>
    <div class="kds-hr">
      <div class="kpi"><div class="kpi-val mono" id="kds-open">11</div><div class="kpi-lbl">Open</div></div>
      <div class="kds-divv"></div>
      <div class="kpi"><div class="kpi-val mono" style="color:var(--warn)">8:42</div><div class="kpi-lbl">Avg ticket</div></div>
      <div class="kds-divv"></div>
      <div class="kpi"><div class="kpi-val mono" id="kds-overdue" style="color:var(--err)">1</div><div class="kpi-lbl">Overdue</div></div>
      <div class="kds-divv"></div>
      <div><div class="kds-clock mono" id="kds-clock">19:42:08</div><div class="kds-clock-sub">Service · Dinner</div></div>
    </div>
  </div>
  <div class="kanban">
    <div class="kds-col">
      <div class="kds-col-head"><div class="kds-col-left"><div class="col-dot" style="background:var(--p)"></div><div class="col-title serif">Incoming</div><div class="col-count mono" id="kds-new-count">2</div></div><span style="color:var(--t3);font-size:18px">⋯</span></div>
      <div class="kds-cards" id="kds-new"></div>
    </div>
    <div class="kds-col">
      <div class="kds-col-head"><div class="kds-col-left"><div class="col-dot" style="background:var(--warn)"></div><div class="col-title serif">Preparing</div><div class="col-count mono" id="kds-prep-count">3</div></div><span style="color:var(--t3);font-size:18px">⋯</span></div>
      <div class="kds-cards" id="kds-prep"></div>
    </div>
    <div class="kds-col">
      <div class="kds-col-head"><div class="kds-col-left"><div class="col-dot" style="background:var(--ok)"></div><div class="col-title serif">Ready · Pass</div><div class="col-count mono" id="kds-ready-count">2</div></div><span style="color:var(--t3);font-size:18px">⋯</span></div>
      <div class="kds-cards" id="kds-ready"></div>
    </div>
  </div>
  <button style="position:absolute;bottom:20px;right:20px;background:rgba(14,11,28,0.9);border:0.5px solid var(--pl);border-radius:8px;padding:10px 16px;color:var(--t1);font-size:12px;font-weight:500;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px;z-index:10" onclick="navigate('manager')">← Exit KDS</button>
</div>

<!-- ═══════════════ WAITER / FLOOR PLAN ═══════════════ -->
<div id="panel-waiter" class="panel" style="flex-direction:column">
  <div class="waiter-header">
    <div class="waiter-menu-btn">☰</div>
    <div><div class="eyebrow" style="margin-bottom:0;font-size:9px">Service · Dinner</div><div class="waiter-title serif">Floor Plan</div></div>
    <div class="view-tabs">
      <button class="view-tab active" onclick="waiterView(this)">Floor</button>
      <button class="view-tab" onclick="waiterView(this)">Bar</button>
      <button class="view-tab" onclick="waiterView(this)">Patio</button>
      <button class="view-tab" onclick="waiterView(this)">PDR</button>
    </div>
    <div class="waiter-user">
      <div><div class="waiter-uname">Jules Renaud</div><div class="waiter-uinfo">4 tables · 16 covers</div></div>
      <div class="waiter-uav"><span>JR</span></div>
    </div>
  </div>
  <div class="stats-strip">
    <div class="stat-cell"><span class="stat-val mono">11</span><span class="stat-lbl">Open</span></div>
    <div class="stat-cell"><span class="stat-val mono">14</span><span class="stat-lbl">Seated</span></div>
    <div class="stat-cell"><span class="stat-val mono">4</span><span class="stat-lbl">Available</span></div>
    <div class="stat-cell"><span class="stat-val mono" style="color:var(--p)">3</span><span class="stat-lbl">Reserved</span></div>
    <div class="stat-cell"><span class="stat-val mono" style="color:var(--err)">1</span><span class="stat-lbl">Attention</span></div>
    <div class="stat-cell"><span class="stat-val mono">52m</span><span class="stat-lbl">Avg dwell</span></div>
  </div>
  <div class="floor-wrap">
    <div class="floor-scroll">
      <div id="floor-grid"></div>
      <div class="floor-legend">
        <div class="legend-item"><div class="legend-sw" style="border-color:rgba(255,255,255,0.12);border-style:dashed"></div>Empty</div>
        <div class="legend-item"><div class="legend-sw" style="border-color:rgba(232,213,163,0.4)"></div>Reserved</div>
        <div class="legend-item"><div class="legend-sw" style="border-color:rgba(59,130,246,0.55)"></div>Occupied</div>
        <div class="legend-item"><div class="legend-sw" style="border-color:rgba(46,204,138,0.55)"></div>Paying</div>
        <div class="legend-item"><div class="legend-sw" style="border-color:rgba(232,69,69,0.7)"></div>Attention</div>
      </div>
    </div>
    <div class="order-sheet hidden" id="order-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div style="flex:1">
          <div class="eyebrow" style="margin-bottom:4px" id="sheet-eyebrow">Table 12 · Active</div>
          <div class="sheet-title serif" id="sheet-title">Vasseur · 4 guests</div>
          <div class="sheet-meta"><span>Server · Jules R.</span><span style="color:var(--t3)">·</span><span class="sheet-time">Seated 19:01</span><span style="color:var(--t3)">·</span><span>Course: <strong style="color:var(--t0)">Mains</strong></span></div>
        </div>
        <div class="sheet-btns">
          <button class="sheet-add-btn">+ Add</button>
          <button class="sheet-send-btn" id="sheet-send" onclick="sheetSend()">Send to Kitchen</button>
        </div>
      </div>
      <div class="sheet-items">
        <div class="sheet-item"><div class="sheet-qty">1</div><div><div class="sheet-item-name">Tuna Crudo</div><div class="sheet-item-sub">Citrus · radish · togarashi</div></div><div style="margin-left:auto;text-align:right"><div class="sheet-item-price">$24</div><div class="sheet-sent" style="color:var(--ok)">✓ Sent</div></div></div>
        <div class="sheet-item"><div class="sheet-qty">2</div><div><div class="sheet-item-name">Burrata di Andria</div><div class="sheet-item-sub" style="color:var(--warn)">⚠ No tomato · extra basil</div></div><div style="margin-left:auto;text-align:right"><div class="sheet-item-price">$36</div><div class="sheet-sent" style="color:var(--ok)">✓ Sent</div></div></div>
        <div class="sheet-item"><div class="sheet-qty">2</div><div><div class="sheet-item-name">Black Cod Miso</div><div class="sheet-item-sub">No ginger · extra miso</div></div><div style="margin-left:auto;text-align:right"><div class="sheet-item-price">$84</div><div class="sheet-sent" style="color:var(--ok)">✓ Sent</div></div></div>
        <div class="sheet-item"><div class="sheet-qty">1</div><div><div class="sheet-item-name">Côte de Bœuf · 500g</div><div class="sheet-item-sub">Medium rare · marrow</div></div><div style="margin-left:auto;text-align:right"><div class="sheet-item-price">$64</div><div class="sheet-sent" style="color:var(--p)">Pending</div></div></div>
      </div>
      <div class="sheet-footer">
        <div class="sheet-total"><div class="sheet-total-label">Running total</div><div class="sheet-total-amount serif">$208.00</div></div>
        <button class="sheet-action-btn">Split</button>
        <button class="sheet-action-btn" style="background:transparent;border:0.5px solid var(--line2);color:var(--t1)" onclick="closeSheet()">✕ Close</button>
      </div>
    </div>
  </div>
  <div class="tabbar">
    <div class="tab-item" onclick="navigate('waiter')"><span class="tab-emoji">🪑</span><span class="tab-label">Floor</span></div>
    <div class="tab-item" onclick="navigate('mobile-orders')"><span class="tab-emoji">🧾</span><span class="tab-label">Orders</span></div>
    <div class="tab-item" onclick="navigate('pos')"><span class="tab-emoji">☰</span><span class="tab-label">Menu</span></div>
    <div class="tab-item" onclick="navigate('manager')"><span class="tab-emoji">⭐</span><span class="tab-label">Manager</span></div>
    <div class="tab-item" onclick="navigate('kds')"><span class="tab-emoji">🍳</span><span class="tab-label">KDS</span></div>
  </div>
</div>

<!-- ═══════════════ MOBILE ORDERS ═══════════════ -->
<div id="panel-mobile-orders" class="panel" style="flex-direction:column;position:relative">
  <div class="mob-header">
    <div class="eyebrow">Service · Dinner</div>
    <div class="mob-title-row"><div class="mob-title serif">My Tables</div><span class="mob-count">6 active</span></div>
  </div>
  <div class="mob-pills">
    <button class="mob-pill active" onclick="mobFilter(this)">All <span>6</span></button>
    <button class="mob-pill red" onclick="mobFilter(this)">Attention <span>1</span></button>
    <button class="mob-pill" onclick="mobFilter(this)">Mains <span>3</span></button>
    <button class="mob-pill" onclick="mobFilter(this)">Paying <span>1</span></button>
    <button class="mob-pill" onclick="mobFilter(this)">Reserved <span>1</span></button>
  </div>
  <div class="mob-list">
    <div class="mob-card" onclick="navigate('waiter')"><div class="mob-table-icon">T·12</div><div class="mob-card-info"><div class="mob-name-row"><div class="status-dot" style="background:var(--p)"></div><span class="mob-name">Vasseur</span><span class="mob-cov">· 4 cov</span></div><div class="mob-course">Mains</div></div><div class="mob-right"><span class="mob-time">00:41</span><span class="mob-chevron">›</span></div></div>
    <div class="mob-card alert" onclick="navigate('waiter')"><div class="mob-table-icon" style="border-color:rgba(232,69,69,0.5);color:var(--err)">T·10</div><div class="mob-card-info"><div class="mob-name-row"><div class="status-dot" style="background:var(--err)"></div><span class="mob-name">Park</span><span class="mob-cov">· 2 cov</span></div><div class="mob-course alert">⚠ Needs water</div></div><div class="mob-right"><span class="mob-time" style="color:var(--err)">00:26</span><span class="mob-chevron">›</span></div></div>
    <div class="mob-card" onclick="navigate('waiter')"><div class="mob-table-icon">T·07</div><div class="mob-card-info"><div class="mob-name-row"><div class="status-dot" style="background:var(--p)"></div><span class="mob-name">Walk-in</span><span class="mob-cov">· 4 cov</span></div><div class="mob-course">Mains</div></div><div class="mob-right"><span class="mob-time">00:38</span><span class="mob-chevron">›</span></div></div>
    <div class="mob-card" onclick="navigate('waiter')"><div class="mob-table-icon" style="color:var(--ok)">T·02</div><div class="mob-card-info"><div class="mob-name-row"><div class="status-dot" style="background:var(--ok)"></div><span class="mob-name">Bernard</span><span class="mob-cov">· 2 cov</span></div><div class="mob-course">Paying</div></div><div class="mob-right"><span class="mob-time" style="color:var(--ok)">01:11</span><span class="mob-chevron">›</span></div></div>
    <div class="mob-card" onclick="navigate('waiter')"><div class="mob-table-icon" style="color:var(--ps)">T·06</div><div class="mob-card-info"><div class="mob-name-row"><div class="status-dot" style="background:var(--ps)"></div><span class="mob-name">Park (20:30)</span><span class="mob-cov">· 4 cov</span></div><div class="mob-course">Reserved · in 12m</div></div><div class="mob-right"><span class="mob-time">—</span><span class="mob-chevron">›</span></div></div>
    <div class="mob-card" onclick="navigate('waiter')"><div class="mob-table-icon">T·04</div><div class="mob-card-info"><div class="mob-name-row"><div class="status-dot" style="background:var(--p)"></div><span class="mob-name">Lévy</span><span class="mob-cov">· 3 cov</span></div><div class="mob-course">Order in</div></div><div class="mob-right"><span class="mob-time">00:09</span><span class="mob-chevron">›</span></div></div>
  </div>
  <button class="mob-fab" onclick="navigate('waiter')">+</button>
  <div class="tabbar">
    <div class="tab-item" onclick="navigate('waiter')"><span class="tab-emoji">🪑</span><span class="tab-label">Floor</span></div>
    <div class="tab-item active" onclick="navigate('mobile-orders')"><span class="tab-emoji">🧾</span><span class="tab-label">Orders</span></div>
    <div class="tab-item" onclick="navigate('pos')"><span class="tab-emoji">☰</span><span class="tab-label">Menu</span></div>
    <div class="tab-item" onclick="navigate('manager')"><span class="tab-emoji">⭐</span><span class="tab-label">Manager</span></div>
    <div class="tab-item" onclick="navigate('kds')"><span class="tab-emoji">🍳</span><span class="tab-label">KDS</span></div>
  </div>
</div>

</div><!-- #app -->

<script>
// ─── NAVIGATION ───
function navigate(id) {
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
  var target = document.getElementById('panel-' + id);
  if (target) target.classList.add('active');
  if (typeof window.ReactNativeWebView !== 'undefined') {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'navigate',screen:id}));
  }
}

// ─── MANAGER ───
function switchSection(s) {
  var ov = document.getElementById('mgr-overview');
  var alt = document.getElementById('mgr-alt');
  var crumb = document.getElementById('mgr-crumb');
  var titles = {inventory:'Inventory',staff:'Staff',reports:'Reports',overview:'Overview'};
  var subs = {inventory:'Par levels, waste, and vendor deliveries.',staff:'14 on floor · 2 on break.',reports:'Daily P&L, covers, and ticket averages.'};
  if (s === 'overview') {
    ov.classList.remove('hidden'); alt.classList.add('hidden'); crumb.textContent='Overview';
  } else {
    ov.classList.add('hidden'); alt.classList.remove('hidden');
    crumb.textContent = titles[s]||s;
    document.getElementById('mgr-alt-title').textContent = titles[s]||s;
    document.getElementById('mgr-alt-sub').textContent = subs[s]||'';
    document.querySelectorAll('.sidebar .sb-item').forEach(function(el){ el.classList.remove('active'); });
  }
}
document.getElementById('mgr-date').textContent = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
// Revenue chart
(function(){
  var REV=[18,22,24,28,32,38,44,43,48,54,58,64,70,76,72,80,84,88,92,96,94,92,96,100,102,106,102,98];
  var mx=Math.max.apply(null,REV);
  var c=document.getElementById('rev-bars');
  REV.forEach(function(v,i){
    var el=document.createElement('div');
    el.className='bar-col'+(i===18?' peak':'');
    el.style.height=(v/mx*100)+'%';
    c.appendChild(el);
  });
})();
function setRange(btn) {
  document.querySelectorAll('.range').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}
// live clock
function tick() {
  var n=new Date(), t=n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  var mc=document.getElementById('mgr-clock'); if(mc) mc.textContent=t;
  var kc=document.getElementById('kds-clock'); if(kc) kc.textContent=n.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
tick(); setInterval(tick,1000);

// ─── POS ───
var DISHES=[
  {id:1,cat:'starters',name:'Burrata di Andria',price:18,sub:'Heirloom tomato · basil oil',sym:'◯'},
  {id:2,cat:'starters',name:'Tuna Crudo',price:24,sub:'Citrus · radish · togarashi',sym:'~'},
  {id:3,cat:'starters',name:'Beef Tartare',price:22,sub:'Cured yolk · cornichon',sym:'◐'},
  {id:4,cat:'mains',name:'Côte de Bœuf',price:64,sub:'500g · bone marrow butter',sym:'◐'},
  {id:5,cat:'mains',name:'Black Cod Miso',price:42,sub:'Saikyo · pickled ginger',sym:'~',popular:true},
  {id:6,cat:'mains',name:'Risotto Milanese',price:32,sub:'Saffron · 24-month parmigiano',sym:'✦'},
  {id:7,cat:'mains',name:"Duck à l'Orange",price:46,sub:'Confit leg · gastrique',sym:'◐'},
  {id:8,cat:'mains',name:'Lobster Linguine',price:58,sub:'Maine · bisque · tarragon',sym:'✦',popular:true},
  {id:9,cat:'mains',name:'Wagyu A5 Sando',price:78,sub:'Milk bread · katsu',sym:'◐'},
  {id:10,cat:'desserts',name:'Soufflé Grand Marnier',price:16,sub:'Crème anglaise',sym:'◇'},
  {id:11,cat:'desserts',name:'Île Flottante',price:14,sub:'Almond praline',sym:'◇'},
  {id:12,cat:'desserts',name:'Tarte Tatin',price:15,sub:'Crème fraîche',sym:'◇'},
];
var posOrder={5:{qty:2,mods:['No ginger','Extra miso']},8:{qty:1,mods:['Spice ×2']},10:{qty:2,mods:[]},1:{qty:1,mods:[]}};
var posActiveCat='all';
var posPayment='open';

function posSetCat(btn,cat){
  document.querySelectorAll('#pos-pills .pill').forEach(function(p){ p.classList.remove('active'); });
  btn.classList.add('active');
  posActiveCat=cat;
  posRenderDishes();
}
function posRenderDishes(){
  var grid=document.getElementById('dish-grid'); grid.innerHTML='';
  DISHES.filter(function(d){ return posActiveCat==='all'||d.cat===posActiveCat; }).forEach(function(d){
    var inOrder=posOrder[d.id];
    var card=document.createElement('div');
    card.className='dish-card'+(inOrder?' in-order':'');
    card.innerHTML='<div class="plate-area"><div class="plate"><span class="plate-sym serif">'+d.sym+'</span></div>'+(d.popular?'<div class="popular-badge">★ Popular</div>':'')+(inOrder?'<div class="qty-overlay">× '+inOrder.qty+'</div>':'')+'</div><div class="dish-info"><div class="dish-name serif">'+d.name+'</div><div class="dish-price mono">$'+d.price+'</div><div class="dish-sub">'+d.sub+'</div></div>';
    card.addEventListener('click',function(){ posAddDish(d); });
    grid.appendChild(card);
  });
}
function posAddDish(d){
  if(posOrder[d.id]){ posOrder[d.id].qty++; } else { posOrder[d.id]={qty:1,mods:[]}; }
  posRenderDishes(); posRenderOrder();
}
function posChangeQty(id,delta){
  if(!posOrder[id]) return;
  posOrder[id].qty+=delta;
  if(posOrder[id].qty<=0) delete posOrder[id];
  posRenderDishes(); posRenderOrder();
}
function posRenderOrder(){
  var el=document.getElementById('op-items'); el.innerHTML='';
  Object.keys(posOrder).forEach(function(id){
    var o=posOrder[id]; var d=DISHES.find(function(x){ return x.id==id; }); if(!d) return;
    var row=document.createElement('div'); row.className='order-item';
    row.innerHTML='<div class="qty-badge">'+o.qty+'</div><div style="flex:1"><div style="display:flex;justify-content:space-between;gap:8px"><span class="item-name">'+d.name+'</span><span class="item-price mono">$'+(d.price*o.qty).toFixed(2)+'</span></div>'+(o.mods.length?'<div class="item-mod">'+o.mods.map(function(m){return'· '+m}).join(' ')+'</div>':'')+'<div class="qty-btns"><button class="qty-btn" onclick="posChangeQty('+id+',-1)">−</button><button class="qty-btn" onclick="posChangeQty('+id+',1)">+</button></div></div>';
    el.appendChild(row);
  });
  // extra btns
  var extras=document.createElement('div'); extras.className='extra-btns';
  extras.innerHTML='<button class="extra-btn">Add note</button><button class="extra-btn">Comp</button><button class="extra-btn">Split</button>';
  el.appendChild(extras);
  posTotals();
}
function posTotals(){
  var sub=Object.keys(posOrder).reduce(function(s,id){ var d=DISHES.find(function(x){return x.id==id;}); return s+(d?d.price*posOrder[id].qty:0); },0);
  var svc=sub*0.18, tax=sub*0.0875, tot=sub+svc+tax;
  document.getElementById('pos-subtotal').textContent='$'+sub.toFixed(2);
  document.getElementById('pos-service').textContent='$'+svc.toFixed(2);
  document.getElementById('pos-tax').textContent='$'+tax.toFixed(2);
  document.getElementById('pos-total').textContent='$'+tot.toFixed(2);
  document.getElementById('pos-charge-total').textContent='$'+tot.toFixed(2);
}
function posCharge(){
  if(posPayment!=='open') return;
  posPayment='card';
  var btn=document.getElementById('pos-charge-btn');
  btn.classList.add('done');
  document.getElementById('pos-charge-label').textContent='Charged';
}
function posAltPay(method){
  if(posPayment!=='open') return;
  posPayment=method;
  var btn=method==='cash'?document.getElementById('pos-cash-btn'):document.getElementById('pos-send-btn');
  btn.classList.add('done'); btn.textContent=method==='cash'?'✓ Cash':'✓ Sent';
}
posRenderDishes(); posRenderOrder();

// ─── KDS ───
var kdsNew=[
  {no:'#A-0428',table:'T·17',cover:'6 cov',server:'Léo D.',elapsed:0.5,priority:true,items:[{qty:2,name:'Black Cod Miso',mods:['No ginger ×1'],station:'POISSON'},{qty:1,name:'Côte de Bœuf',mods:['MR · 500g'],station:'GRILL'},{qty:3,name:'Tuna Crudo',mods:[],station:'GARDE'}]},
  {no:'#A-0427',table:'T·12',cover:'4 cov',server:'Jules R.',elapsed:3.2,items:[{qty:1,name:'Beef Tartare',mods:[],station:'GARDE'},{qty:2,name:'Lobster Linguine',mods:['Spice ×2','No tarragon'],alert:true,station:'PASTA'},{qty:1,name:'Risotto Milanese',mods:[],station:'PASTA'}]},
];
var kdsPrep=[
  {no:'#A-0425',table:'BAR',cover:'2 cov',server:'Tomás L.',elapsed:6.8,items:[{qty:1,name:"Duck à l'Orange",mods:['Confit leg only'],station:'GRILL'},{qty:1,name:'Burrata di Andria',mods:[],done:true,station:'GARDE'}]},
  {no:'#A-0424',table:'T·04',cover:'3 cov',server:'Inès M.',elapsed:9.5,items:[{qty:3,name:'Wagyu A5 Sando',mods:['No wasabi ×2'],station:'GRILL'},{qty:2,name:'Black Cod Miso',mods:[],done:true,station:'POISSON'},{qty:1,name:'Tuna Crudo',mods:['Allergy: shellfish'],alert:true,station:'GARDE'}]},
  {no:'#A-0421',table:'T·09',cover:'2 cov',server:'Jules R.',elapsed:16.4,items:[{qty:2,name:'Côte de Bœuf',mods:['Both MR','+ marrow'],station:'GRILL'},{qty:1,name:'Risotto Milanese',mods:[],done:true,station:'PASTA'}]},
];
var kdsReady=[
  {no:'#A-0420',table:'T·02',cover:'2 cov',server:'Tomás L.',elapsed:11.2,items:[{qty:2,name:'Soufflé Grand Marnier',mods:['Together'],done:true,station:'PÂTIS'}]},
  {no:'#A-0419',table:'T·15',cover:'4 cov',server:'Léo D.',elapsed:13.0,items:[{qty:4,name:'Île Flottante',mods:[],done:true,station:'PÂTIS'},{qty:2,name:'Tarte Tatin',mods:[],done:true,station:'PÂTIS'}]},
];
function kdsTimer(min){ var m=Math.floor(min),s=Math.floor((min%1)*60); return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
function kdsCard(order,status){
  var isAmber=order.elapsed>=8&&order.elapsed<15, isRed=order.elapsed>=15, isReady=status==='ready';
  var tc=isReady?'var(--ok)':isRed?'var(--err)':isAmber?'var(--warn)':'var(--p)';
  var bc=isReady?'rgba(46,204,138,0.4)':isRed?'rgba(232,69,69,0.5)':'rgba(59,130,246,0.28)';
  var state=isReady?'Ready':isRed?'Overdue':isAmber?'Push':'On Time';
  var btnCls=isReady?'delivered':status==='prep'?'ready':'fire';
  var btnTxt=isReady?'✓ Delivered':status==='prep'?'✓ Mark Ready':'🔥 Fire Order';
  var items=order.items.map(function(it){
    return '<div class="kds-item-row'+(it.done?' done':'')+'">'+'<div class="kds-qty">'+it.qty+'</div><div style="flex:1"><div class="kds-item-name'+(it.done?' done':'')+'">'+(it.name||'')+'</div>'+(it.mods&&it.mods.length?it.mods.map(function(m,j){return'<div class="kds-mod">'+(it.alert&&j===0?'⚠ ':' · ')+m+'</div>';}).join(''):'')+'</div><div class="kds-station mono">'+it.station+'</div></div>';
  }).join('');
  return '<div class="kds-card'+(isReady?' ready':isRed?' red':'')+'" style="border-color:'+bc+'">'+(status==='new'?'<div class="kds-top-glow"></div>':'')+'<div class="kds-card-head"><div><div style="display:flex;align-items:baseline"><span class="order-no mono">'+order.no+'</span>'+(order.priority?'<span class="vip-badge">★ VIP</span>':'')+'</div><div class="card-meta">'+order.table+' · '+order.cover+' · '+order.server+'</div></div><div style="text-align:right"><div class="timer mono" style="color:'+tc+'">'+kdsTimer(order.elapsed)+'</div><div class="timer-state">'+state+'</div></div></div><div class="kds-items">'+items+'</div><div class="kds-action"><button class="kds-action-btn '+btnCls+'" data-no="'+order.no+'" data-status="'+status+'" onclick="kdsAction(this)">'+btnTxt+'</button></div></div>';
}
function kdsRender(){
  document.getElementById('kds-new').innerHTML=kdsNew.map(function(o){return kdsCard(o,'new');}).join('');
  document.getElementById('kds-prep').innerHTML=kdsPrep.map(function(o){return kdsCard(o,'prep');}).join('');
  document.getElementById('kds-ready').innerHTML=kdsReady.map(function(o){return kdsCard(o,'ready');}).join('');
  document.getElementById('kds-new-count').textContent=kdsNew.length;
  document.getElementById('kds-prep-count').textContent=kdsPrep.length;
  document.getElementById('kds-ready-count').textContent=kdsReady.length;
  document.getElementById('kds-open').textContent=kdsNew.length+kdsPrep.length+kdsReady.length;
  document.getElementById('kds-overdue').textContent=kdsPrep.filter(function(o){return o.elapsed>=15;}).length;
}
function kdsAction(btn){
  var no=btn.getAttribute('data-no'), st=btn.getAttribute('data-status');
  if(st==='new'){ var o=kdsNew.find(function(x){return x.no===no;}); if(o){ kdsNew=kdsNew.filter(function(x){return x.no!==no;}); kdsPrep.push(o); } }
  else if(st==='prep'){ var o=kdsPrep.find(function(x){return x.no===no;}); if(o){ kdsPrep=kdsPrep.filter(function(x){return x.no!==no;}); kdsReady.push(o); } }
  else if(st==='ready'){ kdsReady=kdsReady.filter(function(x){return x.no!==no;}); }
  kdsRender();
}
function kdsStation(btn){ document.querySelectorAll('.station-btn').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); }
kdsRender();

// ─── WAITER FLOOR PLAN ───
var TABLES=[
  {id:'T·01',cov:2,status:'occupied',minutes:22,course:'Mains'},
  {id:'T·02',cov:2,status:'paying',minutes:71,course:'Bill'},
  {id:'T·03',cov:2,status:'occupied',minutes:14,course:'Starters'},
  {id:'T·04',cov:3,status:'occupied',minutes:9,course:'Order in'},
  {id:'T·05',cov:4,status:'empty'},
  {id:'T·06',cov:4,status:'reserved',course:'20:30 Park'},
  {id:'T·07',cov:4,status:'occupied',minutes:38,course:'Mains'},
  {id:'T·08',cov:4,status:'occupied',minutes:18,course:'Drinks'},
  {id:'T·09',cov:2,status:'occupied',minutes:52,course:'Dessert',round:true},
  {id:'T·10',cov:2,status:'attention',minutes:26,course:'!',round:true},
  {id:'T·11',cov:2,status:'empty',round:true},
  {id:'T·12',cov:4,status:'occupied',minutes:41,course:'Mains'},
  {id:'T·13',cov:6,status:'occupied',minutes:12,course:'Bread'},
  {id:'T·14',cov:6,status:'empty'},
  {id:'T·15',cov:4,status:'occupied',minutes:47,course:'Pre-dessert'},
  {id:'BAR',cov:8,status:'occupied',minutes:0,course:'Open'},
  {id:'PDR',cov:12,status:'occupied',minutes:64,course:'Tasting · 5/7'},
  {id:'T·17',cov:6,status:'occupied',minutes:6,course:'Order taken'},
  {id:'T·18',cov:4,status:'empty'},
];
var TS={empty:{bg:'transparent',border:'rgba(255,255,255,0.12)',style:'dashed',tc:'var(--t3)'},reserved:{bg:'rgba(147,197,253,0.06)',border:'rgba(147,197,253,0.35)',style:'solid',tc:'var(--ps)'},occupied:{bg:'var(--pbg)',border:'rgba(59,130,246,0.55)',style:'solid',tc:'var(--p)'},paying:{bg:'rgba(46,204,138,0.08)',border:'rgba(46,204,138,0.55)',style:'solid',tc:'var(--ok)'},attention:{bg:'rgba(232,69,69,0.08)',border:'rgba(232,69,69,0.7)',style:'solid',tc:'var(--err)'}};
var selTable='T·12';
function renderFloor(){
  var zones=[
    {label:'Window Banquette',ids:['T·01','T·02','T·03','T·04']},
    {label:'Central Salon',ids:['T·05','T·06','T·07','T·08']},
    {label:'Round Tables',round:true},
    {label:'6-Tops · Banquette',ids:['T·12','T·13','T·14','T·15']},
    {label:'Bar · Private Dining',ids:['BAR','PDR','T·17','T·18']},
  ];
  var html='';
  zones.forEach(function(z){
    var tables=z.round?TABLES.filter(function(t){return t.round;}):TABLES.filter(function(t){return z.ids&&z.ids.includes(t.id);});
    html+='<div class="zone-label">'+z.label+'</div><div class="table-group">';
    tables.forEach(function(t){
      var s=TS[t.status]||TS.empty;
      var sel=t.id===selTable;
      html+='<div class="table-card'+(t.round?' round':'')+(sel?' selected':'')+'" style="background:'+s.bg+';border-color:'+(sel?'var(--p)':s.border)+';border-style:'+(sel?'solid':s.style)+';border-width:'+(sel?2:1)+'px" onclick="selectTable(\''+t.id+'\',\''+t.status+'\')">'
        +'<div class="table-id" style="color:'+s.tc+'">'+t.id+'</div>'
        +(t.status!=='empty'&&t.course?'<div class="table-course">'+t.course+'</div>':'<div class="table-cov">'+t.cov+'-top</div>')
        +(t.status==='occupied'&&t.minutes?'<div class="table-time mono" style="color:'+s.tc+'">'+t.minutes+'m</div>':'')
        +(t.status==='attention'?'<div class="alert-dot">!</div>':'')
        +'</div>';
    });
    html+='</div>';
  });
  document.getElementById('floor-grid').innerHTML=html;
}
function selectTable(id,status){
  selTable=id;
  var sheet=document.getElementById('order-sheet');
  if(status==='empty'){ sheet.classList.add('hidden'); }
  else { sheet.classList.remove('hidden'); document.getElementById('sheet-eyebrow').textContent=id+' · Active'; }
  renderFloor();
}
function closeSheet(){ document.getElementById('order-sheet').classList.add('hidden'); }
function sheetSend(){ var btn=document.getElementById('sheet-send'); btn.classList.add('done'); btn.textContent='✓ Sent'; }
function waiterView(btn){ document.querySelectorAll('.view-tab').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); }
renderFloor();

// ─── MOBILE ORDERS ───
function mobFilter(btn){ document.querySelectorAll('.mob-pill').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); }
</script>
</body>
</html>`;
}
