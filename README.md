# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Gren01r/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Gren01r/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over a frozen DefiLlama snapshot (758 protocols). It ranks pre-token protocols by an implied launch value computed from a transparent formula — TVL × category multiple, adjusted for 7-day growth, tokenless maturity, and chain breadth — never from hardcoded names. The board covers the full 40-protocol watchlist plus every early-stage candidate the formula surfaces (194 rows), each with a concrete, costed farming plan (3–12 steps). A static, offline dashboard (no network references) makes the board sortable, filterable, and inspectable row by row, recomputing each value in-page so the model can be audited. Protocols that already have a token are excluded from the board and shown separately at market value.

## Run it

```sh
MAKEFUN_INPUT_DIR=/input MAKEFUN_OUTPUT_DIR=/output node --experimental-strip-types main.ts
```

`main.ts` reads `snapshot.json` from the input dir and writes `board.json`, the dashboard, screenshots, and `dossier.json` to the output dir.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
