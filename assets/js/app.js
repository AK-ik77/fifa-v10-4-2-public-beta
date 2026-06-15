(() => {
  'use strict';

  const CONFIG = window.FIFA_CONFIG || {};
  const VERSION = CONFIG.VERSION || 'V10.4.2 公测版';
  const CACHE_KEY = 'fifa_world_cup_predictor_v10_4_2_stable_today_beijing_cache_v2';
  const CACHE_TIME_KEY = 'fifa_world_cup_predictor_v10_4_2_stable_today_beijing_cache_time_v2';

  const state = {
    matches: [],
    source: 'init',
    loading: false,
    activeTab: 'today',
    search: '',
    date: 'all',
    status: 'all',
    group: 'all',
    lastLoadedAt: null,
    error: null,
    dataPromise: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const views = {
    today: $('#todayView'),
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
        homeCn: '墨西哥', awayCn: '南非', status: '完赛', stage: '小组赛', group: 'A组', kickoff: '2026-06-11T19:00:00Z',
        predictions: ['1:0', '1:1', '2:1'], recommendation: '主胜或平', risk: '中', confidence: 62,
        postMatchResult: { actualScore: '2:0' }, actualScore: '2:0'
      }
    },
    {
      id: 620002,
      data: {
        homeCn: '韩国', awayCn: '捷克', status: '完赛', stage: '小组赛', group: 'B组', kickoff: '2026-06-12T22:00:00Z',
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
        homeCn: '德国', awayCn: '巴拉圭', status: '完赛', stage: '小组赛', group: 'D组', kickoff: '2026-06-19T19:00:00Z',
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

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function scalarText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value.trim() || fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
    if (typeof value === 'boolean') return value ? '是' : '否';
    return fallback;
  }

  function compactText(value, fallback = '暂无', depth = 0) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return scalarText(value, fallback);
    }
    if (Array.isArray(value)) {
      const parts = value.map((item) => compactText(item, '', depth + 1)).filter(Boolean);
      return parts.length ? Array.from(new Set(parts)).join(' / ') : fallback;
    }
    if (isPlainObject(value)) {
      const priorityKeys = [
        'text', 'label', 'name', 'title', 'summary', 'display', 'zh', 'cn', 'value',
        'direction', 'pick', 'resultPick', 'winnerPick', 'modelPick', 'recommend', 'recommendation',
        'advice', 'suggestion', 'primary', 'main', 'choice', 'result', 'level', 'risk', 'riskLevel'
      ];
      const parts = [];
      priorityKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const part = compactText(value[key], '', depth + 1);
          if (part && !/^\[object Object\]$/i.test(part)) parts.push(part);
        }
      });
      if (!parts.length && depth < 2) {
        Object.entries(value).forEach(([key, val]) => {
          if (['id', 'key', 'code', 'raw', 'data'].includes(key)) return;
          const part = compactText(val, '', depth + 1);
          if (part && !/^\[object Object\]$/i.test(part)) parts.push(part);
        });
      }
      return parts.length ? Array.from(new Set(parts)).slice(0, 4).join(' / ') : fallback;
    }
    return fallback;
  }

  function firstReadable(row, paths, fallback = '') {
    const value = read(row, paths, null);
    const text = compactText(value, '', 0);
    return text || fallback;
  }

  function percentText(value) {
    if (value === null || value === undefined || value === '') return '';
    const text = compactText(value, '', 0);
    if (!text) return '';
    const numeric = Number(String(text).replace('%', '').trim());
    if (Number.isFinite(numeric)) {
      const pct = numeric > 1 ? numeric : numeric * 100;
      return `${Math.round(pct)}%`;
    }
    return text;
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
    const stage = stripMatchCode(read(row, ['stageCn', 'stage', 'round', 'phase', 'roundName'], ''));
    const group = stripMatchCode(read(row, ['groupCn', 'group', 'groupName', 'pool'], ''));
    return [stage, group].filter(Boolean).join(' · ') || '赛程';
  }

  function groupKey(row) {
    const group = stripMatchCode(read(row, ['groupCn', 'group', 'groupName', 'pool'], '')).trim();
    return group || '未分组';
  }

  function stripMatchCode(text) {
    return compactText(text, '')
      .replace(/\s*[·｜|\-–—]*\s*#?\d{5,}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function beijingParts(date) {
    if (!date || Number.isNaN(date.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});
      return parts;
    } catch (_) {
      const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      return {
        year: String(shifted.getUTCFullYear()),
        month: String(shifted.getUTCMonth() + 1).padStart(2, '0'),
        day: String(shifted.getUTCDate()).padStart(2, '0'),
        hour: String(shifted.getUTCHours()).padStart(2, '0'),
        minute: String(shifted.getUTCMinutes()).padStart(2, '0')
      };
    }
  }

  function beijingDateKey(date) {
    const parts = beijingParts(date);
    return parts ? `${parts.year}-${parts.month}-${parts.day}` : 'unknown';
  }

  function parseDateWithOffset(text) {
    const m = String(text).match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
    if (!m) return null;
    const sign = m[7] === '-' ? -1 : 1;
    const offsetMinutes = sign * (Number(m[8]) * 60 + Number(m[9] || 0));
    const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)) - offsetMinutes * 60000;
    const date = new Date(utcMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function pickDateValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) return value;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const picked = pickDateValue(item);
        if (picked) return picked;
      }
      return '';
    }
    if (isPlainObject(value)) {
      const keys = ['beijingTime', 'beijingDateTime', 'beijingDatetime', 'beijing', 'bjTime', 'bj_time', 'bjt', 'iso', 'utc', 'utcTime', 'utcDate', 'localTime', 'datetime', 'dateTime', 'date', 'time', 'kickoff', 'startTime', 'displayTime', 'timeText', 'matchTimeText', 'value', 'text'];
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const picked = pickDateValue(value[key]);
          if (picked) return picked;
        }
      }
    }
    return '';
  }

  function parseDateValue(value) {
    const picked = pickDateValue(value);
    if (!picked) return null;
    if (picked instanceof Date && !Number.isNaN(picked.getTime())) return picked;
    if (typeof picked === 'number') {
      const ms = picked < 10000000000 ? picked * 1000 : picked;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    let text = String(picked).trim();
    if (!text || /^时间待定|tbd|待定|unknown$/i.test(text)) return null;

    // 优先读取字符串中的“北京时间：YYYY-MM-DD HH:mm”。这种字段应按 UTC+8 解释，避免手机/PC 时区差异。
    const bj = text.match(/(?:北京时间|北京|BJT|China\s*Time)\s*[:：]?\s*(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
    if (bj) {
      const utcMs = Date.UTC(Number(bj[1]), Number(bj[2]) - 1, Number(bj[3]), Number(bj[4]) - 8, Number(bj[5]), Number(bj[6] || 0));
      const date = new Date(utcMs);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const offsetDate = parseDateWithOffset(text);
    if (offsetDate) return offsetDate;

    text = text
      .replace(/[年/]/g, '-')
      .replace(/[月]/g, '-')
      .replace(/[日]/g, '')
      .replace(/\s+UTC\s*([+-])\s*(\d{1,2})(?!:)/i, ' GMT$1$2:00')
      .replace(/\s+UTC\s*([+-])\s*(\d{1,2}):(\d{2})/i, ' GMT$1$2:$3');
    let date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date;

    const ymd = text.match(/(20\d{2})[-.](\d{1,2})[-.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (ymd) {
      // 无时区字符串默认按北京时间解释。
      const utcMs = Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), Number(ymd[4] || 0) - 8, Number(ymd[5] || 0));
      date = new Date(utcMs);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const md = text.match(/(\d{1,2})[-/月](\d{1,2})(?:日)?(?:\s*(\d{1,2}):(\d{2}))?/);
    if (md) {
      const utcMs = Date.UTC(2026, Number(md[1]) - 1, Number(md[2]), Number(md[3] || 0) - 8, Number(md[4] || 0));
      date = new Date(utcMs);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  function collectDateCandidates(value, out = [], depth = 0, path = '') {
    if (value === null || value === undefined || depth > 6) return out;
    const lowerPath = String(path).toLowerCase();
    const pathLooksLikeTime = /beijing|bj|bjt|utc|time|date|kickoff|start|fixture|schedule|match/.test(lowerPath);
    if (value instanceof Date || typeof value === 'number') {
      out.push({ value, score: pathLooksLikeTime ? 40 : 5 });
      return out;
    }
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return out;
      const hasDate = /(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}|\d{1,2}[/-]\d{1,2}|\d{1,2}月\d{1,2})/.test(text);
      const hasTime = /\d{1,2}:\d{2}/.test(text);
      const hasTimeWord = /北京时间|北京|BJT|UTC|GMT|当地时间|local|kickoff|开球|比赛时间/i.test(text);
      if ((hasDate && hasTime) || (hasDate && pathLooksLikeTime) || hasTimeWord) {
        let score = 0;
        if (/北京时间|北京|BJT/i.test(text) || /beijing|bj|bjt/.test(lowerPath)) score += 100;
        if (/UTC|GMT|utc/.test(text) || /utc/.test(lowerPath)) score += 70;
        if (/local|当地时间|localtime/.test(text + lowerPath)) score += 45;
        if (pathLooksLikeTime) score += 30;
        if (hasDate && hasTime) score += 20;
        out.push({ value: text, score });
      }
      return out;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectDateCandidates(item, out, depth + 1, `${path}.${index}`));
      return out;
    }
    if (isPlainObject(value)) {
      const entries = Object.entries(value);
      entries.sort(([a], [b]) => {
        const sa = /beijing|bj|bjt/.test(String(a).toLowerCase()) ? -3 : (/utc|time|date|kickoff|start/.test(String(a).toLowerCase()) ? -2 : 0);
        const sb = /beijing|bj|bjt/.test(String(b).toLowerCase()) ? -3 : (/utc|time|date|kickoff|start/.test(String(b).toLowerCase()) ? -2 : 0);
        return sa - sb;
      });
      entries.forEach(([key, val]) => collectDateCandidates(val, out, depth + 1, path ? `${path}.${key}` : key));
    }
    return out;
  }

  function getKickoff(row) {
    const priorityPaths = [
      'beijingTime', 'beijing_time', 'beijingDateTime', 'beijing_datetime', 'kickoffBeijing', 'kickoff_beijing', 'bjTime', 'bj_time', 'bjt',
      'kickoff', 'kickoffAt', 'kickoff_at', 'startTime', 'start_time', 'startAt', 'start_at',
      'matchTime', 'match_time', 'matchDate', 'match_date', 'date', 'datetime', 'dateTime',
      'utcDate', 'utc_date', 'utcTime', 'utc_time', 'localTime', 'local_time', 'time', 'timeText', 'matchTimeText', 'displayTime',
      'fixture.date', 'fixture.timestamp', 'fixture.kickoff', 'fixture.time',
      'schedule.kickoff', 'schedule.date', 'schedule.time', 'schedule.beijingTime', 'eventDate', 'event_time'
    ];
    for (const path of priorityPaths) {
      const raw = read(row, [path], '');
      const parsed = parseDateValue(raw);
      if (parsed) return parsed;
    }

    const scanned = collectDateCandidates(row).sort((a, b) => b.score - a.score);
    for (const item of scanned) {
      const parsed = parseDateValue(item.value);
      if (parsed) return parsed;
    }
    return null;
  }

  function localDateKey(date) {
    if (!date) return 'unknown';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dateLabel(key) {
    if (key === 'unknown') return '时间待定';
    const m = String(key).match(/^(20\d{2})-(\d{2})-(\d{2})$/);
    if (!m) return key;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0));
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getUTCDay()];
    return `${m[2]}/${m[3]} ${week}`;
  }

  function formatDateTime(date) {
    if (!date) return '时间待定';
    const parts = beijingParts(date);
    if (!parts) return '时间待定';
    return `北京时间 ${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
  }

  function dateKey(row) {
    const date = getKickoff(row);
    if (!date) return 'unknown';
    return beijingDateKey(date);
  }

  function sortOrder(row) {
    const date = getKickoff(row);
    if (date) return date.getTime();
    const order = Number(read(row, ['sortOrder', 'sort_order', 'order', 'matchNo', 'match_no'], NaN));
    if (Number.isFinite(order)) return 9000000000000 + order;
    const id = Number(getMatchId(row));
    return Number.isFinite(id) ? 9000000000000 + id : 9999999999999;
  }

  function sortByBeijing(rows) {
    return [...rows].sort((a, b) => sortOrder(a) - sortOrder(b));
  }

  function todayKeyBeijing() {
    return beijingDateKey(new Date());
  }

  function todayMatches() {
    const key = todayKeyBeijing();
    return sortByBeijing(state.matches.filter((row) => dateKey(row) === key));
  }

  function nearestFutureDateKey() {
    const now = Date.now();
    const candidates = sortByBeijing(state.matches.filter((row) => {
      const kickoff = getKickoff(row);
      return kickoff && kickoff.getTime() >= now;
    }));
    return candidates.length ? dateKey(candidates[0]) : null;
  }

  function matchesForTodayOrNearest() {
    const todayRows = todayMatches();
    if (todayRows.length) return { rows: todayRows, label: '今日比赛', actualToday: true, key: todayKeyBeijing() };
    const nearestKey = nearestFutureDateKey();
    if (nearestKey) {
      return { rows: sortByBeijing(state.matches.filter((row) => dateKey(row) === nearestKey)), label: `${dateLabel(nearestKey)} 比赛`, actualToday: false, key: nearestKey };
    }
    return { rows: [], label: '今日比赛', actualToday: true, key: todayKeyBeijing() };
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
    return /赛后|完赛|已结束|结束|finished|fulltime|full_time|ft/i.test(status);
  }

  function isLive(row) {
    const status = getRawStatus(row);
    return /直播|进行|live|in_progress|playing/i.test(status);
  }

  function displayStatus(row) {
    if (isFinished(row)) return '完赛';
    if (isLive(row)) return '进行中';
    const status = getRawStatus(row);
    return status || '未开赛';
  }

  function getRisk(row) {
    const raw = read(row, ['risk', 'riskLevel', 'upsetRisk', 'risk_score_label', 'riskScoreLabel', 'modelRisk'], '中');
    if (typeof raw === 'number') {
      if (raw >= 67) return '高';
      if (raw <= 33) return '低';
      return '中';
    }
    const text = compactText(raw, '中');
    const numeric = Number(String(text).replace(/[^0-9.]/g, ''));
    if (/高|high|danger/i.test(text)) return text;
    if (/低|low|safe/i.test(text)) return text;
    if (Number.isFinite(numeric) && numeric > 0) {
      if (numeric >= 67) return `高 ${Math.round(numeric)}/100`;
      if (numeric <= 33) return `低 ${Math.round(numeric)}/100`;
      return `中 ${Math.round(numeric)}/100`;
    }
    return text || '中';
  }

  function getConfidence(row) {
    const value = read(row, ['confidence', 'confidenceScore', 'modelConfidence', 'favoriteProb', 'winConfidence', 'confidenceText', 'model.confidence', 'prediction.confidence'], '');
    return percentText(value);
  }

  function confidenceNumber(row) {
    const text = getConfidence(row);
    const numeric = Number(String(text).replace('%', '').trim());
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function riskNumber(row) {
    const text = getRisk(row);
    if (/高|danger|high/i.test(text)) return 90;
    if (/低|safe|low/i.test(text)) return 20;
    const numeric = Number(String(text).replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? numeric : 50;
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
    const text = firstReadable(row, [
      'recommendation', 'recommend', 'direction', 'pick', 'winnerPick', 'modelPick', 'advice',
      'resultPick', 'prediction.recommendation', 'model.recommendation', 'summary.recommendation'
    ], '暂无');
    return /^\[object Object\]$/i.test(text) ? '暂无' : text;
  }

  function probabilitySummary(row) {
    const home = percentText(read(row, ['homeWinProb', 'homeProb', 'probHome', 'probabilities.home', 'probabilities.homeWin', 'winProb.home', 'resultProb.home'], ''));
    const draw = percentText(read(row, ['drawProb', 'probDraw', 'probabilities.draw', 'winProb.draw', 'resultProb.draw'], ''));
    const away = percentText(read(row, ['awayWinProb', 'awayProb', 'probAway', 'probabilities.away', 'probabilities.awayWin', 'winProb.away', 'resultProb.away'], ''));
    const parts = [];
    if (home) parts.push(`主胜 ${home}`);
    if (draw) parts.push(`平局 ${draw}`);
    if (away) parts.push(`客胜 ${away}`);
    return parts.join(' / ');
  }

  function modelSummary(row) {
    const parts = [];
    const elo = compactText(read(row, ['eloDiff', 'elo_diff', 'elo.delta', 'model.eloDiff'], ''), '');
    const lambdaHome = compactText(read(row, ['lambdaHome', 'lambda_home', 'xgHome', 'expectedGoals.home', 'model.lambdaHome'], ''), '');
    const lambdaAway = compactText(read(row, ['lambdaAway', 'lambda_away', 'xgAway', 'expectedGoals.away', 'model.lambdaAway'], ''), '');
    const lowScore = percentText(read(row, ['lowScoreVolatility', 'low_score_volatility', 'under25Prob', 'under2_5', 'model.lowScoreVolatility'], ''));
    const drawPressure = percentText(read(row, ['drawPressure', 'draw_pressure', 'model.drawPressure'], ''));
    const underdog = percentText(read(row, ['underdogProb', 'underdog_prob', 'model.underdogProb'], ''));
    if (elo) parts.push(`Elo差 ${elo}`);
    if (lambdaHome || lambdaAway) parts.push(`λ ${lambdaHome || '-'} / ${lambdaAway || '-'}`);
    if (drawPressure) parts.push(`平局压力 ${drawPressure}`);
    if (underdog) parts.push(`弱势方 ${underdog}`);
    if (lowScore) parts.push(`小比分 ${lowScore}`);
    return parts.join(' · ');
  }

  function learningSummary(row) {
    return firstReadable(row, [
      'learningInsight', 'learningInsights', 'learning', 'v10Learning', 'v104Learning',
      'selfLearning', 'modelLearning', 'sampleLearning', 'analysis.learningInsight'
    ], '');
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
    const text = String(rec).toLowerCase();
    const homeNoLose = /主队?不败|主不败|主胜或平|主平|1x|home\s*or\s*draw/.test(text);
    const awayNoLose = /客队?不败|客不败|客胜或平|客平|x2|away\s*or\s*draw/.test(text);
    if (actualDirection === '平') return /平|draw|x/.test(text) || homeNoLose || awayNoLose;
    if (actualDirection === '主胜') return /主胜|主推主|home|1/.test(text) || homeNoLose;
    if (actualDirection === '客胜') return /客胜|客推客|away|2/.test(text) || awayNoLose;
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
      if (state.group !== 'all' && groupKey(row) !== state.group) return false;
      if (!keyword) return true;
      const haystack = [
        teamName(row, 'home'), teamName(row, 'away'), getStage(row), groupKey(row), displayStatus(row),
        recommendation(row), getMatchId(row), formatDateTime(getKickoff(row)), probabilitySummary(row), modelSummary(row)
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
    const probs = probabilitySummary(row);
    const model = modelSummary(row);
    const learning = learningSummary(row);
    return `
      <article class="match-card ${compact ? 'compact' : ''} ${isFinished(row) ? 'finished-card' : ''}">
        <div class="match-top">
          <div>
            <div class="stage">${htmlEscape(getStage(row))}</div>
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
        ${probs ? `<div class="score-line"><span class="muted">胜平负概率</span><span class="badge">${htmlEscape(probs)}</span></div>` : ''}
        ${model ? `<div class="score-line"><span class="muted">模型参数</span><span class="badge">${htmlEscape(model)}</span></div>` : ''}
        ${learning ? `<div class="score-line"><span class="muted">学习解释</span><span class="badge">${htmlEscape(learning)}</span></div>` : ''}
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
        <div class="metric"><div class="label">总比赛</div><div class="value">${stats.total}</div><div class="note">按北京时间排序</div></div>
        <div class="metric"><div class="label">已有赛果</div><div class="value">${stats.withActual}</div><div class="note">兼容 actualScore / finalScore</div></div>
        <div class="metric"><div class="label">比分命中率</div><div class="value">${Math.round(stats.exactHitRate * 100)}%</div><div class="note">${stats.exactHits}/${stats.withActual}</div></div>
        <div class="metric"><div class="label">方向命中率</div><div class="value">${Math.round(stats.directionHitRate * 100)}%</div><div class="note">${stats.directionHits}/${stats.directionCandidates}</div></div>
      </div>
    `;
  }

  function rankMatches(rows) {
    return [...rows].sort((a, b) => {
      const conf = confidenceNumber(b) - confidenceNumber(a);
      if (conf) return conf;
      return sortOrder(a) - sortOrder(b);
    });
  }

  function futureMatches() {
    return sortByBeijing(state.matches.filter((row) => !isFinished(row)));
  }

  function renderMiniSection(title, rows, emptyText, actionHtml = '') {
    const orderedRows = sortByBeijing(rows);
    return `
      <section class="panel section-compact">
        <div class="section-head">
          <h2>${htmlEscape(title)}</h2>
          <div class="section-actions">
            <span class="muted">${orderedRows.length} 场</span>
            ${actionHtml}
          </div>
        </div>
        <div class="grid cards-3">
          ${orderedRows.length ? orderedRows.map((row) => renderMatchCard(row, true)).join('') : `<div class="empty">${htmlEscape(emptyText)}</div>`}
        </div>
      </section>
    `;
  }

  function renderHome() {
    const stats = computeStats();
    const futures = futureMatches();
    const todayPack = matchesForTodayOrNearest();
    const todayRows = todayPack.rows.slice(0, 6);
    const highConfidence = sortByBeijing(rankMatches(futures).filter((row) => confidenceNumber(row) >= 55).slice(0, 6));
    const upsetAlerts = sortByBeijing([...futures].sort((a, b) => riskNumber(b) - riskNumber(a)).filter((row) => riskNumber(row) >= 60).slice(0, 6));
    const mainList = sortByBeijing((todayRows.length ? todayRows : futures).slice(0, 12));
    const todayTitle = todayPack.actualToday ? '今日比赛' : '今日暂无比赛 · 最近赛程';
    const todayNote = todayPack.actualToday ? '按北京时间筛选今日比赛，点击可进入完整今日推荐。' : `${todayPack.label}，今日暂无比赛，已显示最近比赛。`;
    const goTodayButton = '<button class="btn mini" type="button" data-jump-tab="today">查看今日比赛推荐</button>';

    views.home.innerHTML = `
      <section class="panel">
        <h2>核心概览</h2>
        ${renderMetrics(stats)}
      </section>

      <section class="panel today-entry">
        <div class="section-head">
          <div>
            <h2>${htmlEscape(todayTitle)}</h2>
            <p class="muted">${htmlEscape(todayNote)}</p>
          </div>
          ${goTodayButton}
        </div>
        <div class="grid cards-3">
          ${todayRows.length ? todayRows.slice(0, 3).map((row) => renderMatchCard(row, true)).join('') : '<div class="empty">暂无今日比赛。</div>'}
        </div>
      </section>

      ${renderMiniSection('高置信推荐', highConfidence, '暂无达到高置信阈值的比赛。')}
      ${renderMiniSection('爆冷预警', upsetAlerts, '暂无高风险爆冷预警。')}

      <section class="panel">
        <h2>比赛预测</h2>
        <div class="grid cards-3">
          ${mainList.length ? mainList.map((row) => renderMatchCard(row, true)).join('') : '<div class="empty">暂无比赛数据。请检查 Supabase 配置或稍后刷新。</div>'}
        </div>
      </section>

      <section class="panel data-layer-home">
        <h2>V10 数据层状态</h2>
        <p class="muted">该板块仅做诊断展示，不做人工编辑。</p>
        ${renderDataDiagnostics(false)}
      </section>
    `;
  }

  function renderTodayView() {
    const todayPack = matchesForTodayOrNearest();
    const rows = sortByBeijing(todayPack.rows);
    const stats = computeStats(rows);
    const highConfidence = sortByBeijing(rankMatches(rows).slice(0, 6));
    const upsetAlerts = sortByBeijing([...rows].sort((a, b) => riskNumber(b) - riskNumber(a)).filter((row) => riskNumber(row) >= 50));
    const title = todayPack.actualToday ? '今日比赛推荐' : `今日暂无比赛 · ${todayPack.label}`;
    const note = todayPack.actualToday
      ? '按北京时间自动筛选今天的比赛，全部按开赛时间排序。'
      : '当前北京时间今天没有匹配赛程，自动显示最近一个比赛日。';

    views.today.innerHTML = `
      <section class="panel">
        <div class="section-head">
          <div>
            <h2>${htmlEscape(title)}</h2>
            <p class="muted">${htmlEscape(note)}</p>
          </div>
          <button class="btn mini" type="button" data-jump-tab="schedule" data-apply-date="${htmlEscape(todayPack.key)}">去全部赛程查看</button>
        </div>
        ${renderMetrics(stats)}
      </section>

      ${renderMiniSection('今日高置信推荐', highConfidence, '暂无今日高置信推荐。')}
      ${renderMiniSection('今日爆冷/防冷提醒', upsetAlerts, '暂无今日高风险防冷提醒。')}

      <section class="panel">
        <div class="section-head">
          <h2>今日全部比赛</h2>
          <span class="muted">${rows.length} 场 · 北京时间排序</span>
        </div>
        <div class="grid cards-2">
          ${rows.length ? rows.map((row) => renderMatchCard(row, false)).join('') : '<div class="empty">暂无今日比赛。</div>'}
        </div>
      </section>
    `;
  }

  function dateOptions() {
    const keys = Array.from(new Set(state.matches.map(dateKey))).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b);
    });
    return keys.map((key) => `<option value="${htmlEscape(key)}">${htmlEscape(dateLabel(key))}</option>`).join('');
  }

  function groupOptions() {
    const groups = Array.from(new Set(state.matches.map(groupKey))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return groups.map((group) => `<option value="${htmlEscape(group)}">${htmlEscape(group)}</option>`).join('');
  }

  function renderScheduleList() {
    const rows = filteredMatches().sort((a, b) => sortOrder(a) - sortOrder(b));
    const container = $('#scheduleCards');
    if (!container) return;
    container.innerHTML = rows.length
      ? rows.map((row) => renderMatchCard(row, false)).join('')
      : '<div class="empty">没有匹配的赛程。换一个关键词或日期。</div>';
  }

  function renderSchedule() {
    views.schedule.innerHTML = `
      <section class="panel filter-panel">
        <h2>全部赛程</h2>
        <div class="filters filters-4">
          <input id="searchInput" class="input" type="search" placeholder="搜索球队、阶段、状态，例如：美国 / 小组赛 / 完赛" value="${htmlEscape(state.search)}" autocomplete="off" />
          <select id="dateSelect" class="select" aria-label="日期筛选">
            <option value="all">全部日期</option>
            ${dateOptions()}
          </select>
          <select id="statusSelect" class="select" aria-label="状态筛选">
            <option value="all">全部状态</option>
            <option value="upcoming">未开赛</option>
            <option value="live">进行中</option>
            <option value="finished">完赛</option>
          </select>
          <select id="groupSelect" class="select" aria-label="分组筛选">
            <option value="all">全部分组</option>
            ${groupOptions()}
          </select>
        </div>
      </section>
      <section class="panel">
        <div id="scheduleCards" class="grid cards-2"></div>
      </section>
    `;

    const searchInput = $('#searchInput');
    const dateSelect = $('#dateSelect');
    const statusSelect = $('#statusSelect');
    const groupSelect = $('#groupSelect');

    dateSelect.value = state.date;
    statusSelect.value = state.status;
    groupSelect.value = state.group;

    let isComposing = false;

    searchInput.addEventListener('compositionstart', () => {
      isComposing = true;
    });

    searchInput.addEventListener('compositionend', (event) => {
      isComposing = false;
      state.search = event.target.value;
      renderScheduleList();
    });

    searchInput.addEventListener('input', (event) => {
      state.search = event.target.value;
      if (!isComposing) renderScheduleList();
    });

    dateSelect.addEventListener('change', (event) => {
      state.date = event.target.value;
      renderScheduleList();
    });

    statusSelect.addEventListener('change', (event) => {
      state.status = event.target.value;
      renderScheduleList();
    });

    groupSelect.addEventListener('change', (event) => {
      state.group = event.target.value;
      renderScheduleList();
    });

    renderScheduleList();
  }

  function renderStats() {
    const stats = computeStats();
    views.stats.innerHTML = `
      <section class="panel">
        <h2>完赛命中统计</h2>
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
          <td>${htmlEscape(formatDateTime(getKickoff(row)))}</td>
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
              <tr><th>北京时间</th><th>比赛</th><th>赛后比分</th><th>预测比分</th><th>比分命中</th><th>方向命中</th><th>推荐方向</th></tr>
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
    renderTodayView();
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
    Object.entries(views).forEach(([key, el]) => { if (el) el.classList.toggle('active', key === tab); });
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
    const timeout = window.setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS || 10000);
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
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-jump-tab]');
      if (!button) return;
      const targetTab = button.dataset.jumpTab;
      const applyDate = button.dataset.applyDate;
      if (applyDate) state.date = applyDate;
      setActiveTab(targetTab);
      if (targetTab === 'schedule') renderSchedule();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
