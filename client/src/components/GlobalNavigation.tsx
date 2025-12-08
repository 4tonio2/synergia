import { useLocation } from "wouter";
import { Calendar, Volume2, Settings, Mic } from "lucide-react";

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem = ({ icon: Icon, label, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center px-4 py-2 transition-colors ${
      active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
    }`}
  >
    <Icon className={`w-6 h-6 mb-1 ${active ? "stroke-[2.5]" : ""}`} />
    <span className={`text-xs ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
  </button>
);

export function GlobalNavigation() {
  const [location, setLocation] = useLocation();

  // Pages où on ne veut pas afficher la navigation (ex: landing, enregistrement en cours)
  const hiddenPaths = ['/landing', '/patients/*/record', '/recordings/new-free'];
  
  const shouldHide = hiddenPaths.some(path => {
    if (path.includes('*')) {
      const regex = new RegExp('^' + path.replace('*', '[^/]+') + '$');
      return regex.test(location);
    }
    return location === path;
  });

  if (shouldHide) {
    return null;
  }

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  const handleStartFreeRecording = () => {
    setLocation('/recordings/new-free');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location === '/' || location === '/dashboard' || location === '/patients';
    }
    return location.startsWith(path);
  };

  return (
    <>
      {/* Bouton flottant d'enregistrement - très visible */}
      <button
        onClick={handleStartFreeRecording}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-5 py-4 rounded-full shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 animate-pulse hover:animate-none"
        style={{ boxShadow: '0 4px 20px rgba(34, 197, 94, 0.5)' }}
      >
        <Mic className="w-6 h-6" />
        <span className="font-bold text-sm">Enregistrer</span>
      </button>

      {/* Navigation Footer - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto w-full">
        <div className="flex justify-around p-2 bg-white border-t border-gray-200 shadow-lg">
          <NavItem 
            icon={Calendar} 
            label="Tournée" 
            active={isActive('/dashboard')} 
            onClick={() => handleNavigate('/dashboard')} 
          />
          <NavItem 
            icon={Volume2} 
            label="Enregistrements" 
            active={isActive('/recordings')} 
            onClick={() => handleNavigate('/recordings')} 
          />
          <NavItem 
            icon={Settings} 
            label="Paramètres" 
            active={isActive('/settings')} 
            onClick={() => handleNavigate('/settings')} 
          />
        </div>
      </div>
    </>
  );
}
