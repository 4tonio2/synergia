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
    className={`flex flex-col items-center justify-center px-3 py-2 transition-colors ${
      active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
    }`}
  >
    <Icon className={`w-5 h-5 mb-1 ${active ? "stroke-[2.5]" : ""}`} />
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
      {/* Spacer pour éviter que le contenu soit caché par la navbar */}
      <div className="h-20" />

      {/* Navigation Footer - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto w-full bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center justify-around py-2">
          {/* Tournée */}
          <NavItem 
            icon={Calendar} 
            label="Tournée" 
            active={isActive('/dashboard')} 
            onClick={() => handleNavigate('/dashboard')} 
          />
          
          {/* Enregistrements */}
          <NavItem 
            icon={Volume2} 
            label="Historique" 
            active={isActive('/recordings')} 
            onClick={() => handleNavigate('/recordings')} 
          />

          {/* Bouton Enregistrer - Au centre, plus visible */}
          <button
            onClick={handleStartFreeRecording}
            className="flex flex-col items-center justify-center px-3 py-1 -mt-6 transition-all"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs font-bold text-green-600 mt-1">Enregistrer</span>
          </button>

          {/* Paramètres */}
          <NavItem 
            icon={Settings} 
            label="Paramètres" 
            active={isActive('/settings')} 
            onClick={() => handleNavigate('/settings')} 
          />

          {/* Placeholder pour équilibrer */}
          <div className="w-12" />
        </div>
      </div>
    </>
  );
}
