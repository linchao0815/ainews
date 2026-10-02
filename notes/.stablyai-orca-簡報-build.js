const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625
pres.title = 'Stably Orca 評估';

const F = 'Microsoft JhengHei';
const C = {
  navy: '0B2545', navy2: '13315C', teal: '13A89E', tealLt: 'E3F4F2',
  coral: 'E8604C', coralLt: 'FCE9E6', ink: '1F2A37', mute: '5B6B7B',
  line: 'D5DCE3', bg: 'FFFFFF', soft: 'F3F6F9', ice: 'BFD7EA',
};
const OUT = process.argv[2];

function title(s, text, sub) {
  s.addText(text, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontFace: F, fontSize: 26, bold: true, color: C.navy, margin: 0, isTextBox: true });
  if (sub) s.addText(sub, { x: 0.5, y: 0.88, w: 9, h: 0.35, fontFace: F, fontSize: 13, color: C.mute, margin: 0, isTextBox: true });
}
function circle(s, x, y, d, fill, glyph, gsize) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  s.addText(glyph, { x, y, w: d, h: d, fontFace: F, fontSize: gsize || 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}
function card(s, x, y, w, h, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || C.soft }, line: { color: fill || C.soft } });
}
function txt(s, runs, o) {
  s.addText(runs, Object.assign({ fontFace: F, fontSize: 14, color: C.ink, margin: 0, valign: 'top', isTextBox: true }, o));
}
function bullets(items, o) {
  return items.map((it, i) => {
    const runs = Array.isArray(it) ? it : [{ text: it }];
    return runs.map((r, j) => ({
      text: r.text,
      options: Object.assign({ bullet: j === 0 ? { indent: 14 } : undefined, breakLine: j === runs.length - 1 && i < items.length - 1, paraSpaceAfter: 6 }, r.options || {}),
    }));
  }).flat();
}
const B = (t, color) => ({ text: t, options: { bold: true, color: color || C.navy } });
const T = (t) => ({ text: t });
function table(s, rows, o) {
  const head = rows[0].map((t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.navy } } }));
  const body = rows.slice(1).map((r, i) => r.map((t, j) => {
    const cell = typeof t === 'string' ? { text: t } : t;
    cell.options = Object.assign({ fill: { color: i % 2 ? 'FFFFFF' : C.soft }, bold: j === 0 }, cell.options || {});
    return cell;
  }));
  s.addTable([head, ...body], Object.assign({ fontFace: F, fontSize: 12, color: C.ink, border: { type: 'solid', pt: 0.75, color: C.line }, valign: 'middle', margin: [3, 6, 3, 6] }, o));
}
function footer(s, text) {
  s.addText(text, { x: 0.5, y: 5.2, w: 9, h: 0.25, fontFace: F, fontSize: 9, color: C.mute, margin: 0, isTextBox: true });
}

// 1 封面
{
  const s = pres.addSlide(); s.background = { color: C.navy };
  for (let i = 0; i < 5; i++) s.addShape(pres.shapes.OVAL, { x: 6.6 + i * 0.55, y: 0.9 + (i % 2) * 0.35, w: 0.38, h: 0.38, fill: { color: i === 0 ? C.teal : C.navy2 }, line: { color: i === 0 ? C.teal : C.ice, width: 1 } });
  txt(s, 'Stably Orca', { x: 0.6, y: 1.6, w: 8.8, h: 0.8, fontSize: 40, bold: true, color: 'FFFFFF' });
  txt(s, '同時指揮多個 AI 寫程式助手的工具', { x: 0.6, y: 2.4, w: 8.8, h: 0.5, fontSize: 22, color: C.ice });
  txt(s, bullets(['能用我們現有的 Claude／Codex 訂閱嗎？', '額度用完怎麼辦？', '能取代記憶系統嗎？']), { x: 0.6, y: 3.2, w: 6, h: 1.2, fontSize: 15, color: 'FFFFFF' });
  txt(s, '查證日期 2026-10-01', { x: 0.6, y: 4.9, w: 5, h: 0.3, fontSize: 11, color: C.ice });
  s.addNotes('名詞先講清楚：\nAI 寫程式助手：Claude Code、Codex 這類在終端機裡幫你寫程式的工具，以下簡稱「助手」。\nsession（對話）：和助手的一段對話，關掉就結束。\nworktree：同一個專案複製出來的獨立工作資料夾，幾個助手同時改也不會互相踩到。\nPR／issue：GitHub 上的「待合併的程式修改」／「需求或問題回報」，兩者都不代表功能已經上線。');
}

