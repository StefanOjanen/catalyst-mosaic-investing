import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchResearchList } from '../lib/api';
import { cancelSkill, startSkill, type SkillEvent } from '../lib/skill';
import { ReviewModal } from './ReviewModal';

interface ToolChip {
  name: string;
  summary?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  tools?: ToolChip[];
  cost?: number | null;
  durationMs?: number | null;
  error?: string;
  streaming?: boolean;
  reviewJobId?: string;
  reviewCount?: number;
}

type Group = 'daily' | 'explore' | 'catalysts' | 'review' | 'manage';

interface Command {
  cmd: string;
  desc: string;
  arg?: boolean;
  heavy?: boolean;
  write?: boolean;
  group?: Group;
}

const COMMANDS: Command[] = [
  { cmd: '/invest:daily', desc: 'Daily portfolio + watchlist + earnings check', heavy: true, group: 'daily' },
  { cmd: '/invest:status', desc: 'Quick portfolio status — just the numbers', group: 'explore' },
  { cmd: '/invest:watchlist', desc: 'Scan the watchlist for movers & catalysts', group: 'explore' },
  { cmd: '/invest:dossier', desc: 'Deep dive on a ticker (bull + bear)', arg: true, heavy: true, group: 'explore' },
  { cmd: '/invest:insiders', desc: 'Insider Form 4 scan', group: 'explore' },
  { cmd: '/invest:contracts', desc: 'Government contract flow scan', group: 'explore' },
  { cmd: '/invest:preprint', desc: 'Pre-print de-risk score + lock exit rules', arg: true, write: true, group: 'catalysts' },
  { cmd: '/invest:exitcheck', desc: 'Post-print exit decision vs pre-committed rules', arg: true, write: true, group: 'catalysts' },
  { cmd: '/invest:thesis', desc: 'Thesis-drift check on holdings', group: 'review' },
  { cmd: '/invest:stress', desc: 'Stress-test the portfolio', group: 'review' },
  { cmd: '/invest:devils', desc: "Devil's advocate on positioning", group: 'review' },
  { cmd: '/invest:redflags', desc: 'Red-flag scan on a ticker', arg: true, group: 'review' },
  { cmd: '/invest:weekly', desc: 'Multi-agent weekly portfolio review', heavy: true, group: 'review' },
  { cmd: '/invest:macro', desc: 'Sunday macro routine', group: 'review' },
  { cmd: '/invest:goal', desc: 'Set / view monetary goals + pace to target', arg: true, write: true, group: 'manage' },
  { cmd: '/invest:trade', desc: 'Pre-trade sanity check', arg: true, group: 'manage' },
  { cmd: '/invest:help', desc: 'List all /invest commands' },
];

const GROUPS: { id: Exclude<Group, 'daily'>; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'catalysts', label: 'Catalysts' },
  { id: 'review', label: 'Review' },
  { id: 'manage', label: 'Manage' },
];

const DAILY = COMMANDS.find((c) => c.cmd === '/invest:daily') as Command;

