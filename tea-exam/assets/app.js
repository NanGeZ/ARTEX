'use strict';

const LEVELS = [
  { id: 'junior', name: '初级', full: '评茶员（初级）', file: 'data/bank-junior.json', tag: '入门' },
  { id: 'intermediate', name: '中级', full: '评茶员（中级）', file: 'data/bank-intermediate.json', tag: '进阶' },
  { id: 'senior', name: '高级', full: '评茶员（高级）', file: 'data/bank-senior.json', tag: '资深' }
];

const TYPE_NAMES = { 1: '单选题', 2: '多选题', 4: '判断题' };
const STORAGE_KEY = 'pcy.bank.v1';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const defaultState = () => ({
  level: 'junior',
  theme: 'light',
  records: {},
  favorites: [],
  flagged: [],
  exams: [],
  lastSession: null
});

let STATE = defaultState();
const BANKS = {};
const loadPending = {};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) STATE = Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { STATE = defaultState(); }
  if (!STATE.records) STATE.records = {};
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE)); } catch (e) {}
}

function levelById(id) { return LEVELS.find((l) => l.id === id) || LEVELS[0]; }

function loadBank(levelId) {
  if (BANKS[levelId]) return Promise.resolve(BANKS[levelId]);
  if (loadPending[levelId]) return loadPending[levelId];
  const lv = levelById(levelId);
  loadPending[levelId] = fetch(lv.file)
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then((data) => {
      const qs = data.topics.map((q) => ({
        id: q.id,
        level: levelId,
        type: q.type,
        typeName: TYPE_NAMES[q.type] || '题目',
        chapter: q.chapter_id,
        stem: q.stem,
        options: q.options || {},
        answer: (q.answer || []).slice(),
        analysis: q.analysis || '',
        accuracy: q.accuracy || ''
      }));
      const chapters = [...new Set(qs.map((q) => q.chapter))].sort((a, b) => a - b);
      BANKS[levelId] = {
        id: levelId,
        name: lv.name,
        full: lv.full,
        total: data.total || qs.length,
        typeStats: data.type_stats || {},
        questions: qs,
        byId: new Map(qs.map((q) => [q.id, q])),
        chapters
      };
      delete loadPending[levelId];
      return BANKS[levelId];
    })
    .catch((err) => {
      delete loadPending[levelId];
      throw err;
    });
  return loadPending[levelId];
}

function getRecord(qid) {
  return STATE.records[qid] || { attempts: 0, correct: 0, wrong: 0, lastRight: null };
}

function recordAnswer(qid, ok) {
  const r = STATE.records[qid] || { attempts: 0, correct: 0, wrong: 0, lastRight: null };
  r.attempts += 1;
  if (ok) r.correct += 1; else r.wrong += 1;
  r.lastRight = ok;
  r.at = Date.now();
  STATE.records[qid] = r;
  saveState();
  return r;
}

function isWrong(qid) {
  const r = STATE.records[qid];
  return !!(r && r.lastRight === false);
}

function wrongIds() { return Object.keys(STATE.records).filter(isWrong).map(Number); }
function doneIds() { return Object.keys(STATE.records).map(Number); }

function toggleInList(listName, qid) {
  const list = STATE[listName];
  const i = list.indexOf(qid);
  if (i >= 0) { list.splice(i, 1); saveState(); return false; }
  list.push(qid); saveState(); return true;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function modal(title, bodyHTML, actions) {
  const m = $('#modal');
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHTML;
  const box = $('#modalActions');
  box.innerHTML = '';
  (actions || [{ label: '知道了', primary: true }]).forEach((a) => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : 'btn-ghost');
    b.textContent = a.label;
    b.onclick = () => { closeModal(); if (a.onClick) a.onClick(); };
    box.appendChild(b);
  });
  m.hidden = false;
}

function closeModal() { $('#modal').hidden = true; }

function applyTheme() {
  document.documentElement.setAttribute('data-theme', STATE.theme);
  const btn = $('#themeBtn');
  btn.innerHTML = STATE.theme === 'dark'
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
}

let SESSION = null;

function newSession(opts) {
  return {
    ids: opts.ids || [],
    idx: 0,
    mode: opts.mode || 'practice',
    picked: [],
    submitted: false,
    scope: opts.scope || 'all',
    chapter: opts.chapter || 'all',
    order: opts.order || 'seq',
    random: !!opts.random,
    showAnalysis: opts.showAnalysis !== false
  };
}

function saveSession() {
  if (!SESSION) { STATE.lastSession = null; saveState(); return; }
  STATE.lastSession = {
    level: STATE.level,
    ids: SESSION.ids,
    idx: SESSION.idx,
    mode: SESSION.mode,
    scope: SESSION.scope,
    chapter: SESSION.chapter,
    order: SESSION.order,
    random: SESSION.random
  };
  saveState();
}

function restoreSession() {
  const ls = STATE.lastSession;
  if (!ls || ls.level !== STATE.level || !ls.ids || !ls.ids.length) return false;
  SESSION = newSession(ls);
  SESSION.idx = clamp(ls.idx || 0, 0, SESSION.ids.length - 1);
  return true;
}

function currentQuestion() {
  if (!SESSION || !SESSION.ids.length) return null;
  return BANKS[STATE.level].byId.get(SESSION.ids[SESSION.idx]) || null;
}

function buildIds(scope, chapter, order, search) {
  const bank = BANKS[STATE.level];
  if (!bank) return [];
  let qs = bank.questions.slice();
  if (chapter && chapter !== 'all') qs = qs.filter((q) => String(q.chapter) === String(chapter));
  if (scope === 'undone') { const d = new Set(doneIds()); qs = qs.filter((q) => !d.has(q.id)); }
  if (scope === 'wrong') { const w = new Set(wrongIds()); qs = qs.filter((q) => w.has(q.id)); }
  if (scope === 'fav') { const f = new Set(STATE.favorites); qs = qs.filter((q) => f.has(q.id)); }
  if (scope === 'single') qs = qs.filter((q) => q.type === 1);
  if (scope === 'multi') qs = qs.filter((q) => q.type === 2);
  if (scope === 'judge') qs = qs.filter((q) => q.type === 4);
  if (search) {
    const s = search.trim().toLowerCase();
    qs = qs.filter((q) =>
      q.stem.toLowerCase().includes(s) ||
      Object.values(q.options).some((v) => String(v).toLowerCase().includes(s))
    );
  }
  if (order === 'random') qs = shuffle(qs);
  return qs.map((q) => q.id);
}

const ROUTES = ['home', 'practice', 'exam', 'wrong', 'fav', 'stats'];
let route = 'home';

