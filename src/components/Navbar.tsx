import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, LogOut, Video, Users, HelpCircle, BookOpen } from 'lucide-react';

interface NavbarProps {
  activeAdminTab?: 'students' | 'videos' | 'guide';
  onSelectAdminTab?: (tab: 'students' | 'videos' | 'guide') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeAdminTab, onSelectAdminTab }) => {
  const { userProfile, currentUser, isAdmin, logout } = useAuth();

  const displayName = userProfile?.name || currentUser?.displayName || (isAdmin ? 'Admin' : 'Student');
  const displayEmail = userProfile?.email || currentUser?.email || '';

  return (
    <header className="sticky top-0 z-40 bg-[#0b1120]/90 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-900/30 ring-1 ring-blue-400/30">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight text-white">
                ZYLEX<span className="text-blue-500">.</span>ACADEMY
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {isAdmin ? 'Admin Portal' : 'Student Portal'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Digital Marketing Mastercourse</p>
          </div>
        </div>

        {/* Center Admin Navigation Tabs (if admin) */}
        {isAdmin && onSelectAdminTab && (
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onSelectAdminTab('students')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeAdminTab === 'students'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Student Management</span>
            </button>
            <button
              onClick={() => onSelectAdminTab('videos')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeAdminTab === 'videos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Course Videos</span>
            </button>
            <button
              onClick={() => onSelectAdminTab('guide')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeAdminTab === 'guide'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Drive Guide</span>
            </button>
          </nav>
        )}

        {/* Right side user info & logout */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex flex-col text-right">
            <div className="flex items-center justify-end space-x-1.5">
              <span className="text-sm font-semibold text-slate-200">{displayName}</span>
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <span className="text-xs text-slate-400 truncate max-w-[180px]">{displayEmail}</span>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900/90 border border-slate-800 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-all shadow-sm"
            title="Log out of Zylex Academy"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
