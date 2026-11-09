// Everything in the shop that changes how a run plays: upgrades, abilities and helpers.
// Each item keeps its shop text next to its effect: apply(stats, level) changes the run's stats
// (see BASE_STATS; computeStats() in game/catalog.js runs every apply at the start of a run) and fx(level)
// describes a level in the shop. Gameplay code reads only stats, never upgrade levels, so a new upgrade
// is one entry here plus whatever reads its stat.
//
// Item fields: id (saved; never rename), tab, name, max (levels), base (price of level 1), g (price growth per level,
// default 1.7), info (HTML), fx, apply.
import { coarse } from '../platform.js';

export const BASE_STATS = {
  speed: 5.4, dashT: 0.24, dashCD: 1.8, dashSpeed: 2.8, blinkDist: 3,
  maxLives: 3, invTime: 1.6, heartEvery: 24,
  reach: 0.95, magnetPull: 0, doubleShard: 0, shardLife: 9, shardMul: 1, dustMul: 1,
  comboWin: 3, comboMax: 8, steady: 0, closeMul: 1, fallMul: 1,
  abCD: 1, giantTime: 6,
  survivorPay: 1, runBonus: 0,
  shield: false, revive: false, beacons: false, skate: false, goldRush: false, clover: false, headStart: false,
  drift: false, burst: false, giant: false, launch: false,
  buddies: 0, buddySpeed: 10, buddyRest: 1.4, buddyRange: 7, medicBuddies: false,
};

const press = (key, label) => coarse ? `Tap <b>${label}</b>` : `Press <b>${key}</b>`;

