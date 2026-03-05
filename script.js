const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const STORAGE_KEY = "rpg_card_v4";

function randomGlyphLine(len = 80) {
  const chars =
    "⟊⟟⟒⟐⟄⟅⟆⟇⟍⟔⟟⟡⟠⟣⟤⟥⟦⟧⟨⟩⟪⫫⌁⌂⌇⌎⌑⌘⌬⌲⌶⍁⍂⍃⍄⍅⍆⍇";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
    if (i % 6 === 5) s += " ";
  }
  return s.trim();
}

let saveTimer = null;
function setSaveState(state) {
  const el = $("saveState");
  const elBack = $("saveStateBack");
  if (el) {
    el.textContent = state;
    el.style.opacity = state === "salvando" ? "0.75" : "1";
  }
  if (elBack) {
    elBack.textContent = state;
    elBack.style.opacity = state === "salvando" ? "0.75" : "1";
  }
}
function scheduleSavedBadge() {
  setSaveState("salvando");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => setSaveState("salvo"), 350);
}

function setMarquee(trackEl, text) {
  if (!trackEl) return;
  trackEl.textContent = `${text}     ${text}`;
}
function regenGlyphs() {
  const top = randomGlyphLine(96);
  const bottom = randomGlyphLine(110);
  setMarquee($("glyphTopTrack"), top);
  setMarquee($("glyphBottomTrack"), bottom);
  setMarquee($("glyphTopTrackBack"), top);
  return { top, bottom };
}

const inpName = $("inpName");
const inpGuild = $("inpGuild");

function normalizeName(v) {
  return (v || "").toUpperCase();
}
function syncHeaderStyle() {
  if (inpName) inpName.value = normalizeName(inpName.value);
}

const inHpCur = $("in_hp_cur");
const inHpMax = $("in_hp_max");
const outHp = $("outHp");

function syncHpOutput() {
  const cur = clamp(parseInt(inHpCur?.value || "0", 10), 0, 999999);
  const max = clamp(parseInt(inHpMax?.value || "0", 10), 0, 999999);
  if (outHp) outHp.textContent = `${cur}/${max}`;
}

const mapFields = [
  ["in_nv", "outNv"],
  ["in_xp", "outXp"],
  ["in_pm", "outPm"],
  ["in_ca", "outCa"],
  ["in_pi", "outPi"],
  ["in_idade", "outIdade"],
  ["in_altura", "outAltura"],
  ["in_raca", "outRaca"],
  ["in_classe", "outClasse"],
];

function syncMappedOutputs() {
  mapFields.forEach(([a, b]) => {
    const el = $(a);
    const out = $(b);
    const v = el && typeof el.value === "string" ? el.value.trim() : "";
    if (out) out.textContent = v || "?";
  });
  syncHpOutput();
}

const STATUS_KEYS = ["for", "des", "con", "int", "sab", "car", "adp", "res"];
function getStatusValues() {
  return STATUS_KEYS.map((k) => clamp(parseFloat($(`st_${k}`)?.value || "0"), 0, 999));
}

/* =========================
   RADAR (FIX MOBILE)
========================= */

const canvas = $("radar");
const ctx = canvas ? canvas.getContext("2d") : null;

// se não existir, não quebra o resto do app
if (!canvas || !ctx) {
  console.warn("[radar] canvas/ctx não encontrado");
}

const radarWrap = canvas?.closest(".radarWrap") || null;

const radarTip = document.createElement("div");
radarTip.id = "radarTip";
radarTip.className = "radarTip";
radarTip.style.display = "none";
radarWrap?.appendChild(radarTip);

function showRadarTip(text, x, y) {
  radarTip.textContent = text;
  radarTip.style.left = `${x}px`;
  radarTip.style.top = `${y}px`;
  radarTip.style.display = "block";
}
function hideRadarTip() {
  radarTip.style.display = "none";
}

function getCanvasPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top, rect };
}

// guarda o tamanho CSS atual do radar (pra tooltip/hit-test bater 1:1)
let radarCssSize = 0;

