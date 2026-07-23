'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  ClipboardList,
  Wine,
  BarChart3,
  Upload,
  ArrowLeftRight,
  ShoppingBasket,
  Boxes,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  PlusCircle,
  Users,
  History,
  LogOut,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { useState, createContext, useContext } from 'react';
import Logo from './Logo';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/fichas-tecnicas', label: 'Fichas Técnicas', icon: ClipboardList },
  { href: '/baixa', label: 'Importar Vendas', icon: Upload },
  { href: '/prova-real', label: 'Prova Real', icon: ClipboardCheck },
  { href: '/transferencias', label: 'Transferências', icon: ArrowLeftRight },
  { href: '/analise', label: 'Análise', icon: BarChart3 },
];

const cadastrosItems = [
  { href: '/drinks', label: 'Produtos & Drinks', icon: Wine },
  { href: '/insumos', label: 'Insumos', icon: ShoppingBasket },
];

const adminItems = [
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/historico', label: 'Histórico', icon: History },
];

export const SidebarContext = createContext({ collapsed: false });
export const useSidebar = () => useContext(SidebarContext);

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const { profile, isAdmin, signOut } = useAuth();

  const width = collapsed ? 'w-[68px]' : 'w-52';

  const renderNavItem = (item: { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }) => {
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
            ? 'bg-blue-700 text-white'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span className="font-medium truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <style>{`main.sidebar-main { transition: margin-left 0.2s; } @media (min-width: 1024px) { main.sidebar-main { margin-left: ${collapsed ? '68px' : '208px'}; } }`}</style>

      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg"
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
        className={`fixed top-0 left-0 h-full ${width} bg-slate-900 text-white z-50 transition-all duration-200 transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 !w-52' : '-translate-x-full'
        }`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} border-b border-gray-700`}>
          {collapsed ? (
            <Logo collapsed />
          ) : (
            <div className="min-w-0">
              <Logo />
              <p className="text-[10px] text-gray-400 mt-1">Controle de Estoque</p>
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

        <nav className="mt-2 px-2 flex flex-col h-[calc(100%-60px)]">
          <div className="flex-1 overflow-y-auto">
            {navItems.map(renderNavItem)}

            <div className="mt-2 pt-2 border-t border-gray-700">
              <Link
                href="/estoque?ajustar=true"
                onClick={() => setMobileOpen(false)}
                title={collapsed ? 'Ajustar Estoque' : undefined}
                className={`flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2 rounded-lg text-[13px] bg-blue-600 hover:bg-blue-500 text-white transition-colors`}
              >
                <PlusCircle size={18} className="shrink-0" />
                {!collapsed && <span className="font-medium truncate">Ajustar Estoque</span>}
              </Link>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-700">
              <button
                onClick={() => setCadastrosOpen(!cadastrosOpen)}
                title={collapsed ? 'Cadastros' : undefined}
                className={`flex items-center w-full ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-2 rounded-lg text-[13px] text-gray-400 hover:bg-gray-800 hover:text-white transition-colors`}
              >
                <span className="flex items-center gap-2.5">
                  <Boxes size={18} className="shrink-0" />
                  {!collapsed && <span className="font-medium">Cadastros</span>}
                </span>
                {!collapsed && (
                  <ChevronDown size={14} className={`transition-transform ${cadastrosOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {(cadastrosOpen || collapsed) && (
                <div className={collapsed ? '' : 'ml-3'}>
                  {cadastrosItems.map(renderNavItem)}
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  title={collapsed ? 'Admin' : undefined}
                  className={`flex items-center w-full ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-2 rounded-lg text-[13px] text-gray-400 hover:bg-gray-800 hover:text-white transition-colors`}
                >
                  <span className="flex items-center gap-2.5">
                    <Shield size={18} className="shrink-0" />
                    {!collapsed && <span className="font-medium">Admin</span>}
                  </span>
                  {!collapsed && (
                    <ChevronDown size={14} className={`transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>
                {(adminOpen || collapsed) && (
                  <div className={collapsed ? '' : 'ml-3'}>
                    {adminItems.map(renderNavItem)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pb-3 pt-2 border-t border-gray-700 mt-auto">
            {profile && !collapsed && (
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-white truncate">{profile.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{profile.email}</p>
              </div>
            )}
            <button
              onClick={signOut}
              title={collapsed ? 'Sair' : undefined}
              className={`flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-400 hover:text-white hover:bg-gray-800 transition-colors w-full`}
            >
              <LogOut size={18} className="shrink-0" />
              {!collapsed && <span className="font-medium">Sair</span>}
            </button>
          </div>
        </nav>
      </aside>
    </SidebarContext.Provider>
  );
}
