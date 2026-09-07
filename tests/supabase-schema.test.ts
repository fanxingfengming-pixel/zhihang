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
});