// 2 結論
{
  const s = pres.addSlide(); title(s, '結論先講');
  const rows = [
    [C.teal, '✓', '它是「指揮台」，不提供 AI', '用的是你自己已經付費的 Claude／Codex 帳號'],
    [C.coral, '!', '額度用完不會自動接手', '自動等額度恢復、自動換帳號，到最新版 v1.4.218 都還沒有；能做的是事先登記多個帳號，用完時手動切換'],
    [C.navy2, '✕', '不會幫你記住過去學到的東西', '不能取代現有的記憶作法（llm-wiki＋auto-memory），兩者是搭配使用'],
  ];
  rows.forEach((r, i) => {
    const y = 1.2 + i * 1.3;
    card(s, 0.5, y, 9, 1.1);
    circle(s, 0.75, y + 0.27, 0.56, r[0], r[1], 20);
    txt(s, r[2], { x: 1.6, y: y + 0.15, w: 7.7, h: 0.4, fontSize: 18, bold: true, color: C.navy });
    txt(s, r[3], { x: 1.6, y: y + 0.55, w: 7.7, h: 0.5, fontSize: 13, color: C.mute });
  });
}

// 3 Orca 是什麼
{
  const s = pres.addSlide(); title(s, 'Orca 是什麼', '官方一句話：「用你自己的訂閱，跑任何 AI 寫程式助手」');
  txt(s, bullets([
    [B('34 種助手'), T('：Claude Code、Codex、Cursor、Copilot、OpenCode、Grok…，能在終端機跑的都能接')],
    [B('各做各的'), T('：每個助手在自己的工作資料夾裡做事，可以讓好幾個同時做同一題，挑最好的那份')],
    [B('到處能用'), T('：電腦（Mac／Windows／Linux）、手機（iOS、Android）、遠端主機')],
    [B('其他功能'), T('：看 GitHub／Linear 工單、點畫面元件讓 AI 改版面（Design Mode）、讓 AI 操作桌面程式（Computer Use）')],
  ]), { x: 0.5, y: 1.45, w: 5.6, h: 3.6, fontSize: 14 });
  const stats = [['34+', '支援的助手'], ['8.3 萬', 'GitHub 星數'], ['MIT', '免費開源']];
  stats.forEach((st, i) => {
    const y = 1.45 + i * 1.2;
    card(s, 6.5, y, 3, 1.0, i === 0 ? C.tealLt : C.soft);
    txt(s, st[0], { x: 6.7, y: y + 0.1, w: 2.6, h: 0.55, fontSize: 30, bold: true, color: i === 0 ? C.teal : C.navy });
    txt(s, st[1], { x: 6.7, y: y + 0.63, w: 2.6, h: 0.3, fontSize: 12, color: C.mute });
  });
}

// 4 用自己的訂閱
{
  const s = pres.addSlide(); title(s, '用自己的訂閱帳號', 'Orca 不需要另外買 API，直接叫起你電腦上已經登入的 Claude／Codex');
  const items = [
    ['⇄', '帳號切換', '可以登記好幾組帳號，切換時不用重新登入'],
    ['%', '用量看板', '看得到 5 小時、每天、每週還剩多少額度，以及什麼時候重置'],
    ['▣', '設定分開放', '每個帳號的設定各自存放，不會互相干擾'],
  ];
  items.forEach((it, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.5, 2.85, 2.5);
    circle(s, x + 0.25, 1.75, 0.6, C.teal, it[0], 18);
    txt(s, it[1], { x: x + 0.25, y: 2.5, w: 2.4, h: 0.4, fontSize: 17, bold: true, color: C.navy });
    txt(s, it[2], { x: x + 0.25, y: 2.95, w: 2.4, h: 0.95, fontSize: 13, color: C.mute });
  });
  txt(s, [B('參考價格（月費）'), T('　ChatGPT Plus $20 ／ Pro $100 或 $200')], { x: 0.5, y: 4.35, w: 9, h: 0.4, fontSize: 14 });
  footer(s, '價格來源：第三方價格整理（aipricing.guru、eesel.ai），OpenAI 說明頁未能直接取得');
}

// 5 vs Codex
{
  const s = pres.addSlide(); title(s, 'Orca 和 Codex 本身差在哪');
  table(s, [
    ['', 'Orca', 'Codex'],
    ['是什麼', '指揮台，管很多助手', 'OpenAI 自家的一個助手'],
    ['能用哪些助手', '34 種以上，可以同時跑', '只有 Codex'],
    ['同時做事會不會打架', '每個助手一個獨立資料夾', '只有一個工作區'],
    ['帳號', '可以放多組、不同廠商', '一個 ChatGPT 帳號'],
    ['在哪裡用', '電腦、手機、遠端主機', '終端機、桌面版、編輯器外掛、網頁'],
  ], { x: 0.5, y: 1.25, w: 9, colW: [2.4, 3.3, 3.3], fontSize: 14, rowH: 0.55 });
}

