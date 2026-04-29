(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = "rpg_card_spell_creator_v7_balanced";
  const SAVE_DELAY = 180;

  const RULES = {
    simples: {
      label: "Simples",
      grades: {
        base: { label: "Base", pm: [1, 6], alcance: 3, cura: "2d4", dano: "2d4", buffs: 0, rodadas: 3 },
        up1: { label: "UP 1", pm: [4, 10], alcance: 5, cura: "2d6", dano: "2d6 a 3d4", buffs: 1, rodadas: 4 },
        up2: { label: "UP 2", pm: [6, 15], alcance: 7, cura: "2d8", dano: "2d8 a 3d6", buffs: 1, rodadas: 5 },
        up3: { label: "UP 3", pm: [10, 18], alcance: 9, cura: "3d6", dano: "2d8 a 3d8", buffs: 2, rodadas: 6 },
      },
    },

    complexa: {
      label: "Complexa",
      grades: {
        base: { label: "Base", pm: [6, 20], alcance: 15, cura: "3d12", dano: "3d6 a 3d8", buffs: 2, rodadas: 8 },
        up1: { label: "UP 1", pm: [8, 25], alcance: 18, cura: "4d10", dano: "3d10 a 4d8", buffs: 3, rodadas: 10 },
        up2: { label: "UP 2", pm: [14, 40], alcance: 20, cura: "4d12", dano: "4d8 a 5d12", buffs: 3, rodadas: 10 },
      },
    },

    avancada: {
      label: "Avançada",
      grades: {
        base: { label: "Base", pm: [35, 70], alcance: 30, cura: "5d10", dano: "5d6 a 7d8", buffs: 3, rodadas: 12 },
        up1: { label: "UP 1", pm: [40, 100], alcance: 50, cura: "8d10", dano: "6d10 a 10d8", buffs: 4, rodadas: 14 },
      },
    },
  };

  const KIND_LABELS = {
    dano: "Dano direto",
    area: "Área / zona",
    cura: "Cura",
    buff: "Buff",
    debuff: "Debuff",
    controle: "Controle",
    encantamento: "Encantamento",
    transformacao: "Transformação",
    invocacao: "Invocação",
    conjuracao: "Conjuração / criação",
    efeito: "Efeito especial",
    copia: "Cópia / roubo de magia",
    protecao: "Proteção / barreira",
    movimento: "Movimento / teleporte",
    ilusao: "Ilusão",
    informacao: "Informação / detecção",
    necromancia: "Vida / morte / alma",
    reacao: "Reação / contra-magia",
  };

  const KIND_FIELDS = {
    dano: ["range", "damage", "save"],
    area: ["range", "duration", "damage", "save", "resource"],
    cura: ["range", "duration", "heal"],
    buff: ["range", "duration", "buff"],
    debuff: ["range", "duration", "debuff", "save"],
    controle: ["range", "duration", "debuff", "save", "effect"],

    encantamento: ["duration", "damage", "enchant", "effect"],

    transformacao: ["duration", "damage", "buff", "debuff", "transform", "resource"],
    invocacao: ["range", "duration", "summon", "effect", "save"],
    conjuracao: ["range", "duration", "effect", "resource"],
    efeito: ["range", "duration", "effect"],
    copia: ["range", "duration", "copy", "save", "effect"],
    protecao: ["range", "duration", "buff", "effect"],
    movimento: ["range", "duration", "effect", "save"],
    ilusao: ["range", "duration", "debuff", "save", "effect"],
    informacao: ["range", "duration", "effect"],
    necromancia: ["range", "duration", "damage", "heal", "debuff", "save"],
    reacao: ["range", "effect", "save"],
  };

  const KIND_WEIGHT = {
    dano: 0.38,
    area: 0.62,
    cura: 0.36,
    buff: 0.34,
    debuff: 0.40,
    controle: 0.58,
    encantamento: 0.34,
    transformacao: 0.62,
    invocacao: 0.56,
    conjuracao: 0.46,
    efeito: 0.34,
    copia: 0.72,
    protecao: 0.42,
    movimento: 0.52,
    ilusao: 0.44,
    informacao: 0.28,
    necromancia: 0.62,
    reacao: 0.58,
  };

  const TIER_ORDER = [
    ["simples", "base"],
    ["simples", "up1"],
    ["simples", "up2"],
    ["simples", "up3"],
    ["complexa", "base"],
    ["complexa", "up1"],
    ["complexa", "up2"],
    ["avancada", "base"],
    ["avancada", "up1"],
  ];

  const FIELD_IDS = [
    "spellPasteText",
    "spellType",
    "spellGrade",
    "spellKind",
    "spellKindCount",
    "spellName",
    "spellCost",
    "spellRangeMode",
    "spellRangeMeters",
    "spellAreaShape",
    "spellDuration",
    "spellRounds",
    "spellDamage",
    "spellExtraDamage",
    "spellHeal",
    "spellSave",
    "spellSaveEffect",
    "spellBuffs",
    "spellBuffText",
    "spellDebuffs",
    "spellDebuffText",
    "spellEnchantTarget",
    "spellEnchantEffect",
    "spellTransformTarget",
    "spellTransformStats",
    "spellSummon",
    "spellSummonBehavior",
    "spellCopyLimit",
    "spellCopyTypes",
    "spellCopyStorage",
    "spellCharges",
    "spellDrawback",
    "spellEffectLimits",
    "spellChannelRounds",
    "spellDescription",
  ];

  let saveTimer = 0;
  let lastResult = null;

  function toInt(value, fallback = 0) {
    if (value == null || value === "") return fallback;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function toNumber(value, fallback = null) {
    if (value == null || value === "") return fallback;
    const n = Number(String(value).replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function capitalize(text) {
    const s = String(text || "");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  function normalizeText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9+\-\sd]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setFieldValue(id, value, overwrite = true) {
    const el = $(id);
    if (!el || value == null || value === "") return;
    if (!overwrite && el.value) return;
    el.value = String(value).trim();
  }

  function clearFieldValue(id) {
    const el = $(id);
    if (el) el.value = "";
  }

  function getRule(type = $("spellType")?.value, grade = $("spellGrade")?.value) {
    const typeRule = RULES[type];
    const gradeRule = typeRule?.grades?.[grade];
    if (!typeRule || !gradeRule) return null;

    return {
      type,
      grade,
      typeLabel: typeRule.label,
      gradeLabel: gradeRule.label,
      ...gradeRule,
    };
  }

  function getAvailableGrades(type) {
    return Object.entries(RULES[type]?.grades || {}).map(([value, data]) => ({
      value,
      label: data.label,
    }));
  }

  function getTypeRank(type) {
    return ["simples", "complexa", "avancada"].indexOf(type);
  }

  function getTierIndex(type, grade) {
    return TIER_ORDER.findIndex(([tierType, tierGrade]) => tierType === type && tierGrade === grade);
  }

  function getSelectedKinds() {
    const mainKind = $("spellKind")?.value || "";

    if (mainKind && mainKind !== "multi") return [mainKind];
    if (mainKind !== "multi") return [];

    return Array.from(document.querySelectorAll("[data-spell-kind-select]"))
      .map((select) => select.value)
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 6);
  }

  function getActiveGroups(kinds = getSelectedKinds()) {
    const groups = new Set();

    for (const kind of kinds) {
      for (const group of KIND_FIELDS[kind] || []) {
        groups.add(group);
      }
    }

    return groups;
  }

  function parseRoundsFromDuration(text) {
    const source = normalizeText(text);
    if (!source) return null;

    const match = source.match(/(\d+)\s*(rodada|rodadas|turno|turnos)/);
    if (match) return toInt(match[1], 0);

    if (source.includes("instantanea") || source.includes("instantaneo")) return 0;

    return null;
  }

  function parseDiceTerms(text) {
    const source = String(text || "");
    const diceRegex = /(\d*)\s*d\s*(\d+)(?:\s*([+-])\s*([^,\n;|]+))?/gi;
    const terms = [];
    let match;

    while ((match = diceRegex.exec(source))) {
      const count = Math.max(1, toInt(match[1] || "1", 1));
      const sides = Math.max(1, toInt(match[2], 1));
      let mod = 0;

      if (match[4]) {
        const rawMod = String(match[4]).trim();
        const numeric = rawMod.match(/^(\d+)/);
        if (numeric) mod = toInt(numeric[1], 0) * (match[3] === "-" ? -1 : 1);
      }

      terms.push({
        raw: match[0].trim(),
        count,
        sides,
        avg: count * ((sides + 1) / 2) + mod,
      });
    }

    return terms;
  }

  function parseDiceAverage(text) {
    const source = String(text || "");
    const terms = parseDiceTerms(source);

    if (!terms.length) {
      const flat = toNumber(source, null);
      return flat == null ? null : { avg: flat, raw: String(flat), mode: "flat" };
    }

    const normalized = normalizeText(source);

    if (
      terms.length >= 2 &&
      (
        normalized.includes("cada") ||
        normalized.includes("por pedra") ||
        normalized.includes("por gota") ||
        normalized.includes("vezes") ||
        normalized.includes("x")
      )
    ) {
      return {
        avg: terms[0].avg * terms[1].avg + terms.slice(2).reduce((sum, term) => sum + term.avg, 0),
        raw: terms.map((term) => term.raw).join(" x "),
        mode: "multi",
      };
    }

    return {
      avg: terms.reduce((sum, term) => sum + term.avg, 0),
      raw: terms.map((term) => term.raw).join(" + "),
      mode: "sum",
    };
  }

  function extractFirstNumber(text, fallback = null) {
    const match = String(text || "").match(/(\d+(?:[,.]\d+)?)/);
    return match ? toNumber(match[1], fallback) : fallback;
  }

  function getLimitDamageAvg(rule) {
    return parseDiceAverage(rule.dano)?.avg || 1;
  }

  function getLimitHealAvg(rule) {
    return parseDiceAverage(rule.cura)?.avg || 1;
  }

  function getFormData() {
    const durationText = $("spellDuration")?.value.trim() || "";
    const explicitRounds = toNumber($("spellRounds")?.value, null);
    const selectedKinds = getSelectedKinds();

    const data = {
      type: $("spellType")?.value || "",
      grade: $("spellGrade")?.value || "",
      kinds: selectedKinds,
      name: $("spellName")?.value.trim() || "",
      cost: toNumber($("spellCost")?.value, null),
      rangeMode: $("spellRangeMode")?.value || "alcance",
      rangeMeters: toNumber($("spellRangeMeters")?.value, null),
      areaShape: $("spellAreaShape")?.value.trim() || "",
      duration: durationText,
      rounds: explicitRounds != null ? explicitRounds : parseRoundsFromDuration(durationText),
      damage: $("spellDamage")?.value.trim() || "",
      extraDamage: $("spellExtraDamage")?.value.trim() || "",
      heal: $("spellHeal")?.value.trim() || "",
      save: $("spellSave")?.value.trim() || "",
      saveEffect: $("spellSaveEffect")?.value.trim() || "",
      buffs: toNumber($("spellBuffs")?.value, null),
      buffText: $("spellBuffText")?.value.trim() || "",
      debuffs: toNumber($("spellDebuffs")?.value, null),
      debuffText: $("spellDebuffText")?.value.trim() || "",
      enchantTarget: $("spellEnchantTarget")?.value.trim() || "",
      enchantEffect: $("spellEnchantEffect")?.value.trim() || "",
      transformTarget: $("spellTransformTarget")?.value.trim() || "",
      transformStats: $("spellTransformStats")?.value.trim() || "",
      summon: $("spellSummon")?.value.trim() || "",
      summonBehavior: $("spellSummonBehavior")?.value.trim() || "",
      copyLimit: $("spellCopyLimit")?.value.trim() || "",
      copyTypes: $("spellCopyTypes")?.value.trim() || "",
      copyStorage: $("spellCopyStorage")?.value.trim() || "",
      charges: $("spellCharges")?.value.trim() || "",
      drawback: $("spellDrawback")?.value.trim() || "",
      effectLimits: $("spellEffectLimits")?.value.trim() || "",
      channelRounds: toNumber($("spellChannelRounds")?.value, null),
      description: $("spellDescription")?.value.trim() || "",
      pasteText: $("spellPasteText")?.value.trim() || "",
    };

    if (!data.kinds.length) {
      data.kinds = inferKindsFromText(data).slice(0, 6);
    }

    data.kindLabels = data.kinds.map((kind) => KIND_LABELS[kind] || kind);
    return inferMissingNumbers(data);
  }

  function getAllRawText(data) {
    return [
      data.name,
      data.areaShape,
      data.duration,
      data.damage,
      data.extraDamage,
      data.heal,
      data.save,
      data.saveEffect,
      data.buffText,
      data.debuffText,
      data.enchantTarget,
      data.enchantEffect,
      data.transformTarget,
      data.transformStats,
      data.summon,
      data.summonBehavior,
      data.copyLimit,
      data.copyTypes,
      data.copyStorage,
      data.charges,
      data.drawback,
      data.effectLimits,
      data.description,
      data.pasteText,
    ].join("\n");
  }

  function getAllText(data) {
    return normalizeText(getAllRawText(data));
  }

  function textHas(text, ...terms) {
    const normalized = normalizeText(text);
    return terms.some((term) => normalized.includes(normalizeText(term)));
  }

  function inferKindsFromText(dataOrText) {
    const raw = typeof dataOrText === "string" ? dataOrText : getAllRawText(dataOrText);
    const text = normalizeText(raw);
    const kinds = new Set();
  
    const has = (...terms) => terms.some((term) => text.includes(normalizeText(term)));
  
    const weaponEnchant =
      has("encantamento de arma", "arma cortante", "espada", "lamina", "lâmina") &&
      has("encantamento", "encanta", "aura", "canaliza", "ataques com a espada", "ataque com a espada");
  
    if (weaponEnchant) {
      return ["encantamento"];
    }
  
    // Dano direto
    if (
      has("dano", "sangramento", "eletrico", "elétrico", "igneo", "ígneo", "necrotico", "necrótico") ||
      /\b\d+\s*d\s*\d+\b/i.test(raw)
    ) {
      kinds.add("dano");
    }
  
    // Área / zona
    if (
      has(
        "area",
        "área",
        "raio",
        "circulo",
        "círculo",
        "cone",
        "linha",
        "nuvem",
        "chuva",
        "nevasca",
        "onda",
        "ao redor",
        "em volta",
        "inimigos em",
        "em 5m",
        "em 10m",
        "10m",
        "aumenta o alcance",
        "aumenta o alcanse"
      )
    ) {
      kinds.add("area");
    }
  
    // Cura
    if (
      has(
        "cura",
        "curar",
        "curado",
        "recupera hp",
        "recupera vida",
        "restaura vida",
        "regenera",
        "regeneração"
      )
    ) {
      kinds.add("cura");
    }
  
    // Buff
    if (
      has(
        "buff",
        "bonus",
        "bônus",
        "ganha",
        "recebe",
        "aumenta",
        "+2 de acerto",
        "+ 2 de acerto",
        "+4 de dano",
        "+ 4 de dano",
        "acerto",
        "imune",
        "imunidade",
        "esquiva",
        "marca de imunidade",
        "armadura",
        "ca "
      )
    ) {
      kinds.add("buff");
    }
  
    // Debuff
    if (
      has(
        "debuff",
        "-2",
        "reduz",
        "diminui",
        "rouba",
        "roubar",
        "absorve",
        "pego",
        "pegar",
        "perde",
        "fica com",
        "ca por 1 rodada",
        "status mais forte",
        "1/4 do status",
        "1 4 do status"
      )
    ) {
      kinds.add("debuff");
    }
  
    // Controle
    if (
      has(
        "atordoado",
        "paralisa",
        "paralisado",
        "imobiliza",
        "imobilizado",
        "controle",
        "stun",
        "não pode agir",
        "nao pode agir",
        "perde ação",
        "perde acao"
      )
    ) {
      kinds.add("controle");
    }
  
    // Encantamento
    if (
      has(
        "encantamento",
        "encanta",
        "encantar",
        "arma",
        "espada",
        "lamina",
        "lâmina",
        "petrificando ele na sua arma",
        "na sua arma",
        "ataques com",
        "arma ou com o que estiver usando para bater"
      )
    ) {
      kinds.add("encantamento");
    }
  
    // Transformação / forma / armadura mágica
    if (
      has(
        "transforma",
        "transformacao",
        "transformação",
        "se torna",
        "nucleo",
        "núcleo",
        "sobrecarga",
        "armadura",
        "armadura de sangue",
        "armadura de raios",
        "armadura de trovao",
        "armadura de trovão",
        "fica com uma armadura",
        "forma"
      )
    ) {
      kinds.add("transformacao");
    }
  
    // Invocação
    if (
      has(
        "invoco",
        "invoca",
        "invocar",
        "criatura",
        "sapo",
        "servo",
        "familiar",
        "obelisco",
        "belisco",
        "totem",
        "construto"
      )
    ) {
      kinds.add("invocacao");
    }
  
    // Cópia / roubo / absorção de magia ou status
    if (
      has(
        "copia",
        "copiar",
        "rouba",
        "roubar",
        "roubo",
        "absorve magia",
        "magia roubada",
        "roubar a sombra",
        "rouba a sombra",
        "status mais forte",
        "pego 1/4",
        "pego 1 4",
        "pegar 1/4",
        "pegar 1 4"
      )
    ) {
      kinds.add("copia");
    }
  
    // Proteção / barreira
    if (
      has(
        "barreira",
        "escudo",
        "protege",
        "protecao",
        "proteção",
        "ca 10",
        "classe de armadura",
        "armadura"
      )
    ) {
      kinds.add("protecao");
    }
  
    // Movimento / teleporte
    if (
      has(
        "teleporte",
        "teletransporta",
        "teletransportar",
        "teletransporte",
        "teleportar",
        "troca de posição",
        "trocar posição",
        "trocar posicao",
        "movimento",
        "move-se",
        "move se",
        "flutuando"
      )
    ) {
      kinds.add("movimento");
    }
  
    // Ilusão / sombra
    if (
      has(
        "ilusao",
        "ilusão",
        "miragem",
        "imagem falsa",
        "sombra",
        "sombrio",
        "sombria",
        "sombril"
      )
    ) {
      kinds.add("ilusao");
    }
  
    // Informação / detecção
    if (
      has(
        "detectar",
        "detecção",
        "deteccao",
        "informação",
        "informacao",
        "revelar",
        "rastrear",
        "localizar"
      )
    ) {
      kinds.add("informacao");
    }
  
    // Necromancia / sangue / vida / morte / alma
    if (
      has(
        "morte",
        "alma",
        "vida",
        "necromancia",
        "reviver",
        "ressuscitar",
        "sangue",
        "sangramento",
        "controlar o proprio sangue",
        "controlar o próprio sangue"
      )
    ) {
      kinds.add("necromancia");
    }
  
    // Reação / contra-magia
    if (
      has(
        "reação",
        "reacao",
        "contra magia",
        "contra-magia",
        "counter",
        "anular magia",
        "quando uma magia",
        "caso seja a magia",
        "ao ser alvo"
      )
    ) {
      kinds.add("reacao");
    }
  
    // Conjuração / criação de objeto, estrutura ou zona
    if (
      has(
        "cria","criar","conjura","conjurar","obelisco","totem","estrutura","pilar","objeto mágico","objeto magico"
      )
    ) {
      kinds.add("conjuracao");
    }
  
    // Regra especial
    if (
      has(
        "custo da magia mais metade",
        "custando o custo da magia mais metade",
        "por teleporte",
        "por aliado",
        "por inimigo",
        "uso único",
        "uso unico",
        "duas vezes",
        "intervalo de 1 rodada",
        "ativa automaticamente"
      )
    ) {
      kinds.add("efeito");
    }
  
    // Roubo de status deve sempre contar como buff + debuff.
    if (
      has("status", "for", "des", "res", "int", "sab", "car", "acerto", "ca") &&
      has("rouba", "roubar", "pego", "pegar", "reduz", "fica com")
    ) {
      kinds.add("buff");
      kinds.add("debuff");
    }
  
    // Magia com teste normalmente tem efeito ofensivo/controle.
    if (has("teste", "cd", "reflexo", "reflexos", "res", "des")) {
      if (has("paralisa", "paralisado", "atordoado", "rouba", "reduz", "inimigo")) {
        kinds.add("controle");
      }
    }
  
    if (!kinds.size) kinds.add("efeito");
    return Array.from(kinds);
  }
  function inferMissingNumbers(data) {
    const raw = getAllRawText(data);
    const normalized = normalizeText(raw);

    if (data.rangeMeters == null) {
      const rangeMatch =
        raw.match(/(?:alcance|raio|área|area|em)\s*[: ]?\s*(\d+)\s*m/i) ||
        raw.match(/(\d+)\s*metros?\s*(?:em\s*)?(?:circulo|círculo|raio|área|area)/i);

      if (rangeMatch) data.rangeMeters = toNumber(rangeMatch[1], null);
    }

    if (data.rounds == null) {
      const roundMatch = normalized.match(/(\d+)\s*(rodada|rodadas|turno|turnos)/);
      if (roundMatch) data.rounds = toNumber(roundMatch[1], null);
    }

    if (!data.damage) {
      const terms = parseDiceTerms(raw);
      if (terms.length) data.damage = terms.map((term) => term.raw).join(" + ");
    }

    if (!data.save) {
      const saveLine = String(raw)
        .split("\n")
        .map((line) => line.trim())
        .find((line) => {
          const lineText = normalizeText(line);
          return lineText.includes("teste") ||
            lineText.includes(" cd ") ||
            lineText.includes("reflexo") ||
            lineText.includes("reflexos") ||
            lineText.includes(" res ") ||
            lineText.includes(" des ");
        });

      if (saveLine) data.save = saveLine;
    }

    return data;
  }

  function hasAnyText(data, ...terms) {
    const text = getAllText(data);
    return terms.some((term) => text.includes(normalizeText(term)));
  }

  function isWeaponEnchantment(data) {
    const text = getAllText(data);

    const hasWeapon =
      text.includes("arma") ||
      text.includes("espada") ||
      text.includes("lamina") ||
      text.includes("lâmina");

    const hasEnchant =
      text.includes("encantamento") ||
      text.includes("encanta") ||
      text.includes("aura") ||
      text.includes("canaliza");

    return data.kinds.includes("encantamento") && hasWeapon && hasEnchant;
  }

  function hasConditionalEffect(data) {
    const text = getAllText(data);

    return (
      text.includes("ao acertar") ||
      text.includes("sempre que") ||
      text.includes("rola") ||
      text.includes("1 2") ||
      text.includes("3 4") ||
      text.includes("ate o inicio do proximo turno") ||
      text.includes("até o início do próximo turno")
    );
  }

  function isMinorWeaponEnchantment(data) {
    if (!isWeaponEnchantment(data)) return false;

    const allDamage = parseDiceAverage([data.damage, data.extraDamage].filter(Boolean).join(" + "));
    const lowDamage = !allDamage || allDamage.avg <= 8;
    const shortDuration = data.rounds == null || data.rounds <= 4;

    const text = getAllText(data);
    const hasSmallDebuff =
      text.includes("-2") &&
      (text.includes(" ca ") || text.includes("classe de armadura")) &&
      (text.includes("1 rodada") || text.includes("proximo turno") || text.includes("próximo turno"));

    return lowDamage && shortDuration && (hasSmallDebuff || hasConditionalEffect(data));
  }

  function getLimitScore(data) {
    let score = 0;
    const text = getAllText(data);

    function add(condition, amount) {
      if (condition) score += amount;
    }

    add(Boolean(data.effectLimits), 0.08);
    add(Boolean(data.save), 0.12);
    add(Boolean(data.saveEffect), 0.08);
    add(Boolean(data.drawback), 0.18);
    add(Boolean(data.charges), 0.06);
    add(Boolean(data.copyLimit), 0.12);
    add(Boolean(data.copyTypes), 0.10);
    add(Boolean(data.copyStorage), 0.08);
    add(text.includes("metade do dano") || text.includes("reduzir dano pela metade"), 0.08);
    add(text.includes("so") || text.includes("só") || text.includes("apenas"), 0.06);
    add(text.includes("max") || text.includes("máx") || text.includes("limite"), 0.08);
    add(text.includes("nao pode") || text.includes("não pode") || text.includes("nao copia") || text.includes("não copia"), 0.08);
    add(text.includes("1 rodada") || text.includes("1 vez"), 0.04);

    if (isMinorWeaponEnchantment(data)) {
      add(true, 0.18);
    }

    return clamp(score, 0, 0.60);
  }

  function getComplexityFindings(data) {
    const findings = [];
    const text = getAllText(data);
    const has = (...terms) => terms.some((term) => text.includes(normalizeText(term)));
  
    if (isMinorWeaponEnchantment(data)) {
      findings.push({
        minType: null,
        weight: 0.10,
        text: "Encantamento de arma leve: dano extra baixo, duração curta e efeito secundário condicional.",
      });
      return findings;
    }
  
    // Cópia, roubo ou absorção de magia/status.
    if (
      has(
        "copia",
        "copiar",
        "rouba",
        "roubar",
        "roubo",
        "absorve magia",
        "magia roubada",
        "roubar a sombra",
        "rouba a sombra",
        "status mais forte",
        "pego 1/4",
        "pego 1 4",
        "pegar 1/4",
        "pegar 1 4"
      )
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.72,
        text: "Cópia/roubo é efeito complexo. Precisa de teste, limite do que rouba/copia, duração e regra contra alvos fortes.",
      });
    }
  
    // Roubo de status é mais forte que roubo narrativo comum.
    if (
      has("roubar a sombra", "rouba a sombra", "status mais forte", "1/4 do status", "1 4 do status", "fica com") ||
      (has("rouba", "roubar", "pego", "pegar") && has("status", "for", "des", "res", "int", "sab", "car"))
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.66,
        text: "Roubo de status é forte. Precisa de teste, duração curta, limite de atributo roubado e regra de acúmulo.",
      });
    }
  
    // Invocação, totem, obelisco ou criatura.
    if (
      has(
        "invoco",
        "invoca",
        "invocar",
        "criatura",
        "sapo",
        "servo",
        "familiar",
        "obelisco",
        "belisco",
        "totem",
        "construto"
      )
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.55,
        text: "Invocação/estrutura em campo precisa definir vida, CA, duração, alcance, movimento e se age sozinha.",
      });
    }
  
    // Magia que interage com outras magias ou aumenta alcance/custo.
    if (
      has("quando uma magia", "magia de buff", "magia de cura", "uso unico", "uso único", "duas vezes", "intervalo de 1 rodada") ||
      has("aumenta o alcance", "aumenta o alcanse", "custo da magia mais metade", "custando o custo da magia mais metade")
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.58,
        text: "Interagir com outra magia ou ampliar alcance é forte. Precisa de limite de uso, custo extra e duração clara.",
      });
    }
  
    // Área, zona, dano contínuo ou dano por rodada.
    if (
      has(
        "por rodada",
        "por turno",
        "descargas constantes",
        "inimigos em 5m",
        "chuva",
        "nevasca",
        "nuvem",
        "área",
        "area",
        "raio",
        "onda",
        "ao redor",
        "em volta"
      )
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.58,
        text: "Área ou efeito por rodada pesa mais que efeito único. Defina se afeta uma vez, por turno ou por alvo.",
      });
    }
  
    // Dano em cadeia / múltiplos alvos.
    if (
      has(
        "salta para",
        "até 2 inimigos",
        "ate 2 inimigos",
        "ricochete",
        "corrente",
        "encadeia",
        "outro alvo",
        "múltiplos alvos",
        "multiplos alvos"
      )
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.50,
        text: "Dano que passa para outros alvos aumenta muito o impacto. Limite quantidade de alvos e distância.",
      });
    }
  
    // Cargas, marcas e explosões.
    if (
      has("carga", "cargas", "marca", "marcas", "acumulo", "acúmulo") &&
      has("explosao", "explosão", "consome carga", "consome cargas", "consome marca", "consome marcas")
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.54,
        text: "Sistema de cargas/marcas precisa de teto, forma de ganho, custo para gastar e penalidade pós-uso.",
      });
    }
  
    // Controle forte.
    if (
      has(
        "atordoado",
        "paralisa",
        "paralisado",
        "imobiliza",
        "imobilizado",
        "stun",
        "não pode agir",
        "nao pode agir",
        "perde ação",
        "perde acao"
      )
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.56,
        text: "Controle que trava ação é forte. Precisa de CD/teste, duração curta e chance de resistir.",
      });
    }
  
    // Teleporte de si, aliado ou inimigo.
    if (
      has("teleporte", "teletransporta", "teletransportar", "teletransporte", "teleportar") &&
      has("aliado", "inimigo", "teste", "des", "reflexo", "reflexos")
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.46,
        text: "Teleporte de aliado/inimigo é forte. Inimigo precisa de teste e limite de distância/alvos.",
      });
    }
  
    // Buff automático + dano/acerto.
    if (
      has("ativa automaticamente", "automaticamente") ||
      (has("ganha", "recebe") && has("acerto") && has("dano"))
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.58,
        text: "Buff automático com acerto/dano extra pesa como magia complexa. Defina duração e custo de manutenção.",
      });
    }
  
    // Armadura mágica / transformação ofensiva.
    if (
      has("armadura", "armadura de sangue", "armadura de raios", "armadura de trovao", "armadura de trovão") &&
      has("ganha", "dano", "acerto", "paralisado", "reflexo", "reflexos")
    ) {
      findings.push({
        minType: "complexa",
        weight: 0.62,
        text: "Armadura ofensiva com bônus e efeito extra deve ser tratada como transformação/buff complexo.",
      });
    }
  
    // Imunidade.
    if (has("imune", "imunidade")) {
      findings.push({
        minType: "complexa",
        weight: 0.42,
        text: "Imunidade precisa de tipo protegido, custo, alvo, duração e limite de uso.",
      });
    }
  
    // Custo variável/escalável.
    if (
      has(
        "por teleporte",
        "por aliado",
        "por inimigo",
        "+2 por aliado",
        "+2 por inimigo",
        "custo da magia mais metade",
        "custando o custo da magia mais metade"
      )
    ) {
      findings.push({
        minType: null,
        weight: -0.10,
        text: "Custo variável detectado. Isso ajuda a balancear, mas precisa estar escrito de forma clara.",
      });
    }
  
    // Efeitos de realidade, morte ou tempo.
    if (
      has(
        "ressuscitar",
        "reviver",
        "apagar existencia",
        "apagar existência",
        "parar o tempo",
        "voltar no tempo",
        "morte instantanea",
        "morte instantânea"
      )
    ) {
      findings.push({
        minType: "avancada",
        weight: 1.1,
        text: "Efeito de morte, tempo ou realidade tende a ser magia avançada.",
      });
    }
  
    return findings;
  }
  function getHighestMinType(findings) {
    let highest = null;

    for (const finding of findings) {
      if (!finding.minType) continue;
      if (!highest || getTypeRank(finding.minType) > getTypeRank(highest)) highest = finding.minType;
    }

    return highest;
  }

  function estimatePower(data, rule) {
    const groups = getActiveGroups(data.kinds);
    const findings = getComplexityFindings(data);
    const limitScore = getLimitScore(data);

    if (isMinorWeaponEnchantment(data)) {
      const damage = parseDiceAverage([data.damage, data.extraDamage].filter(Boolean).join(" + "));
      let enchantPower = 0.34;

      if (data.rounds != null && rule.rodadas > 0) {
        enchantPower += clamp(data.rounds / rule.rodadas, 0, 1) * 0.12;
      }

      if (damage) {
        enchantPower += clamp(damage.avg / 10, 0, 1) * 0.12;
      }

      if (hasConditionalEffect(data)) {
        enchantPower -= 0.08;
      }

      if (hasAnyText(data, "reduz resistência", "reduz resistencia", "ignorar parcialmente", "resistência pela metade", "resistencia pela metade")) {
        enchantPower += 0.08;
      }

      if (hasAnyText(data, "empunhar", "arma cortante", "espada")) {
        enchantPower -= 0.04;
      }

      return {
        power: clamp(enchantPower, 0.25, 0.62),
        findings,
        limitScore: Math.max(limitScore, 0.25),
      };
    }

    let power = 0.15;

    for (const kind of data.kinds) {
      power = Math.max(power, KIND_WEIGHT[kind] || 0.35);
    }

    if (data.kinds.length > 1) {
      power += Math.min(0.42, 0.11 * (data.kinds.length - 1));
    }

    if (groups.has("range") && data.rangeMeters != null && rule.alcance > 0) {
      const rangeRatio = data.rangeMode === "pessoal" ? 0.25 : data.rangeMeters / rule.alcance;
      const areaBonus = data.rangeMode === "raio" || data.kinds.includes("area") ? 0.18 : 0;
      power += clamp(rangeRatio - 0.35, 0, 1.25) * 0.22 + areaBonus;
    }

    if (groups.has("duration") && data.rounds != null && rule.rodadas > 0) {
      power += clamp(data.rounds / rule.rodadas, 0, 1.4) * 0.18;
    }

    if (groups.has("damage")) {
      const dmg = parseDiceAverage([data.damage, data.extraDamage].filter(Boolean).join(" + "));
      if (dmg) {
        const damageCap = getLimitDamageAvg(rule);
        let damageRatio = dmg.avg / damageCap;

        if (data.kinds.includes("area")) damageRatio *= 0.78;
        if (data.save && hasAnyText(data, "metade", "reduz dano pela metade")) damageRatio *= 0.78;
        if (data.rounds && hasAnyText(data, "por rodada")) damageRatio *= 1.08;

        power += clamp(damageRatio, 0, 2) * 0.28;
      }
    }

    if (groups.has("heal")) {
      const heal = parseDiceAverage(data.heal);
      if (heal) power += clamp(heal.avg / getLimitHealAvg(rule), 0, 2) * 0.25;
    }

    if (groups.has("buff")) {
      const buffCount = data.buffs ?? extractFirstNumber(data.buffText, 0);
      if (buffCount) power += rule.buffs > 0 ? clamp(buffCount / rule.buffs, 0, 2) * 0.20 : 0.18;
      if (hasAnyText(data, "imune", "imunidade", "ignora resistência", "ignora resistencia")) power += 0.20;
    }

    if (groups.has("debuff")) {
      const debuffCount = data.debuffs ?? extractFirstNumber(data.debuffText, 0);
      if (debuffCount) power += rule.buffs > 0 ? clamp(debuffCount / rule.buffs, 0, 2) * 0.20 : 0.18;
      if (hasAnyText(data, "atordoado", "paralisa", "imobiliza")) power += 0.22;
    }

    if (data.channelRounds != null && data.channelRounds > 0) {
      power -= Math.min(0.18, data.channelRounds * 0.06);
    }

    for (const finding of findings) {
      power += finding.weight * 0.22;
    }

    power -= limitScore;

    return {
      power: clamp(power, 0.05, 1.6),
      findings,
      limitScore,
    };
  }

  function calculateSuggestedPm(data, rule) {
    const { power } = estimatePower(data, rule);
    const [minPm, maxPm] = rule.pm;

    return {
      suggested: clamp(Math.round(minPm + (maxPm - minPm) * Math.min(power, 1)), minPm, maxPm),
      power,
    };
  }

  function getBestTierThatFits(data) {
    const findings = getComplexityFindings(data);
    const minType = getHighestMinType(findings);

    for (const [type, grade] of TIER_ORDER) {
      if (minType && getTypeRank(type) < getTypeRank(minType)) continue;

      const currentRule = getRule(type, grade);
      if (!currentRule) continue;

      const { power } = estimatePower(data, currentRule);
      const groups = getActiveGroups(data.kinds);
      const damage = parseDiceAverage([data.damage, data.extraDamage].filter(Boolean).join(" + "));
      const heal = parseDiceAverage(data.heal);

      const rangeOk =
        isWeaponEnchantment(data) ||
        !groups.has("range") ||
        data.rangeMeters == null ||
        data.rangeMode === "pessoal" ||
        data.rangeMeters <= currentRule.alcance * (data.kinds.includes("area") ? 1.05 : 1);

      const durationOk =
        !groups.has("duration") ||
        data.rounds == null ||
        data.rounds <= currentRule.rodadas;

      const damageOk =
        !damage ||
        damage.avg <= getLimitDamageAvg(currentRule) * (data.kinds.includes("area") ? 2.2 : 1.35);

      const healOk =
        !heal ||
        heal.avg <= getLimitHealAvg(currentRule) * 1.25;

      const buffOk =
        data.buffs == null ||
        data.buffs <= currentRule.buffs + 1;

      const debuffOk =
        data.debuffs == null ||
        data.debuffs <= currentRule.buffs + 1;

      if (rangeOk && durationOk && damageOk && healOk && buffOk && debuffOk && power <= 1.08) {
        return { type, grade, rule: currentRule };
      }
    }

    return null;
  }

  function getNextTier(type, grade) {
    const index = getTierIndex(type, grade);
    if (index < 0 || index >= TIER_ORDER.length - 1) return null;

    const [nextType, nextGrade] = TIER_ORDER[index + 1];
    const nextRule = getRule(nextType, nextGrade);

    return nextRule ? { type: nextType, grade: nextGrade, rule: nextRule } : null;
  }

  function getReferenceLines(data, rule) {
    const groups = getActiveGroups(data.kinds);
    const lines = [];

    if (isWeaponEnchantment(data)) {
      lines.push("Alcance: pessoal / arma empunhada. Não precisa preencher metros.");
      lines.push(`Duração: referência ${rule.rodadas} rodadas.`);
      lines.push("Dano extra: avalie como bônus no ataque, não como magia de dano direto.");
      lines.push("Efeito secundário: se for condicional ou aleatório, pesa menos que debuff garantido.");
      lines.push("Encantamento: precisa dizer alvo encantado, duração, dano extra e condição de ativação.");
      return lines;
    }

    if (groups.has("range")) lines.push(`Alcance/Raio: referência ${rule.alcance}m.`);
    if (groups.has("duration")) lines.push(`Duração: referência ${rule.rodadas} rodadas.`);
    if (groups.has("damage")) lines.push(`Dano: referência ${rule.dano}.`);
    if (groups.has("heal")) lines.push(`Cura: referência ${rule.cura}.`);
    if (groups.has("buff")) lines.push(`Buffs: referência ${rule.buffs}.`);
    if (groups.has("debuff")) lines.push(`Debuffs/controle: use referência de ${rule.buffs}, sempre com teste ou condição de fim.`);
    if (groups.has("enchant")) lines.push("Encantamento: avalia duração, dano extra, efeito no acerto e alvo encantado.");
    if (groups.has("transform")) lines.push("Transformação: avalia duração, dano/aura, bônus, penalidades e pós-uso.");
    if (groups.has("summon")) lines.push("Invocação: avalia criatura invocada, ação própria, alvo, duração e resistência.");
    if (groups.has("copy")) lines.push("Cópia/roubo: exige teste, tipos copiáveis, limite de grau, armazenamento e enfraquecimento.");
    if (groups.has("resource")) lines.push("Cargas/marcas/custo extra reduzem ou aumentam força conforme teto e penalidade.");
    if (groups.has("effect")) lines.push("Efeito especial: avalia impacto real, limites, alvo, quantidade, tamanho e duração.");

    return lines;
  }

  function analyzeSpell() {
    const data = getFormData();
    const rule = getRule(data.type, data.grade);

    if (!rule) {
      return { status: "warn", text: "Escolha a categoria e o grau da magia." };
    }

    if (!data.kinds.length) {
      return { status: "warn", text: "Escolha o tipo da magia ou cole a descrição completa para o bot tentar identificar." };
    }

    const groups = getActiveGroups(data.kinds);
    const { suggested, power } = calculateSuggestedPm(data, rule);
    const { findings, limitScore } = estimatePower(data, rule);
    const issues = [];
    const warnings = [];
    const good = [];
    const notes = [];
    const suggestions = [];

    const damage = parseDiceAverage([data.damage, data.extraDamage].filter(Boolean).join(" + "));
    const heal = parseDiceAverage(data.heal);
    const weaponEnchant = isWeaponEnchantment(data);
    const minorWeaponEnchant = isMinorWeaponEnchantment(data);

    if (data.cost == null) {
      warnings.push(`Sem custo informado. Use como ponto de partida: ${suggested} PM.`);
    } else {
      if (data.cost < rule.pm[0]) issues.push(`Custo abaixo do mínimo deste grau: ${rule.pm[0]} PM.`);
      if (data.cost > rule.pm[1]) warnings.push(`Custo acima da faixa deste grau: ${rule.pm[0]} a ${rule.pm[1]} PM.`);

      const diff = suggested - data.cost;

      if (minorWeaponEnchant && Math.abs(diff) <= 2) {
        good.push(`Custo ${data.cost} PM está justo para um encantamento de arma leve.`);
      } else if (diff >= 5 && power >= 1.05) {
        issues.push(`Custo baixo para o impacto real. Sugestão: subir de ${data.cost} PM para perto de ${suggested} PM.`);
      } else if (diff >= 3 && power >= 0.85) {
        warnings.push(`Custo um pouco baixo. Sugestão: subir de ${data.cost} PM para ${suggested} PM.`);
      } else {
        good.push(`Custo ${data.cost} PM está aceitável para o conjunto descrito.`);
      }
    }

    if (groups.has("range") && !weaponEnchant) {
      if (data.rangeMode === "pessoal") {
        good.push("Alcance pessoal reduz o peso da magia.");
      } else if (data.rangeMeters == null) {
        warnings.push("Falta alcance/raio em metros. Sem isso o cálculo fica menos preciso.");
      } else if (data.rangeMeters > rule.alcance * (data.kinds.includes("area") ? 1.1 : 1)) {
        issues.push(`${capitalize(data.rangeMode)} acima da referência: ${data.rangeMeters}m usado, referência ${rule.alcance}m.`);
      } else {
        good.push(`${capitalize(data.rangeMode)} dentro da referência de ${rule.alcance}m.`);
      }
    } else if (weaponEnchant) {
      good.push("Alcance tratado como pessoal / arma empunhada, então não precisa preencher metros.");
    }

    if (groups.has("duration")) {
      if (data.rounds == null) {
        warnings.push("Falta duração em rodadas. Duração indefinida pesa mais no balanceamento.");
      } else if (data.rounds > rule.rodadas) {
        issues.push(`Duração acima da referência: ${data.rounds} rodadas, referência ${rule.rodadas}.`);
      } else {
        good.push(`Duração dentro da referência de ${rule.rodadas} rodadas.`);
      }
    }

    if (groups.has("damage")) {
      if (!damage) {
        warnings.push("Este tipo usa dano, mas o bot não achou dados de dano no texto.");
      } else if (minorWeaponEnchant) {
        good.push("Dano extra baixo para encantamento de arma.");
      } else {
        const limit = getLimitDamageAvg(rule);
        const allowed = limit * (data.kinds.includes("area") ? 2.2 : 1.35);

        if (damage.avg > allowed) {
          warnings.push(`Dano estimado alto: ${damage.raw} tem média aproximada ${damage.avg.toFixed(1)}. Confirme se é total, por rodada ou por alvo.`);
        } else {
          good.push(`Dano estimado compatível para ${rule.typeLabel} ${rule.gradeLabel}.`);
        }
      }
    }

    if (groups.has("heal")) {
      if (!heal) {
        warnings.push("Este tipo usa cura, mas o bot não achou dados de cura no texto.");
      } else if (heal.avg > getLimitHealAvg(rule) * 1.25) {
        warnings.push(`Cura estimada alta: ${heal.raw}.`);
      } else {
        good.push("Cura compatível com a referência.");
      }
    }

    if (groups.has("save") && !weaponEnchant) {
      if (!data.save && !hasAnyText(data, "teste", "cd", "reflexos", "reflexo", "res", "des")) {
        warnings.push("Adicione teste/CD ou resistência para efeito ofensivo, debuff ou controle.");
      } else {
        good.push("Teste/resistência detectado.");
      }
    }

    if (groups.has("copy")) {
      if (!data.copyLimit && !hasAnyText(data, "simples up 3", "superiores", "mais fracas")) {
        issues.push("Defina o limite de cópia: até qual grau copia e o que acontece com magia superior.");
      } else {
        good.push("Limite de cópia detectado.");
      }

      if (!data.copyTypes && !hasAnyText(data, "encantamento", "buff", "debuff", "transformação", "transformacao", "emissão", "emissao")) {
        warnings.push("Liste tipos copiáveis e tipos proibidos.");
      } else {
        good.push("Tipos copiáveis/não copiáveis detectados.");
      }

      if (!data.copyStorage && !hasAnyText(data, "esfera", "guardar", "armazena", "cospe")) {
        warnings.push("Defina armazenamento e uso da magia copiada.");
      } else {
        good.push("Forma de armazenamento/uso da magia copiada detectada.");
      }
    }

    if (groups.has("summon")) {
      if (!data.summon && !hasAnyText(data, "invoco", "invoca", "sapo", "criatura")) {
        warnings.push("Diga exatamente o que é invocado.");
      }

      if (!data.summonBehavior && !hasAnyText(data, "vai atras", "vai atrás", "persegue", "alvo")) {
        warnings.push("Defina comportamento, alvo e se a invocação age sozinha.");
      } else {
        good.push("Comportamento da invocação detectado.");
      }
    }

    if (groups.has("resource")) {
      if (data.charges || hasAnyText(data, "carga", "cargas", "marca", "marcas", "custa")) {
        good.push("Sistema de cargas/marcas/custo extra detectado.");
      }
    }

    if (minorWeaponEnchant) {
      good.push("Efeito secundário é condicional/aleatório, então pesa menos que um debuff garantido.");
    }

    if (data.drawback || hasAnyText(data, "sofre", "penalidade", "-2", "pós uso", "pos uso")) {
      good.push("Penalidade/custo pós-uso detectado, isso ajuda no balanceamento.");
    }

    for (const finding of findings) {
      notes.push(finding.text);

      if (finding.minType && getTypeRank(data.type) < getTypeRank(finding.minType)) {
        issues.push(`Pelo efeito descrito, isso parece no mínimo magia ${RULES[finding.minType].label}.`);
      }
    }

    if (!data.description && !data.pasteText && getAllText(data).length < 30) {
      warnings.push("Cole a descrição completa para o bot avaliar melhor.");
    }

    if (data.kinds.length >= 4 && !weaponEnchant) {
      warnings.push(`A magia tem ${data.kinds.length} tipos. Isso pesa bastante; corte efeitos ou coloque teste, limite e custo extra.`);
    }

    const bestTier = getBestTierThatFits(data);
    const nextTier = getNextTier(data.type, data.grade);

    if (issues.length) {
      if (bestTier && (bestTier.type !== data.type || bestTier.grade !== data.grade)) {
        suggestions.push(`Testar como ${bestTier.rule.typeLabel} ${bestTier.rule.gradeLabel}.`);
      } else if (nextTier) {
        suggestions.push(`Testar como ${nextTier.rule.typeLabel} ${nextTier.rule.gradeLabel}.`);
      }

      suggestions.push("Melhores ajustes: corte 1 efeito secundário, reduza área/duração/dano ou adicione custo extra claro.");
    } else if (warnings.length) {
      suggestions.push(`Está quase balanceada. Eu usaria entre ${Math.max(rule.pm[0], suggested - 2)} e ${Math.min(rule.pm[1], suggested + 2)} PM.`);
    } else {
      suggestions.push("Pode manter como está.");
    }

    if (minorWeaponEnchant) {
      suggestions.length = 0;
      suggestions.push(`Manter o custo em ${data.cost ?? suggested} PM está aceitável.`);
      suggestions.push("Só deixe claro que o bônus acontece apenas enquanto a arma estiver empunhada e durante a duração da magia.");
      suggestions.push("O efeito de -2 CA ou +2 esquiva é condicional pela rolagem 1d4, então não precisa subir para 20 PM.");
    }

    if (data.kinds.includes("copia")) {
      suggestions.push("Para cópia/roubo, mantenha: teste, limite de grau, tipos copiáveis, 1 magia guardada e enfraquecimento para magias superiores.");
    }

    if (data.kinds.includes("area")) {
      suggestions.push("Para área/zona, deixe claro se o dano acontece por rodada, por alvo ou uma vez só.");
    }

    if (data.kinds.includes("transformacao")) {
      suggestions.push("Para transformação/sobrecarga, mantenha teto de cargas e penalidade pós-uso.");
    }

    const status = issues.length ? "bad" : warnings.length ? "warn" : "good";

    const lines = [];
    lines.push(`${data.name || "Magia sem nome"} — ${rule.typeLabel} ${rule.gradeLabel}`);
    lines.push(`Tipo da magia: ${data.kindLabels.join(" + ")}`);
    lines.push(`Veredito: ${status === "good" ? "Está bom." : status === "warn" ? "Está quase bom, mas eu ajustaria detalhes." : "Precisa de ajuste para ficar balanceada."}`);
    lines.push(`PM sugerido: ${suggested} PM | Faixa: ${rule.pm[0]} a ${rule.pm[1]} PM`);
    lines.push(`Peso estimado: ${(power * 100).toFixed(0)}% | Redução por limites: ${(limitScore * 100).toFixed(0)}%`);

    lines.push("\nReferência usada:");
    getReferenceLines(data, rule).forEach((line) => lines.push(`- ${line}`));

    if (issues.length) {
      lines.push("\nO que está forte demais:");
      issues.forEach((item) => lines.push(`- ${item}`));
    }

    if (warnings.length) {
      lines.push("\nAtenções:");
      warnings.forEach((item) => lines.push(`- ${item}`));
    }

    if (notes.length) {
      lines.push("\nObservações do algoritmo:");
      notes.forEach((item) => lines.push(`- ${item}`));
    }

    if (!issues.length && good.length) {
      lines.push("\nPontos ok:");
      good.slice(0, 10).forEach((item) => lines.push(`- ${item}`));
    }

    lines.push("\nSugestões práticas:");
    suggestions.forEach((item) => lines.push(`- ${item}`));

    return {
      status,
      text: lines.join("\n"),
      suggestedPm: suggested,
    };
  }

  function renderOutput(result) {
    const output = $("spellBotOutput");
    if (!output) return;

    const status = result?.status || "warn";
    const text = result?.text || "Preencha a magia e clique em analisar.";

    output.innerHTML = "";

    const message = document.createElement("div");
    message.className = `spellBotMessage spellResult${capitalize(status)}`;
    message.textContent = text;

    output.appendChild(message);

    lastResult = {
      status,
      text,
      suggestedPm: result?.suggestedPm || null,
    };

    saveDebounced();
  }

  function cleanPastedSpellText(text) {
    return String(text || "")
      .replace(/[🔥💧❄️⚡🌩️🌀✨🐸•→]/g, " ")
      .replace(/[{}[\]]/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractRegex(text, regex, group = 1) {
    const match = String(text || "").match(regex);
    return match ? String(match[group] || "").trim() : "";
  }

  function getFirstUsefulLine(text) {
    const lines = String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const lower = normalizeText(line);

      if (
        lower.includes("custo") ||
        lower.includes("duracao") ||
        lower.includes("duração") ||
        lower.includes("alcance") ||
        lower.includes("tipo") ||
        lower.includes("descricao") ||
        lower.includes("descrição")
      ) {
        continue;
      }

      return line
        .replace(/^magia\s*[:\-]\s*/i, "")
        .replace(/\*\*/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/,$/, "")
        .trim();
    }

    return "";
  }

  function extractCostFromText(text) {
    const raw = String(text || "");
    const source = normalizeText(raw);
  
    // Evita pegar "custo da magia + metade" como se fosse custo fixo.
    // Mas ainda permite pegar [20 PM], "Custa: 12 de PM", "12 de PM |".
    const patterns = [
      /\[\s*(\d+)\s*(?:de\s*)?pm\s*\]/i,
      /\(\s*(\d+)\s*(?:de\s*)?pm\s*\)/i,
      /(?:custa|custo)\s*[:\-]?\s*(\d+)\s*(?:de\s*)?pm/i,
      /(?:^|\n|\|)\s*(\d+)\s*(?:de\s*)?pm\s*(?:\||$|\n)/i,
      /\b(\d+)\s*(?:de\s*)?pm\b/i,
    ];
  
    for (const regex of patterns) {
      const match = raw.match(regex);
      if (match) return Number(match[1]);
    }
  
    // Caso venha escrito "PM: 20"
    const reversed = raw.match(/\bpm\s*[:\-]?\s*(\d+)\b/i);
    if (reversed) return Number(reversed[1]);
  
    return null;
  }
  function extractRoundsFromText(text) {
    const raw = String(text || "");
  
    const direct =
      extractRegex(raw, /dura[cç][aã]o\s*[:\-]?\s*(?:m[aá]xima\s*de\s*)?(\d+)\s*(?:rodadas?|turnos?)/i) ||
      extractRegex(raw, /durando\s*(\d+)\s*(?:rodadas?|turnos?)/i) ||
      extractRegex(raw, /dura[cç][aã]o\s*m[aá]xima\s*de\s*(\d+)\s*(?:rodadas?|turnos?)/i);
  
    if (direct) return Number(direct);
  
    const compact = extractRegex(raw, /(\d+)\s*(?:rodadas?|turnos?)/i);
    return compact ? Number(compact) : null;
  }

  function extractDurationText(text) {
    const line = extractRegex(text, /dura[cç][aã]o\s*[:\-]?\s*([^\n|,]+)/i);
    if (line) return line.trim();

    const rounds = extractRoundsFromText(text);
    return rounds != null ? `${rounds} rodadas` : "";
  }

  function extractRangeFromText(text) {
    const raw = String(text || "");

    if (/alcance\s*[:\-]?\s*pessoal/i.test(raw)) {
      return { mode: "pessoal", meters: "", shape: "pessoal" };
    }

    if (textHas(raw, "encantamento de arma", "arma cortante", "espada", "lâmina", "lamina")) {
      return { mode: "pessoal", meters: "", shape: "arma empunhada" };
    }

    const radius =
      extractRegex(raw, /raio\s*(?:de)?\s*[:\-]?\s*(\d+)\s*m/i) ||
      extractRegex(raw, /(?:área|area)\s*(?:de)?\s*[:\-]?\s*(\d+)\s*m/i) ||
      extractRegex(raw, /(\d+)\s*metros?\s*(?:em\s*)?(?:circulo|círculo|raio|área|area)/i);

    if (radius) {
      return { mode: "raio", meters: Number(radius), shape: "círculo / área" };
    }

    const reach =
      extractRegex(raw, /alcance\s*[:\-]?\s*(\d+)\s*(?:m|metros?)/i) ||
      extractRegex(raw, /(\d+)\s*(?:m|metros?)\s*de\s*alcance/i);

    if (reach) {
      return { mode: "alcance", meters: Number(reach), shape: "alvo / alcance" };
    }

    return { mode: "", meters: "", shape: "" };
  }

  function extractEnchantDamageLine(text) {
    const lines = String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const direct = lines.find((line) => {
      const n = normalizeText(line);
      return /\d+\s*d\s*\d+/i.test(line) &&
        (n.includes("dano igneo") || n.includes("dano hidrico") || n.includes("ataques com") || n.includes("causam"));
    });

    if (direct) return direct;

    const diceOnly = lines.find((line) => /\+\s*\d+\s*d\s*\d+/i.test(line));
    return diceOnly || "";
  }

  function extractDiceLines(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /\d+\s*d\s*\d+/i.test(line))
      .join(" | ");
  }

  function extractSaveLine(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => {
        const lower = normalizeText(line);
        return (
          lower.includes("teste") ||
          lower.includes(" cd ") ||
          lower.includes("reflexos") ||
          lower.includes("reflexo") ||
          lower.includes(" res ") ||
          lower.includes(" des ")
        );
      }) || "";
  }

  function extractSaveEffectLine(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => {
        const lower = normalizeText(line);
        return (
          lower.includes("caso passe") ||
          lower.includes("se passar") ||
          lower.includes("em caso de falha") ||
          lower.includes("falha") ||
          lower.includes("metade do dano") ||
          lower.includes("reduzir dano")
        );
      }) || "";
  }
  function parseExplicitTierFromText(text) {
    const source = normalizeText(text);

    const hasUp = (n) => new RegExp(`\\b(?:up|upgrade|nivel|nível|grau)\\s*${n}\\b`).test(source);
    const hasBase = /\bbase\b/.test(source) || /\bbasica\b/.test(source) || /\bbasico\b/.test(source);

    function gradeFor(type) {
      if (type === "avancada") return hasUp(1) ? "up1" : "base";
      if (type === "complexa") {
        if (hasUp(2)) return "up2";
        if (hasUp(1)) return "up1";
        if (hasBase) return "base";
        return null;
      }
      if (type === "simples") {
        if (hasUp(3)) return "up3";
        if (hasUp(2)) return "up2";
        if (hasUp(1)) return "up1";
        if (hasBase) return "base";
        return null;
      }
      return null;
    }

    const tierPatterns = [
      { type: "avancada", test: /\bavancad[ao]\b/ },
      { type: "complexa", test: /\bcomplex[ao]\b/ },
      { type: "simples", test: /\bsimples\b/ },
    ];

    for (const item of tierPatterns) {
      if (!item.test.test(source)) continue;
      const grade = gradeFor(item.type);
      if (grade) return { type: item.type, grade };
    }

    const separatedType = extractRegex(text, /categoria\s*[:\-]?\s*(simples|complexa|avancada|avançada)/i);
    const separatedGrade = extractRegex(text, /(?:grau|nivel|nível|up)\s*[:\-]?\s*(base|\d+)/i);

    if (separatedType && separatedGrade) {
      const type = normalizeText(separatedType).replace("avancada", "avancada");
      const n = normalizeText(separatedGrade);
      const maxUp = type === "simples" ? 3 : type === "complexa" ? 2 : 1;
      const grade = n === "base" ? "base" : `up${clamp(toInt(n, 1), 1, maxUp)}`;
      if (RULES[type]?.grades?.[grade]) return { type, grade };
    }

    return null;
  }

  function getTierFromCost(cost, preferredType = "") {
    if (cost == null) return null;

    const candidates = TIER_ORDER
      .map(([type, grade]) => ({ type, grade, rule: getRule(type, grade) }))
      .filter((item) => item.rule && cost >= item.rule.pm[0] && cost <= item.rule.pm[1]);

    if (!candidates.length) {
      if (cost >= 70) return { type: "avancada", grade: "up1" };
      if (cost >= 35) return { type: "avancada", grade: "base" };
      if (cost >= 26) return { type: "complexa", grade: "up2" };
      if (cost >= 21) return { type: "complexa", grade: "up1" };
      if (cost >= 16) return preferredType === "complexa" ? { type: "complexa", grade: "base" } : { type: "simples", grade: "up3" };
      if (cost >= 11) return preferredType === "complexa" ? { type: "complexa", grade: "base" } : { type: "simples", grade: "up2" };
      if (cost >= 7) return preferredType === "complexa" ? { type: "complexa", grade: "base" } : { type: "simples", grade: "up1" };
      if (cost >= 4) return { type: "simples", grade: "up1" };
      return { type: "simples", grade: "base" };
    }

    if (preferredType) {
      const sameType = candidates.filter((item) => item.type === preferredType);
      if (sameType.length) return sameType[Math.floor((sameType.length - 1) / 2)];
    }

    return candidates[Math.floor((candidates.length - 1) / 2)];
  }

  function buildPasteDataForEstimate(text, cost, kinds) {
    const clean = cleanPastedSpellText(text);
    const range = extractRangeFromText(clean);
    const rounds = extractRoundsFromText(clean);
    const duration = extractDurationText(clean);
    const source = normalizeText(clean);
    const diceLines = extractDiceLines(clean);
    const saveLine = extractSaveLine(clean);
    const saveEffectLine = extractSaveEffectLine(clean);
  
    const data = {
      type: "simples",
      grade: "base",
      kinds: kinds.length ? kinds : inferKindsFromText(clean).slice(0, 6),
      name: getFirstUsefulLine(clean),
      cost,
      rangeMode: range.mode || "alcance",
      rangeMeters: range.meters === "" ? null : toNumber(range.meters, null),
      areaShape: range.shape || "",
      duration,
      rounds,
      damage: "",
      extraDamage: "",
      heal: "",
      save: saveLine,
      saveEffect: saveEffectLine,
      buffs: null,
      buffText: "",
      debuffs: null,
      debuffText: "",
      enchantTarget: "",
      enchantEffect: "",
      transformTarget: "",
      transformStats: "",
      summon: "",
      summonBehavior: "",
      copyLimit: "",
      copyTypes: "",
      copyStorage: "",
      charges: "",
      drawback: "",
      effectLimits: "",
      channelRounds: null,
      description: clean,
      pasteText: clean,
    };
  
    // Dano ou cura
    if (
      source.includes("cura") ||
      source.includes("curar") ||
      source.includes("curado") ||
      source.includes("recupera vida") ||
      source.includes("recupera hp") ||
      source.includes("restaura vida") ||
      source.includes("regenera")
    ) {
      data.heal = diceLines;
    } else {
      data.damage = diceLines;
    }
  
    // Buffs
    if (
      source.includes("imune") ||
      source.includes("imunidade") ||
      source.includes("bonus") ||
      source.includes("bônus") ||
      source.includes("esquiva") ||
      source.includes("ganha") ||
      source.includes("recebe") ||
      source.includes("acerto") ||
      source.includes("+2 de acerto") ||
      source.includes("+ 2 de acerto") ||
      source.includes("+4 de dano") ||
      source.includes("+ 4 de dano") ||
      source.includes("armadura")
    ) {
      data.buffs = 1;
      data.buffText = "buff/acerto/dano/armadura detectado no texto colado";
    }
  
    // Debuffs e controle
    if (
      source.includes("-2") ||
      source.includes("reduz") ||
      source.includes("diminui") ||
      source.includes("atordoado") ||
      source.includes("paralisa") ||
      source.includes("paralisado") ||
      source.includes("imobiliza") ||
      source.includes("imobilizado") ||
      source.includes("rouba") ||
      source.includes("roubar") ||
      source.includes("absorve") ||
      source.includes("pego") ||
      source.includes("pegar") ||
      source.includes("status mais forte") ||
      source.includes("1 4 do status") ||
      source.includes("1/4 do status")
    ) {
      data.debuffs = 1;
      data.debuffText = "debuff/controle/roubo detectado no texto colado";
    }
  
    // Encantamento de arma
    if (
      source.includes("arma") ||
      source.includes("espada") ||
      source.includes("lamina") ||
      source.includes("lâmina") ||
      source.includes("petrificando ele na sua arma") ||
      source.includes("na sua arma") ||
      source.includes("ataques com")
    ) {
      data.enchantTarget = "arma / ataque físico";
      data.enchantEffect = "dano extra, acerto ou efeito aplicado ao atacar.";
    }
  
    // Transformação / armadura mágica
    if (
      source.includes("transforma") ||
      source.includes("transformacao") ||
      source.includes("transformação") ||
      source.includes("se torna") ||
      source.includes("sobrecarga") ||
      source.includes("armadura") ||
      source.includes("armadura de sangue") ||
      source.includes("armadura de raios") ||
      source.includes("armadura de trovao") ||
      source.includes("armadura de trovão")
    ) {
      data.transformTarget = "usuário";
      data.transformStats = "transformação/armadura com bônus ou efeitos extras detectada.";
    }
  
    // Invocação / estrutura em campo
    if (
      source.includes("invoco") ||
      source.includes("invoca") ||
      source.includes("invocar") ||
      source.includes("criatura") ||
      source.includes("sapo") ||
      source.includes("servo") ||
      source.includes("familiar") ||
      source.includes("obelisco") ||
      source.includes("belisco") ||
      source.includes("totem") ||
      source.includes("construto")
    ) {
      data.summon = "invocação/estrutura detectada no texto.";
      data.summonBehavior = "definir vida, CA, duração, movimento, alvo e se age sozinha.";
    }
  
    // Cópia / roubo / absorção de magia ou status
    if (
      source.includes("copia") ||
      source.includes("copiar") ||
      source.includes("rouba") ||
      source.includes("roubar") ||
      source.includes("roubo") ||
      source.includes("absorve magia") ||
      source.includes("magia roubada") ||
      source.includes("roubar a sombra") ||
      source.includes("rouba a sombra") ||
      source.includes("status mais forte")
    ) {
      data.copyLimit =
        source.includes("up") ||
        source.includes("grau") ||
        source.includes("superior") ||
        source.includes("1 4") ||
        source.includes("1/4") ||
        source.includes("status")
          ? "limite citado ou necessário: definir grau/status máximo roubado/copied"
          : "";
  
      data.copyTypes =
        source.includes("tipo") ||
        source.includes("encantamento") ||
        source.includes("buff") ||
        source.includes("debuff") ||
        source.includes("cura") ||
        source.includes("transformacao") ||
        source.includes("transformação")
          ? "tipos afetados citados no texto"
          : "";
  
      data.copyStorage =
        source.includes("guarda") ||
        source.includes("guardar") ||
        source.includes("armazena") ||
        source.includes("armazenar") ||
        source.includes("esfera") ||
        source.includes("sombra")
          ? "armazenamento/uso citado ou ligado à sombra"
          : "";
    }
  
    // Cargas, marcas e custo variável
    if (
      source.includes("carga") ||
      source.includes("cargas") ||
      source.includes("marca") ||
      source.includes("marcas")
    ) {
      data.charges = "cargas/marcas detectadas";
    }
  
    // Custo variável / escalável
    if (
      source.includes("por teleporte") ||
      source.includes("por aliado") ||
      source.includes("por inimigo") ||
      source.includes("+2 por aliado") ||
      source.includes("+2 por inimigo") ||
      source.includes("custo da magia mais metade") ||
      source.includes("custando o custo da magia mais metade") ||
      source.includes("custo da magia + metade")
    ) {
      data.effectLimits = [
        data.effectLimits,
        "custo variável/escalável detectado",
      ].filter(Boolean).join("; ");
    }
  
    // Interação com outras magias
    if (
      source.includes("quando uma magia") ||
      source.includes("magia de buff") ||
      source.includes("magia de cura") ||
      source.includes("uso unico") ||
      source.includes("uso único") ||
      source.includes("duas vezes") ||
      source.includes("intervalo de 1 rodada") ||
      source.includes("aumenta o alcance") ||
      source.includes("aumenta o alcanse")
    ) {
      data.effectLimits = [
        data.effectLimits,
        "interação com outra magia detectada; precisa de limite de uso e duração",
      ].filter(Boolean).join("; ");
    }
  
    // Penalidade / drawback
    if (
      source.includes("sofre") ||
      source.includes("penalidade") ||
      source.includes("pos uso") ||
      source.includes("pós uso") ||
      source.includes("toma 1d4") ||
      source.includes("por rodada ativa")
    ) {
      data.drawback = "penalidade/custo pós-uso detectado.";
    }
  
    // Canalização / concentração
    if (
      source.includes("canaliza") ||
      source.includes("concentracao") ||
      source.includes("concentração") ||
      source.includes("assovia") ||
      source.includes("prepara")
    ) {
      data.channelRounds = 1;
    }
  
    // Teste/CD
    if (
      !data.save &&
      (
        source.includes("teste") ||
        source.includes("cd") ||
        source.includes("reflexo") ||
        source.includes("reflexos") ||
        source.includes("res") ||
        source.includes("des")
      )
    ) {
      data.save = saveLine || "teste/CD detectado no texto";
    }
  
    // Resultado de teste
    if (
      !data.saveEffect &&
      (
        source.includes("se passar") ||
        source.includes("caso passe") ||
        source.includes("se falhar") ||
        source.includes("caso falhe") ||
        source.includes("metade do dano") ||
        source.includes("fica paralisado")
      )
    ) {
      data.saveEffect = saveEffectLine || "resultado de sucesso/falha detectado no texto";
    }
  
    return inferMissingNumbers(data);
  }
  function chooseCategoryAndGradeFromPaste(text, cost, kinds) {
    const explicitTier = parseExplicitTierFromText(text);
    if (explicitTier) return { type: explicitTier.type, grade: explicitTier.grade };
  
    const data = buildPasteDataForEstimate(text, cost, kinds);
    const findings = getComplexityFindings(data);
    const minType = getHighestMinType(findings);
  
    const complexKinds = [
      "area",
      "controle",
      "transformacao",
      "invocacao",
      "copia",
      "necromancia",
      "reacao",
      "movimento",
      "conjuracao",
    ];
  
    const source = normalizeText(text);
    const damage = parseDiceAverage(data.damage || data.extraDamage);
    const heal = parseDiceAverage(data.heal);
  
    const hasStrongControl =
      source.includes("paralisado") ||
      source.includes("paralisa") ||
      source.includes("atordoado") ||
      source.includes("imobiliza") ||
      source.includes("nao pode agir") ||
      source.includes("não pode agir") ||
      source.includes("perde acao") ||
      source.includes("perde ação");
  
    const hasStatSteal =
      source.includes("roubar a sombra") ||
      source.includes("rouba a sombra") ||
      source.includes("status mais forte") ||
      source.includes("1 4 do status") ||
      source.includes("1/4 do status") ||
      source.includes("pego 1 4") ||
      source.includes("pego 1/4") ||
      (
        (source.includes("rouba") || source.includes("roubar") || source.includes("pego") || source.includes("pegar")) &&
        (source.includes("for") || source.includes("des") || source.includes("res") || source.includes("int") || source.includes("sab") || source.includes("car"))
      );
  
    const hasAutoBuffCombo =
      source.includes("ativa automaticamente") ||
      source.includes("automaticamente tiros divinos") ||
      (
        (source.includes("ganha") || source.includes("recebe")) &&
        source.includes("acerto") &&
        source.includes("dano")
      );
  
    const hasSummonStructure =
      source.includes("obelisco") ||
      source.includes("belisco") ||
      source.includes("totem") ||
      source.includes("construto") ||
      (
        (source.includes("invoca") || source.includes("invoco") || source.includes("invocar")) &&
        (source.includes("vida") || source.includes("ca") || source.includes("move") || source.includes("flutuando"))
      );
  
    const hasSpellInteraction =
      source.includes("quando uma magia") ||
      source.includes("magia de buff") ||
      source.includes("magia de cura") ||
      source.includes("uso unico") ||
      source.includes("uso único") ||
      source.includes("duas vezes") ||
      source.includes("intervalo de 1 rodada") ||
      source.includes("aumenta o alcance") ||
      source.includes("aumenta o alcanse") ||
      source.includes("custo da magia mais metade") ||
      source.includes("custando o custo da magia mais metade");
  
    const hasVariableCost =
      source.includes("por teleporte") ||
      source.includes("por aliado") ||
      source.includes("por inimigo") ||
      source.includes("+2 por aliado") ||
      source.includes("+2 por inimigo") ||
      source.includes("custo da magia mais metade");
  
    const hasOffensiveArmor =
      (
        source.includes("armadura") ||
        source.includes("armadura de sangue") ||
        source.includes("armadura de raios") ||
        source.includes("armadura de trovao") ||
        source.includes("armadura de trovão")
      ) &&
      (
        source.includes("acerto") ||
        source.includes("dano") ||
        source.includes("reflexo") ||
        source.includes("paralisado")
      );
  
    const hasAllyEnemyTeleport =
      (
        source.includes("teleporte") ||
        source.includes("teletransporta") ||
        source.includes("teletransportar") ||
        source.includes("teletransporte")
      ) &&
      (
        source.includes("aliado") ||
        source.includes("inimigo") ||
        source.includes("teste")
      );
  
    const highImpact =
      (damage && damage.avg >= 26) ||
      (heal && heal.avg >= 24) ||
      (data.rangeMeters != null && data.rangeMeters >= 20) ||
      (data.rounds != null && data.rounds >= 10) ||
      hasStrongControl ||
      hasStatSteal ||
      hasAutoBuffCombo ||
      hasSummonStructure ||
      hasSpellInteraction ||
      hasOffensiveArmor ||
      source.includes("morte instantanea") ||
      source.includes("morte instantânea") ||
      source.includes("apagar existencia") ||
      source.includes("apagar existência") ||
      source.includes("parar o tempo") ||
      source.includes("voltar no tempo");
  
    let preferredType = minType || "";
  
    if (!preferredType && (highImpact || cost >= 35)) {
      preferredType = "avancada";
    }
  
    // Se tem cara de magia complexa, mas não é absurda/avançada.
    if (
      preferredType !== "avancada" &&
      (
        hasSummonStructure ||
        hasSpellInteraction ||
        hasStatSteal ||
        hasStrongControl ||
        hasAutoBuffCombo ||
        hasOffensiveArmor ||
        hasAllyEnemyTeleport ||
        kinds.length >= 2 ||
        kinds.some((kind) => complexKinds.includes(kind)) ||
        cost >= 14
      )
    ) {
      preferredType = "complexa";
    }
  
    // Ajustes diretos por custo quando o custo foi escrito claramente.
    // Isso corrige casos como [20 PM], 12 de PM, 8 de PM por teleporte.
    if (cost != null) {
      if (preferredType === "complexa") {
        if (cost > 25) return { type: "complexa", grade: "up2" };
        if (cost > 20) return { type: "complexa", grade: "up1" };
        return { type: "complexa", grade: "base" };
      }
  
      if (preferredType === "avancada") {
        return { type: "avancada", grade: cost > 70 ? "up1" : "base" };
      }
    }
  
    const bestTier = getBestTierThatFits(data);
    const costTier = getTierFromCost(cost, preferredType);
  
    if (bestTier && costTier) {
      const bestIndex = getTierIndex(bestTier.type, bestTier.grade);
      const costIndex = getTierIndex(costTier.type, costTier.grade);
      const minTypeBlocked = minType && getTypeRank(costTier.type) < getTypeRank(minType);
  
      if (minTypeBlocked) {
        return { type: bestTier.type, grade: bestTier.grade };
      }
  
      if (Math.abs(bestIndex - costIndex) <= 1) {
        return costIndex >= bestIndex
          ? { type: costTier.type, grade: costTier.grade }
          : { type: bestTier.type, grade: bestTier.grade };
      }
  
      return { type: bestTier.type, grade: bestTier.grade };
    }
  
    if (bestTier) return { type: bestTier.type, grade: bestTier.grade };
    if (costTier) return { type: costTier.type, grade: costTier.grade };
  
    if (preferredType === "avancada") return { type: "avancada", grade: "base" };
    if (preferredType === "complexa") return { type: "complexa", grade: "base" };
  
    return { type: "simples", grade: "base" };
  }

  function applyKindsToForm(kinds) {
    if (!kinds.length) return;

    if (kinds.length === 1) {
      setFieldValue("spellKind", kinds[0]);
      syncKindSelectors();
      syncDynamicFields();
      updateRulesPreview();
      return;
    }

    setFieldValue("spellKind", "multi");
    setFieldValue("spellKindCount", String(Math.min(kinds.length, 6)));
    syncKindSelectors(kinds);
    syncDynamicFields();
    updateRulesPreview();
  }

  function parsePastedSpellIntoForm(silent = false) {
    const rawText = $("spellPasteText")?.value.trim() || "";

    if (!rawText) {
      if (!silent) {
        renderOutput({
          status: "warn",
          text: "Cole o texto da magia no campo 'Colar magia pronta' antes de auto preencher.",
        });
      }
      return;
    }

    const text = cleanPastedSpellText(rawText);
    const cost = extractCostFromText(text);
    const kinds = inferKindsFromText(text).slice(0, 6);
    const category = chooseCategoryAndGradeFromPaste(text, cost, kinds);
    const range = extractRangeFromText(text);
    const rounds = extractRoundsFromText(text);
    const duration = extractDurationText(text);
    const isEnchant = kinds.length === 1 && kinds[0] === "encantamento";
    const diceLines = isEnchant ? extractEnchantDamageLine(text) : extractDiceLines(text);
    const saveLine = extractSaveLine(text);
    const saveEffectLine = extractSaveEffectLine(text);
    const name = getFirstUsefulLine(text);
    const normalized = normalizeText(text);

    setFieldValue("spellName", name);
    if (cost != null) setFieldValue("spellCost", cost);

    setFieldValue("spellType", category.type);
    syncGradeOptions(false);
    setFieldValue("spellGrade", category.grade);

    applyKindsToForm(kinds);

    if (range.mode) setFieldValue("spellRangeMode", range.mode);
    if (range.meters !== "") setFieldValue("spellRangeMeters", range.meters);
    else if (range.mode === "pessoal") clearFieldValue("spellRangeMeters");
    if (range.shape) setFieldValue("spellAreaShape", range.shape);

    if (duration) setFieldValue("spellDuration", duration);
    if (rounds != null) setFieldValue("spellRounds", rounds);
    if (diceLines) setFieldValue("spellDamage", diceLines);
    if (saveLine && !isEnchant) setFieldValue("spellSave", saveLine);
    if (saveEffectLine && !isEnchant) setFieldValue("spellSaveEffect", saveEffectLine);

    if (isEnchant) {
      setFieldValue("spellEnchantTarget", "arma / lâmina");
      setFieldValue("spellEnchantEffect", "dano extra elemental e efeito condicional ao acertar.");
      setFieldValue("spellEffectLimits", "Requer empunhar espada/arma cortante. Efeitos secundários dependem da rolagem 1d4.");
    } else {
      if (normalized.includes("imune") || normalized.includes("imunidade") || normalized.includes("esquiva") || normalized.includes("marca")) {
        setFieldValue("spellBuffs", "1");
        setFieldValue("spellBuffText", "Buff/imunidade/marca detectado no texto colado.");
      }

      if (normalized.includes("atordoado") || normalized.includes("-2") || normalized.includes("rouba") || normalized.includes("absorve")) {
        setFieldValue("spellDebuffs", "1");
        setFieldValue("spellDebuffText", "Debuff/roubo/controle detectado no texto colado.");
      }

      if (normalized.includes("arma") || normalized.includes("espada") || normalized.includes("lamina") || normalized.includes("lâmina")) {
        setFieldValue("spellEnchantTarget", "arma / lâmina");
        setFieldValue("spellEnchantEffect", "efeito elemental ou efeito no acerto detectado.");
      }

      setFieldValue("spellEffectLimits", "Limitações extraídas/descritas no texto colado.");
    }

    if (normalized.includes("se torna") || normalized.includes("sobrecarga") || normalized.includes("nucleo") || normalized.includes("núcleo")) {
      setFieldValue("spellTransformTarget", "usuário");
      setFieldValue("spellTransformStats", "transformação/sobrecarga detectada.");
    }

    if (normalized.includes("invoco") || normalized.includes("invoca") || normalized.includes("sapo") || normalized.includes("criatura")) {
      setFieldValue("spellSummon", "invocação detectada no texto.");
      setFieldValue("spellSummonBehavior", "comportamento descrito na magia colada.");
    }

    if (normalized.includes("copia") || normalized.includes("copiar") || normalized.includes("rouba") || normalized.includes("absorve magia")) {
      setFieldValue("spellCopyLimit", "limite de cópia detectado no texto colado.");
      setFieldValue("spellCopyTypes", "tipos copiáveis/proibidos detectados no texto colado.");
      setFieldValue("spellCopyStorage", "armazenamento/uso detectado no texto colado.");
    }

    if (!isEnchant && (normalized.includes("carga") || normalized.includes("cargas") || normalized.includes("marca") || normalized.includes("marcas"))) {
      setFieldValue("spellCharges", "cargas/marcas detectadas no texto colado.");
    }

    if (normalized.includes("sofre") || normalized.includes("penalidade") || normalized.includes("pos uso") || normalized.includes("pós uso")) {
      setFieldValue("spellDrawback", "penalidade/custo pós-uso detectado.");
    }

    setFieldValue("spellDescription", text);

    syncDynamicFields();
    updateRulesPreview();
    saveDebounced();

    if (!silent) {
      renderOutput({
        status: "good",
        text:
          "Magia auto preenchida com base no texto colado.\n\n" +
          `Categoria detectada: ${RULES[category.type]?.label || category.type} ${getRule(category.type, category.grade)?.gradeLabel || category.grade}\n` +
          `Tipos detectados: ${kinds.map((kind) => KIND_LABELS[kind] || kind).join(" + ")}\n\n` +
          "Agora clique em Analisar magia para ver PM sugerido, problemas e ajustes práticos.",
      });
    }
  }

  function setSaveState(text) {
    const el = $("spellSaveState");
    if (el) el.textContent = text;
  }

  function collectState() {
    const fields = {};

    for (const id of FIELD_IDS) {
      const el = $(id);
      if (el) fields[id] = el.value || "";
    }

    fields.multiKinds = Array.from(document.querySelectorAll("[data-spell-kind-select]")).map((select) => select.value || "");

    return {
      fields,
      lastResult,
      active: document.querySelector(".tab.is-active")?.dataset.tab === "spellCreator",
    };
  }

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
      setSaveState("bot salvo");
    } catch (err) {
      console.error(err);
      setSaveState("erro ao salvar bot");
    }
  }

  function saveDebounced() {
    setSaveState("salvando bot");
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, SAVE_DELAY);
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (err) {
      console.error(err);
      return {};
    }
  }

  function syncGradeOptions(shouldSave = true) {
    const type = $("spellType")?.value || "";
    const grade = $("spellGrade");
    const wrap = $("spellGradeWrap");

    if (!grade || !wrap) return;

    const currentValue = grade.value;
    const options = getAvailableGrades(type);

    grade.innerHTML = "";

    if (!type || !options.length) {
      wrap.hidden = true;
      updateRulesPreview();
      if (shouldSave) saveDebounced();
      return;
    }

    wrap.hidden = false;

    for (const item of options) {
      grade.appendChild(new Option(item.label, item.value));
    }

    grade.value = options.some((item) => item.value === currentValue) ? currentValue : options[0].value;

    updateRulesPreview();
    if (shouldSave) saveDebounced();
  }

  function createKindSelect(value = "") {
    const select = document.createElement("select");
    select.className = "spellKindSelect";
    select.dataset.spellKindSelect = "true";

    select.appendChild(new Option("Escolha...", ""));

    for (const [kind, label] of Object.entries(KIND_LABELS)) {
      select.appendChild(new Option(label, kind));
    }

    select.value = value || "";

    select.addEventListener("change", () => {
      syncDynamicFields();
      updateRulesPreview();
      saveDebounced();
    });

    return select;
  }

  function syncKindSelectors(restoredValues = null) {
    const spellKind = $("spellKind")?.value || "";
    const countWrap = $("spellKindCountWrap");
    const multiWrap = $("spellMultiKindWrap");
    const grid = $("spellMultiKindGrid");
    const countInput = $("spellKindCount");

    if (!countWrap || !multiWrap || !grid || !countInput) return;

    const isMulti = spellKind === "multi";

    countWrap.hidden = !isMulti;
    multiWrap.hidden = !isMulti;

    if (!isMulti) {
      grid.innerHTML = "";
      syncDynamicFields();
      updateRulesPreview();
      return;
    }

    const previousValues = restoredValues || Array.from(grid.querySelectorAll("select")).map((select) => select.value || "");
    const count = clamp(toInt(countInput.value, 2), 1, 6);
    countInput.value = String(count);

    grid.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const row = document.createElement("div");
      row.className = "stat spellMiniStat";

      const label = document.createElement("label");
      label.textContent = `Tipo ${i + 1}`;

      row.append(label, createKindSelect(previousValues[i] || ""));
      grid.appendChild(row);
    }

    syncDynamicFields();
    updateRulesPreview();
  }

  function syncDynamicFields() {
    const activeGroups = getActiveGroups();

    document.querySelectorAll("[data-spell-field-group]").forEach((group) => {
      group.hidden = !activeGroups.has(group.dataset.spellFieldGroup);
    });
  }

  function updateRulesPreview() {
    const preview = $("spellRulesPreview");
    const chip = $("spellCurrentRuleChip");

    if (!preview) return;

    preview.innerHTML = "";

    const rule = getRule();

    if (!rule) {
      if (chip) chip.textContent = "sem tipo";
      appendRuleCard("Escolha a categoria", "Depois escolha o grau e o tipo da magia.");
      return;
    }

    const data = getFormData();
    const kinds = data.kinds;
    const groups = getActiveGroups(kinds);

    if (chip) chip.textContent = `${rule.typeLabel} ${rule.gradeLabel}`;

    appendRuleCard(`${rule.typeLabel} — ${rule.gradeLabel}`, `PM: ${rule.pm[0]} a ${rule.pm[1]}`);

    if (!kinds.length) {
      appendRuleCard(
        "Tipos disponíveis",
        "Dano, Área/Zona, Cura, Buff, Debuff, Controle, Encantamento, Transformação, Invocação, Cópia/Roubo, Proteção, Movimento, Ilusão, Informação, Necromancia e Reação."
      );
      return;
    }

    appendRuleCard("Referência para os tipos escolhidos", getReferenceLines(data, rule).join("\n"));

    if (groups.has("copy")) {
      appendRuleCard(
        "Checklist de Cópia/Roubo",
        "Precisa ter: teste/CD, limite de grau copiado, tipos copiáveis, tipos proibidos, armazenamento, uso e enfraquecimento de magias superiores."
      );
    }

    if (groups.has("summon")) {
      appendRuleCard(
        "Checklist de Invocação",
        "Precisa ter: tamanho, duração, comportamento, alvo, se age sozinho, alcance e como pode ser impedido."
      );
    }

    if (groups.has("resource")) {
      appendRuleCard(
        "Checklist de Cargas/Marcas",
        "Defina máximo, como ganha, como gasta, custo extra e penalidade."
      );
    }

    appendRuleCard("Campos ativos", kinds.map((kind) => `• ${KIND_LABELS[kind] || kind}`).join("\n"));

    function appendRuleCard(title, body) {
      const card = document.createElement("div");
      card.className = "spellRuleCard";

      const strong = document.createElement("b");
      strong.textContent = title;

      const text = document.createElement("span");
      text.style.whiteSpace = "pre-wrap";
      text.textContent = body || "—";

      card.append(strong, text);
      preview.appendChild(card);
    }
  }

  function syncMagicGlyph() {
    const source = $("glyphTopTrackBack") || $("glyphTopTrack");
    const target = $("glyphTopTrackMagic");

    if (source && target && !target.textContent) {
      target.textContent = source.textContent;
    }
  }

  function activateSpellCreatorTab() {
    document.querySelectorAll(".tab").forEach((button) => {
      const active = button.dataset.tab === "spellCreator";
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".panel").forEach((panel) => {
      const active = panel.dataset.panel === "spellCreator";
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    syncMagicGlyph();
    saveDebounced();
  }

  function formatSpellSheet() {
    const data = getFormData();
    const rule = getRule(data.type, data.grade);

    const lines = [
      `Nome: ${data.name || "—"}`,
      `Categoria: ${rule ? `${rule.typeLabel} ${rule.gradeLabel}` : "—"}`,
      `Tipo da magia: ${data.kindLabels.length ? data.kindLabels.join(" + ") : "—"}`,
      `Custo: ${data.cost == null ? "—" : `${data.cost} PM`}`,
      lastResult?.suggestedPm ? `PM sugerido pelo bot: ${lastResult.suggestedPm} PM` : "PM sugerido pelo bot: analisar primeiro",
    ];

    if (data.rangeMeters != null || data.rangeMode === "pessoal") {
      lines.push(`${capitalize(data.rangeMode)}: ${data.rangeMode === "pessoal" ? "pessoal" : `${data.rangeMeters}m`}`);
    }

    if (data.areaShape) lines.push(`Formato/Alvo: ${data.areaShape}`);
    if (data.duration || data.rounds != null) lines.push(`Duração: ${data.duration || `${data.rounds} rodadas`}`);
    if (data.damage) lines.push(`Dano: ${data.damage}`);
    if (data.extraDamage) lines.push(`Dano extra: ${data.extraDamage}`);
    if (data.heal) lines.push(`Cura: ${data.heal}`);
    if (data.save) lines.push(`Teste/CD: ${data.save}`);
    if (data.saveEffect) lines.push(`Resultado do teste: ${data.saveEffect}`);
    if (data.buffText || data.buffs != null) lines.push(`Buff: ${data.buffs ?? "—"} | ${data.buffText || "—"}`);
    if (data.debuffText || data.debuffs != null) lines.push(`Debuff: ${data.debuffs ?? "—"} | ${data.debuffText || "—"}`);
    if (data.enchantTarget) lines.push(`Alvo encantado: ${data.enchantTarget}`);
    if (data.enchantEffect) lines.push(`Efeito do encantamento: ${data.enchantEffect}`);
    if (data.transformTarget) lines.push(`Transformação: ${data.transformTarget}`);
    if (data.transformStats) lines.push(`Mudanças: ${data.transformStats}`);
    if (data.summon) lines.push(`Invocação: ${data.summon}`);
    if (data.summonBehavior) lines.push(`Comportamento: ${data.summonBehavior}`);
    if (data.copyLimit) lines.push(`Limite de cópia: ${data.copyLimit}`);
    if (data.copyTypes) lines.push(`Tipos copiáveis: ${data.copyTypes}`);
    if (data.copyStorage) lines.push(`Armazenamento: ${data.copyStorage}`);
    if (data.charges) lines.push(`Cargas/Marcas: ${data.charges}`);
    if (data.drawback) lines.push(`Penalidade/Custo extra: ${data.drawback}`);
    if (data.effectLimits) lines.push(`Limites: ${data.effectLimits}`);
    if (data.channelRounds != null) lines.push(`Canalização: ${data.channelRounds} rodada(s)`);

    lines.push("Descrição:");
    lines.push(data.description || data.pasteText || "—");

    return lines.join("\n");
  }

  async function copySpellSheet() {
    const text = formatSpellSheet();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temp = document.createElement("textarea");
        temp.value = text;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }

      renderOutput({
        status: lastResult?.status || "good",
        text: `${lastResult?.text || "Ficha montada."}\n\nFicha copiada para a área de transferência.`,
        suggestedPm: lastResult?.suggestedPm || null,
      });
    } catch (err) {
      console.error(err);
      renderOutput({
        status: "warn",
        text: "Não consegui copiar automaticamente. Copie manualmente:\n\n" + text,
      });
    }
  }

  function sendSpellToNotes() {
    const data = getFormData();

    const targetIdByType = {
      simples: "note_magic_simple",
      complexa: "note_magic_complex",
      avancada: "note_magic_advanced",
    };

    const target = $(targetIdByType[data.type]);

    if (!target) {
      renderOutput({
        status: "warn",
        text: "Escolha a categoria da magia antes de adicionar às notas.",
      });
      return;
    }

    const block = formatSpellSheet();
    const current = target.value.trim();

    target.value = current ? `${current}\n\n---\n${block}` : block;
    target.dispatchEvent(new Event("input", { bubbles: true }));

    renderOutput({
      status: lastResult?.status || "good",
      text: `${lastResult?.text || "Magia adicionada."}\n\nMagia adicionada nas notas.`,
      suggestedPm: lastResult?.suggestedPm || null,
    });
  }

  function clearSpellForm() {
    for (const id of FIELD_IDS) {
      const el = $(id);
      if (!el) continue;

      if (id === "spellRangeMode") el.value = "alcance";
      else if (id === "spellKindCount") el.value = "2";
      else el.value = "";
    }

    syncGradeOptions(false);
    syncKindSelectors();
    syncDynamicFields();
    updateRulesPreview();

    renderOutput({
      status: "warn",
      text: "Formulário limpo. Escolha a categoria, tipo e cole a descrição da magia.",
    });

    saveDebounced();
  }

  function applyState(state) {
    const fields = state.fields || {};

    for (const id of FIELD_IDS) {
      const el = $(id);
      if (!el) continue;

      if (fields[id] != null) el.value = fields[id];
      else if (id === "spellRangeMode") el.value = "alcance";
      else if (id === "spellKindCount") el.value = "2";
    }

    syncGradeOptions(false);
    syncKindSelectors(fields.multiKinds || []);
    syncDynamicFields();
    updateRulesPreview();

    if (state.lastResult?.text) renderOutput(state.lastResult);
    if (state.active) window.setTimeout(activateSpellCreatorTab, 0);
  }

  function bindEvents() {
    document.addEventListener(
      "click",
      (event) => {
        const tab = event.target.closest?.('.tab[data-tab="spellCreator"]');
        if (!tab) return;

        event.preventDefault();
        event.stopPropagation();
        activateSpellCreatorTab();
      },
      true
    );

    document.addEventListener("click", (event) => {
      const tab = event.target.closest?.(".tab");
      if (!tab || tab.dataset.tab === "spellCreator") return;
      saveDebounced();
    });

    $("spellType")?.addEventListener("change", () => {
      syncGradeOptions(true);
      updateRulesPreview();
    });

    $("spellGrade")?.addEventListener("change", () => {
      updateRulesPreview();
      saveDebounced();
    });

    $("spellKind")?.addEventListener("change", () => {
      syncKindSelectors();
      syncDynamicFields();
      updateRulesPreview();
      saveDebounced();
    });

    $("spellKindCount")?.addEventListener("input", () => {
      syncKindSelectors();
      syncDynamicFields();
      updateRulesPreview();
      saveDebounced();
    });

    $("btnParsePastedSpell")?.addEventListener("click", () => {
      parsePastedSpellIntoForm(false);
    });

    $("spellPasteText")?.addEventListener("paste", () => {
      window.setTimeout(() => {
        parsePastedSpellIntoForm(true);
      }, 0);
    });

    $("spellPasteText")?.addEventListener("input", () => {
      saveDebounced();
    });

    for (const id of FIELD_IDS) {
      if (["spellType", "spellGrade", "spellKind", "spellKindCount", "spellPasteText"].includes(id)) continue;

      const el = $(id);
      if (!el) continue;

      el.addEventListener("input", () => {
        updateRulesPreview();
        saveDebounced();
      });

      el.addEventListener("change", () => {
        updateRulesPreview();
        saveDebounced();
      });
    }

    $("spellCreatorForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      renderOutput(analyzeSpell());
    });

    $("btnClearSpell")?.addEventListener("click", clearSpellForm);
    $("btnCopySpell")?.addEventListener("click", copySpellSheet);
    $("btnSendSpellToNotes")?.addEventListener("click", sendSpellToNotes);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveNow();
    });
  }

  function init() {
    if (!$("panelSpellCreator")) return;

    bindEvents();
    applyState(loadState());
    syncMagicGlyph();
    updateRulesPreview();
    setSaveState("bot pronto");
  }

  window.addEventListener("DOMContentLoaded", init, { once: true });
})();