export function ChatPane({ onNavigate }: { onNavigate?: (t: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [acOpen, setAcOpen] = useState(true);
  const [acHi, setAcHi] = useState(0);
  const sessionRef = useRef<string | null>(null);
  const jobRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: research } = useQuery({ queryKey: ['research'], queryFn: fetchResearchList });
  const lastDaily = research?.find((f) => /^\d{4}-\d{2}-\d{2}/.test(f.name))?.name.slice(0, 10) ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => esRef.current?.close(), []);

  function patchLastAssistant(fn: (m: ChatMessage) => ChatMessage) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') {
          next[i] = fn(next[i]);
          break;
        }
      }
      return next;
    });
  }

  function handleEvent(ev: SkillEvent) {
    switch (ev.kind) {
      case 'session':
        sessionRef.current = ev.sessionId;
        break;
      case 'assistant_text':
        patchLastAssistant((m) => ({ ...m, text: m.text + ev.text }));
        break;
      case 'tool':
        patchLastAssistant((m) => ({ ...m, tools: [...(m.tools ?? []), { name: ev.name, summary: ev.summary }] }));
        break;
      case 'result':
        patchLastAssistant((m) => ({
          ...m,
          text: m.text || ev.text,
          cost: ev.cost,
          durationMs: ev.durationMs,
          error: ev.isError ? m.error ?? 'completed with error' : m.error,
          streaming: false,
        }));
        break;
      case 'review': {
        const jid = jobRef.current ?? undefined;
        patchLastAssistant((m) => ({ ...m, reviewJobId: jid, reviewCount: ev.changeCount }));
        if (jid) setReviewJobId(jid);
        break;
      }
      case 'error':
        patchLastAssistant((m) => ({ ...m, error: ev.text, streaming: false }));
        break;
      default:
        break;
    }
  }

  async function send(prompt: string) {
    const text = prompt.trim();
    if (!text || running) return;
    setRunning(true);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }, { role: 'assistant', text: '', tools: [], streaming: true }]);

    try {
      const { jobId } = await startSkill(text, sessionRef.current);
      jobRef.current = jobId;
      const es = new EventSource(`/api/skill/${jobId}/stream`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          handleEvent(JSON.parse(e.data) as SkillEvent);
        } catch {
          /* ignore malformed frame */
        }
      };
      es.addEventListener('end', () => {
        es.close();
        esRef.current = null;
        setRunning(false);
        patchLastAssistant((m) => ({ ...m, streaming: false }));
      });
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setRunning(false);
        patchLastAssistant((m) => ({ ...m, streaming: false }));
      };
    } catch (err) {
      patchLastAssistant((m) => ({ ...m, error: String(err), streaming: false }));
      setRunning(false);
    }
  }

  function onQuick(s: { cmd: string; arg?: boolean; heavy?: boolean }) {
    if (s.arg) {
      setInput(s.cmd + ' ');
      inputRef.current?.focus();
      return;
    }
    if (s.heavy && !window.confirm(`${s.cmd} runs subagents + web searches (minutes, real token cost). Run it?`)) return;
    void send(s.cmd);
  }

  function applySuggestion(c: Command) {
    setInput(c.cmd + (c.arg ? ' ' : ''));
    setAcOpen(false);
    inputRef.current?.focus();
  }

  function cancel() {
    if (jobRef.current) cancelSkill(jobRef.current);
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
    patchLastAssistant((m) => ({ ...m, streaming: false, error: m.error ?? 'cancelled' }));
  }

  const slashQuery = input.startsWith('/') && !input.includes(' ') ? input.toLowerCase() : null;
  const suggestions = slashQuery ? COMMANDS.filter((c) => c.cmd.toLowerCase().includes(slashQuery)) : [];
  const showAc = acOpen && suggestions.length > 0;
  const hi = Math.max(0, Math.min(acHi, suggestions.length - 1));

  return (
    <div className="panel flex h-full flex-col">
      <header className="panel-header">
        <h2 className="display text-[12px] text-[var(--accent)]">Assistant</h2>
        {sessionRef.current && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> session active
          </span>
        )}
      </header>

      {/* Primary daily action + grouped command rail */}
      <div className="space-y-2.5 border-b border-[var(--border)] px-3 py-3">
        <button
          onClick={() => onQuick(DAILY)}
          disabled={running}
          className="btn btn-accent w-full px-3 py-2.5 text-left disabled:opacity-40"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">▶ Run daily check</span>
            <span className="text-[10px] opacity-70">/invest:daily ⚡</span>
          </div>
          <div className="mt-0.5 text-[10px] opacity-70">
            the one thing to do each day{lastDaily ? ` · last run ${lastDaily}` : ''}
          </div>
        </button>
        {lastDaily && onNavigate && (
          <button onClick={() => onNavigate('research')} className="text-[10px] text-slate-500 hover:text-[var(--accent-2)]">
            view latest daily report →
          </button>
        )}

        {GROUPS.map((g) => (
          <div key={g.id}>
            <div className="label mb-1">{g.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {COMMANDS.filter((c) => c.group === g.id).map((s) => (
                <button key={s.cmd} onClick={() => onQuick(s)} disabled={running} className="btn text-[11px]">
                  {s.cmd.replace('/invest:', '')}
                  {s.heavy ? ' ⚡' : ''}
                  {s.write ? ' ✎' : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-slate-600">
            Run the daily check above, pick a skill, or type a question. Replies stream from <code>claude -p</code> in
            your investing folder.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} m={m} onOpenReview={setReviewJobId} />
        ))}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <div className="relative">
          {showAc && (
            <div className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-md border border-[var(--border)] bg-[#0c0c0e] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)]">
              <div className="border-b border-[var(--border)] px-3 py-1 text-[10px] uppercase tracking-wider text-slate-600">
                invest commands · ↑↓ select · ↵ insert
              </div>
              {suggestions.map((c, i) => (
                <button
                  key={c.cmd}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(c);
                  }}
                  onMouseEnter={() => setAcHi(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left ${
                    i === hi ? 'bg-[rgba(255,168,40,0.12)]' : ''
                  }`}
                >
                  <span className="shrink-0 text-[12px] text-[var(--accent-2)]">
                    {c.cmd}
                    {c.heavy ? ' ⚡' : ''}
                    {c.write ? ' ✎' : ''}
                  </span>
                  <span className="truncate text-[11px] text-slate-500">{c.desc}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setAcOpen(true);
                setAcHi(0);
              }}
              onKeyDown={(e) => {
                if (showAc) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAcHi((h) => (h + 1) % suggestions.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAcHi((h) => (h - 1 + suggestions.length) % suggestions.length);
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    if (suggestions[hi]) applySuggestion(suggestions[hi]);
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setAcOpen(false);
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything, or type / for commands"
              className="max-h-32 flex-1 resize-none rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-[var(--accent)] focus:outline-none"
            />
            {running ? (
              <button onClick={cancel} className="btn px-3 py-2 text-sm text-rose-300 hover:text-rose-200">
                Stop
              </button>
            ) : (
              <button onClick={() => void send(input)} disabled={!input.trim()} className="btn btn-accent px-3 py-2 text-sm">
                Send
              </button>
            )}
          </div>
        </div>
      </div>
      {reviewJobId && <ReviewModal jobId={reviewJobId} onClose={() => setReviewJobId(null)} />}
    </div>
  );
}

function MessageBubble({ m, onOpenReview }: { m: ChatMessage; onOpenReview: (id: string) => void }) {
  if (m.role === 'user') {
    return (
      <div className="ml-auto max-w-[85%] rounded-xl border border-[rgba(255,168,40,0.28)] bg-[rgba(255,168,40,0.1)] px-3 py-2 text-sm text-slate-100 animate-in">
        {m.text}
      </div>
    );
  }
  return (
    <div className="mr-auto max-w-[92%] rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 animate-in">
      {m.tools && m.tools.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {m.tools.map((t, i) => (
            <span
              key={i}
              title={t.summary}
              className="max-w-[14rem] truncate rounded-md border border-white/5 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-300"
            >
              {t.name}
              {t.summary ? `: ${t.summary}` : ''}
            </span>
          ))}
        </div>
      )}
      {m.text ? (
        <div className="md text-sm text-slate-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
        </div>
      ) : (
        m.streaming && <span className="text-xs text-slate-500">working…</span>
      )}
      {m.reviewJobId && (
        <button
          onClick={() => onOpenReview(m.reviewJobId!)}
          className="mt-1.5 rounded-md border border-amber-700 bg-amber-900/30 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/60"
        >
          Review write · {m.reviewCount} file(s) ✎
        </button>
      )}
      {m.error && <div className="mt-1 text-xs text-rose-400">{m.error}</div>}
      {(m.cost != null || m.durationMs != null) && (
        <div className="mt-1.5 text-[10px] text-slate-600">
          {m.cost != null ? `$${m.cost.toFixed(4)}` : ''}
          {m.cost != null && m.durationMs != null ? ' · ' : ''}
          {m.durationMs != null ? `${(m.durationMs / 1000).toFixed(1)}s` : ''}
        </div>
      )}
    </div>
  );
}