function resizeRadarForDisplay() {
  if (!canvas || !ctx) return null;

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const wrapEl = radarWrap || canvas.parentElement;
  if (!wrapEl) return null;

  // largura útil (desconta padding do radarWrap pra não estourar)
  const wrapRect = wrapEl.getBoundingClientRect();
  let usableW = wrapRect.width;

  if (wrapEl instanceof HTMLElement) {
    const cs = getComputedStyle(wrapEl);
    const pl = parseFloat(cs.paddingLeft || "0") || 0;
    const pr = parseFloat(cs.paddingRight || "0") || 0;
    usableW = usableW - pl - pr;
  }

  // se ainda não calculou layout, tenta de novo
  if (usableW < 10) return null;

  // respeita seu max-width (520)
  const cssW = Math.max(240, Math.min(520, Math.floor(usableW)));
  radarCssSize = cssW;

  // força o tamanho VISUAL (evita bug de min-height/height:auto no mobile)
  canvas.style.width = cssW + "px";
  canvas.style.height = cssW + "px";

  // buffer real do canvas
  const px = Math.floor(cssW * dpr);
  if (canvas.width !== px || canvas.height !== px) {
    canvas.width = px;
    canvas.height = px;
  }

  // reset + scale (desenha em coordenadas CSS)
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

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2,
    cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.34;

  const values = getStatusValues();
  const maxV = Math.max(10, ...values);
  const labels = ["FOR", "DES", "CON", "INT", "SAB", "CAR", "ADP", "RES"];
  const n = labels.length;

  // círculo externo
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.25, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(42,34,26,.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // anéis
  const rings = 5;
  for (let i = 1; i <= rings; i++) {
    const rr = baseRadius * (i / rings);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(42,34,26,.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // raios + labels
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + i * (2 * Math.PI / n);
    const x = cx + Math.cos(ang) * baseRadius * 1.05;
    const y = cy + Math.sin(ang) * baseRadius * 1.05;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(42,34,26,.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font =
      "900 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(42,34,26,.88)";
    ctx.textAlign =
      Math.cos(ang) > 0.25
        ? "left"
        : Math.cos(ang) < -0.25
        ? "right"
        : "center";
    ctx.textBaseline =
      Math.sin(ang) > 0.25
        ? "top"
        : Math.sin(ang) < -0.25
        ? "bottom"
        : "middle";
    ctx.fillText(
      labels[i],
      cx + Math.cos(ang) * baseRadius * 1.33,
      cy + Math.sin(ang) * baseRadius * 1.33
    );
  }

  // polígono de valores
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + i * (2 * Math.PI / n);
    const rr = baseRadius * (values[i] / maxV);
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = "rgba(80, 140, 200, .30)";
  ctx.fill();
  ctx.strokeStyle = "rgba(42,34,26,.55)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // centro
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(42,34,26,.65)";
  ctx.fill();
}

function pickRadarPoint(px, py) {
  if (!canvas) return null;

  const w = Math.max(
    240,
    Math.floor(radarCssSize || canvas.getBoundingClientRect().width || 440)
  );
  const h = w;
  const cx = w / 2,
    cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.34;

  const values = getStatusValues();
  const maxV = Math.max(10, ...values);
  const labels = ["FOR", "DES", "CON", "INT", "SAB", "CAR", "ADP", "RES"];
  const n = labels.length;

  const hit = 16;

  let best = null;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + i * (2 * Math.PI / n);
    const rr = baseRadius * (values[i] / maxV);
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;

    const dx = px - x;
    const dy = py - y;
    const d = Math.hypot(dx, dy);

    if (d <= hit && (!best || d < best.d)) {
      best = { i, d, x, y, label: labels[i], value: values[i] };
    }
  }
  return best;
}

if (canvas && radarWrap) {
  canvas.addEventListener("mousemove", (e) => {
    const { x, y, rect } = getCanvasPos(e);
    const picked = pickRadarPoint(x, y);
    if (!picked) return hideRadarTip();

    const wrapRect = radarWrap.getBoundingClientRect();
    const tipX = rect.left + picked.x - wrapRect.left;
    const tipY = rect.top + picked.y - wrapRect.top;

    showRadarTip(`${picked.label}: ${picked.value}`, tipX, tipY);
  });

  canvas.addEventListener("mouseleave", hideRadarTip);

  let touchPinned = false;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      const { x, y, rect } = getCanvasPos(e);
      const picked = pickRadarPoint(x, y);

      if (!picked) {
        touchPinned = false;
        hideRadarTip();
        return;
      }

      touchPinned = true;
      const wrapRect = radarWrap.getBoundingClientRect();
      const tipX = rect.left + picked.x - wrapRect.left;
      const tipY = rect.top + picked.y - wrapRect.top;

      showRadarTip(`${picked.label}: ${picked.value}`, tipX, tipY);
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (!touchPinned) return;
      const { x, y, rect } = getCanvasPos(e);
      const picked = pickRadarPoint(x, y);
      if (!picked) return;

      const wrapRect = radarWrap.getBoundingClientRect();
      const tipX = rect.left + picked.x - wrapRect.left;
      const tipY = rect.top + picked.y - wrapRect.top;

      showRadarTip(`${picked.label}: ${picked.value}`, tipX, tipY);
    },
    { passive: true }
  );

  canvas.addEventListener("touchend", () => {
    touchPinned = false;
    hideRadarTip();
  });
}

