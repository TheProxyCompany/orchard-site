import type { Chart, ChartOptions, ChartType, Plugin } from "chart.js";

export const chartColors = {
  accent: "#DAD0AF",
  success: "#4ade80",
  warning: "#facc15",
  danger: "#f87171",
  info: "#818cf8",
  muted: "#9a9588",
  text: "#ece7db",
  surface: "#121212",
  grid: "rgba(255, 255, 255, 0.06)",
};

export type ReleaseMarker = {
  timestamp: string;
  label: string;
  channel?: string;
};

type ReleaseMarkersPluginOptions = {
  markers?: ReleaseMarker[];
  timestamps?: string[];
  showLabels?: boolean;
};

type ReleaseMarkerHit = {
  marker: ReleaseMarker;
  x: number;
};

const activeReleaseMarkers = new WeakMap<Chart, ReleaseMarkerHit | null>();

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    releaseMarkers?: ReleaseMarkersPluginOptions;
  }
}

function releaseMarkerColor(channel: string | undefined, active = false): string {
  if (channel === "dev") return active ? "rgba(129, 140, 248, 0.82)" : "rgba(129, 140, 248, 0.22)";
  return active ? "rgba(218, 208, 175, 0.88)" : "rgba(218, 208, 175, 0.26)";
}

function interpolateReleaseX(
  markerTimestamp: string,
  runTimestamps: string[],
  getPixelForIndex: (index: number) => number,
): number | null {
  const markerTime = Date.parse(markerTimestamp);
  const runTimes = runTimestamps.map((value) => Date.parse(value));
  if (!Number.isFinite(markerTime) || runTimes.length === 0) return null;
  if (runTimes.length === 1) {
    return markerTime === runTimes[0] ? getPixelForIndex(0) : null;
  }
  if (markerTime < runTimes[0] || markerTime > runTimes[runTimes.length - 1]) return null;

  for (let index = 0; index < runTimes.length - 1; index += 1) {
    const start = runTimes[index];
    const end = runTimes[index + 1];
    if (markerTime < start || markerTime > end) continue;
    const startX = getPixelForIndex(index);
    const endX = getPixelForIndex(index + 1);
    const span = end - start;
    const progress = span <= 0 ? 0 : (markerTime - start) / span;
    return startX + (endX - startX) * progress;
  }

  return null;
}

function markerHitKey(hit: ReleaseMarkerHit | null | undefined): string {
  return hit ? `${hit.marker.timestamp}:${hit.marker.label}:${Math.round(hit.x)}` : "";
}

function releaseMarkerHits(chart: Chart, options: ReleaseMarkersPluginOptions): ReleaseMarkerHit[] {
  const markers = options.markers ?? [];
  const timestamps = options.timestamps ?? [];
  const xScale = chart.scales.x;
  if (markers.length === 0 || timestamps.length === 0 || !xScale) return [];

  const { chartArea } = chart;
  return markers.flatMap((marker) => {
    const x = interpolateReleaseX(
      marker.timestamp,
      timestamps,
      (index) => xScale.getPixelForValue(index),
    );
    if (x === null || x < chartArea.left || x > chartArea.right) return [];
    return [{ marker, x }];
  });
}

