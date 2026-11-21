/** An investor's permanent ID as a small monospace label; renders nothing for users without one. */
export function InvestorCode({ code }: { code: string | null }) {
  return code ? <span className="reference text-xs text-subtle">{code}</span> : null;
}
