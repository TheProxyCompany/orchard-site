export type TabName =
  | "home"
  | "proxy"
  | "benchmarks"
  | "ci"
  | "infra"
  | "bank"
  | "socials"
  | "ads";

export type HomeMetricDelta = {
  text: string;
  tone: "positive" | "negative" | "neutral";
};

export type HomeMetric = {
  label: string;
  value: string;
  subtext?: string;
  delta?: HomeMetricDelta | null;
  anomalyLabel?: string | null;
};

export type HomeStatusPill = {
  label: string;
  statusClass: string;
};

export type HomeSection = {
  title: string;
  href: string;
  summary: string;
  metrics: HomeMetric[];
  footerNote?: string | null;
  pills?: HomeStatusPill[];
  alert?: {
    text: string;
    tone: "warning" | "danger";
  } | null;
};

export type HomeOverviewData = {
  heroTitle: string;
  sections: HomeSection[];
};

export type ProxyMetricRow = {
  day: string;
  unique_visitors: number;
  page_views: number;
  downloads: number;
  dau: number;
  impressions: number;
  ad_clicks: number;
  spend_cents: number;
};

export type ProxyExperiment = Record<string, unknown> & {
  name?: string;
  status?: string;
};

export type ProxyRetentionRow = {
  day: string;
  dau: number;
  returning_users: number;
};

export type ProxyCumulativeRow = {
  day: string;
  cumulative_devices: number;
};

export type ProxyCohortRow = {
  cohort_week: string;
  cohort_size: number;
  week_1: number;
  week_2: number;
  week_3: number;
  week_4: number;
};

export type ProxyTabData = {
  metrics: ProxyMetricRow[];
  totalActivations: number;
  experiments: ProxyExperiment[];
  days: number;
  allTimeDownloads: number;
  allTimeSpendCents: number;
  uniqueDevices: number;
  returningDevices: number;
  retention: ProxyRetentionRow[];
  cumulativeDevices: ProxyCumulativeRow[];
  cohorts: ProxyCohortRow[];
};

export type BenchmarkAggregate = {
  name: string;
  targetName: string;
  metrics: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type BenchmarkRun = {
  id: number;
  runName: string;
  scenarioName: string;
  timestamp: string;
  device: string;
  hostname: string;
  targets?: string[];
  systemMetrics: Record<string, unknown>[];
  status: string;
  metadata: Record<string, unknown>;
  aggregates: BenchmarkAggregate[];
};

export type BenchmarkRelease = {
  id: string;
  version: string;
  channel: string;
  createdAt: string;
  artifactName: string;
  downloadUrl: string;
  releaseNotes: string | null;
  sha256: string | null;
};

export type BenchmarksTabData = {
  runs: BenchmarkRun[];
  overviewRuns: BenchmarkRun[];
  releases?: BenchmarkRelease[];
  days: number;
  limit?: number;
  overviewLimit?: number;
};

export type GitHubWorkflowRun = {
  name: string;
  status: string;
  conclusion: string;
  headBranch: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type GitHubDeployment = {
  state: string;
  environment: string;
  createdAt: string;
  targetUrl: string;
};

export type CIRepoResult = {
  repo: string;
  runs: GitHubWorkflowRun[];
  unavailable: boolean;
  stars: number | null;
  trafficViews: number | null;
  trafficClones: number | null;
  lastGreenAt: string | null;
  lastGreenRunUrl: string | null;
  openPRs: number | null;
  latestDeployment: GitHubDeployment | null;
};

export type CIStatusSummary = {
  passing: number;
  failing: number;
  running: number;
  unknown: number;
  total: number;
};

export type CITabData = {
  repoResults: CIRepoResult[];
};

export type InfraWorkerInvocation = {
  date: string;
  scriptName: string;
  requests: number;
  errors: number;
  subrequests: number;
};

export type InfraWorkerSummary = {
  scriptName: string;
  requests: number;
  errors: number;
  subrequests: number;
};

export type InfraWorkerDaily = {
  date: string;
  requests: number;
  errors: number;
};

export type InfraWorkerSnapshot = {
  totalRequests: number;
  totalErrors: number;
  errorRatePercent: number;
  activeWorkers: number;
  workers: InfraWorkerSummary[];
  daily: InfraWorkerDaily[];
};

export type InfraTunnel = {
  id: number;
  username: string;
  status: string;
  createdAt: string;
};

export type InfraHealthcheckCurrent = {
  endpointName: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  timestamp: string;
};

export type InfraHealthcheckUptime = {
  endpointName: string;
  uptimePct: number | null;
  avgLatencyMs: number | null;
};

export type InfraHealthcheckIncident = {
  endpointName: string;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  timestamp: string;
};

export type InfraHealthcheckSnapshot = {
  current: InfraHealthcheckCurrent[];
  uptime30d: InfraHealthcheckUptime[];
  recentIncidents: InfraHealthcheckIncident[];
};

export type InfraTabData = {
  workerSnapshot: InfraWorkerSnapshot | null;
  tunnels: InfraTunnel[];
  healthcheckSnapshot: InfraHealthcheckSnapshot | null;
  days: number;
};

export type PlaidAccount = {
  name: string;
  type: string;
  currentBalance: number | null;
  availableBalance: number | null;
  currency: string;
};

export type PlaidTransaction = {
  name: string;
  amount: number | null;
  date: string;
  category: string;
};

export type DailyBalanceSnapshot = {
  day: string;
  totalBalanceCents: number;
  accountCount: number;
  snapshotAt: string;
};

export type BalanceHistorySummary = {
  latestBalance: number | null;
  monthlyBurnRate: number | null;
  runwayMonths: number | null;
};

export type BankTabData = {
  accounts: PlaidAccount[] | null;
  transactions: PlaidTransaction[] | null;
  snapshots: DailyBalanceSnapshot[] | null;
  days: number;
  note: string | null;
};

export type TwitterProfile = {
  id: string;
  username: string;
  displayName: string;
  followers: number;
  following: number;
  tweets: number;
  profileImageUrl: string;
  description: string;
};

export type TwitterTweet = {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
};

export type SocialsTabData = {
  profiles: TwitterProfile[];
  tweetsByUser: Record<string, TwitterTweet[]>;
};

export type MetaAdInsight = {
  dateStart: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  reach: number;
};

export type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
};

export type AdsTabData = {
  insights: MetaAdInsight[] | null;
  campaigns: MetaCampaign[] | null;
  days: number;
};

export type DashboardTabResponseMap = {
  home: HomeOverviewData;
  proxy: ProxyTabData;
  benchmarks: BenchmarksTabData;
  ci: CITabData;
  infra: InfraTabData;
  bank: BankTabData;
  socials: SocialsTabData;
  ads: AdsTabData;
};

export type DashboardTabResponse = DashboardTabResponseMap[TabName];

export type DashboardErrorResponse = {
  error: string;
};
