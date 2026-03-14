const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "rpg_card_v8_state";
const PHOTO_DB_NAME = "rpg_card_v6_db";
const PHOTO_STORE = "assets";
const PHOTO_KEY = "character_photo";

const SAVE_DELAY = 180;
const STATUS_KEYS = ["for", "des", "con", "int", "sab", "car", "adp", "res"];
const STATUS_LABELS = ["FOR", "DES", "CON", "INT", "SAB", "CAR", "ADP", "RES"];

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
  "in_weapon_level",
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
  leveling: {
    pendingLevelPoints: 0,
    pendingPb: 0,
    lastProcessedLevel: 1,
  },
  runes: {
    phys: 70,
    arc: 55,
    spi: 80,
  },
  notes: {
    story: "",
    inv: "",
    skills: "",
    npcs: "",
  },
};

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
const noteInv = $("note_inv");
const noteSkills = $("note_skills");
const noteNpcs = $("note_npcs");

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
const btnApplyLevelUp = $("btnApplyLevelUp");
const levelUpChecklist = $("levelUpChecklist");

radarTip.id = "radarTip";
radarTip.className = "radarTip";
radarTip.hidden = true;
radarWrap?.appendChild(radarTip);

let photoDataUrl = "";
let saveTimer = 0;
let resizeRaf = 0;
let radarCssSize = 0;
let radarScheduled = false;
let photoDbPromise = null;
let progressionState = clonePlain(defaults.progression);
let levelingState = clonePlain(defaults.leveling);
let previousDerivedSnapshot = null;
let shouldAutoRaiseResources = false;
let suppressLevelUpPopup = false;

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

async function savePhotoToDb(dataUrl) {
  const db = await openPhotoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put(dataUrl, PHOTO_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Falha ao salvar foto"));
  });
}

async function getPhotoFromDb() {
  const db = await openPhotoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).get(PHOTO_KEY);

    req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : "");
    req.onerror = () => reject(req.error || new Error("Falha ao carregar foto"));
  });
}

async function clearPhotoFromDb() {
  const db = await openPhotoDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(PHOTO_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Falha ao remover foto"));
  });
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

  if (derived) {
    if (outHp) outHp.textContent = `${hpCur}/${derived.hpMax}`;
    if (outPm) outPm.textContent = `${pmCur}/${derived.pmMax}`;
    if (outHpp) outHpp.textContent = `${hppCur}/${derived.hppMax}`;
    if (outCa) outCa.textContent = String(derived.ca);
  } else {
    if (outHp) outHp.textContent = `${hpCur}/?`;
    if (outPm) outPm.textContent = `${pmCur}/?`;
    if (outHpp) outHpp.textContent = `${hppCur}/?`;
    if (outCa) outCa.textContent = "?";
  }

  if (outXpNext) outXpNext.textContent = xpInfo?.total == null ? "—" : String(xpInfo.total);
  if (outXpLeft) outXpLeft.textContent = xpInfo?.remaining == null ? "—" : String(xpInfo.remaining);
}

