import React, { useState } from 'react';
import { AlertCircle, Loader2, MailCheck, UserRound } from 'lucide-react';
import { auth } from '../lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Sidebar card shown while browsing as a guest. Adding an email and password
 * upgrades the anonymous user in place (Supabase keeps the same user id), so
 * everything the guest has already run stays with the new account.
 */
export function GuestAccountCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await auth.updateUser({ email, password });
      if (error) throw error;
      // With email confirmation on, the account becomes permanent once the
      // link is opened; the current session keeps working either way.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full p-2 rounded-lg bg-slate-950/60 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-200 text-xs placeholder:text-slate-600 transition-all outline-none";

  if (sent) {
    return (
      <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 space-y-2">
        <MailCheck className="w-5 h-5 text-blue-300" />
        <p className="text-xs font-semibold text-blue-200">Check your email</p>
        <p className="text-[11px] text-blue-200/60 leading-relaxed">
          Open the link we sent to <strong className="text-blue-100">{email}</strong> to finish setting up your
          account. Your simulations are already attached to it.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
        <UserRound className="w-3.5 h-3.5" /> Browsing as a guest
      </p>
      <p className="text-[11px] text-amber-200/60 leading-relaxed">
        Your work is saved to this browser only, with a smaller hourly allowance and no public share links.
        Add an email to keep it.
      </p>

      {open ? (
        <form onSubmit={submit} className="space-y-2 pt-1">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            aria-label="Email"
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder={`Password (${MIN_PASSWORD_LENGTH}+ characters)`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            aria-label="Password"
          />
          {error && (
            <p role="alert" className="text-[11px] text-rose-400 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              Save my work
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="px-3 py-2 text-xs text-amber-200/70 hover:text-amber-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
        >
          Create a free account
        </button>
      )}
    </div>
  );
}
