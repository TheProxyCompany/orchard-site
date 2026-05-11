import { useState, useEffect } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCard from "../components/ChartCard";
import { summarizeBenchmarkRun } from "../lib/analytics";
import { createBaseChartOptions, releaseMarkersPlugin, type ReleaseMarker } from "../lib/chart";
import { clamp, formatMonthDayTime, formatPercent, cx } from "../lib/format";
import type { BenchmarkAggregate, BenchmarksTabData } from "../types";

type BenchmarksProps = {
  data: BenchmarksTabData;
  days?: number;
  setDays?: (days: number) => void;
};

type ModelTarget = {
  id: string;
  family: string;
  version: string;
  size: string;
  variant?: string;
  name: string;
  shortName: string;
  color: string;
};

type PerformanceTarget = {
  id: string;
  name: string;
  color: string;
};

type TargetSummary = {
  run: BenchmarksTabData["runs"][number];
  targetName: string;
  aggregates: BenchmarkAggregate[];
  summary: ReturnType<typeof summarizeBenchmarkRun>;
};

type DeviceCoverage = {
  device: string;
  runCount: number;
  pointCount: number;
  targetCount: number;
  latestTimestamp: string;
};

const KNOWN_MODELS: Record<string, Omit<ModelTarget, "id">> = {
  "google/gemma-3-27b-it": {
    family: "Gemma",
    version: "3",
    size: "27B",
    name: "Gemma 3 27B",
    shortName: "Gemma 3 27B",
    color: "#d4a853",
  },
  "google/gemma-4-E4B-it": {
    family: "Gemma",
    version: "4",
    size: "E4B",
    name: "Gemma 4 E4B",
    shortName: "Gemma 4 E4B",
    color: "#f97316",
  },
  "google/gemma-4-26B-A4B-it": {
    family: "Gemma",
    version: "4",
    size: "26B",
    variant: "A4B",
    name: "Gemma 4 26B A4B",
    shortName: "Gemma 4 26B",
    color: "#ec4899",
  },
  "google/gemma-4-31B-it": {
    family: "Gemma",
    version: "4",
    size: "31B",
    name: "Gemma 4 31B",
    shortName: "Gemma 4 31B",
    color: "#14b8a6",
  },
  "meta-llama/Llama-3.1-8B-Instruct": {
    family: "Llama",
    version: "3.1",
    size: "8B",
    name: "Llama 3.1 8B",
    shortName: "Llama 3.1 8B",
    color: "#818cf8",
  },
  "Qwen/Qwen3.5-27B": {
    family: "Qwen",
    version: "3.5",
    size: "27B",
    name: "Qwen 3.5 27B",
    shortName: "Qwen 3.5 27B",
    color: "#8b5cf6",
  },
  "Qwen/Qwen3.6-35B-A3B": {
    family: "Qwen",
    version: "3.6",
    size: "35B",
    variant: "A3B",
    name: "Qwen 3.6 35B A3B",
    shortName: "Qwen 3.6",
    color: "#a855f7",
  },
  "Qwen/Qwen3.6-35B-A3B-Instruct": {
    family: "Qwen",
    version: "3.6",
    size: "35B",
    variant: "A3B Instruct",
    name: "Qwen 3.6 35B A3B Instruct",
    shortName: "Qwen 3.6",
    color: "#a855f7",
  },
  "Qwen/Qwen3.6-4B": {
    family: "Qwen",
    version: "3.6",
    size: "4B",
    name: "Qwen 3.6 4B",
    shortName: "Qwen 3.6 4B",
    color: "#7c3aed",
  },
  "moondream/moondream3-preview": {
    family: "Moondream",
    version: "3",
    size: "preview",
    name: "Moondream 3",
    shortName: "Moondream 3",
    color: "#4ade80",
  },
};

const AUTO_COLORS = ["#f97316", "#ec4899", "#14b8a6", "#6366f1", "#f43f5e", "#a855f7", "#06b6d4"];
const RELEASE_CHART_PLUGINS = [releaseMarkersPlugin];

const DEFAULT_MODEL_BY_FAMILY: Record<string, string> = {
  Gemma: "google/gemma-4-26B-A4B-it",
  Llama: "meta-llama/Llama-3.1-8B-Instruct",
  Qwen: "Qwen/Qwen3.6-35B-A3B",
  Moondream: "moondream/moondream3-preview",
};

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function deriveUnknownModel(id: string, autoColorIdx: number): ModelTarget {
  const tail = id.split("/").pop() ?? id;
  const family = titleCase(tail.split("-")[0] ?? tail);
  return {
    id,
    family,
    version: "unknown",
    size: "unknown",
    name: tail,
    shortName: family,
    color: AUTO_COLORS[autoColorIdx % AUTO_COLORS.length],
  };
}

function deriveModelTargets(runs: BenchmarksTabData["runs"]): ModelTarget[] {
  const seen = new Set<string>();
  for (const run of runs) {
    const name = run.metadata?.benchmark_name;
    if (typeof name !== "string") continue;
    for (const segment of name.split(" - ")) {
      const trimmed = segment.trim();
      if (trimmed.includes("/")) seen.add(trimmed);
    }
  }
  const targets: ModelTarget[] = [];
  let autoColorIdx = 0;
  for (const id of seen) {
    const known = KNOWN_MODELS[id];
    if (known) {
      targets.push({ id, ...known });
    } else {
      targets.push(deriveUnknownModel(id, autoColorIdx++));
    }
  }
  // Stable order: known models first (in KNOWN_MODELS insertion order), then unknowns alphabetically
  const knownOrder = Object.keys(KNOWN_MODELS);
  targets.sort((a, b) => {
    const ai = knownOrder.indexOf(a.id);
    const bi = knownOrder.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.id.localeCompare(b.id);
  });
  return targets;
}

