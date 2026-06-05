const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "rpg_card_v8_state"; // ficha única antiga (mantida como backup)
const PHOTO_DB_NAME = "rpg_card_v6_db";
const PHOTO_STORE = "assets";
const PHOTO_KEY = "character_photo"; // chave da foto antiga (única) — base do nome por ficha

// Multi-fichas (v9)
const INDEX_KEY = "rpg_card_v9_index";
const CHAR_PREFIX = "rpg_card_v9_character_";

const SAVE_DELAY = 180;
const STATUS_KEYS = ["for", "des", "con", "int", "sab", "car", "adp", "res"];
const STATUS_LABELS = ["FOR", "DES", "CON", "INT", "SAB", "CAR", "ADP", "RES"];

const MANUAL_CALC_FIELD_IDS = [
  "in_hp_max",
  "in_pm_max",
  "in_hpp_max",
  "in_ca",
  "in_xp_next",
  "in_xp_left",
  "hit_magic",
  "hit_phys_for",
  "hit_phys_des",
  "hit_ench_for",
  "hit_ench_des",
];

const SIGNED_MANUAL_CALC_FIELDS = new Set([
  "hit_magic",
  "hit_phys_for",
  "hit_phys_des",
  "hit_ench_for",
  "hit_ench_des",
]);

// Limites do sistema (level 1-60, PI 0-10, arma/catalisador 0-20).
const MAX_LEVEL = 60;
const MAX_PI = 10;
const MAX_WEAPON_LEVEL = 20;

// Campos com faixa fixa: corrigidos para dentro do limite ao sair do campo (blur).
const MAX_CATALYST_LEVEL = 20;

const CLAMPED_FIELD_RANGES = {
  in_nv: [1, MAX_LEVEL],
  in_pi: [0, MAX_PI],
  in_weapon_level: [0, MAX_WEAPON_LEVEL],
  in_catalyst_level: [0, MAX_CATALYST_LEVEL],
};

const EDITABLE_FIELD_IDS = [
  "in_idade",
  "in_altura",
  "in_raca",
  "in_classe",
  "in_nv",
  "in_xp",
  "in_hp_cur",
  "in_pm_cur",
  "in_hpp_cur",
  "in_pi",
  "in_ca_bonus",
  "in_weapon_level",
  "in_catalyst_level",
  "in_catalyst_xp",
];

const defaults = {
  v: 8,
  name: "",
  guild: "",
  activeTab: "summary",
  glyphTop: "",
  glyphBottom: "",
  fields: {
    idade: "",
    altura: "",
    raca: "",
    classe: "",
    nv: "1",
    xp: "0",
    hpCur: "",
    pmCur: "",
    hppCur: "",
    pi: "",
    caBonus: "0",
    weaponLevel: "",
  },
  stats: {
    for: "",
    des: "",
    con: "",
    int: "",
    sab: "",
    car: "",
    adp: "",
    res: "",
  },
  progression: {
    conModsByLevel: [0],
    intModsByLevel: [0],
    resModsByLevel: [0],
  },
  calcOverrides: {
    enabled: false,
    deltas: {},
  },
  calcAdjustments: {},
  leveling: {
    pendingLevelPoints: 0,
    pendingPb: 0,
    lastProcessedLevel: 1,
  },
  catalyst: {
    level: "0",
    xp: "0",
    attributes: [],
  },
  runes: {
    phys: 70,
    arc: 55,
    spi: 80,
  },
  notes: {
    story: "",
    personality: "",
    appearance: "",
    goals: "",
    npcs: "",
    quests: "",
    inv: "",
    skills: "",
    magicSimple: "",
    magicComplex: "",
    magicAdvanced: "",
    diary: "",
    free: "",
  },
};

function getPersistentCalcAdjustment(id) {
  return toInt(calcAdjustmentState?.[id], 0);
}

function applyPersistentCalcAdjustments() {
  for (const id of MANUAL_CALC_FIELD_IDS) {
    const el = $(id);
    if (!el) continue;

    const base = toInt(currentBaseCalcValues[id], 0);
    const persistent = getPersistentCalcAdjustment(id);
    el.value = getCalcFieldDisplayValue(id, base + persistent);
  }
}

function commitManualOverridesToPersistentAdjustments() {
  const next = { ...(calcAdjustmentState || {}) };

  for (const id of MANUAL_CALC_FIELD_IDS) {
    const persistent = toInt(next[id], 0);
    const manualDelta = toInt(calcOverrideState?.deltas?.[id], 0);
    next[id] = persistent + manualDelta;
  }

  calcAdjustmentState = next;
  calcOverrideState.deltas = {};
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInt(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatSigned(value) {
  const n = toInt(value, 0);
  return n >= 0 ? `+${n}` : String(n);
}

function hasCalcModules() {
  return Boolean(
    window.RaceDB &&
      typeof window.RaceDB.findRace === "function" &&
      window.CharacterCalc &&
      typeof window.CharacterCalc.calculate === "function"
  );
}

const inpName = $("inpName");
const inpGuild = $("inpGuild");

const inHpCur = $("in_hp_cur");
const inPmCur = $("in_pm_cur");
const inHppCur = $("in_hpp_cur");

const outNv = $("outNv");
const outXp = $("outXp");
const outHp = $("outHp");
const outPm = $("outPm");
const outHpp = $("outHpp");
const outCa = $("outCa");
const outPi = $("outPi");
const outPb = $("outPb");
const outWeapon = $("outWeapon");
const outIdade = $("outIdade");
const outAltura = $("outAltura");
const outRaca = $("outRaca");
const outClasse = $("outClasse");
const outXpNext = $("outXpNext");
const outXpLeft = $("outXpLeft");

const inpPhoto = $("inpPhoto");
const btnRemovePhoto = $("btnRemovePhoto");
const photoImg = $("charPhoto");
const photoPlaceholder = $("photoPlaceholder");

const noteStory = $("note_story");
const notePersonality = $("note_personality");
const noteAppearance = $("note_appearance");
const noteGoals = $("note_goals");
const noteNpcs = $("note_npcs");
const noteQuests = $("note_quests");
const noteInv = $("note_inv");
const noteSkills = $("note_skills");
const noteMagicSimple = $("note_magic_simple");
const noteMagicComplex = $("note_magic_complex");
const noteMagicAdvanced = $("note_magic_advanced");
const noteDiary = $("note_diary");
const noteFree = $("note_free");

const rPhys = $("r_phys");
const rArc = $("r_arc");
const rSpi = $("r_spi");
const nPhys = $("n_phys");
const nArc = $("n_arc");
const nSpi = $("n_spi");

const canvas = $("radar");
const ctx = canvas ? canvas.getContext("2d") : null;
const radarWrap = canvas?.closest(".radarWrap") || null;
const radarTip = document.createElement("div");

const levelUpModal = $("levelUpModal");
const lvlUsePb = $("lvlUsePb");
const lvlPointsLeft = $("lvlPointsLeft");
const lvlPbLeft = $("lvlPbLeft");
const lvlSelectedCount = $("lvlSelectedCount");
const lvlPbSelectedCount = $("lvlPbSelectedCount");
const lvlPbAllocatorWrap = $("lvlPbAllocatorWrap");
const lvlPbToStats = $("lvlPbToStats");
const lvlPbMinus = $("lvlPbMinus");
const lvlPbPlus = $("lvlPbPlus");
const btnApplyLevelUp = $("btnApplyLevelUp");
const levelUpChecklist = $("levelUpChecklist");

const btnToggleCalcOverride = $("btnToggleCalcOverride");
const calcModeChip = $("calcModeChip");


const levelUpCurrentStatusButtons = () =>
  Array.from(levelUpChecklist?.querySelectorAll("[data-toggle-current-stat]") || []);

radarTip.id = "radarTip";
radarTip.className = "radarTip";
radarTip.hidden = true;
radarWrap?.appendChild(radarTip);

let photoDataUrl = "";
let characterIndex = null;
let activeCharacterId = null;
let saveTimer = 0;
let resizeRaf = 0;
let radarCssSize = 0;
let radarScheduled = false;
let photoDbPromise = null;
let progressionState = clonePlain(defaults.progression);
let levelingState = clonePlain(defaults.leveling);
// Preservado apenas para não perder dados de fichas antigas no export/import.
// A UI de slots de atributo do catalisador foi removida.
let catalystAttributes = [];
let previousDerivedSnapshot = null;
let shouldAutoRaiseResources = false;
let suppressLevelUpPopup = false;

let calcOverrideState = clonePlain(defaults.calcOverrides);
let currentBaseCalcValues = {};
let calcAdjustmentState = clonePlain(defaults.calcAdjustments);

const levelUpCurrentStatusVisible = new Set();

function parseCalcFieldValue(id, value) {
  if (value == null || value === "" || value === "—") return 0;
  return toInt(String(value).replace("+", ""), 0);
}

function getCalcFieldDisplayValue(id, value) {
  const n = toInt(value, 0);
  return SIGNED_MANUAL_CALC_FIELDS.has(id) ? formatSigned(n) : String(n);
}

function captureCurrentBaseCalcValues() {
  currentBaseCalcValues = {};

  for (const id of MANUAL_CALC_FIELD_IDS) {
    const el = $(id);
    if (!el) continue;
    currentBaseCalcValues[id] = parseCalcFieldValue(id, el.value);
  }
}

function applyManualCalcOverrides() {
  applyPersistentCalcAdjustments();

  if (!calcOverrideState?.enabled) return;

  for (const id of MANUAL_CALC_FIELD_IDS) {
    const el = $(id);
    if (!el) continue;

    const base = toInt(currentBaseCalcValues[id], 0);
    const persistent = getPersistentCalcAdjustment(id);
    const delta = toInt(calcOverrideState.deltas?.[id], 0);
    const finalValue = base + persistent + delta;

    el.value = getCalcFieldDisplayValue(id, finalValue);
  }
}
function syncCalcOverrideUi() {
  const enabled = Boolean(calcOverrideState?.enabled);

  if (calcModeChip) {
    calcModeChip.textContent = enabled ? "manual" : "automático";
  }

  if (btnToggleCalcOverride) {
    btnToggleCalcOverride.textContent = enabled ? "Voltar para automático" : "Ajustar manualmente";
    btnToggleCalcOverride.setAttribute("aria-pressed", String(enabled));
  }

  for (const id of MANUAL_CALC_FIELD_IDS) {
    const el = $(id);
    if (!el) continue;

    el.readOnly = !enabled;
    el.dataset.manualOverride = enabled ? "true" : "false";
  }
}

function refreshCalcOverrideDeltasFromInputs() {
  if (!calcOverrideState.enabled) return;

  const deltas = {};

  for (const id of MANUAL_CALC_FIELD_IDS) {
    const el = $(id);
    if (!el) continue;

    const base = toInt(currentBaseCalcValues[id], 0);
    const persistent = getPersistentCalcAdjustment(id);
    const current = parseCalcFieldValue(id, el.value);

    deltas[id] = current - (base + persistent);
  }

  calcOverrideState.deltas = deltas;
}

function toggleCalcOverrideMode() {
  const willEnable = !calcOverrideState.enabled;

  if (willEnable) {
    calcOverrideState.enabled = true;

    if (!calcOverrideState.deltas || typeof calcOverrideState.deltas !== "object") {
      calcOverrideState.deltas = {};
    }
  } else {
    commitManualOverridesToPersistentAdjustments();
    calcOverrideState.enabled = false;
  }

  syncCalcOverrideUi();
  applyDerivedStats();
  saveAll();
}


function openPhotoDb() {
  if (photoDbPromise) return photoDbPromise;

  photoDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Falha ao abrir IndexedDB"));
  });

  return photoDbPromise;
}

