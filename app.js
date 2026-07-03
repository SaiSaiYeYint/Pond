const KEY = "once.grimm.pond.v3";
const OLD_KEY = "once.grimm.pond.v2";
const today = () => new Date().toISOString().slice(0, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);

const base = {
  coins: 120,
  trophies: 0,
  trophyVersion: 2,
  trophyLog: [],
  goals: [],
  dayCrosses: [],
  doneItems: [],
  fed: 0,
  unread: false,
  pendingDecision: null,
  lastPromptDate: "",
  workTime: false,
  feedback: [],
  notebook: [],
  codexTasks: [],
  ai: { mode: "local", endpoint: "", model: "local" },
  chat: [
    { role: "g", text: "I am Grimm. Log real proof, feed the pond, and do not try to impress me with vibes." }
  ],
  caseFile: {
    profile: {
      tone: "Sharp, playful honesty. Warm underneath. No fake praise.",
      loop: "User wants tiny daily actions judged without making the app feel like chores.",
      rewardRule: "Coins are for concrete action. Feeding costs coins. Fish rarely return coins."
    },
    evidence: [],
    theories: [{ statement: "User responds to small visible proof.", confidence: .62 }],
    adminRules: [
      "Do not remove day crosses.",
      "Do not remove trophies.",
      "Never award coins for vague chat.",
      "Do not mention fish feeding unless asked."
    ]
  }
};

const GRIMM_SYSTEM = `
You are Grimm, the AI character inside a pond app. Grimm is not the app name.
Voice: concise, dry, warm underneath, playful but not mean. No therapy-speak.
Job: judge logged actions, talk with the user, and build a hidden case study of patterns.
Rules:
- Reward concrete completed actions.
- Dock or deny coins for avoidance disguised as progress.
- Ask for a clear daily goal when none exists.
- Trophies are only for reaching today's stored goal, not for ordinary logs or fish feeding.
- Do not praise everything.
- Do not talk about fish feeding unless the user asks.
- Keep replies short enough for a speech bubble.
- Hidden case notes are private and should not be shown unless the user asks.
`;

const phone = $("phone");
const pondLayerEl = $("pondLayer");
const pageLayerEl = $("pageLayer");
const chatLayerEl = $("chatLayer");
const canvas = $("pondCanvas");
const ctx = canvas.getContext("2d");
const coinsEl = $("coins");
const doneList = $("doneList");
const weekEl = $("week");
const chatLog = $("chatLog");
const chat = $("chat");
const orb = $("orb");
const badge = $("badge");
const speech = $("speech");
const rewardToast = $("rewardToast");
const quickThread = $("quickThread");
const fedCount = $("fedCount");
const foodCount = $("foodCount");
const doneInput = $("doneInput");

const bgImage = new Image();
const fgImage = new Image();
const koiSprite = new Image();
const goldKoiSprite = new Image();
let bgReady = false;
let fgReady = false;
let koiSpriteReady = false;
let goldKoiSpriteReady = false;
bgImage.onload = () => bgReady = true;
fgImage.onload = () => fgReady = true;
koiSprite.onload = () => koiSpriteReady = true;
goldKoiSprite.onload = () => goldKoiSpriteReady = true;
bgImage.onerror = () => bgReady = false;
fgImage.onerror = () => fgReady = false;
koiSprite.onerror = () => koiSpriteReady = false;
goldKoiSprite.onerror = () => goldKoiSpriteReady = false;
bgImage.src = "assets/pond-background.png";
fgImage.src = "assets/pond-foreground.png";
koiSprite.src = "assets/koi-topdown-swim-v1.png";
goldKoiSprite.src = "assets/koi-gold-cartoon-swim-v1.png";

let state = load();
ensureAiDefaults();
let view = "home";
phone.classList.toggle("pondOnly", view === "pond");
let pondLayer;
let pageLayer;
let chatLayer;
let w = 0;
let h = 0;
let fish = [];
let pellets = [];
let ripples = [];
let glints = [];
let causticSeed = Math.random() * 999;
let pendingQuickUser = "";
let grimmTypingInChat = false;
const FOOD_TTL = 6500;
const FOOD_FADE = 1400;
const KOI_FRAME = 256;
const KOI_SWIM_FRAMES = [0, 1, 2, 3, 4, 3, 2, 1];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function spriteForKind(kind) {
  if (kind === "gold" && goldKoiSpriteReady) return goldKoiSprite;
  if (kind === "kohaku" && koiSpriteReady) return koiSprite;
  return null;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY));
    const hasGoalTrophyRules = saved?.trophyVersion === 2;
    const loaded = saved ? merge(structuredClone(base), saved) : structuredClone(base);
    if (!hasGoalTrophyRules) {
      loaded.trophyVersion = 2;
      loaded.trophyLog = [];
      loaded.trophies = 0;
    }
    loaded.goals ||= [];
    return loaded;
  } catch {
    return structuredClone(base);
  }
}

function merge(a, b) {
  for (const k of Object.keys(b || {})) {
    if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k]) a[k] = merge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function ensureAiDefaults() {
  state.ai ||= {};
  state.ai.endpoint = "";
  state.ai.model = "local";
  state.ai.mode = "local";
}

function resize() {
  const r = phone.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  w = Math.floor(r.width);
  h = Math.floor(r.height);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!fish.length) initPond();
}

function initPond() {
  fish = Array.from({ length: 7 }, (_, i) => new Koi(i));
  glints = Array.from({ length: 34 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: .45 + Math.random() * 1.3,
    s: .25 + Math.random() * .85,
    p: Math.random() * Math.PI * 2
  }));
}

class Koi {
  constructor(i) {
    this.x = Math.random() * (w + 360) - 180;
    this.y = Math.random() * (h + 360) - 180;
    this.a = Math.random() * Math.PI * 2;
    this.baseSpeed = .15 + Math.random() * .16;
    this.speed = this.baseSpeed;
    this.size = 14 + Math.random() * 8;
    this.phase = Math.random() * Math.PI * 2;
    this.turnEase = .006 + Math.random() * .006;
    this.curve = 0;
    this.side = Math.random() < .5 ? -1 : 1;
    this.targetPellet = null;
    this.interest = .42 + Math.random() * .45;
    this.tx = Math.random() * (w + 520) - 260;
    this.ty = Math.random() * (h + 520) - 260;
    this.kind = ["kohaku", "gold", "ink", "kohaku", "orange", "cream", "gold"][i % 7];
    if (this.kind === "gold") this.size *= .68;
    this.palette = {
      kohaku: { body: "#f0eadb", patch: "#c95a38", fin: "#decbb0", eye: "#26322d" },
      gold: { body: "#d6c17a", patch: "#fff0bb", fin: "#ead9a8", eye: "#1b2320" },
      ink: { body: "#283b34", patch: "#cf7445", fin: "#9ea99e", eye: "#111614" },
      orange: { body: "#d97846", patch: "#ead4b7", fin: "#dca98b", eye: "#111614" },
      cream: { body: "#f3ead7", patch: "#e0a83a", fin: "#f0d8b4", eye: "#1b2320" }
    }[this.kind];
  }

