const $ = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const STORAGE_KEY = "rpg_card_v5_state";
const PHOTO_DB_NAME = "rpg_card_v5_db";
const PHOTO_STORE = "assets";
const PHOTO_KEY = "character_photo";
const SAVE_DELAY = 180;
const STATUS_KEYS = ["for", "des", "con", "int", "sab", "car", "adp", "res"];
const STATUS_LABELS = ["FOR", "DES", "CON", "INT", "SAB", "CAR", "ADP", "RES"];

const fieldMap = [
  { id: "in_nv", out: "outNv", fallback: "1" },
  { id: "in_xp", out: "outXp", fallback: "0" },
  { id: "in_pm", out: "outPm", fallback: "5" },
  { id: "in_ca", out: "outCa", fallback: "10" },
  { id: "in_pi", out: "outPi", fallback: "0" },
  { id: "in_idade", out: "outIdade", fallback: "?" },
  { id: "in_altura", out: "outAltura", fallback: "?" },
  { id: "in_raca", out: "outRaca", fallback: "?" },
  { id: "in_classe", out: "outClasse", fallback: "?" },
];

const defaults = {
  name: "",
  guild: "",
  activeTab: "summary",
  glyphTop: "",
  glyphBottom: "",
  fields: {
    in_idade: "",
    in_altura: "",
    in_raca: "",
    in_classe: "",
    in_nv: "1",
    in_xp: "0",
    in_pm: "5",
    in_ca: "10",
    in_pi: "0",
  },
  hp: { cur: 10, max: 10 },
  stats: { for: "0", des: "0", con: "0", int: "0", sab: "0", car: "0", adp: "0", res: "0" },
  runes: { phys: 70, arc: 55, spi: 80 },
  notes: { story: "", inv: "", skills: "", npcs: "" },
};

const inpName = $("inpName");
const inpGuild = $("inpGuild");
const inHpCur = $("in_hp_cur");
const inHpMax = $("in_hp_max");
const outHp = $("outHp");

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
radarTip.id = "radarTip";
radarTip.className = "radarTip";
radarTip.hidden = true;
radarWrap?.appendChild(radarTip);

let photoDataUrl = "";
let saveTimer = 0;
let resizeRaf = 0;
let radarCssSize = 0;
let photoDbPromise = null;

