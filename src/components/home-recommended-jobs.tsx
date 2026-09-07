"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCareerProfile } from "@/hooks/use-career-profile";
import { getCachedJobScoresSnapshot, subscribeJobAnalysis } from "@/lib/job-analysis";
import { jobs } from "@/lib/ui-data";

const jobIds = jobs.map((job) => job.id);

export function HomeRecommendedJobs() {
  const profile = useCareerProfile();
  const getSnapshot = useCallback(() => getCachedJobScoresSnapshot(jobIds, profile.updatedAt), [profile.updatedAt]);
  const snapshot = useSyncExternalStore(subscribeJobAnalysis, getSnapshot, () => "{}");
  const scores = useMemo(() => JSON.parse(snapshot) as Record<string, number>, [snapshot]);

  return <div className="home-job-grid">
    {jobs.map((job, index) => {
      const score = scores[job.id];
      return <Link href={`/jobs?job=${job.id}`} key={job.id} className="home-job-card">
        <div className="job-card-top"><span className="company-mark">{job.initials}</span><small>0{index + 1}</small></div>
        <h3>{job.company}</h3><p>{job.role}</p>
        <div><strong>{score === undefined ? "—" : score}{score === undefined ? null : <small>%</small>}</strong><span>{score === undefined ? "进入分析" : "Agent 匹配度"}</span><ArrowRight size={17} /></div>
      </Link>;
    })}
  </div>;
}
