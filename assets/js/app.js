:root {
  --bg: #07111f;
  --panel: #0d1b2d;
  --panel-2: #112238;
  --panel-3: #152b46;
  --text: #f5f7fb;
  --muted: #9db0ca;
  --soft: #d7e3f5;
  --border: rgba(255, 255, 255, .1);
  --accent: #4bd4a1;
  --accent-2: #5da8ff;
  --warn: #f4c95d;
  --danger: #ff7171;
  --ok: #6ee7b7;
  --shadow: 0 20px 60px rgba(0, 0, 0, .28);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at 10% 0%, rgba(77, 212, 161, .18), transparent 34%),
    radial-gradient(circle at 90% 8%, rgba(93, 168, 255, .16), transparent 30%),
    var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
}

button, input, select { font: inherit; }

.app-shell {
  width: min(1220px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0 40px;
}

.site-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 26px;
  background: linear-gradient(135deg, rgba(13, 27, 45, .92), rgba(17, 34, 56, .72));
  box-shadow: var(--shadow);
}

.eyebrow {
  color: var(--accent);
  font-size: 13px;
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

h1, h2, h3, p { margin-top: 0; }

h1 {
  margin-bottom: 8px;
  font-size: clamp(30px, 4vw, 48px);
  letter-spacing: -0.04em;
}

h2 { font-size: 24px; margin-bottom: 14px; }
h3 { font-size: 18px; margin-bottom: 10px; }

.subhead {
  margin-bottom: 0;
  max-width: 760px;
  color: var(--muted);
  line-height: 1.65;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn {
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 999px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, .06);
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
}

.btn:hover { transform: translateY(-1px); border-color: rgba(255,255,255,.2); }
.btn.primary { background: linear-gradient(135deg, #20c997, #3aa6ff); color: #06111e; font-weight: 700; }
.btn.ghost { color: var(--soft); }

.tabs {
  display: flex;
  gap: 8px;
  margin: 20px 0;
  padding: 6px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: rgba(13, 27, 45, .68);
}

.tab {
  white-space: nowrap;
  border: 0;
  color: var(--muted);
  background: transparent;
  padding: 11px 16px;
  border-radius: 14px;
  cursor: pointer;
}

.tab.active {
  color: #06111e;
  background: var(--accent);
  font-weight: 700;
}

.status-bar {
  margin-bottom: 18px;
  padding: 12px 16px;
  color: var(--soft);
  background: rgba(255,255,255,.055);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.view { display: none; }
.view.active { display: block; }

.grid {
  display: grid;
  gap: 16px;
}

.grid.cards-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid.cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.cards-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.panel, .metric, .match-card, .table-shell, .filter-panel {
  border: 1px solid var(--border);
  border-radius: 22px;
  background: rgba(13, 27, 45, .72);
  box-shadow: 0 12px 34px rgba(0,0,0,.18);
}

.panel { padding: 20px; margin-bottom: 18px; }

.metric { padding: 18px; }
.metric .label { color: var(--muted); font-size: 13px; }
.metric .value { margin-top: 7px; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }
.metric .note { margin-top: 6px; color: var(--muted); font-size: 12px; }

.match-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.match-card.compact { padding: 15px; }

.match-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.stage { color: var(--muted); font-size: 12px; }
.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  background: rgba(255,255,255,.08);
  color: var(--soft);
  border: 1px solid var(--border);
}
.status-pill.done { color: #042217; background: var(--ok); border-color: transparent; font-weight: 700; }
.status-pill.live { color: #2b1600; background: var(--warn); border-color: transparent; font-weight: 700; }

.teams {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: center;
}

.team-name {
  font-size: 18px;
  font-weight: 800;
  word-break: keep-all;
}
.team-name.away { text-align: right; }
.vs { color: var(--muted); font-weight: 700; }
.score-line {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  color: var(--soft);
}
.score-tag {
  display: inline-flex;
  border-radius: 10px;
  padding: 5px 8px;
  background: rgba(75, 212, 161, .12);
  color: #bdf7df;
  border: 1px solid rgba(75, 212, 161, .25);
  font-weight: 700;
}
.score-tag.actual {
  background: rgba(93, 168, 255, .13);
  border-color: rgba(93, 168, 255, .27);
  color: #cfe6ff;
}
.badge-line {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.badge {
  display: inline-flex;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 12px;
  color: var(--soft);
  background: rgba(255,255,255,.06);
  border: 1px solid var(--border);
}
.badge.warn { color: #ffe9a3; border-color: rgba(244,201,93,.32); background: rgba(244,201,93,.1); }
.badge.ok { color: #bdf7df; border-color: rgba(75,212,161,.32); background: rgba(75,212,161,.1); }
.badge.danger { color: #ffd1d1; border-color: rgba(255,113,113,.32); background: rgba(255,113,113,.1); }

.filters {
  display: grid;
  grid-template-columns: 1fr 180px 180px;
  gap: 12px;
}
.input, .select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 11px 12px;
  color: var(--text);
  background: rgba(255,255,255,.065);
  outline: none;
}
.select option { color: #0c1726; }

.table-shell { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 760px; }
th, td { padding: 12px 14px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { color: var(--muted); font-size: 13px; font-weight: 700; background: rgba(255,255,255,.035); }
td { color: var(--soft); }
tr:last-child td { border-bottom: 0; }

.muted { color: var(--muted); }
.warn-text { color: #ffe3a3; }
.ok-text { color: #bdf7df; }
.danger-text { color: #ffd1d1; }

.empty {
  padding: 36px 20px;
  text-align: center;
  color: var(--muted);
}

.data-diagnostics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.code-note {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(0, 0, 0, .22);
  border: 1px solid var(--border);
  overflow: auto;
}

.site-footer {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 24px;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 920px) {
  .site-header { flex-direction: column; }
  .header-actions { justify-content: flex-start; }
  .grid.cards-4, .grid.cards-3, .grid.cards-2, .data-diagnostics { grid-template-columns: 1fr; }
  .filters { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .app-shell { width: min(100vw - 20px, 1220px); padding-top: 12px; }
  .site-header { padding: 18px; border-radius: 20px; }
  .teams { grid-template-columns: 1fr; }
  .team-name.away { text-align: left; }
  .vs { display: none; }
}


/* V10.4.2 enhanced responsive brand/layout patch */
.brand-block {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}
.brand-logo {
  width: 58px;
  height: 58px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: linear-gradient(135deg, #4bd4a1, #5da8ff);
  color: #06111e;
  font-weight: 900;
  font-size: 22px;
  letter-spacing: -0.08em;
  text-transform: lowercase;
  box-shadow: 0 12px 30px rgba(0, 0, 0, .28);
  user-select: none;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.section-head h2 { margin-bottom: 0; }
.section-compact .match-card.compact {
  min-height: 100%;
}
.filters.filters-4 {
  grid-template-columns: minmax(220px, 1.3fr) minmax(150px, .7fr) minmax(150px, .7fr) minmax(150px, .7fr);
}
.match-card.finished-card {
  border-color: rgba(110, 231, 183, .18);
}
.score-line .badge {
  line-height: 1.45;
}
.match-card.compact .score-line,
.match-card.compact .badge-line {
  font-size: 13px;
}
.match-card.compact .team-name {
  font-size: 17px;
}
.data-layer-home {
  margin-top: 22px;
}

@media (min-width: 1180px) {
  .app-shell { width: min(1280px, calc(100vw - 64px)); }
  .grid.cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid.cards-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .match-card { min-height: 268px; }
}

@media (min-width: 921px) and (max-width: 1179px) {
  .grid.cards-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.cards-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filters.filters-4 { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 920px) {
  .brand-block { align-items: center; }
  .brand-logo { width: 52px; height: 52px; border-radius: 16px; }
  .filters.filters-4 { grid-template-columns: 1fr; }
  .section-head { align-items: flex-start; }
  .site-header { gap: 18px; }
}

@media (max-width: 560px) {
  body {
    background:
      radial-gradient(circle at 0% 0%, rgba(77, 212, 161, .22), transparent 28%),
      radial-gradient(circle at 100% 0%, rgba(93, 168, 255, .16), transparent 34%),
      var(--bg);
  }
  .app-shell { width: min(100vw - 22px, 1220px); padding-top: 12px; padding-bottom: 28px; }
  .site-header { padding: 17px; border-radius: 22px; }
  .brand-block { gap: 12px; align-items: flex-start; }
  .brand-logo { width: 46px; height: 46px; border-radius: 14px; }
  .eyebrow { font-size: 12px; }
  h1 { font-size: clamp(30px, 9vw, 40px); line-height: 1.06; }
  .subhead { font-size: 15px; line-height: 1.65; }
  .header-actions { width: 100%; gap: 10px; }
  .header-actions .btn { flex: 1 1 0; text-align: center; padding: 12px 14px; }
  .tabs { position: sticky; top: 0; z-index: 5; border-radius: 18px; background: rgba(7, 17, 31, .92); backdrop-filter: blur(10px); }
  .tab { padding: 12px 14px; font-size: 15px; }
  .status-bar { font-size: 14px; line-height: 1.55; }
  .panel { padding: 16px; border-radius: 22px; margin-bottom: 16px; }
  .metric { padding: 15px; }
  .metric .value { font-size: 28px; }
  .match-card { padding: 16px; border-radius: 22px; gap: 13px; }
  .match-top { align-items: flex-start; }
  .stage { font-size: 12px; line-height: 1.45; }
  .teams { grid-template-columns: 1fr; gap: 6px; }
  .team-name { font-size: 24px; line-height: 1.2; }
  .team-name.away { text-align: left; }
  .vs { display: none; }
  .score-line { gap: 7px; font-size: 15px; }
  .score-tag { font-size: 18px; padding: 7px 10px; border-radius: 12px; }
  .badge { font-size: 13px; line-height: 1.45; }
  .input, .select { min-height: 48px; border-radius: 16px; font-size: 16px; }
  .data-diagnostics { gap: 10px; }
  .code-note { font-size: 12px; }
  .site-footer { font-size: 12px; padding-bottom: 12px; }
}


/* V10.4.2 today/beijing sorting patch */
.section-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn.mini {
  padding: 7px 12px;
  font-size: 13px;
  border-radius: 999px;
}
.today-entry .section-head p {
  margin: 6px 0 0;
}
.today-entry {
  border-color: rgba(75, 212, 161, .2);
  background: linear-gradient(135deg, rgba(13, 27, 45, .8), rgba(35, 74, 94, .5));
}

@media (max-width: 560px) {
  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }
  .section-actions {
    width: 100%;
    justify-content: space-between;
  }
  .section-actions .btn,
  .today-entry .btn.mini {
    width: 100%;
    text-align: center;
    padding: 11px 14px;
    font-size: 15px;
  }
}
