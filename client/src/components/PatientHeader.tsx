interface PatientHeaderProps {
  patient: {
    id: string;
    name: string;
    age?: string;
  };
  onBack: () => void;
}

export function PatientHeader({ patient, onBack }: PatientHeaderProps) {
  return (
    <div className="flex items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
      <button onClick={onBack} className="text-gray-600 hover:text-gray-800 mr-4">
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
      </button>
      <div className="flex items-center">
        <div className="w-12 h-12 bg-gray-300 rounded-full overflow-hidden mr-3">
          <img 
            src={`https://placehold.co/100x100/A0AEC0/ffffff?text=${patient.name.charAt(0)}`}
            alt="Photo patient" 
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="text-xl font-bold">{patient.name}</h2>
          <p className="text-sm text-gray-500">
            {patient.age && `${patient.age} ans - `}ID: {patient.id.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  );
}
