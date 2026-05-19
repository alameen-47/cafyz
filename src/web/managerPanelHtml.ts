/** Self-contained manager dashboard HTML for WebView (matches Cafyz theme). */

const SECTION_TITLES: Record<string, { title: string; sub: string }> = {
  manager: {
    title: 'Good evening, Mireille.',
    sub: 'Service is at <strong>84% capacity</strong>. Three reservations expected after 21:00.',
  },
  inventory: {
    title: 'Inventory',
    sub: 'Par levels, waste, and vendor deliveries for tonight’s service.',
  },
  staff: {
    title: 'Staff',
    sub: '14 on floor · 2 on break · 3 reservations need coverage after 21:00.',
  },
  reports: {
    title: 'Reports',
    sub: 'Daily P&amp;L, covers, and ticket averages for Saint · Paris 6e.',
  },
};

export function getManagerPanelHtml(activeSection = 'manager'): string {
  const section = SECTION_TITLES[activeSection] ?? SECTION_TITLES.manager;
  const showOverview = activeSection === 'manager';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Cafyz Manager</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #0A0A0F; color: #F5F5F0;
      font-family: Inter, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .panel { padding: 20px 24px 40px; max-width: 1200px; margin: 0 auto; }
    .eyebrow {
      font-size: 10px; font-weight: 600; letter-spacing: 2px;
      text-transform: uppercase; color: #C9A84C; margin-bottom: 6px;
    }
    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(26px, 4vw, 34px); font-weight: 600;
      letter-spacing: -0.5px; margin-bottom: 8px;
    }
    .subtitle { font-size: 14px; color: #8A8A9A; line-height: 1.5; max-width: 520px; }
    .subtitle strong { color: #F5F5F0; font-weight: 500; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 24px; }
    .btn {
      height: 40px; padding: 0 16px; border-radius: 8px;
      font-size: 11px; font-weight: 600; letter-spacing: 1.2px;
      text-transform: uppercase; border: 0.5px solid rgba(255,255,255,0.1);
      background: transparent; color: #B8B8C2; cursor: pointer;
    }
    .btn-secondary { border-color: rgba(201,168,76,0.28); color: #E8D5A3; }
    .btn-primary { background: #C9A84C; border-color: #C9A84C; color: #0A0A0F; }
    .metrics {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 14px; margin-bottom: 20px;
    }
    .card {
      background: #12121A; border: 0.5px solid rgba(201,168,76,0.15);
      border-radius: 12px; padding: 16px;
    }
    .metric-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .metric-icon {
      width: 36px; height: 36px; border-radius: 8px;
      background: rgba(201,168,76,0.08);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .delta { font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 6px; }
    .delta-up { background: rgba(46,204,138,0.14); color: #2ECC8A; }
    .delta-down { background: rgba(232,69,69,0.14); color: #E84545; }
    .metric-label {
      font-size: 10px; color: #8A8A9A; text-transform: uppercase;
      letter-spacing: 1.5px; margin-bottom: 4px;
    }
    .metric-value {
      font-family: 'Playfair Display', serif; font-size: 28px; color: #C9A84C;
    }
    .metric-sub { font-size: 12px; color: #5A5A6A; margin-top: 8px; }
    .chart-row { display: grid; grid-template-columns: 1fr; gap: 14px; margin-bottom: 20px; }
    @media (min-width: 900px) { .chart-row { grid-template-columns: 1.4fr 1fr; } }
    .chart-header {
      display: flex; justify-content: space-between; flex-wrap: wrap;
      gap: 12px; margin-bottom: 16px;
    }
    .chart-title { font-family: 'Playfair Display', serif; font-size: 18px; }
    .chart-sub {
      font-size: 10px; color: #8A8A9A; text-transform: uppercase; letter-spacing: 1.5px;
    }
    .ranges { display: flex; gap: 4px; }
    .range {
      height: 32px; padding: 0 12px; border-radius: 8px; border: none;
      background: transparent; color: #8A8A9A; font-size: 11px;
      font-weight: 600; cursor: pointer; text-transform: uppercase;
    }
    .range.active { background: rgba(201,168,76,0.12); color: #C9A84C; }
    .bars { display: flex; align-items: flex-end; gap: 3px; height: 160px; }
    .bar { flex: 1; min-width: 4px; border-radius: 3px 3px 0 0; background: rgba(201,168,76,0.25); }
    .bar.peak { background: #C9A84C; }
    .x-labels {
      display: flex; justify-content: space-between; margin-top: 8px;
      font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #5A5A6A;
    }
    .side-stack { display: flex; flex-direction: column; gap: 14px; }
    .side-label {
      font-size: 10px; color: #8A8A9A; text-transform: uppercase;
      letter-spacing: 1.5px; margin-bottom: 12px;
    }
    .performer { padding: 10px 0; border-bottom: 0.5px solid rgba(255,255,255,0.06); }
    .performer:last-child { border: none; }
    .performer-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
    .bar-track { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #C9A84C, #E8D5A3); }
    .res-row {
      display: flex; gap: 12px; align-items: center; padding: 12px 0;
      border-bottom: 0.5px solid rgba(255,255,255,0.06);
    }
    .res-time { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #C9A84C; width: 44px; }
    .res-note { font-size: 11px; color: #8A8A9A; margin-top: 2px; }
    .orders-card { padding: 0; overflow: hidden; }
    .orders-head {
      padding: 20px; display: flex; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; border-bottom: 0.5px solid rgba(201,168,76,0.15);
    }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th {
      text-align: left; padding: 12px 16px; font-size: 9px; font-weight: 600;
      color: #5A5A6A; text-transform: uppercase; letter-spacing: 1.5px;
      border-bottom: 0.5px solid rgba(201,168,76,0.15);
    }
    .table td { padding: 14px 16px; border-bottom: 0.5px solid rgba(255,255,255,0.04); }
    .table tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
    .ticket { font-family: 'JetBrains Mono', monospace; color: #C9A84C; font-weight: 500; }
    .badge {
      display: inline-block; padding: 4px 10px; border-radius: 6px;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
    }
    .badge-paid { background: rgba(46,204,138,0.16); color: #2ECC8A; }
    .badge-pending { background: rgba(240,165,0,0.16); color: #F0A500; }
    .badge-new { background: rgba(201,168,76,0.16); color: #C9A84C; }
    .badge-cancel { background: rgba(232,69,69,0.18); color: #E84545; }
    .hidden { display: none !important; }
    .placeholder {
      padding: 48px 24px; text-align: center; color: #8A8A9A;
      border: 0.5px dashed rgba(201,168,76,0.28); border-radius: 12px; margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="panel">
    <p class="eyebrow" id="date-line">Operations</p>
    <h1>${section.title}</h1>
    <p class="subtitle">${section.sub}</p>
    <div class="actions">
      <button type="button" class="btn" onclick="post('export')">Export</button>
      <button type="button" class="btn btn-secondary" onclick="post('report')">Daily Report</button>
      <button type="button" class="btn btn-primary" onclick="post('navigate','pos')">+ New Order</button>
    </div>

    <div id="overview" class="${showOverview ? '' : 'hidden'}">
      <div class="metrics">
        <div class="card"><div class="metric-top"><span class="metric-icon">💰</span><span class="delta delta-up">↑ 12.4%</span></div><p class="metric-label">Revenue · Today</p><p class="metric-value">$18,624</p><p class="metric-sub">vs. yesterday</p></div>
        <div class="card"><div class="metric-top"><span class="metric-icon">🧾</span><span class="delta delta-up">↑ 6.1%</span></div><p class="metric-label">Orders</p><p class="metric-value">142</p><p class="metric-sub">84 covers</p></div>
        <div class="card"><div class="metric-top"><span class="metric-icon">⏱</span><span class="delta delta-down">↓ 3.2%</span></div><p class="metric-label">Avg. Table Time</p><p class="metric-value">58m</p><p class="metric-sub">↓ 4m vs. last week</p></div>
        <div class="card"><div class="metric-top"><span class="metric-icon">👥</span><span class="delta delta-up">—</span></div><p class="metric-label">Staff On</p><p class="metric-value">14</p><p class="metric-sub">2 on break</p></div>
      </div>
      <div class="chart-row">
        <div class="card">
          <div class="chart-header">
            <div><p class="chart-sub">Revenue Cadence</p><p class="chart-title">Today's service · hourly</p></div>
            <div class="ranges" id="ranges">
              <button type="button" class="range active">1D</button>
              <button type="button" class="range">1W</button>
              <button type="button" class="range">1M</button>
              <button type="button" class="range">YTD</button>
            </div>
          </div>
          <div class="bars" id="bars"></div>
          <div class="x-labels"><span>11A</span><span>1P</span><span>3P</span><span>5P</span><span>7P</span><span>9P</span><span>11P</span></div>
        </div>
        <div class="side-stack">
          <div class="card">
            <p class="side-label">Top performers</p>
            <div class="performer"><div class="performer-row"><span>Black Cod Miso</span><span>28×</span></div><div class="bar-track"><div class="bar-fill" style="width:92%"></div></div></div>
            <div class="performer"><div class="performer-row"><span>Côte de Bœuf</span><span>19×</span></div><div class="bar-track"><div class="bar-fill" style="width:78%"></div></div></div>
            <div class="performer"><div class="performer-row"><span>Lobster Linguine</span><span>16×</span></div><div class="bar-track"><div class="bar-fill" style="width:64%"></div></div></div>
            <div class="performer"><div class="performer-row"><span>Tarte Tatin</span><span>22×</span></div><div class="bar-track"><div class="bar-fill" style="width:52%"></div></div></div>
          </div>
          <div class="card">
            <p class="side-label">Reservations · Tonight <span style="float:right;color:#C9A84C">18 / 22</span></p>
            <div class="res-row"><span class="res-time">20:15</span><div><div>Bernard, J. · 2 cov</div><div class="res-note">Anniversary</div></div></div>
            <div class="res-row"><span class="res-time">20:30</span><div><div>Park, S. · 4 cov</div><div class="res-note">VIP · No nuts</div></div></div>
            <div class="res-row"><span class="res-time">21:00</span><div><div>Wei, L. · 6 cov</div><div class="res-note">Private corner</div></div></div>
          </div>
        </div>
      </div>
      <div class="card orders-card">
        <div class="orders-head">
          <div><p class="chart-sub">Recent Orders</p><p class="chart-title">Last 60 minutes · 18 tickets</p></div>
          <div><button type="button" class="btn">Filter</button> <button type="button" class="btn">View all</button></div>
        </div>
        <table class="table">
          <thead><tr><th>Ticket</th><th>Table</th><th>Server</th><th>Items</th><th>Opened</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td class="ticket">#A-0427</td><td>T·12</td><td>Jules Renaud</td><td>11</td><td>00:41</td><td>$184.50</td><td><span class="badge badge-pending">Open</span></td></tr>
            <tr><td class="ticket">#A-0426</td><td>T·08</td><td>Inès Marchal</td><td>6</td><td>00:18</td><td>$92.00</td><td><span class="badge badge-paid">Paid</span></td></tr>
            <tr><td class="ticket">#A-0425</td><td>BAR</td><td>Tomás Lévy</td><td>3</td><td>00:14</td><td>$54.00</td><td><span class="badge badge-paid">Paid</span></td></tr>
            <tr><td class="ticket">#A-0424</td><td>T·04</td><td>Inès Marchal</td><td>8</td><td>00:09</td><td>$142.50</td><td><span class="badge badge-new">New</span></td></tr>
            <tr><td class="ticket">#A-0423</td><td>T·17</td><td>Léo Dauphin</td><td>9</td><td>00:06</td><td>$218.00</td><td><span class="badge badge-pending">Open</span></td></tr>
            <tr><td class="ticket">#A-0422</td><td>T·02</td><td>Jules Renaud</td><td>5</td><td>00:03</td><td>$78.50</td><td><span class="badge badge-cancel">Voided</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="alt-section" class="${showOverview ? 'hidden' : ''}">
      <div class="placeholder">
        <p style="font-size:18px;color:#C9A84C;margin-bottom:8px">${section.title}</p>
        <p>Module view · connect Turso for live data. Use Overview in the sidebar to return.</p>
      </div>
    </div>
  </div>
  <script>
    const REVENUE = [18,22,24,28,32,38,44,43,48,54,58,64,70,76,72,80,84,88,92,96,94,92,96,100,102,106,102,98];
    const max = Math.max.apply(null, REVENUE);
    const bars = document.getElementById('bars');
    REVENUE.forEach(function(v, i) {
      var el = document.createElement('div');
      el.className = 'bar' + (i === 18 ? ' peak' : '');
      el.style.height = (v / max * 100) + '%';
      bars.appendChild(el);
    });
    document.getElementById('ranges').addEventListener('click', function(e) {
      var btn = e.target.closest('.range');
      if (!btn) return;
      document.querySelectorAll('.range').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
    function post(type, screen) {
      var payload = screen ? { type: type, screen: screen } : { type: type };
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }
    window.setManagerSection = function(section) {
      var overview = document.getElementById('overview');
      var alt = document.getElementById('alt-section');
      if (section === 'manager') {
        overview.classList.remove('hidden');
        alt.classList.add('hidden');
      } else {
        overview.classList.add('hidden');
        alt.classList.remove('hidden');
      }
    };
    document.getElementById('date-line').textContent =
      new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  </script>
</body>
</html>`;
}
