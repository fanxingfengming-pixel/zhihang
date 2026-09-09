export type JobSource = "greenhouse" | "lever" | "ashby" | "adzuna";

export type LiveJob = {
  id: string;
  source: JobSource;
  sourceLabel: string;
  sourceFeed: string;
  externalId: string;
  company: string;
  role: string;
  location: string;
  employmentType: string;
  description: string;
  sourceUrl: string;
  applyUrl: string;
  publishedAt: string | null;
  fetchedAt: string;
  tags: string[];
};

export type LiveJobsPayload = {
  jobs: LiveJob[];
  fetchedAt: string;
  cached: boolean;
  sources: Array<{ source: JobSource; label: string; count: number }>;
  warnings: string[];
};
