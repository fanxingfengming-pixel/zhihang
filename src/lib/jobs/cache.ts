import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { JobSource, LiveJob } from "@/lib/jobs/types";

type JobRow = {
  id: string;
  source: JobSource;
  source_label: string;
  source_feed: string;
  external_id: string;
  company: string;
  role: string;
  location: string;
  employment_type: string;
  description: string;
  source_url: string;
  apply_url: string;
  published_at: string | null;
  fetched_at: string;
  expires_at: string;
  tags: string[];
  is_active: boolean;
  refresh_batch: string;
};

const SOURCES = new Set<JobSource>(["greenhouse", "lever", "ashby", "adzuna"]);

function cacheConfigured() {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

function rowToJob(row: JobRow): LiveJob | null {
  if (!SOURCES.has(row.source)) return null;
  return {
    id: row.id,
    source: row.source,
    sourceLabel: row.source_label,
    sourceFeed: row.source_feed,
    externalId: row.external_id,
    company: row.company,
    role: row.role,
    location: row.location,
    employmentType: row.employment_type,
    description: row.description,
    sourceUrl: row.source_url,
    applyUrl: row.apply_url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

export async function readJobCache(options: { includeExpired?: boolean; limit?: number } = {}) {
  if (!cacheConfigured()) return { available: false, jobs: [] as LiveJob[] };
  const supabase = createAdminClient();
  let query = supabase
    .from("job_postings")
    .select("id,source,source_label,source_feed,external_id,company,role,location,employment_type,description,source_url,apply_url,published_at,fetched_at,expires_at,tags,is_active,refresh_batch")
    .eq("is_active", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(1_000, Math.max(1, options.limit || 600)));
  if (!options.includeExpired) query = query.gt("expires_at", new Date().toISOString());
  const { data, error } = await query;
  if (error) throw new Error("岗位缓存暂时不可用");
  return {
    available: true,
    jobs: ((data || []) as JobRow[]).flatMap((row) => {
      const job = rowToJob(row);
      return job ? [job] : [];
    }),
  };
}

export async function writeJobCache(jobs: LiveJob[], successfulFeeds: Array<{ source: JobSource; sourceFeed: string }>, expiresAt: string) {
  if (!cacheConfigured() || !jobs.length) return false;
  const supabase = createAdminClient();
  const refreshBatch = crypto.randomUUID();
  const rows = jobs.map((job): JobRow => ({
    id: job.id,
    source: job.source,
    source_label: job.sourceLabel,
    source_feed: job.sourceFeed,
    external_id: job.externalId,
    company: job.company,
    role: job.role,
    location: job.location,
    employment_type: job.employmentType,
    description: job.description,
    source_url: job.sourceUrl,
    apply_url: job.applyUrl,
    published_at: job.publishedAt,
    fetched_at: job.fetchedAt,
    expires_at: expiresAt,
    tags: job.tags,
    is_active: true,
    refresh_batch: refreshBatch,
  }));

  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase.from("job_postings").upsert(rows.slice(index, index + 100), { onConflict: "id" });
    if (error) throw new Error("岗位缓存写入失败");
  }

  for (const feed of successfulFeeds) {
    const { error } = await supabase.from("job_postings")
      .update({ is_active: false })
      .eq("source", feed.source)
      .eq("source_feed", feed.sourceFeed)
      .neq("refresh_batch", refreshBatch);
    if (error) throw new Error("失效岗位标记失败");
  }
  return true;
}
