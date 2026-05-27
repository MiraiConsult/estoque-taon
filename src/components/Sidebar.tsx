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
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useState, createContext, useContext } from 'react';

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

export const SidebarContext = createContext({ collapsed: false });
export const useSidebar = () => useContext(SidebarContext);

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const width = collapsed ? 'w-[68px]' : 'w-52';
  const mainMargin = collapsed ? 'lg:ml-[68px]' : 'lg:ml-52';

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <style>{`main.sidebar-main { transition: margin-left 0.2s; } @media (min-width: 1024px) { main.sidebar-main { margin-left: ${collapsed ? '68px' : '208px'}; } }`}</style>

      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full ${width} bg-gray-900 text-white z-50 transition-all duration-200 transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 !w-52' : '-translate-x-full'
        }`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} border-b border-gray-700`}>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">Ta&apos;On</h1>
              <p className="text-[10px] text-gray-400">Controle de Estoque</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-gray-400 hover:text-white p-1 rounded"
            title={collapsed ? 'Expandir menu' : 'Minimizar menu'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-2 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2 rounded-lg mb-0.5 transition-colors text-[13px] ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="font-medium truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-700">
            <div className="flex gap-1.5">
              {['Isla', 'Playa', 'Aura'].map((casa) => (
                <span
                  key={casa}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
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
        )}
      </aside>
    </SidebarContext.Provider>
  );
}
