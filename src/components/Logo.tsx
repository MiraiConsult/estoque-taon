export default function Logo({ collapsed = false, size = 'sm' }: { collapsed?: boolean; size?: 'sm' | 'lg' }) {
  if (collapsed) {
    return (
      <svg width="32" height="20" viewBox="0 0 60 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="60" height="32" rx="16" fill="#1d6fa5" />
        <circle cx="18" cy="16" r="11" fill="#1a3a5c" />
        <text x="40" y="22" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="18" fill="white" textAnchor="middle">N</text>
      </svg>
    );
  }

  if (size === 'lg') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold tracking-[0.25em] text-gray-400 uppercase">Group</span>
        <svg width="100" height="48" viewBox="0 0 100 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="100" height="48" rx="24" fill="#1d6fa5" />
          <circle cx="27" cy="24" r="17" fill="#0f3a5c" />
          <text x="68" y="33" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="28" fill="white" textAnchor="middle">N</text>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.2em] text-gray-400 uppercase">Group</span>
      <svg width="52" height="24" viewBox="0 0 60 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="60" height="28" rx="14" fill="#1d6fa5" />
        <circle cx="16" cy="14" r="10" fill="#0f3a5c" />
        <text x="42" y="20" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="16" fill="white" textAnchor="middle">N</text>
      </svg>
    </div>
  );
}
