import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  address?: string | null;
  nextVisitTime?: string | null;
  riskLevel?: string | null;
  age?: string | null;
}

interface PatientCardProps {
  patient: Patient;
  onClick: (patient: Patient) => void;
  hideTime?: boolean;
}

export function PatientCard({ patient, onClick, hideTime = false }: PatientCardProps) {
  const getRiskIcon = () => {
    switch (patient.riskLevel) {
      case 'Élevé':
        return <AlertTriangle size={16} className="text-red-500 mt-1" />;
      case 'Modéré':
        return <AlertTriangle size={16} className="text-yellow-500 mt-1" />;
      case 'Faible':
        return <CheckCircle size={16} className="text-green-500 mt-1" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex items-center p-4 bg-white rounded-xl shadow-md mb-3 cursor-pointer hover:shadow-lg transition duration-200"
      onClick={() => onClick(patient)}
    >
      <div className="flex-1">
        <p className="font-semibold text-lg text-gray-800">{patient.name}</p>
        {patient.address && (
          <p className="text-sm text-gray-500">{patient.address}</p>
        )}
      </div>
      {!hideTime && patient.nextVisitTime && (
        <div className="flex flex-col items-end">
          <p className="font-bold text-gray-800">{patient.nextVisitTime}</p>
          {getRiskIcon()}
        </div>
      )}
    </div>
  );
}