function modelMatchesFilters(
  model: ModelTarget,
  filters: { family: string | null; version: string | null; size: string | null; variant: string | null },
): boolean {
  if (filters.family && model.family !== filters.family) return false;
  if (filters.version && model.version !== filters.version) return false;
  if (filters.size && model.size !== filters.size) return false;
  if (filters.variant && (model.variant ?? "Base") !== filters.variant) return false;
  return true;
}

function runHardwareMetadata(run: BenchmarksTabData["runs"][number]): Record<string, unknown> {
  const extra = run.metadata.extra_metadata;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    const hardware = (extra as Record<string, unknown>).hardware;
    if (hardware && typeof hardware === "object" && !Array.isArray(hardware)) {
      return hardware as Record<string, unknown>;
    }
  }
  const firstMetric = run.systemMetrics.find((metric) => Object.keys(metric).length > 0);
  if (firstMetric && "metrics" in firstMetric && typeof firstMetric.metrics === "object" && !Array.isArray(firstMetric.metrics)) {
    return firstMetric.metrics as Record<string, unknown>;
  }
  return firstMetric ?? {};
}

function deviceLabel(run: BenchmarksTabData["runs"][number]): string {
  const extra = run.metadata.extra_metadata;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    const label = (extra as Record<string, unknown>).device_label;
    if (typeof label === "string" && label.trim()) return normalizeDeviceLabel(label.trim());
  }

  const hardware = runHardwareMetadata(run);
  const model = typeof hardware.model_name === "string"
    ? hardware.model_name
    : typeof hardware.hardware_model === "string"
      ? hardware.hardware_model
      : null;
  const chip = typeof hardware.chip === "string"
    ? hardware.chip
    : typeof hardware.hardware_chip === "string"
      ? hardware.hardware_chip
      : null;
  if (model && chip) return normalizeDeviceLabel(`${model} ${chip}`);
  return normalizeDeviceLabel(run.device || "Unknown device");
}

function normalizeDeviceLabel(label: string): string {
  const withoutMemory = label
    .replace(/\((Apple [^,()]+),\s*\d+GB\)/, "$1")
    .replace(/,\s*\d+GB\)/, ")")
    .replace(/\s*\(([^)]+)\)/, " $1")
    .replace(/\bApple\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return withoutMemory || "Unknown device";
}

const KNOWN_PERFORMANCE_TARGETS: Record<string, Omit<PerformanceTarget, "id">> = {
  orchard_native: { name: "Orchard", color: "#d4a853" },
  llama_cpp_native: { name: "llama.cpp", color: "#818cf8" },
  mlx_native: { name: "MLX", color: "#4ade80" },
  omlx: { name: "oMLX", color: "#38bdf8" },
  aphrodite: { name: "Aphrodite", color: "#f97316" },
  vllm_metal: { name: "vLLM Metal", color: "#a78bfa" },
  vmlx_native: { name: "vMLX", color: "#f472b6" },
  ollama_native: { name: "Ollama", color: "#22c55e" },
  openrouter: { name: "OpenRouter", color: "#facc15" },
};

const PERFORMANCE_TARGET_ORDER = Object.keys(KNOWN_PERFORMANCE_TARGETS);
const AUTO_TARGET_COLORS = ["#06b6d4", "#fb7185", "#84cc16", "#c084fc", "#2dd4bf", "#f59e0b"];

const SCENARIO_ORDER = [
  "mmlu_pro",
  "bfcl",
  "ruler",
  "mt_bench_101",
  "mcp_bench",
  "json_schema_bench",
  "docvqa",
  "chartqa",
  "refcoco_m",
];

const SCENARIO_LABELS: Record<string, string> = {
  mmlu_pro: "MMLU-Pro",
  bfcl: "BFCL",
  ruler: "RULER",
  mt_bench_101: "MT-Bench-101",
  mcp_bench: "MCP-Bench",
  json_schema_bench: "JSONSchemaBench",
  docvqa: "DocVQA",
  chartqa: "ChartQA",
  refcoco_m: "RefCOCO-m",
  grid_sweep: "Grid Sweep",
};

