import type { ReactNode } from 'react';

export function Card({
  title,
  right,
  children,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel animate-in">
      {(title || right) && (
        <header className="panel-header">
          <h2 className="display text-[12px] text-[var(--accent)]">{title}</h2>
          {right && <div className="text-[11px] text-slate-400">{right}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