function getLevelUpPointInput(key) {
  return $("lvl_" + key);
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

function getLevelUpSelectionLimit() {
  const freePoints = Math.max(0, toInt(levelingState.pendingLevelPoints, 0));
  const pbExtra = lvlUsePb?.checked && (levelingState.pendingPb || 0) > 0 ? 1 : 0;
  return freePoints + pbExtra;
}

function setLevelUpPoint(key, value) {
  const input = getLevelUpPointInput(key);
  if (!input) return;
  input.value = String(Math.max(0, toInt(value, 0)));
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

  if (lvlPointsLeft) lvlPointsLeft.textContent = String(levelingState.pendingLevelPoints || 0);
  if (lvlPbLeft) lvlPbLeft.textContent = String(levelingState.pendingPb || 0);
  if (lvlSelectedCount) lvlSelectedCount.textContent = `${totalAllocated}/${limit}`;

  if (lvlUsePb) {
    lvlUsePb.disabled = (levelingState.pendingPb || 0) <= 0;
    if (lvlUsePb.disabled) lvlUsePb.checked = false;
  }

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
}

function openLevelUpModalIfNeeded() {
  if (!levelUpModal || !levelUpChecklist) return;
  if ((levelingState.pendingLevelPoints || 0) <= 0) return;

  clearLevelUpChecks();
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
  const wantsPb = Boolean(lvlUsePb?.checked && (levelingState.pendingPb || 0) > 0);
  const maxAlloc = freePoints + (wantsPb ? 1 : 0);

  if (totalAllocated <= 0) return;
  if (totalAllocated > maxAlloc) return;

  const freeSpent = Math.min(totalAllocated, freePoints);
  const pbSpent = totalAllocated > freeSpent ? 1 : 0;

  if (freeSpent > freePoints) return;
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

  shouldAutoRaiseResources = true;
  closeLevelUpModal();
  applyDerivedStats();
  saveAll();

  if ((levelingState.pendingLevelPoints || 0) > 0) {
    openLevelUpModalIfNeeded();
  }
}

function processLevelUps(level) {
  const currentLevel = Math.max(1, toInt(level, 1));
  const lastLevel = Math.max(1, toInt(levelingState.lastProcessedLevel, 1));

  if (currentLevel > lastLevel) {
    const gained = currentLevel - lastLevel;
    levelingState.pendingLevelPoints = toInt(levelingState.pendingLevelPoints, 0) + gained * 2;
    levelingState.pendingPb = toInt(levelingState.pendingPb, 0) + gained;
    levelingState.lastProcessedLevel = currentLevel;
    shouldAutoRaiseResources = true;

    if (!suppressLevelUpPopup) {
      setTimeout(openLevelUpModalIfNeeded, 0);
    }
  } else if (currentLevel < lastLevel) {
    levelingState.lastProcessedLevel = currentLevel;
  }
}

function applyDerivedStats() {
  const stats = getCurrentStatsObject();
  const mods = getCurrentMods(stats);

  let level = getCurrentLevel();
  let xp = Math.max(0, toInt($("in_xp")?.value, 0));
  const weaponLevel = getCurrentWeaponLevel();

  if (window.CharacterCalc?.normalizeLevelAndXp) {
    const normalized = window.CharacterCalc.normalizeLevelAndXp({
      level,
      xp,
    });

    level = clamp(toInt(normalized.level, level), 1, 60);
    xp = Math.max(0, toInt(normalized.xp, xp));

    if ($("in_nv")) $("in_nv").value = String(level);
    if ($("in_xp")) $("in_xp").value = String(xp);
  }

  processLevelUps(level);

  syncStatMods(mods);
  syncRuneTiers();

  let race = null;
  let derived = null;
  let xpInfo = {
    level,
    current: xp,
    total: null,
    remaining: null,
    percent: null,
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
    });

    sanitizeCurrentResources(derived, previousDerivedSnapshot, shouldAutoRaiseResources);
    shouldAutoRaiseResources = false;

    setReadOnlyValue("in_hp_max", derived.hpMax);
    setReadOnlyValue("in_pm_max", derived.pmMax);
    setReadOnlyValue("in_hpp_max", derived.hppMax);
    setReadOnlyValue("in_ca", derived.ca);

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
  }

  previousDerivedSnapshot = derived
    ? {
        level: derived.level,
        hpMax: derived.hpMax,
        pmMax: derived.pmMax,
        hppMax: derived.hppMax,
      }
    : null;

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
      weaponLevel: $("in_weapon_level")?.value || "",
    },
    stats: STATUS_KEYS.reduce((acc, key) => {
      acc[key] = $("st_" + key)?.value || "";
      return acc;
    }, {}),
    progression: clonePlain(progressionState),
    leveling: clonePlain(levelingState),
    runes: {
      phys: clamp(toInt(rPhys?.value, 0), 0, 100),
      arc: clamp(toInt(rArc?.value, 0), 0, 100),
      spi: clamp(toInt(rSpi?.value, 0), 0, 100),
    },
    notes: {
      story: noteStory?.value || "",
      inv: noteInv?.value || "",
      skills: noteSkills?.value || "",
      npcs: noteNpcs?.value || "",
    },
  };
}

function migrateLegacy(state) {
  const merged = clonePlain(defaults);

  if (!state || typeof state !== "object") {
    return merged;
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

  merged.leveling.pendingLevelPoints = savedLeveling ? Math.max(0, toInt(savedLeveling.pendingLevelPoints, 0)) : 0;
  merged.leveling.pendingPb = savedLeveling ? Math.max(0, toInt(savedLeveling.pendingPb, 0)) : 0;
  merged.leveling.lastProcessedLevel = savedLeveling
    ? Math.max(1, toInt(savedLeveling.lastProcessedLevel, mergedLevel))
    : mergedLevel;

  if (state.runes && typeof state.runes === "object") {
    merged.runes.phys = clamp(toInt(state.runes.phys, merged.runes.phys), 0, 100);
    merged.runes.arc = clamp(toInt(state.runes.arc, merged.runes.arc), 0, 100);
    merged.runes.spi = clamp(toInt(state.runes.spi, merged.runes.spi), 0, 100);
  }

  if (state.notes && typeof state.notes === "object") {
    merged.notes.story = state.notes.story ?? merged.notes.story;
    merged.notes.inv = state.notes.inv ?? merged.notes.inv;
    merged.notes.skills = state.notes.skills ?? merged.notes.skills;
    merged.notes.npcs = state.notes.npcs ?? merged.notes.npcs;
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
  $("in_weapon_level").value = state.fields.weaponLevel;

  for (const key of STATUS_KEYS) {
    const el = $("st_" + key);
    if (el) el.value = state.stats[key];
  }

  progressionState = clonePlain(state.progression);
  levelingState = clonePlain(state.leveling);

  syncRunePair(rPhys, nPhys, state.runes.phys);
  syncRunePair(rArc, nArc, state.runes.arc);
  syncRunePair(rSpi, nSpi, state.runes.spi);

  if (noteStory) noteStory.value = state.notes.story;
  if (noteInv) noteInv.value = state.notes.inv;
  if (noteSkills) noteSkills.value = state.notes.skills;
  if (noteNpcs) noteNpcs.value = state.notes.npcs;

  suppressLevelUpPopup = true;
  applyDerivedStats();
  suppressLevelUpPopup = false;

  setActiveTab(state.activeTab);
  queueRadarDraw();
}

function persistNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
    setSaveState("salvo");
  } catch (err) {
    console.error(err);
    showSaveError();
  }
}

