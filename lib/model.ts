// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks pre-token protocols: protocols whose snapshot record carries no token (no market
// cap, no CoinGecko id, no symbol). It covers every slug in the snapshot's watchlist (the floor,
// never a ceiling) and adds every other rankable pre-token protocol the snapshot carries, so the
// board is the whole pre-token universe the data supports, not a sample of it. Live-token protocols
// are kept apart in their own set and shown at the market's own values, never mixed into the ranks.
//
// Implied value follows only from the snapshot's own figures, in impliedValue():
//
//   implied    = round( tvl_usd x categoryMultiple x growthMult x maturityMult x breadthMult )
//   categoryMultiple  what a launched token of this category is worth per dollar of TVL: chains and
//                     derivatives capture the most value per TVL dollar, stablecoin wrappers and
//                     bridges the least (see CATEGORY_MULTIPLES; the table is keyed by the
//                     snapshot's category string, never by a protocol's name)
//   growthMult = 1 + clamp(change_7d, -50, 100) / 100 x 0.6     (a week of TVL growth, damped)
//   maturityMult = 0.8 + 0.35 x min(age_days, 1460) / 1460      (a long record with no token yet
//                     means more unrewarded usage behind the launch; unknown age counts as 365)
//   breadthMult  = 1 + 0.04 x min(chains - 1, 6)                (each extra chain is more surface
//                     a launch can be farmed and used on, capped at six)
//
// No protocol name is ever special-cased: the same function scores every row, and the dashboard
// restates the formula and recomputes each row's value from the row's own figures.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's tunable constants: the growth, maturity and breadth terms of impliedValue(). */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_base: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
  default_multiple: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_base: 0.8,
  maturity_range: 0.35,
  maturity_days: 1460,
  unknown_age_days: 365,
  breadth_per_chain: 0.04,
  breadth_max_extra: 6,
  default_multiple: 0.7,
};

/**
 * What a launched token is worth per dollar of TVL, by the snapshot's category string. Grounded in
 * how launched tokens of each kind have traded against their protocols' TVL: chain tokens and
 * derivatives venues capture fees and order flow directly, lending and DEX tokens capture a thinner
 * spread, staking and restaking tokens sit under very large TVL with modest fee capture, and
 * stablecoin wrappers and bridges capture the least per dollar that passes through them.
 */