function hasCalcModules() {
  return Boolean(
    window.RaceDB &&
    typeof window.RaceDB.findRace === "function" &&
    window.CharacterCalc &&
    typeof window.CharacterCalc.calculate === "function"
  );
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

function syncHpOutput() {
  const cur = clamp(parseInt(inHpCur?.value || "0", 10) || 0, 0, 999999);
  const max = clamp(parseInt(inHpMax?.value || "0", 10) || 0, 0, 999999);
  if (outHp) outHp.textContent = `${cur}/${max}`;
}

function syncMappedOutputs() {
  for (const { id, out, fallback } of fieldMap) {
    const input = $(id);
    const output = $(out);
    if (!input || !output) continue;
    const value = typeof input.value === "string" ? input.value.trim() : "";
    output.textContent = value || fallback;
  }
  syncHpOutput();
}

function getCurrentStatsObject() {
  const stats = {};
  for (const key of STATUS_KEYS) {
    stats[key] = $("st_" + key)?.value || "0";
  }
  return stats;
}

function applyDerivedStats() {
  syncMappedOutputs();

  if (!hasCalcModules()) {
    return;
  }

  const raceInputValue = $("in_raca")?.value || "";
  const race = window.RaceDB.findRace(raceInputValue);

  if (!race) {
    return;
  }

  const derived = window.CharacterCalc.calculate({
    level: $("in_nv")?.value || "1",
    stats: getCurrentStatsObject(),
    race,
  });

  if (inHpMax) inHpMax.value = String(derived.hpMax);
  if ($("in_pm")) $("in_pm").value = String(derived.pm);
  if ($("in_ca")) $("in_ca").value = String(derived.ca);

  const currentHp = clamp(parseInt(inHpCur?.value || "0", 10) || 0, 0, 999999);
  if (inHpCur && (!inHpCur.value || currentHp > derived.hpMax)) {
    inHpCur.value = String(derived.hpMax);
  }

  syncMappedOutputs();
}

function getStatusValues() {
  return STATUS_KEYS.map((k) => clamp(parseFloat($("st_" + k)?.value || "0") || 0, 0, 999));
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
  const fields = {};
  for (const { id } of fieldMap) {
    const el = $(id);
    fields[id] = el ? el.value : "";
  }

  const stats = {};
  for (const key of STATUS_KEYS) {
    const el = $("st_" + key);
    stats[key] = el ? el.value : "0";
  }

  return {
    v: 5,
    name: inpName?.value || "",
    guild: inpGuild?.value || "",
    activeTab: document.querySelector(".tab.is-active")?.dataset.tab || "summary",
    glyphTop: $("glyphTopTrack")?.textContent || "",
    glyphBottom: $("glyphBottomTrack")?.textContent || "",
    photoStored: Boolean(photoDataUrl),
    fields,
    hp: {
      cur: clamp(parseInt(inHpCur?.value || "0", 10) || 0, 0, 999999),
      max: clamp(parseInt(inHpMax?.value || "0", 10) || 0, 0, 999999),
    },
    stats,
    runes: {
      phys: clamp(parseInt(rPhys?.value || "0", 10) || 0, 0, 100),
      arc: clamp(parseInt(rArc?.value || "0", 10) || 0, 0, 100),
      spi: clamp(parseInt(rSpi?.value || "0", 10) || 0, 0, 100),
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
  if (!state || typeof state !== "object") return structuredClone(defaults);

  const merged = structuredClone(defaults);
  merged.name = state.name ?? merged.name;
  merged.guild = state.guild ?? merged.guild;
  merged.activeTab = state.activeTab === "notes" ? "notes" : "summary";
  merged.glyphTop = state.glyphTop ?? merged.glyphTop;
  merged.glyphBottom = state.glyphBottom ?? merged.glyphBottom;

  if (state.fields && typeof state.fields === "object") {
    Object.assign(merged.fields, state.fields);
  }

  if (state.fields && typeof state.fields.in_hp !== "undefined" && !state.hp) {
    const hp = clamp(parseInt(state.fields.in_hp || "0", 10) || 0, 0, 999999);
    merged.hp = { cur: hp, max: hp };
    delete merged.fields.in_hp;
  }

  if (state.hp && typeof state.hp === "object") {
    merged.hp.cur = clamp(parseInt(state.hp.cur ?? merged.hp.cur, 10) || 0, 0, 999999);
    merged.hp.max = clamp(parseInt(state.hp.max ?? merged.hp.max, 10) || 0, 0, 999999);
  }

  if (state.stats && typeof state.stats === "object") {
    for (const key of STATUS_KEYS) {
      merged.stats[key] = String(state.stats[key] ?? merged.stats[key]);
    }
  }

  if (state.runes && typeof state.runes === "object") {
    merged.runes.phys = clamp(parseInt(state.runes.phys ?? merged.runes.phys, 10) || 0, 0, 100);
    merged.runes.arc = clamp(parseInt(state.runes.arc ?? merged.runes.arc, 10) || 0, 0, 100);
    merged.runes.spi = clamp(parseInt(state.runes.spi ?? merged.runes.spi, 10) || 0, 0, 100);
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

  for (const { id } of fieldMap) {
    const el = $(id);
    if (el) el.value = state.fields[id] ?? defaults.fields[id] ?? "";
  }

  if (inHpCur) inHpCur.value = String(state.hp.cur);
  if (inHpMax) inHpMax.value = String(state.hp.max);

  for (const key of STATUS_KEYS) {
    const el = $("st_" + key);
    if (el) el.value = state.stats[key];
  }

  syncRunePair(rPhys, nPhys, state.runes.phys);
  syncRunePair(rArc, nArc, state.runes.arc);
  syncRunePair(rSpi, nSpi, state.runes.spi);

  if (noteStory) noteStory.value = state.notes.story;
  if (noteInv) noteInv.value = state.notes.inv;
  if (noteSkills) noteSkills.value = state.notes.skills;
  if (noteNpcs) noteNpcs.value = state.notes.npcs;

  applyDerivedStats();
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
  const v = clamp(parseInt(value || "0", 10) || 0, 0, 100);
  rangeEl.value = String(v);
  numEl.value = String(v);
}

function initRuneSync() {
  [[rPhys, nPhys], [rArc, nArc], [rSpi, nSpi]].forEach(([rangeEl, numEl]) => {
    if (!rangeEl || !numEl) return;

    rangeEl.addEventListener("input", () => {
      syncRunePair(rangeEl, numEl, rangeEl.value);
      saveAll();
    });

    numEl.addEventListener("input", () => {
      syncRunePair(rangeEl, numEl, numEl.value);
      saveAll();
    });
  });
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

function drawRadar() {
  if (!canvas || !ctx) return;
  const size = resizeRadarForDisplay();
  if (!size) {
    requestAnimationFrame(drawRadar);
    return;
  }

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

function queueRadarDraw() {
  requestAnimationFrame(() => {
    drawRadar();
    requestAnimationFrame(drawRadar);
  });
  setTimeout(drawRadar, 90);
  setTimeout(drawRadar, 220);
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
    const state = migrateLegacy(imported);
    applyState(state);

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

  for (const { id, out, fallback } of fieldMap) {
    const input = $(id);
    const output = $(out);
    if (!input || !output) continue;

    input.addEventListener("input", () => {
      const value = input.value.trim();
      output.textContent = value || fallback;

      if (id === "in_raca" || id === "in_nv") {
        applyDerivedStats();
      } else {
        syncHpOutput();
      }

      saveAll();
    });
  }

  [inHpCur, inHpMax].forEach((el) => {
    el?.addEventListener("input", () => {
      syncHpOutput();
      saveAll();
    });
  });

  STATUS_KEYS.forEach((key) => {
    const el = $("st_" + key);
    if (!el) return;

    el.addEventListener("input", () => {
      drawRadar();
      applyDerivedStats();
      saveAll();
    });
  });

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

  if (inpName) inpName.value = defaults.name;
  if (inpGuild) inpGuild.value = defaults.guild;

  for (const { id } of fieldMap) {
    const el = $(id);
    if (el) el.value = defaults.fields[id] ?? "";
  }

  if (inHpCur) inHpCur.value = String(defaults.hp.cur);
  if (inHpMax) inHpMax.value = String(defaults.hp.max);

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
    console.warn("RaceDB ou CharacterCalc não foram carregados. Verifique a ordem dos scripts no HTML.");
  }

  initRuneSync();
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

window.addEventListener("load", init, { once: true });
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(drawRadar);
});
window.addEventListener("pageshow", () => setTimeout(drawRadar, 0));
window.addEventListener("orientationchange", () => setTimeout(drawRadar, 180));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) queueRadarDraw();
});

if (window.ResizeObserver && radarWrap) {
  const ro = new ResizeObserver(() => queueRadarDraw());
  ro.observe(radarWrap);
}