const fs = require('fs');
const scenes = JSON.parse(fs.readFileSync('src/assets/scenes.json', 'utf8'));

// Only update scenes that still have placeholder pokemon {1,4,7}
function isPlaceholder(pokemons) {
  const ids = pokemons.map(p => p.id).sort((a,b)=>a-b).join(',');
  return ids === '1,4,7';
}

function makePokemon(ids) {
  return ids.map((id, i) => ({
    id,
    item: null,
    is_shiny: false,
    level: i === 0 ? 1 : (i * 2 + 1)
  }));
}

// scene_id → [pokemonIds]
// Kanto gyms 1-8 are already set — not included here
const teams = {
  // ── JOHTO GYMS ──────────────────────────────────────────────────────────
  'johto_gym_1': [163, 17, 176, 164],             // Pegaso (flying): Hoothoot, Pidgeotto, Togetic, Noctowl
  'johto_gym_2': [167, 14, 193, 123],             // Anton (bug): Spinarak, Kakuna, Yanma, Scyther
  'johto_gym_3': [35, 209, 241, 242],             // Blanca (normal): Clefairy, Snubbull, Miltank, Blissey
  'johto_gym_4': [92, 93, 94, 200],               // Morti (ghost): Gastly, Haunter, Gengar, Misdreavus
  'johto_gym_5': [57, 106, 107, 62, 68],          // Anibal (fighting): Primeape, Hitmonlee, Hitmonchan, Poliwrath, Machamp
  'johto_gym_6': [81, 82, 205, 208, 227],         // Yasmina (steel): Magnemite, Magneton, Forretress, Steelix, Skarmory
  'johto_gym_7': [86, 87, 215, 124, 221],         // Fredo (ice): Seel, Dewgong, Sneasel, Jynx, Piloswine
  'johto_gym_8': [148, 148, 130, 230],            // Debora (dragon): Dragonair x2, Gyarados, Kingdra

  // ── JOHTO ALTO MANDO & CAMPEON ───────────────────────────────────────────
  'johto_altomando_1': [178, 178, 124, 80, 103],  // Mento: Xatu x2, Jynx, Slowbro, Exeggutor
  'johto_altomando_2': [168, 49, 89, 205, 169],   // Koga: Ariados, Venomoth, Muk, Forretress, Crobat
  'johto_altomando_3': [95, 106, 107, 68, 62],    // Bruno: Onix, Hitmonlee, Hitmonchan, Machamp, Poliwrath
  'johto_altomando_4': [198, 94, 197, 229, 359],  // Karen: Murkrow, Gengar, Umbreon, Houndoom, Absol
  'johto_campeon':     [18, 65, 112, 130, 59, 103], // Azul: Pidgeot, Alakazam, Rhydon, Gyarados, Arcanine, Exeggutor

  // ── HOENN GYMS ──────────────────────────────────────────────────────────
  'hoenn_gym_1': [74, 299, 95],                   // Petra (rock): Geodude, Nosepass, Onix
  'hoenn_gym_2': [66, 296, 297],                  // Marcial (fighting): Machop, Makuhita, Hariyama
  'hoenn_gym_3': [100, 309, 82, 310],             // Erico (electric): Voltorb, Electrike, Magneton, Manectric
  'hoenn_gym_4': [218, 322, 324, 59],             // Candela (fire): Slugma, Numel, Torkoal, Arcanine
  'hoenn_gym_5': [327, 264, 288, 289],            // Norman (normal): Spinda, Linoone, Vigoroth, Slaking
  'hoenn_gym_6': [277, 279, 227, 333, 334],       // Alana (flying): Swellow, Pelipper, Skarmory, Swablu, Altaria
  'hoenn_gym_7': [325, 337, 338, 308, 326],       // Vito & Leti (psychic): Spoink, Lunatone, Solrock, Medicham, Grumpig
  'hoenn_gym_8': [363, 364, 272, 340, 365, 350],  // Plubio (water): Spheal, Sealeo, Ludicolo, Whiscash, Walrein, Milotic

  // ── HOENN ALTO MANDO & CAMPEON ───────────────────────────────────────────
  'hoenn_altomando_1': [262, 332, 319, 342, 359],       // Sixto: Mightyena, Cacturne, Sharpedo, Crawdaunt, Absol
  'hoenn_altomando_2': [302, 353, 354, 200, 356],       // Fátima: Sableye, Shuppet, Banette, Misdreavus, Dusclops
  'hoenn_altomando_3': [361, 362, 364, 365, 124],       // Nivea: Snorunt, Glalie, Sealeo, Walrein, Jynx
  'hoenn_altomando_4': [329, 330, 334, 372, 373],       // Dracón: Vibrava, Flygon, Altaria, Shelgon, Salamence
  'hoenn_campeon':     [227, 306, 344, 346, 348, 376],  // Máximo: Skarmory, Aggron, Claydol, Cradily, Armaldo, Metagross

  // ── SINNOH GYMS ──────────────────────────────────────────────────────────
  'sinnoh_gym_1': [74, 408, 95],                   // Roco: Geodude, Cranidos, Onix
  'sinnoh_gym_2': [420, 387, 315, 407],            // Gardenia: Cherubi, Turtwig, Roselia, Roserade
  'sinnoh_gym_3': [307, 67, 447, 448],             // Brega: Meditite, Machoke, Riolu, Lucario
  'sinnoh_gym_4': [422, 423, 130, 419],            // Mananti: Shellos, Gastrodon, Gyarados, Floatzel
  'sinnoh_gym_5': [355, 93, 429, 94],              // Fantina: Duskull, Haunter, Mismagius, Gengar
  'sinnoh_gym_6': [436, 208, 411, 462],            // Aceron: Bronzor, Steelix, Bastiodon, Magnezone
  'sinnoh_gym_7': [459, 215, 461, 478, 460],       // Inverna: Snover, Sneasel, Weavile, Froslass, Abomasnow
  'sinnoh_gym_8': [135, 26, 417, 466, 405],        // Lectro: Jolteon, Raichu, Pachirisu, Electivire, Luxray

  // ── SINNOH ALTO MANDO & CAMPEON ──────────────────────────────────────────
  'sinnoh_altomando_1': [267, 416, 214, 469, 212, 452], // Alecrán: Beautifly, Vespiquen, Heracross, Yanmega, Scizor, Drapion
  'sinnoh_altomando_2': [195, 472, 76, 450, 464],       // Gaia: Quagsire, Gliscor, Golem, Hippowdon, Rhyperior
  'sinnoh_altomando_3': [78, 59, 467, 392, 229],        // Fausto: Rapidash, Arcanine, Magmortar, Infernape, Houndoom
  'sinnoh_altomando_4': [196, 122, 203, 65, 437, 475],  // Delos: Espeon, Mr.Mime, Girafarig, Alakazam, Bronzong, Gallade
  'sinnoh_campeon':     [442, 407, 350, 448, 468, 445], // Cintia: Spiritomb, Roserade, Milotic, Lucario, Togekiss, Garchomp

  // ── TESELIA GYMS ─────────────────────────────────────────────────────────
  'teselia_gym_1': [511, 513, 515, 512, 514, 516],       // Millo/Zeo/Maiz: los 3 monos + evoluciones
  'teselia_gym_2': [507, 531, 573, 508],                 // Aloe: Herdier, Audino, Cinccino, Stoutland
  'teselia_gym_3': [540, 542, 557, 558, 544],            // Camus: Sewaddle, Leavanny, Dwebble, Crustle, Whirlipede
  'teselia_gym_4': [522, 587, 595, 523, 596],            // Camila: Blitzle, Emolga, Joltik, Zebstrika, Galvantula
  'teselia_gym_5': [551, 552, 536, 537, 530],            // Yakon: Sandile, Krokorok, Palpitoad, Seismitoad, Excadrill
  'teselia_gym_6': [528, 520, 521, 561, 581, 628],       // Gerania: Swoobat, Tranquill, Unfezant, Sigilyph, Swanna, Braviary
  'teselia_gym_7': [582, 583, 614, 615, 584],            // Junco: Vanillite, Vanillish, Beartic, Cryogonal, Vanilluxe
  'teselia_gym_8': [610, 611, 621, 612, 633, 634],       // Lirio: Axew, Fraxure, Druddigon, Haxorus, Deino, Zweilous

  // ── TESELIA ALTO MANDO & CAMPEON ─────────────────────────────────────────
  'teselia_altomando_1': [426, 563, 593, 623, 609],       // Anís: Drifblim, Cofagrigus, Jellicent, Golurk, Chandelure
  'teselia_altomando_2': [510, 560, 553, 359, 625],       // Aza: Liepard, Scrafty, Krookodile, Absol, Bisharp
  'teselia_altomando_3': [538, 539, 534, 620, 448],       // Lotto: Throh, Sawk, Conkeldurr, Mienshao, Lucario
  'teselia_altomando_4': [518, 561, 579, 576, 65],        // Catleya: Musharna, Sigilyph, Reuniclus, Gothitelle, Alakazam
  'teselia_campeon':     [617, 589, 637, 632, 557, 542],  // Mirto: Accelgor, Escavalier, Volcarona, Durant, Dwebble, Leavanny

  // ── KALOS GYMS ───────────────────────────────────────────────────────────
  'kalos_gym_1': [283, 284, 664, 666],             // Violeta: Surskit, Masquerain, Scatterbug, Vivillon
  'kalos_gym_2': [74, 299, 698, 696],              // Lino: Geodude, Nosepass, Amaura, Tyrunt
  'kalos_gym_3': [619, 620, 701, 448],             // Corelia: Mienfoo, Mienshao, Hawlucha, Lucario
  'kalos_gym_4': [43, 70, 189, 673, 407],          // Amaro: Oddish, Weepinbell, Jumpluff, Gogoat, Roserade
  'kalos_gym_5': [587, 82, 702, 695, 135],         // Lem: Emolga, Magneton, Dedenne, Heliolisk, Jolteon
  'kalos_gym_6': [303, 122, 210, 468, 700],        // Valeria: Mawile, Mr.Mime, Granbull, Togekiss, Sylveon
  'kalos_gym_7': [561, 199, 579, 282, 65],         // Astrid: Sigilyph, Slowking, Reuniclus, Gardevoir, Alakazam
  'kalos_gym_8': [712, 361, 131, 460, 713],        // Edel: Bergmite, Snorunt, Lapras, Abomasnow, Avalugg

  // ── KALOS ALTO MANDO & CAMPEON ───────────────────────────────────────────
  'kalos_altomando_1': [707, 476, 212, 680, 681],        // Tileo: Klefki, Probopass, Scizor, Doublade, Aegislash
  'kalos_altomando_2': [668, 324, 229, 609, 663],        // Malva: Pyroar, Torkoal, Houndoom, Chandelure, Talonflame
  'kalos_altomando_3': [714, 715, 691, 334, 621],        // Drácena: Noibat, Noivern, Dragalge, Altaria, Druddigon
  'kalos_altomando_4': [121, 693, 130, 134, 689],        // Narciso: Starmie, Clawitzer, Gyarados, Vaporeon, Barbaracle
  'kalos_campeon':     [701, 282, 700, 468, 706, 711],   // Dianta: Hawlucha, Gardevoir, Sylveon, Togekiss, Goodra, Gourgeist

  // ── ALOLA GYMS ───────────────────────────────────────────────────────────
  'alola_gym_1': [235, 133, 52, 735],              // Liam: Smeargle, Eevee, Meowth, Gumshoos
  'alola_gym_2': [751, 752, 746, 131, 134],        // Nereida: Dewpider, Araquanid, Wishiwashi, Lapras, Vaporeon
  'alola_gym_3': [105, 776, 758, 59],              // Kiawe: Marowak, Turtonator, Salazzle, Arcanine
  'alola_gym_4': [761, 762, 754, 763],             // Lulu: Bounsweet, Steenee, Lurantis, Tsareena
  'alola_gym_5': [737, 777, 738, 26, 135],         // Chris: Charjabug, Togedemaru, Vikavolt, Raichu, Jolteon
  'alola_gym_6': [770, 781, 429, 94, 778],         // Zerala: Palossand, Dhelmise, Mismagius, Gengar, Mimikyu
  'alola_gym_7': [764, 743, 707, 468, 700],        // Rika: Comfey, Ribombee, Klefki, Togekiss, Sylveon
  'alola_gym_8': [375, 376, 462, 476, 681],        // Lario: Metang, Metagross, Magnezone, Probopass, Aegislash

  // ── ALOLA ALTO MANDO ─────────────────────────────────────────────────────
  'alola_altomando_1': [56, 297, 740, 760, 62, 107],    // Kaudan: Mankey, Hariyama, Crabominable, Bewear, Poliwrath, Hitmonchan
  'alola_altomando_2': [745, 525, 526, 703, 476],       // Mayla: Lycanroc, Boldore, Gigalith, Carbink, Probopass
  'alola_altomando_3': [426, 781, 770, 429, 778],       // Zarala: Drifblim, Dhelmise, Palossand, Mismagius, Mimikyu
  'alola_altomando_4': [169, 227, 630, 733, 628],       // Kahili: Crobat, Skarmory, Mandibuzz, Toucannon, Braviary

  // ── GALAR GYMS ───────────────────────────────────────────────────────────
  'galar_gym_1': [829, 830, 420, 840],             // Percy: Gossifleur, Eldegoss, Cherubi, Applin
  'galar_gym_2': [562, 222, 93, 855, 94],          // Alistair: Yamask, Corsola, Haunter, Polteageist, Gengar
  'galar_gym_3': [66, 675, 865, 68],               // Judith: Machop, Pangoro, Sirfetch'd, Machamp
  'galar_gym_4': [37, 38, 59, 229, 851],           // Naboru: Vulpix, Ninetales, Arcanine, Houndoom, Centiskorch
  'galar_gym_5': [215, 510, 560, 625, 861],        // Nerio: Sneasel, Liepard, Scrafty, Bisharp, Grimmsnarl
  'galar_gym_6': [744, 689, 874, 526, 839],        // Morris: Rockruff, Barbaracle, Stonjourner, Gigalith, Coalossal
  'galar_gym_7': [872, 873, 131, 875, 471],        // Mel: Snom, Frosmoth, Lapras, Eiscue, Glaceon
  'galar_gym_8': [776, 330, 612, 884, 887],        // Roy: Turtonator, Flygon, Haxorus, Duraludon, Dragapult

  // ── GALAR CAMPEON ────────────────────────────────────────────────────────
  'galar_campeon': [681, 612, 537, 866, 6, 887],   // Lionel: Aegislash, Haxorus, Seismitoad, Mr.Rime, Charizard, Dragapult

  // ── PALDEA GYMS ──────────────────────────────────────────────────────────
  'paldea_gym_1': [15, 212, 214, 738],             // Araceli (bug): Beedrill, Scizor, Heracross, Vikavolt
  'paldea_gym_2': [763, 407, 754, 470, 673],       // Brais (grass): Tsareena, Roserade, Lurantis, Leafeon, Gogoat
  'paldea_gym_3': [135, 596, 479, 405, 695],       // E-Nigma (electric): Jolteon, Galvantula, Rotom, Luxray, Heliolisk
  'paldea_gym_4': [134, 130, 752, 693, 350],       // Fuco (water): Vaporeon, Gyarados, Araquanid, Clawitzer, Milotic
  'paldea_gym_5': [143, 242, 573, 289, 474],       // Laureano (normal): Snorlax, Blissey, Cinccino, Slaking, Porygon-Z
  'paldea_gym_6': [94, 609, 778, 563, 781],        // Lima (ghost): Gengar, Chandelure, Mimikyu, Cofagrigus, Dhelmise
  'paldea_gym_7': [282, 475, 196, 65, 579],        // Tuli (psychic): Gardevoir, Gallade, Espeon, Alakazam, Reuniclus
  'paldea_gym_8': [461, 471, 473, 873, 615],       // Grusha (ice): Weavile, Glaceon, Mamoswine, Frosmoth, Cryogonal

  // ── PALDEA ALTO MANDO & CAMPEON ──────────────────────────────────────────
  'paldea_altomando_1': [323, 232, 51, 450, 445],       // Denis: Camerupt, Donphan, Dugtrio, Hippowdon, Garchomp
  'paldea_altomando_2': [303, 476, 462, 681, 879],      // Nerina: Mawile, Probopass, Magnezone, Aegislash, Copperajah
  'paldea_altomando_3': [334, 398, 628, 701, 169],      // Aroa: Altaria, Staraptor, Braviary, Hawlucha, Crobat
  'paldea_altomando_4': [715, 612, 706, 887, 149],      // Levi: Noivern, Haxorus, Goodra, Dragapult, Dragonite
  'paldea_campeon':     [706, 445, 887, 715, 149, 373], // Ságita: Goodra, Garchomp, Dragapult, Noivern, Dragonite, Salamence

  // ── KANTO ALTO MANDO & CAMPEON ───────────────────────────────────────────
  'kanto_altomando_1': [87, 91, 124, 131, 80],     // Lorelei: Dewgong, Cloyster, Jynx, Lapras, Slowbro
  'kanto_altomando_2': [95, 106, 107, 68],         // Bruno: Onix, Hitmonlee, Hitmonchan, Machamp
  'kanto_altomando_3': [93, 94, 24, 101],          // Agata: Haunter, Gengar, Arbok, Electrode
  'kanto_campeon':     [148, 148, 130, 142, 149],  // Lance: Dragonair x2, Gyarados, Aerodactyl, Dragonite
};

let updated = 0;
for (const scene of scenes) {
  const ids = teams[scene.scene_id];
  if (!ids) continue;
  if (!isPlaceholder(scene.pokemons)) {
    console.log(`SKIP (already set): ${scene.scene_id}`);
    continue;
  }
  scene.pokemons = makePokemon(ids);
  updated++;
  console.log(`OK: ${scene.scene_id} → [${ids.join(',')}]`);
}

fs.writeFileSync('src/assets/scenes.json', JSON.stringify(scenes, null, 2), 'utf8');
console.log(`\nUpdated ${updated} scenes.`);
