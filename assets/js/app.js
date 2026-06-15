(() => {
  'use strict';

  const CONFIG = window.FIFA_CONFIG || {};
  const VERSION = CONFIG.VERSION || 'V10.4.2 公测版';
  const CACHE_KEY = 'fifa_world_cup_predictor_v10_4_2_matches_cache';
  const CACHE_TIME_KEY = 'fifa_world_cup_predictor_v10_4_2_matches_cache_time';

  const state = {
    matches: [],
    source: 'init',
    loading: false,
    activeTab: 'home',
    search: '',
    date: 'all',
    status: 'all',
    lastLoadedAt: null,
    error: null,
    dataPromise: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const views = {
    home: $('#homeView'),
    schedule: $('#scheduleView'),
    stats: $('#statsView'),
    backtest: $('#backtestView'),
    data: $('#dataView')
  };

  const statusBar = $('#statusBar');

  const demoMatches = [
    {
      id: 620001,
      data: {
        homeCn: '墨西哥', awayCn: '南非', status: '赛后', stage: '小组赛', group: 'A组', kickoff: '2026-06-11T19:00:00Z',
        predictions: ['1:0', '1:1', '2:1'], recommendation: '主胜或平', risk: '中', confidence: 62,
        postMatchResult: { actualScore: '2:0' }, actualScore: '2:0'
      }
    },
    {
      id: 620002,
      data: {
        homeCn: '韩国', awayCn: '捷克', status: '赛后', stage: '小组赛', group: 'B组', kickoff: '2026-06-12T22:00:00Z',
        topScores: ['1:1', '2:1', '0:0'], recommendation: '平局保护', risk: '高', confidence: 54,
        actualScore: '2:1'
      }
    },
    {
      id: 620021,
      data: {
        homeCn: '美国', awayCn: '澳大利亚', status: '未开赛', stage: '小组赛', group: 'C组', kickoff: '2026-06-18T01:00:00Z',
        modelScores: ['2:1', '1:1', '1:0'], recommendation: '主队不败', risk: '中', confidence: 58
      }
    },
    {
      id: 620025,
      data: {
        homeCn: '德国', awayCn: '巴拉圭', status: '赛后', stage: '小组赛', group: 'D组', kickoff: '2026-06-19T19:00:00Z',
        primaryScores: ['2:0', '2:1', '1:0'], recommendation: '主胜', risk: '低', confidence: 71,
        finalScore: '7:1', homeScore: 7, awayScore: 1, resultSyncStatus: 'synced'
      }
    }
  ];

  function htmlEscape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeScoreString(value) {
    if (value === null || value === undefined) return null;
    const text = String(value)
      .trim()
      .replace(/[：﹕꞉]/g, ':')
      .replace(/[\s\u00a0]+/g, '')
      .replace(/-/g, ':');
    const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;
    return `${Number(match[1])}:${Number(match[2])}`;
  }

  function parseScore(value) {
    const normalized = normalizeScoreString(value);
    if (!normalized) return null;
    const [homeScore, awayScore] = normalized.split(':').map(Number);
    return { finalScore: normalized, homeScore, awayScore };
  }

  function getData(row) {
    const raw = row && typeof row === 'object' ? row : {};
    const data = raw.data && typeof raw.data === 'object' ? raw.data : raw;
    return data || {};
  }

  function read(row, paths, fallback = '') {
    const data = getData(row);
    const sources = [data, row].filter(Boolean);
    for (const source of sources) {
      for (const path of paths) {
        const parts = Array.isArray(path) ? path : String(path).split('.');
        let current = source;
        for (const part of parts) {
          if (current === null || current === undefined) break;
          current = current[part];
        }
        if (current !== null && current !== undefined && String(current).trim() !== '') return current;
      }
    }
    return fallback;
  }

  function teamName(row, side) {
    const cn = side === 'home'
      ? read(row, ['homeCn', 'homeCN', 'home_name_cn', 'homeNameCn', 'homeTeamCn', 'homeTeam.nameCn', 'home.nameCn'])
      : read(row, ['awayCn', 'awayCN', 'away_name_cn', 'awayNameCn', 'awayTeamCn', 'awayTeam.nameCn', 'away.nameCn']);
    const en = side === 'home'
      ? read(row, ['home', 'homeName', 'homeTeam', 'homeTeam.name', 'home.name'], '主队')
      : read(row, ['away', 'awayName', 'awayTeam', 'awayTeam.name', 'away.name'], '客队');
    return String(cn || en || (side === 'home' ? '主队' : '客队'));
  }

  function getMatchId(row) {
    return read(row, ['id', 'matchId', 'fixtureId', 'match_id'], '');
  }

  function getStage(row) {
    const stage = read(row, ['stageCn', 'stage', 'round', 'phase'], '');
    const group = read(row, ['groupCn', 'group', 'groupName'], '');
    return [stage, group].filter(Boolean).join(' · ') || '赛程';
  }

  function getKickoff(row) {
    const raw = read(row, [
      'kickoff', 'kickoffAt', 'kickoff_at', 'date', 'matchDate', 'utcDate', 'time', 'startTime', 'start_at'
    ], '');
    if (!raw) return null;
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;
    return null;
  }

  function formatDateTime(date) {
    if (!date) return '时间待定';
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(date);
    } catch (_) {
      return date.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  function dateKey(row) {
    const date = getKickoff(row);
    if (!date) return 'unknown';
    return date.toISOString().slice(0, 10);
  }

  function sortOrder(row) {
    const order = Number(read(row, ['sortOrder', 'sort_order', 'order', 'matchNo', 'match_no'], NaN));
    if (Number.isFinite(order)) return order;
    const date = getKickoff(row);
    if (date) return date.getTime();
    const id = Number(getMatchId(row));
    return Number.isFinite(id) ? id : 999999999;
  }

  function scoreResolver(row) {
    const data = getData(row);
    const candidates = [
      { key: 'data.postMatchResult.actualScore', value: data?.postMatchResult?.actualScore },
      { key: 'data.actualScore', value: data?.actualScore },
      { key: 'data.finalScore', value: data?.finalScore },
      { key: 'row.postMatchResult.actualScore', value: row?.postMatchResult?.actualScore },
      { key: 'row.actualScore', value: row?.actualScore },
      { key: 'row.finalScore', value: row?.finalScore }
    ];

    for (const candidate of candidates) {
      const parsed = parseScore(candidate.value);
      if (parsed) return { ...parsed, source: candidate.key };
    }

    const home = read(row, ['homeScore', 'home_score', 'score.home', 'result.home'], null);
    const away = read(row, ['awayScore', 'away_score', 'score.away', 'result.away'], null);
    if (home !== null && away !== null && String(home).trim() !== '' && String(away).trim() !== '') {
      const parsed = parseScore(`${home}:${away}`);
      if (parsed) return { ...parsed, source: 'homeScore + awayScore' };
    }

    return null;
  }

  function getRawStatus(row) {
    return String(read(row, ['statusCn', 'status', 'matchStatus', 'state'], '')).trim();
  }

  function isFinished(row) {
    const actual = scoreResolver(row);
    if (actual) return true;
    const status = getRawStatus(row);
    return /赛后|完赛|已结束|finished|fulltime|ft/i.test(status);
  }

  function isLive(row) {
    const status = getRawStatus(row);
    return /直播|进行|live|in_progress|playing/i.test(status);
  }

  function displayStatus(row) {
    if (isFinished(row)) return '赛后';
    if (isLive(row)) return '进行中';
    const status = getRawStatus(row);
    return status || '未开赛';
  }

  function getRisk(row) {
    return String(read(row, ['risk', 'riskLevel', 'upsetRisk', 'risk_score_label'], '中'));
  }

  function getConfidence(row) {
    const value = read(row, ['confidence', 'modelConfidence', 'favoriteProb', 'winConfidence'], '');
    if (value === '') return '';
    const num = Number(value);
    if (Number.isFinite(num)) return num > 1 ? `${Math.round(num)}%` : `${Math.round(num * 100)}%`;
    return String(value);
  }

  function flattenScores(input, output = []) {
    if (input === null || input === undefined) return output;
    if (typeof input === 'string' || typeof input === 'number') {
      const parsed = normalizeScoreString(input);
      if (parsed) output.push(parsed);
      return output;
    }
    if (Array.isArray(input)) {
      input.forEach((item) => flattenScores(item, output));
      return output;
    }
    if (typeof input === 'object') {
      const directKeys = [
        'score', 'finalScore', 'predictedScore', 'actualScore', 'value', 'text', 'label',
        'primary', 'secondary', 'protect', 'main', 'coldScore', 'upsetScore'
      ];
      directKeys.forEach((key) => flattenScores(input[key], output));
      if (input.homeScore !== undefined && input.awayScore !== undefined) {
        flattenScores(`${input.homeScore}:${input.awayScore}`, output);
      }
      if (input.home !== undefined && input.away !== undefined) {
        flattenScores(`${input.home}:${input.away}`, output);
      }
      ['scores', 'topScores', 'mainScores', 'modelScores', 'exactScores', 'scoreOptions', 'predictions'].forEach((key) => flattenScores(input[key], output));
    }
    return output;
  }

  function predictionScores(row) {
    const data = getData(row);
    const candidates = [
      data.predictions,
      data.predictionScores,
      data.predictedScores,
      data.topScores,
      data.mainScores,
      data.modelScores,
      data.primaryScores,
      data.scores,
      data.scoreOptions,
      data.exactScores,
      data.model?.scores,
      data.prediction?.scores,
      data.prediction?.exactScores,
      data.predictedScore,
      data.mainScore,
      data.scoreline,
      row.predictions,
      row.topScores,
      row.modelScores
    ];
    const unique = [];
    candidates.forEach((candidate) => flattenScores(candidate, unique));
    return Array.from(new Set(unique)).slice(0, 5);
  }

  function recommendation(row) {
    return String(read(row, [
      'recommendation', 'recommend', 'direction', 'pick', 'winnerPick', 'modelPick', 'advice', 'resultPick'
    ], '暂无'));
  }

  function resultDirectionFromScore(score) {
    if (!score) return '';
    if (score.homeScore > score.awayScore) return '主胜';
    if (score.homeScore < score.awayScore) return '客胜';
    return '平';
  }

  function directionHit(row) {
    const actual = scoreResolver(row);
    if (!actual) return null;
    const actualDirection = resultDirectionFromScore(actual);
    const rec = recommendation(row);
    if (!actualDirection || !rec || rec === '暂无') return null;
    if (actualDirection === '平') return /平|draw|x/i.test(rec);
    if (actualDirection === '主胜') return /主胜|主队|home|1/i.test(rec) || /主.*不败/.test(rec);
    if (actualDirection === '客胜') return /客胜|客队|away|2/i.test(rec) || /客.*不败/.test(rec);
    return null;
  }

  function exactHit(row) {
    const actual = scoreResolver(row);
    if (!actual) return false;
    return predictionScores(row).includes(actual.finalScore);
  }

  function filteredMatches() {
    const keyword = state.search.trim().toLowerCase();
    return state.matches.filter((row) => {
      if (state.date !== 'all' && dateKey(row) !== state.date) return false;
      if (state.status !== 'all') {
        if (state.status === 'finished' && !isFinished(row)) return false;
        if (state.status === 'upcoming' && isFinished(row)) return false;
        if (state.status === 'live' && !isLive(row)) return false;
      }
      if (!keyword) return true;
      const haystack = [
        teamName(row, 'home'), teamName(row, 'away'), getStage(row), displayStatus(row), recommendation(row), getMatchId(row)
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }

  function computeStats(matches = state.matches) {
    const total = matches.length;
    const finished = matches.filter(isFinished);
    const withActual = matches.filter((row) => Boolean(scoreResolver(row)));
    const exactHits = withActual.filter(exactHit).length;
    const directionCandidates = withActual.map((row) => directionHit(row)).filter((value) => value !== null);
    const directionHits = directionCandidates.filter(Boolean).length;
    return {
      total,
      finished: finished.length,
      withActual: withActual.length,
      exactHits,
      exactHitRate: withActual.length ? exactHits / withActual.length : 0,
      directionCandidates: directionCandidates.length,
      directionHits,
      directionHitRate: directionCandidates.length ? directionHits / directionCandidates.length : 0,
      upcoming: matches.filter((row) => !isFinished(row) && !isLive(row)).length,
      live: matches.filter(isLive).length
    };
  }

  function statusPill(row) {
    const status = displayStatus(row);
    const klass = isFinished(row) ? 'done' : (isLive(row) ? 'live' : '');
    return `<span class="status-pill ${klass}">${htmlEscape(status)}</span>`;
  }

  function riskBadge(row) {
    const risk = getRisk(row);
    const klass = /高|high/i.test(risk) ? 'danger' : (/低|low/i.test(risk) ? 'ok' : 'warn');
    return `<span class="badge ${klass}">风险：${htmlEscape(risk)}</span>`;
  }

  function renderMatchCard(row, compact = false) {
    const actual = scoreResolver(row);
    const scores = predictionScores(row);
    const kickoff = getKickoff(row);
    const confidence = getConfidence(row);
    return `
      <article class="match-card ${compact ? 'compact' : ''}">
        <div class="match-top">
          <div>
            <div class="stage">${htmlEscape(getStage(row))} · #${htmlEscape(getMatchId(row) || '-')}</div>
            <div class="muted">${htmlEscape(formatDateTime(kickoff))}</div>
          </div>
          ${statusPill(row)}
        </div>
        <div class="teams">
          <div class="team-name home">${htmlEscape(teamName(row, 'home'))}</div>
          <div class="vs">VS</div>
          <div class="team-name away">${htmlEscape(teamName(row, 'away'))}</div>
        </div>
        <div class="score-line">
          <span class="muted">预测比分</span>
          ${scores.length ? scores.map((s) => `<span class="score-tag">${htmlEscape(s)}</span>`).join('') : '<span class="muted">暂无</span>'}
        </div>
        <div class="score-line">
          <span class="muted">赛后比分</span>
          ${actual ? `<span class="score-tag actual">${htmlEscape(actual.finalScore)}</span><span class="muted">来源：${htmlEscape(actual.source)}</span>` : '<span class="muted">未同步</span>'}
        </div>
        <div class="badge-line">
          <span class="badge">推荐：${htmlEscape(recommendation(row))}</span>
          ${riskBadge(row)}
          ${confidence ? `<span class="badge">置信度：${htmlEscape(confidence)}</span>` : ''}
          ${actual ? `<span class="badge ${exactHit(row) ? 'ok' : 'warn'}">比分命中：${exactHit(row) ? '是' : '否'}</span>` : ''}
        </div>
      </article>
    `;
  }

  function renderMetrics(stats) {
    return `
      <div class="grid cards-4">
        <div class="metric"><div class="label">总比赛</div><div class="value">${stats.total}</div><div class="note">全部赛程 fallback 展示</div></div>
        <div class="metric"><div class="label">已有赛果</div><div class="value">${stats.withActual}</div><div class="note">兼容 actualScore / finalScore</div></div>
        <div class="metric"><div class="label">比分命中率</div><div class="value">${Math.round(stats.exactHitRate * 100)}%</div><div class="note">${stats.exactHits}/${stats.withActual}</div></div>
        <div class="metric"><div class="label">方向命中率</div><div class="value">${Math.round(stats.directionHitRate * 100)}%</div><div class="note">${stats.directionHits}/${stats.directionCandidates}</div></div>
      </div>
    `;
  }

  function renderHome() {
    const stats = computeStats();
    const upcoming = [...state.matches]
      .sort((a, b) => sortOrder(a) - sortOrder(b))
      .slice(0, 12);
    views.home.innerHTML = `
      <section class="panel">
        <h2>核心概览</h2>
        ${renderMetrics(stats)}
      </section>

      <section class="panel">
        <h2>比赛预测</h2>
        <div class="grid cards-3">
          ${upcoming.length ? upcoming.map((row) => renderMatchCard(row, true)).join('') : '<div class="empty">暂无比赛数据。请检查 Supabase 配置或稍后刷新。</div>'}
        </div>
      </section>

      <section class="panel">
        <h2>V10 数据层状态</h2>
        <p class="muted">该板块已放到首页下方，避免抢占主内容。它只做诊断展示，不做人工编辑。</p>
        ${renderDataDiagnostics(false)}
      </section>
    `;
  }

  function dateOptions() {
    const keys = Array.from(new Set(state.matches.map(dateKey))).sort();
    return keys.map((key) => `<option value="${htmlEscape(key)}">${key === 'unknown' ? '时间待定' : htmlEscape(key)}</option>`).join('');
  }

  function renderSchedule() {
    const rows = filteredMatches().sort((a, b) => sortOrder(a) - sortOrder(b));
    views.schedule.innerHTML = `
      <section class="panel filter-panel">
        <h2>全部赛程</h2>
        <div class="filters">
          <input id="searchInput" class="input" type="search" placeholder="搜索球队、阶段、状态，例如：美国 / 小组赛 / 赛后" value="${htmlEscape(state.search)}" />
          <select id="dateSelect" class="select" aria-label="日期筛选">
            <option value="all">全部日期</option>
            ${dateOptions()}
          </select>
          <select id="statusSelect" class="select" aria-label="状态筛选">
            <option value="all">全部状态</option>
            <option value="upcoming">未开赛</option>
            <option value="live">进行中</option>
            <option value="finished">赛后</option>
          </select>
        </div>
      </section>
      <section class="panel">
        <div class="grid cards-2">
          ${rows.length ? rows.map((row) => renderMatchCard(row, false)).join('') : '<div class="empty">没有匹配的赛程。换一个关键词或日期。</div>'}
        </div>
      </section>
    `;
    $('#dateSelect').value = state.date;
    $('#statusSelect').value = state.status;
    $('#searchInput').addEventListener('input', (event) => {
      state.search = event.target.value;
      renderSchedule();
    });
    $('#dateSelect').addEventListener('change', (event) => {
      state.date = event.target.value;
      renderSchedule();
    });
    $('#statusSelect').addEventListener('change', (event) => {
      state.status = event.target.value;
      renderSchedule();
    });
  }

  function renderStats() {
    const stats = computeStats();
    views.stats.innerHTML = `
      <section class="panel">
        <h2>赛后命中统计</h2>
        <p class="muted">统计使用统一 scoreResolver：postMatchResult.actualScore → actualScore → finalScore → homeScore/awayScore。</p>
        ${renderMetrics(stats)}
      </section>
      <section class="panel">
        <h2>统计说明</h2>
        <div class="data-diagnostics">
          <div class="code-note">actualScore = scoreResolver(match)</div>
          <div class="code-note">predictionScores = predictions / topScores / modelScores / primaryScores / scoreOptions</div>
          <div class="code-note">比分命中 = 赛后比分出现在预测比分组内</div>
          <div class="code-note">方向命中 = 推荐方向与赛果胜平负一致，字段不足时不纳入分母</div>
        </div>
      </section>
    `;
  }

  function renderBacktest() {
    const played = state.matches.filter((row) => Boolean(scoreResolver(row))).sort((a, b) => sortOrder(a) - sortOrder(b));
    const rowsHtml = played.map((row) => {
      const actual = scoreResolver(row);
      const scores = predictionScores(row);
      const dHit = directionHit(row);
      return `
        <tr>
          <td>#${htmlEscape(getMatchId(row) || '-')}</td>
          <td>${htmlEscape(teamName(row, 'home'))} vs ${htmlEscape(teamName(row, 'away'))}</td>
          <td>${htmlEscape(actual?.finalScore || '-')}</td>
          <td>${scores.length ? scores.map(htmlEscape).join(' / ') : '-'}</td>
          <td class="${exactHit(row) ? 'ok-text' : 'warn-text'}">${exactHit(row) ? '命中' : '未中'}</td>
          <td>${dHit === null ? '<span class="muted">字段不足</span>' : (dHit ? '<span class="ok-text">命中</span>' : '<span class="warn-text">未中</span>')}</td>
          <td>${htmlEscape(recommendation(row))}</td>
        </tr>
      `;
    }).join('');

    views.backtest.innerHTML = `
      <section class="panel">
        <h2>历史回测</h2>
        <p class="muted">只展示已有赛后比分的比赛。没有赛后比分的比赛不会参与命中率计算。</p>
        <div class="table-shell">
          <table>
            <thead>
              <tr><th>ID</th><th>比赛</th><th>赛后比分</th><th>预测比分</th><th>比分命中</th><th>方向命中</th><th>推荐方向</th></tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="7" class="empty">暂无可回测比赛。</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function countWhere(predicate) {
    return state.matches.filter(predicate).length;
  }

  function renderDataDiagnostics(full = true) {
    const total = state.matches.length;
    const hasPostMatch = countWhere((row) => Boolean(parseScore(getData(row)?.postMatchResult?.actualScore)));
    const hasActual = countWhere((row) => Boolean(parseScore(getData(row)?.actualScore)));
    const hasFinal = countWhere((row) => Boolean(parseScore(getData(row)?.finalScore)));
    const hasHomeAway = countWhere((row) => {
      const home = read(row, ['homeScore', 'home_score'], '');
      const away = read(row, ['awayScore', 'away_score'], '');
      return home !== '' && away !== '';
    });
    const resolverCount = countWhere((row) => Boolean(scoreResolver(row)));
    const hasSyncStatus = countWhere((row) => Boolean(read(row, ['resultSyncStatus', 'result_sync_status'], '')));
    const hasUpdatedAt = countWhere((row) => Boolean(read(row, ['updatedAt', 'updated_at', 'lastUpdated', 'last_updated'], '')));
    const missingNewFieldsButResolvable = countWhere((row) => Boolean(scoreResolver(row)) && !parseScore(getData(row)?.finalScore));

    const summary = `
      <div class="grid cards-4">
        <div class="metric"><div class="label">总记录</div><div class="value">${total}</div><div class="note">matches 表读取数</div></div>
        <div class="metric"><div class="label">可解析赛果</div><div class="value">${resolverCount}</div><div class="note">scoreResolver 结果</div></div>
        <div class="metric"><div class="label">finalScore</div><div class="value">${hasFinal}</div><div class="note">V10 新字段</div></div>
        <div class="metric"><div class="label">字段需回填</div><div class="value">${missingNewFieldsButResolvable}</div><div class="note">有旧赛果但缺 finalScore</div></div>
      </div>
      <div class="data-diagnostics" style="margin-top:14px">
        <div class="code-note">postMatchResult.actualScore：${hasPostMatch}/${total}</div>
        <div class="code-note">actualScore：${hasActual}/${total}</div>
        <div class="code-note">homeScore + awayScore：${hasHomeAway}/${total}</div>
        <div class="code-note">resultSyncStatus：${hasSyncStatus}/${total}</div>
        <div class="code-note">updatedAt / lastUpdated：${hasUpdatedAt}/${total}</div>
        <div class="code-note">数据来源：${htmlEscape(state.source)}；最后加载：${state.lastLoadedAt ? htmlEscape(state.lastLoadedAt.toLocaleString('zh-CN')) : '-'}</div>
      </div>
    `;

    if (!full) return summary;

    return `
      ${summary}
      <section class="panel" style="margin-top:18px">
        <h3>字段读取优先级</h3>
        <div class="code-note">data.postMatchResult.actualScore → data.actualScore → data.finalScore → data.homeScore + ':' + data.awayScore</div>
      </section>
    `;
  }

  function renderDataView() {
    views.data.innerHTML = `
      <section class="panel">
        <h2>V10 数据层状态</h2>
        <p class="muted">该页面只读诊断，不写入 Supabase，不做人工编辑预测。</p>
        ${renderDataDiagnostics(true)}
      </section>
    `;
  }

  function renderAll() {
    renderHome();
    renderSchedule();
    renderStats();
    renderBacktest();
    renderDataView();
    updateStatusBar();
  }

  function updateStatusBar() {
    const count = state.matches.length;
    const sourceText = state.source === 'remote' ? 'Supabase 实时数据' : (state.source === 'cache' ? '本地缓存' : (state.source === 'demo' ? '演示数据' : state.source));
    const time = state.lastLoadedAt ? state.lastLoadedAt.toLocaleString('zh-CN') : '-';
    const errorText = state.error ? `；错误：${state.error}` : '';
    statusBar.textContent = `${VERSION} · 当前 ${count} 场 · 来源：${sourceText} · 更新时间：${time}${errorText}`;
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    $$('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    Object.entries(views).forEach(([key, el]) => el.classList.toggle('active', key === tab));
  }

  function getCachedMatches() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function setCachedMatches(matches) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(matches));
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    } catch (_) {
      // localStorage may be full or disabled. Ignore silently.
    }
  }

  function isConfigured() {
    return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
  }

  function buildSupabaseUrl() {
    const base = String(CONFIG.SUPABASE_URL || '').replace(/\/$/, '');
    const table = encodeURIComponent(CONFIG.SUPABASE_TABLE || 'matches');
    const limit = Number(CONFIG.FETCH_LIMIT || 500);
    return `${base}/rest/v1/${table}?select=*&order=id.asc&limit=${limit}`;
  }

  async function fetchRemoteMatches() {
    if (!isConfigured()) throw new Error('未配置 Supabase URL / anon key');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS || 4000);
    try {
      const response = await fetch(buildSupabaseUrl(), {
        method: 'GET',
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
      const json = await response.json();
      if (!Array.isArray(json)) throw new Error('Supabase 返回格式不是数组');
      return json;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function applyMatches(matches, source) {
    state.matches = [...matches].sort((a, b) => sortOrder(a) - sortOrder(b));
    state.source = source;
    state.lastLoadedAt = new Date();
    state.error = null;
    renderAll();
  }

  async function loadMatches({ force = false } = {}) {
    if (state.loading && state.dataPromise) return state.dataPromise;
    state.loading = true;

    const cached = getCachedMatches();
    if (!force && cached && cached.length) {
      applyMatches(cached, 'cache');
    }

    state.dataPromise = (async () => {
      try {
        const remote = await fetchRemoteMatches();
        applyMatches(remote, 'remote');
        setCachedMatches(remote);
      } catch (error) {
        const message = error.name === 'AbortError' ? '请求超时，已切换缓存' : error.message;
        state.error = message;
        const fallbackCache = cached || getCachedMatches();
        if (fallbackCache && fallbackCache.length) {
          applyMatches(fallbackCache, 'cache');
          state.error = message;
          updateStatusBar();
        } else if (CONFIG.USE_DEMO_WHEN_NOT_CONFIGURED) {
          applyMatches(demoMatches, 'demo');
          state.error = message;
          updateStatusBar();
        } else {
          state.matches = [];
          state.source = 'empty';
          state.lastLoadedAt = new Date();
          renderAll();
          state.error = message;
          updateStatusBar();
        }
      } finally {
        state.loading = false;
        state.dataPromise = null;
      }
    })();

    return state.dataPromise;
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    state.error = '本地缓存已清理';
    updateStatusBar();
  }

  function bindEvents() {
    $$('.tab').forEach((button) => {
      button.addEventListener('click', () => setActiveTab(button.dataset.tab));
    });
    $('#refreshBtn').addEventListener('click', () => loadMatches({ force: true }));
    $('#clearCacheBtn').addEventListener('click', clearCache);
  }

  function boot() {
    document.title = CONFIG.TITLE || '2026FIFA世界杯预测';
    bindEvents();
    renderAll();
    loadMatches();
    const refreshMs = Number(CONFIG.AUTO_REFRESH_MS || 0);
    if (refreshMs > 0) {
      window.setInterval(() => loadMatches({ force: true }), refreshMs);
    }
  }

  boot();
})();
