// The intro, top to bottom. One screen-height range of scroll per beat (BEAT_VH).
// Every beat has its own set; nothing appears twice. The GPU-cloud beat was cut on
// 2 Nov 2026 at Gabe's request; Massed Compute now reads "software development" on the cover.
export const BEAT_VH = 240;

export const BEATS = [
  { id: 'line',   scene: 'hand',    caption: 'Every build starts with one line.' },
  { id: 'apps',   scene: 'devices', caption: 'It becomes native Apple apps,' },
  { id: 'motion', scene: 'rise',    caption: 'and creative tech that moves.' },
  { id: 'open',   scene: 'shatter', caption: 'Then the walls come down.' },
  // the showcase: the name, then one engraved set per project (src/data/projects.ts).
  // No captions here: the cover and the project cards carry their own type.
  { id: 'cover',         scene: 'cover',            anchor: 'top', anchorP: 0.5 },
  { id: 'work-prism',    scene: 'project-prism',    project: 'prism-smp', anchor: 'work' },
  { id: 'work-leland',   scene: 'project-leland',   project: 'leland-plays-piano' },
  { id: 'work-ricochet', scene: 'project-ricochet', project: 'ricochet-tanks' },
  { id: 'work-gcoolers', scene: 'project-gcoolers', project: 'gcoolers' },
  // "The code, in public": GitHub as an engraved city of languages and repos
  { id: 'code',          scene: 'code',             anchor: 'github', anchorP: 0.3 },
];
