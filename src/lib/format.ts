export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function casaColor(casa: string): string {
  switch (casa) {
    case 'Isla': return 'text-emerald-600';
    case 'Playa': return 'text-blue-600';
    case 'Aura': return 'text-purple-600';
    default: return 'text-gray-600';
  }
}

export function casaBgColor(casa: string): string {
  switch (casa) {
    case 'Isla': return 'bg-emerald-100 text-emerald-800';
    case 'Playa': return 'bg-blue-100 text-blue-800';
    case 'Aura': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
