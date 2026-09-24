import React, { useState, useRef, useEffect } from 'react';
import { Send, UserCheck, Bot, User, Loader2, MessageCircle, Info } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { sendChatMessage } from '../lib/api';
import type { ChatTurn, Persona } from '../lib/types';
import { VARIANT_LETTERS } from '../lib/variants';

export type ChatMessage = ChatTurn;

interface PersonaChatProps {
  personas: Persona[];
  /** Variant texts [A, B, C…] the personas answered. */
  variants: string[];
  /** Transcripts keyed by persona index (owned by App so they can be saved). */
  chats: Record<number, ChatMessage[]>;
  onUpdateChat: (personaIdx: number, update: (messages: ChatMessage[]) => ChatMessage[]) => void;
}

function greetingFor(persona: Persona, variants: string[]): ChatMessage {
  const question = variants[0] || "your product concept";
  const others = (persona.alternatives ?? [])
    .map((alt, i) => `Variant ${VARIANT_LETTERS[i + 1]}: ${alt.sentimentScore}/100`)
    .join(', ');
  return {
    role: 'model',
    text: `Hi there! I'm ${persona.name} (${persona.age} y/o from ${persona.location}). I participated in your focus group. \n\nIn response to your query "${question}", I felt:\n*"${persona.answerToQuestion}"*\n\nI'm ready! Chat with me to learn more about my background, routine, motivations, or why I gave a sentiment score of ${persona.sentimentScore}/100${others ? ` (and ${others})` : ''}.`
  };
}