  update() {
    let target = this.targetPellet && !this.targetPellet.eaten ? this.targetPellet : null;
    if (!target) {
      let best = null;
      let dist = 230 * this.interest;
      for (const p of pellets) {
        if (!p.eaten && !p.claimed) {
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          if (d < dist) {
            dist = d;
            best = p;
          }
        }
      }
      if (best && Math.random() < .32) {
        target = best;
        target.claimed = true;
        this.targetPellet = target;
      }
    }

    const hunger = target ? clamp(1 - Math.hypot(target.x - this.x, target.y - this.y) / 260, .05, 1) : 0;
    this.phase += .06 + this.speed * .12 + hunger * .035;

    if (target) {
      const mouth = this.mouthPoint();
      const centerDist = Math.hypot(target.x - this.x, target.y - this.y);
      const mouthDist = Math.hypot(target.x - mouth.x, target.y - mouth.y);
      const close = centerDist < this.size * 2.4;
      this.turnToward(target.x, target.y, close ? .07 : .024 + hunger * .026);
      const desired = close ? .14 : this.baseSpeed + (.35 + hunger * .46);
      this.speed += (desired - this.speed) * (close ? .16 : .04);
      if (mouthDist < 15 || centerDist < this.size * .68) this.eat(target, mouth);
    } else {
      if (Math.random() < .004 || Math.hypot(this.tx - this.x, this.ty - this.y) < 60) {
        this.tx = Math.random() * (w + 520) - 260;
        this.ty = Math.random() * (h + 520) - 260;
        this.side *= -1;
      }
      const wanderX = this.tx + Math.sin(this.phase * .34) * 72 * this.side;
      const wanderY = this.ty + Math.cos(this.phase * .29) * 48;
      this.turnToward(wanderX, wanderY, this.turnEase);
      this.speed += (this.baseSpeed - this.speed) * .014;
    }

    this.a += Math.sin(this.phase) * .0028 + this.curve * .004;
    this.x += Math.cos(this.a) * this.speed;
    this.y += Math.sin(this.a) * this.speed;
    const m = 270;
    if (this.x < -m) this.x = w + m;
    if (this.x > w + m) this.x = -m;
    if (this.y < -m) this.y = h + m;
    if (this.y > h + m) this.y = -m;
  }

  eat(target, mouth) {
    target.eaten = true;
    this.targetPellet = null;
    state.fed += 1;
    if (Math.random() < .13) {
      coin(1, "Fish found a coin");
      floatText(mouth.x, mouth.y, "+1");
    }
    ripple(mouth.x, mouth.y, 62);
    render();
  }

  mouthPoint() {
    const reach = spriteForKind(this.kind) ? 2.38 : 1.95;
    return {
      x: this.x + Math.cos(this.a) * this.size * reach,
      y: this.y + Math.sin(this.a) * this.size * reach
    };
  }

  turnToward(x, y, power) {
    const wanted = Math.atan2(y - this.y, x - this.x);
    let diff = wanted - this.a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.a += diff * power;
    this.curve += (diff - this.curve) * .055;
  }

  draw() {
    const sprite = spriteForKind(this.kind);
    if (sprite) {
      this.drawSprite(sprite);
      return;
    }
    const s = this.size;
    const swim = Math.sin(this.phase);
    const wiggle = Math.sin(this.phase + .8);
    const tail = swim * s * .58;
    const c = clamp(this.curve * 2.4, -.65, .65);
    const p = this.palette;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.a);
    ctx.shadowColor = "rgba(0,0,0,.18)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 8;
    ctx.globalAlpha = .9;
    ctx.transform(1, c * .07, 0, 1, 0, 0);

    ctx.beginPath();
    ctx.moveTo(-s * 1.7, tail * .12);
    ctx.quadraticCurveTo(-s * 2.55, tail - s * .44, -s * 3.36, tail * 1.04);
    ctx.quadraticCurveTo(-s * 2.58, tail + s * .48, -s * 1.7, tail * .12);
    ctx.fillStyle = p.fin;
    ctx.globalAlpha = .52;
    ctx.fill();

    ctx.globalAlpha = .72;
    ctx.beginPath();
    ctx.ellipse(-s * .2, -s * .72, s * .68, s * .14, c * .25, 0, Math.PI * 2);
    ctx.ellipse(s * .38, s * .68, s * .52, s * .12, -.24 + wiggle * .06, 0, Math.PI * 2);
    ctx.fillStyle = p.fin;
    ctx.fill();

    ctx.globalAlpha = .96;
    ctx.beginPath();
    ctx.moveTo(s * 2.05, 0);
    ctx.bezierCurveTo(s * 1.26, -s * .68, -s * .52 + tail * .05, -s * .93, -s * 1.94, tail * .12);
    ctx.bezierCurveTo(-s * .62, s * .93, s * 1.18, s * .68, s * 2.05, 0);
    ctx.fillStyle = p.body;
    ctx.fill();

    ctx.globalAlpha = .9;
    ctx.fillStyle = p.patch;
    patch(s * .58, -s * .1, s * .7, s * .34, .18 + c * .12);
    patch(-s * .24, s * .18, s * .56, s * .24, -.2 + c * .16);
    patch(-s * .9, -s * .08, s * .42, s * .2, .08);

    ctx.globalAlpha = .9;
    ctx.beginPath();
    ctx.arc(s * 1.53, -s * .2, 1.65, 0, Math.PI * 2);
    ctx.fillStyle = p.eye;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 1.88, 0, 2.1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(10,20,18,.22)";
    ctx.lineWidth = .8;
    ctx.stroke();
    ctx.restore();

