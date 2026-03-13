window.CharacterCalc = (() => {
  const XP_TO_NEXT = Object.freeze({
    1: 1000,
    2: 1500,
    3: 2000,
    4: 3000,
    5: 4000,
    6: 5000,
    7: 6500,
    8: 8000,
    9: 9500,
    10: 11000,
    11: 12500,
    12: 14000,
    13: 15500,
    14: 17000,
    15: 18500,
    16: 20000,
    17: 22000,
    18: 24000,
    19: 26000,
    20: 28000,
    21: 30000,
    22: 32000,
    23: 34000,
    24: 36000,
    25: 38000,
    26: 40000,
    27: 42000,
    28: 44000,
    29: 46000,
  });

  function toInt(value, fallback = 0) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getModifier(score) {
    return Math.floor((toInt(score, 0) - 10) / 2);
  }

  function getModifiers(stats = {}) {
    return {
      for: getModifier(stats.for),
      des: getModifier(stats.des),
      con: getModifier(stats.con),
      int: getModifier(stats.int),
      sab: getModifier(stats.sab),
      car: getModifier(stats.car),
      adp: getModifier(stats.adp),
      res: getModifier(stats.res),
    };
  }

  function sumNumbers(list = []) {
    return list.reduce((acc, n) => acc + toInt(n, 0), 0);
  }

  function normalizeHistory(history, level, currentMod = 0) {
    const safeLevel = Math.max(1, toInt(level, 1));
    const source = Array.isArray(history) ? history : [];
    const out = [];

    for (let i = 0; i < safeLevel; i++) {
      if (i < source.length) {
        out.push(toInt(source[i], currentMod));
      } else if (i > 0) {
        out.push(out[i - 1]);
      } else {
        out.push(toInt(currentMod, 0));
      }
    }

    out[safeLevel - 1] = toInt(currentMod, 0);
    return out;
  }

  function calcProgressivePool({ base, level, currentMod, modHistory, min = 0 }) {
    const history = normalizeHistory(modHistory, level, currentMod);
    return Math.max(min, toInt(base, 0) + sumNumbers(history));
  }

  function calcHpMax({ level, hpBase, mods, progression }) {
    return Math.max(
      1,
      calcProgressivePool({
        base: hpBase,
        level,
        currentMod: mods.con,
        modHistory: progression?.conModsByLevel,
        min: 1,
      })
    );
  }

  function calcPmMax({ level, pmBase, mods, progression }) {
    return Math.max(
      0,
      calcProgressivePool({
        base: pmBase,
        level,
        currentMod: mods.int,
        modHistory: progression?.intModsByLevel,
        min: 0,
      })
    );
  }

  function calcHppMax({ level, hpBase, mods, progression }) {
    const hppBase = Math.floor(toInt(hpBase, 0) / 2);

    return Math.max(
      0,
      calcProgressivePool({
        base: hppBase,
        level,
        currentMod: mods.res,
        modHistory: progression?.resModsByLevel,
        min: 0,
      })
    );
  }

  function calcCa({ level, mods }) {
    return Math.max(0, 10 + mods.des + mods.res + Math.floor(toInt(level, 1) / 2));
  }

  function getWeaponHitBonus(weapon = {}) {
    if (weapon && weapon.hitBonus != null) {
      return Math.max(0, toInt(weapon.hitBonus, 0));
    }
    return Math.max(0, toInt(weapon?.level, 0));
  }

  function calcMagicHit({ mods }) {
    return mods.int;
  }

  function calcPhysicalHit({ mods, weapon, mode = "for" }) {
    const physicalMod = mode === "des" ? mods.des : mods.for;
    return physicalMod + getWeaponHitBonus(weapon);
  }

  function calcEnchantedHit({ mods, weapon, mode = "for" }) {
    const physicalMod = mode === "des" ? mods.des : mods.for;
    return physicalMod + Math.floor(mods.int / 2) + getWeaponHitBonus(weapon);
  }

  function calculateAttackBonuses({ stats, weapon }) {
    const mods = getModifiers(stats);

    return {
      magic: calcMagicHit({ mods }),
      physicalFor: calcPhysicalHit({ mods, weapon, mode: "for" }),
      physicalDes: calcPhysicalHit({ mods, weapon, mode: "des" }),
      enchantedFor: calcEnchantedHit({ mods, weapon, mode: "for" }),
      enchantedDes: calcEnchantedHit({ mods, weapon, mode: "des" }),
    };
  }

  function getNextLevelXp(level) {
    return XP_TO_NEXT[toInt(level, 1)] ?? null;
  }

  function getMaxMappedLevel() {
    const levels = Object.keys(XP_TO_NEXT).map((n) => toInt(n, 0));
    return levels.length ? Math.max(...levels) + 1 : 1;
  }

  function normalizeLevelAndXp({ level, xp }) {
    let currentLevel = Math.max(1, toInt(level, 1));
    let currentXp = Math.max(0, toInt(xp, 0));
    const maxLevel = getMaxMappedLevel();

    while (true) {
      const need = getNextLevelXp(currentLevel);

      if (need == null || currentLevel >= maxLevel) break;
      if (currentXp < need) break;

      currentXp -= need;
      currentLevel += 1;
    }

    return {
      level: currentLevel,
      xp: currentXp,
      nextXp: getNextLevelXp(currentLevel),
    };
  }

  function getXpProgress({ level, xp }) {
    const normalized = normalizeLevelAndXp({ level, xp });
    const current = normalized.xp;
    const next = normalized.nextXp;

    if (next == null) {
      return {
        level: normalized.level,
        current,
        total: null,
        remaining: null,
        percent: null,
      };
    }

    return {
      level: normalized.level,
      current,
      total: next,
      remaining: Math.max(0, next - current),
      percent: clamp(next > 0 ? (current / next) * 100 : 0, 0, 100),
    };
  }

  function getRuneTier(value) {
    const v = clamp(toInt(value, 0), 0, 100);

    if (v <= 14) return "Instável";
    if (v <= 40) return "Só status";
    if (v <= 60) return "Habilidade nerfada";
    if (v <= 80) return "Boa + passiva";
    if (v <= 99) return "Boss + passivas";
    return "Exclusiva";
  }

  function calculate({ level, stats, race, progression, weapon }) {
    const safeLevel = Math.max(1, toInt(level, 1));
    const mods = getModifiers(stats);
    const hpBase = race?.hpBase ?? 10;
    const pmBase = race?.pmBase ?? 0;

    return {
      level: safeLevel,
      hpBase,
      pmBase,
      mods,
      hpMax: calcHpMax({ level: safeLevel, hpBase, mods, progression }),
      pmMax: calcPmMax({ level: safeLevel, pmBase, mods, progression }),
      hppMax: calcHppMax({ level: safeLevel, hpBase, mods, progression }),
      ca: calcCa({ level: safeLevel, mods }),
      attackBonuses: calculateAttackBonuses({ stats, weapon }),
      raceName: race?.name ?? "",
    };
  }

  return {
    XP_TO_NEXT,
    toInt,
    clamp,
    getModifier,
    getModifiers,
    normalizeHistory,
    calcHpMax,
    calcPmMax,
    calcHppMax,
    calcCa,
    getWeaponHitBonus,
    calcMagicHit,
    calcPhysicalHit,
    calcEnchantedHit,
    calculateAttackBonuses,
    getNextLevelXp,
    getMaxMappedLevel,
    normalizeLevelAndXp,
    getXpProgress,
    getRuneTier,
    calculate,
  };
})();