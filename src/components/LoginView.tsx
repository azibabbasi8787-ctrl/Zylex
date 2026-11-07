import React, { useState } from 'react';
import { useAuth, ADMIN_EMAIL } from '../context/AuthContext';
import { BookOpen, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithEmail, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email/username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await loginWithEmail(email.trim(), password, rememberMe);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setErrorMessage('Invalid credentials. Please verify your email and password.');
      } else if (msg.includes('too-many-requests')) {
        setErrorMessage('Too many failed login attempts. Please wait a moment and try again.');
      } else {
        setErrorMessage('Authentication failed. Please check your credentials or network.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      setErrorMessage('Google sign-in failed. Please try again or use your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Logo and Brand */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 shadow-xl shadow-blue-900/40 border border-blue-400/30 mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ZYLEX<span className="text-blue-500">.</span>ACADEMY
          </h1>
          <p className="mt-1 text-sm font-semibold tracking-wide text-blue-400 uppercase">
            Digital Marketing Course
          </p>
          <h2 className="mt-4 text-lg font-medium text-slate-300">
            Welcome to Zylex Academy
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Private, members-only course portal
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-[#0d1527]/95 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email / Username Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Email or Username
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/40"
                />
                <span className="text-xs text-slate-400 font-medium">Remember Me</span>
              </label>
              <span className="text-[11px] text-slate-500">Private Student Access</span>
            </div>

            {/* Login Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0d1527] transition-all shadow-lg shadow-blue-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Log In to Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Admin sign-in convenience */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleAdminGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900/80 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Instructor / Admin Instant Sign-In</span>
            </button>
          </div>

          {/* Private Notice */}
          <div className="mt-6 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 text-center leading-relaxed">
            <span className="font-semibold text-slate-300">Notice:</span> No public self-registration. Course credentials are provided privately to enrolled students by Zylex Academy.
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Zylex Academy. All rights reserved.
        </p>
      </div>
    </div>
  );
};
