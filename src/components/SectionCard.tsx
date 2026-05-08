import type { ComponentChildren } from "preact";
import { cx } from "../lib/format";

type SectionCardProps = {
  eyebrow?: string;
  title?: string;
  subtext?: string;
  children: ComponentChildren;
  actions?: ComponentChildren;
  variant?: "default" | "hero" | "glass";
  className?: string;
  contentClassName?: string;
};

export default function SectionCard({
  eyebrow,
  title,
  subtext,
  children,
  actions,
  variant = "default",
  className,
  contentClassName,
}: SectionCardProps) {
  const surfaceClassName =
    variant === "hero"
      ? "rounded-[1.25rem] border border-line-strong bg-[radial-gradient(circle_at_top_right,rgba(218,208,175,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_72%),rgba(18,18,18,0.92)] shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      : variant === "glass"
        ? "rounded-[1.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)_42%,rgba(0,0,0,0.2)_100%),rgba(18,18,18,0.78)] shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl"
        : "rounded-[1.25rem] border border-white/7 bg-[radial-gradient(circle_at_top_right,rgba(218,208,175,0.06),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.014)_40%,rgba(0,0,0,0.12)_100%),rgba(18,18,18,0.9)] shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-md";

  return (
    <section
      className={cx(
        "relative isolate overflow-hidden",
        surfaceClassName,
        className,
      )}
    >
      {(eyebrow || title || subtext || actions) && (
        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-2 text-[0.64rem] font-medium tracking-[0.22em] text-muted uppercase">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-[1.02rem] font-semibold tracking-[0.02em] text-accent">
                {title}
              </h2>
            )}
            {subtext && <p className="mt-2 text-sm leading-6 text-muted">{subtext}</p>}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      <div className={cx("relative z-10 p-5", contentClassName)}>{children}</div>
    </section>
  );
}
