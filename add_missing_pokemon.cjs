const fs = require('fs');
const pokemon = JSON.parse(fs.readFileSync('src/assets/pokemon.json', 'utf8'));

function entry(id, name, gen, types, legendary, mythical, category, hp, atk, def, spa, spd, spe, evolutions) {
  return {
    id, name, generation: gen, types,
    is_legendary: legendary, is_mythical: mythical, is_mega: false,
    attack_category: category,
    stats: { hp, attack: atk, defense: def, special_attack: spa, special_defense: spd, speed: spe },
    evolutions,
    sprites: {
      front:       `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`,
      back:        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${id}.gif`,
      front_shiny: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`,
      back_shiny:  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/shiny/${id}.gif`
    },
    webm_mod: { zoom: 0.7, zoom_position: [0, 0] },
    in_region: { kanto: 0, johto: 0, hoenn: 0, sinnoh: 0, teselia: 0, kalos: 0, galar: 0, paldea: 0 }
  };
}

function evo(to, level) { return { to_name: to, level, trigger: 'level' }; }

const newPokemon = [
  // ── Gen 3 ─────────────────────────────────────────────────────────────────
  entry(386, 'deoxys',       3, ['psychic'],             false, true,  'special',  50, 150,  50, 150,  50, 150, []),
  // ── Gen 4 ─────────────────────────────────────────────────────────────────
  entry(413, 'wormadam',     4, ['bug','grass'],          false, false, 'special',  60,  59,  85,  79, 105,  36, []),
  entry(487, 'giratina',     4, ['ghost','dragon'],       true,  false, 'physical',150, 100, 120, 100, 120,  90, []),
  entry(492, 'shaymin',      4, ['grass'],                false, true,  'special', 100, 100, 100, 100, 100, 100, []),
  // ── Gen 5 ─────────────────────────────────────────────────────────────────
  entry(550, 'basculin',     5, ['water'],                false, false, 'physical', 70,  92,  65,  80,  55,  98, [evo('basculegion', 38)]),
  entry(555, 'darmanitan',   5, ['fire'],                 false, false, 'physical',105, 140,  55,  30,  55,  95, []),
  entry(592, 'frillish',     5, ['water','ghost'],        false, false, 'special',  55,  40,  50,  65,  85,  40, [evo('jellicent', 40)]),
  entry(593, 'jellicent',    5, ['water','ghost'],        false, false, 'special', 100,  60,  70,  85, 105,  60, []),
  entry(641, 'tornadus',     5, ['flying'],               true,  false, 'special',  79, 115,  70, 125,  80, 111, []),
  entry(642, 'thundurus',    5, ['electric','flying'],    true,  false, 'special',  79, 115,  70, 125,  80, 111, []),
  entry(645, 'landorus',     5, ['ground','flying'],      true,  false, 'physical', 89, 125,  90, 115,  80, 101, []),
  entry(647, 'keldeo',       5, ['water','fighting'],     false, true,  'special',  91,  72,  90, 129,  90, 108, []),
  entry(648, 'meloetta',     5, ['normal','psychic'],     false, true,  'special', 100,  77,  77, 128, 128,  90, []),
  // ── Gen 6 ─────────────────────────────────────────────────────────────────
  entry(668, 'pyroar',       6, ['fire','normal'],        false, false, 'special',  86,  68,  72, 109,  66, 106, []),
  entry(678, 'meowstic',     6, ['psychic'],              false, false, 'special',  74,  48,  76,  83,  81, 104, []),
  entry(710, 'pumpkaboo',    6, ['ghost','grass'],        false, false, 'physical', 49,  66,  70,  44,  55,  51, [evo('gourgeist', 36)]),
  entry(711, 'gourgeist',    6, ['ghost','grass'],        false, false, 'physical', 65,  90, 122,  58,  75,  84, []),
  entry(718, 'zygarde',      6, ['dragon','ground'],      true,  false, 'physical',108, 100, 121,  81,  95,  95, []),
  // ── Gen 7 ─────────────────────────────────────────────────────────────────
  entry(741, 'oricorio',     7, ['fire','flying'],        false, false, 'special',  75,  70,  70,  98,  70,  93, []),
  entry(745, 'lycanroc',     7, ['rock'],                 false, false, 'physical', 75, 115,  65,  55,  65, 112, []),
  entry(746, 'wishiwashi',   7, ['water'],                false, false, 'special',  45,  20,  20,  25,  25,  40, []),
  entry(774, 'minior',       7, ['rock','flying'],        false, false, 'physical', 60,  60, 100,  60, 100,  60, []),
  entry(778, 'mimikyu',      7, ['ghost','fairy'],        false, false, 'physical', 55,  90,  80,  50, 105,  96, []),
  // ── Gen 8 ─────────────────────────────────────────────────────────────────
  entry(849, 'toxtricity',   8, ['electric','poison'],    false, false, 'special',  75,  98,  70, 114,  70,  75, []),
  entry(875, 'eiscue',       8, ['ice'],                  false, false, 'physical', 75,  80, 110,  65,  90,  50, []),
  entry(876, 'indeedee',     8, ['psychic','normal'],     false, false, 'special',  60,  65,  55, 105,  95,  95, []),
  entry(877, 'morpeko',      8, ['electric','dark'],      false, false, 'physical', 58,  95,  58,  70,  58,  97, []),
  entry(892, 'urshifu',      8, ['fighting','dark'],      true,  false, 'physical',100, 130, 100,  63,  60,  97, []),
  entry(902, 'basculegion',  8, ['water','ghost'],        false, false, 'physical',120, 112,  65,  80,  75,  78, []),
  entry(905, 'enamorus',     8, ['fairy','flying'],       true,  false, 'special',  74, 115,  70, 135,  80, 106, []),
  // ── Gen 9 ─────────────────────────────────────────────────────────────────
  entry(916, 'oinkologne',   9, ['normal'],               false, false, 'physical',110, 100,  75,  59,  80,  65, []),
  entry(925, 'maushold',     9, ['normal'],               false, false, 'physical', 74,  75,  70,  65,  75, 111, []),
  entry(931, 'squawkabilly', 9, ['normal','flying'],      false, false, 'physical', 82,  96,  51,  45,  51,  92, []),
  entry(964, 'palafin',      9, ['water'],                false, false, 'physical',100,  70,  72,  53,  62, 100, []),
  entry(978, 'tatsugiri',    9, ['dragon','water'],       false, false, 'special',  68,  50,  60, 120,  95,  82, []),
  entry(982, 'dudunsparce',  9, ['normal'],               false, false, 'physical',125, 100,  80,  85,  75,  55, []),
];

const existingIds = new Set(pokemon.map(p => p.id));
let added = 0;
for (const p of newPokemon) {
  if (existingIds.has(p.id)) { console.log(`SKIP (already exists): ${p.id} ${p.name}`); continue; }
  const idx = pokemon.findIndex(x => x.id > p.id);
  if (idx === -1) pokemon.push(p);
  else pokemon.splice(idx, 0, p);
  added++;
  console.log(`OK: ${p.id} ${p.name}`);
}

fs.writeFileSync('src/assets/pokemon.json', JSON.stringify(pokemon, null, 2), 'utf8');
console.log(`\nAdded ${added} Pokemon. Total: ${pokemon.length}`);
