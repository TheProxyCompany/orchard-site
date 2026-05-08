import { Chart } from "chart.js/auto";
import type { ChartData, ChartOptions, ChartType } from "chart.js";
import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import SectionCard from "./SectionCard";
import { cx } from "../lib/format";

type ChartCardProps = {
  title: string;
  eyebrow?: string;
  subtext?: string;
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
  actions?: ComponentChildren;
  className?: string;
  heightClassName?: string;
};

export default function ChartCard({
  title,
  eyebrow,
  subtext,
  type,
  data,
  options,
  actions,
  className,
  heightClassName = "h-72",
}: ChartCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const chart = new Chart(canvasRef.current, {
      type,
      data,
      options,
    });

    return () => chart.destroy();
  }, [type, data, options]);

  return (
    <SectionCard
      eyebrow={eyebrow}
      title={title}
      subtext={subtext}
      actions={actions}
      className={className}
    >
      <div className={cx("relative", heightClassName)}>
        <canvas ref={canvasRef} />
      </div>
    </SectionCard>
  );
}
