import React from "react";

export type IconName = "trade" | "portfolio" | "risk" | "recon" | "system" | "arrow" | "logout" | "check" | "layers" | "lock";

const paths: Record<IconName, React.ReactNode> = {
  trade: <><path d="M4 17 10 11l4 3 6-8" /><path d="M15 6h5v5" /><path d="M4 5v15h16" /></>,
  portfolio: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3" /></>,
  risk: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  recon: <><path d="M8 3h8l4 4v14H4V3h4ZM15 3v5h5M8 12h8M8 16h5" /></>,
  system: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01M12 7h5M12 17h5" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  logout: <><path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  layers: <><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Brand() {
  return <span className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Match<span className="brand-light">Ledger</span></span></span>;
}

export function PageHeading({ title, description, eyebrow, actions }: { title: string; description: string; eyebrow: string; actions?: React.ReactNode }) {
  return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{actions && <div className="page-heading-actions">{actions}</div>}</header>;
}
