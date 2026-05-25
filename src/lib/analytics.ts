import type {
  BalanceHistorySummary,
  BenchmarkRun,
  CIRepoResult,
  CIStatusSummary,
  DailyBalanceSnapshot,
  GitHubWorkflowRun,
  HomeMetricDelta,
  InfraTunnel,
  InfraWorkerInvocation,
  InfraWorkerSnapshot,
  TwitterTweet,
} from "../types";

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseMetricNumber(value: unknown): number | null {
  const parsed = Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMetricNumber(
  metrics: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = parseMetricNumber(metrics[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function buildDelta(
  currentValue: number | null,
  previousValue: number | null,
  days: number,
  options: {
    precision?: number;
    toneMode?: "standard" | "inverse" | "neutral";
  } = {},
): HomeMetricDelta | null {
  if (currentValue === null || previousValue === null) {
    return null;
  }

  const precision = options.precision ?? 0;
  const toneMode = options.toneMode ?? "standard";
  const increaseTone = toneMode === "inverse" ? "negative" : "positive";
  const decreaseTone = toneMode === "inverse" ? "positive" : "negative";

  if (previousValue === 0) {
    if (currentValue === 0) {
      return { text: `→0% vs prev ${days}d`, tone: "neutral" };
    }

    return {
      text: `↑new vs prev ${days}d`,
      tone: toneMode === "neutral" ? "neutral" : increaseTone,
    };
  }

  const changePercent = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  if (Math.abs(changePercent) < 0.05) {
    return { text: `→0% vs prev ${days}d`, tone: "neutral" };
  }

  return {
    text: `${changePercent > 0 ? "↑" : "↓"}${Math.abs(changePercent).toFixed(precision)}% vs prev ${days}d`,
    tone:
      toneMode === "neutral"
        ? "neutral"
        : changePercent > 0
          ? increaseTone
          : decreaseTone,
  };
}

export function summarizeBenchmarkRun(
  run: BenchmarkRun,
  options?: {
    batchSize?: number | null;
    promptLength?: number | null;
    maxPromptLength?: number | null;
  },
): {
  score: number | null;
  throughput: number | null;
  ttftMs: number | null;
} {
  const scoreValues: number[] = [];
  const throughputValues: number[] = [];
  const ttftValues: number[] = [];

  for (const aggregate of run.aggregates) {
    if (options?.batchSize !== undefined && options.batchSize !== null) {
      const bs = firstMetricNumber(aggregate.metrics, ["batch_size"]);
      if (bs !== null && bs !== options.batchSize) continue;
    }

    const pl = firstMetricNumber(aggregate.metrics, ["prompt_length"]);
    if (options?.promptLength !== undefined && options.promptLength !== null) {
      if (pl !== null && pl !== options.promptLength) continue;
    } else if (options?.maxPromptLength !== undefined && options.maxPromptLength !== null) {
      if (pl !== null && pl > options.maxPromptLength) continue;
    }

    const score = firstMetricNumber(aggregate.metrics, ["score"]);
    const throughput = firstMetricNumber(aggregate.metrics, [
      "tok_per_sec_avg",
      "tokens_per_second",
      "tok_per_sec",
    ]);
    const ttftMs = firstMetricNumber(aggregate.metrics, ["ttft_avg_ms", "ttft_ms"]);
    const ttftSeconds = firstMetricNumber(aggregate.metrics, ["ttft_avg_s", "ttft_s"]);

    if (score !== null) {
      scoreValues.push(score);
    }

    if (throughput !== null) {
      throughputValues.push(throughput);
    }

    if (ttftMs !== null) {
      ttftValues.push(ttftMs);
    } else if (ttftSeconds !== null) {
      ttftValues.push(ttftSeconds * 1000);
    }
  }

  return {
    score: average(scoreValues),
    throughput: average(throughputValues),
    ttftMs: average(ttftValues),
  };
}

export function ciRunStatusTone(run: GitHubWorkflowRun): string {
  const status = run.status.toLowerCase();
  const conclusion = run.conclusion.toLowerCase();

  if (
    status === "queued" ||
    status === "in_progress" ||
    status === "pending" ||
    status === "requested" ||
    status === "waiting"
  ) {
    return "running";
  }

  if (conclusion === "success") {
    return "success";
  }

  if (
    conclusion === "failure" ||
    conclusion === "cancelled" ||
    conclusion === "timed_out" ||
    conclusion === "action_required" ||
    conclusion === "startup_failure"
  ) {
    return "failed";
  }

  return "unknown";
}

export function ciRunStatusLabel(run: GitHubWorkflowRun): string {
  return run.status.toLowerCase() === "completed"
    ? run.conclusion || "completed"
    : run.status || "unknown";
}

export function deploymentStatusTone(state: string): string {
  const s = state.toLowerCase();
  if (s === "success") return "success";
  if (s === "failure" || s === "error") return "failed";
  if (s === "pending" || s === "in_progress" || s === "queued" || s === "waiting") return "running";
  return "unknown";
}

export function ciRepoStatusTone(repoResult: CIRepoResult | undefined): string {
  if (!repoResult || repoResult.unavailable) {
    return "unknown";
  }

  if (repoResult.runs[0]) return ciRunStatusTone(repoResult.runs[0]);
  // No GH Actions: fall back to most recent Vercel/CF Pages deployment.
  if (repoResult.latestDeployment) {
    return deploymentStatusTone(repoResult.latestDeployment.state);
  }
  return "unknown";
}

export function summarizeCIResults(repoResults: CIRepoResult[]): CIStatusSummary {
  const summary: CIStatusSummary = {
    passing: 0,
    failing: 0,
    running: 0,
    unknown: 0,
    total: repoResults.length,
  };

  for (const repoResult of repoResults) {
    const tone = ciRepoStatusTone(repoResult);
    if (tone === "success") {
      summary.passing += 1;
    } else if (tone === "failed") {
      summary.failing += 1;
    } else if (tone === "running") {
      summary.running += 1;
    } else {
      summary.unknown += 1;
    }
  }

  return summary;
}

export function sumCIRepoStars(repoResults: CIRepoResult[]): number | null {
  const values = repoResults
    .map((repoResult) => repoResult.stars)
    .filter((value): value is number => value !== null);

  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

export function ciRepoFailureAgeMs(
  repoResult: CIRepoResult | undefined,
  nowMs = Date.now(),
): number | null {
  if (!repoResult || ciRepoStatusTone(repoResult) !== "failed") {
    return null;
  }

  if (repoResult.lastGreenAt) {
    const timestamp = new Date(repoResult.lastGreenAt).getTime();
    return Number.isFinite(timestamp) ? Math.max(0, nowMs - timestamp) : null;
  }

  const oldestRun = repoResult.runs[repoResult.runs.length - 1];
  if (!oldestRun) {
    return null;
  }

  const timestamp = new Date(oldestRun.updatedAt || oldestRun.createdAt).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, nowMs - timestamp) : null;
}

export function ciRepoIsFailingOver24h(repoResult: CIRepoResult | undefined): boolean {
  const age = ciRepoFailureAgeMs(repoResult);
  return age !== null && age > 86400000;
}

export function emptyInfraWorkerSnapshot(): InfraWorkerSnapshot {
  return {
    totalRequests: 0,
    totalErrors: 0,
    errorRatePercent: 0,
    activeWorkers: 0,
    workers: [],
    daily: [],
  };
}

export function summarizeInfraWorkerInvocations(
  invocations: InfraWorkerInvocation[],
): InfraWorkerSnapshot {
  if (invocations.length === 0) {
    return emptyInfraWorkerSnapshot();
  }

  const workers = new Map<string, InfraWorkerSnapshot["workers"][number]>();
  const daily = new Map<string, InfraWorkerSnapshot["daily"][number]>();
  let totalRequests = 0;
  let totalErrors = 0;

  for (const invocation of invocations) {
    totalRequests += invocation.requests;
    totalErrors += invocation.errors;

    const worker = workers.get(invocation.scriptName) ?? {
      scriptName: invocation.scriptName,
      requests: 0,
      errors: 0,
      subrequests: 0,
    };

    worker.requests += invocation.requests;
    worker.errors += invocation.errors;
    worker.subrequests += invocation.subrequests;
    workers.set(invocation.scriptName, worker);

    const day = daily.get(invocation.date) ?? {
      date: invocation.date,
      requests: 0,
      errors: 0,
    };

    day.requests += invocation.requests;
    day.errors += invocation.errors;
    daily.set(invocation.date, day);
  }

  return {
    totalRequests,
    totalErrors,
    errorRatePercent: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
    activeWorkers: Array.from(workers.values()).filter((worker) => worker.requests > 0).length,
    workers: Array.from(workers.values()).sort((left, right) => right.requests - left.requests),
    daily: Array.from(daily.values()).sort((left, right) => left.date.localeCompare(right.date)),
  };
}

export function isActiveTunnelStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "active" || normalized === "connected" || normalized === "up";
}

export function tunnelStatusTone(status: string): string {
  return isActiveTunnelStatus(status) ? "success" : "unknown";
}

export function sumPlaidBalances(accounts: Array<{ currentBalance: number | null }>): number {
  return accounts.reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
}

export function summarizeBalanceSnapshots(
  snapshots: DailyBalanceSnapshot[],
  currentBalanceOverride: number | null = null,
): BalanceHistorySummary {
  const latestSnapshot = snapshots[snapshots.length - 1] ?? null;
  const latestBalance =
    currentBalanceOverride ??
    (latestSnapshot ? latestSnapshot.totalBalanceCents / 100 : null);

  if (snapshots.length < 2 || latestSnapshot === null) {
    return {
      latestBalance,
      monthlyBurnRate: null,
      runwayMonths: null,
    };
  }

  const oldestSnapshot = snapshots[0];
  const oldestDayMs = new Date(`${oldestSnapshot.day}T00:00:00Z`).getTime();
  const latestDayMs = new Date(`${latestSnapshot.day}T00:00:00Z`).getTime();
  const elapsedMonths = (latestDayMs - oldestDayMs) / (86400000 * 30.4375);

  if (!Number.isFinite(elapsedMonths) || elapsedMonths <= 0) {
    return {
      latestBalance,
      monthlyBurnRate: null,
      runwayMonths: null,
    };
  }

  const oldestBalance = oldestSnapshot.totalBalanceCents / 100;
  const latestHistoryBalance = latestSnapshot.totalBalanceCents / 100;
  const monthlyBurnRate = (oldestBalance - latestHistoryBalance) / elapsedMonths;
  const normalizedBurnRate = monthlyBurnRate > 0 ? monthlyBurnRate : null;

  return {
    latestBalance,
    monthlyBurnRate: normalizedBurnRate,
    runwayMonths:
      latestBalance !== null && normalizedBurnRate !== null && normalizedBurnRate > 0
        ? latestBalance / normalizedBurnRate
        : null,
  };
}

export function calculateTweetEngagementRate(tweet: TwitterTweet): number | null {
  if (tweet.impressions <= 0) {
    return null;
  }

  return ((tweet.likes + tweet.retweets + tweet.replies) / tweet.impressions) * 100;
}

export function summarizeAverageEngagementRate(
  tweetsByUser: Record<string, TwitterTweet[]>,
): number | null {
  const rates = Object.values(tweetsByUser)
    .flat()
    .map((tweet) => calculateTweetEngagementRate(tweet))
    .filter((value): value is number => value !== null);

  return rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : null;
}

export function countActiveTunnels(tunnels: InfraTunnel[]): number {
  return tunnels.filter((tunnel) => isActiveTunnelStatus(tunnel.status)).length;
}