/* =========================
   RUNAS
========================= */

const rPhys = $("r_phys"),
  rArc = $("r_arc"),
  rSpi = $("r_spi");
const nPhys = $("n_phys"),
  nArc = $("n_arc"),
  nSpi = $("n_spi");

function syncRunePair(rangeEl, numEl, value) {
  const v = clamp(parseInt(value || "0", 10), 0, 100);
  rangeEl.value = String(v);
  numEl.value = String(v);
}

function initRuneSync() {
  [[rPhys, nPhys], [rArc, nArc], [rSpi, nSpi]].forEach(([r, n]) => {
    r.addEventListener("input", () => {
      syncRunePair(r, n, r.value);
      saveAll();
    });
    n.addEventListener("input", () => {
      syncRunePair(r, n, n.value);
      saveAll();
    });
  });
}

/* =========================
   FOTO
========================= */

const inpPhoto = $("inpPhoto");
const btnRemovePhoto = $("btnRemovePhoto");
const photoImg = $("charPhoto");
const photoPlaceholder = $("photoPlaceholder");
let photoDataUrl = "";

function setPhoto(dataUrl) {
  photoDataUrl = dataUrl || "";
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

async function compressImageDataUrl(dataUrl, maxSide = 720, quality = 0.82) {
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

inpPhoto?.addEventListener("change", async () => {
  const file = inpPhoto.files && inpPhoto.files[0];
  inpPhoto.value = "";
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/")) return;

  try {
    const raw = await fileToDataUrl(file);
    const compressed = await compressImageDataUrl(raw, 780, 0.82);
    setPhoto(compressed);
    saveAll();
  } catch {
    setPhoto("");
    saveAll();
  }
});

btnRemovePhoto?.addEventListener("click", () => {
  setPhoto("");
  saveAll();
});

/* =========================
   NOTAS + FLIP
========================= */

const noteStory = $("note_story");
const noteInv = $("note_inv");
const noteSkills = $("note_skills");
const noteNpcs = $("note_npcs");

const card = $("card");
$("btnFlip")?.addEventListener("click", () => {
  card.classList.toggle("is-flipped");
  // no mobile, redesenha depois do layout mudar
  setTimeout(drawRadar, 250);
});

/* =========================
   SAVE/LOAD
========================= */

function collectState() {
  const fieldsObj = {};
  for (const [a] of mapFields) fieldsObj[a] = $(a).value;

  const statsObj = {};
  for (const k of STATUS_KEYS) statsObj[k] = $(`st_${k}`).value;

  return {
    v: 4,
    name: inpName.value,
    guild: inpGuild.value,
    glyphTop: $("glyphTopTrack").textContent,
    glyphBottom: $("glyphBottomTrack").textContent,
    photo: photoDataUrl,

    fields: fieldsObj,
    hp: {
      cur: clamp(parseInt(inHpCur.value || "0", 10), 0, 999999),
      max: clamp(parseInt(inHpMax.value || "0", 10), 0, 999999),
    },

    stats: statsObj,
    runes: {
      phys: clamp(parseInt(rPhys.value || "0", 10), 0, 100),
      arc: clamp(parseInt(rArc.value || "0", 10), 0, 100),
      spi: clamp(parseInt(rSpi.value || "0", 10), 0, 100),
    },

    notes: {
      story: noteStory.value,
      inv: noteInv.value,
      skills: noteSkills.value,
      npcs: noteNpcs.value,
    },
  };
}

function migrateLegacy(state) {
  if (!state) return state;
  if (state.fields && typeof state.fields.in_hp !== "undefined" && !state.hp) {
    const legacyHp = clamp(parseInt(state.fields.in_hp || "0", 10), 0, 999999);
    state.hp = { cur: legacyHp, max: legacyHp };
    delete state.fields.in_hp;
  }
  return state;
}

function applyState(state) {
  if (!state) return;

  state = migrateLegacy(state);

  inpName.value = state.name ?? "";
  inpGuild.value = state.guild ?? "";
  syncHeaderStyle();

  if (state.glyphTop) $("glyphTopTrack").textContent = state.glyphTop;
  if (state.glyphBottom) $("glyphBottomTrack").textContent = state.glyphBottom;

  setMarquee($("glyphTopTrackBack"), state.glyphTop || $("glyphTopTrack").textContent);

  setPhoto(state.photo ?? "");

  if (state.fields) {
    for (const [id, val] of Object.entries(state.fields)) {
      const el = $(id);
      if (el) el.value = val ?? "";
    }
  }

  if (state.hp) {
    inHpCur.value = String(state.hp.cur ?? 0);
    inHpMax.value = String(state.hp.max ?? 0);
  }

  syncMappedOutputs();

  if (state.stats) {
    for (const k of STATUS_KEYS) {
      const el = $(`st_${k}`);
      if (el) el.value = state.stats[k] ?? "0";
    }
  }

  if (state.runes) {
    syncRunePair(rPhys, nPhys, state.runes.phys ?? 0);
    syncRunePair(rArc, nArc, state.runes.arc ?? 0);
    syncRunePair(rSpi, nSpi, state.runes.spi ?? 0);
  }

  if (state.notes) {
    noteStory.value = state.notes.story ?? "";
    noteInv.value = state.notes.inv ?? "";
    noteSkills.value = state.notes.skills ?? "";
    noteNpcs.value = state.notes.npcs ?? "";
  }

  drawRadar();
}

function queueRadarDraw() {
  // desenha várias vezes pra pegar layout final do mobile
  requestAnimationFrame(() => {
    drawRadar();
    requestAnimationFrame(drawRadar);
  });
  setTimeout(drawRadar, 80);
  setTimeout(drawRadar, 220);
}

window.addEventListener("load", queueRadarDraw, { once: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) queueRadarDraw();
});

// iOS/Android: ao voltar pra página
window.addEventListener("pageshow", () => setTimeout(drawRadar, 0));
window.addEventListener("orientationchange", () => setTimeout(drawRadar, 200));

if (window.ResizeObserver && radarWrap) {
  const ro = new ResizeObserver(() => queueRadarDraw());
  ro.observe(radarWrap);
}

function saveAll() {
  scheduleSavedBadge();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
  } catch {
    setPhoto("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
    } catch {}
  }
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    applyState(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

function bindInputsToSave() {
  inpName.addEventListener("input", () => {
    syncHeaderStyle();
    saveAll();
  });
  inpGuild.addEventListener("input", () => {
    saveAll();
  });

  mapFields.forEach(([a, b]) => {
    const el = $(a);
    const out = $(b);
    el.addEventListener("input", () => {
      out.textContent = el.value.trim() || "?";
      saveAll();
    });
  });

  [inHpCur, inHpMax].forEach((el) => {
    el.addEventListener("input", () => {
      syncHpOutput();
      saveAll();
    });
  });

  STATUS_KEYS.forEach((k) => {
    $(`st_${k}`).addEventListener("input", () => {
      drawRadar();
      saveAll();
    });
  });

  [noteStory, noteInv, noteSkills, noteNpcs].forEach((el) => {
    el.addEventListener("input", saveAll);
  });
}

$("btnReset")?.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);

  inpName.value = "";
  inpGuild.value = "";

  for (const [a] of mapFields) {
    const el = $(a);
    if (!el) continue;
    if (el.type === "number") {
      if (a === "in_nv") el.value = "1";
      else if (a === "in_xp") el.value = "0";
      else if (a === "in_pm") el.value = "5";
      else if (a === "in_ca") el.value = "10";
      else if (a === "in_pi") el.value = "0";
      else el.value = "0";
    } else {
      el.value = "";
    }
  }

  inHpCur.value = "10";
  inHpMax.value = "10";

  STATUS_KEYS.forEach((k) => ($(`st_${k}`).value = "0"));

  syncRunePair(rPhys, nPhys, 70);
  syncRunePair(rArc, nArc, 55);
  syncRunePair(rSpi, nSpi, 80);

  noteStory.value = "";
  noteInv.value = "";
  noteSkills.value = "";
  noteNpcs.value = "";

  setPhoto("");
  regenGlyphs();
  syncMappedOutputs();
  drawRadar();
  setSaveState("salvo");

  card.classList.remove("is-flipped");
});

$("btnPrint")?.addEventListener("click", () => window.print());

let resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(drawRadar);
});

(function init() {
  initRuneSync();
  bindInputsToSave();

  const loaded = loadAll();
  if (!loaded) {
    regenGlyphs();
    syncMappedOutputs();
    drawRadar();
    setPhoto("");
    saveAll();
  } else {
    setSaveState("salvo");
    syncHpOutput();
    drawRadar();
  }
})();