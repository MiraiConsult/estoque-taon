'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Wine,
  BarChart3,
  Upload,
  ArrowLeftRight,
  ShoppingBasket,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/drinks', label: 'Drinks & Produtos', icon: Wine },
  { href: '/fichas-tecnicas', label: 'Fichas Técnicas', icon: ClipboardList },
  { href: '/insumos', label: 'Insumos', icon: ShoppingBasket },
  { href: '/baixa', label: 'Importar Vendas', icon: Upload },
  { href: '/transferencias', label: 'Transferências', icon: ArrowLeftRight },
  { href: '/analise', label: 'Análise', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-50 transform transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h1 className="text-xl font-bold">Grupo Ta&apos;On</h1>
            <p className="text-xs text-gray-400 mt-1">Controle de Estoque</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <div className="flex gap-2">
            {['Isla', 'Playa', 'Aura'].map((casa) => (
              <span
                key={casa}
                className={`text-xs px-2 py-1 rounded-full ${
                  casa === 'Isla'
                    ? 'bg-emerald-900 text-emerald-300'
                    : casa === 'Playa'
                    ? 'bg-blue-900 text-blue-300'
                    : 'bg-purple-900 text-purple-300'
                }`}
              >
                {casa}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
