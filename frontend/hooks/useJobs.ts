import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acknowledgeJobStatus, listJobs, runJob, updateJobSchedule } from "../api/jobs";

export const jobsQueryKey = ["jobs"] as const;

// Unlike useRestoreStatus (polled constantly from AppShell for the whole session), this is
// only mounted while Settings' Jobs section is on screen — so it's safe (and kinder to the
// backend) to back off once nothing is running, rather than polling at a constant interval.
export function useJobsList() {
  return useQuery({
    queryKey: jobsQueryKey,
    queryFn: listJobs,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.some((job) => job.run.status === "running") ? 3000 : false),
  });
}

export function useRunJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}

// A sync page's entries were fetched once on mount, and nothing else
// invalidates them — so when its import job finishes, the table keeps showing
// the pre-import rows until a manual refresh. Watch the job's running state
// and refetch the given queries the moment it stops running (completed or
// failed — a failed import can still have written new rows). Only the
// running → not-running transition refetches: mounting mid-import, or
// mounting after it already finished, refetches nothing.
export function useInvalidateOnJobFinish(
  isRunning: boolean,
  queryKeys: readonly (readonly unknown[])[]
) {
  const queryClient = useQueryClient();
  const wasRunning = useRef(false);
  // The call sites pass inline literals, so hold the keys in a ref instead of
  // a dep — a fresh array identity every render must not re-run the effect.
  const keysRef = useRef(queryKeys);
  keysRef.current = queryKeys;
  useEffect(() => {
    if (wasRunning.current && !isRunning) {
      for (const queryKey of keysRef.current) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }
    wasRunning.current = isRunning;
  }, [isRunning, queryClient]);
}

export function useAcknowledgeJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeJobStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}

export function useUpdateJobSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, enabled, cronExpression }: { jobId: string; enabled: boolean; cronExpression: string | null }) =>
      updateJobSchedule(jobId, { enabled, cronExpression }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}