function formatScenarioName(scenarioName: string): string {
  if (SCENARIO_LABELS[scenarioName]) {
    return SCENARIO_LABELS[scenarioName];
  }
  return scenarioName
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`))
    .join(" ");
}

function extractModelId(run: BenchmarksTabData["runs"][number], targets: ModelTarget[]): string | null {
  const benchmarkName = run.metadata?.benchmark_name;
  if (typeof benchmarkName !== "string") return null;
  for (const target of targets) {
    if (benchmarkName.includes(target.id)) return target.id;
  }
  return null;
}

function extractModel(run: BenchmarksTabData["runs"][number], targets: ModelTarget[]): ModelTarget | null {
  const id = extractModelId(run, targets);
  return id ? targets.find((target) => target.id === id) ?? null : null;
}

function representativeModels(targets: ModelTarget[], runs: BenchmarksTabData["runs"]): ModelTarget[] {
  const gridSweepModelIds = new Set(
    runs
      .filter((run) => run.scenarioName === "grid_sweep")
      .map((run) => extractModelId(run, targets))
      .filter((id): id is string => id !== null),
  );
  const byFamily = new Map<string, ModelTarget[]>();
  for (const target of targets) {
    if (!gridSweepModelIds.has(target.id)) continue;
    const familyTargets = byFamily.get(target.family) ?? [];
    familyTargets.push(target);
    byFamily.set(target.family, familyTargets);
  }

  const representatives: ModelTarget[] = [];
  for (const [family, familyTargets] of byFamily.entries()) {
    const preferredId = DEFAULT_MODEL_BY_FAMILY[family];
    representatives.push(familyTargets.find((target) => target.id === preferredId) ?? familyTargets[0]);
  }
  return representatives;
}

function formatTargetName(targetName: string): string {
  return titleCase(targetName.replace(/_native$/, "").replace(/_/g, " "));
}

function derivePerformanceTargets(targetSummaries: TargetSummary[]): PerformanceTarget[] {
  const targetIds = new Set<string>();
  for (const item of targetSummaries) {
    if (item.run.scenarioName !== "grid_sweep") continue;
    if (item.summary.throughput === null && item.summary.ttftMs === null) continue;
    targetIds.add(item.targetName);
  }

  return Array.from(targetIds)
    .sort((a, b) => {
      const ai = PERFORMANCE_TARGET_ORDER.indexOf(a);
      const bi = PERFORMANCE_TARGET_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    })
    .map((id, index) => {
      const known = KNOWN_PERFORMANCE_TARGETS[id];
      return {
        id,
        name: known?.name ?? formatTargetName(id),
        color: known?.color ?? AUTO_TARGET_COLORS[index % AUTO_TARGET_COLORS.length],
      };
    });
}

function timestampMs(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function derivePerformanceDeviceCoverage(
  targetSummaries: TargetSummary[],
  eligibleRunIds: Set<number>,
  performanceTargetIds: Set<string>,
): DeviceCoverage[] {
  const coverage = new Map<string, {
    runIds: Set<number>;
    pointCount: number;
    targetIds: Set<string>;
    latestTimestamp: string;
  }>();

  for (const item of targetSummaries) {
    if (!eligibleRunIds.has(item.run.id)) continue;
    if (item.run.scenarioName !== "grid_sweep") continue;
    if (!performanceTargetIds.has(item.targetName)) continue;
    if (item.summary.throughput === null && item.summary.ttftMs === null) continue;

    const device = deviceLabel(item.run);
    const current = coverage.get(device) ?? {
      runIds: new Set<number>(),
      pointCount: 0,
      targetIds: new Set<string>(),
      latestTimestamp: item.run.timestamp,
    };
    current.runIds.add(item.run.id);
    current.pointCount += 1;
    current.targetIds.add(item.targetName);
    if (timestampMs(item.run.timestamp) > timestampMs(current.latestTimestamp)) {
      current.latestTimestamp = item.run.timestamp;
    }
    coverage.set(device, current);
  }

  return Array.from(coverage.entries())
    .map(([device, value]) => ({
      device,
      runCount: value.runIds.size,
      pointCount: value.pointCount,
      targetCount: value.targetIds.size,
      latestTimestamp: value.latestTimestamp,
    }))
    .sort((a, b) =>
      b.targetCount - a.targetCount ||
      b.runCount - a.runCount ||
      b.pointCount - a.pointCount ||
      timestampMs(b.latestTimestamp) - timestampMs(a.latestTimestamp) ||
      a.device.localeCompare(b.device),
    );
}

function getScoreSurfaceStyle(score: number) {
  const hue = clamp(score, 0, 100) * 1.2;
  return {
    backgroundColor: `hsla(${hue}, 78%, 46%, 0.16)`,
    borderColor: `hsla(${hue}, 82%, 60%, 0.42)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px hsla(${hue}, 60%, 14%, 0.18)`,
  };
}

function getScoreValueStyle(score: number) {
  const hue = clamp(score, 0, 100) * 1.2;
  return { color: `hsla(${hue}, 90%, 80%, 1)` };
}

function releaseLabel(version: string, channel: string): string {
  return channel === "stable" ? version : `${version} ${channel}`;
}

function isStablePieRelease(release: NonNullable<BenchmarksTabData["releases"]>[number]): boolean {
  const channel = (release.channel || "stable").toLowerCase();
  return channel === "stable" && release.artifactName.startsWith("pie-v");
}

function releaseMarkersForData(data: BenchmarksTabData): ReleaseMarker[] {
  return (data.releases ?? [])
    .filter(isStablePieRelease)
    .map((release) => ({
      timestamp: release.createdAt,
      label: releaseLabel(release.version, release.channel),
      channel: release.channel,
    }));
}

function withReleaseMarkers(
  options: ChartOptions<"line">,
  timestamps: string[],
  markers: ReleaseMarker[],
  showLabels = false,
): ChartOptions<"line"> {
  if (markers.length === 0 || timestamps.length === 0) return options;
  return {
    ...options,
    plugins: {
      ...options.plugins,
      releaseMarkers: {
        markers,
        timestamps,
        showLabels,
      },
    },
  };
}

function withoutChartLegend(options: ChartOptions<"line">): ChartOptions<"line"> {
  return {
    ...options,
    plugins: {
      ...options.plugins,
      legend: {
        ...options.plugins?.legend,
        display: false,
      },
    },
  };
}

export default function Benchmarks({ data }: BenchmarksProps) {
  if (data.runs.length === 0) {
    return (
      <div className="p-8 text-center border border-white/10 rounded-2xl bg-white/[0.02]">
        <p className="text-muted">No benchmark data in this window yet.</p>
      </div>
    );
  }

  const MODEL_TARGETS = deriveModelTargets(data.runs);
  const familyOrder = ["Gemma", "Llama", "Qwen", "Moondream"];
  const modelFamilies = Array.from(new Set(MODEL_TARGETS.map((model) => model.family))).sort((a, b) => {
    const ai = familyOrder.indexOf(a);
    const bi = familyOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const chronologicalRuns = [...data.runs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const releaseMarkers = releaseMarkersForData(data);
  const releaseChartPlugins = releaseMarkers.length > 0 ? RELEASE_CHART_PLUGINS : undefined;

  const targetSummaries: TargetSummary[] = [];
  for (const run of chronologicalRuns) {
    const aggregatesByTarget = new Map<string, BenchmarkAggregate[]>();
    for (const aggregate of run.aggregates) {
      const existing = aggregatesByTarget.get(aggregate.targetName) ?? [];
      existing.push(aggregate);
      aggregatesByTarget.set(aggregate.targetName, existing);
    }
    for (const [targetName, aggregates] of aggregatesByTarget.entries()) {
      targetSummaries.push({
        run,
        targetName,
        aggregates,
        summary: summarizeBenchmarkRun({ ...run, aggregates }),
      });
    }
  }
  const performanceTargets = derivePerformanceTargets(targetSummaries);
  const performanceTargetIds = new Set(performanceTargets.map((target) => target.id));

  const qualityData = new Map<string, Map<string, { runId: number; score: number }[]>>();
  for (const item of targetSummaries) {
    if (item.summary.score !== null && MODEL_TARGETS.some((t) => t.id === item.targetName)) {
      if (!qualityData.has(item.run.scenarioName)) {
        qualityData.set(item.run.scenarioName, new Map());
      }
      const scenarioMap = qualityData.get(item.run.scenarioName)!;
      if (!scenarioMap.has(item.targetName)) {
        scenarioMap.set(item.targetName, []);
      }
      scenarioMap.get(item.targetName)!.push({ runId: item.run.id, score: item.summary.score });
    }
  }

  const qualityScenarios = Array.from(qualityData.keys()).sort((a, b) => {
    const idxA = SCENARIO_ORDER.indexOf(a);
    const idxB = SCENARIO_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return formatScenarioName(a).localeCompare(formatScenarioName(b));
  });

  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedPerformanceDevice, setSelectedPerformanceDevice] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"performance" | "quality">("performance");
  const [selectedQualityScenario, setSelectedQualityScenario] = useState<string | null>(null);
  const [selectedBatchSize, setSelectedBatchSize] = useState<number>(1);
  const [selectedPromptLength, setSelectedPromptLength] = useState<number | null>(null);

  const selectedFamilyFilters = {
    family: selectedFamily,
    version: selectedVersion,
    size: selectedSize,
    variant: selectedVariant,
  };
  const hasSpecificModelSelection = selectedFamily !== null && selectedVersion !== null && selectedSize !== null;
  const visibleModels = selectedFamily === null
    ? representativeModels(MODEL_TARGETS, chronologicalRuns)
    : MODEL_TARGETS.filter((model) => modelMatchesFilters(model, selectedFamilyFilters));
  const visibleModelIds = new Set(visibleModels.map((model) => model.id));
  const visibleRuns = chronologicalRuns.filter((run) => {
    const model = extractModel(run, MODEL_TARGETS);
    return !model || visibleModelIds.has(model.id);
  });
  const visibleRunIds = new Set(visibleRuns.map((run) => run.id));
  const performanceDeviceCoverage = derivePerformanceDeviceCoverage(targetSummaries, visibleRunIds, performanceTargetIds);
  const performanceDeviceOptions = performanceDeviceCoverage.map((item) => item.device);
  const defaultPerformanceDevice = performanceDeviceOptions[0] ?? null;
  const effectivePerformanceDevice = selectedPerformanceDevice && performanceDeviceOptions.includes(selectedPerformanceDevice)
    ? selectedPerformanceDevice
    : defaultPerformanceDevice;
  const performanceRuns = visibleRuns.filter((run) =>
    !effectivePerformanceDevice || deviceLabel(run) === effectivePerformanceDevice,
  );
  const performanceRunIds = new Set(performanceRuns.map((run) => run.id));
  const visibleOverviewRuns = performanceRuns;

  const familyModels = selectedFamily ? MODEL_TARGETS.filter((model) => model.family === selectedFamily) : MODEL_TARGETS;
  const versionOptions = Array.from(new Set(familyModels.map((model) => model.version))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sizeOptions = Array.from(new Set(familyModels.filter((model) => !selectedVersion || model.version === selectedVersion).map((model) => model.size)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const variantOptions = Array.from(new Set(familyModels
    .filter((model) => (!selectedVersion || model.version === selectedVersion) && (!selectedSize || model.size === selectedSize))
    .map((model) => model.variant ?? "Base")))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const validSelectedScenario = selectedQualityScenario && qualityScenarios.includes(selectedQualityScenario) ? selectedQualityScenario : null;

  const availableBatchSizes = new Set<number>();
  const availablePromptLengths = new Set<number>();
  for (const item of targetSummaries) {
    if (!performanceRunIds.has(item.run.id)) continue;
    if (item.run.scenarioName === "grid_sweep") {
      for (const aggregate of item.aggregates) {
        let bs: number | null = null;
        if ("batch_size" in aggregate.metrics) {
          const parsed = Number(aggregate.metrics.batch_size);
          if (!isNaN(parsed) && parsed > 0) {
            bs = parsed;
            availableBatchSizes.add(bs);
          }
        }
        if (bs === selectedBatchSize && "prompt_length" in aggregate.metrics) {
          const pl = Number(aggregate.metrics.prompt_length);
          if (!isNaN(pl) && pl > 0) availablePromptLengths.add(pl);
        }
      }
    }
  }
  const sortedBatchSizes = Array.from(availableBatchSizes).sort((a, b) => a - b);
  const sortedPromptLengths = Array.from(availablePromptLengths).sort((a, b) => a - b);

  useEffect(() => {
    if (selectedPromptLength !== null && !availablePromptLengths.has(selectedPromptLength)) {
      setSelectedPromptLength(null);
    }
  }, [selectedBatchSize, selectedPromptLength, availablePromptLengths.size]);

  useEffect(() => {
    if (selectedVersion && !versionOptions.includes(selectedVersion)) setSelectedVersion(null);
  }, [selectedFamily, selectedVersion, versionOptions.join("|")]);

  useEffect(() => {
    if (selectedSize && !sizeOptions.includes(selectedSize)) setSelectedSize(null);
  }, [selectedFamily, selectedVersion, selectedSize, sizeOptions.join("|")]);

  useEffect(() => {
    if (selectedVariant && !variantOptions.includes(selectedVariant)) setSelectedVariant(null);
  }, [selectedFamily, selectedVersion, selectedSize, selectedVariant, variantOptions.join("|")]);

  useEffect(() => {
    if (selectedPerformanceDevice && !performanceDeviceOptions.includes(selectedPerformanceDevice)) {
      setSelectedPerformanceDevice(null);
    }
  }, [selectedPerformanceDevice, performanceDeviceOptions.join("|")]);

  const renderQualityChart = () => {
    const options: ChartOptions<"line"> = createBaseChartOptions();
    if (options.scales?.y) {
      options.scales.y.min = 0;
      options.scales.y.max = 100;
    }
    const selectedLabel = selectedFamily
      ? [selectedFamily, selectedVersion, selectedSize, selectedVariant].filter(Boolean).join(" ")
      : "All Models";

    if (validSelectedScenario) {
      const scenarioRuns = visibleRuns.filter((run) => run.scenarioName === validSelectedScenario);
      const scenarioTimestamps = scenarioRuns.map((run) => run.timestamp);
      const chartData: ChartData<"line"> = {
        labels: scenarioRuns.map((run) => formatMonthDayTime(run.timestamp)),
        datasets: visibleModels.map((target) => {
          const scoresByRunId = new Map<number, number>();
          const points = qualityData.get(validSelectedScenario)?.get(target.id) ?? [];
          for (const point of points) {
            if (visibleRunIds.has(point.runId)) scoresByRunId.set(point.runId, point.score);
          }
          return {
            label: target.name,
            data: scenarioRuns.map((run) => scoresByRunId.get(run.id) ?? null),
            borderColor: target.color,
            backgroundColor: target.color,
            fill: false,
            tension: 0.28,
            spanGaps: true,
          };
        }),
      };
      const chartOptions = withReleaseMarkers(options, scenarioTimestamps, releaseMarkers, true);

      return (
        <div className="flex flex-col gap-4 h-full">
          <button
            onClick={() => setSelectedQualityScenario(null)}
            className="flex items-center gap-2 text-[0.85rem] font-medium text-muted hover:text-zinc-200 transition-colors w-fit px-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Overview
          </button>
          <ChartCard
            title={`${formatScenarioName(validSelectedScenario)} Trend`}
            subtext={`Historical scores for ${selectedLabel} on ${formatScenarioName(validSelectedScenario)}.`}
            type="line"
            data={chartData}
            options={chartOptions}
            plugins={releaseChartPlugins}
            className="flex-1"
            heightClassName="h-[24rem] lg:h-[38rem]"
          />
        </div>
      );
    }

    const scenariosWithData = qualityScenarios.filter((scenario) =>
      visibleModels.some((target) =>
        (qualityData.get(scenario)?.get(target.id) ?? []).some((point) => visibleRunIds.has(point.runId)),
      ),
    );

    return (
      <div>
        <div className="mb-6 px-1 flex flex-col gap-3">
          <div>
            <h3 className="text-[1.1rem] font-semibold text-zinc-100">{selectedLabel} Overview</h3>
            <p className="text-sm text-muted mt-1">Select a scenario below to view detailed historical performance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {visibleModels.map((target) => (
              <div key={target.id} className="flex items-center gap-2 text-[0.85rem] text-muted">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: target.color }} />
                {target.name}
              </div>
            ))}
            {releaseMarkers.length > 0 ? (
              <div className="flex items-center gap-2 text-[0.85rem] text-muted">
                <span className="w-5 border-t border-dashed" style={{ borderColor: "rgba(218, 208, 175, 0.68)" }} />
                Stable PIE releases
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {scenariosWithData.map((scenario, idx) => {
            const scenarioRuns = visibleRuns.filter((run) => run.scenarioName === scenario);
            const latestScores = visibleModels
              .map((target) => (qualityData.get(scenario)?.get(target.id) ?? [])
                .filter((point) => visibleRunIds.has(point.runId))
                .at(-1)?.score ?? null)
              .filter((score): score is number => score !== null);
            const latestScore = latestScores.length > 0
              ? latestScores.reduce((sum, score) => sum + score, 0) / latestScores.length
              : null;

            const sparklineData: ChartData<"line"> = {
              labels: scenarioRuns.map((run) => formatMonthDayTime(run.timestamp)),
              datasets: visibleModels.map((target) => {
                const scoresByRunId = new Map<number, number>();
                const points = qualityData.get(scenario)?.get(target.id) ?? [];
                for (const point of points) {
                  if (visibleRunIds.has(point.runId)) scoresByRunId.set(point.runId, point.score);
                }
                return {
                  label: target.name,
                  data: scenarioRuns.map((run) => scoresByRunId.get(run.id) ?? null),
                  borderColor: target.color,
                  backgroundColor: target.color,
                  fill: false,
                  tension: 0.28,
                  spanGaps: true,
                  pointRadius: 2,
                  pointHoverRadius: 4,
                  borderWidth: 2,
                };
              }),
            };

            const sparklineOptions: ChartOptions<"line"> = {
              ...createBaseChartOptions(),
              plugins: {
                ...createBaseChartOptions().plugins,
                legend: { display: false },
              },
              scales: {
                ...createBaseChartOptions().scales,
                y: { min: 0, max: 100 },
              },
              maintainAspectRatio: false,
            };
            const sparklineOptionsWithMarkers = withReleaseMarkers(
              sparklineOptions,
              scenarioRuns.map((run) => run.timestamp),
              releaseMarkers,
            );

            const actions = latestScore !== null ? (
              <div
                className="min-w-[3.6rem] px-2 py-1.5 rounded-lg border text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                style={getScoreSurfaceStyle(latestScore)}
              >
                <div className="text-[0.85rem] leading-none font-bold" style={getScoreValueStyle(latestScore)}>
                  {formatPercent(latestScore, 1)}
                </div>
              </div>
            ) : null;

            return (
              <div
                key={scenario}
                onClick={() => setSelectedQualityScenario(scenario)}
                className="cursor-pointer text-left outline-none group transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(255,255,255,0.06)] rounded-[1.25rem] ring-1 ring-transparent hover:ring-white/10"
              >
                <ChartCard
                  title={formatScenarioName(scenario)}
                  actions={actions}
                  type="line"
                  data={sparklineData}
                  options={sparklineOptionsWithMarkers}
                  plugins={releaseChartPlugins}
                  className="h-full bg-white/[0.015] group-hover:border-white/10 transition-colors pointer-events-none"
                  heightClassName="h-36"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const performanceData = new Map<string, Map<number, { throughput: number | null; ttft: number | null }>>();
  
  for (const item of targetSummaries) {
    if (!performanceRunIds.has(item.run.id)) continue;
    if (item.run.scenarioName === "grid_sweep" && performanceTargetIds.has(item.targetName)) {
      if (!performanceData.has(item.targetName)) {
        performanceData.set(item.targetName, new Map());
      }
      const isOverview = !hasSpecificModelSelection;
      const perfSummary = summarizeBenchmarkRun(
        { ...item.run, aggregates: item.aggregates },
        { 
          batchSize: isOverview ? 1 : selectedBatchSize,
          promptLength: isOverview ? null : selectedPromptLength,
        }
      );
      performanceData.get(item.targetName)!.set(item.run.id, {
        throughput: perfSummary.throughput,
        ttft: perfSummary.ttftMs,
      });
    }
  }

  const gridSweepRuns = performanceRuns.filter((run) => run.scenarioName === "grid_sweep");

  const perfLabels = gridSweepRuns.map((r) => formatMonthDayTime(r.timestamp));

  let throughputDatasets: ChartData<"line">["datasets"] = [];
  let ttftDatasets: ChartData<"line">["datasets"] = [];

  if (selectedFamily) {
    for (const target of performanceTargets) {
      const throughput = gridSweepRuns.map((r) => performanceData.get(target.id)?.get(r.id)?.throughput ?? null);
      const ttft = gridSweepRuns.map((r) => performanceData.get(target.id)?.get(r.id)?.ttft ?? null);
      if (!throughput.some((v) => v !== null) && !ttft.some((v) => v !== null)) continue;
      const color = target.color;
      throughputDatasets.push({
        label: target.name,
        data: throughput,
        borderColor: color,
        backgroundColor: color,
        fill: false,
        tension: 0.28,
        spanGaps: true,
      });
      ttftDatasets.push({
        label: target.name,
        data: ttft,
        borderColor: color,
        backgroundColor: color,
        fill: false,
        tension: 0.28,
        spanGaps: true,
      });
    }
  }

  const throughputData: ChartData<"line"> = {
    labels: perfLabels,
    datasets: throughputDatasets,
  };

  const ttftData: ChartData<"line"> = {
    labels: perfLabels,
    datasets: ttftDatasets,
  };

  const currentModelName = hasSpecificModelSelection
    ? [selectedFamily, selectedVersion, selectedSize, selectedVariant].filter(Boolean).join(" ")
    : selectedFamily ?? "All models";
  const gridSweepTimestamps = gridSweepRuns.map((run) => run.timestamp);
  const throughputOptions = withoutChartLegend(withReleaseMarkers(
    createBaseChartOptions(),
    gridSweepTimestamps,
    releaseMarkers,
    true,
  ));
  const ttftOptions = withoutChartLegend(withReleaseMarkers(
    createBaseChartOptions(),
    gridSweepTimestamps,
    releaseMarkers,
    true,
  ));

  const activePerformanceTargets = performanceTargets.filter((target) =>
    gridSweepRuns.some((run) => {
      const point = performanceData.get(target.id)?.get(run.id);
      return point ? point.throughput !== null || point.ttft !== null : false;
    }),
  );

  const comparisonDeviceControl = performanceDeviceOptions.length > 0 ? (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">Device</span>
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/5 bg-white/[0.025] p-0.5">
        {performanceDeviceOptions.map((device) => (
          <button
            key={device}
            onClick={() => setSelectedPerformanceDevice(device)}
            className={cx(
              "shrink-0 px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all whitespace-nowrap",
              effectivePerformanceDevice === device
                ? "bg-white/10 text-white shadow-sm"
                : "text-muted hover:text-zinc-300 hover:bg-white/5",
            )}
          >
            {device}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  const engineLegend = (targets: PerformanceTarget[]) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {targets.map((engine) => (
        <div key={engine.id} className="flex items-center gap-2 text-[0.78rem] text-muted">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: engine.color }} />
          {engine.name}
        </div>
      ))}
      {releaseMarkers.length > 0 ? (
        <div className="flex items-center gap-2 text-[0.78rem] text-muted">
          <span className="w-5 border-t border-dashed" style={{ borderColor: "rgba(218, 208, 175, 0.68)" }} />
          Stable PIE releases
        </div>
      ) : null}
    </div>
  );

  const filterActions = (
    <div className="flex flex-wrap items-center justify-center gap-4 mt-4 px-1">
      {selectedFamily && versionOptions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-muted font-medium">Version</span>
          <div className="flex p-0.5 bg-white/[0.02] border border-white/5 rounded-lg">
            <button
              onClick={() => setSelectedVersion(null)}
              className={cx(
                "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                selectedVersion === null
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted hover:text-zinc-300 hover:bg-white/5",
              )}
            >
              All
            </button>
            {versionOptions.map((version) => (
              <button
                key={version}
                onClick={() => {
                  setSelectedVersion(version);
                  setSelectedSize(null);
                  setSelectedVariant(null);
                }}
                className={cx(
                  "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                  selectedVersion === version
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-muted hover:text-zinc-300 hover:bg-white/5",
                )}
              >
                {version}
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedFamily && sizeOptions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-muted font-medium">Size</span>
          <div className="flex p-0.5 bg-white/[0.02] border border-white/5 rounded-lg">
            <button
              onClick={() => {
                setSelectedSize(null);
                setSelectedVariant(null);
              }}
              className={cx(
                "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                selectedSize === null
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted hover:text-zinc-300 hover:bg-white/5",
              )}
            >
              All
            </button>
            {sizeOptions.map((size) => (
              <button
                key={size}
                onClick={() => {
                  setSelectedSize(size);
                  setSelectedVariant(null);
                }}
                className={cx(
                  "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                  selectedSize === size
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-muted hover:text-zinc-300 hover:bg-white/5",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedFamily && variantOptions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-muted font-medium">Variant</span>
          <div className="flex p-0.5 bg-white/[0.02] border border-white/5 rounded-lg">
            <button
              onClick={() => setSelectedVariant(null)}
              className={cx(
                "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                selectedVariant === null
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted hover:text-zinc-300 hover:bg-white/5",
              )}
            >
              All
            </button>
            {variantOptions.map((variant) => (
              <button
                key={variant}
                onClick={() => setSelectedVariant(variant)}
                className={cx(
                  "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                  selectedVariant === variant
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-muted hover:text-zinc-300 hover:bg-white/5",
                )}
              >
                {variant}
              </button>
            ))}
          </div>
        </div>
      )}
      {sortedBatchSizes.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-muted font-medium">Batch</span>
          <div className="flex p-0.5 bg-white/[0.02] border border-white/5 rounded-lg">
            {sortedBatchSizes.map((bs) => (
              <button
                key={bs}
                onClick={() => setSelectedBatchSize(bs)}
                className={cx(
                  "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                  selectedBatchSize === bs
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-muted hover:text-zinc-300 hover:bg-white/5",
                )}
              >
                {bs}
              </button>
            ))}
          </div>
        </div>
      )}
      {sortedPromptLengths.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-muted font-medium">Prompt</span>
          <div className="flex p-0.5 bg-white/[0.02] border border-white/5 rounded-lg">
            <button
              onClick={() => setSelectedPromptLength(null)}
              className={cx(
                "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                selectedPromptLength === null
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted hover:text-zinc-300 hover:bg-white/5",
              )}
            >
              All
            </button>
            {sortedPromptLengths.map((pl) => (
              <button
                key={pl}
                onClick={() => setSelectedPromptLength(pl)}
                className={cx(
                  "px-2.5 py-1 text-[0.75rem] font-medium rounded-[0.35rem] transition-all",
                  selectedPromptLength === pl
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-muted hover:text-zinc-300 hover:bg-white/5",
                )}
              >
                {pl}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-12">
      <section>
        <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-xl w-fit mb-8">
          {[null, ...modelFamilies].map((family) => (
            <button
              key={family || "all"}
              onClick={() => {
                setSelectedFamily(family);
                setSelectedVersion(null);
                setSelectedSize(null);
                setSelectedVariant(null);
                setSelectedQualityScenario(null);
              }}
              className={cx(
                "px-5 py-2 text-[0.85rem] font-medium rounded-[0.5rem] transition-all min-w-[6rem]",
                selectedFamily === family
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              {family ?? "All"}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-[220px] shrink-0">
            <div className="flex flex-col border border-white/5 rounded-xl bg-white/[0.02] overflow-hidden">
              <button
                onClick={() => setSelectedMode("performance")}
                className={cx(
                  "flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  selectedMode === "performance"
                    ? "bg-white/5 text-accent"
                    : "text-muted hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div className="font-medium text-[0.85rem]">Performance</div>
              </button>
              
              <div className="h-px bg-white/5" />
              
              <button
                onClick={() => setSelectedMode("quality")}
                className={cx(
                  "flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  selectedMode === "quality"
                    ? "bg-white/5 text-accent"
                    : "text-muted hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <div className="font-medium text-[0.85rem]">Quality</div>
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {selectedMode === "performance" ? (
              !hasSpecificModelSelection ? (
                <div>
                  <div className="mb-6 px-1 flex flex-col gap-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <h3 className="text-[1.1rem] font-semibold text-zinc-100">
                          {selectedFamily ? `${selectedFamily} Performance` : "All Models Performance"}
                        </h3>
                        <p className="text-sm text-muted mt-1">Select a model below to view detailed engine comparison.</p>
                      </div>
                      {comparisonDeviceControl}
                    </div>
                    {engineLegend(activePerformanceTargets)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {visibleModels.map((model) => {
                      const modelGridSweepRuns = visibleOverviewRuns.filter((run) =>
                        run.scenarioName === "grid_sweep" && extractModelId(run, MODEL_TARGETS) === model.id
                      );
                      if (modelGridSweepRuns.length === 0) return null;

                      const sparkLabels = modelGridSweepRuns.map(r => formatMonthDayTime(r.timestamp));
                      const sparkTimestamps = modelGridSweepRuns.map(r => r.timestamp);

                      const sparklineData: ChartData<"line"> = {
                        labels: sparkLabels,
                        datasets: performanceTargets.map((engine) => ({
                          label: engine.name,
                          data: modelGridSweepRuns.map(r => performanceData.get(engine.id)?.get(r.id)?.throughput ?? null),
                          borderColor: engine.color,
                          backgroundColor: engine.color,
                          fill: false,
                          tension: 0.28,
                          spanGaps: true,
                          pointRadius: 2,
                          pointHoverRadius: 4,
                          borderWidth: 2,
                        })),
                      };

                      const sparklineOptions: ChartOptions<"line"> = {
                        ...createBaseChartOptions(),
                        plugins: {
                          ...createBaseChartOptions().plugins,
                          legend: { display: false },
                        },
                        scales: {
                          ...createBaseChartOptions().scales,
                          y: { min: 0 },
                        },
                        maintainAspectRatio: false,
                      };
                      const sparklineOptionsWithMarkers = withReleaseMarkers(
                        sparklineOptions,
                        sparkTimestamps,
                        releaseMarkers,
                      );

                      return (
                        <div
                          key={model.id}
                          onClick={() => {
                            setSelectedFamily(model.family);
                            setSelectedVersion(model.version);
                            setSelectedSize(model.size);
                            setSelectedVariant(model.variant ?? "Base");
                            setSelectedQualityScenario(null);
                          }}
                          className="cursor-pointer text-left outline-none group transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(255,255,255,0.06)] rounded-[1.25rem] ring-1 ring-transparent hover:ring-white/10"
                        >
                          <ChartCard
                            title={model.name}
                            subtext="Throughput (tok/s) · Batch 1"
                            type="line"
                            data={sparklineData}
                            options={sparklineOptionsWithMarkers}
                            plugins={releaseChartPlugins}
                            className="h-full bg-white/[0.015] group-hover:border-white/10 transition-colors pointer-events-none"
                            heightClassName="h-36"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 h-full">
                  <button
                    onClick={() => {
                      setSelectedVersion(null);
                      setSelectedSize(null);
                      setSelectedVariant(null);
                    }}
                    className="flex items-center gap-2 text-[0.85rem] font-medium text-muted hover:text-zinc-200 transition-colors w-fit px-1 mb-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Overview
                  </button>
                  {gridSweepRuns.length === 0 ? (
                    <div className="p-8 text-center border border-white/10 rounded-2xl bg-white/[0.02]">
                      <p className="text-muted">No grid sweep performance data was found for this model.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-3 rounded-lg border border-white/5 bg-white/[0.018] px-3 py-3 lg:flex-row lg:items-start lg:justify-between">
                        {comparisonDeviceControl}
                        {engineLegend(activePerformanceTargets)}
                      </div>
                      <div className="grid gap-6 xl:grid-cols-2 flex-1">
                        <ChartCard
                          title="Throughput"
                          subtext={`Tokens per second over time. ${currentModelName}. Higher is better.`}
                          type="line"
                          data={throughputData}
                          options={throughputOptions}
                          plugins={releaseChartPlugins}
                        />
                        <ChartCard
                          title="Time to First Token"
                          subtext={`TTFT in milliseconds. ${currentModelName}. Lower is better.`}
                          type="line"
                          data={ttftData}
                          options={ttftOptions}
                          plugins={releaseChartPlugins}
                        />
                      </div>
                      {filterActions}
                    </>
                  )}
                </div>
              )
            ) : (
              <div>
                {qualityScenarios.length === 0 ? (
                  <div className="p-8 text-center border border-white/10 rounded-2xl bg-white/[0.02]">
                    <p className="text-muted">No score-based benchmark scenarios found in this window.</p>
                  </div>
                ) : (
                  renderQualityChart()
                )}
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