    function patch(x, y, rx, ry, rot) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSprite(sprite) {
    const s = this.size;
    const frame = KOI_SWIM_FRAMES[Math.floor(this.phase * 2.2) % KOI_SWIM_FRAMES.length];
    const sx = frame * KOI_FRAME;
    const sy = 0;
    const draw = s * 6.7;
    const squash = 1 + Math.sin(this.phase) * .018;
    const bend = clamp(this.curve * .16, -.08, .08);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.a);
    ctx.transform(1, bend, 0, squash, 0, 0);
    ctx.shadowColor = "rgba(0,0,0,.22)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 9;
    ctx.globalAlpha = .92;
    ctx.drawImage(sprite, sx, sy, KOI_FRAME, KOI_FRAME, -draw * .52, -draw * .5, draw, draw);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = .08;
    ctx.fillStyle = "#d9fff0";
    ctx.beginPath();
    ctx.ellipse(s * .28, -s * .26, s * 1.7, s * .46, -.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCoverImage(img) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawWater(t) {
  if (bgReady) {
    drawCoverImage(bgImage);
    ctx.fillStyle = "rgba(5,28,26,.16)";
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#0b4a43";
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(210,255,235,.24)";
  ctx.lineWidth = .72;
  for (let i = -5; i < 17; i++) {
    ctx.globalAlpha = .05 + (i % 3) * .025;
    ctx.beginPath();
    for (let x = -40; x < w + 40; x += 16) {
      const y = i * 54 + Math.sin((x + t * .018 + i * 37 + causticSeed) * .021) * 5 + Math.sin((x - t * .012) * .049) * 2;
      if (x === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (const g of glints) {
    const x = (g.x + t * .006 * g.s) % w;
    const y = (g.y + Math.sin(t * .001 + g.p) * 8 + h) % h;
    ctx.globalAlpha = .05 + Math.sin(t * .003 + g.p) * .03;
    ctx.beginPath();
    ctx.arc(x, y, g.r, 0, Math.PI * 2);
    ctx.fillStyle = "#eaffef";
    ctx.fill();
  }
  ctx.restore();
}

function loop(t) {
  ctx.clearRect(0, 0, w, h);
  drawWater(t);

  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i];
    const age = t - p.createdAt;
    if (p.eaten || age > FOOD_TTL) {
      if (p.claimedBy) p.claimedBy.targetPellet = null;
      pellets.splice(i, 1);
      continue;
    }
    const fade = clamp((FOOD_TTL - age) / FOOD_FADE, 0, 1);
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(190,135,72,.92)";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  fish.forEach(f => {
    f.update();
    f.draw();
  });

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.rad += r.speed;
    r.alpha = 1 - r.rad / r.max;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.rad, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(211,255,236," + (r.alpha * .24) + ")";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    if (r.alpha <= 0) ripples.splice(i, 1);
  }

  if (fgReady) drawCoverImage(fgImage);
  fedCount.textContent = state.fed;
  foodCount.textContent = pellets.length;
  requestAnimationFrame(loop);
}

function ripple(x, y, max = 78) {
  ripples.push({ x, y, rad: 2, max, alpha: 1, speed: 1.45 + Math.random() * .55 });
}

function dropFood(x, y) {
  if (state.coins < 1) {
    floatText(x, y, "0");
    return;
  }
  coin(-1, "Dropped fish food");
  const pellet = { x, y, eaten: false, claimed: false, claimedBy: null, createdAt: performance.now() };
  pellets.push(pellet);
  let nearest = null;
  let dist = 9999;
  for (const f of fish) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < dist) {
      dist = d;
      nearest = f;
    }
  }
  if (nearest) {
    nearest.targetPellet = pellet;
    pellet.claimed = true;
    pellet.claimedBy = nearest;
  }
  ripple(x, y);
  floatText(x, y, "-1");
  render();
}

