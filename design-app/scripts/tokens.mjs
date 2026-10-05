#!/usr/bin/env node
/**
 * tokens.mjs — generate a fluid type and space scale.
 *
 * Produces CSS `clamp()` values whose intercept is in `rem`, so the result
 * respects the reader's own font-size setting. Sizes grow across the viewport,
 * and large steps grow more than small ones — that difference is what makes a
 * scale read as designed rather than as one size multiplied.
 *
 * Usage:
 *   node tokens.mjs
 *   node tokens.mjs --base 16 --ratio 1.25 --steps 6 --vmin 390 --vmax 1500
 *   node tokens.mjs --growth-min 1.08 --growth-max 1.9 --space
 *   node tokens.mjs --json
 *
 * Flags:
 *   --base <px>         base font size (default 16)
 *   --ratio <n>         step ratio between sizes (default 1.25)
 *   --steps <n>         how many steps above base (default 6)
 *   --vmin <px>         viewport at which sizes hit their minimum (default 390)
 *   --vmax <px>         viewport at which sizes hit their maximum (default 1500)
 *   --root <px>         root size used to convert px to rem (default 16)
 *   --growth-min <n>    growth factor at the smallest step (default 1.08)
 *   --growth-max <n>    growth factor at the largest step (default 1.85)
 *   --space             also print a spacing scale
 *   --json              print JSON instead of CSS
 */

const NAMES = ['base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl'];

const HELP = `Generate a fluid type and space scale.

Usage:
  node tokens.mjs [options]

Options:
  --base <px>         base font size (default 16)
  --ratio <n>         step ratio between sizes (default 1.25)
  --steps <n>         how many steps above base (default 6)
  --vmin <px>         viewport at which sizes hit their minimum (default 390)
  --vmax <px>         viewport at which sizes hit their maximum (default 1500)
  --root <px>         root size used to convert px to rem (default 16)
  --growth-min <n>    growth factor at the smallest step (default 1.08)
  --growth-max <n>    growth factor at the largest step (default 1.85)
  --space             also print a spacing scale
  --json              print JSON instead of CSS
  -h, --help          show this

Examples:
  node tokens.mjs
  node tokens.mjs --base 15 --ratio 1.2 --steps 5 --space
  node tokens.mjs --vmin 360 --vmax 1600 --json`;

function parseArgs(argv) {
  const out = {
    base: 16, ratio: 1.25, steps: 6, vmin: 390, vmax: 1500,
    root: 16, growthMin: 1.08, growthMax: 1.85,
    space: false, json: false,
  };
  const map = {
    '--base': 'base', '--ratio': 'ratio', '--steps': 'steps',
    '--vmin': 'vmin', '--vmax': 'vmax', '--root': 'root',
    '--growth-min': 'growthMin', '--growth-max': 'growthMax',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--space') { out.space = true; continue; }
    if (a === '--json') { out.json = true; continue; }
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    const key = map[a];
    if (!key) {
      console.error(`Unknown flag: ${a}\nRun with --help for usage.`);
      process.exit(1);
    }
    const raw = argv[++i];
    const val = Number(raw);
    if (!Number.isFinite(val) || val <= 0) {
      console.error(`Flag ${a} needs a positive number, got: ${raw ?? '(nothing)'}`);
      process.exit(1);
    }
    out[key] = val;
  }
  if (out.vmax <= out.vmin) {
    console.error(`--vmax (${out.vmax}) must be greater than --vmin (${out.vmin}).`);
    process.exit(1);
  }
  return out;
}

const px = (n) => `${Math.round(n * 1000) / 1000}px`;
const rem = (n) => `${Math.round((n / 16) * 10000) / 10000}rem`;

/** Round-trip a value through the root size so rem output is exact. */
function toRem(pxValue, root) {
  return Math.round((pxValue / root) * 10000) / 10000;
}

/**
 * Build one fluid step.
 *
 * minAtVmin and maxAtVmax are in px. The linear interpolation becomes
 * `intercept + slope*vw`, with the intercept expressed in rem so a user who
 * raises their browser font size gets larger text rather than a broken layout.
 */
function fluid(minAtVmin, maxAtVmax, { vmin, vmax, root }) {
  const slopePerPx = (maxAtVmax - minAtVmin) / (vmax - vmin); // px of type per px of viewport
  const interceptPx = minAtVmin - slopePerPx * vmin;
  const slopeVw = slopePerPx * 100;
  const clamped = interceptPx >= 0;
  const mid = `${toRem(interceptPx, root)}rem + ${Math.round(slopeVw * 10000) / 10000}vw`;
  return {
    min: minAtVmin,
    max: maxAtVmax,
    interceptPx,
    slopeVw,
    value: `clamp(${toRem(minAtVmin, root)}rem, ${mid}, ${toRem(maxAtVmax, root)}rem)`,
    // A negative intercept means the clamp floor is doing the work at vmin,
    // which is fine, but a *positive* intercept above the min is a typo.
    note: clamped ? null : 'intercept is negative; the min clamp holds below a crossover point',
  };
}

function buildScale(opts) {
  const rows = [];
  const { base, ratio, steps, vmin, vmax, root, growthMin, growthMax } = opts;

  for (let n = 0; n <= steps; n++) {
    const minPx = base * Math.pow(ratio, n);
    // Growth ramps from growthMin at n=0 to growthMax at n=steps, so display
    // sizes expand much more than body sizes across the same viewport range.
    const t = steps === 0 ? 1 : n / steps;
    const growth = growthMin + (growthMax - growthMin) * t;
    const maxPx = minPx * growth;
    const f = fluid(minPx, maxPx, { vmin, vmax, root });
    rows.push({
      name: `--fs-${NAMES[n] ?? `s${n}`}`,
      ...f,
      growth: Math.round(growth * 100) / 100,
    });
  }
  return rows;
}

function buildSpace(opts) {
  const { base } = opts;
  const ratios = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3.5, 4.5];
  return ratios.map((r, i) => ({
    name: `--s${i + 1}`,
    px: Math.round(base * r),
  }));
}

function toCss(scale, space, opts) {
  const lines = [];
  lines.push('/* ------------------------------------------------------------------');
  lines.push('   Type scale — fluid, generated by tokens.mjs');
  lines.push(`   base ${opts.base}px · ratio ${opts.ratio} · ${opts.vmin}–${opts.vmax}px`);
  lines.push('   The intercept is in rem, so it honours the reader\'s font size.');
  lines.push('   ------------------------------------------------------------------ */');
  lines.push(':root {');
  const widest = Math.max(...scale.map((r) => r.value.length));
  for (const r of scale) {
    const size = `${px(r.min)} -> ${px(r.max)}`.padEnd(20);
    const decl = `${r.name.padEnd(13)} ${r.value};`.padEnd(widest + 16);
    lines.push(`  ${decl}/* ${size} x${r.growth} */`);
  }
  lines.push('}');

  if (space.length) {
    lines.push('');
    lines.push('/* Spacing scale — one scale, used for everything. */');
    lines.push(':root {');
    for (const s of space) lines.push(`  ${s.name.padEnd(6)} ${s.px}px;`);
    lines.push('}');
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const scale = buildScale(opts);
  const space = opts.space ? buildSpace(opts) : [];

  const warned = scale.filter((r) => r.note);
  if (warned.length && !opts.json) {
    for (const w of warned) console.error(`note: ${w.name} — ${w.note}`);
  }

  console.log(opts.json
    ? JSON.stringify({ scale, space }, null, 2)
    : toCss(scale, space, opts));
}

main();

export { buildScale, buildSpace, fluid };
