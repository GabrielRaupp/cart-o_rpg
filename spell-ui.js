(function () {
    "use strict";
  
    const $ = (id) => document.getElementById(id);
  
    const Engine = window.SpellEngine;
  
    if (!Engine) {
      console.error("SpellEngine não foi carregado. Carregue spell-engine.js antes de spell-ui.js.");
      return;
    }
  
    const {
      RULES,
      KIND_LABELS,
      toInt,
      toNumber,
      clamp,
      capitalize,
      normalizeText,
      getAvailableGrades,
      parseRoundsFromDuration,
      parseDiceAverage,
      getLimitDamageAvg,
      getLimitHealAvg,
      getAllText,
      hasAnyText,
      inferKindsFromText,
      inferMissingNumbers,
      isWeaponEnchantment,
      isMinorWeaponEnchantment,
      estimatePower,
      calculateSuggestedPm,
      getBestTierThatFits,
      getNextTier,
      getReferenceLines,
      cleanPastedSpellText,
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
    } = Engine;
  
    const STORAGE_KEY = "rpg_card_spell_creator_v7_balanced";
    const SAVE_DELAY = 180;
  
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
  
    function getRule(type = $("spellType")?.value, grade = $("spellGrade")?.value) {
      return Engine.getRule(type, grade);
    }
  
    function getActiveGroups(kinds = getSelectedKinds()) {
      return Engine.getActiveGroups(kinds);
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
  
    function analyzeSpell() {
      const data = getFormData();
      const rule = getRule(data.type, data.grade);
  
      if (!rule) {
        return {
          status: "warn",
          text: "Escolha a categoria e o grau da magia.",
        };
      }
  
      if (!data.kinds.length) {
        return {
          status: "warn",
          text: "Escolha o tipo da magia ou cole a descrição completa para o bot tentar identificar.",
        };
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
        if (data.cost < rule.pm[0]) {
          issues.push(`Custo abaixo do mínimo deste grau: ${rule.pm[0]} PM.`);
        }
  
        if (data.cost > rule.pm[1]) {
          warnings.push(`Custo acima da faixa deste grau: ${rule.pm[0]} a ${rule.pm[1]} PM.`);
        }
  
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
        if (!data.copyLimit && !hasAnyText(data, "simples up 3", "superiores", "mais fracas", "status", "1/4", "1 4")) {
          issues.push("Defina o limite de cópia/roubo: até qual grau copia ou quanto status pode roubar.");
        } else {
          good.push("Limite de cópia/roubo detectado.");
        }
  
        if (!data.copyTypes && !hasAnyText(data, "encantamento", "buff", "debuff", "transformação", "transformacao", "emissão", "emissao", "status")) {
          warnings.push("Liste tipos copiáveis/roubáveis e tipos proibidos.");
        } else {
          good.push("Tipos copiáveis/roubáveis detectados.");
        }
  
        if (!data.copyStorage && !hasAnyText(data, "esfera", "guardar", "armazena", "cospe", "sombra")) {
          warnings.push("Defina armazenamento e uso da magia/status copiado.");
        } else {
          good.push("Forma de armazenamento/uso detectada.");
        }
      }
  
      if (groups.has("summon")) {
        if (!data.summon && !hasAnyText(data, "invoco", "invoca", "sapo", "criatura", "obelisco", "belisco", "totem")) {
          warnings.push("Diga exatamente o que é invocado.");
        }
  
        if (!data.summonBehavior && !hasAnyText(data, "vai atras", "vai atrás", "persegue", "alvo", "move-se", "move se", "flutuando")) {
          warnings.push("Defina comportamento, alvo e se a invocação age sozinha.");
        } else {
          good.push("Comportamento da invocação detectado.");
        }
      }
  
      if (groups.has("resource")) {
        if (data.charges || hasAnyText(data, "carga", "cargas", "marca", "marcas", "custa", "por teleporte", "por aliado", "por inimigo")) {
          good.push("Sistema de cargas/marcas/custo extra detectado.");
        }
      }
  
      if (minorWeaponEnchant) {
        good.push("Efeito secundário é condicional/aleatório, então pesa menos que um debuff garantido.");
      }
  
      if (data.drawback || hasAnyText(data, "sofre", "penalidade", "-2", "pós uso", "pos uso", "toma 1d4")) {
        good.push("Penalidade/custo pós-uso detectado, isso ajuda no balanceamento.");
      }
  
      for (const finding of findings) {
        notes.push(finding.text);
  
        if (finding.minType && Engine.getTypeRank(data.type) < Engine.getTypeRank(finding.minType)) {
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
        suggestions.push("Deixe claro que o bônus acontece apenas enquanto a arma estiver empunhada e durante a duração da magia.");
        suggestions.push("Efeito condicional/aleatório pesa menos que debuff garantido.");
      }
  
      if (data.kinds.includes("copia")) {
        suggestions.push("Para cópia/roubo, mantenha: teste, limite de grau/status, tipos copiáveis, armazenamento e duração curta.");
      }
  
      if (data.kinds.includes("area")) {
        suggestions.push("Para área/zona, deixe claro se o dano acontece por rodada, por alvo ou uma vez só.");
      }
  
      if (data.kinds.includes("transformacao")) {
        suggestions.push("Para transformação/sobrecarga, mantenha teto de duração e penalidade pós-uso.");
      }
  
      if (data.kinds.includes("movimento")) {
        suggestions.push("Para teleporte/movimento, defina distância máxima, alvo permitido e teste contra inimigo.");
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

      lines.push("\nComo eu deixaria a magia:");
      lines.push(buildBalancedSpellText(data, rule, suggested));
  
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
        setFieldValue("spellEffectLimits", "Requer empunhar espada/arma cortante. Efeitos secundários dependem da rolagem/condição.");
      } else {
        if (
          normalized.includes("imune") ||
          normalized.includes("imunidade") ||
          normalized.includes("esquiva") ||
          normalized.includes("marca") ||
          normalized.includes("ganha") ||
          normalized.includes("acerto") ||
          normalized.includes("armadura")
        ) {
          setFieldValue("spellBuffs", "1");
          setFieldValue("spellBuffText", "Buff/acerto/dano/armadura detectado no texto colado.");
        }
  
        if (
          normalized.includes("atordoado") ||
          normalized.includes("paralisa") ||
          normalized.includes("paralisado") ||
          normalized.includes("-2") ||
          normalized.includes("rouba") ||
          normalized.includes("roubar") ||
          normalized.includes("absorve") ||
          normalized.includes("status")
        ) {
          setFieldValue("spellDebuffs", "1");
          setFieldValue("spellDebuffText", "Debuff/roubo/controle detectado no texto colado.");
        }
  
        if (
          normalized.includes("arma") ||
          normalized.includes("espada") ||
          normalized.includes("lamina") ||
          normalized.includes("lâmina")
        ) {
          setFieldValue("spellEnchantTarget", "arma / lâmina");
          setFieldValue("spellEnchantEffect", "efeito elemental, dano extra ou efeito no acerto detectado.");
        }
  
        setFieldValue("spellEffectLimits", "Limitações extraídas/descritas no texto colado.");
      }
  
      if (
        normalized.includes("se torna") ||
        normalized.includes("sobrecarga") ||
        normalized.includes("nucleo") ||
        normalized.includes("núcleo") ||
        normalized.includes("armadura")
      ) {
        setFieldValue("spellTransformTarget", "usuário");
        setFieldValue("spellTransformStats", "transformação/armadura/sobrecarga detectada.");
      }
  
      if (
        normalized.includes("invoco") ||
        normalized.includes("invoca") ||
        normalized.includes("invocar") ||
        normalized.includes("sapo") ||
        normalized.includes("criatura") ||
        normalized.includes("obelisco") ||
        normalized.includes("belisco") ||
        normalized.includes("totem")
      ) {
        setFieldValue("spellSummon", "invocação/estrutura detectada no texto.");
        setFieldValue("spellSummonBehavior", "definir vida, CA, duração, movimento, alvo e se age sozinha.");
      }

      const hasCopyOrSteal =
        normalized.includes("copia") ||
        normalized.includes("copiar") ||
        normalized.includes("rouba") ||
        normalized.includes("roubar") ||
        normalized.includes("absorve magia") ||
        normalized.includes("magia roubada") ||
        normalized.includes("roubar a sombra") ||
        normalized.includes("rouba a sombra") ||
        normalized.includes("status mais forte");
  
      if (hasCopyOrSteal) {
        setFieldValue("spellCopyLimit", "limite de cópia/roubo detectado ou necessário.");
        setFieldValue("spellCopyTypes", "tipos copiáveis/roubáveis/proibidos detectados ou necessários.");
        setFieldValue("spellCopyStorage", "armazenamento/uso detectado ou necessário.");
      }
  
      if (
        !isEnchant &&
        (
          normalized.includes("carga") ||
          normalized.includes("cargas") ||
          normalized.includes("marca") ||
          normalized.includes("marcas")
        )
      ) {
        setFieldValue("spellCharges", "cargas/marcas detectadas no texto colado.");
      }
  
      if (
        normalized.includes("por teleporte") ||
        normalized.includes("por aliado") ||
        normalized.includes("por inimigo") ||
        normalized.includes("custo da magia mais metade") ||
        normalized.includes("custando o custo da magia mais metade")
      ) {
        setFieldValue("spellEffectLimits", "Custo variável/escalável detectado. Escreva o custo base e o custo extra por alvo/uso.");
      }
  
      if (
        normalized.includes("sofre") ||
        normalized.includes("penalidade") ||
        normalized.includes("pos uso") ||
        normalized.includes("pós uso") ||
        normalized.includes("toma 1d4")
      ) {
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
  
      fields.multiKinds = Array.from(document.querySelectorAll("[data-spell-kind-select]"))
        .map((select) => select.value || "");
  
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
  
      grade.value = options.some((item) => item.value === currentValue)
        ? currentValue
        : options[0].value;
  
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
    
        const previousValues = restoredValues ||
          Array.from(grid.querySelectorAll("select")).map((select) => select.value || "");
    
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
            "Precisa ter: teste/CD, limite de grau ou status roubado, tipos permitidos/proibidos, armazenamento, uso e duração."
          );
        }
    
        if (groups.has("summon")) {
          appendRuleCard(
            "Checklist de Invocação",
            "Precisa ter: tamanho, vida, CA, duração, comportamento, alvo, se age sozinho, alcance e como pode ser impedido."
          );
        }
    
        if (groups.has("resource")) {
          appendRuleCard(
            "Checklist de Cargas/Marcas/Custo",
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
          lastResult?.suggestedPm
            ? `PM sugerido pelo bot: ${lastResult.suggestedPm} PM`
            : "PM sugerido pelo bot: analisar primeiro",
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
        if (data.copyLimit) lines.push(`Limite de cópia/roubo: ${data.copyLimit}`);
        if (data.copyTypes) lines.push(`Tipos copiáveis/roubáveis: ${data.copyTypes}`);
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