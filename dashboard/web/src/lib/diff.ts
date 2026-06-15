export type DiffLine = { type: 'same' | 'add' | 'del'; text: string };

// LCS-based line diff (files here are small: a few hundred lines max).
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] });
  while (j < m) out.push({ type: 'add', text: b[j++] });
  return out;
}

// Collapse long runs of unchanged lines, keeping `context` lines around edits.
export function collapse(lines: DiffLine[], context = 2): (DiffLine | { type: 'gap'; count: number })[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, idx) => {
    if (l.type !== 'same') {
      for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true;
    }
  });
  const out: (DiffLine | { type: 'gap'; count: number })[] = [];
  let gap = 0;
  lines.forEach((l, idx) => {
    if (keep[idx]) {
      if (gap > 0) {
        out.push({ type: 'gap', count: gap });
        gap = 0;
      }
      out.push(l);
    } else {
      gap++;
    }
  });
  if (gap > 0) out.push({ type: 'gap', count: gap });
  return out;
}
