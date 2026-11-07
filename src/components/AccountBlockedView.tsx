import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut, Mail, BookOpen } from 'lucide-react';

export const AccountBlockedView: React.FC = () => {
  const { userProfile, currentUser, logout, isBlocked } = useAuth();

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-md w-full bg-[#0d1527] border border-slate-800 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-rose-600/10 blur-3xl pointer-events-none" />

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">
          {isBlocked ? 'Course Access Suspended' : 'Course Access Revoked'}
        </h2>

        <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {isBlocked
            ? 'Your student account access has been temporarily blocked by the Zylex Academy administrator.'
            : 'Your enrollment access to the Digital Marketing Course portal has been revoked.'}
        </p>

        <div className="mt-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 text-left text-xs space-y-2">
          <div className="text-slate-400 flex justify-between">
            <span>Account:</span>
            <span className="font-medium text-slate-200">{userProfile?.email || currentUser?.email}</span>
          </div>
          <div className="text-slate-400 flex justify-between">
            <span>Status:</span>
            <span className="font-semibold text-rose-400 uppercase tracking-wide">
              {userProfile?.status || 'Blocked'}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col space-y-3">
          <a
            href="mailto:support@zylexacademy.com"
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all"
          >
            <Mail className="w-4 h-4 text-slate-400" />
            <span>Contact Course Instructor</span>
          </a>

          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md shadow-rose-900/30"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center space-x-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span>Zylex Academy &bull; Private Portal</span>
        </div>
      </div>
    </div>
  );
};
