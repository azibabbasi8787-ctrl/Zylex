/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { StudentPanel } from './components/StudentPanel';
import { AdminPanel } from './components/AdminPanel';
import { AccountBlockedView } from './components/AccountBlockedView';
import { BookOpen } from 'lucide-react';

const MainPortal: React.FC = () => {
  const { currentUser, isAdmin, isBlocked, isRevoked, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-900/40 animate-pulse">
          <BookOpen className="w-7 h-7 text-white" />
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>Verifying Zylex Academy Credentials...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login View
  if (!currentUser) {
    return <LoginView />;
  }

  // If user is blocked or revoked (and not the administrator)
  if (!isAdmin && (isBlocked || isRevoked)) {
    return <AccountBlockedView />;
  }

  // If administrator
  if (isAdmin) {
    return <AdminPanel />;
  }

  // Otherwise Student Panel
  return <StudentPanel />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainPortal />
    </AuthProvider>
  );
}
