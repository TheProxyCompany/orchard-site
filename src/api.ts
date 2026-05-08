import type { BenchmarksTabData, DashboardErrorResponse } from "./types";

const DEFAULT_DAYS = 30;
const DEFAULT_API_URL = "https://api.theproxycompany.com/v1/benchmarks";

function benchmarkApiUrl(days: number): string {
  const configured = import.meta.env.VITE_BENCHMARKS_API_URL as string | undefined;
  const base = configured?.trim() || DEFAULT_API_URL;
  const url = new URL(base, window.location.origin);
  url.searchParams.set("days", String(days));
  return url.toString();
}

export async function fetchBenchmarks(days = DEFAULT_DAYS, signal?: AbortSignal): Promise<BenchmarksTabData> {
  const response = await fetch(benchmarkApiUrl(days), {
    headers: { Accept: "application/json" },
    signal,
  });

  const body = (await response.json()) as BenchmarksTabData | DashboardErrorResponse;
  if (!response.ok) {
    if (typeof body === "object" && body && "error" in body) {
      throw new Error(body.error);
    }
    throw new Error(`Benchmark request failed with status ${response.status}`);
  }

  return body as BenchmarksTabData;
}
