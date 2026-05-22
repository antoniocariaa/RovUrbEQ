"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ZoneEquityData {
  name: string;
  generalScore: number;
  categoryScores: Record<string, number>;
  ageGroupScores: Record<string, number>;
}

interface AiChatProps {
  selectedZone?: string | null;
}

const SUGGESTIONS = [
  "Quali servizi ha Lizzana?",
  "Qual è il quartiere con più farmacie?",
  "Confronta Marco e Lizzanella",
  "Dove ci sono più parchi?",
];

// ── Score helpers ─────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

const CATEGORY_EMOJI: Record<string, string> = {
  Educazione: "📚", Salute: "🩺", Servizi: "📮",
  Comunità: "🌳", Mobilità: "🚌",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AiChat({ selectedZone }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [equityData, setEquityData] = useState<ZoneEquityData | null>(null);
  const [equityLoading, setEquityLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Fetch equity data when selectedZone changes ─────────────────────────────
  useEffect(() => {
    if (!selectedZone) {
      setEquityData(null);
      return;
    }

    let cancelled = false;
    setEquityLoading(true);

    fetch(`/api/equity?zone=${encodeURIComponent(selectedZone)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json?.results?.[0]) {
          setEquityData(json.results[0]);
        } else {
          setEquityData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setEquityData(null);
      })
      .finally(() => {
        if (!cancelled) setEquityLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedZone]);

  // ── Build zone context string for the AI prompt ─────────────────────────────
  function buildZoneContext(): string {
    if (!equityData) return "";
    const cats = Object.entries(equityData.categoryScores)
      .map(([k, v]) => `${k}: ${v}/100`)
      .join(", ");
    const ages = Object.entries(equityData.ageGroupScores)
      .map(([k, v]) => `${k}: ${v}/100`)
      .join(", ");
    return `[CONTESTO ZONA SELEZIONATA: ${equityData.name} — Score generale: ${equityData.generalScore}/100 | Categorie: ${cats} | Fasce d'età: ${ages}]`;
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text?: string) => {
      const rawContent = (text ?? input).trim();
      if (!rawContent || isStreaming) return;

      // Prepend zone context if available
      const zoneCtx = buildZoneContext();
      const fullContent = zoneCtx
        ? `${zoneCtx}\n\nDomanda dell'utente: ${rawContent}`
        : rawContent;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: rawContent, // display the clean message
      };

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "",
      };

      const newMessages = [...messages, userMsg];
      setMessages([...newMessages, assistantMsg]);
      setInput("");
      setIsStreaming(true);

      try {
        // Build message history with zone context injected in the latest user message
        const apiMessages = newMessages.map((m, i) => ({
          role: m.role,
          content: i === newMessages.length - 1 && m.role === "user" ? fullContent : m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: `⚠️ ${err.error ?? "Errore nella risposta"}` }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        // Stream the response
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const snapshot = accumulated;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: snapshot } : m
            )
          );
        }
      } catch (err) {
        console.error("[AiChat] Error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "⚠️ Errore di connessione. Riprova." }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, isStreaming, messages, equityData]
  );

  // ── Keyboard handler ───────────────────────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasZone = !!equityData;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b-2 border-indigo-900 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-indigo-900 bg-indigo-600 shadow-[2px_2px_0_#1e1b4b]">
          <span className="text-sm">✨</span>
        </div>
        <div className="leading-none">
          <p className="text-sm font-extrabold text-indigo-900">AI Assistant</p>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-indigo-400">
            Powered by Groq
          </p>
        </div>
        {isStreaming && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="chat-dot h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span className="chat-dot h-1.5 w-1.5 rounded-full bg-indigo-500 [animation-delay:0.15s]" />
            <span className="chat-dot h-1.5 w-1.5 rounded-full bg-indigo-500 [animation-delay:0.3s]" />
          </div>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="chat-scroll flex-1 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 ? (
          /* Empty state with suggestions */
          <div className="flex h-full flex-col items-center justify-center gap-4 px-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-indigo-900 bg-indigo-100 shadow-[3px_3px_0_#1e1b4b]">
              <span className="text-2xl">🏙️</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-extrabold text-indigo-900">
                Chiedi qualcosa su Rovereto
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                Posso analizzare i servizi per zona, confrontare quartieri e
                altro ancora.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50/50 px-3 py-2 text-left text-xs font-semibold text-indigo-700 transition-all hover:border-indigo-400 hover:bg-indigo-100 hover:shadow-[2px_2px_0_#c7d2fe] active:scale-[0.98]"
                >
                  💬 {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-md border-2 border-indigo-900 bg-indigo-600 text-white shadow-[2px_2px_0_#1e1b4b]"
                      : "rounded-bl-md border-2 border-gray-200 bg-gray-50 text-gray-800 shadow-[2px_2px_0_#e5e7eb]"
                  }`}
                >
                  {msg.role === "assistant" && msg.content === "" && isStreaming ? (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="chat-dot h-1.5 w-1.5 rounded-full bg-gray-400" />
                      <span className="chat-dot h-1.5 w-1.5 rounded-full bg-gray-400 [animation-delay:0.15s]" />
                      <span className="chat-dot h-1.5 w-1.5 rounded-full bg-gray-400 [animation-delay:0.3s]" />
                    </div>
                  ) : (
                    <div className="chat-content whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Zone stats card (above input) ────────────────────────────────── */}
      {(hasZone || equityLoading) && (
        <div className="flex-shrink-0 border-t-2 border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 px-3 py-2.5">
          {equityLoading ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                Caricamento dati zona…
              </span>
            </div>
          ) : equityData && (
            <div>
              {/* Zone name + general score */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">📍</span>
                  <span className="text-[11px] font-extrabold text-indigo-900">
                    {equityData.name}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1 rounded-lg border-[1.5px] px-2 py-0.5"
                  style={{
                    borderColor: scoreColor(equityData.generalScore),
                    background: `${scoreColor(equityData.generalScore)}15`,
                  }}
                >
                  <span
                    className="text-[11px] font-extrabold"
                    style={{ color: scoreColor(equityData.generalScore) }}
                  >
                    {equityData.generalScore}
                  </span>
                  <span className="text-[8px] font-bold text-gray-400">/100</span>
                </div>
              </div>

              {/* Mini category bars */}
              <div className="flex flex-col gap-1">
                {Object.entries(equityData.categoryScores).map(([cat, score]) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <span className="text-[10px] w-3.5 text-center">{CATEGORY_EMOJI[cat] ?? "📌"}</span>
                    <span className="text-[9px] font-bold text-gray-500 w-[60px] truncate">{cat}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${score}%`,
                          background: scoreColor(score),
                        }}
                      />
                    </div>
                    <span
                      className="text-[9px] font-extrabold w-5 text-right"
                      style={{ color: scoreColor(score) }}
                    >
                      {score}
                    </span>
                  </div>
                ))}
              </div>

              {/* Age group pills */}
              <div className="mt-2 flex gap-1 flex-wrap">
                {Object.entries(equityData.ageGroupScores).map(([group, score]) => {
                  const AGE_EMOJI: Record<string, string> = {
                    "Bambini (0-14)": "👶", "Giovani (15-25)": "🧑",
                    "Adulti (26-64)": "👨", "Anziani (65+)": "👴",
                  };
                  // Short label for the pill
                  const short = group.split(" ")[0];
                  return (
                    <div
                      key={group}
                      className="flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                      style={{
                        borderColor: `${scoreColor(score)}60`,
                        background: `${scoreColor(score)}10`,
                      }}
                    >
                      <span className="text-[10px]">{AGE_EMOJI[group] ?? "👤"}</span>
                      <span className="text-[8px] font-bold text-gray-500">{short}</span>
                      <span
                        className="text-[9px] font-extrabold"
                        style={{ color: scoreColor(score) }}
                      >
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-1.5 text-[8px] font-semibold text-indigo-300 text-center">
                I dati di questa zona verranno integrati nel prompt AI
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Input area ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t-2 border-indigo-900 bg-gray-50 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasZone
                ? `Chiedi qualcosa su ${equityData!.name}…`
                : "Scrivi una domanda…"
            }
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border-2 border-indigo-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-indigo-500 disabled:opacity-50"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-indigo-900 bg-indigo-600 text-white shadow-[2px_2px_0_#1e1b4b] transition-all hover:bg-indigo-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#1e1b4b] disabled:opacity-40 disabled:hover:bg-indigo-600"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[9px] font-medium text-gray-300">
          {hasZone
            ? `📊 Dati di ${equityData!.name} integrati nel prompt`
            : "Risposte generate da AI · Basate sui dati reali OSM"}
        </p>
      </div>
    </div>
  );
}
