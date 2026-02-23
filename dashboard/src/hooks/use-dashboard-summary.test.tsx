import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import type { DashboardSummary } from "@/types/dashboard-summary";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientTestWrapper";
  return Wrapper;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDashboardSummary", () => {
  it("fetches dashboard summary once per query cycle", async () => {
    const payload: DashboardSummary = {
      kpis: {
        activeRFQs: 1,
        awaitingQuotes: 0,
        pendingSelection: 0,
        quotedToday: 0,
        avgResponseTimeHours: null,
      },
      pipeline: [{ status: "Processing", count: 1 }],
      activity: [],
      recentRfqs: [],
    };

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/summary");
    expect(result.current.data).toEqual(payload);
  });

  it("surfaces fetch failures", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));

    const { result } = renderHook(() => useDashboardSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Failed to fetch dashboard summary");
  });
});
