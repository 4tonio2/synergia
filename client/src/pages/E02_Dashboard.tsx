import { useLocation } from "wouter";
import { Calendar, Settings, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/appStore";
import { PatientCard } from "@/components/PatientCard";
import { NavItem } from "@/components/NavItem";
import { useCustomToast } from "@/hooks/useToast";

export default function E02_Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { patients, visits, alerts } = useAppStore();
  const toast = useCustomToast();

  const firstName = user?.firstName || user?.email?.split("@")[0] || "Utilisateur";
  
  const getRoleLabel = (role?: string | null) => {
    switch (role) {
      case "infirmier":
        return "Infirmier";
      case "medecin":
        return "Médecin";
      case "kinesitherapeute":
        return "Kinésithérapeute";
      case "aidant_pro":
        return "Aidant pro";
      default:
        return "Professionnel";
    }
  };

  const handleSelectPatient = (patient: any) => {
    setLocation(`/patients/${patient.id}`);
  };

  const handleStartFreeRecording = () => {
    setLocation('/recordings/new-free');
  };

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  const handleAlertsClick = () => {
    setLocation('/alerts');
  };

  // Stats
  const validatedVisitsCount = visits.filter(v => v.validated).length;
  const unreadAlertsCount = alerts.filter(a => !a.read).length;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="p-6">
          <h1 className="text-3xl font-extrabold mb-4">Dashboard</h1>
          
          {/* Bandeau Infirmier */}
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-blue-200 rounded-full overflow-hidden mr-3">
              {user?.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt="Professionnel" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-400 text-white font-bold text-lg">
                  {firstName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-xl font-semibold">
                Bonjour, {getRoleLabel(user?.medicalRole)} {firstName}
              </p>
            </div>
          </div>

          {/* Tournée du jour */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Tournée du jour</h2>
            <div className="space-y-3">
              {patients.map(patient => (
                <PatientCard 
                  key={patient.id} 
                  patient={patient as any} 
                  onClick={handleSelectPatient as any} 
                />
              ))}
            </div>
          </div>
          
          {/* Enregistrer maintenant (sans patient) */}
          <Button 
            className="w-full mb-6 bg-green-600 hover:bg-green-700 shadow-lg h-14 text-lg font-semibold"
            onClick={handleStartFreeRecording}
          >
            <Mic className="mr-2" size={20} />
            Enregistrer maintenant (sans patient)
          </Button>

          {/* Widget statistiques */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-xl shadow-md">
              <p className="text-sm text-gray-500">Nombre de visites</p>
              <p className="text-3xl font-bold text-blue-600">
                {validatedVisitsCount}
              </p>
            </div>
            <div 
              className="p-4 bg-white rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-shadow"
              onClick={handleAlertsClick}
            >
              <p className="text-sm text-gray-500">Alertes non lues</p>
              <p className="text-3xl font-bold text-red-600">
                {unreadAlertsCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer - Fixed at bottom */}
      {/* Bottom Nav - 3 boutons */}
      <div className="flex justify-around p-3 bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-10 max-w-md mx-auto w-full shadow-lg">
        <NavItem 
          icon={Calendar} 
          label="Tournée" 
          active={true} 
          onClick={() => handleNavigate('/dashboard')} 
        />
        <NavItem 
          icon={Volume2} 
          label="Enregistrements" 
          active={false} 
          onClick={() => handleNavigate('/recordings')} 
        />
        <NavItem 
          icon={Settings} 
          label="Paramètres" 
          active={false} 
          onClick={() => handleNavigate('/settings')} 
        />
      </div>
    </div>
  );
}
