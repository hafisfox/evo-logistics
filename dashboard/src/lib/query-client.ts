import { cache } from "react";
import { QueryClient } from "@tanstack/react-query";

/**
 * Per-request QueryClient for Server Components. `cache()` ensures one instance
 * is reused across a single request so multiple prefetches share state before
 * being dehydrated into the client cache via <HydrationBoundary>.
 */
export const getServerQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10_000,
        },
      },
    })
);
