// A local stand-in for the gate: the seven checks of RULES.txt ("## The gate"), implemented from
// the rules' own words and run against a directory main.ts wrote. The house scorer is sealed and
// server-side; this is the closest local reading of it, kept honest by following the text row by
// row. Usage: node tools/gate-check.mjs <output-dir> <snapshot.json>
//
// It is stricter than the rules in one place: dashboard_files refuses an http or https address
// anywhere in a dashboard file, where the rules refuse one only in an attribute value, a style
// body, a stylesheet or a script specifier. Passing the stricter check passes the rule's.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const out = process.argv[2];
const snapshotFile = process.argv[3];
if (!out || !snapshotFile) {
  process.stderr.write('usage: node tools/gate-check.mjs <output-dir> <snapshot.json>\n');
  process.exit(2);
}
const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'));
const protocolSlugs = new Set(snapshot.protocols.map((p) => p.slug));

const results = [];
function row(name, pass, detail) {
  results.push({ name, pass, detail });
}

/** Every regular file under dir, as paths relative to dir. */
function walk(dir, prefix = '') {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) files.push(...walk(path, `${prefix}${name}/`));
    else if (st.isFile()) files.push(`${prefix}${name}`);
  }
  return files;
}

// ---- dashboard_files ----------------------------------------------------------
{
  const dir = join(out, 'dashboard');
  let fail = null;
  let ok = '';
  if (!existsSync(dir)) fail = 'no dashboard/ in the output';
  else {
    const files = walk(dir);
    const totalBytes = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
    if (!files.includes('index.html')) fail = 'dashboard/ holds no index.html';
    else if (!files.some((f) => f.endsWith('.css'))) fail = 'dashboard/ holds no .css file';
    else if (!files.some((f) => f.endsWith('.js'))) fail = 'dashboard/ holds no .js file';
    else if (files.length > 400) fail = `dashboard/ holds ${files.length} files, over 400`;
    else if (totalBytes > 4_194_304) fail = `dashboard/ is ${totalBytes} bytes, over 4 MiB`;
    else {
      for (const f of files) {
        const base = f.split('/').pop();
        if (!/^[A-Za-z0-9._-]+$/.test(base) || base.startsWith('.') || base.startsWith('-') || base.length > 128) {
          fail = `dashboard/${f}: a name the rules refuse`;
          break;
        }
        if (/https?:\/\//.test(readFileSync(join(dir, f), 'utf8'))) {
          fail = `dashboard/${f}: names an http or https address`;
          break;
        }
      }
      if (fail === null) ok = `${files.length} files, ${totalBytes} bytes, no network address named`;
    }
  }
  row('dashboard_files', fail === null, fail ?? ok);
}

// ---- board_file -----------------------------------------------------------------
let board = null;
{
  const file = join(out, 'board.json');
  let fail = null;
  let ok = '';
  if (!existsSync(file)) fail = 'no board.json in the output';
  else {
    const bytes = statSync(file).size;
    let parsed = null;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      fail = 'board.json is not JSON';
    }
    if (fail === null) {
      const rows = Array.isArray(parsed) ? parsed : parsed.rows;
      if (!Array.isArray(rows)) fail = 'board.json has no rows array';
      else if (bytes > 8 * 1024 * 1024) fail = `board.json is ${bytes} bytes, over 8 MiB`;
      else if (rows.length < 100 || rows.length > 4000) fail = `board.json has ${rows.length} rows, outside 100..4000`;
      else {
        board = rows;
        const seen = new Set();
        for (const r of rows) {
          if (typeof r.slug !== 'string' || /\s/.test(r.slug) || !protocolSlugs.has(r.slug)) { fail = `a row names slug ${r.slug}, not one of the snapshot's protocols`; break; }
          if (seen.has(r.slug)) { fail = `slug ${r.slug} appears twice`; break; }
          seen.add(r.slug);
          if (typeof r.name !== 'string' || r.name.length === 0) { fail = `${r.slug} has an empty name`; break; }
          if (!Number.isSafeInteger(r.rank) || r.rank <= 0) { fail = `${r.slug} has rank ${r.rank}`; break; }
          if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) { fail = `${r.slug} has implied value ${r.implied_value_usd}`; break; }
          if (!Array.isArray(r.farm_steps)) { fail = `${r.slug} has no farm_steps array`; break; }
        }
        if (fail === null) ok = `${rows.length} rows, ${bytes} bytes`;
        else board = null;
      }
    }
  }
  row('board_file', board !== null, fail ?? ok);
}

