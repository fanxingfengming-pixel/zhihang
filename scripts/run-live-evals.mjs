import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", "tests/live-model-evals.test.ts"],
  {
    cwd: process.cwd(),
    env: { ...process.env, RUN_LIVE_MODEL_EVALS: "true" },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