// Cada ficha tem sua própria chave de foto: "character_photo_<id>".
// A chave antiga "character_photo" (sem id) é a foto da ficha única legada.
function photoKeyFor(id) {
  return id ? `${PHOTO_KEY}_${id}` : PHOTO_KEY;
}

async function savePhotoToDb(dataUrl, id = activeCharacterId) {
  const db = await openPhotoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put(dataUrl, photoKeyFor(id));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Falha ao salvar foto"));
  });
}

async function getPhotoFromDb(id = activeCharacterId) {
  const db = await openPhotoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).get(photoKeyFor(id));

    req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : "");
    req.onerror = () => reject(req.error || new Error("Falha ao carregar foto"));
  });
}

async function clearPhotoFromDb(id = activeCharacterId) {
  const db = await openPhotoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(photoKeyFor(id));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Falha ao remover foto"));
  });
}

// Lê a foto antiga (chave sem id) para migrar para a primeira ficha.
async function getLegacyPhoto() {
  const db = await openPhotoDb();
  return new Promise((resolve) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).get(PHOTO_KEY);
    req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : "");
    req.onerror = () => resolve("");
  });
}

async function copyPhotoBetween(srcId, dstId) {
  try {
    const src = await getPhotoFromDb(srcId);
    if (src) await savePhotoToDb(src, dstId);
  } catch (err) {
    console.error(err);
  }
}

function randomGlyphLine(len = 80) {
  const chars = "⟊⟟⟒⟐⟄⟅⟆⟇⟍⟔⟟⟡⟠⟣⟤⟥⟦⟧⟨⟩⟪⫫⌁⌂⌇⌎⌑⌘⌬⌲⌶⍁⍂⍃⍄⍅⍆⍇";
  let s = "";

  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
    if (i % 6 === 5) s += " ";
  }

  return s.trim();
}

function setMarquee(trackEl, text) {
  if (!trackEl) return;
  trackEl.textContent = `${text}     ${text}`;
}

function regenGlyphs() {
  const top = randomGlyphLine(96);
  const bottom = randomGlyphLine(110);

  setMarquee($("glyphTopTrack"), top);
  setMarquee($("glyphTopTrackBack"), top);
  setMarquee($("glyphBottomTrack"), bottom);

  return { top, bottom };
}

function normalizeName(v) {
  return (v || "").toUpperCase();
}

function syncHeaderStyle() {
  if (inpName) inpName.value = normalizeName(inpName.value);
}

function setSaveState(state) {
  for (const id of ["saveState", "saveStateBack"]) {
    const el = $(id);
    if (!el) continue;
    el.textContent = state;
    el.style.opacity = state === "salvando" ? "0.75" : "1";
  }
}

function showSaveError() {
  setSaveState("erro ao salvar");
  showToast("Não foi possível salvar a ficha neste aparelho.", "error");
}

// Toasts discretos e acessíveis. Usa textContent (sem innerHTML) para nunca
// renderizar HTML vindo do usuário. type: "good" | "warn" | "error" | "info".
const TOAST_ICONS = { good: "✔", warn: "⚠", error: "✕", info: "•" };

function showToast(message, type = "info", duration = 3600) {
  const region = $("toastRegion");
  if (!region) return null;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const icon = document.createElement("span");
  icon.className = "toast__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

  const text = document.createElement("span");
  text.className = "toast__text";
  text.textContent = String(message ?? "");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast__close";
  close.setAttribute("aria-label", "Fechar mensagem");
  close.textContent = "✕";

  toast.append(icon, text, close);
  region.appendChild(toast);

  let removeTimer = 0;
  const dismiss = () => {
    clearTimeout(removeTimer);
    toast.classList.add("is-leaving");
    // animationend cobre o caso normal; o timeout cobre reduced-motion (sem animação).
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 300);
  };

  close.addEventListener("click", dismiss);
  if (duration > 0) removeTimer = window.setTimeout(dismiss, duration);

  return toast;
}

function updateXpBar(xpInfo) {
  const bar = $("xpBar");
  const fill = $("xpBarFill");
  const label = $("xpBarLabel");
  if (!bar || !fill || !label) return;

  // Sem total = nível máximo (tabela acabou) ou cálculo indisponível.
  if (!xpInfo || xpInfo.total == null) {
    const atMax = xpInfo && toInt(xpInfo.level, 1) >= MAX_LEVEL;
    bar.classList.toggle("is-max", Boolean(atMax));
    fill.style.width = atMax ? "100%" : "0%";
    bar.setAttribute("aria-valuenow", atMax ? "100" : "0");
    label.textContent = atMax ? "Nível máximo" : "—";
    return;
  }

  const percent = clamp(Math.round(xpInfo.percent ?? 0), 0, 100);
  bar.classList.remove("is-max");
  fill.style.width = `${percent}%`;
  bar.setAttribute("aria-valuenow", String(percent));
  label.textContent = `${percent}% • faltam ${xpInfo.remaining} XP`;
}

function getCurrentLevel() {
  const raw = $("in_nv")?.value;
  if (raw == null || raw === "") return 1;
  return clamp(toInt(raw, 1), 1, 60);
}

function getCurrentWeaponLevel() {
  const raw = $("in_weapon_level")?.value;
  if (raw == null || raw === "") return 0;
  return clamp(toInt(raw, 0), 0, 20);
}

function getCurrentStatsObject() {
  const stats = {};
  for (const key of STATUS_KEYS) {
    stats[key] = $("st_" + key)?.value || "0";
  }
  return stats;
}

function getCurrentMods(stats = getCurrentStatsObject()) {
  if (!hasCalcModules()) {
    return { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0, adp: 0, res: 0 };
  }
  return window.CharacterCalc.getModifiers(stats);
}

function normalizeProgressionState(level, mods, rawProgression) {
  const safeLevel = Math.max(1, toInt(level, 1));
  const input = rawProgression && typeof rawProgression === "object" ? rawProgression : {};
  const next = {
    conModsByLevel: Array.isArray(input.conModsByLevel) ? [...input.conModsByLevel] : [],
    intModsByLevel: Array.isArray(input.intModsByLevel) ? [...input.intModsByLevel] : [],
    resModsByLevel: Array.isArray(input.resModsByLevel) ? [...input.resModsByLevel] : [],
  };

  const mapping = [
    ["conModsByLevel", mods.con],
    ["intModsByLevel", mods.int],
    ["resModsByLevel", mods.res],
  ];

  for (const [key, currentMod] of mapping) {
    const arr = next[key].map((n) => toInt(n, currentMod));

    if (arr.length > safeLevel) {
      arr.length = safeLevel;
    }

    while (arr.length < safeLevel) {
      arr.push(arr.length ? arr[arr.length - 1] : currentMod);
    }

    arr[safeLevel - 1] = currentMod;
    next[key] = arr;
  }

  return next;
}

function fillRaceList() {
  const list = $("raceList");
  if (!list || !window.RaceDB?.listNames) return;

  list.innerHTML = "";

  for (const raceName of window.RaceDB.listNames()) {
    const option = document.createElement("option");
    option.value = raceName;
    list.appendChild(option);
  }
}

function setReadOnlyValue(id, value) {
  const el = $(id);
  if (el) el.value = String(value);
}

function sanitizeCurrentResources(derived, previousDerived = null, autoRaise = false) {
  if (!derived) return;

  let hpCur = toInt(inHpCur?.value, derived.hpMax);
  let pmCur = toInt(inPmCur?.value, derived.pmMax);
  let hppCur = toInt(inHppCur?.value, derived.hppMax);

  if (autoRaise && previousDerived) {
    hpCur += Math.max(0, derived.hpMax - previousDerived.hpMax);
    pmCur += Math.max(0, derived.pmMax - previousDerived.pmMax);
    hppCur += Math.max(0, derived.hppMax - previousDerived.hppMax);
  }

  hpCur = clamp(hpCur, 0, derived.hpMax);
  pmCur = clamp(pmCur, 0, derived.pmMax);
  hppCur = clamp(hppCur, 0, derived.hppMax);

  if (inHpCur) inHpCur.value = String(hpCur);
  if (inPmCur) inPmCur.value = String(pmCur);
  if (inHppCur) inHppCur.value = String(hppCur);
}

function syncStatMods(mods) {
  for (const key of STATUS_KEYS) {
    const badge = $("mod_" + key);
    if (!badge) continue;
    badge.textContent = formatSigned(mods[key] ?? 0);
  }
}

function syncRuneTiers() {
  if (!window.CharacterCalc?.getRuneTier) return;

  const pairs = [
    ["tier_phys", rPhys?.value],
    ["tier_arc", rArc?.value],
    ["tier_spi", rSpi?.value],
  ];

  for (const [id, value] of pairs) {
    const el = $(id);
    if (el) el.textContent = window.CharacterCalc.getRuneTier(value);
  }
}