// 6 額度用完
{
  const s = pres.addSlide(); title(s, '額度用完時，現在怎麼辦', '沒有自動機制，要自己動手');
  const steps = ['打開帳號切換', '換一個還有額度的帳號', '開一段新對話', '用「接手對話」把內容帶過去'];
  steps.forEach((t, i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.5, 2.0, 1.3, i === 3 ? C.tealLt : C.soft);
    circle(s, x + 0.15, 1.65, 0.42, i === 3 ? C.teal : C.navy, String(i + 1), 14);
    txt(s, t, { x: x + 0.15, y: 2.15, w: 1.75, h: 0.6, fontSize: 13, bold: true, color: C.navy });
    if (i < 3) s.addText('→', { x: x + 2.0, y: 1.9, w: 0.3, h: 0.5, fontFace: F, fontSize: 18, color: C.mute, align: 'center', margin: 0, isTextBox: true });
  });
  card(s, 0.5, 3.15, 9, 0.85, C.coralLt);
  txt(s, [B('為什麼不能直接無縫換？', C.coral), T('換帳號只對「新開的對話」有效，正在跑的那段換不過去（官方已知問題 #19900，還沒解決）')], { x: 0.75, y: 3.27, w: 8.5, h: 0.65, fontSize: 13 });
  txt(s, '「接手對話」（Continue in New Session）目前只有電腦版有，手機版還在排隊（#19374）', { x: 0.5, y: 4.25, w: 9, h: 0.4, fontSize: 13, color: C.mute });
}

// 7 分工調度
{
  const s = pres.addSlide(); title(s, '分工調度（Orchestration）：一個主管帶一群工人');
  txt(s, '像專案經理派工：一個助手當主管，把大工作拆成工單發給其他助手；工人回報「哪張工單、第幾次派的」，主管對得上才算結案。', { x: 0.5, y: 0.95, w: 9, h: 0.6, fontSize: 13, color: C.mute });
  table(s, [
    ['官方用語', '白話'],
    ['Run', '專案資料夾＋主管信箱（只記錄，不派人）'],
    ['Task', '工單：做什麼、等誰、做到哪'],
    ['Dispatch', '這張工單「這一次」交給誰'],
    ['Message', '工人和主管之間的信'],
    ['Decision Gate', '主管還沒拍板的問題，相關工單先停'],
  ], { x: 0.5, y: 1.7, w: 5.3, colW: [1.5, 3.8], fontSize: 12, rowH: 0.42 });
  const flow = ['開專案', '開工單', '派工人', '主管收信', '工人回報完成'];
  flow.forEach((t, i) => {
    const y = 1.7 + i * 0.5;
    circle(s, 6.2, y, 0.36, i === 4 ? C.teal : C.navy, String(i + 1), 12);
    txt(s, t, { x: 6.7, y: y + 0.02, w: 2.8, h: 0.34, fontSize: 13, bold: true, color: C.navy, valign: 'middle' });
  });
  txt(s, bullets([
    '回報要同時對「工單」和「第幾次派」：重派過時，舊回報不會被誤當完成',
    '做完可讓工人收工，或先留著查問題；v1.4.218 起實驗中的聊天介面也能當主管',
  ]), { x: 0.5, y: 4.4, w: 9, h: 0.8, fontSize: 12, color: C.mute });
}

// 8 接手對話是什麼
{
  const s = pres.addSlide(); title(s, '「接手對話」是什麼', 'Continue in New Session：在助手視窗的選單點這個按鈕');
  txt(s, bullets([
    [B('另開一段新對話'), T('，可以換成別的助手（例如 Claude 換成 Codex）')],
    [B('自動整理前面聊過的重點'), T('，貼給新助手')],
    [B('原本那段對話不會被關掉')],
  ]), { x: 0.5, y: 1.45, w: 4.6, h: 2.2, fontSize: 15 });
  card(s, 5.4, 1.45, 4.1, 1.35, C.tealLt);
  txt(s, [B('精簡（預設）', C.teal), { text: '\n只帶最新進度和目前的檔案，需要時新助手才回頭翻舊對話', options: { color: C.ink } }], { x: 5.6, y: 1.58, w: 3.7, h: 1.15, fontSize: 13 });
  card(s, 5.4, 2.95, 4.1, 1.35);
  txt(s, [B('完整'), { text: '\n叫新助手把整段舊對話讀完，比較慢，也比較吃額度', options: { color: C.ink } }], { x: 5.6, y: 3.08, w: 3.7, h: 1.15, fontSize: 13 });
  txt(s, '要帶多少內容可以選 →', { x: 0.5, y: 3.9, w: 4.6, h: 0.4, fontSize: 13, color: C.mute });
}

