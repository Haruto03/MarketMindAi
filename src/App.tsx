import React, { useEffect, useState } from 'react';
import { Target, BarChart2, MessageCircle, BrainCircuit, History } from 'lucide-react';
import { cn } from './lib/utils';
import { CustomerForm } from './components/CustomerForm';
import { InsightsViewer } from './components/InsightsViewer';
import { PersonaChat, type ChatMessage } from './components/PersonaChat';
import { HistoryPanel } from './components/HistoryPanel';
import { runSimulation } from './lib/api';
import {
  deleteRun, getActiveRunId, listRuns, newRunId, saveRun, setActiveRunId, type SavedRun,
} from './lib/history';
import { variantCount, variantTexts } from './lib/variants';
import type { Persona, CustomerData } from './lib/types';

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

/** The run that was open when the page was last closed, if it is still saved. */
function restoreActiveRun(): SavedRun | null {
  const id = getActiveRunId();
  return id ? listRuns().find((r) => r.id === id) ?? null : null;
}

export default function App() {
  const [restored] = useState(restoreActiveRun);

  const [activeTab, setActiveTab] = useState<Tab>(restored ? 'insights' : 'data');
  const [customerData, setCustomerData] = useState<CustomerData>(restored?.customerData ?? initialCustomerData);
  const [personas, setPersonas] = useState<Persona[]>(restored?.personas ?? []);
  const [insights, setInsights] = useState<string | null>(restored?.report ?? null);

  // Interview transcripts keyed by persona index; saved with the run
  const [chats, setChats] = useState<Record<number, ChatMessage[]>>(restored?.chats ?? {});

  // Saved runs and which one is on screen (null while a new one is generating)
  const [runs, setRuns] = useState<SavedRun[]>(listRuns);
  const [currentRunId, setCurrentRunId] = useState<string | null>(restored?.id ?? null);

  // Streaming partial text while report is being generated
  const [streamingReport, setStreamingReport] = useState<string>("");

  // Error state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  // Variants the on-screen personas actually answered (A, or A/B/C)
  const variants = variantTexts(customerData).slice(0, variantCount(personas));

  // Keep the saved copy of the open run in sync with its interview transcripts
  useEffect(() => {
    if (!currentRunId) return;
    const run = listRuns().find((r) => r.id === currentRunId);
    if (run) setRuns(saveRun({ ...run, chats }));
  }, [chats, currentRunId]);

  const updateChat = (personaIdx: number, update: (messages: ChatMessage[]) => ChatMessage[]) => {
    setChats((prev) => ({ ...prev, [personaIdx]: update(prev[personaIdx] ?? []) }));
  };

  const openRun = (run: SavedRun) => {
    setCustomerData(run.customerData);
    setPersonas(run.personas);
    setInsights(run.report);
    setChats(run.chats ?? {});
    setStreamingReport("");
    setErrorMsg(null);
    setCurrentRunId(run.id);
    setActiveRunId(run.id);
    setActiveTab('insights');
  };

  const removeRun = (id: string) => {
    setRuns(deleteRun(id));
    if (id === currentRunId) {
      // Keep the results on screen, but stop saving changes to the deleted run
      setCurrentRunId(null);
      setActiveRunId(null);
    }
  };

  const handleGenerateInsights = async (data: CustomerData) => {
    setCustomerData(data);
    setIsGenerating(true);

    // Reset all states before starting a new simulation
    setErrorMsg(null);
    setPersonas([]);
    setInsights(null);
    setStreamingReport("");
    setChats({});
    setCurrentRunId(null);
    setActiveRunId(null);
    setActiveTab('insights');

    try {
      // The server generates the 10 personas, then streams the strategic report.
      // Each streamed chunk goes into streamingReport so the UI renders live.
      setProgressMsg("⚡ Step 1/2 — Recruiting 10 AI consumer agents...");
      let accumulated = "";
      let generated: Persona[] = [];
      const finalText = await runSimulation(data, {
        onPersonas: (focusGroupPersonas) => {
          generated = focusGroupPersonas;
          setPersonas(focusGroupPersonas);
          setProgressMsg("📝 Step 2/2 — Streaming macro-level strategic report...");
        },
        onReportChunk: (delta) => {
          accumulated += delta;
          setStreamingReport(accumulated);
        },
      });
      setInsights(finalText);
      setStreamingReport("");

      // Save the completed run to history and make it the open one
      const run: SavedRun = {
        id: newRunId(),
        createdAt: new Date().toISOString(),
        customerData: data,
        personas: generated,
        report: finalText,
        chats: {},
      };
      setRuns(saveRun(run));
      setCurrentRunId(run.id);
      setActiveRunId(run.id);

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An unexpected error occurred during the simulation. Please check your network connection.');
    } finally {
      setIsGenerating(false);
      setProgressMsg("");
    }
  };

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

        <div className="p-6 pt-0 mt-auto">
          <div className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 rounded-2xl border border-blue-500/15">
            <p className="text-xs font-semibold text-blue-300 mb-1">Empirical Focus Group</p>
            <p className="text-[11px] text-blue-200/50 leading-relaxed">
              I recruit, simulate, and analyze 10 specific consumer avatars to stress test your messaging and questions.
            </p>
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
              {activeTab === 'history' && 'Reopen past simulations, their reports and interview transcripts.'}
            </p>
          </header>

          {/* Active Workviews */}
          <div className="pb-12">
            {activeTab === 'data' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CustomerForm
                  initialData={customerData}
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
                  onRegenerate={() => handleGenerateInsights(customerData)}
                  isLoading={isGenerating}
                />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PersonaChat
                  personas={personas}
                  variants={variants}
                  chats={chats}
                  onUpdateChat={updateChat}
                />
              </div>
            )}

            {activeTab === 'history' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <HistoryPanel
                  runs={runs}
                  currentRunId={currentRunId}
                  onOpen={openRun}
                  onDelete={removeRun}
                  isLoading={isGenerating}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}