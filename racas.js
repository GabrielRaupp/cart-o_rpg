window.RaceDB = (() => {
    const races = [
      { name: "Meio Vampiros", aliases: ["meio vampiro", "meio vampiros"], hpBase: 22, pmBase: 3 },
      { name: "Rhasenak", aliases: ["rhasenak"], hpBase: 16, pmBase: 2 },
  
      { name: "Espíritos - Triunfo", aliases: ["espirito triunfo", "espírito triunfo", "espiritos triunfo", "espíritos triunfo"], hpBase: 18, pmBase: 3 },
      {
        name: "Espíritos",
        aliases: [
          "espirito", "espírito", "espiritos", "espíritos",
          "espirito protecao", "espírito proteção", "espirito felicidade", "espírito felicidade",
          "espirito sabedoria", "espírito sabedoria", "espirito plenitude", "espírito plenitude",
          "espirito compaixao", "espírito compaixão", "espirito transformacao", "espírito transformação"
        ],
        hpBase: 10,
        pmBase: 6
      },
  
      { name: "Aashumanes", aliases: ["aashumanes"], hpBase: 18, pmBase: 3 },
      { name: "Ganesi", aliases: ["ganesi"], hpBase: 14, pmBase: 6 },
      { name: "Tefiling", aliases: ["tefiling"], hpBase: 14, pmBase: 0, ptBase: 4 },
      { name: "Verdanos", aliases: ["verdanos"], hpBase: 20, pmBase: 5 },
      { name: "Humanos", aliases: ["humano", "humanos"], hpBase: 16, pmBase: 3 },
      { name: "Anão", aliases: ["anao", "anão", "anoes", "anões"], hpBase: 20, pmBase: 2 },
      { name: "Sprites", aliases: ["sprite", "sprites"], hpBase: 14, pmBase: 4 },
      { name: "Meios Demônios", aliases: ["meio demonio", "meio demônio", "meios demonios", "meios demônios"], hpBase: 22, pmBase: 3 },
      { name: "Warforged", aliases: ["warforged"], hpBase: 26, pmBase: 2 },
      { name: "Yureis", aliases: ["yurei", "yureis"], hpBase: 16, pmBase: 4 },
      { name: "Dur'kan", aliases: ["durkan", "dur’kan", "dur'kan"], hpBase: 28, pmBase: 1 },
      { name: "Velith", aliases: ["velith"], hpBase: 16, pmBase: 5 },
      { name: "Prismares", aliases: ["prismares", "prismares"], hpBase: 15, pmBase: 3 },
      { name: "Velkrates", aliases: ["velkrates"], hpBase: 20, pmBase: 3 },
      { name: "Umbrith", aliases: ["umbrith"], hpBase: 14, pmBase: 5 },
      { name: "Lorenn", aliases: ["lorenn"], hpBase: 18, pmBase: 3 },
      { name: "Inkara", aliases: ["inkara"], hpBase: 20, pmBase: 5 },
      { name: "Kanshir", aliases: ["kanshir"], hpBase: 16, pmBase: 4 },
      { name: "Quiméricos", aliases: ["quimerico", "quimérico", "quimericos", "quiméricos"], hpBase: 18, pmBase: 4 },
      { name: "Titãs", aliases: ["tita", "titã", "titas", "titãs"], hpBase: 30, pmBase: 1 },
      { name: "Abissais", aliases: ["abissal", "abissais"], hpBase: 16, pmBase: 4 },
      { name: "Simbiontes", aliases: ["simbionte", "simbiontes"], hpBase: 22, pmBase: 3 },
      { name: "Feralin", aliases: ["feralin"], hpBase: 20, pmBase: 3 },
      { name: "Nerianos", aliases: ["neriano", "nerianos"], hpBase: 19, pmBase: 5 },
      { name: "Rúnaris", aliases: ["runaris", "rúnaris"], hpBase: 16, pmBase: 7 },
      { name: "Meio-Elfos", aliases: ["meio elfo", "meio-elfo", "meio elfos", "meio-elfos"], hpBase: 20, pmBase: 4 },
      { name: "Rubricantos", aliases: ["rubricanto", "rubricantos"], hpBase: 18, pmBase: 4 }
    ];
  
    function normalize(text) {
      return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  
    const byAlias = new Map();
  
    for (const race of races) {
      for (const alias of race.aliases) {
        byAlias.set(normalize(alias), race);
      }
    }
  
    function findRace(input) {
      const key = normalize(input);
      if (!key) return null;
  
      if (byAlias.has(key)) {
        return byAlias.get(key);
      }
  
      if (key.length >= 4) {
        for (const [alias, race] of byAlias.entries()) {
          if (key.includes(alias) || alias.includes(key)) {
            return race;
          }
        }
      }
  
      return null;
    }
  
    return {
      races,
      normalize,
      findRace
    };
  })();