export const CATEGORY_MULTIPLES: Record<string, number> = {
  'Chain': 2.0,
  'Decentralized AI': 1.6,
  'AI Agents': 1.6,
  'Prediction Market': 1.5,
  'Derivatives': 1.4,
  'Launchpad': 1.2,
  'Privacy': 1.2,
  'Dexs': 1.1,
  'Synthetics': 1.0,
  'Options': 1.0,
  'Options Vault': 1.0,
  'Interest Rate Derivatives': 1.0,
  'Payments': 1.0,
  'Lending': 0.8,
  'RWA': 0.8,
  'CDP': 0.7,
  'CDP Manager': 0.7,
  'Yield': 0.7,
  'Yield Aggregator': 0.7,
  'Insurance': 0.7,
  'Uncollateralized Lending': 0.7,
  'Restaking': 0.6,
  'Liquidity Manager': 0.6,
  'Indexes': 0.6,
  'Risk Curators': 0.55,
  'Onchain Capital Allocator': 0.55,
  'Liquid Staking': 0.5,
  'Staking Pool': 0.5,
  'Basis Trading': 0.5,
  'Farm': 0.5,
  'Leveraged Farming': 0.5,
  'Bridge': 0.45,
  'Cross Chain Bridge': 0.45,
  'Algo-Stables': 0.35,
  'Dual-Token Stablecoin': 0.35,
  'Stablecoin Issuer': 0.35,
  'Stablecoin Wrapper': 0.35,
  'Canonical Bridge': 0.3,
  'CEX': 0.3,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 30;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  category_multiples: Record<string, number>;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The category multiple for a protocol: its category's row of the table, else the default. */
export function categoryMultiple(category: string | null, model: ModelConstants = MODEL): number {
  if (category !== null && Object.prototype.hasOwnProperty.call(CATEGORY_MULTIPLES, category)) {
    return CATEGORY_MULTIPLES[category]!;
  }
  return model.default_multiple;
}

/** The full breakdown of one protocol's implied value under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): {
  implied: number;
  categoryMult: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const catMult = categoryMultiple(protocol.category, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_base +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const breadthMult = 1 + extraChains * model.breadth_per_chain;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * catMult * growthMult * maturityMult * breadthMult));
  return { implied, categoryMult: catMult, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** The house watchlist's own name rules, applied to the early rows the board adds below the floor. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Categories the house's own watchlist rule treats as a wrapped, staked or bridged product of a
 * protocol whose token already trades, rather than a launch candidate: a bridge's asset is its
 * parent token in transit (WBTC, USDT0), and a liquid staking balance is the staking asset's own
 * claim. The board holds early rows to the same line the watchlist is drawn by.
 */
const PRODUCT_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Anchor BTC',
  'Decentralized BTC',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank as an early row: pre-token, not an exchange, not a
 * versioned pool, not a wrapped or staked product wearing its parent's name, and not a product
 * category. Watchlist rows are always ranked, whether or not this would choose them.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name) &&
    !(p.category !== null && PRODUCT_CATEGORIES.has(p.category))
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names is ranked, whatever the early rules would say.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, at any TVL. The snapshot's own $5M
  // listing cut is the floor for inclusion, so the board covers the whole pre-token universe it holds.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => ({ p, ...impliedValue(p, snapshot.as_of, model) }));
  scored.sort(
    (a, b) =>
      b.implied - a.implied ||
      b.p.tvl_usd - a.p.tvl_usd ||
      (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.categoryMult,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** A small deterministic hash of a slug, so phrasing varies by protocol but never between runs. */
function slugHash(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** Pick one of `options` by the protocol's own hash: variety that is identical on every run. */
function pick<T>(p: SnapshotProtocol, salt: number, options: readonly T[]): T {
  return options[(slugHash(p.slug) + salt) % options.length]!;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 250_000_000) return 100;
  if (p.tvl_usd >= 50_000_000) return 75;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core farming action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('uncollateralized')) return `Lend $${capital} of USDC into one of ${name}'s credit pools on ${chain} and keep the loan position open.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as collateral and borrow a small amount against it, so both sides of the market see the wallet.`;
  if (c.includes('dex')) return `Swap about $${Math.max(20, Math.round(capital / 3))} through ${name} on ${chain}, then provide $${capital} of liquidity to its main pool and keep the position open.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Deposit $${capital} of USDC as margin on ${name} and trade one small hedged position a week, keeping total fees under $10 a month.`;
  if (c.includes('option')) return `Buy one small, far-dated option position on ${name} for about $${Math.max(15, Math.round(capital / 4))} and let it sit to expiry.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds in one app on that chain so the trip is not a round trip.`;
  if (c.includes('liquid staking')) return `Stake $${capital} of the chain's native asset through ${name} on ${chain} and hold the liquid receipt token in the same wallet.`;
  if (c.includes('restak')) return `Restake $${capital} of a liquid staking token through ${name} on ${chain} and keep the restaked position untouched.`;
  if (c.includes('staking')) return `Stake $${capital} of the staking asset through ${name} on ${chain} and leave the stake compounding.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into one of ${name}'s curated vaults on ${chain} and keep the vault shares in the wallet.`;
  if (c.includes('basis')) return `Open ${name}'s basis position with $${capital} of USDC on ${chain}: the spot leg and the hedge leg together, sized to stay delta-neutral.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it past one full distribution cycle.`;
  if (c.includes('stable') || c.includes('algo')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it rather than swapping straight back.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one position in an active market on ${name}, then let it settle rather than trading out.`;
  if (c.includes('launchpad')) return `Register the wallet on ${name} and take part in one sale or allocation round with about $${Math.max(25, Math.round(capital / 2))}.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for a position you actually hold, and keep the policy to expiry.`;
  if (c.includes('synthetic')) return `Mint $${capital} of a synthetic asset on ${name} against your collateral and hold the position open.`;
  if (c.includes('index')) return `Buy $${capital} of one of ${name}'s index tokens on ${chain} and hold it in the farming wallet.`;
  if (c.includes('privacy')) return `Make one shielded deposit of about $${Math.max(25, Math.round(capital / 2))} into ${name} on ${chain} and keep the note safe.`;
  if (c.includes('chain')) return `Fund the wallet on ${name} with about $${Math.max(20, Math.round(capital / 3))} of gas, then use two native apps on the chain each week.`;
  if (c.includes('leveraged farm') || c === 'farm') return `Open a conservative 2x farm position of $${capital} on ${name}'s main pool on ${chain}, well inside its liquidation buffer.`;
  if (c.includes('yield') || c.includes('liquidity manager')) return `Deposit $${capital} into ${name}'s main vault on ${chain} and keep the shares rather than rotating weekly.`;
  if (c.includes('ai')) return `Use ${name}'s agent or product surface on ${chain} with about $${Math.max(20, Math.round(capital / 3))} of activity a week, so the wallet shows real usage.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's standing risk, named in the plan so a farmer caps the right thing. */
function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('bridge')) return 'bridge contracts are the largest single point of failure in this category';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a sharp price move can liquidate a borrowed position, so keep the borrow small against the collateral';
  if (c.includes('liquid staking') || c.includes('restak') || c.includes('staking')) return 'the receipt token can trade under its redemption value, so never farm with funds you may need this month';
  if (c.includes('stable') || c.includes('algo') || c.includes('basis')) return 'the position depends on a peg or a funding rate holding, so watch both weekly and leave if either breaks';
  if (c.includes('derivative') || c.includes('option') || c.includes('leveraged')) return 'margin positions can be closed out in minutes, so size it as money you can lose outright';
  if (c.includes('rwa')) return 'redemption can be slower than the screen suggests, so treat the position as locked for a quarter';
  return 'smart-contract risk is real in every young protocol, so the wallet holds only what this one farm needs';
}

/**
 * A protocol's farm plan: five to seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, seven-day direction) and its
 * wording varies deterministically by protocol, never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const growth = finite(p.change_7d, 0);
  const gas = capital >= 150 ? 8 : 4;
  const steps: FarmStep[] = [];

  steps.push(
    pick(p, 1, [
      {
        text: `Set up a fresh wallet for ${p.name} alone, fund it from your main wallet, and keep its seed phrase offline.`,
        cost: 'under $3 of gas for the funding transaction',
        time: '5 minutes',
      },
      {
        text: `Use one dedicated wallet for ${p.name} so its activity is easy to count, and never reuse your main wallet for it.`,
        cost: 'under $3 of gas to fund it',
        time: '5 minutes',
      },
    ]),
  );

  steps.push({
    text: actionFor(p, capital, chain),
    cost: `$${capital} of capital and about $${gas} of gas`,
    time: '15 minutes to set up',
  });

  if (p.chains.length >= 3) {
    const others = p.chains.slice(1, 3).join(' and ');
    steps.push({
      text: `Repeat a smaller version of the same position on ${others}: ${p.name} records ${p.chains.length} chains, and multi-chain users are the ones a launch usually counts first.`,
      cost: `about $${Math.round(capital / 2)} more capital and $3 of bridge and gas fees`,
      time: '20 minutes',
    });
  }

  steps.push(
    growth >= 5
      ? {
          text: `Its TVL grew ${growth.toFixed(1)}% in the last seven days, so act weekly while it grows: one qualifying deposit, swap or vote every week, on the same weekday.`,
          cost: 'about $2 of gas a week',
          time: '10 minutes a week',
        }
      : growth <= -5
        ? {
            text: `Its TVL fell ${Math.abs(growth).toFixed(1)}% in the last seven days, so keep the position small and check monthly rather than adding: one qualifying action a month until the trend turns.`,
            cost: 'about $2 of gas a month',
            time: '10 minutes a month',
          }
        : {
            text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the wallet builds a steady record rather than one burst.`,
            cost: 'about $2 of gas a week',
            time: '10 minutes a week',
          },
  );

  steps.push({
    text: `Hold the position for at least ${hold} days so the activity appears in more than one weekly snapshot of the protocol.`,
    cost: `the $${capital} stays in the position`,
    time: `${hold} days`,
  });

  steps.push(
    pick(p, 2, [
      {
        text: `Open ${p.name}'s own points, rewards or governance page and register the wallet there if it offers one; claim only from links that page publishes.`,
        cost: 'no fee to check, and never pay anyone to claim',
        time: '10 minutes',
      },
      {
        text: `Check ${p.name}'s governance forum and vote on one live proposal if the wallet qualifies; a voting record is cheap evidence of a real user.`,
        cost: 'about $1 of gas to vote',
        time: '10 minutes',
      },
    ]),
  );

  steps.push({
    text: `Cap the risk: ${riskFor(p)}. Log every transaction with its date in a farm note, so the position can be unwound in one sitting.`,
    cost: 'nothing but the log',
    time: '5 minutes',
  });

  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: row.watchlist,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    category_multiples: CATEGORY_MULTIPLES,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board has ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
