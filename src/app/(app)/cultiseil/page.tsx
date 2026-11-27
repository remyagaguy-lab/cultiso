"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  SendSquareIcon,
  RefreshIcon,
  TestTubeIcon,
  CloudIcon,
  BugIcon,
} from "@solar-icons/react/linear";
import { CheckCircleIcon as CheckCircleBoldDuotoneIcon } from "@solar-icons/react/bold-duotone";
import ReactMarkdown from "react-markdown";
import { Logo } from "@/components/ui/Logo";

interface QuestionnaireItem {
  question: string;
  options: string[];
}

interface QuestionnairePayload {
  type: "questionnaire";
  questions: QuestionnaireItem[];
}

export default function CultiseilPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Bonjour ! Je suis Cultisia, ton Ingénieur Agronome. Quel problème ou culture souhaites-tu analyser aujourd'hui sur le terrain ? (ex: Mes tomates ont des taches noires, Analyse de mon sol argileux).",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async (e?: React.FormEvent, forcedText?: string) => {
    if (e) e.preventDefault();
    const textToSend = forcedText || input;
    if (!textToSend.trim()) return;

    const newMessages = [...messages, { role: "user", content: textToSend }];
    setMessages(newMessages);
    setInput("");
    setIsThinking(true);
    setFormAnswers({});

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, mode: "cultiseil" }),
      });

      if (!res.ok) throw new Error("API Error");
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantMsg = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "token" && data.content) {
                  assistantMsg += data.content;
                }
              } catch {
                // Ignore incomplete SSE frames
              }
            }
          }
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1].content = assistantMsg;
            return copy;
          });
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Désolé, une erreur est survenue." },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleFormSubmit = () => {
    const answersText = Object.entries(formAnswers)
      .map(([q, a]) => `- ${q} : ${a}`)
      .join("\n");
    handleSend(undefined, "Voici les paramètres du terrain :\n" + answersText);
  };

  let activeQuestionnaire: QuestionnairePayload | null = null;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "assistant") {
    const match = lastMsg.content.match(/```json\n([\s\S]*?)\n```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]) as Partial<QuestionnairePayload>;
        if (parsed.type === "questionnaire" && Array.isArray(parsed.questions)) {
          activeQuestionnaire = parsed as QuestionnairePayload;
        }
      } catch {
        // Ignore partial JSON
      }
    }
  }

  return (
    <div className="flex-1 flex min-h-full md:h-full flex-col md:flex-row bg-surface font-sans">
      {/* MAIN WORKSPACE */}
      <section className="flex-none md:flex-1 flex flex-col min-w-0 bg-background relative md:overflow-hidden">
        <header className="px-6 md:px-10 py-4 md:py-6 shrink-0 flex justify-between items-end border-b border-border bg-surface/85 backdrop-blur-sm z-10">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/" className="md:hidden">
                <span className="inline-flex [[data-theme=dark]_&]:hidden">
                  <Logo variant="symbol" size="sm" tone="on-light" className="w-6" />
                </span>
                <span className="hidden [[data-theme=dark]_&]:inline-flex">
                  <Logo variant="symbol" size="sm" tone="on-dark" className="w-6" />
                </span>
              </Link>
              <h1 className="font-title text-xl md:text-2xl font-bold text-t-brand tracking-tight m-0">
                Cultiseil
              </h1>
            </div>
            <p className="text-muted font-medium text-xs md:text-sm mt-1 m-0">
              Votre guide agronomique intelligent
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col custom-scrollbar">
          {activeQuestionnaire ? (
            <div className="max-w-3xl mx-auto w-full bg-surface rounded-2xl border border-border p-8 md:p-10 shadow-sm">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-full bg-sunken flex items-center justify-center text-t-brand">
                  <TestTubeIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-title text-xl font-bold text-foreground m-0">
                    Analyse du Terrain
                  </h2>
                  <p className="text-muted text-sm mt-1 m-0">
                    Fournissez les relevés physiques pour affiner le diagnostic.
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                {activeQuestionnaire.questions.map((q, i) => (
                  <div
                    key={i}
                    className="border-b border-border pb-8 last:border-0 last:pb-0"
                  >
                    <h3 className="font-semibold text-foreground text-base mb-4">
                      {q.question}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {q.options.map((opt, j) => {
                        const isSelected = formAnswers[q.question] === opt;
                        return (
                          <button
                            key={j}
                            type="button"
                            onClick={() =>
                              setFormAnswers({ ...formAnswers, [q.question]: opt })
                            }
                            className={`px-5 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all border ${
                              isSelected
                                ? "border-[var(--ork-use-border-selected)] bg-selected text-t-brand ring-1 ring-inset ring-[var(--ork-use-border-selected)]"
                                : "border-border bg-surface text-muted hover:text-foreground hover:bg-sunken"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                      <input
                        type="text"
                        placeholder="Autre (précisez)..."
                        value={
                          (!q.options.includes(formAnswers[q.question]) &&
                            formAnswers[q.question]) ||
                          ""
                        }
                        onChange={(e) =>
                          setFormAnswers({
                            ...formAnswers,
                            [q.question]: e.target.value,
                          })
                        }
                        className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium border border-border bg-sunken text-foreground placeholder-muted focus:outline-none focus:border-[var(--ork-use-border-focused)] focus:bg-surface transition-all flex-1 min-w-[200px]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 flex justify-end pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  disabled={
                    Object.keys(formAnswers).length <
                    activeQuestionnaire.questions.length
                  }
                  className="px-6 py-3 min-h-[44px] bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action rounded-lg font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Valider les relevés
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full min-h-full flex flex-col justify-start md:justify-center items-center text-center py-4 md:py-0">
              <div className="flex items-center gap-4 mb-8 md:mb-14 w-full max-w-lg mx-auto opacity-80">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand"></div>
                  <span className="text-[10px] font-bold text-t-brand uppercase tracking-widest">
                    Symptômes
                  </span>
                </div>
                <div className="flex-1 h-px bg-border mb-5"></div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--ork-use-border-bold)]"></div>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    Télémétrie
                  </span>
                </div>
                <div className="flex-1 h-px bg-border mb-5"></div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--ork-use-border-bold)]"></div>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    Diagnostic
                  </span>
                </div>
              </div>

              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-sm relative">
                <TestTubeIcon
                  className="w-7 h-7 text-t-brand relative z-10"
                />
              </div>

              <h2 className="font-title text-2xl font-bold text-foreground mb-4">
                En attente d&apos;analyse
              </h2>

              <p className="text-muted text-sm max-w-md leading-relaxed mb-12">
                Décrivez les symptômes de votre culture ou votre type de sol à Cultisia dans le panneau de droite. Les agents de télémétrie s&apos;activeront ici pour établir un diagnostic.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                <div className="bg-surface border border-border rounded-xl p-5 text-left shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center mb-3 text-t-brand">
                    <CloudIcon className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm mb-1">
                    Climat &amp; Sol
                  </h3>
                  <p className="text-xs text-muted m-0">
                    Intégration des données environnementales.
                  </p>
                </div>
                <div className="bg-surface border border-border rounded-xl p-5 text-left shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center mb-3 text-t-action">
                    <BugIcon className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm mb-1">
                    Pathologies
                  </h3>
                  <p className="text-xs text-muted m-0">
                    Identification des maladies et carences.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* RIGHT PANEL (Chatbot) */}
      <aside className="w-full md:w-[380px] flex-1 md:flex-none bg-surface border-t md:border-t-0 md:border-l border-border flex flex-col flex-shrink-0 z-20">
        <div className="py-4 md:py-5 shrink-0 border-b border-border flex items-center px-6 gap-3.5">
          <div className="w-10 h-10 shrink-0 ork-avatar ork-avatar--ai flex items-center justify-center" aria-hidden="true">
            <span className="inline-flex [[data-theme=dark]_&]:hidden">
              <Logo variant="symbol" size="xs" tone="on-light" decorative className="w-6" />
            </span>
            <span className="hidden [[data-theme=dark]_&]:inline-flex">
              <Logo variant="symbol" size="xs" tone="on-dark" decorative className="w-6" />
            </span>
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-title font-bold text-foreground text-sm leading-tight m-0">
                Cultisia
              </h3>
              <span className="ork-avatar-ai-label">IA</span>
            </div>
            <p className="text-[11px] text-t-action font-bold tracking-wider uppercase mt-1 leading-none m-0">
              Ingénieur Agronome
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-surface custom-scrollbar">
          {messages.map((msg, i) => {
            const isJsonBlock = msg.content.includes("```json");
            const visibleContent = msg.content
              .replace(/```json\n[\s\S]*?\n```/g, "")
              .trim();

            if (!visibleContent && isJsonBlock) {
              return (
                <div key={i} className="flex justify-start">
                  <div className="bg-sunken text-muted border border-border text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-2">
                    <CheckCircleBoldDuotoneIcon className="w-3.5 h-3.5 text-t-brand" /> Analyse requise
                  </div>
                </div>
              );
            }

            return (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-brand text-on-brand rounded-br-sm"
                      : "bg-sunken text-foreground rounded-bl-sm border border-border"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-title prose-headings:text-t-brand prose-strong:text-foreground">
                      <ReactMarkdown>{visibleContent}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            );
          })}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-sunken rounded-2xl rounded-bl-sm px-4 py-4 flex gap-1.5 items-center border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"></div>
                <div
                  className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                ></div>
                <div
                  className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                ></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-5 shrink-0 border-t border-border bg-surface">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Décrivez vos symptômes (ex: feuilles jaunes)..."
              className="w-full bg-sunken border border-border focus:border-[var(--ork-use-border-focused)] focus:bg-surface rounded-xl pl-4 pr-12 py-3 text-[13.5px] text-foreground outline-none transition-all min-h-[44px]"
              disabled={isThinking || !!activeQuestionnaire}
            />
            <button
              type="submit"
              aria-label="Envoyer le message"
              disabled={!input.trim() || isThinking || !!activeQuestionnaire}
              className="absolute right-2 w-8 h-8 rounded-lg bg-action flex items-center justify-center text-on-action hover:bg-[var(--ork-use-background-action-bold-hover)] transition-colors disabled:opacity-50"
            >
              {isThinking ? (
                <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SendSquareIcon className="w-3.5 h-3.5 -ml-0.5" />
              )}
            </button>
          </form>
          {activeQuestionnaire && (
            <p className="text-[11px] text-center text-muted mt-3 font-medium">
              Saisie requise dans le panneau central pour le diagnostic.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