function syncSummaryOutputs({ race, derived, xpInfo }) {
  const level = xpInfo?.level ?? getCurrentLevel();
  const xp = xpInfo?.current ?? Math.max(0, toInt($("in_xp")?.value, 0));
  const hpCur = Math.max(0, toInt(inHpCur?.value, 0));
  const pmCur = Math.max(0, toInt(inPmCur?.value, 0));
  const hppCur = Math.max(0, toInt(inHppCur?.value, 0));
  const pi = clamp(toInt($("in_pi")?.value, 0), 0, 10);
  const caBonus = toInt($("in_ca_bonus")?.value, 0);
  const weaponLevel = getCurrentWeaponLevel();

  if (outNv) outNv.textContent = String(level);
  if (outXp) outXp.textContent = String(xp);
  if (outPi) outPi.textContent = String(pi);
  if (outPb) outPb.textContent = String(levelingState.pendingPb || 0);
  if (outWeapon) outWeapon.textContent = String(weaponLevel);

  if (outIdade) outIdade.textContent = $("in_idade")?.value.trim() || "?";
  if (outAltura) outAltura.textContent = $("in_altura")?.value.trim() || "?";
  if (outRaca) outRaca.textContent = race?.name || $("in_raca")?.value.trim() || "?";
  if (outClasse) outClasse.textContent = $("in_classe")?.value.trim() || "?";

  const totalCa = derived ? Math.max(0, toInt(derived.ca, 0) + caBonus) : null;

  if (derived) {
    if (outHp) outHp.textContent = `${hpCur}/${derived.hpMax}`;
    if (outPm) outPm.textContent = `${pmCur}/${derived.pmMax}`;
    if (outHpp) outHpp.textContent = `${hppCur}/${derived.hppMax}`;
    if (outCa) outCa.textContent = String(totalCa);
  } else {
    if (outHp) outHp.textContent = `${hpCur}/?`;
    if (outPm) outPm.textContent = `${pmCur}/?`;
    if (outHpp) outHpp.textContent = `${hppCur}/?`;
    if (outCa) outCa.textContent = "?";
  }

  if (outXpNext) outXpNext.textContent = xpInfo?.total == null ? "—" : String(xpInfo.total);
  if (outXpLeft) outXpLeft.textContent = xpInfo?.remaining == null ? "—" : String(xpInfo.remaining);

  updateXpBar(xpInfo);
}

function getLevelUpPointInput(key) {
  return $("lvl_" + key);
}

function getLevelUpCurrentValueEl(key) {
  return $("lvl_current_" + key);
}

function isLevelUpCurrentStatusVisible(key) {
  return levelUpCurrentStatusVisible.has(key);
}

function setLevelUpCurrentStatusVisibility(key, visible) {
  const valueEl = getLevelUpCurrentValueEl(key);
  const button = levelUpChecklist?.querySelector(`[data-toggle-current-stat="${key}"]`);
  const shouldShow = Boolean(visible);

  if (shouldShow) {
    levelUpCurrentStatusVisible.add(key);
  } else {
    levelUpCurrentStatusVisible.delete(key);
  }

  if (valueEl) {
    valueEl.hidden = !shouldShow;
  }

  if (button) {
    button.setAttribute("aria-pressed", String(shouldShow));
  }
}

function resetAllLevelUpCurrentStatusVisibility() {
  for (const key of STATUS_KEYS) {
    setLevelUpCurrentStatusVisibility(key, false);
  }
}

function refreshLevelUpCurrentStatusValues() {
  for (const key of STATUS_KEYS) {
    const sourceInput = $("st_" + key);
    const valueEl = getLevelUpCurrentValueEl(key);
    if (!valueEl) continue;
    valueEl.textContent = `Atual: ${toInt(sourceInput?.value, 0)}`;
  }
}

function getAllocatedLevelUpMap() {
  const out = {};
  for (const key of STATUS_KEYS) {
    out[key] = Math.max(0, toInt(getLevelUpPointInput(key)?.value, 0));
  }
  return out;
}

function getAllocatedLevelUpTotal() {
  const map = getAllocatedLevelUpMap();
  return STATUS_KEYS.reduce((acc, key) => acc + map[key], 0);
}

function getSelectedPbToStats() {
  return Math.max(0, toInt(lvlPbToStats?.value, 0));
}

function getMaxPbToStats() {
  if (!lvlUsePb?.checked) return 0;
  return Math.max(0, toInt(levelingState.pendingPb, 0));
}

function setSelectedPbToStats(value) {
  if (!lvlPbToStats) return;
  const max = getMaxPbToStats();
  lvlPbToStats.value = String(clamp(toInt(value, 0), 0, max));
}

function getLevelUpSelectionLimit() {
  const freePoints = Math.max(0, toInt(levelingState.pendingLevelPoints, 0));
  const pbExtra = getSelectedPbToStats();
  return freePoints + pbExtra;
}

function setLevelUpPoint(key, value) {
  const input = getLevelUpPointInput(key);
  if (!input) return;
  input.value = String(Math.max(0, toInt(value, 0)));
}

function trimAllocatedPointsToLimit() {
  const limit = getLevelUpSelectionLimit();
  let total = getAllocatedLevelUpTotal();

  if (total <= limit) return;

  for (const key of STATUS_KEYS) {
    while (total > limit && toInt(getLevelUpPointInput(key)?.value, 0) > 0) {
      setLevelUpPoint(key, toInt(getLevelUpPointInput(key)?.value, 0) - 1);
      total = getAllocatedLevelUpTotal();
    }

    if (total <= limit) break;
  }
}

function changeSelectedPbToStats(delta) {
  const current = getSelectedPbToStats();
  setSelectedPbToStats(current + delta);
  trimAllocatedPointsToLimit();
  refreshLevelUpModal();
}

function changeLevelUpPoint(key, delta) {
  const current = Math.max(0, toInt(getLevelUpPointInput(key)?.value, 0));
  const total = getAllocatedLevelUpTotal();
  const limit = getLevelUpSelectionLimit();

  if (delta > 0) {
    if (total >= limit) return;
    setLevelUpPoint(key, current + 1);
  } else if (delta < 0) {
    if (current <= 0) return;
    setLevelUpPoint(key, current - 1);
  }

  refreshLevelUpModal();
}

function refreshLevelUpModal() {
  if (!levelUpModal || !levelUpChecklist) return;

  const totalAllocated = getAllocatedLevelUpTotal();
  const limit = getLevelUpSelectionLimit();
  const maxPbToStats = getMaxPbToStats();
  const selectedPb = Math.min(getSelectedPbToStats(), maxPbToStats);

  if (selectedPb !== getSelectedPbToStats()) {
    setSelectedPbToStats(selectedPb);
  }

  if (lvlPointsLeft) lvlPointsLeft.textContent = String(levelingState.pendingLevelPoints || 0);
  if (lvlPbLeft) lvlPbLeft.textContent = String(levelingState.pendingPb || 0);
  if (lvlPbSelectedCount) lvlPbSelectedCount.textContent = String(selectedPb);
  if (lvlSelectedCount) lvlSelectedCount.textContent = `${totalAllocated}/${limit}`;

  if (lvlUsePb) {
    lvlUsePb.disabled = (levelingState.pendingPb || 0) <= 0;
    if (lvlUsePb.disabled) lvlUsePb.checked = false;
  }

  if (lvlPbAllocatorWrap) {
    lvlPbAllocatorWrap.hidden = !lvlUsePb?.checked || maxPbToStats <= 0;
  }

  if (lvlPbMinus) lvlPbMinus.disabled = selectedPb <= 0;
  if (lvlPbPlus) lvlPbPlus.disabled = selectedPb >= maxPbToStats;

  for (const key of STATUS_KEYS) {
    const input = getLevelUpPointInput(key);
    const row = levelUpChecklist.querySelector(`[data-stat="${key}"]`);
    if (!row || !input) continue;

    const minusBtn = row.querySelector('[data-action="minus"]');
    const plusBtn = row.querySelector('[data-action="plus"]');
    const current = Math.max(0, toInt(input.value, 0));

    if (minusBtn) minusBtn.disabled = current <= 0;
    if (plusBtn) plusBtn.disabled = totalAllocated >= limit;
  }

  if (btnApplyLevelUp) {
    btnApplyLevelUp.disabled = totalAllocated <= 0 || totalAllocated > limit;
  }
}

function clearLevelUpChecks() {
  if (!levelUpChecklist) return;

  for (const key of STATUS_KEYS) {
    setLevelUpPoint(key, 0);
  }

  if (lvlUsePb) lvlUsePb.checked = false;
  setSelectedPbToStats(0);
  resetAllLevelUpCurrentStatusVisibility();
}

