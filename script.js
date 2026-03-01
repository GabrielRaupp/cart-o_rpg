const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const STORAGE_KEY = "rpg_card_v3";

function randomGlyphLine(len = 80) {
  const chars = "⟊⟟⟒⟐⟄⟅⟆⟇⟍⟔⟟⟡⟠⟣⟤⟥⟦⟧⟨⟩⟪⟫⌁⌂⌇⌎⌑⌘⌬⌲⌶⍁⍂⍃⍄⍅⍆⍇";
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
  el.textContent = state;
  el.style.opacity = state === "salvando" ? "0.75" : "1";
}
function scheduleSavedBadge() {
  setSaveState("salvando");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => setSaveState("salvo"), 350);
}

function setMarquee(trackEl, text) {
  trackEl.textContent = `${text}     ${text}`;
}
function regenGlyphs() {
  const top = randomGlyphLine(96);
  const bottom = randomGlyphLine(110);
  setMarquee($("glyphTopTrack"), top);
  setMarquee($("glyphBottomTrack"), bottom);
  return { top, bottom };
}

const inpName = $("inpName");
const inpGuild = $("inpGuild");

function normalizeName(v) {
  return (v || "").toUpperCase();
}
function syncHeaderStyle() {
  inpName.value = normalizeName(inpName.value);
}

const mapFields = [
  ["in_nv", "outNv"], ["in_xp", "outXp"], ["in_hp", "outHp"], ["in_pm", "outPm"], ["in_ca", "outCa"], ["in_pi", "outPi"],
  ["in_idade", "outIdade"], ["in_altura", "outAltura"], ["in_raca", "outRaca"], ["in_classe", "outClasse"],
];

function syncMappedOutputs() {
  mapFields.forEach(([a, b]) => {
    const el = $(a);
    const out = $(b);
    const v = (el && typeof el.value === "string") ? el.value.trim() : "";
    out.textContent = v || "?";
  });
}

const STATUS_KEYS = ["for", "des", "con", "int", "sab", "car", "adp", "res"];
function getStatusValues() {
  return STATUS_KEYS.map(k => clamp(parseFloat($(`st_${k}`).value || "0"), 0, 999));
}

const canvas = $("radar");
const ctx = canvas.getContext("2d");

function drawRadar() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.34;

  const values = getStatusValues();
  const maxV = Math.max(10, ...values);
  const labels = ["FOR", "DES", "CON", "INT", "SAB", "CAR", "ADP", "RES"];
  const n = labels.length;

  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.25, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(42,34,26,.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const rings = 5;
  for (let i = 1; i <= rings; i++) {
    const rr = baseRadius * (i / rings);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(42,34,26,.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

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

    ctx.font = "900 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(42,34,26,.88)";
    ctx.textAlign = (Math.cos(ang) > 0.25) ? "left" : (Math.cos(ang) < -0.25 ? "right" : "center");
    ctx.textBaseline = (Math.sin(ang) > 0.25) ? "top" : (Math.sin(ang) < -0.25 ? "bottom" : "middle");
    ctx.fillText(labels[i], cx + Math.cos(ang) * baseRadius * 1.33, cy + Math.sin(ang) * baseRadius * 1.33);
  }

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + i * (2 * Math.PI / n);
    const rr = baseRadius * (values[i] / maxV);
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = "rgba(80, 140, 200, .30)";
  ctx.fill();
  ctx.strokeStyle = "rgba(42,34,26,.55)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(42,34,26,.65)";
  ctx.fill();
}

const rPhys = $("r_phys"), rArc = $("r_arc"), rSpi = $("r_spi");
const nPhys = $("n_phys"), nArc = $("n_arc"), nSpi = $("n_spi");

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

  const out = c.toDataURL("image/jpeg", quality);
  return out;
}

inpPhoto.addEventListener("change", async () => {
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

btnRemovePhoto.addEventListener("click", () => {
  setPhoto("");
  saveAll();
});

function collectState() {
  const fieldsObj = {};
  for (const [a] of mapFields) fieldsObj[a] = $(a).value;

  const statsObj = {};
  for (const k of STATUS_KEYS) statsObj[k] = $(`st_${k}`).value;

  return {
    name: inpName.value,
    guild: inpGuild.value,
    glyphTop: $("glyphTopTrack").textContent,
    glyphBottom: $("glyphBottomTrack").textContent,
    photo: photoDataUrl,
    fields: fieldsObj,
    stats: statsObj,
    runes: {
      phys: clamp(parseInt(rPhys.value || "0", 10), 0, 100),
      arc: clamp(parseInt(rArc.value || "0", 10), 0, 100),
      spi: clamp(parseInt(rSpi.value || "0", 10), 0, 100),
    }
  };
}

function applyState(state) {
  if (!state) return;

  inpName.value = state.name ?? "";
  inpGuild.value = state.guild ?? "";
  syncHeaderStyle();

  if (state.glyphTop) $("glyphTopTrack").textContent = state.glyphTop;
  if (state.glyphBottom) $("glyphBottomTrack").textContent = state.glyphBottom;

  setPhoto(state.photo ?? "");

  if (state.fields) {
    for (const [id, val] of Object.entries(state.fields)) {
      const el = $(id);
      if (el) el.value = val ?? "";
    }
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

  drawRadar();
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
  inpName.addEventListener("input", () => { syncHeaderStyle(); saveAll(); });
  inpGuild.addEventListener("input", () => { saveAll(); });

  mapFields.forEach(([a, b]) => {
    const el = $(a);
    const out = $(b);
    el.addEventListener("input", () => {
      out.textContent = el.value.trim() || "?";
      saveAll();
    });
  });

  STATUS_KEYS.forEach(k => {
    $(`st_${k}`).addEventListener("input", () => {
      drawRadar();
      saveAll();
    });
  });
}

$("btnReset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);

  inpName.value = "";
  inpGuild.value = "";

  for (const [a] of mapFields) {
    const el = $(a);
    if (!el) continue;
    if (el.type === "number") {
      if (a === "in_nv") el.value = "1";
      else if (a === "in_xp") el.value = "0";
      else if (a === "in_hp") el.value = "10";
      else if (a === "in_pm") el.value = "5";
      else if (a === "in_ca") el.value = "10";
      else if (a === "in_pi") el.value = "0";
      else el.value = "0";
    } else {
      el.value = "";
    }
  }

  STATUS_KEYS.forEach(k => $(`st_${k}`).value = "0");

  syncRunePair(rPhys, nPhys, 70);
  syncRunePair(rArc, nArc, 55);
  syncRunePair(rSpi, nSpi, 80);

  setPhoto("");
  regenGlyphs();
  syncMappedOutputs();
  drawRadar();
  setSaveState("salvo");
});

$("btnPrint").addEventListener("click", () => window.print());

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
  }
})();