// 9 對照
{
  const s = pres.addSlide(); title(s, '分工調度和「接手對話」差在哪');
  table(s, [
    ['', '接手對話', '分工調度'],
    ['一句話', '一件事換人接著做', '一個主管同時帶好幾個人分工'],
    ['交接什麼', '前面聊過的內容', '工單內容、進度、回報'],
    ['誰按下去', '你自己點選單', '主管助手自己下指令'],
    ['幾個助手', '一個換一個', '一個帶多個，同時做'],
    ['怎麼算做完', '沒有判定，貼完就交給新對話', '工人回報要對得上工單才算'],
    ['什麼時候用', '對話太長、想換助手、額度用完換帳號', '大任務拆給多個助手一起做'],
    ['目前限制', '只有電腦版；Codex 開啟時跳出自動更新會吃掉交接內容（#18153）', '一清空就全沒了，也不能跨電腦'],
  ], { x: 0.5, y: 1.0, w: 9, colW: [1.6, 3.7, 3.7], fontSize: 11.5, rowH: 0.42 });
  card(s, 0.5, 4.65, 9, 0.55, C.tealLt);
  txt(s, [B('重點：', C.teal), T('額度用完時派得上用場的是「接手對話」；分工調度解決的是「怎麼分工」，不是「額度用完怎麼續」')], { x: 0.7, y: 4.72, w: 8.6, h: 0.42, fontSize: 12.5, valign: 'middle' });
}

// 10 記憶
{
  const s = pres.addSlide(); title(s, '能取代記憶系統嗎？不能');
  card(s, 0.5, 1.1, 4.4, 1.2);
  txt(s, [B('Orca 管「現在」'), { text: '\n誰在做什麼。按一下清空就沒了，也不會跟著換電腦', options: { color: C.mute } }], { x: 0.7, y: 1.22, w: 4.0, h: 1.0, fontSize: 13 });
  card(s, 5.1, 1.1, 4.4, 1.2, C.tealLt);
  txt(s, [B('記憶系統管「以前」', C.teal), { text: '\n學到了什麼。存在 git，永久保存', options: { color: C.mute } }], { x: 5.3, y: 1.22, w: 4.0, h: 1.0, fontSize: 13 });
  txt(s, bullets([
    [T('Claude 的 CLAUDE.md、Codex 的 AGENTS.md，官方說 Orca「不碰，那是助手自己的」，只是方便你打開來改')],
    [B('auto-memory：'), T('Claude Code 會自動把學到的事記下來，但只存在本機，換電腦就沒了。'), B('我自己加了一步'), T('：每次對話結束自動複製到專案的 memory\\ 資料夾，跟著 git 一起備份（不是 Claude Code 內建功能）')],
  ]), { x: 0.5, y: 2.5, w: 9, h: 1.3, fontSize: 12.5 });
  table(s, [
    ['', 'Orca', 'llm-wiki＋auto-memory（現在用的）', 'ai-memory（另一套開源工具）'],
    ['能保存多久', '清空就沒了', '存在 git，永久', '存在 git，永久'],
    ['怎麼記下來', '手動下指令', 'Claude 自動記，我再自動複製進專案', '自動記錄對話與操作'],
  ], { x: 0.5, y: 3.95, w: 9, colW: [1.4, 1.6, 3.2, 2.8], fontSize: 11, rowH: 0.38 });
}

// 11 建議
{
  const s = pres.addSlide(); s.background = { color: C.navy };
  txt(s, '建議', { x: 0.5, y: 0.35, w: 9, h: 0.6, fontSize: 28, bold: true, color: 'FFFFFF' });
  const recs = [
    [C.teal, '✓', '想讓好幾個助手同時做、比較結果', '值得試'],
    [C.coral, '‖', '主要想解決額度用完自動接手', '先不要導入，等相關功能真的上線（追蹤清單見最後的備註）'],
    [C.ice, '↻', '記憶', '繼續用現在的作法；需要「跨電腦、全自動記錄」時才考慮加 ai-memory'],
  ];
  recs.forEach((r, i) => {
    const y = 1.25 + i * 1.25;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9, h: 1.05, rectRadius: 0.08, fill: { color: C.navy2 }, line: { color: C.navy2 } });
    circle(s, 0.75, y + 0.25, 0.55, r[0], r[1], 18);
    txt(s, r[2], { x: 1.6, y: y + 0.13, w: 7.7, h: 0.4, fontSize: 17, bold: true, color: 'FFFFFF' });
    txt(s, r[3], { x: 1.6, y: y + 0.55, w: 7.7, h: 0.4, fontSize: 13, color: C.ice });
  });
}

