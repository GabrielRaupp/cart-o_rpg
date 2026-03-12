window.CharacterCalc = (() => {
    function toInt(value, fallback = 0) {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? n : fallback;
    }
  
    // Regra padrão estilo d20:
    // 10-11 = 0 | 12-13 = +1 | 14-15 = +2 | 8-9 = -1 ...
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
  
    // Regra central:
    // HP = HP base + (Mod CON * level)
    // PM = PM base + (Mod INT * level)
    // CA = 10 + Mod DES + Mod RES
    //
    // Se quiser mudar a lógica depois, é só mexer nessas 3 funções.
    function calcHpMax({ level, hpBase, mods }) {
      return Math.max(1, hpBase + (mods.con * level));
    }
  
    function calcPm({ level, pmBase, mods }) {
      return Math.max(0, pmBase + (mods.int * level));
    }
  
    function calcCa({ mods }) {
      return Math.max(0, 10 + mods.des + mods.res);
    }
  
    function calculate({ level, stats, race }) {
      const safeLevel = Math.max(1, toInt(level, 1));
      const mods = getModifiers(stats);
      const hpBase = race?.hpBase ?? 10;
      const pmBase = race?.pmBase ?? 0;
      const ptBase = race?.ptBase ?? 0;
  
      return {
        level: safeLevel,
        hpBase,
        pmBase,
        ptBase,
        mods,
        hpMax: calcHpMax({ level: safeLevel, hpBase, mods }),
        pm: calcPm({ level: safeLevel, pmBase, mods }),
        ca: calcCa({ mods }),
        raceName: race?.name ?? ""
      };
    }
  
    return {
      toInt,
      getModifier,
      getModifiers,
      calcHpMax,
      calcPm,
      calcCa,
      calculate
    };
  })();