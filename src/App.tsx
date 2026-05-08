import { useEffect, useState } from "preact/hooks";
import Benchmarks from "./tabs/Benchmarks";
import { fetchBenchmarks } from "./api";
import { formatRelativeTime } from "./lib/format";
import type { BenchmarksTabData } from "./types";

const FETCH_TIMEOUT_MS = 30000;
const INSTALL_COMMANDS = [
  "pip install orchard",
  "cargo add orchard-rs",
];

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
    <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:py-12">
      <header className="site-header">
        <a href="/" className="site-mark">Orchard.md</a>
        <nav className="site-nav">
          <a href="#install">Install</a>
          <a href="#benchmarks">Benchmarks</a>
          <a href="https://docs.theproxycompany.com/orchard/">Docs</a>
          <a href="https://github.com/TheProxyCompany">GitHub</a>
        </nav>
      </header>

      <article className="document">
        <section className="prose-block hero">
          <p className="eyebrow">The Proxy Company</p>
          <h1>Orchard</h1>
          <p className="lede">
            Local inference for Apple Silicon. Run open models on your Mac with a native engine built for streaming,
            structured output, multimodal workloads, and multiple models at once.
          </p>
          <div className="command-stack" id="install" aria-label="Install Orchard">
            {INSTALL_COMMANDS.map((command) => (
              <code key={command}>{command}</code>
            ))}
          </div>
        </section>

        <section className="prose-block">
          <h2>Why care?</h2>
          <p>
            Cloud models are useful. They should not be the only way your software can think. Orchard is the local
            compute layer under Proxy: private by default, fast on Apple Silicon, and designed for real applications
            instead of toy completions.
          </p>
          <p>
            The engine combines a C++ inference runtime, custom Metal kernels, grammar-aware generation, and Python and
            Rust clients. It is built for the work developers actually need from local models: tool calling, JSON,
            visual inputs, long-running agents, and low-latency interactive loops.
          </p>
        </section>

        <section className="prose-grid">
          <div>
            <h2>Use it directly</h2>
            <p>
              Install the SDK, pick a supported open model, and call Orchard from your app or benchmark harness.
            </p>
          </div>
          <ul>
            <li>Python and Rust clients</li>
            <li>OpenAI-style responses</li>
            <li>Structured output and state-constrained decoding</li>
            <li>Apple Silicon first, with performance numbers below</li>
          </ul>
        </section>

        <section className="prose-block">
          <h2>Check the work</h2>
          <p>
            The benchmark feed below is public for the same reason the engine is public-facing: performance claims
            should be inspectable. These are captured runs from the benchmark pipeline, with hostnames stripped before
            the data leaves the API.
          </p>
          {updatedAt ? (
            <p className="muted-line">Benchmark feed updated {formatRelativeTime(updatedAt)}.</p>
          ) : null}
        </section>
      </article>

      <section id="benchmarks" className="benchmarks-shell" aria-labelledby="benchmarks-heading">
        <div className="benchmarks-heading">
          <div>
            <p className="eyebrow">Public benchmark feed</p>
            <h2 id="benchmarks-heading">Orchard Benchmarks</h2>
          </div>
          {loading && data ? (
            <span className="sync-label">
              <span />
              Syncing
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="state-box state-box--error">{error}</div>
        ) : data ? (
          <Benchmarks data={data} />
        ) : (
          <div className="state-box">Loading benchmark feed...</div>
        )}
      </section>
    </main>
  );
}