// 12 查證學到的
{
  const s = pres.addSlide(); title(s, '這次查證學到的', '第一次查時，看到 GitHub 有相關修改，就以為功能能用了——其實還沒合併');
  const st = [[C.line, C.ink, '有人提需求', 'issue'], [C.ice, C.navy, '有人送修改，還沒合併', 'open PR'], [C.teal, 'FFFFFF', '已經合併並正式發布', 'release']];
  st.forEach((x, i) => {
    const bx = 0.5 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: 1.7 + (2 - i) * 0.35, w: 2.85, h: 1.3 + i * 0.35, rectRadius: 0.08, fill: { color: x[0] }, line: { color: x[0] } });
    txt(s, x[2], { x: bx + 0.2, y: 1.85 + (2 - i) * 0.35, w: 2.45, h: 0.7, fontSize: 16, bold: true, color: x[1] });
    txt(s, x[3], { x: bx + 0.2, y: 2.6 + (2 - i) * 0.35 + i * 0.35, w: 2.45, h: 0.3, fontSize: 12, color: x[1] });
  });
  txt(s, '三者是三回事：要一個一個點進去看狀態，再對照正式版的更新紀錄，只有最右邊才代表「能用」', { x: 0.5, y: 4.25, w: 9, h: 0.6, fontSize: 14, color: C.ink });
}

// 13 備註
{
  const s = pres.addSlide(); title(s, '備註：還在開發中的功能', '狀態截至 2026-10-01');
  const R = { text: '還沒合併', options: { color: C.coral, bold: true } };
  table(s, [
    ['編號', '在做什麼', '狀態'],
    ['PR #21036', '額度用完先停住，恢復後自動繼續', { text: '還沒合併（09-26 還有更新）', options: { color: C.coral, bold: true } }],
    ['PR #8132', '同上，較早的版本', '已關閉、沒有合併（09-14）'],
    ['Issue #20512', '額度快用完時自動換帳號', { text: '還在討論，沒有人認領', options: { color: C.coral, bold: true } }],
    ['Issue #10137', 'Codex 換帳號時連同對話一起帶過去', { text: '還在討論，等官方回覆設計', options: { color: C.coral, bold: true } }],
    ['正式版 v1.4.207～218', '—', '只有用量顯示和接續對話的小修正，沒有自動換帳號'],
  ], { x: 0.5, y: 1.3, w: 9, colW: [2.1, 3.5, 3.4], fontSize: 12, rowH: 0.48 });
  txt(s, '#20512 的構想：用到 90% 就先換、挑剩最多額度的帳號、換過後隔一段時間才能再換，避免來回切', { x: 0.5, y: 4.45, w: 9, h: 0.5, fontSize: 12, color: C.mute });
}

// 14 附錄
{
  const s = pres.addSlide(); title(s, '附錄：2026-10-01 重新查證結果');
  table(s, [
    ['筆記原本的說法', '重查結果', '處置'],
    ['PR #21036 open', '仍是 open，最後更新 09-26', '維持'],
    ['PR #8132 closed 未合併', '屬實，09-14 關閉', '維持'],
    ['Issue #20512／#19900／#19374 open', '三個都還是 open，沒有指派人', '維持'],
    ['Release 查到 v1.4.206', '最新已到 v1.4.218（09-30）；逐版搜尋只有用量追蹤和 resume 修補', '更新'],
    ['支援 Gemini 等 20+ 種', 'README 列 34 種，沒有 Gemini CLI', '更正'],
    ['「沒有長期記憶」的官方原話', '官方文件找不到這句；reset 指令屬實', '降級：結論不變'],
    ['ChatGPT Plus $20、Pro $100～200', '第三方價格整理一致；OpenAI 頁未直接驗到', '二手來源'],
    ['PR #8132 關閉理由', '沒有重查', '推測，不引用'],
    ['接手對話的行為', '官方 codex.mdx＋原始碼：開新對話、原對話不動、精簡／完整兩種', '已查證'],
  ], { x: 0.5, y: 0.95, w: 9, colW: [3.0, 4.4, 1.6], fontSize: 9.5, rowH: 0.36 });
  footer(s, '來源：github.com/stablyai/orca（README、releases、PR、issue）、onorca.dev/docs（orchestration、hooks-memory）');
}

pres.writeFile({ fileName: OUT }).then(() => console.log('wrote', OUT));