function openLevelUpModalIfNeeded() {
  if (!levelUpModal || !levelUpChecklist) return;
  if ((levelingState.pendingLevelPoints || 0) <= 0) return;

  clearLevelUpChecks();
  refreshLevelUpCurrentStatusValues();
  refreshLevelUpModal();
  levelUpModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLevelUpModal() {
  if (!levelUpModal) return;
  levelUpModal.hidden = true;
  document.body.style.overflow = "";
}

function applyLevelUpSelections() {
  const allocated = getAllocatedLevelUpMap();
  const totalAllocated = STATUS_KEYS.reduce((acc, key) => acc + allocated[key], 0);
  const freePoints = Math.max(0, toInt(levelingState.pendingLevelPoints, 0));
  const pbSelected = Math.max(0, getSelectedPbToStats());
  const maxAlloc = freePoints + pbSelected;

  if (totalAllocated <= 0) return;
  if (totalAllocated > maxAlloc) return;
  if (pbSelected > (levelingState.pendingPb || 0)) return;

  const freeSpent = Math.min(totalAllocated, freePoints);
  const pbSpent = Math.max(0, totalAllocated - freeSpent);

  if (pbSpent > pbSelected) return;
  if (pbSpent > (levelingState.pendingPb || 0)) return;

  for (const key of STATUS_KEYS) {
    const add = allocated[key];
    if (add <= 0) continue;

    const input = $("st_" + key);
    if (!input) continue;

    const nextValue = toInt(input.value, 0) + add;
    input.value = String(nextValue);
  }

  levelingState.pendingLevelPoints = Math.max(0, freePoints - freeSpent);
  levelingState.pendingPb = Math.max(0, toInt(levelingState.pendingPb, 0) - pbSpent);

  setSelectedPbToStats(0);
  if (lvlUsePb) lvlUsePb.checked = false;

  shouldAutoRaiseResources = true;
  closeLevelUpModal();
  applyDerivedStats();
  saveAll();

  if ((levelingState.pendingLevelPoints || 0) > 0) {
    openLevelUpModalIfNeeded();
  }
}

function announceLevelUp(gainedLevels, newLevel) {
  const n = Math.max(0, toInt(gainedLevels, 0));
  if (n <= 0) return;

  const plural = n > 1 ? "níveis" : "nível";
  showToast(
    `Subiu ${n} ${plural}! Agora é nível ${newLevel}.\n` +
      `Ganhou +${n * 2} PS e +${n} PB para distribuir.`,
    "good",
    5000
  );
}

function processLevelUps(level, gainedLevelsFromXp = 0) {
  const currentLevel = Math.max(1, toInt(level, 1));
  const lastLevel = Math.max(1, toInt(levelingState.lastProcessedLevel, 1));
  const gainedFromXp = Math.max(0, toInt(gainedLevelsFromXp, 0));

  if (gainedFromXp > 0) {
    levelingState.pendingLevelPoints =
      toInt(levelingState.pendingLevelPoints, 0) + gainedFromXp * 2;

    levelingState.pendingPb =
      toInt(levelingState.pendingPb, 0) + gainedFromXp;

    levelingState.lastProcessedLevel = currentLevel;
    shouldAutoRaiseResources = true;

    if (!suppressLevelUpPopup) {
      announceLevelUp(gainedFromXp, currentLevel);
      setTimeout(openLevelUpModalIfNeeded, 0);
    }

    return;
  }

  if (currentLevel > lastLevel) {
    const gained = currentLevel - lastLevel;

    levelingState.pendingLevelPoints =
      toInt(levelingState.pendingLevelPoints, 0) + gained * 2;

    levelingState.pendingPb =
      toInt(levelingState.pendingPb, 0) + gained;

    levelingState.lastProcessedLevel = currentLevel;
    shouldAutoRaiseResources = true;

    if (!suppressLevelUpPopup) {
      announceLevelUp(gained, currentLevel);
      setTimeout(openLevelUpModalIfNeeded, 0);
    }
  } else if (currentLevel < lastLevel) {
    levelingState.lastProcessedLevel = currentLevel;
  }
}

// Lê nível/XP do catalisador dos inputs, rola o XP em níveis (teto 20) e
// escreve os valores normalizados de volta. Funciona mesmo sem CharacterCalc.
function getNormalizedCatalyst() {
  const levelInput = $("in_catalyst_level");
  const xpInput = $("in_catalyst_xp");
  let level = clamp(toInt(levelInput?.value, 0), 0, MAX_CATALYST_LEVEL);
  let xp = Math.max(0, toInt(xpInput?.value, 0));

  if (window.CharacterCalc?.normalizeCatalystLevelAndXp) {
    const n = window.CharacterCalc.normalizeCatalystLevelAndXp({ level, xp });
    level = clamp(toInt(n.level, level), 0, MAX_CATALYST_LEVEL);
    xp = Math.max(0, toInt(n.xp, xp));
    if (levelInput) levelInput.value = String(level);
    if (xpInput) xpInput.value = String(xp);
  }

  return { level, xp };
}

function updateCatalystXpBar(prog) {
  const bar = $("catalystXpBar");
  const fill = $("catalystXpBarFill");
  const label = $("catalystXpBarLabel");
  if (!bar || !fill || !label) return;

  if (!prog || prog.total == null) {
    const atMax = prog && toInt(prog.level, 0) >= MAX_CATALYST_LEVEL;
    bar.classList.toggle("is-max", Boolean(atMax));
    fill.style.width = atMax ? "100%" : "0%";
    bar.setAttribute("aria-valuenow", atMax ? "100" : "0");
    label.textContent = atMax ? "Nível máximo" : "—";
    return;
  }

  const percent = clamp(Math.round(prog.percent ?? 0), 0, 100);
  bar.classList.remove("is-max");
  fill.style.width = `${percent}%`;
  bar.setAttribute("aria-valuenow", String(percent));
  label.textContent = `${percent}% • faltam ${prog.remaining} XP`;
}

function updateCatalystDisplays(catalyst) {
  const C = window.CharacterCalc;
  const bonus = C?.getCatalystBonus
    ? C.getCatalystBonus(catalyst.level)
    : clamp(toInt(catalyst.level, 0), 0, MAX_CATALYST_LEVEL);

  setReadOnlyValue("out_catalyst_bonus", `+${bonus} acerto • +${bonus} dano/cura`);

  const prog = C?.getCatalystXpProgress ? C.getCatalystXpProgress(catalyst) : null;
  setReadOnlyValue("in_catalyst_xp_next", prog?.total == null ? "nível máximo" : prog.total);

  updateCatalystXpBar(prog);
}

function applyDerivedStats() {
  const stats = getCurrentStatsObject();
  const mods = getCurrentMods(stats);

  let level = getCurrentLevel();
  let xp = Math.max(0, toInt($("in_xp")?.value, 0));
  const weaponLevel = getCurrentWeaponLevel();
  const catalyst = getNormalizedCatalyst();
  let gainedLevelsFromXp = 0;

  if (window.CharacterCalc?.normalizeLevelAndXp) {
    const normalized = window.CharacterCalc.normalizeLevelAndXp({
      level,
      xp,
    });

    gainedLevelsFromXp = Math.max(0, toInt(normalized.gainedLevels, 0));
    level = clamp(toInt(normalized.level, level), 1, 60);
    xp = Math.max(0, toInt(normalized.xp, xp));

    if ($("in_nv")) $("in_nv").value = String(level);
    if ($("in_xp")) $("in_xp").value = String(xp);
  }

  processLevelUps(level, gainedLevelsFromXp);

  syncStatMods(mods);
  syncRuneTiers();
  refreshLevelUpCurrentStatusValues();

  let race = null;
  let derived = null;
  let xpInfo = {
    level,
    current: xp,
    total: null,
    remaining: null,
    percent: null,
    gainedLevels: gainedLevelsFromXp,
  };

  if (hasCalcModules()) {
    const raceInputValue = $("in_raca")?.value || "";
    race = window.RaceDB.findRace(raceInputValue);

    progressionState = normalizeProgressionState(level, mods, progressionState);

    derived = window.CharacterCalc.calculate({
      level,
      stats,
      race: race || { name: raceInputValue.trim(), hpBase: 10, pmBase: 0 },
      progression: progressionState,
      weapon: { level: weaponLevel },
      catalyst: { level: catalyst.level },
    });

    sanitizeCurrentResources(derived, previousDerivedSnapshot, shouldAutoRaiseResources);
    shouldAutoRaiseResources = false;

    const caBonus = toInt($("in_ca_bonus")?.value, 0);
    const totalCa = Math.max(0, toInt(derived.ca, 0) + caBonus);

    setReadOnlyValue("in_hp_max", derived.hpMax);
    setReadOnlyValue("in_pm_max", derived.pmMax);
    setReadOnlyValue("in_hpp_max", derived.hppMax);
    setReadOnlyValue("in_ca", totalCa);

    setReadOnlyValue("hit_magic", formatSigned(derived.attackBonuses.magic));
    setReadOnlyValue("hit_phys_for", formatSigned(derived.attackBonuses.physicalFor));
    setReadOnlyValue("hit_phys_des", formatSigned(derived.attackBonuses.physicalDes));
    setReadOnlyValue("hit_ench_for", formatSigned(derived.attackBonuses.enchantedFor));
    setReadOnlyValue("hit_ench_des", formatSigned(derived.attackBonuses.enchantedDes));

    xpInfo = window.CharacterCalc.getXpProgress({
      level,
      xp,
    });

    if ($("in_nv")) $("in_nv").value = String(xpInfo.level ?? level);
    if ($("in_xp")) $("in_xp").value = String(xpInfo.current ?? xp);

    setReadOnlyValue("in_xp_next", xpInfo.total == null ? "—" : xpInfo.total);
    setReadOnlyValue("in_xp_left", xpInfo.remaining == null ? "—" : xpInfo.remaining);

    currentBaseCalcValues = {
      in_hp_max: toInt(derived.hpMax, 0),
      in_pm_max: toInt(derived.pmMax, 0),
      in_hpp_max: toInt(derived.hppMax, 0),
      in_ca: toInt(totalCa, 0),
      in_xp_next: xpInfo.total == null ? 0 : toInt(xpInfo.total, 0),
      in_xp_left: xpInfo.remaining == null ? 0 : toInt(xpInfo.remaining, 0),
      hit_magic: toInt(derived.attackBonuses.magic, 0),
      hit_phys_for: toInt(derived.attackBonuses.physicalFor, 0),
      hit_phys_des: toInt(derived.attackBonuses.physicalDes, 0),
      hit_ench_for: toInt(derived.attackBonuses.enchantedFor, 0),
      hit_ench_des: toInt(derived.attackBonuses.enchantedDes, 0),
    };

    applyManualCalcOverrides();
    syncCalcOverrideUi();
  }

  previousDerivedSnapshot = derived
    ? {
        level: derived.level,
        hpMax: derived.hpMax,
        pmMax: derived.pmMax,
        hppMax: derived.hppMax,
      }
    : null;

  updateCatalystDisplays(catalyst);
  syncSummaryOutputs({ race, derived, xpInfo });
  refreshLevelUpModal();
  queueRadarDraw();
}

function setPhoto(dataUrl) {
  photoDataUrl = dataUrl || "";
  if (!photoImg || !photoPlaceholder) return;

  if (photoDataUrl) {
    photoImg.src = photoDataUrl;
    photoImg.style.opacity = "1";
    photoPlaceholder.style.display = "none";
  } else {
    photoImg.removeAttribute("src");
    photoImg.style.opacity = "0";
    photoPlaceholder.style.display = "flex";
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Falha ao ler imagem"));
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = src;
  });
}

