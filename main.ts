// Token launch radar — program entrypoint.
//
// The radar reads the sealed snapshot of protocol records, scores every
// protocol with the value model in lib/model.ts, and publishes the run
// into the output directory:
//
//   board.json    the ranked board as one JSON object with a rows array
//   data.js       the same figures as a script the dashboard page loads
//   dashboard/    a copy of the entry's dashboard source
//   screenshots/  a copy of the entry's screenshots
//   dossier.json  the judge's dossier, built by vendor/makefun-board.ts
//
// The output directory is $MAKEFUN_OUTPUT_DIR when set, else /output.
// The snapshot path comes from --input when given, else /input/snapshot.json.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { boardIssue, buildRadar, dataScript, parseSnapshot } from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

const here = dirname(fileURLToPath(import.meta.url));

function argumentValue(flag: string): string | null {
  const at = process.argv.indexOf(flag);
  if (at < 0 || at + 1 >= process.argv.length) return null;
  return process.argv[at + 1];
}

function copyDirectory(name: string, target: string): number {
  const into = join(target, name);
  mkdirSync(into, { recursive: true });
  let copied = 0;
  for (const entry of readdirSync(join(here, name), { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    copyFileSync(join(here, name, entry.name), join(into, entry.name));
    copied += 1;
  }
  return copied;
}

function main(): void {
  const inputPath = argumentValue("--input") ?? "/input/snapshot.json";
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outputDir, { recursive: true });

  let snapshotText: string;
  try {
    snapshotText = readFileSync(inputPath, "utf8");
  } catch {
    throw new Error(`could not read the snapshot at ${inputPath}`);
  }
  const snapshot = parseSnapshot(snapshotText);
  const { board, radar } = buildRadar(snapshot);

  const problem = boardIssue(board, snapshot);
  if (problem !== null) {
    throw new Error(`the board failed its own check: ${problem}`);
  }

  writeFileSync(join(outputDir, "board.json"), JSON.stringify({ rows: board }) + "\n");
  writeFileSync(join(outputDir, "data.js"), dataScript(radar));

  const pageFiles = copyDirectory("dashboard", outputDir);
  const shotFiles = copyDirectory("screenshots", outputDir);

  const dossier = buildDossier(outputDir, { text_max_bytes: 65536 });
  writeFileSync(join(outputDir, "dossier.json"), dossier);

  const early = board.filter((row) => !row.watchlist).length;
  console.log(
    `radar: ${snapshot.protocols.length} protocols in the snapshot, ` +
      `${snapshot.watchlist.length} on the watchlist, ${board.length} rows on the board ` +
      `(${early} of them early finds below the floor)`,
  );
  console.log(
    `radar: output in ${outputDir} — board.json, data.js, ` +
      `dashboard (${pageFiles} files), screenshots (${shotFiles} files), dossier.json`,
  );
}

main();
