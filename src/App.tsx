import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/auth-js';
import { Target, BarChart2, MessageCircle, BrainCircuit, History, LogOut, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from './lib/utils';
import { CustomerForm } from './components/CustomerForm';
import { InsightsViewer } from './components/InsightsViewer';
import { PersonaChat, type ChatMessage } from './components/PersonaChat';
import { HistoryPanel } from './components/HistoryPanel';
import { AuthScreen } from './components/AuthScreen';
import { GuestAccountCard } from './components/GuestAccountCard';
import { RunActions } from './components/RunActions';
import * as api from './lib/api';
import { auth, isSupabaseConfigured } from './lib/supabase';
import { variantCount, variantTexts } from './lib/variants';
import type { Persona, CustomerData, Panel, SavedRun, SimulateRequest } from './lib/types';

type Tab = 'data' | 'insights' | 'chat' | 'history';

// Preset sample profile containing all 6 parameters matching the smart meal prep theme
const initialCustomerData: CustomerData = {
  ageRange: '28-40 years old',
  gender: 'All genders (slight skew towards eco-conscious urban couples)',
  habits: 'Interested in smart energy, remote workspace setups, health tracking, and zero-waste meal preps',
  location: 'Metropolitan apartment renters, smart-grid integrated suburbs',
  incomeLevel: '$90k+ household income',
  questionOrProductInfo: 'Would you pay a $15/monthly subscription for a unified smart home appliance manager and automatic grocery tracker that optimizes waste and reduces carbon footprints?'
};

// Remembers which run was open, per browser (a convenience only)
const ACTIVE_RUN_KEY = 'marketmind.activeRun.v1';
function rememberActiveRun(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_RUN_KEY, id);
    else localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // storage unavailable — nothing to remember
  }
}
function recallActiveRun(): string | null {
  try {
    return localStorage.getItem(ACTIVE_RUN_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SetupRequired />;
  if (!authReady) return <FullScreenMessage><Loader2 className="w-5 h-5 animate-spin" /> Loading...</FullScreenMessage>;
  if (!session) return <AuthScreen />;
  // Keyed by user so signing in as someone else starts from a clean state
  return (
    <Workspace
      key={session.user.id}
      email={session.user.email ?? ''}
      isGuest={session.user.is_anonymous === true}
    />
  );
}

function Workspace({ email, isGuest }: { email: string; isGuest: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('data');

  // Saved data from the API
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading');

  // What's on screen: the open saved run, or a simulation in progress
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData>(initialCustomerData);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [insights, setInsights] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<SimulateRequest | null>(null);

  // Streaming partial text while report is being generated
  const [streamingReport, setStreamingReport] = useState<string>("");

  // Error state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  // Panel pre-selected in the setup form, and a key to re-mount the form when it changes
  const [formPanelId, setFormPanelId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const currentRun = runs.find((r) => r.id === currentRunId) ?? null;

  // Variants the on-screen personas actually answered (A, or A/B/C)
  const variants = variantTexts(customerData).slice(0, variantCount(personas));

  const showRun = useCallback((run: SavedRun) => {
    setCustomerData(run.customerData);
    setPersonas(run.personas);
    setInsights(run.report);
    setStreamingReport("");
    setErrorMsg(null);
    setCurrentRunId(run.id);
    rememberActiveRun(run.id);
  }, []);

  const loadData = useCallback(async () => {
    setDataState('loading');
    try {
      const [loadedRuns, loadedPanels] = await Promise.all([api.listRuns(), api.listPanels()]);
      setRuns(loadedRuns);
      setPanels(loadedPanels);
      setDataState('ready');

      // Re-open the run that was open last time
      const remembered = loadedRuns.find((r) => r.id === recallActiveRun());
      if (remembered) {
        showRun(remembered);
        setActiveTab('insights');
      }
    } catch (err) {
      console.error(err);
      setDataState('error');
    }
  }, [showRun]);

  useEffect(() => { loadData(); }, [loadData]);

  const replaceRun = (run: SavedRun) => {
    setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
  };

  const updateTranscript = (personaIdx: number, messages: ChatMessage[]) => {
    if (!currentRunId) return;
    const runId = currentRunId;
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, chats: { ...r.chats, [personaIdx]: messages } } : r)));
  };

  const openRun = (run: SavedRun) => {
    showRun(run);
    setActiveTab('insights');
  };

  const removeRun = async (id: string) => {
    try {
      await api.deleteRun(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
      if (id === currentRunId) {
        // Keep the results on screen, but they are no longer saved
        setCurrentRunId(null);
        rememberActiveRun(null);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete the simulation.');
    }
  };

  const removePanel = async (id: string) => {
    try {
      await api.deletePanel(id);
      setPanels((prev) => prev.filter((p) => p.id !== id));
      // Runs keep their personas; the link to the deleted panel is cleared server-side
      setRuns((prev) => prev.map((r) => (r.panelId === id ? { ...r, panelId: null } : r)));
      if (formPanelId === id) setFormPanelId(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete the panel.');
    }
  };

  const askPanel = (panelId: string) => {
    setFormPanelId(panelId);
    setFormKey((k) => k + 1);
    setActiveTab('data');
  };

  const handleGenerateInsights = async (request: SimulateRequest) => {
    const { panelId, ...data } = request;
    const panel = panelId ? panels.find((p) => p.id === panelId) : undefined;
    // Show the panel's demographics alongside the new question
    setCustomerData(panel ? { ...panel.customerData, ...data } : data);
    setLastRequest(request);
    setFormPanelId(panelId ?? null);
    setIsGenerating(true);

    // Reset all states before starting a new simulation
    setErrorMsg(null);
    setPersonas([]);
    setInsights(null);
    setStreamingReport("");
    setCurrentRunId(null);
    rememberActiveRun(null);
    setActiveTab('insights');

    try {
      // The server generates the 10 personas, then streams the strategic report.
      // Each streamed chunk goes into streamingReport so the UI renders live.
      setProgressMsg(panel
        ? `⚡ Step 1/2 — Re-convening panel "${panel.name}"...`
        : "⚡ Step 1/2 — Recruiting 10 AI consumer agents...");
      let accumulated = "";
      const run = await api.runSimulation(request, {
        onPersonas: (focusGroupPersonas) => {
          setPersonas(focusGroupPersonas);
          setProgressMsg("📝 Step 2/2 — Streaming macro-level strategic report...");
        },
        onReportChunk: (delta) => {
          accumulated += delta;
          setStreamingReport(accumulated);
        },
      });

      // The server saved the run; make it the open one
      setRuns((prev) => [run, ...prev]);
      showRun(run);

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An unexpected error occurred during the simulation. Please check your network connection.');
    } finally {
      setIsGenerating(false);
      setProgressMsg("");
    }
  };

  const regenerate = () => {
    const request: SimulateRequest = { ...(lastRequest ?? customerData) };
    // Don't reference a panel that has since been deleted
    if (request.panelId && !panels.some((p) => p.id === request.panelId)) delete request.panelId;
    handleGenerateInsights(request);
  };

  // When a saved run is open, "Re-simulate" repeats it (with its panel, if any)
  useEffect(() => {
    if (currentRun) {
      setLastRequest({ ...currentRun.customerData, ...(currentRun.panelId ? { panelId: currentRun.panelId } : {}) });
    }
  }, [currentRun?.id]);

  const navItems = [
    { id: 'data', label: '1. Setup Simulation', icon: Target },
    { id: 'insights', label: '2. Focus Group Data', icon: BarChart2 },
    { id: 'chat', label: '3. 1-on-1 Interviews', icon: MessageCircle },
    { id: 'history', label: 'Saved Simulations', icon: History },
  ] as const;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans text-slate-100">

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0B0F19] border-r border-slate-800/60 flex flex-col shrink-0 z-10">
        <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm ring-1 ring-blue-500/50">
            <BrainCircuit className="w-5 h-5 animate-pulse" />
          </div>
          <span className="font-bold text-slate-100 tracking-tight">MarketMind AI</span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all group border border-transparent",
                activeTab === item.id
                  ? "bg-blue-500/10 text-blue-450 border-blue-500/15"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <item.icon className={cn(
                "w-4.5 h-4.5 transition-colors",
                activeTab === item.id ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
              )} />
              {item.label}

              {item.id === 'history' && runs.length > 0 && (
                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded tabular-nums">{runs.length}</span>
              )}

              {item.id === 'insights' && (insights || streamingReport) && activeTab !== 'insights' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 pt-0 mt-auto space-y-4">
          {isGuest ? (
            <GuestAccountCard />
          ) : (
            <div className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-2xl border border-blue-500/15">
              <p className="text-xs font-semibold text-blue-300 mb-1">Empirical Focus Group</p>
              <p className="text-[11px] text-blue-200/50 leading-relaxed">
                I recruit, simulate, and analyze 10 specific consumer avatars to stress test your messaging and questions.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-xs text-slate-500 truncate" title={isGuest ? 'Guest session' : email}>
              {isGuest ? 'Guest' : email}
            </span>
            <button
              onClick={() => { rememberActiveRun(null); auth.signOut(); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
              title={isGuest ? 'End the guest session' : 'Sign out'}
            >
              <LogOut className="w-3.5 h-3.5" /> {isGuest ? 'Exit guest' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full relative">
        <div className="max-w-6xl mx-auto p-6 md:p-10 min-h-full">

          {/* Header */}
          <header className="mb-8 md:mb-12">
            <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
              {activeTab === 'data' && 'Focus Group Configuration'}
              {activeTab === 'insights' && 'Simulated Focus Group Results'}
              {activeTab === 'chat' && '1-on-1 Consumer Interviews'}
              {activeTab === 'history' && 'Saved Simulations'}
            </h1>
            <p className="text-slate-400 mt-2 text-sm sm:text-base">
              {activeTab === 'data' && 'Fine-tune demographic rules and enter your product or market queries.'}
              {activeTab === 'insights' && 'Analyze general enthusiasm, custom answers, and executive macro reports.'}
              {activeTab === 'chat' && 'Interview simulated participants individually to query exact psychological insights.'}
              {activeTab === 'history' && 'Reopen past simulations and re-use saved persona panels.'}
            </p>
          </header>

          {dataState === 'error' && (
            <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 text-sm text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Couldn’t load your saved simulations.
              <button onClick={loadData} className="ml-auto font-semibold text-rose-100 hover:underline">Retry</button>
            </div>
          )}

          {/* Active Workviews */}
          <div className="pb-12">
            {activeTab === 'data' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CustomerForm
                  key={formKey}
                  initialData={customerData}
                  panels={panels}
                  initialPanelId={formPanelId}
                  onSubmit={handleGenerateInsights}
                  isLoading={isGenerating}
                />
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <InsightsViewer
                  insights={insights}
                  streamingReport={streamingReport}
                  personas={personas}
                  variants={variants}
                  progressMsg={progressMsg}
                  errorMsg={errorMsg}
                  onRegenerate={regenerate}
                  isLoading={isGenerating}
                  actions={currentRun && !isGenerating ? (
                    <RunActions
                      run={currentRun}
                      panels={panels}
                      isGuest={isGuest}
                      onRunUpdated={replaceRun}
                      onPanelCreated={(panel) => setPanels((prev) => [panel, ...prev])}
                    />
                  ) : undefined}
                />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PersonaChat
                  personas={personas}
                  variants={variants}
                  chats={currentRun?.chats ?? {}}
                  runId={isGenerating ? null : currentRunId}
                  onTranscript={updateTranscript}
                />
              </div>
            )}

            {activeTab === 'history' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {dataState === 'loading' ? (
                  <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                  </div>
                ) : (
                  <HistoryPanel
                    runs={runs}
                    panels={panels}
                    currentRunId={currentRunId}
                    onOpen={openRun}
                    onDelete={removeRun}
                    onUsePanel={askPanel}
                    onDeletePanel={removePanel}
                    isLoading={isGenerating}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-3 p-6 text-slate-400">
      {children}
    </div>
  );
}

function SetupRequired() {
  return (
    <FullScreenMessage>
      <div className="max-w-md text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <h1 className="text-lg font-semibold text-slate-100">Supabase is not configured</h1>
        <p className="text-sm">
          Set <code className="text-slate-200">VITE_SUPABASE_URL</code> and <code className="text-slate-200">VITE_SUPABASE_ANON_KEY</code> in <code className="text-slate-200">.env</code>, then restart the server. See the README for setup steps.
        </p>
      </div>
    </FullScreenMessage>
  );
}
