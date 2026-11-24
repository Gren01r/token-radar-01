# Token Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Gren01r/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Gren01r/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar for protocol token launches that have not happened yet. It reads one sealed
snapshot of DefiLlama protocol records and answers a hypothetical: if each protocol
issued a token today, what would that token plausibly be worth, and what should a
reader do to farm the protocol before or after the launch? The board never claims a
launch will happen — an implied value is the model's own arithmetic, stated in the open.

## How a row earns its rank

Every figure comes from the snapshot itself. A protocol's implied value is its TVL
scaled by four factors computed in `impliedValue()` in `lib/model.ts`: a multiple for
its category (what a launched token of that kind tends to be worth per dollar of TVL),
a growth factor from its seven-day TVL change, a maturity factor that rewards a long
record with no token, and a breadth factor for each extra chain it runs on. Nothing is
scored by name and nothing is hardcoded per protocol.

The board holds 194 rows: all 40 protocols on the snapshot's watchlist (at least $50M
TVL and no token on record) plus 154 early finds below that floor, held to the same
exclusions the watchlist uses, so wrapped or staked products of tokens that already
trade can never pose as launch candidates. The 30 largest protocols whose tokens
already trade are set aside and shown separately at market value. Each row carries a
farm plan of concrete steps with costs and timings.

## Running it

With Node.js 22.18 or later, from this repository:

```
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

The run writes `board.json` (the ranked rows), `data.js` (the dashboard's data),
copies of `dashboard/` and `screenshots/`, and `dossier.json` into the output
directory. Two runs over the same snapshot write the same bytes. The dashboard is a
single static page — sortable, filterable, searchable, with a detail view per
protocol — and renders with no network.

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
