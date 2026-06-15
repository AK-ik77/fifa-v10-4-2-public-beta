(() => {
  'use strict';

  const CONFIG = window.FIFA_CONFIG || {};
  const VERSION = CONFIG.VERSION || 'V10.4.2 公测版';
  const CACHE_KEY = 'fifa_world_cup_predictor_v10_4_2_workers_layout_cache_v1';
  const CACHE_TIME_KEY = 'fifa_world_cup_predictor_v10_4_2_workers_layout_cache_time_v1';
  const BEIJING_TZ = 'Asia/Shanghai';
  const MS_DAY = 86400000;

  const state = {
    matches: [],
    source: 'init',
    activeMode: 'today',
    search: '',
    date: 'all',
    status: 'all',
    group: 'all',
    error: null,
    lastLoadedAt: null,
    loading: false
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const els = {
    statusBar: $('#statusBar'),
    refreshBtn: $('#refreshBtn'),
    clearCacheBtn: $('#clearCacheBtn'),
    modeTitle: $('#modeTitle'),
    todaySummary: $('#todaySummary'),
    spotlightGrid: $('#spotlightGrid'),
    dateStrip: $('#dateStrip'),
    searchInput: $('#searchInput'),
    dateFilter: $('#dateFilter'),
    statusFilter: $('#statusFilter'),
    groupFilter: $('#groupFilter'),
    scheduleGrid: $('#scheduleGrid'),
    riskList: $('#riskList'),
    confidenceList: $('#confidenceList'),
    riskCount: $('#riskCount'),
    confidenceCount: $('#confidenceCount'),
    metricsGrid: $('#metricsGrid'),
    reviewList: $('#reviewList')
  };

  const demoMatches = [
    { id: 620001, data: { homeCn: '墨西哥', awayCn: '南非', status: '完赛', stage: '小组赛', group: 'A组', kickoff: '2026-06-11T19:00:00Z', predictions: ['1:0','1:1','2:1'], recommendation: '主胜或平', risk: '中', confidence: 62, postMatchResult: { actualScore: '2:0' }, actualScore: '2:0' } },
    { id: 620002, data: { homeCn: '韩国', awayCn: '捷克', status: '完赛', stage: '小组赛', group: 'A组', kickoff: '2026-06-12T02:00:00Z', topScores: ['1:1','2:1','0:0'], recommendation: '平局保护', risk: '高', confidence: 54, actualScore: '2:1' } },
    { id: 620021, data: { homeCn: '美国', awayCn: '澳大利亚', status: '未开赛', stage: '小组赛', group: 'C组', kickoff: '2026-06-18T01:00:00Z', modelScores: ['2:1','1:1','1:0'], recommendation: '主队不败', risk: '中', confidence: 58 } },
    { id: 620025, data: { homeCn: '德国', awayCn: '巴拉圭', status: '完赛', stage: '小组赛', group: 'D组', kickoff: '2026-06-19T19:00:00Z', primaryScores: ['2:0','2:1','1:0'], recommendation: '主胜', risk: '低', confidence: 71, finalScore: '7:1', homeScore: 7, awayScore: 1 } }
  ];

  function html(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function compact(value, fallback = '暂无', depth = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'string') return value.trim() || fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (Array.isArray(value)) {
      const parts = value.map(v => compact(v, '', depth + 1)).filter(Boolean);
      return parts.length ? [...new Set(parts)].join(' / ') : fallback;
    }
    if (isObj(value)) {
      const keys = ['text','label','name','title','summary','display','zh','cn','value','direction','pick','resultPick','winnerPick','modelPick','recommend','recommendation','advice','suggestion','primary','main','choice','result','level','risk','riskLevel','desc','reason'];
      const out = [];
      keys.forEach(k => {
        if (Object.prototype.hasOwnProperty.call(value, k)) {
          const t = compact(value[k], '', depth + 1);
          if (t && !/^\[object Object\]$/i.test(t)) out.push(t);
        }
      });
      if (!out.length && depth < 2) {
        Object.entries(value).forEach(([k,v]) => {
          if (['id','key','code','raw','data'].includes(k)) return;
          const t = compact(v, '', depth + 1);
          if (t && !/^\[object Object\]$/i.test(t)) out.push(t);
        });
      }
      return out.length ? [...new Set(out)].slice(0, 4).join(' / ') : fallback;
    }
    return fallback;
  }
  function read(obj, paths, fallback = undefined) {
    for (const p of paths) {
      const parts = String(p).split('.');
      let cur = obj;
      let ok = true;
      for (const part of parts) {
        if (cur === null || cur === undefined || !Object.prototype.hasOwnProperty.call(cur, part)) { ok = false; break; }
        cur = cur[part];
      }
      if (ok && cur !== undefined && cur !== null && cur !== '') return cur;
    }
    return fallback;
  }
  function data(row) { return isObj(row?.data) ? row.data : (isObj(row) ? row : {}); }
  function normalizeRows(rows) { return (rows || []).map((row, i) => ({ ...row, _idx: i })); }

  function recursiveDateCandidates(value, out = [], depth = 0, keyHint = '') {
    if (depth > 4 || value === null || value === undefined) return out;
    if (typeof value === 'string' || typeof value === 'number') {
      const s = String(value).trim();
      if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) || /\d{1,2}[:：]\d{2}/.test(s)) {
        if (!keyHint || /date|time|kick|start|utc|local|beijing|match|fixture|开球|时间|日期/i.test(keyHint)) out.push(s);
      }
      return out;
    }
    if (Array.isArray(value)) { value.forEach(v => recursiveDateCandidates(v, out, depth + 1, keyHint)); return out; }
    if (isObj(value)) {
      Object.entries(value).forEach(([k, v]) => recursiveDateCandidates(v, out, depth + 1, k));
    }
    return out;
  }
  function parseDateCandidate(raw) {
    if (!raw) return null;
    let text = String(raw).trim().replace(/年|\//g, '-').replace(/月/g, '-').replace(/日/g, ' ');
    text = text.replace('：', ':');
    let d = null;
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(text) || /T/.test(text)) d = new Date(text);
    if (!d || Number.isNaN(d.getTime())) {
      const m = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})(?:\s+|T)?(\d{1,2})?:?(\d{2})?/);
      if (m) {
        const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]), hh = Number(m[4] || 0), mi = Number(m[5] || 0);
        // Treat date strings without timezone as Beijing time.
        d = new Date(Date.UTC(y, mo - 1, da, hh - 8, mi, 0));
      }
    }
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }
  function matchDate(row) {
    const d = data(row);
    const direct = read(row, ['kickoff','date','matchTime','utcTime','localTime','beijingTime','startTime','matchDate','fixture.date','schedule.date','data.kickoff','data.date','data.matchTime','data.utcTime','data.localTime','data.beijingTime','data.startTime','data.matchDate','data.fixture.date','data.schedule.date'], null);
    const candidates = [];
    if (direct) candidates.push(direct);
    recursiveDateCandidates(d, candidates);
    for (const c of candidates) {
      const parsed = parseDateCandidate(c);
      if (parsed) return parsed;
    }
    return null;
  }
  function bjParts(date) {
    if (!date) return null;
    const fmt = new Intl.DateTimeFormat('zh-CN', { timeZone: BEIJING_TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false, weekday:'short' });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour, min: parts.minute, wd: parts.weekday };
  }
  function dateKey(row) { const p = bjParts(matchDate(row)); return p ? `${p.y}-${p.m}-${p.d}` : 'unknown'; }
  function dateLabelFromKey(key) {
    if (key === 'unknown') return '时间待定';
    const d = new Date(`${key}T00:00:00+08:00`);
    const p = bjParts(d);
    return p ? `${p.m}/${p.d} ${p.wd}` : key;
  }
  function timeText(row) {
    const p = bjParts(matchDate(row));
    return p ? `北京时间 ${p.m}/${p.d} ${p.h}:${p.min}` : '时间待定';
  }
  function sortByBeijing(list) {
    return [...list].sort((a,b) => {
      const da = matchDate(a), db = matchDate(b);
      const ta = da ? da.getTime() : Number.MAX_SAFE_INTEGER;
      const tb = db ? db.getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return Number(a.id || data(a).id || a._idx || 0) - Number(b.id || data(b).id || b._idx || 0);
    });
  }

  function team(row, side) { return compact(read(row, [`data.${side}Cn`, `data.${side}CN`, `data.${side}NameCn`, `data.${side}`, `${side}Cn`, `${side}`], ''), side === 'home' ? '主队' : '客队'); }
  function stage(row) { return compact(read(row, ['data.stage','stage'], '小组赛')); }
  function group(row) { return compact(read(row, ['data.group','data.groupName','group','groupName'], ''), ''); }
  function stageGroup(row) { return [stage(row), group(row)].filter(Boolean).join(' · '); }
  function rawStatus(row) { return compact(read(row, ['data.status','status','data.matchStatus','matchStatus'], ''), '未开赛'); }
  function status(row) {
    const s = rawStatus(row);
    if (/赛后|完赛|结束|finished|full|FT|已完/i.test(s)) return '完赛';
    if (/进行|live|中场|半场/i.test(s)) return '进行中';
    return '未开赛';
  }
  function statusClass(s) { return s === '完赛' ? 'finished' : s === '进行中' ? 'live' : 'upcoming'; }
  function isFinished(row) { return status(row) === '完赛' || Boolean(actualScore(row)); }
  function isUpcoming(row) { return !isFinished(row) && status(row) !== '进行中'; }

  function parseScoreText(s) {
    if (s === null || s === undefined) return null;
    const txt = compact(s, '', 0).replace('：', ':').replace(/\s/g, '');
    const m = txt.match(/^(\d{1,2})[:\-](\d{1,2})$/);
    return m ? { finalScore: `${Number(m[1])}:${Number(m[2])}`, homeScore: Number(m[1]), awayScore: Number(m[2]) } : null;
  }
  function actualScore(row) {
    const v = read(row, ['data.postMatchResult.actualScore','data.actualScore','data.finalScore','postMatchResult.actualScore','actualScore','finalScore'], null);
    let score = parseScoreText(v);
    if (score) return { ...score, source: sourceName(v, row) };
    const hs = read(row, ['data.homeScore','homeScore'], null), as = read(row, ['data.awayScore','awayScore'], null);
    if (hs !== null && as !== null && hs !== '' && as !== '') return { finalScore: `${Number(hs)}:${Number(as)}`, homeScore: Number(hs), awayScore: Number(as), source: 'homeScore/awayScore' };
    return null;
  }
  function sourceName(v, row) {
    const d = data(row);
    if (d?.postMatchResult?.actualScore === v) return 'postMatchResult.actualScore';
    if (d?.actualScore === v) return 'actualScore';
    if (d?.finalScore === v) return 'finalScore';
    return 'scoreResolver';
  }
  function predictionScores(row) {
    const d = data(row);
    const candidates = [d.predictions, d.predictionScores, d.topScores, d.mainScores, d.modelScores, d.primaryScores, d.scores, d.scoreOptions, d.exactScores, d?.prediction?.scores, d?.model?.scores, row.predictions, row.topScores];
    const out = [];
    const add = (v) => {
      if (Array.isArray(v)) v.forEach(add);
      else {
        const score = parseScoreText(v);
        if (score && !out.includes(score.finalScore)) out.push(score.finalScore);
      }
    };
    candidates.forEach(add);
    return out.slice(0, 5);
  }
  function recommendation(row) { return compact(read(row, ['data.recommendation','data.recommend','data.direction','data.pick','data.resultPick','data.modelPick','data.advice','recommendation','recommend'], '暂无'), '暂无'); }
  function risk(row) { return compact(read(row, ['data.risk','data.riskLevel','data.upsetRisk','data.coldRisk','risk'], '中'), '中'); }
  function confidence(row) {
    const v = compact(read(row, ['data.confidence','data.confidenceScore','data.winConfidence','confidence'], ''), '', 0);
    const n = Number(String(v).replace('%','').trim());
    if (!Number.isFinite(n)) return '';
    return `${Math.round(n > 1 ? n : n * 100)}%`;
  }
  function riskScore(row) {
    const r = risk(row);
    const n = Number(String(r).replace(/[^\d.]/g, ''));
    if (Number.isFinite(n) && n > 0) return n > 1 ? n : n * 100;
    if (/高|爆|冷|danger|high/i.test(r)) return 90;
    if (/中|warn|medium/i.test(r)) return 60;
    if (/低|稳|low/i.test(r)) return 25;
    return 50;
  }
  function confidenceNum(row) { const c = confidence(row); const n = Number(c.replace('%','')); return Number.isFinite(n) ? n : 0; }
  function directionFromScore(s) { return !s ? '' : s.homeScore > s.awayScore ? '主胜' : s.homeScore < s.awayScore ? '客胜' : '平局'; }
  function directionHit(row) {
    const actual = actualScore(row); if (!actual) return null;
    const rec = recommendation(row);
    const dir = directionFromScore(actual);
    if (!rec || rec === '暂无') return null;
    if (dir === '主胜' && /主胜|主队|主不败|主队不败|胜/i.test(rec)) return true;
    if (dir === '客胜' && /客胜|客队|客不败|客队不败/i.test(rec)) return true;
    if (dir === '平局' && /平|不败|保护/i.test(rec)) return true;
    return false;
  }
  function exactHit(row) { const a = actualScore(row); return a ? predictionScores(row).includes(a.finalScore) : false; }
  function modelLine(row) {
    const d = data(row);
    const parts = [];
    const elo = compact(read(row, ['data.eloDiff','data.elo.diff','eloDiff'], ''), '', 0);
    const lh = compact(read(row, ['data.lambdaHome','data.xgHome','data.homeLambda','data.model.lambdaHome'], ''), '', 0);
    const la = compact(read(row, ['data.lambdaAway','data.xgAway','data.awayLambda','data.model.lambdaAway'], ''), '', 0);
    if (elo) parts.push(`Elo差：${elo}`);
    if (lh || la) parts.push(`预期进球：${lh || '?'}:${la || '?'}`);
    const draw = compact(read(row, ['data.drawPressure','data.drawProb','data.probabilities.draw'], ''), '', 0);
    if (draw) parts.push(`平局压力：${draw}`);
    return parts.join(' · ');
  }

  function todayKey() {
    const p = bjParts(new Date());
    return p ? `${p.y}-${p.m}-${p.d}` : 'all';
  }
  function nearestPlayableDateKey(list) {
    const keys = [...new Set(list.map(dateKey).filter(k => k !== 'unknown'))].sort();
    if (!keys.length) return 'unknown';
    const today = todayKey();
    const future = keys.find(k => k >= today);
    return future || keys[keys.length - 1];
  }
  function listForMode() {
    let list = sortByBeijing(state.matches);
    if (state.activeMode === 'today') {
      const k = nearestPlayableDateKey(list);
      list = list.filter(m => dateKey(m) === k);
    }
    if (state.activeMode === 'upcoming') list = list.filter(isUpcoming);
    if (state.activeMode === 'finished') list = list.filter(isFinished);
    if (state.activeMode === 'risk') list = list.filter(m => riskScore(m) >= 70);
    return list;
  }
  function filteredSchedule() {
    let list = listForMode();
    if (state.date !== 'all') list = list.filter(m => dateKey(m) === state.date);
    if (state.status !== 'all') {
      if (state.status === 'finished') list = list.filter(isFinished);
      if (state.status === 'upcoming') list = list.filter(isUpcoming);
      if (state.status === 'live') list = list.filter(m => status(m) === '进行中');
    }
    if (state.group !== 'all') list = list.filter(m => group(m) === state.group);
    const q = state.search.trim().toLowerCase();
    if (q) list = list.filter(m => [team(m,'home'), team(m,'away'), stage(m), group(m), status(m), recommendation(m), risk(m)].join(' ').toLowerCase().includes(q));
    return sortByBeijing(list);
  }

  function renderCard(row, compactCard = false) {
    const st = status(row);
    const scores = predictionScores(row);
    const actual = actualScore(row);
    const conf = confidence(row);
    const rec = recommendation(row);
    const rsk = risk(row);
    const model = modelLine(row);
    return `
      <article class="match-card">
        <div class="match-top">
          <div>${html(stageGroup(row))}<br>${html(timeText(row))}</div>
          <span class="badge ${statusClass(st)}">${html(st)}</span>
        </div>
        <div class="teams">
          <div class="team home">${html(team(row,'home'))}</div>
          <div class="vs">VS</div>
          <div class="team away">${html(team(row,'away'))}</div>
        </div>
        <div class="score-row"><span>预测比分</span>${scores.length ? scores.map(s => `<span class="score-tag">${html(s)}</span>`).join('') : '<span class="score-tag">暂无</span>'}</div>
        <div class="score-row"><span>赛后比分</span>${actual ? `<span class="score-tag actual">${html(actual.finalScore)}</span>` : '<span class="score-tag actual">未同步</span>'}</div>
        <div class="card-meta">
          <div class="meta-box"><span>推荐</span><b>${html(rec)}</b></div>
          <div class="meta-box"><span>风险</span><b>${html(rsk)}</b></div>
          <div class="meta-box"><span>置信度</span><b>${html(conf || '暂无')}</b></div>
        </div>
        <div class="explain">${html(model || '模型解释：方向判断优先，比分仅作为主推/备选/防冷参考。')}</div>
      </article>`;
  }

  function renderSelects() {
    const dates = [...new Set(sortByBeijing(state.matches).map(dateKey))];
    const groups = [...new Set(state.matches.map(group).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'zh-CN'));
    const dateOptions = ['<option value="all">全部日期</option>'].concat(dates.map(k => `<option value="${html(k)}">${html(dateLabelFromKey(k))}</option>`)).join('');
    const groupOptions = ['<option value="all">全部分组</option>'].concat(groups.map(g => `<option value="${html(g)}">${html(g)}</option>`)).join('');
    if (els.dateFilter.innerHTML !== dateOptions) els.dateFilter.innerHTML = dateOptions;
    if (els.groupFilter.innerHTML !== groupOptions) els.groupFilter.innerHTML = groupOptions;
    els.dateFilter.value = dates.includes(state.date) ? state.date : 'all';
    els.groupFilter.value = groups.includes(state.group) ? state.group : 'all';
    els.statusFilter.value = state.status;

    const chips = ['all', ...dates].map(k => `<button class="date-chip ${state.date === k ? 'active' : ''}" type="button" data-date="${html(k)}">${html(k === 'all' ? '全部日期' : dateLabelFromKey(k))}</button>`).join('');
    els.dateStrip.innerHTML = chips || '<div class="empty">暂无日期</div>';
  }

  function renderStatus() {
    const err = state.error ? ` · 错误：${state.error}` : '';
    els.statusBar.textContent = `${VERSION} · 当前 ${state.matches.length} 场 · 来源：${state.source}${state.lastLoadedAt ? ` · 更新时间：${state.lastLoadedAt}` : ''}${err}`;
  }

  function modeLabel() {
    return {
      today: '今日比赛推荐',
      all: '全部赛程',
      upcoming: '未开赛比赛',
      finished: '已完赛比赛',
      risk: '爆冷风险高'
    }[state.activeMode] || '比赛推荐';
  }

  function renderSchedule() {
    renderSelects();
    renderStatus();
    $$('.quick-tab[data-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === state.activeMode));
    els.modeTitle.textContent = modeLabel();
    const base = listForMode();
    const list = filteredSchedule();
    const date = state.activeMode === 'today' && base.length ? dateLabelFromKey(dateKey(base[0])) : '全部日期';
    els.todaySummary.textContent = `${date} · ${base.length} 场 · 北京时间排序`;

    const spotlight = sortByBeijing(base).filter(m => confidenceNum(m) >= 55 || riskScore(m) >= 70).slice(0, 3);
    els.spotlightGrid.innerHTML = spotlight.length ? spotlight.map(m => renderCard(m, true)).join('') : '<div class="empty">当前模式暂无重点比赛。</div>';
    els.scheduleGrid.innerHTML = list.length ? list.map(m => renderCard(m)).join('') : '<div class="empty">没有找到符合筛选条件的比赛。</div>';

    const risky = sortByBeijing(state.matches).filter(m => riskScore(m) >= 70).slice(0, 8);
    els.riskCount.textContent = `${risky.length}场`;
    els.riskList.innerHTML = risky.length ? risky.map(m => rankItem(m, `风险 ${Math.round(riskScore(m))}/100`)).join('') : '<div class="empty">暂无高风险比赛。</div>';
    const confident = sortByBeijing(state.matches).filter(m => confidenceNum(m) >= 60).sort((a,b) => confidenceNum(b) - confidenceNum(a)).slice(0, 8);
    els.confidenceCount.textContent = `${confident.length}场`;
    els.confidenceList.innerHTML = confident.length ? confident.map(m => rankItem(m, `置信度 ${confidence(m)}`)).join('') : '<div class="empty">暂无高置信推荐。</div>';
    renderStats();
  }

  function rankItem(row, right) {
    return `<div class="rank-item"><div><b>${html(team(row,'home'))} vs ${html(team(row,'away'))}</b><small>${html(stageGroup(row))} · ${html(timeText(row))} · 推荐：${html(recommendation(row))}</small></div><span>${html(right)}</span></div>`;
  }

  function renderStats() {
    const total = state.matches.length;
    const finished = state.matches.filter(m => Boolean(actualScore(m)));
    const exact = finished.filter(exactHit).length;
    const dirKnown = finished.filter(m => directionHit(m) !== null);
    const dirHit = dirKnown.filter(directionHit).length;
    const exactRate = finished.length ? Math.round(exact / finished.length * 100) : 0;
    const dirRate = dirKnown.length ? Math.round(dirHit / dirKnown.length * 100) : 0;
    els.metricsGrid.innerHTML = [
      ['总比赛', total], ['已完赛', finished.length], ['比分命中率', `${exactRate}%`], ['方向命中率', `${dirRate}%`]
    ].map(([k,v]) => `<div class="metric"><span>${html(k)}</span><b>${html(v)}</b></div>`).join('');
    els.reviewList.innerHTML = sortByBeijing(finished).slice(0, 12).map(m => {
      const actual = actualScore(m);
      return `<div class="review-row"><b>${html(team(m,'home'))} vs ${html(team(m,'away'))}</b><span>赛后比分：${html(actual.finalScore)}</span><span>比分：${exactHit(m) ? '命中' : '未命中'}</span><span>方向：${directionHit(m) === true ? '命中' : directionHit(m) === false ? '未命中' : '未知'}</span></div>`;
    }).join('') || '<div class="empty">暂无完赛复盘数据。</div>';
  }

  function hasConfig() { return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY); }
  function endpoint() {
    const base = String(CONFIG.SUPABASE_URL || '').replace(/\/$/, '');
    const table = encodeURIComponent(CONFIG.SUPABASE_TABLE || 'matches');
    const limit = Number(CONFIG.FETCH_LIMIT || 500);
    return `${base}/rest/v1/${table}?select=*&order=id.asc&limit=${limit}`;
  }
  function timeoutFetch(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  }
  async function fetchRemote() {
    if (!hasConfig()) throw new Error('未配置 Supabase URL / anon key');
    const res = await timeoutFetch(endpoint(), {
      headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`, Accept: 'application/json' }
    }, Number(CONFIG.REQUEST_TIMEOUT_MS || 10000));
    if (!res.ok) throw new Error(`Supabase 请求失败 ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Supabase 返回格式异常');
    return normalizeRows(rows);
  }
  function saveCache(rows) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); localStorage.setItem(CACHE_TIME_KEY, new Date().toISOString()); } catch (_) {}
  }
  function readCache() {
    try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }
  function timeStamp() {
    const p = bjParts(new Date());
    return p ? `${p.y}/${p.m}/${p.d} ${p.h}:${p.min}` : new Date().toLocaleString('zh-CN');
  }
  async function load(force = false) {
    state.loading = true;
    state.error = null;
    renderStatus();
    try {
      const rows = await fetchRemote();
      state.matches = sortByBeijing(rows);
      state.source = 'Supabase 实时数据';
      state.lastLoadedAt = timeStamp();
      saveCache(state.matches);
    } catch (e) {
      state.error = e?.name === 'AbortError' ? '请求超时，已切换缓存' : (e?.message || '数据请求失败');
      const cached = readCache();
      if (cached && cached.length) { state.matches = normalizeRows(cached); state.source = '本地缓存'; }
      else { state.matches = normalizeRows(demoMatches); state.source = '演示数据'; }
      state.lastLoadedAt = timeStamp();
    } finally {
      state.loading = false;
      renderSchedule();
    }
  }

  function bind() {
    els.refreshBtn.addEventListener('click', () => load(true));
    els.clearCacheBtn.addEventListener('click', () => { try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_TIME_KEY); } catch (_) {} load(true); });
    $$('.quick-tab[data-mode]').forEach(btn => btn.addEventListener('click', () => { state.activeMode = btn.dataset.mode; state.date = 'all'; renderSchedule(); document.getElementById('scheduleSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    els.searchInput.addEventListener('input', (e) => { state.search = e.target.value; renderSchedule(); els.searchInput.focus(); });
    els.dateFilter.addEventListener('change', (e) => { state.date = e.target.value; renderSchedule(); });
    els.statusFilter.addEventListener('change', (e) => { state.status = e.target.value; renderSchedule(); });
    els.groupFilter.addEventListener('change', (e) => { state.group = e.target.value; renderSchedule(); });
    els.dateStrip.addEventListener('click', (e) => { const b = e.target.closest('[data-date]'); if (!b) return; state.date = b.dataset.date; renderSchedule(); });
  }
  document.addEventListener('DOMContentLoaded', () => { bind(); load(false); });
})();

