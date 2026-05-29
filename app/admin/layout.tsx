export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { href: "/admin/requests", label: "Booking Requests" },
    { href: "/admin/rates", label: "Rates & Pricing" },
    { href: "/admin/holidays", label: "Holidays & Peak Periods" },
    { href: "/admin/emails", label: "Email Recipients" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-5 border-b">
          <div className="font-semibold text-lg text-slate-900">Bayfront Retreat</div>
          <div className="text-sm text-slate-500">Admin Portal</div>
        </div>

        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
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

        <div className="p-4 border-t text-xs text-slate-500">
          <a href="/" className="hover:text-slate-700">← Back to Website</a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