export const UPGRADES = [
  { id: 'speed', tab: 'up', name: 'Swift Feet', max: 8, base: 12, g: 1.5, info: 'Pip walks faster.', fx: (l) => `+${l * 8}% speed`, apply: (s, l) => { s.speed *= 1 + 0.08 * l; } },
  { id: 'dashcd', tab: 'up', name: 'Quick Recharge', max: 5, base: 15, info: 'Dash comes back sooner.', fx: (l) => `${(1.8 * (1 - 0.12 * l)).toFixed(2)} s cooldown`, apply: (s, l) => { s.dashCD *= 1 - 0.12 * l; } },
  { id: 'dashlen', tab: 'up', name: 'Long Dash', max: 3, base: 20, info: 'Dashes go further and keep you safe longer.', fx: (l) => `+${l * 25}% dash length`, apply: (s, l) => { s.dashT *= 1 + 0.25 * l; } },
  { id: 'hull', tab: 'up', name: 'Extra Hull', max: 7, base: 40, g: 1.5, info: 'Start every run with more hull.', fx: (l) => `${3 + l} hull`, apply: (s, l) => { s.maxLives += l; } },
  { id: 'magnet', tab: 'up', name: 'Shard Magnet', max: 8, base: 18, g: 1.45, info: 'Grab shards from further away, and nearby shards drift toward you.', fx: (l) => `${(1 + 0.37 * l).toFixed(2)}× reach`, apply: (s, l) => { s.reach *= 1 + 0.37 * l; s.magnetPull = l; } },
  { id: 'luck', tab: 'up', name: 'Lucky Craters', max: 6, base: 18, g: 1.5, info: 'Craters sometimes hold two shards.', fx: (l) => `${l * 15}% chance of a pair`, apply: (s, l) => { s.doubleShard = 0.15 * l; } },
  { id: 'linger', tab: 'up', name: 'Lasting Glow', max: 6, base: 14, g: 1.5, info: 'Shards stay longer before fading.', fx: (l) => `${(9 + 1.5 * l).toFixed(1)} s glow`, apply: (s, l) => { s.shardLife += 1.5 * l; } },
  { id: 'chain', tab: 'up', name: 'Chain Keeper', max: 8, base: 16, g: 1.45, info: 'More time to reach the next shard in a chain.', fx: (l) => `${(3 + 0.75 * l).toFixed(2)} s window`, apply: (s, l) => { s.comboWin += 0.75 * l; } },
  { id: 'cap', tab: 'up', name: 'Bigger Multiplier', max: 8, base: 30, g: 1.45, info: 'Raise the highest multiplier you can reach.', fx: (l) => `×${8 + 2 * l} max`, apply: (s, l) => { s.comboMax += 2 * l; } },
  { id: 'warn', tab: 'up', name: 'Early Warning', max: 6, base: 25, g: 1.5, info: 'Meteors fall a little slower.', fx: (l) => `+${l * 8}% fall time`, apply: (s, l) => { s.fallMul += 0.08 * l; } },
  { id: 'shell', tab: 'up', name: 'Thick Shell', max: 6, base: 14, g: 1.5, info: 'Stay untouchable longer after a hit.', fx: (l) => `${(1.6 + 0.5 * l).toFixed(1)} s safe`, apply: (s, l) => { s.invTime += 0.5 * l; } },
  { id: 'hearts', tab: 'up', name: 'Heart Finder', max: 3, base: 20, info: 'Hull repairs show up more often.', fx: (l) => `one every ${Math.round(24 * (1 - 0.2 * l))} s`, apply: (s, l) => { s.heartEvery *= 1 - 0.2 * l; } },
  { id: 'close', tab: 'up', name: 'Daredevil', max: 8, base: 12, g: 1.4, info: 'Bigger bonus for close calls.', fx: (l) => `${1 + l}× close-call points`, apply: (s, l) => { s.closeMul += l; } },
  { id: 'shine', tab: 'up', name: 'Shiny Shards', max: 10, base: 22, g: 1.4, info: 'Every shard is worth more points.', fx: (l) => `+${l * 20}% shard points`, apply: (s, l) => { s.shardMul += 0.2 * l; } },
  { id: 'farblink', tab: 'up', name: 'Far Blink', max: 5, base: 18, g: 1.5, info: 'Blink jumps further.', fx: (l) => `${3 + l} m blink`, apply: (s, l) => { s.blinkDist += l; } },
  { id: 'powercd', tab: 'up', name: 'Quick Powers', max: 5, base: 40, g: 1.55, info: 'Drift, Burst and Giant recharge faster.', fx: (l) => `-${l * 12}% recharge`, apply: (s, l) => { s.abCD -= 0.12 * l; } },
  { id: 'giantlen', tab: 'up', name: 'Bigger Giant', max: 5, base: 25, g: 1.5, info: 'Giant Pip lasts longer (needs Giant Pip).', fx: (l) => `${6 + 2 * l} s giant`, apply: (s, l) => { s.giantTime += 2 * l; } },
  { id: 'piggy', tab: 'up', name: 'Piggy Bank', max: 20, base: 30, g: 1.25, info: 'Bonus stardust at the end of every run.', fx: (l) => `+${l * 4} stardust per run`, apply: (s, l) => { s.runBonus += 4 * l; } },
  { id: 'steady', tab: 'up', name: 'Steady Hands', max: 3, base: 45, g: 1.7, info: 'Getting hit no longer wipes out your whole multiplier.', fx: (l) => `keep ${l * 25}% of it`, apply: (s, l) => { s.steady = 0.25 * l; } },
  { id: 'survivor', tab: 'up', name: "Survivor's Pay", max: 5, base: 28, g: 1.5, info: 'More stardust for every 10 s you survive.', fx: (l) => `${1 + l} per 10 s`, apply: (s, l) => { s.survivorPay += l; } },
  { id: 'dust', tab: 'up', name: 'Stardust Sieve', max: 10, base: 35, g: 1.45, info: 'Earn more stardust from every shard.', fx: (l) => `+${l * 25}% stardust`, apply: (s, l) => { s.dustMul += 0.25 * l; } },

  { id: 'shield', tab: 'ab', name: 'Bubble Shield', base: 60, info: 'Start each run inside a bubble that blocks one hit.', apply: (s) => { s.shield = true; } },
  { id: 'revive', tab: 'ab', name: 'Second Wind', base: 120, info: 'Once per run, Pip gets back up with 1 hull instead of losing.', apply: (s) => { s.revive = true; } },
  { id: 'drift', tab: 'ab', name: 'Time Drift', base: 90, info: `${press('Q', 'Drift')} to slow every falling meteor for 4 s. Recharges in 25 s.`, apply: (s) => { s.drift = true; } },
  { id: 'burst', tab: 'ab', name: 'Star Burst', base: 150, info: `${press('E', 'Burst')} to blast every meteor out of the sky. Recharges in 35 s.`, apply: (s) => { s.burst = true; } },
  { id: 'beacon', tab: 'ab', name: 'Shard Beacons', base: 35, info: 'Beams of light mark every shard, even past the horizon.', apply: (s) => { s.beacons = true; } },
  { id: 'giant', tab: 'ab', name: 'Giant Pip', base: 130, info: `${press('G', 'Giant')} to grow huge for 6 s. Meteors bounce off you, you stomp trees flat, and you grab shards from much further away. While giant, shards show up <b>50% faster</b>. Recharges in 30 s.`, apply: (s) => { s.giant = true; } },
  { id: 'launch', tab: 'ab', name: 'Launch Base', base: 60, info: `Every <b>10 shards</b> in a run raise a launch base out of the ground. Walk onto it: jets bolt onto Pip's board and you fly to another world. Worlds further out pay <b>up to 2.5×</b> for shards. ${coarse ? 'Steer with your left thumb' : 'Steer with W A S D and the mouse'} in space.`, apply: (s) => { s.launch = true; } },
  { id: 'skate', tab: 'ab', name: 'Skateboard', base: 80, info: 'Pip rides a skateboard. Dashes go <b>60% faster</b> and throw sparks off the wheels.', apply: (s) => { s.skate = true; s.dashSpeed *= 1.6; } },
  { id: 'buddy', tab: 'help', name: 'Star Buddies', max: 8, base: 90, g: 1.5, info: 'Little star helpers circle Pip and fly off to grab nearby shards for you. Each level adds another helper.', fx: (l) => `${l} helper${l === 1 ? '' : 's'}`, apply: (s, l) => { s.buddies = l; } },
  { id: 'wings', tab: 'help', name: 'Helper Wings', max: 5, base: 40, g: 1.5, info: 'Your Star Buddies fly faster and rest less between grabs.', fx: (l) => `+${l * 25}% helper speed`, apply: (s, l) => { s.buddySpeed *= 1 + 0.25 * l; s.buddyRest *= 1 - 0.15 * l; } },
  { id: 'radar', tab: 'help', name: 'Helper Radar', max: 5, base: 35, g: 1.5, info: 'Your Star Buddies spot shards from further away.', fx: (l) => `${7 + 1.5 * l} m search range`, apply: (s, l) => { s.buddyRange += 1.5 * l; } },
  { id: 'hearthelp', tab: 'help', name: 'Medic Buddies', base: 120, info: 'Your Star Buddies also grab hull hearts for you when you are hurt.', apply: (s) => { s.medicBuddies = true; } },
  { id: 'goldrush', tab: 'ab', name: 'Gold Rush', base: 75, info: 'About 1 in 8 crater shards is a big <b>golden shard</b> worth 5× points and stardust.', apply: (s) => { s.goldRush = true; } },
  { id: 'clover', tab: 'ab', name: 'Lucky Clover', base: 55, info: 'When your hull is damaged, craters sometimes leave a heart instead of a shard.', apply: (s) => { s.clover = true; } },
  { id: 'headstart', tab: 'ab', name: 'Head Start', base: 45, info: 'Begin each run already at ×3, with 8 s to grab your first shard.', apply: (s) => { s.headStart = true; } },
];
