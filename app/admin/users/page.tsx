'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Invite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  inviter?: { name?: string; email?: string };
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;

  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER'>('PROPERTY_MANAGER');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Move role check after hooks, use effect for redirect
  useEffect(() => {
    if (status !== 'loading' && (!role || !['ADMIN', 'OWNER'].includes(role))) {
      window.location.href = '/login';
    }
  }, [status, role]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch('/api/admin/invites');
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchInvites();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to send invite' });
      } else {
        setMessage({ type: 'success', text: `Invite sent to ${email}` });
        setEmail('');
        fetchInvites();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (inviteId: string, inviteEmail: string) => {
    if (!confirm(`Resend invite to ${inviteEmail}?`)) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/invites/${inviteId}/resend`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to resend invite' });
      } else {
        setMessage({ type: 'success', text: `Invite resent to ${inviteEmail}` });
        fetchInvites();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (inviteId: string, inviteEmail: string) => {
    if (!confirm(`Delete invite for ${inviteEmail}?`)) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/invites/${inviteId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete invite' });
      } else {
        setMessage({ type: 'success', text: `Invite for ${inviteEmail} deleted` });
        fetchInvites();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string, userEmail: string) => {
    if (!confirm(`Change role for ${userEmail} to ${newRole}?`)) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update role' });
      } else {
        setMessage({ type: 'success', text: `Role updated for ${userEmail}` });
        fetchUsers();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    if (!confirm(`Send password reset invite to ${userEmail}? They will receive an email to set a new password.`)) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to send reset' });
      } else {
        setMessage({ type: 'success', text: data.message || `Password reset invite sent to ${userEmail}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (!role || !['ADMIN', 'OWNER'].includes(role)) {
    return <div className="p-8">Redirecting to login...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-semibold mb-6">Users &amp; Invites</h1>

      {/* Users List */}
      <div className="bg-white rounded-2xl border mb-8">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Users</h2>
        </div>
        <div className="divide-y">
          {users.length === 0 && (
            <div className="p-6 text-sm text-slate-600">No users found.</div>
          )}
          {users.map((user) => (
            <div key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{user.name || user.email}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Created {new Date(user.createdAt).toLocaleDateString()}
                  {user.emailVerified && ' • Verified'}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                {/* Role reassignment */}
                <select
                  value={user.role}
                  onChange={(e) => handleUpdateRole(user.id, e.target.value, user.email)}
                  disabled={loading}
                  className="border rounded px-3 py-1 text-sm disabled:opacity-50"
                >
                  <option value="PROPERTY_MANAGER">Property Manager</option>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                </select>

                <button
                  onClick={() => handleResetPassword(user.id, user.email)}
                  disabled={loading}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 whitespace-nowrap"
                >
                  Reset Password
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-6 mb-8">
        <h2 className="font-semibold mb-4">Invite New User</h2>

        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 border rounded-lg px-4 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
            className="border rounded-lg px-4 py-2 text-sm"
          >
            <option value="PROPERTY_MANAGER">Property Manager</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
          >
            {loading ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-2">Admins can invite anyone. Owners cannot invite Admins.</p>
      </div>

      <div className="bg-white rounded-2xl border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Pending Invites</h2>
        </div>
        <div className="divide-y">
          {invites.length === 0 && (
            <div className="p-6 text-sm text-slate-600">No pending invites.</div>
          )}
          {invites.map((invite) => (
            <div key={invite.id} className="p-4 flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">{invite.email}</div>
                <div className="text-xs text-slate-500">
                  {invite.role} • Invited by {invite.inviter?.name || invite.inviter?.email || 'Admin'} • Expires {new Date(invite.expiresAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResend(invite.id, invite.email)}
                  disabled={loading}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                >
                  Resend
                </button>
                <button
                  onClick={() => handleDelete(invite.id, invite.email)}
                  disabled={loading}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
