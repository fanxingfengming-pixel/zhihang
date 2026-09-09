import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/202609070001_initial_workspace.sql", import.meta.url),
  "utf8",
).toLowerCase();

const rlsTest = readFileSync(
  new URL("../supabase/tests/user_workspaces_rls.test.sql", import.meta.url),
  "utf8",
).toLowerCase();

const syncRoute = readFileSync(
  new URL("../src/app/api/sync/route.ts", import.meta.url),
  "utf8",
).toLowerCase();

const quotaMigration = readFileSync(
  new URL("../supabase/migrations/20260908113451_ai_usage_quota.sql", import.meta.url),
  "utf8",
).toLowerCase();

const quotaTest = readFileSync(
  new URL("../supabase/tests/ai_usage_quota.test.sql", import.meta.url),
  "utf8",
).toLowerCase();

const jobCacheMigration = readFileSync(
  new URL("../supabase/migrations/20260909123919_job_postings_cache.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Supabase workspace schema", () => {
  it("keeps the public table inaccessible to anonymous users", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.user_workspaces from anon, authenticated");
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.user_workspaces to authenticated",
    );
  });

  it("defines an authenticated ownership policy for every exposed operation", () => {
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(migration).toMatch(new RegExp(`for ${operation}\\s+to authenticated`));
    }
    expect(migration).toContain("with check ((select auth.uid()) is not null");
    expect(migration).not.toMatch(/to\s+anon/);
  });

  it("guards the snapshot type at both database and application boundaries", () => {
    expect(migration).toContain("check (jsonb_typeof(snapshot) = 'object')");
    expect(rlsTest).toContain("the database rejects non-object workspace snapshots");
  });

  it("ships runnable pgTAP coverage for owner and cross-user behavior", () => {
    expect(rlsTest).toContain("set local role anon");
    expect(rlsTest).toContain("set local role authenticated");
    expect(rlsTest).toContain("another user reads no workspace rows");
    expect(rlsTest).toContain("an owner can delete their workspace");
    expect(rlsTest).toContain("select plan(15)");
  });

  it("uses optimistic concurrency instead of overwriting a newer cloud snapshot", () => {
    expect(syncRoute).toContain("expectedupdatedat");
    expect(syncRoute).toContain('.eq("updated_at", parsed.data.expectedupdatedat)');
    expect(syncRoute).toContain("status: 409");
  });

  it("provides an authenticated route for deleting the current user's cloud snapshot", () => {
    expect(syncRoute).toContain("export async function delete");
    expect(syncRoute).toContain('.delete().eq("user_id", userid)');
    expect(syncRoute).toContain("请先登录后再删除云端数据");
  });

  it("keeps shared AI quota state private and exposes only an authenticated wrapper", () => {
    expect(quotaMigration).toContain("create table if not exists private.ai_usage_quotas");
    expect(quotaMigration).toContain("security definer");
    expect(quotaMigration).toContain("set search_path = ''");
    expect(quotaMigration).toContain("revoke execute on function public.consume_ai_quota() from public, anon");
    expect(quotaMigration).toContain("grant execute on function public.consume_ai_quota() to authenticated");
    expect(quotaTest).toContain("anonymous visitors cannot consume shared ai quota");
    expect(quotaTest).toContain("another user receives an independent quota bucket");
  });

  it("keeps the live-job cache server-only and indexed for active reads", () => {
    expect(jobCacheMigration).toContain("create table if not exists public.job_postings");
    expect(jobCacheMigration).toContain("enable row level security");
    expect(jobCacheMigration).toContain("force row level security");
    expect(jobCacheMigration).toContain("revoke all on table public.job_postings from public, anon, authenticated");
    expect(jobCacheMigration).toContain("grant select, insert, update, delete on table public.job_postings to service_role");
    expect(jobCacheMigration).toContain("unique (source, source_feed, external_id)");
    expect(jobCacheMigration).toContain("where is_active");
  });
});
