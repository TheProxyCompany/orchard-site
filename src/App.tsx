import { useEffect, useState } from "preact/hooks";
import Benchmarks from "./tabs/Benchmarks";
import { fetchBenchmarks } from "./api";
import { formatRelativeTime } from "./lib/format";
import type { BenchmarksTabData } from "./types";

const FETCH_TIMEOUT_MS = 30000;
const DOCS_URL = "https://docs.theproxycompany.com/orchard/";
const GETTING_STARTED_URL = DOCS_URL;
const PYTHON_URL = "https://pypi.org/project/orchard/";
const RUST_URL = "https://crates.io/crates/orchard-rs";

const PACKAGE_TRACKS = [
  {
    label: "Python",
    title: "Standalone Python package",
    body:
      "Best for Python services, notebooks, automations, and evaluation jobs. Use the client directly, or run the optional OpenAI-compatible server when another process needs HTTP.",
    primaryHref: GETTING_STARTED_URL,
    primaryLabel: "Getting started",
    href: PYTHON_URL,
    hrefLabel: "PyPI",
  },
  {
    label: "Rust",
    title: "Embedded Rust library",
    body:
      "Best for Rust products that need to own the engine lifecycle, keep models warm, stream tokens over local IPC, and expose app-specific inference APIs.",
    primaryHref: GETTING_STARTED_URL,
    primaryLabel: "Getting started",
    href: RUST_URL,
    hrefLabel: "Crates.io",
  },
];

const VALUE_PROPS = [
  {
    label: "Private by design",
    title: "Keep inference inside your environment",
    body:
      "Run models on Apple Silicon you control. Prompts, files, tool results, and outputs do not need to pass through a hosted model API.",
  },
  {
    label: "On-premise ready",
    title: "A practical path for sensitive deployments",
    body:
      "Orchard is built for teams that need local AI near private data, internal systems, regulated workflows, or customer-owned hardware.",
  },
  {
    label: "Production serving",
    title: "Built for more than demos",
    body:
      "Keep models warm, serve concurrent work, stream responses, and compare release performance with public benchmark traces.",
  },
  {
    label: "Application contracts",
    title: "Make local models useful in products",
    body:
      "Structured output, tool calling, reasoning controls, and multimodal inputs make Orchard useful for agents and real workflows.",
  },
];

const DIFFERENTIATORS = [
  {
    title: "Custom Apple Silicon kernels",
    body:
      "Orchard uses custom Metal kernels and a local runtime tuned for Apple GPUs, so private inference can stay fast enough for interactive products and high-throughput jobs.",
  },
  {
    title: "Continuous batching",
    body:
      "Concurrent prompts can move through one warm engine process, improving throughput without making every application team manage scheduler details.",
  },
  {
    title: "Multiple loaded models",
    body:
      "Text, vision, and specialist models can stay available together, which matters when one product workflow needs several model capabilities.",
  },
  {
    title: "Improved structured output",
    body:
      "JSON schema and state-constrained generation help local models return data that applications can validate and act on.",
  },
  {
    title: "Tool calling and reasoning",
    body:
      "Tool schemas, function calls, and model-dependent reasoning levels give local agents a clearer contract with the software around them.",
  },
  {
    title: "Multimodal support",
    body:
      "Vision-capable models use the same Orchard surface as text models, so teams can build private document, image, and screen-understanding workflows.",
  },
];

