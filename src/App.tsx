import { useEffect, useState } from "preact/hooks";
import Benchmarks from "./tabs/Benchmarks";
import { fetchBenchmarks } from "./api";
import { formatRelativeTime } from "./lib/format";
import type { BenchmarksTabData } from "./types";

const FETCH_TIMEOUT_MS = 30000;

export default function App() {
  const [data, setData] = useState<BenchmarksTabData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    fetchBenchmarks(30, controller.signal)
      .then((benchmarks) => {
        setData(benchmarks);
        setUpdatedAt(new Date().toISOString());
      })
      .catch((fetchError: unknown) => {
        if (didTimeout) {
          setError("Loading Orchard benchmarks timed out after 30 seconds.");
          return;
        }
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          setError("Loading Orchard benchmarks was interrupted.");
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load Orchard benchmarks.");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(218,208,175,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(74,222,128,0.12),transparent_26%)]" />
      <div className="mx-auto max-w-[1560px] px-4 py-5 lg:px-6 lg:py-6">
        <header className="mb-5 flex flex-col items-start justify-between gap-4 rounded-[1.25rem] border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_70%),rgba(18,18,18,0.92)] px-5 py-4 shadow-panel backdrop-blur md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/" className="text-[1.15rem] font-semibold tracking-[0.02em] text-accent">
                Orchard
              </a>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-strong">
                Benchmarks
              </span>
              {updatedAt ? (
                <span className="text-xs text-muted">
                  Updated {formatRelativeTime(updatedAt)}
                </span>
              ) : null}
              {loading && data ? (
                <span className="flex items-center gap-1.5 text-[0.6rem] font-medium tracking-[0.14em] text-accent uppercase">
                  <span className="inline-flex size-1.5 rounded-full bg-accent animate-pulse" />
                  Syncing
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Public performance history for The Proxy Company's local inference engine. These charts are lifted from the internal dashboard so the public page can show the same benchmark record.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <a className="nav-pill" href="https://docs.theproxycompany.com/orchard/">Docs</a>
            <a className="nav-pill" href="https://github.com/TheProxyCompany">GitHub</a>
            <a className="nav-pill" href="https://theproxycompany.com/orchard/">Company</a>
          </nav>
        </header>

        {error ? (
          <div className="rounded-[1.25rem] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-red-100">
            {error}
          </div>
        ) : data ? (
          <Benchmarks data={data} />
        ) : (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] px-5 py-12 text-center text-muted">
            Loading Orchard benchmarks...
          </div>
        )}
      </div>
    </div>
  );
}