export function PersonaChat({ personas, variants, chats, onUpdateChat }: PersonaChatProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePersona: Persona | undefined = personas[selectedIdx];

  // Saved transcript for this persona, or a fresh greeting
  const saved = chats[selectedIdx];
  const messages: ChatMessage[] = saved?.length
    ? saved
    : activePersona ? [greetingFor(activePersona, variants)] : [];

  // Reset the selection when a different run with fewer personas is loaded
  useEffect(() => {
    if (selectedIdx >= personas.length) setSelectedIdx(0);
  }, [personas.length, selectedIdx]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !activePersona) return;

    const userMsg = input.trim();
    setInput('');

    // Captured so a reply still lands in the right transcript if the user switches persona
    const idx = selectedIdx;
    const persona = activePersona;
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', text: userMsg }
    ];

    onUpdateChat(idx, () => newMessages);
    setIsTyping(true);

    try {
      // Exclude the just-added user message from history — pass it separately as newMessage.
      // This replaces the original pop()! pattern and removes the non-null assertion risk.
      const chatHistory = newMessages.slice(0, -1);

      const aiResponse = await sendChatMessage(chatHistory, userMsg, persona, variants);

      onUpdateChat(idx, prev => [
        ...prev,
        // chatWithPersona guarantees a string, but we add a fallback message as a
        // final safety net in case an empty string slips through.
        {
          role: 'model',
          text: aiResponse || "I'm sorry, I couldn't form a response right now. Could you try asking again?"
        }
      ]);
    } catch (error) {
      console.error(error);
      onUpdateChat(idx, prev => [
        ...prev,
        {
          role: 'model',
          text: `**Error**: ${error instanceof Error ? error.message : `Connection to ${persona.name} was lost.`}`
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (personas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-[50vh] bg-[#0B0F19]/50 rounded-2xl border border-slate-800 shadow-sm border-dashed">
        <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">No Interviewees Available</h3>
        <p className="text-slate-400 max-w-md text-sm">
          Once you complete a Focus Group simulation, you will be able to select and interview each of the 10 participants 1-on-1 to probe their psychological triggers.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-5 max-w-6xl mx-auto h-[calc(100vh-10rem)] lg:h-[calc(100vh-13rem)] min-h-0">

      {/* Left panel: Persona selector sidebar/pill-bar */}
      <div className="lg:col-span-4 bg-[#0B0F19] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-auto lg:h-full shrink-0 bg-gradient-to-b from-white/[0.012] to-transparent">
        <div className="hidden lg:flex p-2.5 border-b border-slate-800/65 bg-slate-900/40 items-center gap-2 shrink-0">
          <UserCheck className="w-3.5 h-3.5 text-blue-400" />
          <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">Select Participant ({personas.length})</h3>
        </div>

        {/* Horizontal scrollbar on mobile/tablet, sleek vertical list on desktop */}
        <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-y-auto p-1.5 lg:p-2 gap-1.5 lg:gap-1.5 scrollbar-none lg:scrollbar-thin w-full shrink-0 lg:shrink">
          {personas.map((persona, idx) => (
            <button
              key={persona.id || idx}
              onClick={() => setSelectedIdx(idx)}
              className={cn(
                "rounded-xl transition-all flex items-center gap-2 group shrink-0 select-none border text-left",
                "px-2 px-2.5 py-1.5 lg:p-2 lg:w-full lg:justify-between",
                selectedIdx === idx
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "text-slate-400 hover:bg-slate-800/30 border-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-6 w-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                  selectedIdx === idx ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                )}>
                  {persona.name.slice(0, 2)}
                </div>
                <div>
                  <h4 className="font-bold text-xs lg:text-sm tracking-tight text-slate-200 leading-none lg:mb-1">{persona.name}</h4>
                  <p className="text-[9px] lg:text-[10px] text-slate-500 leading-none mt-0.5">
                    {persona.age}y • {persona.location?.split(',')[0] ?? 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0 select-none">
                <span className={cn(
                  "text-[9px] lg:text-[10px] font-bold px-1.5 py-0.5 rounded",
                  persona.sentimentScore >= 75 ? "text-emerald-400 bg-emerald-500/5 border border-emerald-500/10" :
                  persona.sentimentScore >= 50 ? "text-amber-400 bg-amber-500/5 border border-amber-500/10" :
                                                 "text-rose-400 bg-rose-500/5 border border-rose-500/10"
                )}>
                  {persona.sentimentScore}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: Chat Stage */}
      <div className="lg:col-span-8 bg-[#0B0F19] rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[52vh] lg:h-full bg-gradient-to-b from-white/[0.012] to-transparent flex-1 min-h-0">

        {/* Active Participant Header bar */}
        {activePersona && (
          <div className="p-2 sm:p-2.5 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-500/15 shrink-0">
                {activePersona.name.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-100 leading-tight">1-on-1 with {activePersona.name}</h3>
                  <span className="text-[8px] bg-slate-850 text-slate-400 px-1 py-0.5 rounded uppercase font-semibold">Live</span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-500 leading-none mt-0.5">
                  {activePersona.gender} • Income: {activePersona.incomeLevel}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className={cn(
                "text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md border",
                activePersona.sentimentScore >= 75 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                activePersona.sentimentScore >= 50 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                                                     "text-rose-400 bg-rose-500/10 border-rose-500/20"
              )}>
                Sentiment {activePersona.sentimentScore}/100
              </span>
            </div>
          </div>
        )}

        {/* Informative pill of their background lifestyle */}
        {activePersona && (
          <div className="px-2.5 py-1 bg-slate-950/40 border-b border-slate-900 flex items-center gap-1.5 shrink-0 select-none">
            <Info className="w-3 h-3 text-blue-400 shrink-0" />
            <p className="text-[10.5px] text-slate-450 truncate leading-none">
              <strong className="text-slate-350">Context:</strong> {activePersona.background} &mdash; <em>{activePersona.habits}</em>
            </p>
          </div>
        )}

        {/* Chat message logs */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-4 bg-slate-950/60 scrollbar-thin scroll-smooth min-h-0">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-2 max-w-[94%] sm:max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn(
                "w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm font-semibold text-[10px]",
                msg.role === 'user' ? "bg-slate-800 text-slate-300" : "bg-blue-600 text-white"
              )}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : activePersona?.name.slice(0, 2) ?? <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={cn(
                "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm leading-relaxed",
                msg.role === 'user'
                  ? "bg-blue-600 text-white rounded-tr-sm shadow-sm"
                  : "bg-slate-900 border border-slate-850 text-slate-200 rounded-tl-sm shadow-sm prose prose-invert prose-xs max-w-none prose-p:my-0.5 prose-a:text-blue-400"
              )}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap m-0 font-sans">{msg.text}</p>
                ) : (
                  <Markdown>{msg.text}</Markdown>
                )}
              </div>
            </div>
          ))}

          {isTyping && activePersona && (
            <div className="flex gap-2 max-w-[85%]">
              <div className="w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-blue-600 text-white font-bold text-[10px] shadow-sm">
                {activePersona.name.slice(0, 2)}
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#0B0F19] border border-slate-800 rounded-tl-sm shadow-sm flex items-center gap-1">
                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="p-2 sm:p-2.5 bg-[#0B0F19] border-t border-slate-800/80 shrink-0 select-none">
          <form onSubmit={handleSend} className="relative flex items-center gap-1.5 max-w-3xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={activePersona ? `Ask ${activePersona.name}...` : "Select a persona..."}
              disabled={!activePersona || isTyping}
              className="w-full max-h-20 min-h-[36px] py-1.5 pl-3 pr-10 bg-slate-950 border border-slate-850 text-slate-100 placeholder:text-slate-600 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed font-sans text-xs sm:text-sm leading-normal"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping || !activePersona}
              className="absolute right-1.5 bottom-1.5 w-7.5 h-7.5 flex items-center justify-center text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-md transition-colors shadow-md shrink-0"
            >
              {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3 ml-0.5" />}
            </button>
          </form>
          <p className="hidden md:block text-center text-[9px] text-slate-650 mt-1 font-medium">
            Shift + Enter for a newline. Grounded strictly in focus group parameters.
          </p>
        </div>

      </div>
    </div>
  );
}