async function compressImageDataUrl(dataUrl, maxSide = 900, quality = 0.84) {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));

  const c = document.createElement("canvas");
  c.width = nw;
  c.height = nh;

  const cctx = c.getContext("2d");
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(img, 0, 0, nw, nh);

  return c.toDataURL("image/jpeg", quality);
}

function setActiveTab(tab) {
  const isSummary = tab !== "notes";

  for (const button of document.querySelectorAll(".tab")) {
    const active = button.dataset.tab === (isSummary ? "summary" : "notes");
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }

  for (const panel of document.querySelectorAll(".panel")) {
    const active = panel.dataset.panel === (isSummary ? "summary" : "notes");
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  }
}

function collectState() {
  return {
    v: 8,
    name: inpName?.value || "",
    guild: inpGuild?.value || "",
    activeTab: document.querySelector(".tab.is-active")?.dataset.tab || "summary",
    glyphTop: $("glyphTopTrack")?.textContent || "",
    glyphBottom: $("glyphBottomTrack")?.textContent || "",
    photoStored: Boolean(photoDataUrl),

    fields: {
      idade: $("in_idade")?.value || "",
      altura: $("in_altura")?.value || "",
      raca: $("in_raca")?.value || "",
      classe: $("in_classe")?.value || "",
      nv: $("in_nv")?.value || "1",
      xp: $("in_xp")?.value || "0",
      hpCur: $("in_hp_cur")?.value || "",
      pmCur: $("in_pm_cur")?.value || "",
      hppCur: $("in_hpp_cur")?.value || "",
      pi: $("in_pi")?.value || "",
      caBonus: $("in_ca_bonus")?.value || "0",
      weaponLevel: $("in_weapon_level")?.value || "",
    },

    stats: STATUS_KEYS.reduce((acc, key) => {
      acc[key] = $("st_" + key)?.value || "";
      return acc;
    }, {}),

    progression: clonePlain(progressionState),

    calcOverrides: {
      enabled: Boolean(calcOverrideState?.enabled),
      deltas:
        calcOverrideState?.deltas && typeof calcOverrideState.deltas === "object"
          ? { ...calcOverrideState.deltas }
          : {},
    },

    calcAdjustments:
      calcAdjustmentState && typeof calcAdjustmentState === "object"
        ? { ...calcAdjustmentState }
        : {},

    leveling: clonePlain(levelingState),

    catalyst: {
      level: $("in_catalyst_level")?.value || "0",
      xp: $("in_catalyst_xp")?.value || "0",
      attributes: Array.isArray(catalystAttributes) ? [...catalystAttributes] : [],
    },

    runes: {
      phys: clamp(toInt(rPhys?.value, 0), 0, 100),
      arc: clamp(toInt(rArc?.value, 0), 0, 100),
      spi: clamp(toInt(rSpi?.value, 0), 0, 100),
    },

    notes: {
      story: noteStory?.value || "",
      personality: notePersonality?.value || "",
      appearance: noteAppearance?.value || "",
      goals: noteGoals?.value || "",
      npcs: noteNpcs?.value || "",
      quests: noteQuests?.value || "",
      inv: noteInv?.value || "",
      skills: noteSkills?.value || "",
      magicSimple: noteMagicSimple?.value || "",
      magicComplex: noteMagicComplex?.value || "",
      magicAdvanced: noteMagicAdvanced?.value || "",
      diary: noteDiary?.value || "",
      free: noteFree?.value || "",
    },
  };
}

function migrateLegacy(state) {
  const merged = clonePlain(defaults);

  if (!state || typeof state !== "object") {
    return merged;
  }

  if (state.calcOverrides && typeof state.calcOverrides === "object") {
    merged.calcOverrides.enabled = Boolean(state.calcOverrides.enabled);
    merged.calcOverrides.deltas =
      state.calcOverrides.deltas && typeof state.calcOverrides.deltas === "object"
        ? { ...state.calcOverrides.deltas }
        : {};
  }

  if (state.calcAdjustments && typeof state.calcAdjustments === "object") {
    merged.calcAdjustments = { ...state.calcAdjustments };
  }

  merged.name = state.name ?? merged.name;
  merged.guild = state.guild ?? merged.guild;
  merged.activeTab = state.activeTab === "notes" ? "notes" : "summary";
  merged.glyphTop = state.glyphTop ?? merged.glyphTop;
  merged.glyphBottom = state.glyphBottom ?? merged.glyphBottom;

  const oldFields = state.fields && typeof state.fields === "object" ? state.fields : {};

  merged.fields.idade = oldFields.idade ?? oldFields.in_idade ?? merged.fields.idade;
  merged.fields.altura = oldFields.altura ?? oldFields.in_altura ?? merged.fields.altura;
  merged.fields.raca = oldFields.raca ?? oldFields.in_raca ?? merged.fields.raca;
  merged.fields.classe = oldFields.classe ?? oldFields.in_classe ?? merged.fields.classe;
  merged.fields.nv = String(oldFields.nv ?? oldFields.in_nv ?? merged.fields.nv);
  merged.fields.xp = String(oldFields.xp ?? oldFields.in_xp ?? merged.fields.xp);
  merged.fields.hpCur = String(oldFields.hpCur ?? oldFields.in_hp_cur ?? state.hp?.cur ?? merged.fields.hpCur);
  merged.fields.pmCur = String(oldFields.pmCur ?? oldFields.in_pm_cur ?? oldFields.in_pm ?? merged.fields.pmCur);
  merged.fields.hppCur = String(oldFields.hppCur ?? oldFields.in_hpp_cur ?? merged.fields.hppCur);
  merged.fields.pi = String(oldFields.pi ?? oldFields.in_pi ?? merged.fields.pi);
  merged.fields.caBonus = String(oldFields.caBonus ?? oldFields.in_ca_bonus ?? merged.fields.caBonus);
  merged.fields.weaponLevel = String(oldFields.weaponLevel ?? oldFields.in_weapon_level ?? merged.fields.weaponLevel);

  if (state.stats && typeof state.stats === "object") {
    for (const key of STATUS_KEYS) {
      merged.stats[key] = String(state.stats[key] ?? merged.stats[key]);
    }
  }

  if (state.progression && typeof state.progression === "object") {
    merged.progression.conModsByLevel = Array.isArray(state.progression.conModsByLevel)
      ? state.progression.conModsByLevel.map((n) => toInt(n, 0))
      : merged.progression.conModsByLevel;

    merged.progression.intModsByLevel = Array.isArray(state.progression.intModsByLevel)
      ? state.progression.intModsByLevel.map((n) => toInt(n, 0))
      : merged.progression.intModsByLevel;

    merged.progression.resModsByLevel = Array.isArray(state.progression.resModsByLevel)
      ? state.progression.resModsByLevel.map((n) => toInt(n, 0))
      : merged.progression.resModsByLevel;
  }

  const savedLeveling = state.leveling && typeof state.leveling === "object" ? state.leveling : null;
  const mergedLevel = clamp(toInt(merged.fields.nv, 1), 1, 60);

  merged.leveling.pendingLevelPoints = savedLeveling
    ? Math.max(0, toInt(savedLeveling.pendingLevelPoints, 0))
    : 0;

  merged.leveling.pendingPb = savedLeveling
    ? Math.max(0, toInt(savedLeveling.pendingPb, 0))
    : 0;

  merged.leveling.lastProcessedLevel = savedLeveling
    ? Math.max(1, toInt(savedLeveling.lastProcessedLevel, mergedLevel))
    : mergedLevel;

  if (state.catalyst && typeof state.catalyst === "object") {
    merged.catalyst.level = String(
      clamp(toInt(state.catalyst.level, 0), 0, MAX_CATALYST_LEVEL)
    );
    merged.catalyst.xp = String(Math.max(0, toInt(state.catalyst.xp, 0)));
    merged.catalyst.attributes = Array.isArray(state.catalyst.attributes)
      ? state.catalyst.attributes
          .filter((key) => STATUS_KEYS.includes(key))
          .slice(0, 4)
      : [];
  } else {
    // Ficha antiga sem catalisador: padrão seguro.
    merged.catalyst.level = "0";
    merged.catalyst.xp = "0";
    merged.catalyst.attributes = [];
  }

  if (state.runes && typeof state.runes === "object") {
    merged.runes.phys = clamp(toInt(state.runes.phys, merged.runes.phys), 0, 100);
    merged.runes.arc = clamp(toInt(state.runes.arc, merged.runes.arc), 0, 100);
    merged.runes.spi = clamp(toInt(state.runes.spi, merged.runes.spi), 0, 100);
  }

  if (state.notes && typeof state.notes === "object") {
    merged.notes.story = state.notes.story ?? merged.notes.story;
    merged.notes.personality = state.notes.personality ?? merged.notes.personality;
    merged.notes.appearance = state.notes.appearance ?? merged.notes.appearance;
    merged.notes.goals = state.notes.goals ?? merged.notes.goals;
    merged.notes.npcs = state.notes.npcs ?? merged.notes.npcs;
    merged.notes.quests = state.notes.quests ?? merged.notes.quests;
    merged.notes.inv = state.notes.inv ?? merged.notes.inv;
    merged.notes.skills = state.notes.skills ?? merged.notes.skills;
    merged.notes.magicSimple = state.notes.magicSimple ?? merged.notes.magicSimple;
    merged.notes.magicComplex = state.notes.magicComplex ?? merged.notes.magicComplex;
    merged.notes.magicAdvanced = state.notes.magicAdvanced ?? merged.notes.magicAdvanced;
    merged.notes.diary = state.notes.diary ?? merged.notes.diary;
    merged.notes.free = state.notes.free ?? merged.notes.free;
  }

  return merged;
}

