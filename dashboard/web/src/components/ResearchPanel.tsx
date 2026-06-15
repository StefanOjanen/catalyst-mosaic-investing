import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchResearchDoc, fetchResearchList } from '../lib/api';
import { Card } from './Card';

export function ResearchPanel() {
  const { data: list, isLoading, error } = useQuery({ queryKey: ['research'], queryFn: fetchResearchList });
  const [sel, setSel] = useState<string | null>(null);
  const current = sel ?? list?.[0]?.name ?? null;
  const { data: doc, isFetching } = useQuery({
    queryKey: ['research', current],
    queryFn: () => fetchResearchDoc(current as string),
    enabled: !!current,
  });

  if (isLoading) return <Card title="Research feed">Loading…</Card>;
  if (error) return <Card title="Research feed"><span className="text-rose-400">{String(error)}</span></Card>;

  return (
    <Card title="Research feed" right={<span>{list?.length ?? 0} files</span>}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(list ?? []).map((f) => (
          <button
            key={f.name}
            onClick={() => setSel(f.name)}
            className={`rounded-md border px-2 py-1 text-[11px] ${
              f.name === current
                ? 'border-[rgba(255,168,40,0.4)] bg-[rgba(255,168,40,0.14)] text-[var(--accent-2)]'
                : 'border-[var(--border)] bg-white/[0.02] text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.name.replace(/\.md$/, '')}
          </button>
        ))}
      </div>
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        {isFetching && !doc ? (
          <span className="text-xs text-slate-500">Loading…</span>
        ) : doc ? (
          <div className="md text-sm text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Select a file.</span>
        )}
      </div>
    </Card>
  );
}
