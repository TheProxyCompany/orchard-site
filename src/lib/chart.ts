import type { ChartOptions } from "chart.js";

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
