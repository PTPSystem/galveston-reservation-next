'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/admin/requests", label: "Booking Requests", minRole: "PROPERTY_MANAGER" },
    { href: "/admin/rates", label: "Rates & Pricing", minRole: "PROPERTY_MANAGER" },
    { href: "/admin/holidays", label: "Holidays, Peaks & Blocked Dates", minRole: "PROPERTY_MANAGER" },
    { href: "/admin/expenses", label: "Owner Expenses", minRole: "PROPERTY_MANAGER" },
    { href: "/admin/reports", label: "Reports", minRole: "PROPERTY_MANAGER" },
    { href: "/admin/users", label: "Users & Invites", minRole: "OWNER" },
    { href: "/admin/emails", label: "Email Recipients", minRole: "PROPERTY_MANAGER" },
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER' | undefined;

  const roleOrder = { PROPERTY_MANAGER: 1, OWNER: 2, ADMIN: 3 };
  const currentRoleLevel = userRole ? roleOrder[userRole] : 0;

  const visibleNavItems = navItems.filter((item) => {
    const minLevel = roleOrder[item.minRole as keyof typeof roleOrder] || 1;
    return currentRoleLevel >= minLevel;
  });

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-14">
          <div>
            <div className="font-semibold text-base text-slate-900">Bayfront Retreat</div>
            <div className="text-[10px] text-slate-500 -mt-0.5">Admin Portal</div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            className="p-2 -mr-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {/* Hamburger icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar (lg+) */}
        <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col min-h-[calc(100vh-0px)] lg:min-h-screen">
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="font-semibold text-lg text-slate-900">Bayfront Retreat</div>
            <div className="text-sm text-slate-500">Admin Portal</div>
          </div>

          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-1">
              {visibleNavItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block px-4 py-2.5 text-sm rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-2">
            <UserInfo />
            <a href="/" className="hover:text-slate-700 block">← Back to Website</a>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Slide-in Drawer */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            onClick={closeMobileMenu}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-white z-[60] shadow-2xl flex flex-col lg:hidden transform transition-transform duration-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg text-slate-900">Bayfront Retreat</div>
                <div className="text-sm text-slate-500">Admin Portal</div>
              </div>
              <button
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="p-2 -mr-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <ul className="space-y-1">
                {visibleNavItems.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={closeMobileMenu}
                      className="block px-4 py-3 text-[15px] rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="p-4 border-t border-slate-200 text-sm text-slate-500">
              <a href="/" onClick={closeMobileMenu} className="hover:text-slate-700 block py-1">← Back to Website</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserInfo() {
  const { data: session } = useSession();

  if (!session?.user) {
    return <a href="/login" className="hover:text-slate-700">Sign in</a>;
  }

  const user = session.user as any;

  return (
    <div className="space-y-1">
      <div className="font-medium text-slate-900">{user.name || user.email}</div>
      <div className="text-[10px] text-emerald-600 font-medium">{user.role}</div>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-[10px] text-red-600 hover:text-red-700"
      >
        Sign out
      </button>
    </div>
  );
}
