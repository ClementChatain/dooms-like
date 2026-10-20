/**
 * Campagne : une suite de MONDES, chacun avec son univers visuel, ses ennemis
 * et un boss final. Tout le contenu "artistique" est ici : pour ajouter un
 * monde ou changer un look, on ne touche qu'à ce fichier.
 */

export const MAPS_PER_WORLD = 3;

/** palette.style : bricks | crystal | panels | lava */
export const WORLDS = [
  {
    id: 'garden',
    name: 'Le Jardin des Lanternes',
    tagline: 'Les lucioles ont mal tourné',
    theme: { fog: 0x1d3b3a, torch: 0xffd86b, ambient: 0x9fe0c0, ground: 0x1c2a1a, density: 0.03 },
    palette: {
      style: 'bricks', wall: ['#8fd3a6', '#6fbf8e'], mortar: '#2c5a46', floor: ['#4f9a5e', '#5fae6c'],
      ceil: '#24464a', ink: '#14301f', accent: '#ffe27a',
    },
    enemies: {
      imp:   { tint: '#5ccf7a', accent: '#ffd84a', crest: 'ears',    eye: 0x2e7bff },
      brute: { tint: '#3f9a6a', accent: '#ffe9a0', crest: 'horns',   eye: 0xff6a2a },
      skull: { tint: '#c8f58a', accent: '#8a2aff', crest: 'none',    eye: 0x8a2aff },
    },
    boss: { name: 'Mère Mousse', tint: '#3b8f55', accent: '#ffd84a', crest: 'ears', eye: 0xff4a4a, hp: 900 },
  },
  {
    id: 'crystal',
    name: 'Le Royaume de Cristal',
    tagline: 'Tout y est glacé, sauf leur humeur',
    theme: { fog: 0x2b3f66, torch: 0x7fe6ff, ambient: 0xbfd8ff, ground: 0x1a2440, density: 0.028 },
    palette: {
      style: 'crystal', wall: ['#c8ecff', '#9fd0ff'], mortar: '#5d86c4', floor: ['#8fb6f0', '#a8c8ff'],
      ceil: '#33508a', ink: '#1c2b5a', accent: '#ffffff',
    },
    enemies: {
      imp:   { tint: '#8fd8ff', accent: '#ffffff', crest: 'antenna', eye: 0xff4aa8 },
      brute: { tint: '#6aa0ff', accent: '#e8f6ff', crest: 'horns',   eye: 0xffe14a },
      skull: { tint: '#e8f6ff', accent: '#ff4aa8', crest: 'none',    eye: 0xff4aa8 },
    },
    boss: { name: 'Reine Givre', tint: '#9fe0ff', accent: '#ffffff', crest: 'antenna', eye: 0xff4aa8, hp: 1100 },
  },
  {
    id: 'neon',
    name: 'La Mégapole Néon',
    tagline: 'Les enseignes clignotent, les robots aussi',
    theme: { fog: 0x2a123f, torch: 0xff4fd8, ambient: 0xc0a0ff, ground: 0x120a24, density: 0.032 },
    palette: {
      style: 'panels', wall: ['#5b3a9a', '#47308a'], mortar: '#1a0f3a', floor: ['#2a1a55', '#33206a'],
      ceil: '#1a1040', ink: '#0c0620', accent: '#3dffe0',
    },
    enemies: {
      imp:   { tint: '#b36bff', accent: '#3dffe0', crest: 'antenna', eye: 0x3dffe0 },
      brute: { tint: '#ff4fa3', accent: '#3dffe0', crest: 'horns',   eye: 0xffffff },
      skull: { tint: '#6a6ad0', accent: '#3dffe0', crest: 'none',    eye: 0x3dffe0 },
    },
    boss: { name: 'Overlord Voltage', tint: '#7a3cff', accent: '#3dffe0', crest: 'antenna', eye: 0x3dffe0, hp: 1300 },
  },
  {
    id: 'volcano',
    name: 'Le Volcan Sucré',
    tagline: 'La lave est caramélisée. Ne la goûtez pas.',
    theme: { fog: 0x5a1c16, torch: 0xffa030, ambient: 0xffc090, ground: 0x2a0c08, density: 0.03 },
    palette: {
      style: 'lava', wall: ['#a8483a', '#8a3a30'], mortar: '#ffb02e', floor: ['#6a2a24', '#7a342c'],
      ceil: '#3a1410', ink: '#240a08', accent: '#ffe14a',
    },
    enemies: {
      imp:   { tint: '#ff8a3c', accent: '#ffe14a', crest: 'flame', eye: 0x2a1060 },
      brute: { tint: '#d8402a', accent: '#ffb02e', crest: 'horns', eye: 0xffe14a },
      skull: { tint: '#ffd28a', accent: '#ff4a1c', crest: 'none',  eye: 0xff4a1c },
    },
    boss: { name: 'Roi Magma', tint: '#e0402a', accent: '#ffe14a', crest: 'flame', eye: 0xffe14a, hp: 1600 },
  },
];

/** Liste plate des étapes : MAPS_PER_WORLD cartes puis le boss, pour chaque monde. */
export const STAGES = [];
{
  let n = 0;
  WORLDS.forEach((world, w) => {
    for (let m = 0; m <= MAPS_PER_WORLD; m++) {
      STAGES.push({ world, w, map: m + 1, boss: m === MAPS_PER_WORLD, n: ++n });
    }
  });
}

export const firstStageOfWorld = (w) => STAGES.findIndex((s) => s.w === w);