function parseHash() {
  const h = (location.hash || '#/home').replace(/^#\/?/, '');
  const r = h.split('/')[0];
  return ROUTES.includes(r) ? r : 'home';
}

function navigate(r) { location.hash = '#/' + r; }

async function render() {
  route = parseHash();
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  $('#nav').classList.remove('open');
  const view = $('#view');
  view.innerHTML = '<div class="skeleton"></div>';
  try {
    await loadBank(STATE.level);
  } catch (e) {
    view.innerHTML = '<div class="empty"><div class="e-icon">⚠️</div><h3>题库加载失败</h3>' +
      '<p>请确认已通过 HTTP 访问本页面（如 cPanel 域名），且 data 目录与文件完整。</p>' +
      '<button class="btn btn-primary" onclick="location.reload()">重新加载</button></div>';
    return;
  }
  const fn = { home: renderHome, practice: renderPractice, exam: renderExam, wrong: renderWrong, fav: renderFav, stats: renderStats }[route];
  fn(view);
  view.classList.remove('fade-in');
  void view.offsetWidth;
  view.classList.add('fade-in');
  window.scrollTo({ top: 0 });
}

function levelProgress(lvId) {
  const bank = BANKS[lvId];
  if (!bank) return { done: 0, total: 0, pct: 0, acc: 0 };
  const ids = bank.questions.map((q) => q.id);
  let done = 0, correct = 0;
  ids.forEach((id) => {
    const r = STATE.records[id];
    if (r && r.attempts > 0) { done += 1; correct += r.correct; }
  });
  const attempts = ids.reduce((s, id) => s + ((STATE.records[id] || {}).attempts || 0), 0);
  return {
    done,
    total: bank.total,
    pct: bank.total ? Math.round((done / bank.total) * 100) : 0,
    acc: attempts ? Math.round((correct / attempts) * 100) : 0
  };
}

function renderHome(view) {
  const bank = BANKS[STATE.level];
  const p = levelProgress(STATE.level);
  const wrongN = wrongIds().filter((id) => bank.byId.has(id)).length;
  const favN = STATE.favorites.filter((id) => bank.byId.has(id)).length;
  const chapters = bank.chapters;
  const chapterChips = chapters.map((c) => {
    const n = bank.questions.filter((q) => q.chapter === c).length;
    return '<button class="chip" data-chapter="' + c + '">章节 ' + c + '<span class="cnt">' + n + '</span></button>';
  }).join('');

  view.innerHTML =
  '<section class="hero">' +
    '<h1>' + esc(bank.full) + ' · 在线刷题</h1>' +
    '<p>单选、多选、判断全题型覆盖，支持章节练习、错题本、收藏夹与全真模拟考试。学习进度自动保存在本机浏览器，随时中断、随时继续。</p>' +
    '<div class="hero-stats">' +
      '<div class="hs"><div class="hs-num">' + bank.total + '<em>题</em></div><div class="hs-label">题库总量</div></div>' +
      '<div class="hs"><div class="hs-num">' + p.done + '<em>题</em></div><div class="hs-label">已练习</div></div>' +
      '<div class="hs"><div class="hs-num">' + p.pct + '<em>%</em></div><div class="hs-label">练习进度</div></div>' +
      '<div class="hs"><div class="hs-num">' + (p.acc || 0) + '<em>%</em></div><div class="hs-label">累计正确率</div></div>' +
      '<div class="hs"><div class="hs-num">' + wrongN + '<em>题</em></div><div class="hs-label">待攻克错题</div></div>' +
    '</div>' +
    '<div class="hero-stats" style="margin-top:22px">' +
      '<button class="btn btn-primary" data-go="practice" style="background:#c9a86a;color:#173d31">继续刷题</button>' +
      '<button class="btn btn-ghost" data-go="exam" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.35);color:#fff">开始模拟考试</button>' +
    '</div>' +
  '</section>' +

  '<div class="section-title"><h2>练习方式</h2><span class="sub">选择一种方式快速开始</span></div>' +
  '<div class="grid grid-3">' +
    modeCard('order', '顺序练习', '按题库原有顺序逐题作答，适合系统过一遍。', '开始顺序练习 →') +
    modeCard('random', '随机抽题', '每次随机抽取题目，避免背顺序、背答案。', '随机抽题 →') +
    modeCard('wrong', '错题专练', '只练最近答错的题目，针对性消灭薄弱点。', wrongN ? '攻克 ' + wrongN + ' 道错题 →' : '当前没有错题 →') +
  '</div>' +

  '<div class="section-title"><h2>快速筛选</h2><span class="sub">按章节或题型直达</span></div>' +
  '<div class="card" style="padding:18px 20px">' +
    '<div class="filter-group"><div class="fg-label">章节</div><div class="chip-row">' + chapterChips + '</div></div>' +
    '<div class="filter-group" style="margin-bottom:0"><div class="fg-label">题型</div><div class="chip-row">' +
      '<button class="chip" data-scope="single">单选题<span class="cnt">' + (bank.typeStats['单选题'] || 0) + '</span></button>' +
      '<button class="chip" data-scope="multi">多选题<span class="cnt">' + (bank.typeStats['多选题'] || 0) + '</span></button>' +
      '<button class="chip" data-scope="judge">判断题<span class="cnt">' + (bank.typeStats['判断题'] || 0) + '</span></button>' +
      '<button class="chip" data-scope="undone">未做题目</button>' +
      '<button class="chip" data-scope="fav">我的收藏<span class="cnt">' + favN + '</span></button>' +
    '</div></div>' +
  '</div>' +

  '<div class="section-title"><h2>等级题库</h2><span class="sub">切换后顶部按钮同步更新</span></div>' +
  '<div class="grid grid-3">' + LEVELS.map(levelCard).join('') + '</div>';

  $$('[data-go]', view).forEach((b) => b.onclick = () => navigate(b.dataset.go));
  $$('[data-level]', view).forEach((b) => b.onclick = () => switchLevel(b.dataset.level));
  $$('[data-chapter]', view).forEach((b) => b.onclick = () => {
    startPractice({ chapter: b.dataset.chapter, scope: 'all', order: 'seq' });
  });
  $$('[data-scope]', view).forEach((b) => b.onclick = () => {
    const s = b.dataset.scope;
    if (s === 'wrong' && !wrongIds().length) { toast('太棒了，当前没有错题'); return; }
    startPractice({ scope: s, chapter: 'all', order: s === 'random' ? 'random' : 'seq' });
  });
  $$('[data-quick]', view).forEach((b) => b.onclick = () => {
    const q = b.dataset.quick;
    if (q === 'wrong' && !wrongIds().filter((id) => bank.byId.has(id)).length) { toast('太棒了，当前没有错题'); return; }
    startPractice({ scope: q === 'wrong' ? 'wrong' : 'all', chapter: 'all', order: q === 'random' ? 'random' : 'seq' });
  });
}

function modeCard(key, title, desc, meta) {
  return '<button class="mode-card" data-quick="' + key + '" style="text-align:left;cursor:pointer;font:inherit;color:inherit">' +
    '<div class="mc-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>' +
    '<h3>' + title + '</h3><p>' + desc + '</p><div class="mc-meta">' + meta + '</div></button>';
}

function levelCard(lv) {
  const p = levelProgress(lv.id);
  const cur = lv.id === STATE.level;
  return '<div class="level-card' + (cur ? ' current' : '') + '">' +
    '<div class="lc-top"><span class="lc-name">' + lv.name + '</span>' +
    '<span class="lc-badge' + (p.pct >= 80 ? ' done' : '') + '">' + (cur ? '当前等级' : lv.tag) + '</span></div>' +
    '<div class="lc-nums"><span><b>' + (BANKS[lv.id] ? BANKS[lv.id].total : '–') + '</b>总题数</span>' +
    '<span><b>' + p.done + '</b>已练习</span><span><b>' + p.pct + '%</b>进度</span></div>' +
    '<div class="progress-track"><div class="progress-fill" style="width:' + p.pct + '%"></div></div>' +
    '<button class="btn ' + (cur ? 'btn-soft' : 'btn-ghost') + ' btn-sm" data-level="' + lv.id + '"' + (cur ? ' disabled' : '') + '>' +
    (cur ? '使用中' : '切换到' + lv.name + '题库') + '</button></div>';
}

function switchLevel(lvId) {
  if (lvId === STATE.level) return;
  STATE.level = lvId;
  SESSION = null;
  saveSession();
  saveState();
  $('#levelSwitch').innerHTML = '';
  buildLevelSwitch();
  toast('已切换到' + levelById(lvId).name + '题库');
  render();
}

function buildLevelSwitch() {
  const box = $('#levelSwitch');
  box.innerHTML = LEVELS.map((l) =>
    '<button type="button" data-lv="' + l.id + '" class="' + (l.id === STATE.level ? 'active' : '') + '">' + l.name + '</button>'
  ).join('');
  $$('button', box).forEach((b) => b.onclick = () => switchLevel(b.dataset.lv));
}

function startPractice(opts) {
  const ids = (opts.ids && opts.ids.length)
    ? opts.ids.slice()
    : buildIds(opts.scope || 'all', opts.chapter || 'all', opts.order || 'seq', opts.search);
  if (!ids.length) { toast('没有符合条件的题目'); return; }
  SESSION = newSession(Object.assign({}, opts, { ids }));
  saveSession();
  if (route !== 'practice') navigate('practice');
  else render();
}

function statsFor(ids) {
  let done = 0, right = 0, wrong = 0;
  ids.forEach((id) => {
    const r = STATE.records[id];
    if (r && r.attempts > 0) {
      done += 1;
      if (r.lastRight === false) wrong += 1; else right += 1;
    }
  });
  return { done, right, wrong, remain: ids.length - done };
}

function renderPractice(view) {
  if (!SESSION || !SESSION.ids.length) {
    if (!restoreSession()) {
      view.innerHTML = emptyBlock('📖', '还没有开始练习', '从首页选择章节、题型或练习方式，也可以直接开始顺序练习。',
        '<button class="btn btn-primary" id="quickStart">开始顺序练习</button>');
      $('#quickStart', view).onclick = () => startPractice({ scope: 'all', chapter: 'all', order: 'seq' });
      return;
    }
  }
  paintPractice(view);
}

function emptyBlock(icon, title, desc, actionHTML) {
  return '<div class="card empty"><div class="e-icon">' + icon + '</div><h3>' + title + '</h3>' +
    '<p>' + desc + '</p>' + (actionHTML || '') + '</div>';
}

function paintPractice(view) {
  view = view || $('#view');
  const bank = BANKS[STATE.level];
  const q = currentQuestion();
  if (!q) { SESSION = null; renderPractice(view); return; }

  const st = statsFor(SESSION.ids);
  const fav = STATE.favorites.includes(q.id);
  const rec = getRecord(q.id);

  view.innerHTML =
  '<div class="toolbar">' +
    '<label>范围</label><select class="select" id="fScope">' +
      opt('all', '全部题目', SESSION.scope) + opt('undone', '未做题目', SESSION.scope) +
      opt('wrong', '错题', SESSION.scope) + opt('fav', '收藏', SESSION.scope) +
      opt('single', '单选题', SESSION.scope) + opt('multi', '多选题', SESSION.scope) + opt('judge', '判断题', SESSION.scope) +
    '</select>' +
    '<label>章节</label><select class="select" id="fChapter">' +
      opt('all', '全部章节', SESSION.chapter) + bank.chapters.map((c) => opt(c, '章节 ' + c, SESSION.chapter)).join('') +
    '</select>' +
    '<label>顺序</label><select class="select" id="fOrder">' +
      opt('seq', '按顺序', SESSION.order) + opt('random', '随机打乱', SESSION.order) +
    '</select>' +
    '<span class="spacer"></span>' +
    '<span style="font-size:13px;color:var(--ink-3)">共 ' + SESSION.ids.length + ' 题</span>' +
    '<button class="btn btn-soft btn-sm" id="btnShuffle">🎲 换一组</button>' +
    '<button class="btn btn-danger btn-sm" id="btnQuit">结束练习</button>' +
  '</div>' +

  '<div class="practice-layout">' +
    '<div class="card q-card" id="qCard"></div>' +
    '<aside class="card side-card">' +
      '<h3>本组进度</h3>' +
      '<div class="side-stat"><span>已作答</span><b>' + st.done + ' / ' + SESSION.ids.length + '</b></div>' +
      '<div class="side-stat"><span>当前答对</span><b style="color:var(--ok)">' + st.right + '</b></div>' +
      '<div class="side-stat"><span>当前答错</span><b style="color:var(--danger)">' + st.wrong + '</b></div>' +
      '<div class="side-stat"><span>本题历史</span><b>' + (rec.attempts ? rec.correct + '对/' + rec.wrong + '错' : '未做过') + '</b></div>' +
      '<div class="progress-track" style="margin-top:14px"><div class="progress-fill" style="width:' + (SESSION.ids.length ? Math.round(st.done / SESSION.ids.length * 100) : 0) + '%"></div></div>' +
      '<h3 style="margin-top:20px">答题卡</h3>' +
      '<div class="pager" id="pager"></div>' +
      '<div class="hint-keys">' +
        '<span><span class="kbd">A–E</span> 选项</span><span><span class="kbd">Enter</span> 确认/下一题</span>' +
        '<span><span class="kbd">← →</span> 翻页</span><span><span class="kbd">F</span> 收藏</span>' +
      '</div>' +
    '</aside>' +
  '</div>';

  paintQuestion();
  paintPager();

  $('#fScope', view).onchange = (e) => startPractice({ scope: e.target.value, chapter: $('#fChapter', view).value, order: $('#fOrder', view).value });
  $('#fChapter', view).onchange = (e) => startPractice({ scope: $('#fScope', view).value, chapter: e.target.value, order: $('#fOrder', view).value });
  $('#fOrder', view).onchange = (e) => startPractice({ scope: $('#fScope', view).value, chapter: $('#fChapter', view).value, order: e.target.value });
  $('#btnShuffle', view).onclick = () => startPractice({ scope: SESSION.scope, chapter: SESSION.chapter, order: 'random' });
  $('#btnQuit', view).onclick = () => {
    modal('结束本次练习？', '<p>进度已自动保存，下次进入练习页可以继续。</p>', [
      { label: '继续练习' },
      { label: '结束并返回首页', danger: true, onClick: () => { SESSION = null; saveSession(); navigate('home'); } }
    ]);
  };
}

function opt(v, label, cur) {
  return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>';
}

function optionKeys(q) {
  const judge = q.type === 4;
  if (judge) return ['对', '错'];
  return Object.keys(q.options).sort();
}

function isPicked(key) { return SESSION.picked.includes(key); }

function sameSet(a, b) {
  const x = a.slice().sort().join(',');
  const y = b.slice().sort().join(',');
  return x === y;
}

function paintQuestion() {
  const card = $('#qCard');
  if (!card) return;
  const q = currentQuestion();
  const keys = optionKeys(q);
  const multi = q.type === 2;
  const revealed = SESSION.submitted;
  const fav = STATE.favorites.includes(q.id);
  const rec = getRecord(q.id);
  const ok = revealed && sameSet(SESSION.picked, q.answer);

  const optsHTML = keys.map((k) => {
    const text = q.options[k] != null ? q.options[k] : k;
    const picked = isPicked(k);
    const inAnswer = q.answer.includes(k);
    let cls = 'opt';
    let mark = '';
    if (revealed) {
      if (inAnswer) { cls += ' correct'; mark = '✓ 正确答案'; }
      else if (picked) { cls += ' wrong'; mark = '✗ 你的选择'; }
      else cls += ' dim';
    } else if (picked) cls += ' selected';
    return '<button class="' + cls + '" data-key="' + esc(k) + '"' + (revealed ? ' disabled' : '') + '>' +
      '<span class="opt-key">' + esc(k) + '</span>' +
      '<span>' + esc(text) + '</span>' +
      (mark ? '<span class="opt-mark">' + mark + '</span>' : '') +
      '</button>';
  }).join('');

  let feedback = '';
  if (revealed) {
    const rightN = q.answer.join('、');
    feedback =
      '<div class="verdict ' + (ok ? 'ok' : 'bad') + '">' +
        (ok ? '✓ 回答正确' : '✗ 回答错误') +
        '<span class="v-sub">正确答案：' + esc(rightN) + (rec.attempts ? ' · 本题历史 ' + rec.correct + '对/' + rec.wrong + '错' : '') + '</span>' +
      '</div>' +
      (SESSION.showAnalysis && q.analysis
        ? '<div class="answer-box"><div class="ab-line"><b>解析：</b></div><div class="ab-analysis">' + esc(q.analysis) + '</div></div>'
        : '');
  }

  card.innerHTML =
    '<div class="q-head">' +
      '<span class="tag tag-type">' + q.typeName + '</span>' +
      '<span class="tag tag-chapter">章节 ' + q.chapter + '</span>' +
      '<span class="tag tag-index">' + (SESSION.idx + 1) + ' / ' + SESSION.ids.length + '</span>' +
      (q.accuracy ? '<span class="tag tag-chapter">题库正确率 ' + esc(q.accuracy) + '</span>' : '') +
      '<div class="q-ops">' +
        '<button class="op-btn' + (fav ? ' on' : '') + '" id="btnFav">' + (fav ? '★ 已收藏' : '☆ 收藏') + '</button>' +
        (revealed ? '<button class="op-btn" id="btnRedo">🔁 再做一次</button>' : '') +
      '</div>' +
    '</div>' +
    '<div class="q-stem">' + esc(q.stem) + '</div>' +
    '<div class="options" id="optBox">' + optsHTML + '</div>' +
    feedback +
    '<div class="q-foot">' +
      '<button class="btn btn-ghost" id="btnPrev"' + (SESSION.idx === 0 ? ' disabled' : '') + '>← 上一题</button>' +
      (multi && !revealed
        ? '<button class="btn btn-primary" id="btnSubmit"' + (SESSION.picked.length ? '' : ' disabled') + '>提交答案</button>'
        : '') +
      (!revealed && !multi ? '<span style="font-size:13px;color:var(--ink-3)">点击选项即可作答</span>' : '') +
      '<span class="spacer"></span>' +
      '<button class="btn btn-primary" id="btnNext"' + (SESSION.idx === SESSION.ids.length - 1 ? ' disabled' : '') + '>下一题 →</button>' +
    '</div>';

  $$('#optBox .opt', card).forEach((b) => b.onclick = () => onPick(b.dataset.key));
  const bf = $('#btnFav', card);
  if (bf) bf.onclick = () => {
    const on = toggleInList('favorites', q.id);
    toast(on ? '已加入收藏夹' : '已取消收藏');
    paintQuestion();
    paintPager();
  };
  const br = $('#btnRedo', card);
  if (br) br.onclick = () => { SESSION.submitted = false; SESSION.picked = []; paintQuestion(); };
  $('#btnPrev', card).onclick = () => gotoQuestion(SESSION.idx - 1);
  $('#btnNext', card).onclick = () => gotoQuestion(SESSION.idx + 1);
  const bs = $('#btnSubmit', card);
  if (bs) bs.onclick = submitAnswer;
}

function onPick(key) {
  const q = currentQuestion();
  if (!q || SESSION.submitted) return;
  if (q.type === 2) {
    const i = SESSION.picked.indexOf(key);
    if (i >= 0) SESSION.picked.splice(i, 1); else SESSION.picked.push(key);
    paintQuestion();
    return;
  }
  SESSION.picked = [key];
  finishAttempt();
}

function submitAnswer() {
  if (!SESSION.picked.length) return;
  finishAttempt();
}

function finishAttempt() {
  const q = currentQuestion();
  const ok = sameSet(SESSION.picked, q.answer);
  const wasWrong = isWrong(q.id);
  recordAnswer(q.id, ok);
  SESSION.submitted = true;
  paintQuestion();
  paintPager();
  refreshSideStats();
  if (ok) toast(wasWrong ? '回答正确，已移出错题本' : '回答正确');
  else toast('回答错误，已加入错题本');
  saveSession();
}

function refreshSideStats() {
  const side = $('.side-card');
  if (!side || !SESSION) return;
  const st = statsFor(SESSION.ids);
  const rec = getRecord(currentQuestion().id);
  const rows = $$('.side-stat b', side);
  if (rows.length >= 4) {
    rows[0].textContent = st.done + ' / ' + SESSION.ids.length;
    rows[1].textContent = st.right;
    rows[2].textContent = st.wrong;
    rows[3].textContent = rec.attempts ? rec.correct + '对/' + rec.wrong + '错' : '未做过';
  }
  const fill = $('.progress-track .progress-fill', side);
  if (fill) fill.style.width = (SESSION.ids.length ? Math.round(st.done / SESSION.ids.length * 100) : 0) + '%';
}

function gotoQuestion(i) {
  if (!SESSION) return;
  SESSION.idx = clamp(i, 0, SESSION.ids.length - 1);
  SESSION.picked = [];
  SESSION.submitted = false;
  saveSession();
  paintQuestion();
  paintPager();
  refreshSideStats();
}

function paintPager() {
  const pager = $('#pager');
  if (!pager || !SESSION) return;
  if (SESSION.ids.length > 300 && !pager.dataset.long) {
    pager.dataset.long = '1';
  }
  const visible = SESSION.ids.length > 240 ? aroundWindow(SESSION.ids.length, SESSION.idx, 60) : SESSION.ids.map((_, i) => i);
  pager.innerHTML = visible.map((i) => {
    const id = SESSION.ids[i];
    const r = STATE.records[id];
    let cls = '';
    if (i === SESSION.idx) cls = 'current';
    else if (r && r.attempts) cls = r.lastRight === false ? 'bad' : 'ok';
    return '<button class="' + cls + '" data-i="' + i + '">' + (i + 1) + '</button>';
  }).join('') + (visible.length < SESSION.ids.length ? '<div class="pager-empty" style="grid-column:1/-1">显示 ' + visible.length + ' 格 · 当前第 ' + (SESSION.idx + 1) + ' 题</div>' : '');
  $$('button', pager).forEach((b) => b.onclick = () => gotoQuestion(Number(b.dataset.i)));
}

function aroundWindow(total, idx, size) {
  const start = clamp(idx - Math.floor(size / 2), 0, Math.max(0, total - size));
  const end = Math.min(total, start + size);
  const out = [];
  for (let i = start; i < end; i++) out.push(i);
  return out;
}

let EXAM = null;
const examCfg = { type: 'all', count: 50, minutes: 30 };

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return h ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
}

