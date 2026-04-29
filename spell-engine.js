(function () {
    "use strict";
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
  
    function getRule(type, grade) {
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
  
    function getActiveGroups(kinds = []) {
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
      const hasAnyRegex = (...regexes) => regexes.some((regex) => regex.test(raw));

      const hasTeleport =
        has("teleporte", "teletransporta", "teletransportar", "teletransporte", "teleportar") ||
        has("entre as sombras", "pelas sombras", "atraves das sombras", "através das sombras");

      const hasRealIllusion =
        has(
          "ilusao",
          "ilusão",
          "miragem",
          "imagem falsa",
          "imagem ilusoria",
          "imagem ilusória",
          "clone ilusorio",
          "clone ilusório",
          "duplicata",
          "enganar a visao",
          "enganar a visão",
          "alucinacao",
          "alucinação",
          "disfarce visual",
          "ficar invisivel",
          "ficar invisível",
          "invisibilidade"
        );

      const hasShadowOnly =
        has("sombra", "sombrio", "sombria", "sombril", "sombras") && !hasRealIllusion;

      const weaponEnchant =
        has("encantamento de arma", "arma cortante", "espada", "lamina", "lâmina") &&
        has("encantamento", "encanta", "aura", "canaliza", "ataques com a espada", "ataque com a espada");

      if (weaponEnchant) {
        return ["encantamento"];
      }

      if (
        has("dano", "sangramento", "eletrico", "elétrico", "igneo", "ígneo", "necrotico", "necrótico") ||
        hasAnyRegex(/\b\d+\s*d\s*\d+\b/i)
      ) {
        kinds.add("dano");
      }

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

      if (
        hasTeleport ||
        has(
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

      // Sombra sozinha não é ilusão. Só marca ilusão quando há efeito visual/falso claro.
      if (hasRealIllusion) {
        kinds.add("ilusao");
      }

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

      if (
        has(
          "cria",
          "criar",
          "conjura",
          "conjurar",
          "obelisco",
          "totem",
          "estrutura",
          "pilar",
          "objeto mágico",
          "objeto magico"
        )
      ) {
        kinds.add("conjuracao");
      }

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

      if (
        has("status", "for", "des", "res", "int", "sab", "car", "acerto", "ca") &&
        has("rouba", "roubar", "pego", "pegar", "reduz", "fica com")
      ) {
        kinds.add("buff");
        kinds.add("debuff");
      }

      if (has("teste", "cd", "reflexo", "reflexos", "res", "des")) {
        if (has("paralisa", "paralisado", "atordoado", "rouba", "reduz", "inimigo")) {
          kinds.add("controle");
        }
      }

      // Limpeza final para evitar tipos falsos positivos.
      if (hasShadowOnly && hasTeleport && !hasRealIllusion) {
        kinds.delete("ilusao");
      }

      // Teleporte com inimigo/teste é movimento + controle/efeito, não ilusão.
      if (hasTeleport && has("inimigo", "aliado", "teste", "des", "reflexo", "reflexos")) {
        kinds.add("movimento");
        kinds.add("efeito");
        if (has("inimigo", "teste", "des", "reflexo", "reflexos")) kinds.add("controle");
        if (!hasRealIllusion) kinds.delete("ilusao");
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

      if (
        has("teleporte", "teletransporta", "teletransportar", "teletransporte", "teleportar", "entre as sombras", "pelas sombras") &&
        has("aliado", "inimigo", "teste", "des", "reflexo", "reflexos")
      ) {
        findings.push({
          minType: "complexa",
          weight: 0.46,
          text: "Teleporte de aliado/inimigo é forte. Inimigo precisa de teste e limite de distância/alvos.",
        });
      }

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

      if (has("imune", "imunidade")) {
        findings.push({
          minType: "complexa",
          weight: 0.42,
          text: "Imunidade precisa de tipo protegido, custo, alvo, duração e limite de uso.",
        });
      }

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
            lower.includes("descrição") ||
            lower.includes("efeitos da transformacao") ||
            lower.includes("efeitos da transformação") ||
            lower === "efeito" ||
            lower === "efeitos"
          ) {
            continue;
          }
      
          return line
            .replace(/^magia\s*[:\-]\s*/i, "")
            .replace(/\*\*/g, "")
            .replace(/[{}[\]]/g, " ")
            .replace(/,$/, "")
            .trim();
        }
      
        return "";
      }
    
      function extractCostFromText(text) {
        const raw = String(text || "");
    
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
        const raw = String(text || "");
      
        const bracket =
          extractRegex(raw, /\{?\s*dura[cç][aã]o\s*[:\-]?\s*([^{}\[\]\n,]+)/i) ||
          extractRegex(raw, /\[\s*dura[cç][aã]o\s*[:\-]?\s*([^\]\n,]+)/i);
      
        if (bracket) {
          return bracket
            .replace(/\s*custo\s*:.*/i, "")
            .replace(/\s*alcance\s*:.*/i, "")
            .trim();
        }
      
        const line = extractRegex(raw, /dura[cç][aã]o\s*[:\-]?\s*([^\n|,\]}]+)/i);
      
        if (line) {
          return line
            .replace(/\s*custo\s*:.*/i, "")
            .replace(/\s*alcance\s*:.*/i, "")
            .trim();
        }
      
        const rounds = extractRoundsFromText(raw);
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
    
      function chooseCategoryAndGradeFromPaste(text, cost, kinds) {
        const source = normalizeText(text);

        if (source.includes("avancada") || source.includes("avançada")) {
          return { type: "avancada", grade: cost != null && cost > 70 ? "up1" : "base" };
        }

        if (source.includes("complexa")) {
          if (cost != null && cost > 25) return { type: "complexa", grade: "up2" };
          if (cost != null && cost > 20) return { type: "complexa", grade: "up1" };
          return { type: "complexa", grade: "base" };
        }

        if (source.includes("simples up 3") || source.includes("simples up3")) return { type: "simples", grade: "up3" };
        if (source.includes("simples up 2") || source.includes("simples up2")) return { type: "simples", grade: "up2" };
        if (source.includes("simples up 1") || source.includes("simples up1")) return { type: "simples", grade: "up1" };
        if (source.includes("simples base")) return { type: "simples", grade: "base" };

        const complexKinds = [
          "area",
          "controle",
          "encantamento",
          "transformacao",
          "invocacao",
          "copia",
          "necromancia",
          "reacao",
          "movimento",
          "conjuracao",
        ];

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
          source.includes("pego 1/4");

        const hasAutoBuffCombo =
          source.includes("ativa automaticamente") ||
          source.includes("automaticamente tiros divinos") ||
          ((source.includes("ganha") || source.includes("recebe")) && source.includes("acerto") && source.includes("dano"));

        const hasSummonStructure =
          source.includes("obelisco") ||
          source.includes("belisco") ||
          source.includes("totem") ||
          source.includes("construto") ||
          ((source.includes("invoca") || source.includes("invoco") || source.includes("invocar")) &&
            (source.includes("vida") || source.includes("ca") || source.includes("move") || source.includes("flutuando")));

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

        const hasOffensiveArmor =
          (source.includes("armadura") ||
            source.includes("armadura de sangue") ||
            source.includes("armadura de raios") ||
            source.includes("armadura de trovao") ||
            source.includes("armadura de trovão")) &&
          (source.includes("acerto") || source.includes("dano") || source.includes("reflexo") || source.includes("paralisado"));

        const hasAllyEnemyTeleport =
          (source.includes("teleporte") ||
            source.includes("teletransporta") ||
            source.includes("teletransportar") ||
            source.includes("teletransporte")) &&
          (source.includes("aliado") || source.includes("inimigo") || source.includes("teste"));

        let preferredType = "";

        if (
          cost >= 35 ||
          source.includes("morte instantanea") ||
          source.includes("morte instantânea") ||
          source.includes("apagar existencia") ||
          source.includes("apagar existência") ||
          source.includes("parar o tempo") ||
          source.includes("voltar no tempo")
        ) {
          preferredType = "avancada";
        } else if (
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
        ) {
          preferredType = "complexa";
        }

        if (cost != null) {
          if (preferredType === "avancada") {
            return { type: "avancada", grade: cost > 70 ? "up1" : "base" };
          }

          if (preferredType === "complexa") {
            if (cost > 25) return { type: "complexa", grade: "up2" };
            if (cost > 20) return { type: "complexa", grade: "up1" };
            return { type: "complexa", grade: "base" };
          }

          if (cost > 15) return { type: "simples", grade: "up3" };
          if (cost > 10) return { type: "simples", grade: "up3" };
          if (cost > 6) return { type: "simples", grade: "up2" };
          if (cost > 3) return { type: "simples", grade: "up1" };
        }

        if (preferredType === "avancada") return { type: "avancada", grade: "base" };
        if (preferredType === "complexa") return { type: "complexa", grade: "base" };

        return { type: "simples", grade: "base" };
      }
    
      function buildBalancedSpellText(data, rule, suggestedPm = null) {
        const raw = String(data.description || data.pasteText || "").trim();
        const normalized = normalizeText(raw);
      
        const originalCost = data.cost;
        const finalCost = suggestedPm ?? data.cost;
        const costWasRaised = originalCost != null && suggestedPm != null && suggestedPm > originalCost;
      
        function cleanValue(value) {
          return String(value || "")
            .replace(/[{}[\]]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
      
        function cleanNameFromRaw(text) {
          const first = String(text || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)[0] || "";
      
          const beforeParen = first.split("(")[0]?.trim();
          const beforeBrace = beforeParen.split("{")[0]?.trim();
          const beforeCost = beforeBrace.split("[")[0]?.trim();
      
          if (beforeCost && !normalizeText(beforeCost).includes("efeitos da transformacao")) {
            return beforeCost;
          }
      
          return data.name && !normalizeText(data.name).includes("efeitos da transformacao")
            ? data.name
            : "Magia sem nome";
        }
      
        function extractOriginalEffects(text) {
          const afterTitle = String(text || "").split(/efeitos da transforma[cç][aã]o\s*:/i)[1];
          const source = afterTitle || text;
      
          return source
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.replace(/^#+\s*/, "").replace(/^[-•]\s*/, "").trim())
            .filter(Boolean)
            .filter((line) => {
              const n = normalizeText(line);
              return !n.includes("efeitos da transformacao") &&
                !n.startsWith("alcance") &&
                !n.startsWith("duracao") &&
                !n.startsWith("duração") &&
                !n.startsWith("custo");
            });
        }
      
        function hasEffectLike(effects, ...terms) {
          return effects.some((effect) => {
            const n = normalizeText(effect);
            return terms.some((term) => n.includes(normalizeText(term)));
          });
        }
      
        const name = cleanNameFromRaw(raw);
        const originalEffects = extractOriginalEffects(raw);
      
        const isTransformation = data.kinds.includes("transformacao") || normalized.includes("transformacao") || normalized.includes("transformação");
        const isAdvanced = data.type === "avancada" || rule?.type === "avancada";
      
        const finalEffects = [];
        const limits = [];
      
        const rangeText =
          data.rangeMode === "pessoal" || normalized.includes("alcance poessoal") || normalized.includes("alcance pessoal")
            ? "pessoal"
            : data.rangeMeters != null
              ? `${data.rangeMeters}m`
              : "";
      
        let durationText = cleanValue(data.duration || (data.rounds != null ? `${data.rounds} rodadas` : ""));
        durationText = durationText
          .replace(/\s*custo\s*:.*/i, "")
          .replace(/\s*\[custo\s*:.*/i, "")
          .replace(/(\d+)rodadas/i, "$1 rodadas")
          .trim();
      
        if (!durationText && normalized.includes("10rodadas")) durationText = "10 rodadas";
      
        // Versão especial para transformação muito carregada, como Transcendência do Vazio.
        if (isTransformation && isAdvanced) {
          if (hasEffectLike(originalEffects, "imune", "medo", "controle mental", "possessao", "possessão", "alma")) {
            finalEffects.push("Você fica imune a medo, controle mental e possessão. Efeitos que afetam a alma ainda podem funcionar se forem de origem divina, lendária ou superior.");
          }
      
          if (hasEffectLike(originalEffects, "+4 de dano", "escuridao", "escuridão", "necromancia")) {
            finalEffects.push("Suas magias de escuridão ou necromancia causam +4 de dano.");
          }
      
          if (hasEffectLike(originalEffects, "reducao de dano", "redução de dano", "fonte nao divina", "fonte não divina")) {
            finalEffects.push("Você recebe redução de dano 10 contra fontes não divinas.");
          }
      
          if (hasEffectLike(originalEffects, "recupera 3 pm", "pm por rodada")) {
            finalEffects.push("Uma vez por rodada, você recupera 2 PM. Essa recuperação não pode ultrapassar seu limite máximo de PM.");
            limits.push("A recuperação de PM foi reduzida de 3 para 2 por rodada para não gerar recurso demais durante a transformação.");
          }
      
          if (hasEffectLike(originalEffects, "ataques fisicos", "ataques físicos", "dano espiritual")) {
            finalEffects.push("Seus ataques físicos causam +1d10 de dano espiritual. Adicione o modificador de FOR apenas uma vez por turno.");
            limits.push("O dano físico extra foi limitado para evitar acúmulo forte em múltiplos ataques.");
          }
      
          if (hasEffectLike(originalEffects, "inimigos num raio", "sofrem -2", "-5 em ataques")) {
            finalEffects.push("Inimigos em um raio de 10m sofrem -2 em testes de resistência e -2 em ataques enquanto permanecerem na área.");
            limits.push("O debuff de ataque foi reduzido de -5 para -2. O alvo pode fazer um teste de RES no início do turno para ignorar esse efeito até o próximo turno.");
          }
      
          if (hasEffectLike(originalEffects, "cai inconsciente", "3d4 de dano hpp")) {
            limits.push("Ao término, você cai inconsciente por 1 hora e sofre 3d4 de dano HPP.");
          }
      
          if (normalized.includes("2d4") && normalized.includes("hpp") && normalized.includes("rodada")) {
            limits.push("Enquanto a transformação estiver ativa, você sofre 2d4 de dano HPP por rodada. Esse custo não pode ser reduzido por resistência ou imunidade.");
          }
      
          limits.push("Você não pode receber cura de PM extra de outras fontes enquanto esta transformação estiver ativa.");
          limits.push("Não pode ser usada novamente até terminar um descanso longo ou equivalente definido pelo mestre.");
      
          if (!finalEffects.length) {
            originalEffects.slice(0, 4).forEach((effect) => finalEffects.push(effect));
          }
        } else {
          // Versão genérica para outras magias.
          const maxEffects = data.kinds.length >= 5 ? 4 : 5;
      
          originalEffects.slice(0, maxEffects).forEach((effect) => {
            let adjusted = effect;
      
            if (normalizeText(adjusted).includes("qualquer efeito")) {
              adjusted = adjusted.replace(/qualquer efeito/gi, "efeitos comuns");
              limits.push("Efeitos absolutos foram trocados por efeitos comuns para evitar imunidade total.");
            }
      
            if (normalizeText(adjusted).includes("-5 em ataques")) {
              adjusted = adjusted.replace(/-5 em ataques/gi, "-2 em ataques");
              limits.push("Penalidade de ataque reduzida para -2.");
            }
      
            finalEffects.push(adjusted);
          });
      
          if (originalEffects.length > maxEffects) {
            limits.push(`A magia tinha ${originalEffects.length} efeitos principais. Mantive ${maxEffects} para reduzir excesso de tipos.`);
          }
        }
      
        if (!finalEffects.length) {
          if (data.damage) finalEffects.push(`Causa ${cleanValue(data.damage)}.`);
          if (data.extraDamage) finalEffects.push(`Dano extra: ${cleanValue(data.extraDamage)}.`);
          if (data.heal) finalEffects.push(`Cura ${cleanValue(data.heal)}.`);
          if (!finalEffects.length) finalEffects.push(cleanValue(raw) || "Descreva o efeito principal da magia.");
        }
      
        if (costWasRaised) {
          limits.unshift(`Custo ajustado de ${originalCost} PM para ${finalCost} PM, porque o impacto ficou acima do custo original.`);
        }
      
        const lines = [];
      
        lines.push(name);
        lines.push(`Categoria: ${rule ? `${rule.typeLabel} ${rule.gradeLabel}` : "—"}`);
        lines.push(`Custo: ${finalCost == null ? "—" : `${finalCost} PM`}`);
        if (rangeText) lines.push(`Alcance: ${rangeText}`);
        if (durationText) lines.push(`Duração: ${durationText}`);
      
        lines.push("");
        lines.push("Efeito:");
        finalEffects.forEach((effect) => lines.push(`- ${effect}`));
      
        if (data.save && !normalizeText(data.save).includes("inimigos num raio")) {
          lines.push("");
          lines.push(`Teste/CD: ${cleanValue(data.save)}`);
        }
      
        if (data.saveEffect) {
          lines.push(`Resultado: ${cleanValue(data.saveEffect)}`);
        }
      
        if (limits.length) {
          lines.push("");
          lines.push("Limitações e ajustes:");
          limits.forEach((limit) => lines.push(`- ${limit}`));
        }
      
        return lines.join("\n");
      }

      window.SpellEngine = {
        RULES,
        KIND_LABELS,
        KIND_FIELDS,
        KIND_WEIGHT,
        TIER_ORDER,
        toInt,
        toNumber,
        clamp,
        capitalize,
        normalizeText,
        getRule,
        getAvailableGrades,
        getTypeRank,
        getTierIndex,
        getActiveGroups,
        parseRoundsFromDuration,
        parseDiceTerms,
        parseDiceAverage,
        extractFirstNumber,
        getLimitDamageAvg,
        getLimitHealAvg,
        getAllRawText,
        getAllText,
        textHas,
        inferKindsFromText,
        inferMissingNumbers,
        hasAnyText,
        isWeaponEnchantment,
        hasConditionalEffect,
        isMinorWeaponEnchantment,
        getLimitScore,
        getComplexityFindings,
        getHighestMinType,
        estimatePower,
        calculateSuggestedPm,
        getBestTierThatFits,
        getNextTier,
        getReferenceLines,
        cleanPastedSpellText,
        extractRegex,
        getFirstUsefulLine,
        extractCostFromText,
        extractRoundsFromText,
        extractDurationText,
        extractRangeFromText,
        extractEnchantDamageLine,
        extractDiceLines,
        extractSaveLine,
        extractSaveEffectLine,
        chooseCategoryAndGradeFromPaste,
        buildBalancedSpellText,
      };
    })();