function applyState(rawState) {
  const state = migrateLegacy(rawState);

  if (inpName) inpName.value = state.name;
  if (inpGuild) inpGuild.value = state.guild;
  syncHeaderStyle();

  if (state.glyphTop) {
    if ($("glyphTopTrack")) $("glyphTopTrack").textContent = state.glyphTop;
    if ($("glyphTopTrackBack")) $("glyphTopTrackBack").textContent = state.glyphTop;
  } else {
    regenGlyphs();
  }

  if (state.glyphBottom && $("glyphBottomTrack")) {
    $("glyphBottomTrack").textContent = state.glyphBottom;
  }

  $("in_idade").value = state.fields.idade;
  $("in_altura").value = state.fields.altura;
  $("in_raca").value = state.fields.raca;
  $("in_classe").value = state.fields.classe;
  $("in_nv").value = state.fields.nv;
  $("in_xp").value = state.fields.xp;
  $("in_hp_cur").value = state.fields.hpCur;
  $("in_pm_cur").value = state.fields.pmCur;
  $("in_hpp_cur").value = state.fields.hppCur;
  $("in_pi").value = state.fields.pi;
  $("in_ca_bonus").value = state.fields.caBonus;
  $("in_weapon_level").value = state.fields.weaponLevel;

  for (const key of STATUS_KEYS) {
    const el = $("st_" + key);
    if (el) el.value = state.stats[key];
  }

  progressionState = clonePlain(state.progression);
  levelingState = clonePlain(state.leveling);

  if ($("in_catalyst_level")) $("in_catalyst_level").value = state.catalyst.level;
  if ($("in_catalyst_xp")) $("in_catalyst_xp").value = state.catalyst.xp;
  catalystAttributes = Array.isArray(state.catalyst.attributes)
    ? [...state.catalyst.attributes]
    : [];

  calcOverrideState = clonePlain(state.calcOverrides || defaults.calcOverrides);
  calcAdjustmentState = clonePlain(state.calcAdjustments || defaults.calcAdjustments);
  syncCalcOverrideUi();

  syncRunePair(rPhys, nPhys, state.runes.phys);
  syncRunePair(rArc, nArc, state.runes.arc);
  syncRunePair(rSpi, nSpi, state.runes.spi);

  if (noteStory) noteStory.value = state.notes.story;
  if (notePersonality) notePersonality.value = state.notes.personality;
  if (noteAppearance) noteAppearance.value = state.notes.appearance;
  if (noteGoals) noteGoals.value = state.notes.goals;
  if (noteNpcs) noteNpcs.value = state.notes.npcs;
  if (noteQuests) noteQuests.value = state.notes.quests;
  if (noteInv) noteInv.value = state.notes.inv;
  if (noteSkills) noteSkills.value = state.notes.skills;
  if (noteMagicSimple) noteMagicSimple.value = state.notes.magicSimple;
  if (noteMagicComplex) noteMagicComplex.value = state.notes.magicComplex;
  if (noteMagicAdvanced) noteMagicAdvanced.value = state.notes.magicAdvanced;
  if (noteDiary) noteDiary.value = state.notes.diary;
  if (noteFree) noteFree.value = state.notes.free;

  suppressLevelUpPopup = true;
  applyDerivedStats();
  suppressLevelUpPopup = false;

  setActiveTab(state.activeTab);
  queueRadarDraw();
}

function persistNow() {
  saveActiveCharacter();
}

// Salva imediatamente, cancelando o autosave em debounce. Usar antes de
// trocar/duplicar/excluir/importar para não perder edições recentes.
function persistNowImmediate() {
  clearTimeout(saveTimer);
  persistNow();
}

function saveAll() {
  setSaveState("salvando");
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistNow, SAVE_DELAY);
}

/* ============================================================
   Gerenciador de múltiplas fichas (v9)
   - índice em INDEX_KEY; cada ficha em CHAR_PREFIX + id
   - foto por ficha no IndexedDB (photoKeyFor)
   ============================================================ */

function genCharacterId() {
  // new Date()/Math.random() são válidos no navegador (a restrição é só do sandbox de workflow).
  return "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function characterDataKey(id) {
  return CHAR_PREFIX + id;
}

function nowIso() {
  return new Date().toISOString();
}

function loadIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.characters) || !parsed.characters.length) return null;
    return parsed;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function saveIndex() {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(characterIndex));
  } catch (err) {
    console.error(err);
    showSaveError();
  }
}

function loadCharacterData(id) {
  try {
    const raw = localStorage.getItem(characterDataKey(id));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error(err);
    return null;
  }
}

function saveCharacterData(id, state) {
  localStorage.setItem(characterDataKey(id), JSON.stringify(state));
}

function removeCharacterData(id) {
  localStorage.removeItem(characterDataKey(id));
}

function makeIndexEntry(id, name) {
  const ts = nowIso();
  return { id, name: name || "Personagem", createdAt: ts, updatedAt: ts };
}

function getCharacterEntry(id) {
  return characterIndex?.characters.find((c) => c.id === id) || null;
}

function characterDisplayName(entry) {
  return (entry?.name || "").trim() || "(sem nome)";
}

// Cria uma ficha nova (NÃO troca para ela). Retorna o id.
function createCharacter(name, initialState = null) {
  const id = genCharacterId();
  saveCharacterData(id, initialState || clonePlain(defaults));
  characterIndex.characters.push(makeIndexEntry(id, name));
  saveIndex();
  return id;
}

// Salva a ficha ativa (estado atual da tela) no seu slot e atualiza o índice.
function saveActiveCharacter() {
  if (!activeCharacterId || !characterIndex) return;
  try {
    const state = collectState();
    saveCharacterData(activeCharacterId, state);

    const entry = getCharacterEntry(activeCharacterId);
    if (entry) {
      const typedName = (state.name || "").trim();
      if (typedName) entry.name = typedName;
      entry.updatedAt = nowIso();
    }
    saveIndex();
    setSaveState("salvo");
  } catch (err) {
    console.error(err);
    showSaveError();
  }
}

// Carrega a ficha ativa no DOM (não salva a anterior; quem troca é switchCharacter).
async function loadActiveCharacterIntoUI() {
  const data = loadCharacterData(activeCharacterId) || clonePlain(defaults);
  applyState(data);
  try {
    setPhoto(await getPhotoFromDb(activeCharacterId));
  } catch {
    setPhoto("");
  }
}

async function switchCharacter(id) {
  if (!id || id === activeCharacterId || !getCharacterEntry(id)) {
    refreshCharacterSelect();
    return;
  }

  persistNowImmediate(); // salva a ficha atual antes de sair

  activeCharacterId = id;
  characterIndex.activeCharacterId = id;
  saveIndex();

  await loadActiveCharacterIntoUI();
  refreshCharacterSelect();
  setSaveState("salvo");
}

function onNewCharacter() {
  persistNowImmediate();

  const n = characterIndex.characters.length + 1;
  const id = createCharacter(`Personagem ${n}`);

  activeCharacterId = id;
  characterIndex.activeCharacterId = id;
  saveIndex();

  applyState(clonePlain(defaults));
  setPhoto("");
  clearPhotoFromDb(id).catch(() => {});
  refreshCharacterSelect();
  setSaveState("salvo");
  showToast("Nova ficha criada.", "good", 2400);
}

async function duplicateActiveCharacter() {
  persistNowImmediate();

  const srcId = activeCharacterId;
  const data = loadCharacterData(srcId);
  if (!data) return;

  const srcEntry = getCharacterEntry(srcId);
  const baseName = (data.name || srcEntry?.name || "Personagem").trim() || "Personagem";
  const copyName = `${baseName} — Cópia`;

  const copy = clonePlain(data);
  copy.name = copyName;

  const newId = createCharacter(copyName, copy);
  await copyPhotoBetween(srcId, newId);

  activeCharacterId = newId;
  characterIndex.activeCharacterId = newId;
  saveIndex();

  await loadActiveCharacterIntoUI();
  refreshCharacterSelect();
  showToast("Ficha duplicada (com foto).", "good", 2600);
}

function renameActiveCharacter() {
  const entry = getCharacterEntry(activeCharacterId);
  if (!entry) return;

  const novo = window.prompt("Novo nome da ficha:", entry.name || "");
  if (novo == null) return;

  const clean = novo.trim();
  if (!clean) return;

  entry.name = clean;
  entry.updatedAt = nowIso();
  saveIndex();

  if (inpName) {
    inpName.value = clean;
    syncHeaderStyle();
  }
  persistNowImmediate();
  refreshCharacterSelect();
  showToast("Ficha renomeada.", "good", 2200);
}

async function deleteActiveCharacter() {
  const entry = getCharacterEntry(activeCharacterId);
  if (!entry || !characterIndex) return;

  const ok = window.confirm(
    `Tem certeza que deseja excluir a ficha "${characterDisplayName(entry)}"?\n\n` +
      "Essa ação não pode ser desfeita sem backup. Exporte um JSON antes, se quiser guardar."
  );
  if (!ok) return;

  const deletedId = activeCharacterId;
  removeCharacterData(deletedId);
  clearPhotoFromDb(deletedId).catch(() => {});
  characterIndex.characters = characterIndex.characters.filter((c) => c.id !== deletedId);

  if (characterIndex.characters.length === 0) {
    // Nunca deixar zero fichas: cria uma limpa.
    const id = createCharacter("Personagem 1");
    activeCharacterId = id;
    characterIndex.activeCharacterId = id;
    saveIndex();
    applyState(clonePlain(defaults));
    setPhoto("");
  } else {
    activeCharacterId = characterIndex.characters[0].id;
    characterIndex.activeCharacterId = activeCharacterId;
    saveIndex();
    await loadActiveCharacterIntoUI();
  }

  refreshCharacterSelect();
  showToast("Ficha excluída.", "warn", 2600);
}

// Atualiza só o rótulo visível da ficha ativa enquanto o usuário digita o nome
// (sem reconstruir o seletor inteiro).
function syncActiveCharacterName() {
  const name = (inpName?.value || "").trim() || "(sem nome)";

  const sel = $("characterSelect");
  if (sel) {
    const opt = Array.from(sel.options).find((o) => o.value === activeCharacterId);
    if (opt) opt.textContent = name;
  }

  const label = $("activeCharacterName");
  if (label) label.textContent = name;
}

function refreshCharacterSelect() {
  const sel = $("characterSelect");
  if (sel && characterIndex) {
    sel.innerHTML = "";
    for (const c of characterIndex.characters) {
      sel.appendChild(new Option(characterDisplayName(c), c.id));
    }
    sel.value = activeCharacterId || "";
  }

  const label = $("activeCharacterName");
  if (label) {
    const entry = getCharacterEntry(activeCharacterId);
    label.textContent = entry ? characterDisplayName(entry) : "—";
  }
}

