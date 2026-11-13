import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInvalidateOnJobFinish } from "../useJobs";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

// The hook under test plus a mounted entries query in one component, so an
// invalidation turns into a real refetch the fetch counter can see.
function useProbe(isRunning: boolean, fetchEntries: () => Promise<never[]>) {
  useQuery({ queryKey: ["steam-entries"], queryFn: fetchEntries });
  useInvalidateOnJobFinish(isRunning, [["steam-entries"]]);
}

describe("useInvalidateOnJobFinish", () => {
  it("refetches the entries when the job finishes", async () => {
    const fetchEntries = vi.fn(async () => []);
    const { rerender } = renderHook(({ isRunning }) => useProbe(isRunning, fetchEntries), {
      initialProps: { isRunning: true },
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(fetchEntries).toHaveBeenCalledTimes(1));

    rerender({ isRunning: false });

    await waitFor(() => expect(fetchEntries).toHaveBeenCalledTimes(2));
  });

  it("does nothing while the job is still running", async () => {
    const fetchEntries = vi.fn(async () => []);
    const { rerender } = renderHook(({ isRunning }) => useProbe(isRunning, fetchEntries), {
      initialProps: { isRunning: true },
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(fetchEntries).toHaveBeenCalledTimes(1));

    rerender({ isRunning: true });

    await waitFor(() => expect(fetchEntries).toHaveBeenCalledTimes(1));
  });

  it("does nothing when the job was never running", async () => {
    const fetchEntries = vi.fn(async () => []);
    renderHook(({ isRunning }) => useProbe(isRunning, fetchEntries), {
      initialProps: { isRunning: false },
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(fetchEntries).toHaveBeenCalledTimes(1));
    // A spurious invalidation on mount would refetch right away — give it a
    // moment, then confirm the count never moved.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchEntries).toHaveBeenCalledTimes(1);
  });
});