function floatText(x, y, text) {
  const el = document.createElement("div");
  el.className = "float";
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  phone.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function coin(n, reason) {
  state.coins = Math.max(0, state.coins + n);
  state.caseFile.evidence.push({ type: "coin", statement: reason + " (" + (n >= 0 ? "+" : "") + n + ")", at: new Date().toISOString() });
}

function showReward(text) {
  if (!rewardToast) return;
  rewardToast.textContent = text;
  rewardToast.classList.remove("hidden");
  clearTimeout(showReward.timer);
  showReward.timer = setTimeout(() => rewardToast.classList.add("hidden"), 2200);
}

function awardTrophy(id, name) {
  state.trophyLog ||= [];
  if (state.trophyLog.some(t => t.id === id)) return false;
  state.trophyLog.push({ id, name, at: new Date().toISOString() });
  state.trophies = state.trophyLog.length;
  showReward("Trophy unlocked: " + name);
  return true;
}

function todayGoal() {
  return (state.goals || []).find(g => g.date === today()) || null;
}

function cleanGoalText(text) {
  return text
    .replace(/^today\s+goal\s*(is|:|-)?\s*/i, "")
    .replace(/^(my\s+)?(today'?s\s+)?goal\s*(is|:|-)?\s*/i, "")
    .replace(/^(i\s+want\s+to|i\s+need\s+to|i\s+must|today\s+i\s+will|i\s+will)\s+/i, "")
    .trim();
}

function detectGoal(text) {
  const l = text.toLowerCase().trim();
  const goalish = /\b(goal|target|aim|mission)\b/.test(l) || /^(today\s+i\s+will|i\s+will|i\s+need\s+to|i\s+must)\b/.test(l);
  if (!goalish) return "";
  const cleaned = cleanGoalText(text).replace(/\s+/g, " ");
  return cleaned.length >= 4 ? cleaned : "";
}

function setTodayGoal(text) {
  const existing = todayGoal();
  if (existing) {
    existing.text = text;
    existing.achieved = false;
    existing.achievedBy = "";
    existing.updatedAt = new Date().toISOString();
    return existing;
  }
  const goal = { id: crypto.randomUUID(), date: today(), text, achieved: false, achievedBy: "", at: new Date().toISOString() };
  state.goals.push(goal);
  return goal;
}

function keywords(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !["today", "done", "did", "the", "and", "for", "with", "that", "this", "goal", "will", "need", "must"].includes(w));
}

function reachesGoal(doneText, goal) {
  if (!goal || goal.achieved) return false;
  const done = keywords(doneText);
  const target = keywords(goal.text);
  if (!target.length) return false;
  const hits = target.filter(w => done.includes(w)).length;
  const strongDone = /\b(finished|completed|did|done|shipped|submitted|built|cleaned|fixed|went|walked|ran|studied|practiced|read|wrote)\b/i.test(doneText);
  return strongDone && hits >= Math.max(1, Math.ceil(Math.min(target.length, 4) * .45));
}

function awardGoalTrophy(goal, doneText) {
  goal.achieved = true;
  goal.achievedBy = doneText;
  goal.achievedAt = new Date().toISOString();
  return awardTrophy("goal-" + goal.date, "Goal Reached");
}

function render() {
  coinsEl.textContent = state.coins;
  $("trophies").textContent = state.trophies;
  $("greeting").textContent = greeting();
  phone.classList.toggle("workMode", Boolean(state.workTime));
  chatLayer?.sync();
  renderWeek();
  renderDone();
  renderChat();
  fedCount.textContent = state.fed;
  foodCount.textContent = pellets.length;
  updateBadge();
  save();
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

function renderWeek() {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const d = new Date();
  const start = new Date(d);
  const offset = (d.getDay() + 6) % 7;
  start.setDate(d.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  weekEl.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const iso = day.toISOString().slice(0, 10);
    const el = document.createElement("div");
    el.className = "day " + (state.dayCrosses.includes(iso) ? "done" : "");
    el.innerHTML = '<span class="dot">Ã—</span><span>' + labels[i] + '</span>';
    weekEl.appendChild(el);
  }
}

function renderDone() {
  const items = state.doneItems.filter(x => x.date === today()).slice().reverse();
  doneList.replaceChildren();
  if (!items.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = "No proof yet. Grimm is making a face.";
    doneList.appendChild(e);
    return;
  }
  for (const item of items) {
    const card = document.createElement("div");
    const line = document.createElement("div");
    const bonus = document.createElement("div");
    card.className = "doneCard";
    line.className = "doneLine";
    line.textContent = item.text;
    line.title = item.grimm + " - " + item.text;
    bonus.className = "bonus " + (item.coins < 0 ? "bad" : item.coins === 0 ? "zero" : "");
    bonus.textContent = (item.coins > 0 ? "+" : "") + item.coins;
    card.append(line, bonus);
    doneList.appendChild(card);
  }
}

function renderChat() {
  chatLog.replaceChildren();
  const messages = state.chat.slice(-80);
  messages.forEach((m, index) => {
    const b = document.createElement("div");
    b.className = "bubble " + m.role;
    b.textContent = m.text;
    chatLog.appendChild(b);
    if (m.role === "g" && state.pendingDecision?.messageAt === m.at) {
      chatLog.appendChild(decisionButtons());
    }
  });
  if (grimmTypingInChat) chatLog.appendChild(quickBubble("g", "", true));
  scrollChatToLatest();
}

function scrollChatToLatest() {
  if (!chatLog) return;
  chatLog.scrollTop = chatLog.scrollHeight;
}

function scheduleChatScroll() {
  requestAnimationFrame(scrollChatToLatest);
  setTimeout(scrollChatToLatest, 90);
}

function decisionButtons() {
  const row = document.createElement("div");
  row.className = "decisionRow";
  const yes = document.createElement("button");
  const no = document.createElement("button");
  yes.type = "button";
  no.type = "button";
  yes.textContent = "YES";
  no.textContent = "NO";
  yes.addEventListener("click", () => resolveDecision(true));
  no.addEventListener("click", () => resolveDecision(false));
  row.append(yes, no);
  return row;
}

function updateBadge() {
  const hasVisibleDecision = Boolean(state.pendingDecision?.messageAt);
  badge.style.display = hasVisibleDecision && !chat.classList.contains("open") ? "block" : "none";
}

function resolveDecision(accepted) {
  const decision = state.pendingDecision;
  state.pendingDecision = null;
  updateBadge();
  if (!decision) {
    render();
    return;
  }
  user(accepted ? "YES" : "NO");
  say(accepted ? "Approved. I will keep that task warm for Codex." : "Rejected. Tossed into the pond. Next problem?", false);
  render();
}

function quickBubble(role, text, typing = false) {
  const b = document.createElement("div");
  b.className = "quickBubble " + role + (typing ? " typing" : "");
  b.textContent = typing ? "" : text;
  if (!typing) b.title = text;
  return b;
}

function showQuickThread({ userText = "", grimmText = "", typing = false, hold = 13500 } = {}) {
  if (!quickThread) return;
  quickThread.classList.remove("leaving");
  quickThread.replaceChildren();
  if (userText) quickThread.appendChild(quickBubble("u", userText));
  const grimmLines = grimmSegments(grimmText).slice(-2);
  for (const line of grimmLines) quickThread.appendChild(quickBubble("g", line));
  if (typing) quickThread.appendChild(quickBubble("g", "", true));
  while (quickThread.children.length > 3) quickThread.firstElementChild.remove();
  if (!quickThread.children.length) return;
  quickThread.classList.remove("hidden");
  clearTimeout(showQuickThread.timer);
  showQuickThread.timer = setTimeout(() => {
    quickThread.classList.add("leaving");
    setTimeout(() => quickThread.classList.add("hidden"), 2300);
  }, hold);
}

function showTypingFor(text) {
  pendingQuickUser = text;
  showQuickThread({ userText: text, typing: true, hold: 30000 });
}

function latestGrimm() {
  const last = [...state.chat].reverse().find(m => m.role === "g");
  return last ? last.text : "Tap me. I have opinions.";
}

function say(text, renderNow = true) {
  const parts = grimmSegments(text);
  const messages = parts.map(part => ({ role: "g", text: part, at: new Date().toISOString() + "-" + Math.random().toString(36).slice(2, 6) }));
  state.chat.push(...messages);
  if (state.pendingDecision?.attachToNextReply) {
    state.pendingDecision.messageAt = messages[messages.length - 1]?.at;
    delete state.pendingDecision.attachToNextReply;
  }
  speech.textContent = text;
  const quickUser = pendingQuickUser;
  pendingQuickUser = "";
  showQuickThread({ userText: quickUser, grimmText: text });
  orb.classList.add("talk");
  clearTimeout(say.timer);
  clearTimeout(say.hideTimer);
  say.timer = setTimeout(() => orb.classList.remove("talk"), 700);
  if (!chat.classList.contains("open")) {
    state.unread = true;
    speech.classList.add("hidden");
    updateBadge();
    say.hideTimer = setTimeout(() => {
      speech.classList.add("hidden");
      updateBadge();
    }, 5600);
  } else {
    state.unread = false;
    updateBadge();
  }
  if (renderNow) render();
}

async function saySequential(text, renderNow = true) {
  const parts = grimmSegments(text);
  if (!parts.length) return;
  const quickUser = pendingQuickUser;
  pendingQuickUser = "";
  const delivered = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const message = { role: "g", text: part, at: new Date().toISOString() + "-" + Math.random().toString(36).slice(2, 6) };
    state.chat.push(message);
    delivered.push(part);
    if (i === parts.length - 1 && state.pendingDecision?.attachToNextReply) {
      state.pendingDecision.messageAt = message.at;
      delete state.pendingDecision.attachToNextReply;
    }
    speech.textContent = part;
    showQuickThread({ userText: quickUser, grimmText: delivered.join("\n"), hold: 30000 });
    orb.classList.add("talk");
    clearTimeout(say.timer);
    clearTimeout(say.hideTimer);
    say.timer = setTimeout(() => orb.classList.remove("talk"), 700);
    if (!chat.classList.contains("open")) {
      state.unread = true;
      speech.classList.add("hidden");
      updateBadge();
    } else {
      state.unread = false;
      updateBadge();
      renderChat();
      scheduleChatScroll();
    }
    if (i < parts.length - 1) {
      await wait(Math.min(900, 420 + part.length * 10));
      grimmTypingInChat = true;
      showQuickThread({ userText: quickUser, grimmText: delivered.join("\n"), typing: true, hold: 30000 });
      if (chat.classList.contains("open")) {
        renderChat();
        scheduleChatScroll();
      }
      await wait(620 + Math.min(700, parts[i + 1].length * 12));
      grimmTypingInChat = false;
      if (chat.classList.contains("open")) {
        renderChat();
        scheduleChatScroll();
      }
    }
  }

  say.hideTimer = setTimeout(() => {
    speech.classList.add("hidden");
    updateBadge();
  }, 9200);
  if (renderNow) render();
}

function grimmSegments(text) {
  const raw = String(text || "").trim();
  const clean = raw.replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  if (raw.includes("\n")) return raw.split(/\n+/).map(s => s.replace(/[ \t]+/g, " ").trim()).filter(Boolean).slice(0, 3);
  const questionIndex = clean.search(/(?:What|Why|How|Can|Should|Did|Do|Want|Which|When|Where)\b/i);
  if (questionIndex > 8 && questionIndex < clean.length - 8) {
    const first = clean.slice(0, questionIndex).trim();
    const second = clean.slice(questionIndex).trim();
    return [first, second].filter(Boolean).slice(0, 3);
  }
  const sentenceParts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [clean];
  if (sentenceParts.length >= 3) return [sentenceParts[0], sentenceParts.slice(1, -1).join(" "), sentenceParts.at(-1)].filter(Boolean).slice(0, 3);
  return sentenceParts.slice(0, 3);
}

async function answerWithGrimm(text, replyFactory) {
  showTypingFor(text);
  const started = performance.now();
  const reply = await replyFactory();
  const minDelay = 900 + Math.min(1200, reply.length * 18);
  const remaining = minDelay - (performance.now() - started);
  if (remaining > 0) await wait(remaining);
  await saySequential(reply, false);
}

function user(text) {
  state.chat.push({ role: "u", text, at: new Date().toISOString() });
  scheduleChatScroll();
}

function buildCaseStudy() {
  return {
    profile: state.caseFile.profile,
    theories: state.caseFile.theories.slice(-8),
    recentEvidence: state.caseFile.evidence.slice(-20),
    todayDone: state.doneItems.filter(x => x.date === today()).slice(-8),
    todayGoal: todayGoal(),
    feedback: (state.feedback || []).slice(-10),
    notebook: (state.notebook || []).slice(-10),
    codexTasks: (state.codexTasks || []).slice(-10),
    workTime: state.workTime,
    coins: state.coins,
    trophies: state.trophies
  };
}

function applyAiStructured(ai, sourceText = "") {
  if (!ai || typeof ai !== "object") return;
  const at = new Date().toISOString();
  if (ai.theory) addTheory(String(ai.theory), .58);
  if (ai.memoryUpdate && Object.keys(ai.memoryUpdate).length) {
    state.caseFile.evidence.push({
      type: "memory-update",
      statement: JSON.stringify(ai.memoryUpdate).slice(0, 220),
      at
    });
  }
  if (ai.feedbackUpdate) {
    const item = {
      id: crypto.randomUUID(),
      original: sourceText,
      summary: String(ai.feedbackUpdate.summary || sourceText),
      category: String(ai.feedbackUpdate.category || "other"),
      frequency: Number(ai.feedbackUpdate.frequency || 1),
      status: String(ai.feedbackUpdate.status || "new"),
      createdAt: at,
      updatedAt: at
    };
    state.feedback ||= [];
    state.feedback.push(item);
  }
  if (ai.notebookUpdate) {
    const entry = {
      id: crypto.randomUUID(),
      text: String(ai.notebookUpdate.text || ai.notebookUpdate),
      basis: String(ai.notebookUpdate.basis || sourceText),
      tags: Array.isArray(ai.notebookUpdate.tags) ? ai.notebookUpdate.tags : [],
      visibility: String(ai.notebookUpdate.visibility || "private"),
      createdAt: at
    };
    state.notebook ||= [];
    state.notebook.push(entry);
  }
  if (ai.codexTask) {
    state.codexTasks ||= [];
    state.codexTasks.push({ id: crypto.randomUUID(), text: String(ai.codexTask), status: "draft", createdAt: at });
    state.caseFile.evidence.push({ type: "codex-task", statement: String(ai.codexTask), at });
    state.pendingDecision = {
      type: "codexTask",
      text: String(ai.codexTask),
      createdAt: at,
      attachToNextReply: true
    };
  }
  if (ai.goalUpdate) {
    const goalText = typeof ai.goalUpdate === "string" ? ai.goalUpdate : ai.goalUpdate.text;
    if (goalText) setTodayGoal(goalText);
  }
  if (ai.mode === "workshop") {
    state.workTime = true;
    if (!ai.codexTask) state.pendingDecision = null;
  }
  if ((ai.mode === "normal" && state.workTime && /work done/i.test(sourceText)) || /simon says work done/i.test(sourceText)) {
    state.workTime = false;
    state.pendingDecision = null;
  }
}

async function judgeActivity(text) {
  return localJudge(text);
}

function localJudge(text) {
  const l = text.toLowerCase();
  const actionWords = ["i ", "clean", "cleaned", "finish", "finished", "called", "fixed", "wrote", "studied", "worked", "worked out", "shipped", "submitted", "apologized", "built", "completed", "made", "cooked", "washed", "organized", "paid", "sent", "emailed", "walked", "ran", "read", "practiced", "learned", "helped", "bought", "scheduled", "repaired", "meditated", "journaled", "ate", "drank"];
  const vagueWords = ["what", "why", "hello", "hi", "test", "lol", "maybe", "idk", "nothing", "stuff", "things", "something", "random"];
  const weak = ["watched", "scroll", "youtube", "tiktok", "thought about", "read about", "researched", "opened tabs", "checked socials"];
  const fake = ["planned to", "wanted to", "was going to", "almost", "considered", "looked at"];
  const strong = ["finish", "finished", "clean", "cleaned", "called", "fixed", "wrote", "studied", "worked out", "shipped", "submitted", "apologized", "built", "completed", "sent", "cooked", "repaired"];
  const hard = ["finally", "hard", "avoided", "scared", "honestly", "difficult", "uncomfortable", "late", "failed but", "tried again"];
  let valid = actionWords.some(w => l.includes(w)) && !vagueWords.includes(l);
  if (text.length < 5 || vagueWords.some(w => l === w)) valid = false;
  if (!valid) return { valid: false, score: 0, grimm: "That is not a done item. Type an actual thing you did.", theory: "User tests the boundary between chat and proof." };

  let score = 2;
  if (strong.some(w => l.includes(w))) score += 12;
  if (hard.some(w => l.includes(w))) score += 8;
  if (text.length > 70) score += 4;
  if (weak.some(w => l.includes(w))) score -= 10;
  if (fake.some(w => l.includes(w))) score -= 12;
  if (l.includes("youtube") || l.includes("scroll") || l.includes("tiktok")) score -= 8;
  if (state.doneItems.filter(x => x.date === today()).length >= 5) score -= 2;
  score = clamp(score, -24, 44);
  if (score < 1 && !weak.some(w => l.includes(w)) && !fake.some(w => l.includes(w))) score = 1;

  let grimm = "Logged. Barely escaped the trash pile.";
  if (score < 0) grimm = "Counts, but I am docking coins.";
  else if (score === 0) grimm = "Counts. No coins. Suspiciously small.";
  else if (l.includes("clean")) grimm = "The dust kingdom has fallen.";
  else if (l.includes("called")) grimm = "Human contact. Suspiciously brave.";
  else if (score >= 24) grimm = "Actual effort detected.";
  else if (score >= 8) grimm = "Useful enough. I allow it.";
  return { valid: true, score, grimm, theory: score < 0 ? "Avoidance may be presented as progress." : "Concrete proof increases follow-through." };
}

async function grimmReply(text) {
  if (isLocalCommand(text)) return localReply(text);
  return localReply(text);
}

async function simonReply(text) {
  const admin = handleSimonCommand(text);
  return admin.reply + (admin.codexTask ? " Codex task: " + admin.codexTask : "");
}

function ensureQuestion(reply, text = "") {
  if (/[?ï¼Ÿ]\s*$/.test(reply)) return reply;
  const prompts = [
    "What is the next tiny proof?",
    "What did that cost you?",
    "What are you avoiding next?",
    "Can you make the next one smaller?",
    "What is one real thing after this?"
  ];
  const pick = Math.abs([...text].reduce((n, ch) => n + ch.charCodeAt(0), 0)) % prompts.length;
  return reply + " " + prompts[pick];
}

function talkativeJudgeReply(j) {
  const score = (j.score > 0 ? "+" : "") + j.score;
  if (j.score < 0) return j.grimm + "\n" + score + " coins.\n" + ensureQuestion("What is the next honest proof?", "bad");
  if (j.score === 0) return j.grimm + "\nNo coins.\n" + ensureQuestion("Can you make the next one sharper?", "zero");
  return j.grimm + "\n" + score + " coins.\n" + ensureQuestion("What is the next tiny proof?", "good");
}

function goalSetReply(goal) {
  return "Goal locked: " + goal.text + ".\nBring proof and I will hand over a trophy.\nWhat is the first move?";
}

function judgedGoalReply(j, goalReached) {
  if (goalReached) {
    return j.grimm + "\n" + (j.score > 0 ? "+" : "") + j.score + " coins. Goal reached.\nTrophy earned. What goal is next?";
  }
  const goal = todayGoal();
  if (goal && !goal.achieved) {
    return j.grimm + "\n" + (j.score > 0 ? "+" : "") + j.score + " coins.\n" + ensureQuestion("Not the goal yet.", goal.text);
  }
  return talkativeJudgeReply(j);
}

function isSimonCommand(text) {
  return text.toLowerCase().trim().startsWith("simon says");
}

function cleanCodexTask(command) {
  const raw = command.replace(/^simon says\s*/i, "").trim();
  if (!raw) return "Review the Grimm project and propose the next smallest useful implementation task.";
  if (/^make\b/i.test(raw)) return "Create " + raw.replace(/^make\s+/i, "").trim() + ".";
  if (/^add\b/i.test(raw)) return "Add " + raw.replace(/^add\s+/i, "").trim() + ".";
  if (/^fix\b/i.test(raw)) return "Fix " + raw.replace(/^fix\s+/i, "").trim() + ".";
  return raw.charAt(0).toUpperCase() + raw.slice(1) + ".";
}

function handleSimonCommand(text) {
  const l = text.toLowerCase().trim();
  if (l === "simon says work time") {
    state.workTime = true;
    state.pendingDecision = null;
    return {
      reply: "Workshop open. Normal coins are dead in here. What problem are we dissecting first?",
      codexTask: null
    };
  }
  if (l === "simon says work done") {
    state.workTime = false;
    state.pendingDecision = null;
    return {
      reply: "Workshop closed. I am going back under the pond. Try to behave.",
      codexTask: null
    };
  }
  const codexTask = cleanCodexTask(text);
  const task = { id: crypto.randomUUID(), text: codexTask, status: "draft", createdAt: new Date().toISOString() };
  state.codexTasks ||= [];
  state.codexTasks.push(task);
  state.caseFile.evidence.push({ type: "codex-task", statement: codexTask, at: task.createdAt });
  state.pendingDecision = {
    type: "codexTask",
    text: codexTask,
    createdAt: task.createdAt,
    attachToNextReply: true
  };
  return {
    reply: "Fine. I wrote the task. Try not to ruin it.",
    codexTask
  };
}

function detectFeedback(text) {
  return /\b(i wish|it would be cool if|you should add|can you add|please add|would be nice if)\b/i.test(text);
}

function saveFeedback(text) {
  state.feedback ||= [];
  const summary = text.replace(/\s+/g, " ").trim();
  const category = /fish|koi|pond/i.test(text) ? "fish" : /coin|trophy|reward/i.test(text) ? "rewards" : /chat|grimm|memory/i.test(text) ? "grimm" : "other";
  const existing = state.feedback.find(f => f.summary.toLowerCase() === summary.toLowerCase());
  if (existing) {
    existing.frequency += 1;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }
  const item = { id: crypto.randomUUID(), original: text, summary, category, frequency: 1, status: "new", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.feedback.push(item);
  return item;
}

function isLocalCommand(text) {
  const l = text.toLowerCase();
  return l === "case report" || l === "case file" || l === "case reset";
}

function isConversationText(text) {
  const l = text.toLowerCase().trim();
  return l.endsWith("?") || ["hi", "hello", "hey", "yo", "sup", "wassup", "grimm", "good morning", "good afternoon", "good evening"].includes(l) || l.startsWith("hello ") || l.startsWith("hi ") || l.startsWith("hey ") || l.startsWith("grimm ") || l.startsWith("can you ") || l.startsWith("what ") || l.startsWith("why ") || l.startsWith("how ");
}

async function localReply(text) {
  const l = text.toLowerCase();
  if (/\b(hi|hello|hey|yo|good morning|good afternoon|good evening|sup|wassup)\b/i.test(text)) {
    const lines = [
      "Hello. I was watching the pond pretend it has secrets. What did you do today?",
      "You found me. Tragic for both of us. What proof are you bringing?",
      "Mm. Hello. I am awake enough to judge one useful thing.",
      "Good, you are here. Name one thing worth logging before your motivation evaporates.",
      "Hi. I have been under the pond, developing opinions. What happened today?"
    ];
    const pick = Math.abs([...text].reduce((n, ch) => n + ch.charCodeAt(0), 0)) % lines.length;
    return lines[pick];
  }
  if (l === "case report" || l === "case file") return caseReport();
  if (l === "case reset") {
    state.caseFile.evidence = [];
    state.caseFile.theories = [{ statement: "User responds to small visible proof.", confidence: .62 }];
    return "Case file wiped. Suspiciously clean. I hate it.";
  }
  if (l.includes("goal")) {
    const goal = todayGoal();
    if (!goal) return "No trophy goal yet. Name one thing worth finishing today?";
    return goal.achieved
      ? "Today's goal is done: " + goal.text + ". Want to set another one?"
      : "Today's trophy goal: " + goal.text + ". What proof will finish it?";
  }
  if (l.includes("case")) return "Say `case report` if you want the quiet evidence drawer opened. What pattern should I watch?";
  if (l.includes("fish")) return "The pond is for feeding only here. One coin per food. Which fish deserves it?";
  if (l.includes("promise")) {
    state.caseFile.evidence.push({ type: "promise", statement: text, at: new Date().toISOString() });
    addTheory("Promises should be converted into logged proof quickly.", .64);
    return "Promise logged. Dangerous little sentence. When will it become evidence?";
  }
  return "Noted. Now bring me proof. What did you actually do?";
}

function caseReport() {
  const theories = state.caseFile.theories
    .slice(-3)
    .map(t => t.statement)
    .join(" | ") || "No theories yet.";
  const todayCount = state.doneItems.filter(x => x.date === today()).length;
  const recent = state.caseFile.evidence.slice(-1)[0]?.statement || "No evidence yet.";
  return "Case file: " + todayCount + " proof today. Theory: " + theories + " Latest: " + recent;
}

function addTheory(statement, confidence = .58) {
  const found = state.caseFile.theories.find(t => t.statement === statement);
  if (found) found.confidence = clamp(found.confidence + .05, 0, .96);
  else state.caseFile.theories.push({ statement, confidence });
}

function recordTheory(text, result) {
  if (result.theory) addTheory(result.theory, result.score > 20 ? .72 : .6);
  else addTheory(result.score < 0 ? "User may disguise avoidance as progress." : "User responds to small visible proof.", result.score > 20 ? .72 : .6);
  state.caseFile.evidence.push({ type: "done", statement: text, score: result.score, at: new Date().toISOString() });
}

$("doneForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (form.dataset.busy === "true") return;
  const text = $("doneInput").value.trim().replace(/\s+/g, " ");
  if (!text) return;
  form.dataset.busy = "true";
  form.classList.add("thinking");
  $("doneInput").value = "";
  user(text);
  render();

  try {
    if (isSimonCommand(text)) {
      await answerWithGrimm(text, () => simonReply(text));
      render();
      return;
    }

    if (detectFeedback(text)) {
      saveFeedback(text);
      await answerWithGrimm(text, () => grimmReply(text));
      render();
      return;
    }

    const detectedGoal = detectGoal(text);
    if (detectedGoal) {
      const goal = setTodayGoal(detectedGoal);
      state.caseFile.evidence.push({ type: "goal", statement: detectedGoal, at: new Date().toISOString() });
      await answerWithGrimm(text, () => Promise.resolve(goalSetReply(goal)));
      render();
      return;
    }

    if (isLocalCommand(text) || isConversationText(text)) {
      await answerWithGrimm(text, () => grimmReply(text));
      render();
      return;
    }

    const j = await judgeActivity(text);
    if (!j.valid) {
      await answerWithGrimm(text, () => grimmReply(text));
      render();
      return;
    }
    coin(j.score, "Done item: " + text);
    state.doneItems.push({ id: crypto.randomUUID(), date: today(), text, coins: j.score, grimm: j.grimm, at: new Date().toISOString() });
    if (!state.dayCrosses.includes(today())) state.dayCrosses.push(today());
    recordTheory(text, j);
    const goal = todayGoal();
    const goalReached = reachesGoal(text, goal);
    if (goalReached) awardGoalTrophy(goal, text);
    await answerWithGrimm(text, () => Promise.resolve(judgedGoalReply(j, goalReached)));
    render();
  } finally {
    form.dataset.busy = "false";
    form.classList.remove("thinking");
  }
});

const chatForm = $("chatForm");
if (chatForm) {
  chatForm.addEventListener("submit", async e => {
    e.preventDefault();
    const raw = $("chatInput").value.trim().replace(/\s+/g, " ");
    if (!raw) return;
    $("chatInput").value = "";
    user(raw);
    render();
    await answerWithGrimm(raw, () => grimmReply(raw));
    render();
  });
}

function syncView() {
  const isPond = view === "pond";
  phone.classList.toggle("pondOnly", isPond);
  $("home").classList.toggle("hidden", isPond);
  $("pondScreen").classList.toggle("hidden", !isPond);
  $("switchBtn").textContent = isPond ? "Home" : "Pond";
}

$("switchBtn").addEventListener("click", () => {
  view = view === "home" ? "pond" : "home";
  syncView();
  chatLayer?.close();
});

pondLayerEl.addEventListener("click", e => {
  if (view !== "pond" || chatLayer?.state !== "minimized") return;
  pondLayer?.feed(e.clientX, e.clientY);
});

class PondLayer {
  constructor(el) {
    this.el = el;
  }

  feed(clientX, clientY) {
    const r = phone.getBoundingClientRect();
    dropFood(clientX - r.left, clientY - r.top);
  }
}

class PageLayer {
  constructor(el) {
    this.el = el;
  }

  setHidden(hidden) {
    this.el.toggleAttribute("aria-hidden", hidden);
  }
}

class ChatLayer {
  constructor(el) {
    this.el = el;
    this.state = "minimized";
    this.beforeKeyboardState = "minimized";
    this.keyboardLift = 0;
    this.inputFocused = false;
    this.sync();
  }

  setState(next) {
    if (next === "keyboard" && this.state !== "keyboard") {
      this.beforeKeyboardState = this.state === "maximized" ? "maximized" : "minimized";
    }
    if (this.state === "keyboard" && next !== "keyboard") next = this.beforeKeyboardState;
    this.state = next;
    this.sync();
  }

  open() {
    this.setState("maximized");
  }

  close() {
    this.setState("minimized");
  }

  toggle() {
    this.state === "maximized" ? this.close() : this.open();
  }

  setKeyboardLift(lift) {
    this.keyboardLift = lift;
    this.el.style.setProperty("--keyboard-lift", lift + "px");
    if (this.inputFocused) this.setState("keyboard");
    else if (this.state === "keyboard") this.setState(this.beforeKeyboardState);
  }

  setInputFocused(focused) {
    this.inputFocused = focused;
    if (focused) {
      this.setState("keyboard");
      settleChatScroll();
    }
    if (!focused && this.state === "keyboard") this.setState(this.beforeKeyboardState);
  }

  sync() {
    const isKeyboard = this.state === "keyboard";
    const isMax = this.state === "maximized" || (isKeyboard && this.beforeKeyboardState === "maximized");
    phone.dataset.chatState = isKeyboard ? "keyboard" : this.state;
    if (isKeyboard) phone.dataset.beforeChatState = this.beforeKeyboardState;
    else delete phone.dataset.beforeChatState;
    pageLayer?.setHidden(isMax);
    chat.classList.toggle("open", isMax || isKeyboard);
    speech.classList.add("hidden");
    if (this.state === "minimized") speech.textContent = latestGrimm();
    if (isMax || isKeyboard) {
      quickThread?.classList.add("hidden");
      state.unread = false;
      renderChat();
      save();
    }
    updateBadge();
  }
}

function openChat() {
  chatLayer.open();
}

function closeChat() {
  chatLayer.close();
}

function toggleChat() {
  chatLayer.toggle();
}

function pinViewport() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

function pinViewportDuringKeyboard() {
  pinViewport();
  let frames = 0;
  const tick = () => {
    pinViewport();
    frames += 1;
    if (frames < 24 && chatLayer?.state === "keyboard") requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function settleChatScroll() {
  let frames = 0;
  const tick = () => {
    scrollChatToLatest();
    frames += 1;
    if (frames < 18 && chatLayer?.state === "keyboard") requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(scrollChatToLatest, 120);
  setTimeout(scrollChatToLatest, 280);
}

function promptForProof() {
  if (state.lastPromptDate === today()) return;
  state.lastPromptDate = today();
  setTimeout(() => {
    const goal = todayGoal();
    if (!goal) say("What is today's goal worth a trophy?", false);
    else if (!goal.achieved) say("Today's goal is " + goal.text + ". What proof will finish it?", false);
    render();
  }, 700);
}

pondLayer = new PondLayer(pondLayerEl);
pageLayer = new PageLayer(pageLayerEl);
chatLayer = new ChatLayer(chatLayerEl);

orb.addEventListener("click", toggleChat);
speech.addEventListener("click", toggleChat);
doneInput.addEventListener("touchstart", e => {
  e.preventDefault();
  chatLayer.setInputFocused(true);
  doneInput.focus({ preventScroll: true });
  pinViewportDuringKeyboard();
}, { passive: false });
doneInput.addEventListener("focus", () => {
  chatLayer.setInputFocused(true);
  pinViewportDuringKeyboard();
});
doneInput.addEventListener("blur", () => setTimeout(() => chatLayer.setInputFocused(false), 80));
document.addEventListener("touchmove", e => {
  if (chatLayer?.state === "keyboard" && !e.target.closest(".log")) e.preventDefault();
}, { passive: false });
window.addEventListener("scroll", () => {
  if (chatLayer?.state === "keyboard") pinViewport();
}, { passive: false });
window.addEventListener("resize", resize);
if (window.visualViewport) {
  const liftForKeyboard = () => {
    const lift = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    chatLayer.setKeyboardLift(lift);
    if (chatLayer.state === "keyboard") {
      pinViewport();
      settleChatScroll();
    }
  };
  window.visualViewport.addEventListener("resize", liftForKeyboard);
  window.visualViewport.addEventListener("scroll", liftForKeyboard);
  liftForKeyboard();
}
resize();
speech.textContent = latestGrimm();
speech.classList.add("hidden");
updateBadge();
render();
promptForProof();
requestAnimationFrame(loop);



