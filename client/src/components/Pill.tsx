interface PillProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Pill({ children, color = 'bg-gray-100', className = '' }: PillProps) {
  return (
    <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${color} ${className}`}>
      {children}
    </span>
  );
}