const USE_CASES = [
  {
    title: "On-prem assistants",
    body: "Run copilots and agents next to private tools, documents, and databases without moving prompts into cloud inference.",
  },
  {
    title: "Private document workflows",
    body: "Analyze sensitive PDFs, screenshots, support records, and operational data on local hardware.",
  },
  {
    title: "Local product features",
    body: "Add low-latency summarization, extraction, reasoning, and visual understanding to Mac-first products.",
  },
  {
    title: "Evaluation and regression tracking",
    body: "Use the same runtime in benchmark harnesses and production loops, then inspect performance across releases.",
  },
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
    <main className="site-shell">
      <header className="site-header">
        <a href="/" className="site-mark">Orchard.md</a>
        <nav className="site-nav" aria-label="Primary">
          <a href="#value">Why Orchard</a>
          <a href="#platform">Platform</a>
          <a href="#benchmarks">Benchmarks</a>
          <a href={DOCS_URL}>Docs</a>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-heading">
        <img
          className="hero-image"
          src="https://proxy.ing/images/orchard.webp"
          alt="The Apple Gathering by Jerome Thompson"
        />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">Local inference for Apple Silicon</p>
          <h1 id="hero-heading">Orchard</h1>
          <p className="tagline">Every Apple needs an Orchard.</p>
          <p className="lede">
            Private, on-premise inference for teams that need useful local AI without
            moving sensitive data into a hosted model API. Orchard pairs custom Apple
            Silicon kernels with production serving features for structured,
            tool-using, multimodal applications.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={GETTING_STARTED_URL}>Getting started</a>
            <a className="button button-secondary" href={DOCS_URL}>Read docs</a>
            <a className="button button-secondary" href="#benchmarks">View benchmarks</a>
          </div>
        </div>
        <p className="image-credit">The Apple Gathering, Jerome Thompson</p>
      </section>

      <article className="document">
        <section id="value" className="section value-section" aria-labelledby="value-heading">
          <div className="section-heading">
            <p className="eyebrow">Value proposition</p>
            <h2 id="value-heading">Private inference your team can actually deploy</h2>
            <p>
              Orchard is for organizations that want the capability of modern open
              models without making every prompt, document, or tool result leave their
              own environment.
            </p>
          </div>

          <div className="value-grid">
            {VALUE_PROPS.map((item) => (
              <article key={item.title} className="value-card">
                <p className="card-label">{item.label}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="platform" className="section package-section" aria-labelledby="platform-heading">
          <div className="section-heading">
            <p className="eyebrow">Adoption paths</p>
            <h2 id="platform-heading">A local engine for Python teams and Rust products</h2>
            <p>
              Use Orchard as a standalone Python package, embed it in Rust applications,
              or expose the OpenAI-compatible server when existing software needs HTTP.
            </p>
          </div>

          <div className="package-grid">
            {PACKAGE_TRACKS.map((track) => (
              <article key={track.label} className="package-card">
                <p className="card-label">{track.label}</p>
                <h3>{track.title}</h3>
                <p>{track.body}</p>
                <div className="card-actions">
                  <a href={track.primaryHref}>{track.primaryLabel}</a>
                  <a href={track.href}>{track.hrefLabel}</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section capability-section" aria-labelledby="capabilities-heading">
          <div className="section-heading">
            <p className="eyebrow">What makes it different</p>
            <h2 id="capabilities-heading">The pieces teams normally miss in local inference</h2>
            <p>
              Orchard packages the low-level runtime work and the application-level
              contracts together, so local models can become dependable product
              infrastructure.
            </p>
          </div>
          <div className="capability-list">
            {DIFFERENTIATORS.map((item) => (
              <article key={item.title} className="capability-row">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section use-case-section" aria-labelledby="use-case-heading">
          <div className="section-heading">
            <p className="eyebrow">Where it fits</p>
            <h2 id="use-case-heading">For teams that need local AI to be operational</h2>
            <p>
              Orchard is strongest when privacy, latency, throughput, and application
              contracts all matter at the same time.
            </p>
          </div>

          <div className="use-case-grid">
            {USE_CASES.map((item) => (
              <article key={item.title} className="use-case-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section benchmark-intro" aria-labelledby="benchmark-intro-heading">
          <div className="section-heading">
            <p className="eyebrow">Public benchmark feed</p>
            <h2 id="benchmark-intro-heading">Performance claims should be inspectable</h2>
            <p>
              The charts below come from captured benchmark runs. Device filters keep
              engine comparisons honest, and stable PIE release markers make regressions
              easier to spot.
            </p>
            {updatedAt ? (
              <p className="muted-line">Benchmark feed updated {formatRelativeTime(updatedAt)}.</p>
            ) : null}
          </div>
        </section>
      </article>

      <section id="benchmarks" className="benchmarks-shell" aria-labelledby="benchmarks-heading">
        <div className="benchmarks-heading">
          <div>
            <p className="eyebrow">Live data</p>
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