// ---- sorted_by_value --------------------------------------------------------------
{
  let fail = null;
  let ok = '';
  if (board === null) fail = 'no valid board to sort';
  else {
    const byRank = board.slice().sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < byRank.length; i++) {
      if (byRank[i].rank !== i + 1) { fail = `rank ${i + 1} is ${byRank[i].rank}`; break; }
      if (i > 0 && byRank[i].implied_value_usd > byRank[i - 1].implied_value_usd) { fail = `rank ${i + 1} outranks rank ${i} on implied value`; break; }
    }
    if (fail === null && byRank.length >= 2 && byRank[0].implied_value_usd === byRank[byRank.length - 1].implied_value_usd) {
      fail = 'every row shares one implied value';
    }
    if (fail === null) ok = `ranks 1..${byRank.length}, value never rises as rank ascends`;
  }
  row('sorted_by_value', fail === null, fail ?? ok);
}

// ---- coverage -----------------------------------------------------------------------
{
  if (board === null) row('coverage', false, 'no valid board to cover with');
  else {
    const slugs = new Set(board.map((r) => r.slug));
    const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
    row('coverage', missing.length === 0,
      missing.length === 0 ? `all ${snapshot.watchlist.length} watchlist slugs present` : `missing ${missing.length}: ${missing.slice(0, 5).join(', ')}`);
  }
}

// ---- farm_steps -----------------------------------------------------------------------
{
  let fail = null;
  if (board === null) fail = 'no valid board to read plans from';
  else {
    for (const r of board) {
      if (r.farm_steps.length < 3 || r.farm_steps.length > 12) { fail = `${r.slug} has ${r.farm_steps.length} farm steps`; break; }
      for (const s of r.farm_steps) {
        const len = typeof s === 'string' ? s.trim().length : 0;
        if (len < 20 || len > 600) { fail = `${r.slug} has a farm step of ${len} characters`; break; }
      }
      if (fail !== null) break;
    }
  }
  row('farm_steps', fail === null, fail ?? 'every row holds 3..12 steps of 20..600 characters');
}

// ---- screenshots ------------------------------------------------------------------------
function imageSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { kind: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc2) return { kind: 'jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return null;
}
{
  const dir = join(out, 'screenshots');
  let fail = null;
  let ok = '';
  if (!existsSync(dir)) fail = 'no screenshots/ in the output';
  else {
    const names = readdirSync(dir).filter((n) => !n.startsWith('.') && statSync(join(dir, n)).isFile());
    if (names.length < 3 || names.length > 4) fail = `screenshots/ holds ${names.length} images, outside 3..4`;
    else {
      const parts = [];
      for (const name of names) {
        if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(name)) { fail = `${name}: a name a dossier refuses`; break; }
        const buf = readFileSync(join(dir, name));
        if (buf.length > 524_288) { fail = `${name} is ${buf.length} bytes, over 512 KiB`; break; }
        const size = imageSize(buf);
        if (size === null) { fail = `${name} is not a whole PNG or JPEG`; break; }
        const long = Math.max(size.w, size.h);
        const short = Math.min(size.w, size.h);
        if (long > 1440 || short < 800) { fail = `${name} is ${size.w}x${size.h}, outside the side limits`; break; }
        parts.push(`${name} ${size.w}x${size.h} ${buf.length}B`);
      }
      if (fail === null) ok = parts.join('; ');
    }
  }
  row('screenshots', fail === null, fail ?? ok);
}

// ---- dossier_matches ----------------------------------------------------------------------
{
  const file = join(out, 'dossier.json');
  let fail = null;
  let ok = '';
  if (!existsSync(file)) fail = 'no dossier.json in the output';
  else {
    const written = readFileSync(file);
    let rebuilt = null;
    try {
      const raw = buildDossier(out, {
        text_max_bytes: 65_536,
        screenshots: { max: 4, max_bytes: 524_288 },
        dashboard: { max_files: 400, max_bytes: 4_194_304 },
      });
      rebuilt = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    } catch (e) {
      fail = `buildDossier refused the output: ${e.message}`;
    }
    if (rebuilt !== null) {
      if (!written.equals(rebuilt)) fail = 'dossier.json differs from a fresh buildDossier of the same output';
      else if (written.length > 1_572_864) fail = `dossier.json is ${written.length} bytes, over 1.5 MiB`;
      else ok = `byte for byte, ${written.length} bytes`;
    }
  }
  row('dossier_matches', fail === null, fail ?? ok);
}

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}\n`);
}
process.stdout.write(allPass ? 'GATE: valid (7/7)\n' : 'GATE: INVALID\n');
process.exit(allPass ? 0 : 1);
