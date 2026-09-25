import React, { useState } from 'react';
import { BrainCircuit, Loader2, AlertCircle, MailCheck } from 'lucide-react';
import { auth } from '../lib/supabase';
import { cn } from '../lib/utils';

type Mode = 'signIn' | 'signUp';

const MIN_PASSWORD_LENGTH = 8;

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signIn') {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // With email confirmation on, there is no session until the link is clicked
        if (!data.session) setCheckEmail(true);
      }
      // On success, App's auth listener swaps this screen for the app
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full p-3 rounded-xl bg-slate-950/50 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-200 placeholder:text-slate-600 transition-all outline-none";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white ring-1 ring-blue-500/50">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-slate-100 tracking-tight">MarketMind AI</span>
        </div>

        <div className="bg-[#0B0F19] rounded-2xl border border-slate-800/80 p-6 shadow-xl">
          {checkEmail ? (
            <div className="text-center space-y-3 py-4">
              <MailCheck className="w-10 h-10 text-blue-400 mx-auto" />
              <h1 className="text-lg font-semibold text-slate-100">Check your email</h1>
              <p className="text-sm text-slate-400">
                We sent a confirmation link to <strong className="text-slate-200">{email}</strong>. Open it to finish creating your account.
              </p>
              <button
                onClick={() => { setCheckEmail(false); setMode('signIn'); }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/60 rounded-xl mb-6" role="tablist">
                {(['signIn', 'signUp'] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => { setMode(m); setError(null); }}
                    className={cn(
                      "py-2 rounded-lg text-sm font-semibold transition-colors",
                      mode === m ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {m === 'signIn' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-1.5">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                  {mode === 'signUp' && (
                    <p className="text-xs text-slate-500 mt-1">At least {MIN_PASSWORD_LENGTH} characters.</p>
                  )}
                </div>

                {error && (
                  <p role="alert" className="text-xs text-rose-400 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mode === 'signIn' ? 'Sign in' : 'Create account'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 leading-relaxed">
          Simulated focus groups with AI personas. Your simulations are private to your account.
        </p>
      </div>
    </div>
  );
}
