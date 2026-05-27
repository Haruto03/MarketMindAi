import React, { useState } from 'react';
import { Sparkles, Users, Compass, MapPin, DollarSign, HelpCircle, UserCheck, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { type CustomerData, DIVERSE_RANDOM } from '../lib/gemini';

interface CustomerFormProps {
  initialData: CustomerData;
  onSubmit: (data: CustomerData) => void;
  isLoading: boolean;
}

export function CustomerForm({ initialData, onSubmit, isLoading }: CustomerFormProps) {
  const [data, setData] = useState<CustomerData>({
    ageRange:             initialData.ageRange             ?? '',
    gender:               initialData.gender               ?? '',
    habits:               initialData.habits               ?? '',
    location:             initialData.location             ?? '',
    incomeLevel:          initialData.incomeLevel          ?? '',
    questionOrProductInfo: initialData.questionOrProductInfo ?? '',
  });

  // Holds an error message for the required field; null means no error
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ── Required field guard ────────────────────────────────────────────────
    const trimmedQuestion = (data.questionOrProductInfo ?? '').trim();
    if (!trimmedQuestion) {
      setValidationError(
        'This field is required. Please describe your product concept and the specific question you want to ask the focus group.'
      );
      return;
    }
    setValidationError(null);

    // ── Optional field fallback injection ──────────────────────────────────
    // Any optional field left blank by the user receives the DIVERSE_RANDOM
    // sentinel. The prompt builder in gemini.ts detects this value and
    // instructs the LLM to maximise demographic variance across all 10
    // personas for that dimension, producing a "wildcard" focus group.
    const payload: CustomerData = {
      ageRange:             data.ageRange?.trim()    || DIVERSE_RANDOM,
      gender:               data.gender?.trim()      || DIVERSE_RANDOM,
      habits:               data.habits?.trim()      || DIVERSE_RANDOM,
      location:             data.location?.trim()    || DIVERSE_RANDOM,
      incomeLevel:          data.incomeLevel?.trim() || DIVERSE_RANDOM,
      questionOrProductInfo: trimmedQuestion,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-[#0B0F19] rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden bg-gradient-to-b from-white/[0.015] to-transparent">

        {/* Header Block */}
        <div className="p-6 border-b border-slate-800/60 bg-gradient-to-r from-blue-500/5 to-transparent flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">Focus Group Setup</h2>
            <p className="text-sm text-slate-400">
              Configure parameters to simulate the audience profile. Optional fields are auto-filled with realistic values if left blank.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Field 1: Target Age Range — optional */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400" />
                Target Age Range
                <span className="text-xs text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="w-full p-3 rounded-xl bg-slate-950/50 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-200 placeholder:text-slate-600 transition-all outline-none"
                placeholder="e.g., 20-35 years old — or leave blank to auto-fill"
                value={data.ageRange}
                onChange={(e) => setData({ ...data, ageRange: e.target.value })}
              />
            </div>

            {/* Field 2: Gender Preferences — optional */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Gender Preferences
                <span className="text-xs text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="w-full p-3 rounded-xl bg-slate-950/50 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-200 placeholder:text-slate-600 transition-all outline-none"
                placeholder="e.g., All genders, female skew — or leave blank to auto-fill"
                value={data.gender}
                onChange={(e) => setData({ ...data, gender: e.target.value })}
              />
            </div>

            {/* Field 3: Habits / Lifestyle — optional */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                Habits & Lifestyle
                <span className="text-xs text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full min-h-[82px] p-3 rounded-xl bg-slate-950/50 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-200 placeholder:text-slate-600 transition-all outline-none resize-y"
                placeholder="e.g., Passionate about cooking, works remote — or leave blank to auto-fill"
                value={data.habits}
                onChange={(e) => setData({ ...data, habits: e.target.value })}
              />
            </div>

            {/* Field 4: Location — optional */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                Location Context
                <span className="text-xs text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                className="w-full min-h-[82px] p-3 rounded-xl bg-slate-950/50 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-200 placeholder:text-slate-600 transition-all outline-none resize-y"
                placeholder="e.g., Urban areas, Tokyo & San Francisco — or leave blank to auto-fill"
                value={data.location}
                onChange={(e) => setData({ ...data, location: e.target.value })}
              />
            </div>

            {/* Field 5: Income Level — optional, full width */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                Income Level Bracket
                <span className="text-xs text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="w-full p-3 rounded-xl bg-slate-950/50 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-200 placeholder:text-slate-600 transition-all outline-none"
                placeholder="e.g., Middle income ($60k–$90k) — or leave blank to auto-fill"
                value={data.incomeLevel}
                onChange={(e) => setData({ ...data, incomeLevel: e.target.value })}
              />
            </div>

            {/* Field 6: Question / Product Info — REQUIRED */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                Question / Product Concept Info
                <span className="text-rose-400 ml-0.5" aria-hidden="true">*</span>
                <span className="text-xs text-rose-400 font-semibold">Required</span>
              </label>
              <textarea
                className={cn(
                  "w-full min-h-[120px] p-3 rounded-xl bg-slate-950/50 border focus:ring-4 text-slate-200 placeholder:text-slate-600 transition-all outline-none resize-y",
                  validationError
                    ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/10"
                    : "border-slate-800 focus:border-blue-500 focus:ring-blue-500/10"
                )}
                placeholder="Describe your product concept and the specific question you want the focus group to answer. (e.g., 'Would you pay $15/month for a smart home appliance manager that reduces food waste? What features matter most to you?')"
                value={data.questionOrProductInfo}
                onChange={(e) => {
                  setData({ ...data, questionOrProductInfo: e.target.value });
                  // Clear the validation error as soon as the user starts typing
                  if (validationError) setValidationError(null);
                }}
                aria-required="true"
                aria-invalid={validationError !== null}
                aria-describedby={validationError ? "question-error" : undefined}
              />
              {validationError && (
                <p
                  id="question-error"
                  role="alert"
                  className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {validationError}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Submit Block */}
        <div className="p-6 bg-slate-900/40 border-t border-slate-800/60 flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-900/20 active:translate-y-0.5",
              isLoading ? "opacity-75 cursor-not-allowed" : "hover:-translate-y-0.5"
            )}
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Simulate Focus Group
          </button>
        </div>
      </div>
    </form>
  );
}
