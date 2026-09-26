export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1c2430" />
      <rect x="4" y="4" width="12" height="12" fill="#eedeb0" />
      <rect x="16" y="4" width="12" height="12" fill="#5a7a48" />
      <rect x="4" y="16" width="12" height="12" fill="#5a7a48" />
      <rect x="16" y="16" width="12" height="12" fill="#3d9b6e" />
      <text x="16" y="22.5" textAnchor="middle" fontSize="16" fill="#10141a">
        ♘
      </text>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="brand" aria-label="ChessLab">
      <Mark />
      <span aria-hidden>
        Chess<span className="brand-rest">Lab</span>
      </span>
    </span>
  );
}