function examPool() {
  const bank = BANKS[STATE.level];
  let qs = bank.questions.slice();
  if (examCfg.type !== 'all') {
    const map = { single: 1, multi: 2, judge: 4 };
    qs = qs.filter((q) => q.type === map[examCfg.type]);
  }
  return shuffle(qs).map((q) => q.id);
}

function renderExam(view) {
  if (EXAM && EXAM.phase === 'testing') { paintExamView(view); return; }
  if (EXAM && EXAM.phase === 'result') { paintExamResult(view); return; }
  paintExamSetup(view);
}

function paintExamSetup(view) {
  const bank = BANKS[STATE.level];
  const typeCounts = bank.typeStats || {};
  const pill = (group, val, label) =>
    '<label><input type="radio" name="' + group + '" value="' + val + '"' +
    (String(examCfg[group]) === String(val) ? ' checked' : '') + '><span>' + label + '</span></label>';

  const history = (STATE.exams || []).slice(0, 10);
  const historyRows = history.map((e) =>
    '<tr><td>' + new Date(e.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</td>' +
    '<td>' + esc(levelById(e.level).name) + '</td><td>' + esc(e.typeName) + '</td>' +
    '<td class="num">' + e.total + '</td><td class="num">' + e.correct + '</td>' +
    '<td class="num" style="color:' + (e.score >= 60 ? 'var(--ok)' : 'var(--danger)') + '">' + e.score + '</td>' +
    '<td>' + fmtTime(e.used) + '</td></tr>'
  ).join('');

  view.innerHTML =
  '<div class="page-head"><div class="crumb"><span>首页</span><span>›</span><span>模拟考试</span></div>' +
    '<h1>全真模拟考试</h1><p>随机抽题、限时作答、自动评分，交卷后可逐题回顾。考试不计入练习记录。</p></div>' +
  '<div class="card exam-setup">' +
    '<h2>考试设置</h2><p class="desc">当前题库：' + esc(bank.full) + '，共 ' + bank.total + ' 题</p>' +
    '<div class="form-row">' +
      '<div class="form-field"><span>题型</span><div class="radio-pills">' +
        pill('type', 'all', '全部题型') +
        pill('type', 'single', '单选题 ' + (typeCounts['单选题'] || 0)) +
        pill('type', 'multi', '多选题 ' + (typeCounts['多选题'] || 0)) +
        pill('type', 'judge', '判断题 ' + (typeCounts['判断题'] || 0)) +
      '</div></div>' +
      '<div class="form-field"><span>题量</span><div class="radio-pills">' +
        pill('count', 20, '20 题') + pill('count', 50, '50 题') +
        pill('count', 100, '100 题') + pill('count', 999, '全部') +
      '</div></div>' +
      '<div class="form-field"><span>时长</span><div class="radio-pills">' +
        pill('minutes', 15, '15 分钟') + pill('minutes', 30, '30 分钟') +
        pill('minutes', 60, '60 分钟') + pill('minutes', 90, '90 分钟') +
      '</div></div>' +
    '</div>' +
    '<div class="q-foot" style="margin-top:6px">' +
      '<span style="font-size:13.5px;color:var(--ink-3)" id="examHint"></span>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-primary" id="btnStartExam">🏁 开始考试</button>' +
    '</div>' +
  '</div>' +
  (history.length
    ? '<div class="section-title"><h2>考试记录</h2><span class="sub">最近 ' + history.length + ' 次</span></div>' +
      '<div class="card" style="padding:6px 8px;overflow-x:auto"><table class="table">' +
      '<thead><tr><th>时间</th><th>等级</th><th>题型</th><th>题量</th><th>答对</th><th>得分</th><th>用时</th></tr></thead>' +
      '<tbody>' + historyRows + '</tbody></table></div>'
    : '');

  const hint = $('#examHint', view);
  const updHint = () => {
    const pool = examPool();
    const n = Math.min(examCfg.count, pool.length);
    hint.textContent = '预计抽题 ' + n + ' 题 · 限时 ' + examCfg.minutes + ' 分钟 · 60 分及格';
  };
  $$('.radio-pills input', view).forEach((inp) => inp.onchange = () => {
    examCfg[inp.name] = inp.name === 'count' || inp.name === 'minutes' ? Number(inp.value) : inp.value;
    updHint();
  });
  updHint();
  $('#btnStartExam', view).onclick = startExam;
}

function startExam() {
  const ids = examPool().slice(0, examCfg.count);
  if (!ids.length) { toast('当前筛选下没有可考题目'); return; }
  EXAM = {
    ids,
    idx: 0,
    answers: {},
    phase: 'testing',
    level: STATE.level,
    type: examCfg.type,
    typeName: { all: '全部题型', single: '单选题', multi: '多选题', judge: '判断题' }[examCfg.type],
    startedAt: Date.now(),
    durationSec: examCfg.minutes * 60,
    timer: null
  };
  startExamTimer();
  render();
}

function startExamTimer() {
  if (!EXAM) return;
  clearInterval(EXAM.timer);
  EXAM.timer = setInterval(() => {
    if (!EXAM || EXAM.phase !== 'testing') { clearInterval(EXAM && EXAM.timer); return; }
    const left = EXAM.durationSec - Math.floor((Date.now() - EXAM.startedAt) / 1000);
    const t = $('#timer');
    if (t) {
      t.textContent = fmtTime(left);
      t.classList.toggle('warn', left <= 300);
    }
    if (left <= 0) {
      clearInterval(EXAM.timer);
      toast('考试时间到，已自动交卷');
      finishExam(true);
    }
  }, 500);
}

function examAnsweredCount() {
  return EXAM.ids.filter((id) => (EXAM.answers[id] || []).length).length;
}

function examCurrentQ() {
  return BANKS[EXAM.level].byId.get(EXAM.ids[EXAM.idx]);
}

function paintExamView(view) {
  view = view || $('#view');
  const bank = BANKS[EXAM.level];
  const left = EXAM.durationSec - Math.floor((Date.now() - EXAM.startedAt) / 1000);

  view.innerHTML =
  '<div class="exam-topbar">' +
    '<span class="et-title">🏁 模拟考试 · ' + esc(levelById(EXAM.level).name) + ' · ' + esc(EXAM.typeName) + '</span>' +
    '<span class="spacer"></span>' +
    '<span style="font-size:13.5px;color:var(--ink-3)" id="etDone">已答 ' + examAnsweredCount() + ' / ' + EXAM.ids.length + '</span>' +
    '<span class="timer' + (left <= 300 ? ' warn' : '') + '" id="timer">' + fmtTime(left) + '</span>' +
    '<button class="btn btn-danger btn-sm" id="btnHandIn">交卷</button>' +
  '</div>' +
  '<div class="practice-layout">' +
    '<div class="card q-card" id="qCard"></div>' +
    '<aside class="card side-card">' +
      '<h3>考试答题卡</h3>' +
      '<div class="side-stat"><span>总题数</span><b>' + EXAM.ids.length + '</b></div>' +
      '<div class="side-stat"><span>已作答</span><b id="sideDone">' + examAnsweredCount() + '</b></div>' +
      '<div class="side-stat"><span>未作答</span><b id="sideTodo">' + (EXAM.ids.length - examAnsweredCount()) + '</b></div>' +
      '<div class="progress-track" style="margin-top:14px"><div class="progress-fill" id="examFill" style="width:' + Math.round(examAnsweredCount() / EXAM.ids.length * 100) + '%"></div></div>' +
      '<div class="pager" id="pager"></div>' +
      '<div class="hint-keys"><span><span class="kbd">A–E</span> 选项</span><span><span class="kbd">← →</span> 翻页</span></div>' +
    '</aside>' +
  '</div>';

  paintExamQuestion();
  paintExamPager();
  $('#btnHandIn', view).onclick = handInExam;
}

function paintExamQuestion() {
  const card = $('#qCard');
  if (!card || !EXAM) return;
  const q = examCurrentQ();
  const keys = optionKeys(q);
  const picked = EXAM.answers[q.id] || [];

  const optsHTML = keys.map((k) => {
    const text = q.options[k] != null ? q.options[k] : k;
    const on = picked.includes(k);
    return '<button class="opt' + (on ? ' selected' : '') + '" data-key="' + esc(k) + '">' +
      '<span class="opt-key">' + esc(k) + '</span><span>' + esc(text) + '</span></button>';
  }).join('');

  card.innerHTML =
    '<div class="q-head">' +
      '<span class="tag tag-type">' + q.typeName + '</span>' +
      '<span class="tag tag-index">' + (EXAM.idx + 1) + ' / ' + EXAM.ids.length + '</span>' +
      (q.type === 2 ? '<span class="tag tag-chapter">多选 · 选完点下一题</span>' : '') +
    '</div>' +
    '<div class="q-stem">' + esc(q.stem) + '</div>' +
    '<div class="options" id="optBox">' + optsHTML + '</div>' +
    '<div class="q-foot">' +
      '<button class="btn btn-ghost" id="btnPrev"' + (EXAM.idx === 0 ? ' disabled' : '') + '>← 上一题</button>' +
      (!picked.length ? '<span style="font-size:13px;color:var(--ink-3)">本题未作答</span>' : '') +
      '<span class="spacer"></span>' +
      '<button class="btn btn-primary" id="btnNext"' + (EXAM.idx === EXAM.ids.length - 1 ? ' disabled' : '') + '>下一题 →</button>' +
    '</div>';

  $$('#optBox .opt', card).forEach((b) => b.onclick = () => examPick(b.dataset.key));
  $('#btnPrev', card).onclick = () => examGoto(EXAM.idx - 1);
  $('#btnNext', card).onclick = () => examGoto(EXAM.idx + 1);
}

function examPick(key) {
  if (!EXAM || EXAM.phase !== 'testing') return;
  const q = examCurrentQ();
  const cur = EXAM.answers[q.id] || [];
  if (q.type === 2) {
    const i = cur.indexOf(key);
    if (i >= 0) cur.splice(i, 1); else cur.push(key);
    EXAM.answers[q.id] = cur;
  } else {
    EXAM.answers[q.id] = [key];
  }
  paintExamQuestion();
  paintExamPager();
  refreshExamSide();
}

function examGoto(i) {
  if (!EXAM) return;
  EXAM.idx = clamp(i, 0, EXAM.ids.length - 1);
  paintExamQuestion();
  paintExamPager();
}

function refreshExamSide() {
  const done = examAnsweredCount();
  const d = $('#sideDone'), t = $('#sideTodo'), f = $('#examFill'), e = $('#etDone');
  if (d) d.textContent = done;
  if (t) t.textContent = EXAM.ids.length - done;
  if (f) f.style.width = Math.round(done / EXAM.ids.length * 100) + '%';
  if (e) e.textContent = '已答 ' + done + ' / ' + EXAM.ids.length;
}

function paintExamPager() {
  const pager = $('#pager');
  if (!pager || !EXAM) return;
  const visible = EXAM.ids.length > 240 ? aroundWindow(EXAM.ids.length, EXAM.idx, 60) : EXAM.ids.map((_, i) => i);
  pager.innerHTML = visible.map((i) => {
    const id = EXAM.ids[i];
    const answered = (EXAM.answers[id] || []).length > 0;
    let cls = i === EXAM.idx ? 'current' : '';
    if (i !== EXAM.idx && answered) cls = 'ok';
    if (i !== EXAM.idx && !answered) cls = 'marked';
    return '<button class="' + cls + '" data-i="' + i + '">' + (i + 1) + '</button>';
  }).join('') + (visible.length < EXAM.ids.length ? '<div class="pager-empty" style="grid-column:1/-1">显示 ' + visible.length + ' 格 · 当前第 ' + (EXAM.idx + 1) + ' 题</div>' : '');
  $$('button', pager).forEach((b) => b.onclick = () => examGoto(Number(b.dataset.i)));
}

function handInExam() {
  const todo = EXAM.ids.length - examAnsweredCount();
  modal('确认交卷？', '<p>还有 <b>' + todo + '</b> 题未作答，交卷后不可修改。</p>', [
    { label: '继续答题' },
    { label: '确认交卷', primary: true, onClick: () => finishExam(false) }
  ]);
}

function finishExam(auto) {
  if (!EXAM || EXAM.phase !== 'testing') return;
  clearInterval(EXAM.timer);
  const bank = BANKS[EXAM.level];
  let correct = 0;
  const byType = {};
  EXAM.ids.forEach((id) => {
    const q = bank.byId.get(id);
    const picked = EXAM.answers[id] || [];
    const ok = sameSet(picked, q.answer);
    if (ok) correct += 1;
    if (!byType[q.type]) byType[q.type] = { name: q.typeName, total: 0, correct: 0 };
    byType[q.type].total += 1;
    if (ok) byType[q.type].correct += 1;
  });
  const total = EXAM.ids.length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  const used = Math.min(EXAM.durationSec, Math.floor((Date.now() - EXAM.startedAt) / 1000));
  EXAM.result = { correct, total, score, used, byType, auto: !!auto };
  EXAM.phase = 'result';
  STATE.exams = STATE.exams || [];
  STATE.exams.unshift({
    at: Date.now(), level: EXAM.level, type: EXAM.type, typeName: EXAM.typeName,
    total, correct, score, used
  });
  if (STATE.exams.length > 30) STATE.exams.length = 30;
  saveState();
  if (route === 'exam') render(); else toast('本次考试已结束，得分 ' + score);
}

function paintExamResult(view) {
  const r = EXAM.result;
  const passed = r.score >= 60;
  const typeRows = Object.values(r.byType).map((t) => {
    const pct = t.total ? Math.round((t.correct / t.total) * 100) : 0;
    return '<tr><td>' + t.name + '</td><td class="num">' + t.total + '</td><td class="num">' + t.correct + '</td>' +
      '<td><div class="bar-cell"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="bv">' + pct + '%</span></div></td></tr>';
  }).join('');

  const review = EXAM.ids.map((id, i) => {
    const q = BANKS[EXAM.level].byId.get(id);
    const picked = EXAM.answers[id] || [];
    const ok = sameSet(picked, q.answer);
    const keys = optionKeys(q);
    const opts = keys.map((k) => {
      const text = q.options[k] != null ? q.options[k] : k;
      const inAns = q.answer.includes(k);
      const on = picked.includes(k);
      let cls = inAns ? ' correct' : (on ? ' wrong' : ' dim');
      let mark = inAns ? '✓ 正确答案' : (on ? '✗ 你的选择' : '');
      return '<div class="opt' + cls + '" style="cursor:default">' +
        '<span class="opt-key">' + esc(k) + '</span><span>' + esc(text) + '</span>' +
        (mark ? '<span class="opt-mark">' + mark + '</span>' : '') + '</div>';
    }).join('');
    return '<div class="review-item">' +
      '<div class="q-head" style="margin-bottom:8px">' +
        '<span class="tag ' + (ok ? 'tag-type' : 'tag-flag') + '">' + (ok ? '✓ 答对' : '✗ 答错') + '</span>' +
        '<span class="tag tag-chapter">' + q.typeName + '</span>' +
        '<span class="tag tag-index">第 ' + (i + 1) + ' 题</span>' +
        (!picked.length ? '<span class="tag tag-flag">未作答</span>' : '') +
      '</div>' +
      '<div class="rv-stem">' + esc(q.stem) + '</div>' +
      '<div class="options">' + opts + '</div>' +
      (q.analysis ? '<div class="rv-analysis"><b>解析：</b>' + esc(q.analysis) + '</div>' : '') +
    '</div>';
  }).join('');

  view.innerHTML =
  '<div class="result-hero">' +
    '<div class="score-ring" style="--p:' + r.score + '"><div class="sr-inner">' +
      '<div class="score-num">' + r.score + '<em>分</em></div>' +
      '<div class="score-label">' + (passed ? 'PASSED' : 'FAILED') + '</div>' +
    '</div></div>' +
    '<h2>' + (passed ? '🎉 恭喜，本次考试合格！' : '💪 未达 60 分，再接再厉') + '</h2>' +
    '<p>' + esc(levelById(EXAM.level).full) + ' · ' + esc(EXAM.typeName) + ' · ' + (r.auto ? '时间到自动交卷' : '主动交卷') + '</p>' +
    '<div class="result-metrics">' +
      '<div class="rm"><b>' + r.correct + ' / ' + r.total + '</b><span>答对 / 总题数</span></div>' +
      '<div class="rm"><b>' + r.total - r.correct + '</b><span>答错或未答</span></div>' +
      '<div class="rm"><b>' + fmtTime(r.used) + '</b><span>实际用时</span></div>' +
      '<div class="rm"><b>' + Math.round(r.correct / Math.max(1, r.total) * 100) + '%</b><span>正确率</span></div>' +
    '</div>' +
    '<div class="q-foot" style="justify-content:center;margin-top:26px">' +
      '<button class="btn" id="btnRetryExam" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.35);color:#fff">🔁 再考一次</button>' +
      '<button class="btn" id="btnBackSetup" style="background:#c9a86a;color:#173d31;border-color:transparent">调整考试设置</button>' +
    '</div>' +
  '</div>' +
  '<div class="section-title"><h2>按题型分析</h2><span class="sub">看看哪类题是短板</span></div>' +
  '<div class="card" style="padding:6px 8px"><table class="table">' +
    '<thead><tr><th>题型</th><th>题量</th><th>答对</th><th>正确率</th></tr></thead><tbody>' + typeRows + '</tbody></table></div>' +
  '<div class="section-title"><h2>逐题回顾</h2><span class="sub">共 ' + EXAM.ids.length + ' 题</span></div>' +
  '<div class="stack">' + review + '</div>';

  $('#btnRetryExam', view).onclick = startExam;
  $('#btnBackSetup', view).onclick = () => { EXAM = null; render(); };
}

function listToolbar(ph, extraBtns) {
  return '<div class="toolbar">' +
    '<div class="search-wrap">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input class="input" id="liSearch" type="search" placeholder="' + ph + '">' +
    '</div>' +
    '<span class="spacer"></span>' + (extraBtns || '') + '</div>';
}

function listItemHTML(q, mode) {
  const rec = getRecord(q.id);
  const meta = [];
  meta.push('<span class="badge-ok" style="background:var(--brand-soft);color:var(--brand)">' + q.typeName + '</span>');
  if (mode === 'wrong') {
    meta.push('<span class="badge-err">累计答错 ' + rec.wrong + ' 次</span>');
    if (rec.attempts) meta.push('<span class="' + (rec.lastRight ? 'badge-ok' : 'badge-err') + '">最近一次' + (rec.lastRight ? '答对' : '答错') + '</span>');
  } else {
    meta.push('<span class="badge-ok">已收藏</span>');
    if (rec.attempts) meta.push('<span>作答 ' + rec.attempts + ' 次 · ' + rec.correct + ' 对</span>');
  }
  if (q.accuracy) meta.push('<span>题库正确率 ' + esc(q.accuracy) + '</span>');
  return '<div class="list-item" data-id="' + q.id + '">' +
    '<div class="li-main">' +
      '<div class="li-stem">' + esc(q.stem) + '</div>' +
      '<div class="li-meta">' + meta.join('') + '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-sm" data-view="' + q.id + '">解析</button>' +
    '<button class="btn btn-soft btn-sm" data-drill="' + q.id + '">单题练</button>' +
    '<button class="btn ' + (mode === 'wrong' ? 'btn-danger' : 'btn-ghost') + ' btn-sm" data-del="' + q.id + '">' +
      (mode === 'wrong' ? '移出' : '取消收藏') + '</button>' +
  '</div>';
}

function showQuestionModal(q) {
  const rec = getRecord(q.id);
  const keys = optionKeys(q);
  const opts = keys.map((k) => {
    const text = q.options[k] != null ? q.options[k] : k;
    const inAns = q.answer.includes(k);
    return '<div class="opt' + (inAns ? ' correct' : ' dim') + '" style="cursor:default">' +
      '<span class="opt-key">' + esc(k) + '</span><span>' + esc(text) + '</span>' +
      (inAns ? '<span class="opt-mark">✓ 正确答案</span>' : '') + '</div>';
  }).join('');
  modal(q.typeName + ' · 解析',
    '<div class="q-stem" style="font-size:16px">' + esc(q.stem) + '</div>' +
    '<div class="options">' + opts + '</div>' +
    (q.analysis ? '<div class="rv-analysis" style="margin-top:12px"><b>解析：</b>' + esc(q.analysis) + '</div>' : '') +
    (rec.attempts ? '<div class="rv-line" style="margin-top:10px">你的作答记录：' + rec.attempts + ' 次 · 对 ' + rec.correct + ' · 错 ' + rec.wrong + '</div>' : ''),
    [{ label: '关闭', primary: true }]
  );
}

function renderIdList(view, mode) {
  const bank = BANKS[STATE.level];
  const isWrong = mode === 'wrong';
  let ids = (isWrong ? wrongIds() : STATE.favorites.slice()).filter((id) => bank.byId.has(id));

  const head =
  '<div class="page-head"><div class="crumb"><span>首页</span><span>›</span><span>' + (isWrong ? '错题本' : '收藏夹') + '</span></div>' +
    '<h1>' + (isWrong ? '错题本' : '收藏夹') + '</h1>' +
    '<p>' + (isWrong
      ? '最近一次答错的题目会自动收录于此，答对后自动移出。当前等级共 ' + ids.length + ' 道错题。'
      : '练习时点击「☆ 收藏」加入，方便考前集中复习。当前等级共 ' + ids.length + ' 道收藏。') + '</p></div>';

  if (!ids.length) {
    view.innerHTML = head + emptyBlock(isWrong ? '🍵' : '⭐',
      isWrong ? '没有错题，太棒了' : '收藏夹是空的',
      isWrong ? '所有做过的题目都答对了，继续保持。' : '在练习页点击题目右上角的「☆ 收藏」即可加入。',
      '<button class="btn btn-primary" data-go="practice">去刷题</button>');
    $('[data-go]', view).onclick = () => navigate('practice');
    return;
  }

  const extra =
    '<button class="btn btn-primary btn-sm" id="btnDrillAll">🎯 ' + (isWrong ? '专练这些错题' : '练习全部收藏') + '</button>' +
    (isWrong ? '<button class="btn btn-danger btn-sm" id="btnClearWrong">清空错题本</button>' : '');

  view.innerHTML = head +
    listToolbar('搜索题干关键词…', extra) +
    '<div class="stack" id="liStack">' +
      ids.map((id) => listItemHTML(bank.byId.get(id), mode)).join('') +
    '</div>';

  const stack = $('#liStack', view);
  const bind = () => {
    $$('[data-view]', stack).forEach((b) => b.onclick = () => showQuestionModal(bank.byId.get(Number(b.dataset.view))));
    $$('[data-drill]', stack).forEach((b) => b.onclick = () => startPractice({ scope: 'all', chapter: 'all', order: 'seq', ids: [Number(b.dataset.drill)] }));
    $$('[data-del]', stack).forEach((b) => b.onclick = () => {
      const id = Number(b.dataset.del);
      if (isWrong) {
        const r = STATE.records[id];
        if (r) { r.lastRight = null; saveState(); }
      } else {
        toggleInList('favorites', id);
      }
      toast(isWrong ? '已移出错题本' : '已取消收藏');
      render();
    });
  };
  bind();

  $('#liSearch', view).oninput = (e) => {
    const s = e.target.value.trim().toLowerCase();
    let shown = 0;
    $$('.list-item', stack).forEach((el) => {
      const q = bank.byId.get(Number(el.dataset.id));
      const hit = !s || q.stem.toLowerCase().includes(s) || Object.values(q.options).some((v) => String(v).toLowerCase().includes(s));
      el.style.display = hit ? '' : 'none';
      if (hit) shown += 1;
    });
    if (!shown && s) toast('没有匹配的题目');
  };

  $('#btnDrillAll', view).onclick = () => startPractice({
    scope: isWrong ? 'wrong' : 'fav', chapter: 'all', order: 'seq'
  });
  const bc = $('#btnClearWrong', view);
  if (bc) bc.onclick = () => {
    modal('清空错题本？', '<p>将移出当前等级的 ' + ids.length + ' 道错题记录（历史作答记录保留）。</p>', [
      { label: '取消' },
      { label: '确认清空', danger: true, onClick: () => {
        ids.forEach((id) => { const r = STATE.records[id]; if (r) r.lastRight = null; });
        saveState(); toast('错题本已清空'); render();
      } }
    ]);
  };
}

function renderWrong(view) { renderIdList(view, 'wrong'); }
function renderFav(view) { renderIdList(view, 'fav'); }

async function renderStats(view) {
  await Promise.all(LEVELS.map((l) => loadBank(l.id).catch(() => null)));

  const bank = BANKS[STATE.level];
  const ids = bank.questions.map((q) => q.id);
  let attempts = 0, right = 0, wrong = 0, done = 0;
  ids.forEach((id) => {
    const r = STATE.records[id];
    if (r && r.attempts > 0) {
      done += 1;
      attempts += r.attempts;
      right += r.correct;
      wrong += r.wrong;
    }
  });
  const acc = attempts ? Math.round((right / attempts) * 100) : 0;
  const wrongN = wrongIds().filter((id) => bank.byId.has(id)).length;
  const favN = STATE.favorites.filter((id) => bank.byId.has(id)).length;
  const examN = (STATE.exams || []).length;
  const bestScore = examN ? Math.max.apply(null, STATE.exams.map((e) => e.score)) : 0;

  const typeRows = [1, 2, 4].map((t) => {
    const qs = bank.questions.filter((q) => q.type === t);
    if (!qs.length) return '';
    let a = 0, r2 = 0;
    qs.forEach((q) => {
      const rec = STATE.records[q.id];
      if (rec && rec.attempts > 0) { a += rec.attempts; r2 += rec.correct; }
    });
    const pct = a ? Math.round((r2 / a) * 100) : 0;
    const covered = qs.filter((q) => STATE.records[q.id] && STATE.records[q.id].attempts > 0).length;
    return '<tr><td>' + TYPE_NAMES[t] + '</td><td class="num">' + qs.length + '</td>' +
      '<td class="num">' + covered + '</td><td class="num">' + a + '</td>' +
      '<td><div class="bar-cell"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="bv">' + (a ? pct + '%' : '–') + '</span></div></td></tr>';
  }).join('');

  const levelRows = LEVELS.map((l) => {
    const b = BANKS[l.id];
    if (!b) return '';
    const p = levelProgress(l.id);
    return '<tr><td>' + l.full + '</td><td class="num">' + b.total + '</td>' +
      '<td class="num">' + p.done + '</td>' +
      '<td><div class="bar-cell"><div class="progress-track"><div class="progress-fill' + (l.id === STATE.level ? '' : ' gold') + '" style="width:' + p.pct + '%"></div></div>' +
      '<span class="bv">' + p.pct + '%</span></div></td>' +
      '<td class="num">' + (p.acc || 0) + '%</td></tr>';
  }).join('');

  view.innerHTML =
  '<div class="page-head"><div class="crumb"><span>首页</span><span>›</span><span>学习统计</span></div>' +
    '<h1>学习统计</h1><p>基于本机浏览器记录的作答数据，当前等级：' + esc(bank.full) + '</p></div>' +
  '<div class="stat-grid">' +
    '<div class="stat-tile"><div class="st-label">已练习题数</div><div class="st-num">' + done + '<em>/ ' + bank.total + '</em></div><div class="st-sub">覆盖 ' + (bank.total ? Math.round(done / bank.total * 100) : 0) + '% 题库</div></div>' +
    '<div class="stat-tile"><div class="st-label">累计作答</div><div class="st-num">' + attempts + '<em>次</em></div><div class="st-sub">答对 ' + right + ' · 答错 ' + wrong + '</div></div>' +
    '<div class="stat-tile"><div class="st-label">综合正确率</div><div class="st-num">' + acc + '<em>%</em></div><div class="st-sub">' + (acc >= 80 ? '相当扎实，保持状态' : acc >= 60 ? '稳步提升中' : '多刷错题见效快') + '</div></div>' +
    '<div class="stat-tile"><div class="st-label">错题 / 收藏</div><div class="st-num">' + wrongN + '<em>/ ' + favN + '</em></div><div class="st-sub">考试 ' + examN + ' 次 · 最高 ' + bestScore + ' 分</div></div>' +
  '</div>' +
  '<div class="grid grid-2">' +
    '<div>' +
      '<div class="section-title"><h2>按题型表现</h2><span class="sub">' + esc(bank.name) + '题库</span></div>' +
      '<div class="card" style="padding:6px 8px"><table class="table">' +
        '<thead><tr><th>题型</th><th>题量</th><th>已练</th><th>作答</th><th>正确率</th></tr></thead>' +
        '<tbody>' + typeRows + '</tbody></table></div>' +
    '</div>' +
    '<div>' +
      '<div class="section-title"><h2>各等级进度</h2><span class="sub">三级总览</span></div>' +
      '<div class="card" style="padding:6px 8px"><table class="table">' +
        '<thead><tr><th>等级</th><th>题量</th><th>已练</th><th>进度</th><th>正确率</th></tr></thead>' +
        '<tbody>' + levelRows + '</tbody></table></div>' +
    '</div>' +
  '</div>' +
  '<div class="section-title"><h2>数据管理</h2><span class="sub">清空后不可恢复</span></div>' +
  '<div class="card" style="padding:18px 20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">' +
    '<span style="font-size:13.5px;color:var(--ink-3);flex:1;min-width:220px">所有进度保存在本机浏览器 localStorage，清除浏览器数据会丢失记录。</span>' +
    '<button class="btn btn-ghost btn-sm" id="btnExport">导出进度 JSON</button>' +
    '<button class="btn btn-danger btn-sm" id="btnReset">清空全部学习记录</button>' +
  '</div>';

  $('#btnExport', view).onclick = () => {
    const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '评茶刷题进度.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('已导出进度文件');
  };
  $('#btnReset', view).onclick = () => {
    modal('清空全部学习记录？', '<p>包括作答记录、错题本、收藏夹、考试记录与练习进度，不可恢复。</p>', [
      { label: '取消' },
      { label: '确认清空', danger: true, onClick: () => {
        const theme = STATE.theme, level = STATE.level;
        STATE = defaultState(); STATE.theme = theme; STATE.level = level;
        SESSION = null; EXAM = null;
        saveState(); toast('已清空全部记录'); render();
      } }
    ]);
  };
}

const OPTION_KEY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (!$('#modal').hidden) { closeModal(); e.preventDefault(); }
    return;
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$('#modal').hidden) return;

  const key = e.key;

  if (route === 'practice' && SESSION && SESSION.ids.length) {
    const q = currentQuestion();
    if (!q) return;
    const li = OPTION_KEY_LETTERS.indexOf(key.toUpperCase());
    if (li >= 0 && !SESSION.submitted) {
      const keys = optionKeys(q);
      if (li < keys.length) { onPick(keys[li]); e.preventDefault(); }
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      if (!SESSION.submitted && SESSION.picked.length) submitAnswer();
      else gotoQuestion(SESSION.idx + 1);
      return;
    }
    if (key === 'ArrowLeft') { e.preventDefault(); gotoQuestion(SESSION.idx - 1); return; }
    if (key === 'ArrowRight') { e.preventDefault(); gotoQuestion(SESSION.idx + 1); return; }
    if (key.toLowerCase() === 'f') {
      e.preventDefault();
      const on = toggleInList('favorites', q.id);
      toast(on ? '已加入收藏夹' : '已取消收藏');
      paintQuestion();
      paintPager();
      return;
    }
  }

  if (route === 'exam' && EXAM && EXAM.phase === 'testing') {
    const q = examCurrentQ();
    if (!q) return;
    const li = OPTION_KEY_LETTERS.indexOf(key.toUpperCase());
    if (li >= 0) {
      const keys = optionKeys(q);
      if (li < keys.length) { examPick(keys[li]); e.preventDefault(); }
      return;
    }
    if (key === 'Enter') { e.preventDefault(); examGoto(EXAM.idx + 1); return; }
    if (key === 'ArrowLeft') { e.preventDefault(); examGoto(EXAM.idx - 1); return; }
    if (key === 'ArrowRight') { e.preventDefault(); examGoto(EXAM.idx + 1); return; }
  }
}

function showHelp() {
  modal('键盘快捷键',
    '<div class="kbd-table">' +
      '<span class="kbd">A – F</span><span>选择对应选项（练习/考试中）</span>' +
      '<span class="kbd">Enter</span><span>提交答案 / 下一题</span>' +
      '<span class="kbd">← →</span><span>上一题 / 下一题</span>' +
      '<span class="kbd">F</span><span>收藏当前题目（仅练习）</span>' +
      '<span class="kbd">Esc</span><span>关闭弹窗</span>' +
    '</div>' +
    '<p style="margin-top:14px;font-size:13px;color:var(--ink-3)">提示：输入框获得焦点时快捷键自动失效。</p>',
    [{ label: '知道了', primary: true }]
  );
}

function init() {
  loadState();
  applyTheme();
  buildLevelSwitch();

  $('#themeBtn').onclick = () => {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    saveState();
    applyTheme();
    toast(STATE.theme === 'dark' ? '已切换到深色模式' : '已切换到浅色模式');
  };

  $('#navToggle').onclick = () => $('#nav').classList.toggle('open');
  $('#helpBtn').onclick = showHelp;
  const bd = $('#modal .modal-backdrop');
  if (bd) bd.onclick = closeModal;

  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('hashchange', render);
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