function saveAll() {
  setSaveState("salvando");
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistNow, SAVE_DELAY);
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
    const limit = getLevelUpSelectionLimit();
    let total = getAllocatedLevelUpTotal();

    if (total > limit) {
      for (const key of STATUS_KEYS) {
        while (total > limit && toInt(getLevelUpPointInput(key)?.value, 0) > 0) {
          setLevelUpPoint(key, toInt(getLevelUpPointInput(key)?.value, 0) - 1);
          total = getAllocatedLevelUpTotal();
        }
      }
    }

    refreshLevelUpModal();
  });

  levelUpChecklist.querySelectorAll(".lvl-step").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.stat;
      const action = button.dataset.action;
      if (!key || !action) return;
      changeLevelUpPoint(key, action === "plus" ? 1 : -1);
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
  const size = Math.max(240, Math.floor(radarCssSize || canvas?.getBoundingClientRect().width || 440));
  const cx = size / 2;
  const cy = size / 2;
  const baseRadius = size * 0.34;
  const values = getStatusValues();
  const maxV = Math.max(10, ...values);
  const hit = 16;

  let best = null;

  for (let i = 0; i < STATUS_LABELS.length; i++) {
    const ang = -Math.PI / 2 + i * ((2 * Math.PI) / STATUS_LABELS.length);
    const rr = baseRadius * (values[i] / maxV);
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    const d = Math.hypot(px - x, py - y);

    if (d <= hit && (!best || d < best.d)) {
      best = { i, d, x, y, label: STATUS_LABELS[i], value: values[i] };
    }
  }

  return best;
}

function onRadarPointer(evt) {
  if (!canvas || !radarWrap) return;

  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const picked = pickRadarPoint(x, y);

  if (!picked) {
    hideRadarTip();
    return;
  }

  const wrapRect = radarWrap.getBoundingClientRect();
  showRadarTip(
    `${picked.label}: ${picked.value}`,
    rect.left + picked.x - wrapRect.left,
    rect.top + picked.y - wrapRect.top
  );
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

async function importStateFile(file) {
  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    applyState(imported);

    if (typeof imported.photo === "string" && imported.photo) {
      await savePhotoToDb(imported.photo);
      setPhoto(imported.photo);
    } else {
      await clearPhotoFromDb().catch(() => {});
      setPhoto("");
    }

    saveAll();
  } catch (err) {
    console.error(err);
    alert("Arquivo JSON inválido ou corrompido.");
  }
}

function bindInputsToSave() {
  inpName?.addEventListener("input", () => {
    syncHeaderStyle();
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

  [noteStory, noteInv, noteSkills, noteNpcs].forEach((el) => {
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

function resetForm() {
  localStorage.removeItem(STORAGE_KEY);
  progressionState = clonePlain(defaults.progression);
  levelingState = clonePlain(defaults.leveling);
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
  $("in_weapon_level").value = defaults.fields.weaponLevel;

  for (const key of STATUS_KEYS) {
    const el = $("st_" + key);
    if (el) el.value = defaults.stats[key];
  }

  syncRunePair(rPhys, nPhys, defaults.runes.phys);
  syncRunePair(rArc, nArc, defaults.runes.arc);
  syncRunePair(rSpi, nSpi, defaults.runes.spi);

  if (noteStory) noteStory.value = defaults.notes.story;
  if (noteInv) noteInv.value = defaults.notes.inv;
  if (noteSkills) noteSkills.value = defaults.notes.skills;
  if (noteNpcs) noteNpcs.value = defaults.notes.npcs;

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

async function handlePhotoChange() {
  const file = inpPhoto?.files?.[0];
  if (inpPhoto) inpPhoto.value = "";
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/")) return;

  try {
    setSaveState("salvando");
    const raw = await fileToDataUrl(file);
    const compressed = await compressImageDataUrl(raw, 900, 0.84);
    await savePhotoToDb(compressed);
    setPhoto(compressed);
    saveAll();
  } catch (err) {
    console.error(err);
    alert("Não foi possível processar essa imagem.");
    showSaveError();
  }
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

  inpPhoto?.addEventListener("change", handlePhotoChange);
  btnRemovePhoto?.addEventListener("click", removePhoto);
  $("btnExport")?.addEventListener("click", exportState);

  $("inpImport")?.addEventListener("change", async (evt) => {
    const file = evt.target.files?.[0];
    evt.target.value = "";
    if (file) await importStateFile(file);
  });

  $("btnReset")?.addEventListener("click", resetForm);
  $("btnPrint")?.addEventListener("click", () => window.print());

  const loaded = loadAll();

  if (loaded) {
    applyState(loaded);
  } else {
    resetForm();
  }

  try {
    const photo = await getPhotoFromDb();
    setPhoto(photo);
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