// Migra a ficha única antiga (v8) para a primeira ficha do sistema multi-fichas.
// NÃO apaga a chave antiga (rpg_card_v8_state) — fica como backup.
function migrateSingleCharacterToMultiCharacter() {
  const index = { activeCharacterId: null, characters: [] };
  let legacy = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) legacy = JSON.parse(raw);
  } catch (err) {
    console.error(err);
  }

  const id = genCharacterId();

  if (legacy && typeof legacy === "object") {
    const name = (legacy.name || "").trim() || "Personagem 1";
    saveCharacterData(id, legacy); // dado bruto; applyState/migrateLegacy normaliza ao carregar
    index.characters.push(makeIndexEntry(id, name));
  } else {
    saveCharacterData(id, clonePlain(defaults));
    index.characters.push(makeIndexEntry(id, "Personagem 1"));
  }

  index.activeCharacterId = id;
  characterIndex = index;
  saveIndex();

  return { migratedFromLegacy: Boolean(legacy && typeof legacy === "object"), id };
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error(err);
    return null;
  }
}

function syncRunePair(rangeEl, numEl, value) {
  if (!rangeEl || !numEl) return;
  const v = clamp(toInt(value, 0), 0, 100);
  rangeEl.value = String(v);
  numEl.value = String(v);
}

function initRuneSync() {
  [[rPhys, nPhys], [rArc, nArc], [rSpi, nSpi]].forEach(([rangeEl, numEl]) => {
    if (!rangeEl || !numEl) return;

    rangeEl.addEventListener("input", () => {
      syncRunePair(rangeEl, numEl, rangeEl.value);
      syncRuneTiers();
      saveAll();
    });

    numEl.addEventListener("input", () => {
      syncRunePair(rangeEl, numEl, numEl.value);
      syncRuneTiers();
      saveAll();
    });
  });
}

function initLevelUpModal() {
  if (!levelUpModal || !levelUpChecklist) return;

  lvlUsePb?.addEventListener("change", () => {
    if (!lvlUsePb.checked) {
      setSelectedPbToStats(0);
    } else if (getMaxPbToStats() > 0 && getSelectedPbToStats() <= 0) {
      setSelectedPbToStats(1);
    }

    trimAllocatedPointsToLimit();
    refreshLevelUpModal();
  });

  lvlPbMinus?.addEventListener("click", () => changeSelectedPbToStats(-1));
  lvlPbPlus?.addEventListener("click", () => changeSelectedPbToStats(1));

  levelUpChecklist.querySelectorAll(".lvl-step").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.stat;
      const action = button.dataset.action;
      if (!key || !action) return;
      changeLevelUpPoint(key, action === "plus" ? 1 : -1);
    });
  });

  levelUpCurrentStatusButtons().forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggleCurrentStat;
      if (!key) return;

      refreshLevelUpCurrentStatusValues();
      setLevelUpCurrentStatusVisibility(key, !isLevelUpCurrentStatusVisible(key));
    });
  });

  btnApplyLevelUp?.addEventListener("click", applyLevelUpSelections);
}

function showRadarTip(text, x, y) {
  radarTip.textContent = text;
  radarTip.style.left = `${x}px`;
  radarTip.style.top = `${y}px`;
  radarTip.hidden = false;
}

function hideRadarTip() {
  radarTip.hidden = true;
}

