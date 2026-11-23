import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="border-b border-line pb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="mt-1.5 text-[26px] font-extrabold leading-[1.2] tracking-[-0.03em] text-ink sm:text-[32px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-base leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </header>
  );
}
