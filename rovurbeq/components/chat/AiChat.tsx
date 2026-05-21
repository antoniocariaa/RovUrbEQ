"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Quali servizi ha Lizzana?",
  "Qual è il quartiere con più farmacie?",
  "Confronta Marco e Lizzanella",
  "Dove ci sono più parchi?",
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content,
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
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
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
    [input, isStreaming, messages]
  );

  // ── Keyboard handler ───────────────────────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b-2 border-indigo-900 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-indigo-900 bg-indigo-600 shadow-[2px_2px_0_#1e1b4b]">
          <span className="text-sm">🤖</span>
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

      {/* ── Input area ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t-2 border-indigo-900 bg-gray-50 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi una domanda…"
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
          Risposte generate da AI · Basate sui dati reali OSM
        </p>
      </div>
    </div>
  );
}
