import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ExpensesClient from './ExpensesClient';

export default async function OwnerExpensesPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    redirect('/login');
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Owner Expenses</h1>
        <p className="text-slate-600 mt-1">
          Record expenses charged against the owner&apos;s proceeds. These will be deducted in the reports.
        </p>
      </div>

      <ExpensesClient />
    </div>
  );
}
