import type { JobSource } from "@/lib/jobs/types";

export type AtsBoardConfig = {
  source: Exclude<JobSource, "adzuna">;
  token: string;
  company: string;
};

const defaults: Record<AtsBoardConfig["source"], string> = {
  greenhouse: "anthropic|Anthropic",
  lever: "spotify|Spotify",
  ashby: "OpenAI|OpenAI",
};

const envNames: Record<AtsBoardConfig["source"], string> = {
  greenhouse: "GREENHOUSE_BOARDS",
  lever: "LEVER_SITES",
  ashby: "ASHBY_BOARDS",
};

function parseBoards(source: AtsBoardConfig["source"]) {
  const raw = process.env[envNames[source]];
  const configured = raw === undefined ? defaults[source] : raw;
  return configured.split(",").flatMap((entry) => {
    const [tokenPart, companyPart] = entry.split("|");
    const token = tokenPart?.trim() || "";
    const company = companyPart?.trim() || token;
    if (!/^[a-z0-9_-]{1,100}$/i.test(token) || !company) return [];
    return [{ source, token, company } satisfies AtsBoardConfig];
  });
}

export function liveJobsEnabled() {
  return process.env.LIVE_JOBS_ENABLED !== "false";
}

export function getAtsBoards() {
  return (["greenhouse", "lever", "ashby"] as const).flatMap(parseBoards);
}

export function getAdzunaConfig() {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  if (!appId || !appKey) return null;
  const country = process.env.ADZUNA_COUNTRY?.trim().toLowerCase() || "gb";
  if (!/^[a-z]{2}$/.test(country)) return null;
  return {
    appId,
    appKey,
    country,
    query: process.env.ADZUNA_QUERY?.trim() || "intern graduate",
  };
}

export function cacheMinutes() {
  const configured = Number(process.env.LIVE_JOBS_CACHE_MINUTES);
  return Number.isFinite(configured) ? Math.min(24 * 60, Math.max(15, configured)) : 60;
}
