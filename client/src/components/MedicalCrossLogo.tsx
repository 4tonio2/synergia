export function MedicalCrossLogo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Plode Care Medical Logo"
    >
      <defs>
        <linearGradient id="medicalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <path
        d="M 35 15 L 65 15 L 65 35 L 85 35 L 85 65 L 65 65 L 65 85 L 35 85 L 35 65 L 15 65 L 15 35 L 35 35 Z"
        fill="url(#medicalGradient)"
        className="drop-shadow-sm"
      />
    </svg>
  );
}
