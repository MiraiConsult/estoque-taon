'use client';

interface CasaFilterProps {
  selected: string;
  onChange: (casa: string) => void;
  showAll?: boolean;
}

const casaColors: Record<string, string> = {
  all: 'bg-gray-100 text-gray-800 border-gray-300',
  Isla: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Playa: 'bg-blue-50 text-blue-800 border-blue-300',
  Aura: 'bg-purple-50 text-purple-800 border-purple-300',
};

const casaActiveColors: Record<string, string> = {
  all: 'bg-gray-800 text-white border-gray-800',
  Isla: 'bg-emerald-600 text-white border-emerald-600',
  Playa: 'bg-blue-600 text-white border-blue-600',
  Aura: 'bg-purple-600 text-white border-purple-600',
};

export default function CasaFilter({ selected, onChange, showAll = true }: CasaFilterProps) {
  const options = showAll ? ['all', 'Isla', 'Playa', 'Aura'] : ['Isla', 'Playa', 'Aura'];

  return (
    <div className="flex gap-2">
      {options.map((casa) => (
        <button
          key={casa}
          onClick={() => onChange(casa)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            selected === casa ? casaActiveColors[casa] : casaColors[casa]
          }`}
        >
          {casa === 'all' ? 'Todas' : casa}
        </button>
      ))}
    </div>
  );
}