function drawReleaseLine(chart: Chart, hit: ReleaseMarkerHit, active = false): void {
  const { ctx, chartArea } = chart;
  ctx.save();
  ctx.lineWidth = active ? 1.5 : 1;
  ctx.setLineDash(active ? [4, 4] : [2, 6]);
  ctx.strokeStyle = releaseMarkerColor(hit.marker.channel, active);
  ctx.beginPath();
  ctx.moveTo(hit.x, chartArea.top);
  ctx.lineTo(hit.x, chartArea.bottom);
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawReleaseLabel(chart: Chart, hit: ReleaseMarkerHit): void {
  const { ctx, chartArea } = chart;
  const label = hit.marker.label.length > 32 ? `${hit.marker.label.slice(0, 29)}...` : hit.marker.label;
  const height = 22;
  const paddingX = 8;
  const top = chartArea.top + 8;

  ctx.save();
  ctx.font = "11px SF Pro Text, Avenir Next, IBM Plex Sans, Segoe UI, system-ui, sans-serif";
  const width = Math.min(ctx.measureText(label).width + paddingX * 2, chartArea.width - 8);
  const left = Math.min(
    Math.max(hit.x - width / 2, chartArea.left + 4),
    chartArea.right - width - 4,
  );

  drawRoundedRect(ctx, left, top, width, height, 7);
  ctx.fillStyle = "rgba(18, 18, 18, 0.94)";
  ctx.fill();
  ctx.strokeStyle = "rgba(218, 208, 175, 0.36)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = chartColors.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, left + width / 2, top + height / 2 + 0.5);
  ctx.restore();
}

function nearestReleaseMarker(
  chart: Chart,
  options: ReleaseMarkersPluginOptions,
  pointerX: number,
  pointerY: number,
): ReleaseMarkerHit | null {
  const { chartArea } = chart;
  if (pointerY < chartArea.top || pointerY > chartArea.bottom) return null;

  let closest: ReleaseMarkerHit | null = null;
  let closestDistance = Infinity;
  for (const hit of releaseMarkerHits(chart, options)) {
    const distance = Math.abs(hit.x - pointerX);
    if (distance < closestDistance) {
      closest = hit;
      closestDistance = distance;
    }
  }

  return closestDistance <= 7 ? closest : null;
}

export const releaseMarkersPlugin: Plugin<"line", ReleaseMarkersPluginOptions> = {
  id: "releaseMarkers",
  beforeDatasetsDraw(chart, _args, options) {
    for (const hit of releaseMarkerHits(chart, options)) {
      drawReleaseLine(chart, hit);
    }
  },
  afterDatasetsDraw(chart, _args, options) {
    const activeMarker = activeReleaseMarkers.get(chart);
    if (!activeMarker || !options.showLabels) return;
    drawReleaseLine(chart, activeMarker, true);
    drawReleaseLabel(chart, activeMarker);
  },
  afterEvent(chart, args, options) {
    const event = args.event;
    const nextMarker = event.type === "mouseout" ||
      typeof event.x !== "number" ||
      typeof event.y !== "number"
      ? null
      : nearestReleaseMarker(chart, options, event.x, event.y);
    const currentMarker = activeReleaseMarkers.get(chart) ?? null;
    if (markerHitKey(currentMarker) !== markerHitKey(nextMarker)) {
      activeReleaseMarkers.set(chart, nextMarker);
      chart.canvas.style.cursor = nextMarker && options.showLabels ? "help" : "";
      (args as { changed?: boolean }).changed = true;
    }
  },
  afterDestroy(chart) {
    activeReleaseMarkers.delete(chart);
  },
};

export function createBaseChartOptions(): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: chartColors.text,
          boxHeight: 8,
          boxWidth: 8,
          usePointStyle: true,
          pointStyle: "circle",
          padding: 16,
          font: {
            family:
              "SF Pro Text, Avenir Next, IBM Plex Sans, Segoe UI, system-ui, sans-serif",
            size: 11,
          },
        },
      },
      tooltip: {
        backgroundColor: chartColors.surface,
        titleColor: chartColors.text,
        bodyColor: "#c7c0af",
        borderColor: "rgba(218, 208, 175, 0.2)",
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        border: {
          color: chartColors.grid,
        },
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.muted,
          maxRotation: 0,
          autoSkipPadding: 14,
          font: {
            size: 10,
          },
        },
      },
      y: {
        beginAtZero: true,
        border: {
          color: chartColors.grid,
        },
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.muted,
          font: {
            size: 10,
          },
        },
      },
    },
  };
}
