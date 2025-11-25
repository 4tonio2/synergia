import { ReactNode } from 'react';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function NavItem({ icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 transition duration-150 ${
        active ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
      }`}
    >
      <Icon size={24} />
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}