function resizeRadarForDisplay() {
  if (!canvas || !ctx) return null;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const wrapEl = radarWrap || canvas.parentElement;
  if (!wrapEl) return null;

  const rect = wrapEl.getBoundingClientRect();
  let usableW = rect.width;

  if (wrapEl instanceof HTMLElement) {
    const styles = getComputedStyle(wrapEl);
    usableW -= (parseFloat(styles.paddingLeft || "0") || 0) + (parseFloat(styles.paddingRight || "0") || 0);
  }

  if (usableW < 10) return null;

  const cssW = Math.max(240, Math.min(520, Math.floor(usableW)));
  radarCssSize = cssW;

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssW}px`;

  const px = Math.floor(cssW * dpr);
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  return { w: cssW, h: cssW };
}

function getStatusValues() {
  return STATUS_KEYS.map((key) => clamp(parseFloat($("st_" + key)?.value || "0") || 0, 0, 999));
}

function drawRadar() {
  if (!canvas || !ctx) return;

  const size = resizeRadarForDisplay();
  if (!size) return;

  const { w, h } = size;
  const cx = w / 2;
  const cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.34;
  const values = getStatusValues();
  const maxV = Math.max(10, ...values);
  const rings = 5;

  ctx.clearRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.25, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(42,34,26,.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 1; i <= rings; i++) {
    const rr = baseRadius * (i / rings);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(42,34,26,.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let i = 0; i < STATUS_LABELS.length; i++) {
    const ang = -Math.PI / 2 + i * ((2 * Math.PI) / STATUS_LABELS.length);
    const x = cx + Math.cos(ang) * baseRadius * 1.05;
    const y = cy + Math.sin(ang) * baseRadius * 1.05;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(42,34,26,.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "900 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(42,34,26,.88)";
    ctx.textAlign = Math.cos(ang) > 0.25 ? "left" : Math.cos(ang) < -0.25 ? "right" : "center";
    ctx.textBaseline = Math.sin(ang) > 0.25 ? "top" : Math.sin(ang) < -0.25 ? "bottom" : "middle";
    ctx.fillText(
      STATUS_LABELS[i],
      cx + Math.cos(ang) * baseRadius * 1.33,
      cy + Math.sin(ang) * baseRadius * 1.33
    );
  }

  ctx.beginPath();
  for (let i = 0; i < STATUS_LABELS.length; i++) {
    const ang = -Math.PI / 2 + i * ((2 * Math.PI) / STATUS_LABELS.length);
    const rr = baseRadius * (values[i] / maxV);
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fillStyle = "rgba(80, 114, 164, .30)";
  ctx.fill();
  ctx.strokeStyle = "rgba(42,34,26,.55)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(42,34,26,.65)";
  ctx.fill();
}

function queueRadarDraw() {
  if (radarScheduled) return;

  radarScheduled = true;
  requestAnimationFrame(() => {
    radarScheduled = false;
    drawRadar();
  });
}

function pickRadarPoint(px, py) {
  const size = Math.max(240, Math.floor(radarCssSize || canvas?.getBoundingClientRect().width || 0));
  if (!size) return null;

  const cx = size / 2;
  const cy = size / 2;
  const baseRadius = size * 0.34;
  const values = getStatusValues();
  const maxV = Math.max(10, ...values);

  let found = null;

  for (let i = 0; i < STATUS_LABELS.length; i++) {
    const ang = -Math.PI / 2 + i * ((2 * Math.PI) / STATUS_LABELS.length);
    const rr = baseRadius * (values[i] / maxV);
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    const dist = Math.hypot(px - x, py - y);

    if (dist <= 18) {
      found = {
        key: STATUS_KEYS[i],
        label: STATUS_LABELS[i],
        value: values[i],
        x,
        y,
        dist,
      };
      break;
    }
  }

  return found;
}

function onRadarPointer(evt) {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = radarCssSize > 0 ? radarCssSize / rect.width : 1;
  const scaleY = radarCssSize > 0 ? radarCssSize / rect.height : 1;
  const px = (evt.clientX - rect.left) * scaleX;
  const py = (evt.clientY - rect.top) * scaleY;

  const hit = pickRadarPoint(px, py);

  if (!hit) {
    hideRadarTip();
    return;
  }

  showRadarTip(`${hit.label}: ${hit.value}`, hit.x, hit.y);
}

async function exportState() {
  try {
    const payload = collectState();
    payload.photo = await getPhotoFromDb().catch(() => "");
    payload.exportedAt = new Date().toISOString();

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (inpName?.value.trim() || "personagem")
      .replace(/[^a-z0-9-_]+/gi, "_")
      .replace(/^_+|_+$/g, "");

    a.href = url;
    a.download = `${safeName || "personagem"}_cartao_rpg.json`;
    a.click();

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    showSaveError();
  }
}

// Importa um JSON como uma FICHA NOVA (não sobrescreve a ficha atual).
async function importStateFile(file) {
  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!imported || typeof imported !== "object") {
      throw new Error("JSON inválido");
    }

    persistNowImmediate(); // salva a ficha atual antes

    const id = genCharacterId();
    const name = (imported.name || "").trim() || `Personagem ${characterIndex.characters.length + 1}`;

    saveCharacterData(id, imported); // applyState/migrateLegacy normaliza ao carregar
    characterIndex.characters.push(makeIndexEntry(id, name));

    activeCharacterId = id;
    characterIndex.activeCharacterId = id;
    saveIndex();

    if (typeof imported.photo === "string" && imported.photo) {
      await savePhotoToDb(imported.photo, id);
    }

    await loadActiveCharacterIntoUI();
    refreshCharacterSelect();
    showToast("Ficha importada como nova ficha.", "good");
  } catch (err) {
    console.error(err);
    showToast("Arquivo JSON inválido ou corrompido. A ficha atual foi mantida.", "error", 5000);
  }
}

function bindInputsToSave() {
  inpName?.addEventListener("input", () => {
    syncHeaderStyle();
    syncActiveCharacterName();
    saveAll();
  });

  inpGuild?.addEventListener("input", saveAll);

  for (const id of EDITABLE_FIELD_IDS) {
    const input = $(id);
    if (!input) continue;

    input.addEventListener("input", () => {
      applyDerivedStats();
      saveAll();
    });
  }

  for (const key of STATUS_KEYS) {
    const el = $("st_" + key);
    if (!el) continue;

    el.addEventListener("input", () => {
      applyDerivedStats();
      saveAll();
    });
  }

  for (const id of MANUAL_CALC_FIELD_IDS) {
    const input = $(id);
    if (!input) continue;

    input.addEventListener("input", () => {
      if (!calcOverrideState.enabled) return;
      refreshCalcOverrideDeltasFromInputs();
      saveAll();
    });
  }

  [
    noteStory,
    notePersonality,
    noteAppearance,
    noteGoals,
    noteNpcs,
    noteQuests,
    noteInv,
    noteSkills,
    noteMagicSimple,
    noteMagicComplex,
    noteMagicAdvanced,
    noteDiary,
    noteFree,
  ].forEach((el) => {
    el?.addEventListener("input", saveAll);
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab);
      queueRadarDraw();
      saveAll();
    });
  });

  canvas?.addEventListener("pointermove", onRadarPointer);
  canvas?.addEventListener("pointerdown", onRadarPointer);
  canvas?.addEventListener("pointerleave", hideRadarTip);
}

// Corrige o valor do campo para dentro do limite ao sair dele (blur).
// O próprio valor "saltando" para o teto/piso já serve de feedback visual;
// a Fase 1 acrescenta um toast explicando o ajuste.
function clampInputToRange(input, min, max) {
  if (!input) return;
  // Campo vazio: deixa como está (o placeholder cuida do "0"/"1").
  if (input.value === "") return;

  const raw = toInt(input.value, min);
  const clamped = clamp(raw, min, max);
  input.value = String(clamped);

  if (clamped !== raw) {
    showToast(`Valor ajustado para ${clamped} (limite ${min}–${max}).`, "warn", 2600);
  }
}

function initFieldClamping() {
  // Campos com faixa fixa do sistema.
  for (const [id, [min, max]] of Object.entries(CLAMPED_FIELD_RANGES)) {
    const input = $(id);
    if (!input) continue;

    input.addEventListener("change", () => {
      clampInputToRange(input, min, max);
      applyDerivedStats();
      saveAll();
    });
  }

  // Status (FOR..RES): impede valores negativos/absurdos, mantém 0-999.
  for (const key of STATUS_KEYS) {
    const input = $("st_" + key);
    if (!input) continue;

    input.addEventListener("change", () => {
      clampInputToRange(input, 0, 999);
      applyDerivedStats();
      saveAll();
    });
  }
}

function resetForm() {
  // Reseta a FICHA ATIVA (mantém as outras e o backup v8). persistNow() no fim
  // grava a ficha ativa zerada no seu próprio slot.
  progressionState = clonePlain(defaults.progression);
  levelingState = clonePlain(defaults.leveling);
  catalystAttributes = [];
  calcOverrideState = clonePlain(defaults.calcOverrides);
  calcAdjustmentState = clonePlain(defaults.calcAdjustments);
  currentBaseCalcValues = {};
  previousDerivedSnapshot = null;
  shouldAutoRaiseResources = false;

  if (inpName) inpName.value = defaults.name;
  if (inpGuild) inpGuild.value = defaults.guild;

  $("in_idade").value = defaults.fields.idade;
  $("in_altura").value = defaults.fields.altura;
  $("in_raca").value = defaults.fields.raca;
  $("in_classe").value = defaults.fields.classe;
  $("in_nv").value = defaults.fields.nv;
  $("in_xp").value = defaults.fields.xp;
  $("in_hp_cur").value = defaults.fields.hpCur;
  $("in_pm_cur").value = defaults.fields.pmCur;
  $("in_hpp_cur").value = defaults.fields.hppCur;
  $("in_pi").value = defaults.fields.pi;
  $("in_ca_bonus").value = defaults.fields.caBonus;
  $("in_weapon_level").value = defaults.fields.weaponLevel;
  if ($("in_catalyst_level")) $("in_catalyst_level").value = defaults.catalyst.level;
  if ($("in_catalyst_xp")) $("in_catalyst_xp").value = defaults.catalyst.xp;

  for (const key of STATUS_KEYS) {
    const el = $("st_" + key);
    if (el) el.value = defaults.stats[key];
  }

  syncRunePair(rPhys, nPhys, defaults.runes.phys);
  syncRunePair(rArc, nArc, defaults.runes.arc);
  syncRunePair(rSpi, nSpi, defaults.runes.spi);

  if (noteStory) noteStory.value = defaults.notes.story;
  if (notePersonality) notePersonality.value = defaults.notes.personality;
  if (noteAppearance) noteAppearance.value = defaults.notes.appearance;
  if (noteGoals) noteGoals.value = defaults.notes.goals;
  if (noteNpcs) noteNpcs.value = defaults.notes.npcs;
  if (noteQuests) noteQuests.value = defaults.notes.quests;
  if (noteInv) noteInv.value = defaults.notes.inv;
  if (noteSkills) noteSkills.value = defaults.notes.skills;
  if (noteMagicSimple) noteMagicSimple.value = defaults.notes.magicSimple;
  if (noteMagicComplex) noteMagicComplex.value = defaults.notes.magicComplex;
  if (noteMagicAdvanced) noteMagicAdvanced.value = defaults.notes.magicAdvanced;
  if (noteDiary) noteDiary.value = defaults.notes.diary;
  if (noteFree) noteFree.value = defaults.notes.free;

  syncCalcOverrideUi();
  setActiveTab(defaults.activeTab);
  setPhoto("");
  clearPhotoFromDb().catch(() => {});
  regenGlyphs();
  syncHeaderStyle();
  closeLevelUpModal();
  applyDerivedStats();
  queueRadarDraw();
  setSaveState("salvo");
  persistNow();
}

const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB antes de comprimir

async function handlePhotoChange() {
  const file = inpPhoto?.files?.[0];
  if (inpPhoto) inpPhoto.value = "";
  if (!file) return;

  if (!file.type || !file.type.startsWith("image/")) {
    showToast("Escolha um arquivo de imagem (JPG, PNG, WebP...).", "warn");
    return;
  }

  if (file.size > MAX_PHOTO_BYTES) {
    showToast("Imagem muito grande (máx. 20 MB). Tente uma menor.", "warn", 5000);
    return;
  }

  try {
    setSaveState("salvando");
    const raw = await fileToDataUrl(file);
    const compressed = await compressImageDataUrl(raw, 900, 0.84);
    await savePhotoToDb(compressed);
    setPhoto(compressed);
    saveAll();
    showToast("Foto salva neste aparelho.", "good", 2600);
  } catch (err) {
    console.error(err);
    showToast("Não foi possível processar essa imagem.", "error", 5000);
    setSaveState("erro ao salvar");
  }
}

// Insere um cabeçalho de sessão datado no topo do diário. Mantém tudo em um
// único campo de texto (note_diary), então a migração de fichas antigas é trivial.
function addSessionEntry() {
  const el = noteDiary || $("note_diary");
  if (!el) return;

  const now = new Date();
  const data = now.toLocaleDateString("pt-BR");
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const header = `── Sessão ${data} • ${hora} ──\n`;

  const current = el.value;
  el.value = current ? `${header}\n${current}` : header;

  // Abre o card do diário caso esteja recolhido e leva o foco para escrever.
  el.closest("details")?.setAttribute("open", "");
  el.focus();
  try {
    el.setSelectionRange(header.length, header.length);
  } catch {}

  // Dispara o autosave já existente.
  el.dispatchEvent(new Event("input", { bubbles: true }));
  showToast("Nova entrada de sessão adicionada ao diário.", "good", 2400);
}

async function removePhoto() {
  try {
    await clearPhotoFromDb();
    setPhoto("");
    saveAll();
  } catch (err) {
    console.error(err);
    showSaveError();
  }
}

async function init() {
  if (!hasCalcModules()) {
    console.warn("RaceDB ou CharacterCalc não foram carregados. Verifique a ordem dos scripts.");
  }

  fillRaceList();
  initRuneSync();
  initLevelUpModal();
  bindInputsToSave();
  initFieldClamping();
  syncCalcOverrideUi();

  inpPhoto?.addEventListener("change", handlePhotoChange);
  btnRemovePhoto?.addEventListener("click", removePhoto);
  $("btnExport")?.addEventListener("click", exportState);

  $("inpImport")?.addEventListener("change", async (evt) => {
    const file = evt.target.files?.[0];
    evt.target.value = "";
    if (file) await importStateFile(file);
  });

  $("btnNewSessionEntry")?.addEventListener("click", addSessionEntry);

  $("btnReset")?.addEventListener("click", () => {
    const ok = window.confirm(
      "Resetar a ficha apaga TODOS os dados deste personagem (status, notas, foto) deste aparelho.\n\n" +
        "Exporte um backup em JSON antes, se quiser guardar.\n\nDeseja mesmo resetar?"
    );
    if (ok) resetForm();
  });
  $("btnPrint")?.addEventListener("click", () => window.print());
  btnToggleCalcOverride?.addEventListener("click", toggleCalcOverrideMode);

  // ----- Gerenciador de fichas (v9) -----
  $("characterSelect")?.addEventListener("change", (evt) => {
    switchCharacter(evt.target.value);
  });
  $("btnNewCharacter")?.addEventListener("click", onNewCharacter);
  $("btnDuplicateCharacter")?.addEventListener("click", duplicateActiveCharacter);
  $("btnRenameCharacter")?.addEventListener("click", renameActiveCharacter);
  $("btnDeleteCharacter")?.addEventListener("click", deleteActiveCharacter);

  // Carrega o índice; migra a ficha única antiga (v8) na primeira vez.
  characterIndex = loadIndex();
  let migration = null;
  if (!characterIndex) {
    migration = migrateSingleCharacterToMultiCharacter();
  }

  activeCharacterId = characterIndex.activeCharacterId;
  if (!getCharacterEntry(activeCharacterId)) {
    activeCharacterId = characterIndex.characters[0].id;
    characterIndex.activeCharacterId = activeCharacterId;
    saveIndex();
  }

  // Move a foto da ficha única antiga para a primeira ficha (só na migração).
  if (migration?.migratedFromLegacy) {
    try {
      const legacyPhoto = await getLegacyPhoto();
      if (legacyPhoto) await savePhotoToDb(legacyPhoto, activeCharacterId);
    } catch (err) {
      console.error(err);
    }
  }

  const data = loadCharacterData(activeCharacterId) || clonePlain(defaults);
  applyState(data);
  refreshCharacterSelect();

  try {
    setPhoto(await getPhotoFromDb(activeCharacterId));
  } catch {
    setPhoto("");
  }

  applyDerivedStats();
  setSaveState("salvo");
  queueRadarDraw();
}

window.addEventListener("DOMContentLoaded", init, { once: true });

window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(drawRadar);
});

window.addEventListener("pageshow", () => setTimeout(drawRadar, 0));
window.addEventListener("orientationchange", () => setTimeout(drawRadar, 180));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    persistNow();
  } else {
    queueRadarDraw();
  }
});

if (window.ResizeObserver && radarWrap) {
  const ro = new ResizeObserver(() => queueRadarDraw());
  ro.observe(radarWrap);
}