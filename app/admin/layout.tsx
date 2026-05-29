export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6 text-sm">
          <div className="font-semibold text-slate-900">Bayfront Retreat • Admin</div>
          <a href="/admin/requests" className="text-slate-700 hover:text-slate-900">Requests</a>
          <a href="/admin/holidays" className="text-slate-700 hover:text-slate-900">Holidays & Peaks</a>
        </div>
      </nav>
      {children}
    </div>
  );
}
