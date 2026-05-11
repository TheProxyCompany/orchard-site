import type { ChartOptions, ChartType, Plugin } from "chart.js";

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

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    releaseMarkers?: ReleaseMarkersPluginOptions;
  }
}

function releaseMarkerColor(channel: string | undefined): string {
  if (channel === "dev") return "rgba(129, 140, 248, 0.58)";
  return "rgba(218, 208, 175, 0.68)";
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

export const releaseMarkersPlugin: Plugin<"line", ReleaseMarkersPluginOptions> = {
  id: "releaseMarkers",
  afterDatasetsDraw(chart, _args, options) {
    const markers = options.markers ?? [];
    const timestamps = options.timestamps ?? [];
    if (markers.length === 0 || timestamps.length === 0) return;

    const xScale = chart.scales.x;
    if (!xScale) return;

    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);

    for (const marker of markers) {
      const x = interpolateReleaseX(
        marker.timestamp,
        timestamps,
        (index) => xScale.getPixelForValue(index),
      );
      if (x === null || x < chartArea.left || x > chartArea.right) continue;

      ctx.strokeStyle = releaseMarkerColor(marker.channel);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      if (options.showLabels && chartArea.width > 280) {
        const alignRight = x > chartArea.right - 56;
        ctx.setLineDash([]);
        ctx.font = "10px SF Pro Text, Avenir Next, IBM Plex Sans, Segoe UI, system-ui, sans-serif";
        ctx.textAlign = alignRight ? "right" : "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = releaseMarkerColor(marker.channel);
        ctx.fillText(marker.label, alignRight ? x - 5 : x + 5, chartArea.top + 4);
        ctx.setLineDash([3, 5]);
      }
    }

    ctx.restore();
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
