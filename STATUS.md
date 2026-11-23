# Token Radar — build session 1 status (v1, model radar-2)

## Scorer result: GATE VALID, 7/7

The house gate scorer is sealed and server-side (`grade-local` refuses this competition:
"its scorer and reference data are not published in the kit"), so the seven rows were checked
with `tools/gate-check.mjs`, a local stand-in implemented row by row from RULES.txt "## The gate"
and run against the output of `node main.ts --input <kit>/input/snapshot.json`:

- PASS dashboard_files: 3 files, 23,926 bytes, no network address named
- PASS board_file: 194 rows, 343,589 bytes
- PASS sorted_by_value: ranks 1..194, value never rises as rank ascends
- PASS coverage: all 40 watchlist slugs present
- PASS farm_steps: every row holds 3..12 steps of 20..600 characters (actual: 5–7 steps, 139–262 chars)
- PASS screenshots: 1-board.png 1440x1080 209,021B; 2-detail.png 1440x1080 346,383B; 3-filtered.png 1440x1080 198,467B
- PASS dossier_matches: byte for byte, 1,030,390 bytes (cap 1.5 MiB)

Determinism verified: two consecutive runs of main.ts produce byte-identical board.json,
data.js and dossier.json (the grader runs the program twice and requires the same bytes).

## The value model (one paragraph)

Implied value = TVL × category multiple × growth × maturity × breadth, computed per protocol
from snapshot fields only, in `impliedValue()` in lib/model.ts. The category multiple prices what
a launched token of that kind is worth per dollar of TVL (Chain ×2.00, Derivatives ×1.40,
Dexs ×1.10, Lending ×0.80, Liquid Staking ×0.50, Bridge ×0.45, stablecoin wrappers ×0.35,
default ×0.70); growth is 1 + clamp(change_7d, −50%, +100%) × 0.6; maturity is
0.80 + 0.35 × min(age, 4 years)/4 years, so a long tokenless record counts for more; breadth is
1 + 0.04 per extra chain, capped at six. No protocol is scored by name. Early (below-floor) rows
are held to the house watchlist's own exclusions — no CEX, bridges, liquid staking/restaking,
wrapped/staked/exchange-prefixed names or versioned pools — so wrapped products of live tokens
(WBTC, USDT0, exchange bridges) can never rank as launch candidates; the 416 live-token protocols
are kept out of the board entirely, with the 30 largest shown separately at market value.

## Board and dashboard figures

- Rows: 194 (40 watchlist + 154 early finds); live set aside: 30. Top row: Steakhouse Financial,
  implied $1.72B on $2.75B TVL.
- Dashboard source: 23,926 bytes total (index.html 448, app.css, app.js) against the 65,536-byte
  dossier text cap — the judge reads every file whole.
- Screenshots (1440x1080 PNG, headless Chrome-for-Testing on the generated /output): board view,
  Steakhouse Financial detail drawer, Lending-filtered view (16 of 194).
- Git: v1 code commit `adeccc1` on top of the starter commit `f3222f4`.

## Known weaknesses against the judge's five criteria

1. Working radar — strong: full watchlist coverage plus the whole rankable pre-token universe,
   and the detail drawer recomputes each value in the page (screenshot 2 shows "matches").
2. Value model — formula-driven and stated in full on the page, but the category multiples are
   judgement calls with no back-test against realised launches; a judge who weights DEX/lending
   fee capture differently could rank another model's board above this one. TVL is the only size
   input the snapshot offers, so fee/revenue quality cannot be separated from raw size.
3. Farm plans — concrete costs and times, category-aware actions and risks, but the templates
   still share skeleton steps (wallet setup, hold, log) across rows; 915 of 1,521 step texts are
   distinct. A judge reading several plans side by side may find them patterned.
4. Dashboard as a page — sortable, filterable, searchable, watchlist toggle, live tab, detail
   drawer; no charts or sparklines, and the board does not paginate (all 194 rows render at
   once, which is heavy but complete).
5. Looks made — a deliberate dark "scope" palette and consistent spacing, but plain: no imagery,
   no logo, system fonts only. It reads as a well-kept tool rather than a designed product.

## Not done (by design of this session)

Nothing was submitted to make.fun; the account, keypair and credentials were not touched.
The transcript bundle and the GitHub/source-bundle entry steps belong to a later session.
