"use client";

import Logo from "@/components/ui/Logo";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export default function SharedConversationPage() {
  const { id } = useParams();
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedConversation() {
      if (!id) return;

      try {
        setLoading(true);
        // Find session by share_id
        const { data: sessionData, error: sessionError } = await supabase
          .from("chat_sessions")
          .select("id, title, user_id")
          .eq("share_id", id)
          .single();

        if (sessionError || !sessionData) {
          setError("Cette conversation partagée n'existe pas ou le lien est invalide.");
          return;
        }

        setSession(sessionData);

        // Fetch messages for this session
        const { data: messagesData, error: messagesError } = await supabase
          .from("chat_messages")
          .select("id, role, content")
          .eq("session_id", sessionData.id)
          .order("created_at", { ascending: true });

        if (messagesError) {
          setError("Impossible de charger les messages.");
        } else {
          setMessages(messagesData || []);
        }
      } catch (err) {
        setError("Une erreur inattendue est survenue.");
      } finally {
        setLoading(false);
      }
    }

    fetchSharedConversation();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-sans">
        <div className="w-10 h-10 border-4 border-[var(--ork-use-text-brand)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background font-sans px-6">
        <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border max-w-md w-full text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-t-danger mx-auto mb-4">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h1 className="text-xl font-bold text-foreground mb-2">Lien invalide</h1>
          <p className="text-muted text-[14px]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      {/* HEADER */}
      <header className="h-[72px] flex items-center justify-between px-6 bg-surface/90 backdrop-blur-md border-b border-border sticky top-0 z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[var(--ork-ref-primary-35)] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Logo variant="symbol" size="sm" tone="on-color" className="w-5" />
          </div>
          <div>
            <span className="font-title font-bold text-t-brand text-[17px] tracking-tight block leading-none">cultiso</span>
            <span className="text-[11px] font-semibold text-t-action uppercase tracking-wider block mt-0.5">Conversation partagée</span>
          </div>
        </div>
        <div className="text-[13px] font-semibold text-muted bg-sunken px-3 py-1.5 rounded-lg border border-border hidden sm:block truncate max-w-[300px]">
          {session?.title || "Discussion"}
        </div>
      </header>

      {/* MESSAGES */}
      <main className="flex-1 overflow-y-auto pt-8 pb-20">
        <div className="max-w-[800px] mx-auto px-6 space-y-7">
          {messages.length === 0 ? (
            <p className="text-center text-muted font-medium">Cette discussion est vide.</p>
          ) : (
            messages.map((msg, idx) => {
              // Same cleanup logic as SharedChat
              let displayContent = msg.content;
              if (msg.role === "assistant") {
                const fencedMatch = displayContent.match(/```json\s+([\s\S]*?)\s+```/);
                if (fencedMatch) displayContent = displayContent.replace(fencedMatch[0], "").trim();
                else {
                  const rawMatch = displayContent.match(/\{\s*"(?:action|type|meta)"\s*:[\s\S]*\}/);
                  if (rawMatch) displayContent = displayContent.replace(rawMatch[0], "").trim();
                }
              }

              return (
                <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-9 h-9 ork-avatar ork-avatar--ai flex items-center justify-center flex-shrink-0 mt-1 shadow-sm relative">
                      <span className="inline-flex [[data-theme=dark]_&]:hidden">
                        <Logo variant="symbol" size="xs" tone="on-light" decorative className="w-5" />
                      </span>
                      <span className="hidden [[data-theme=dark]_&]:inline-flex">
                        <Logo variant="symbol" size="xs" tone="on-dark" decorative className="w-5" />
                      </span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end max-w-[85%]" : "items-start w-full"}`}>
                    {msg.role === "user" ? (
                      <div className="px-5 py-3.5 rounded-3xl bg-brand text-on-brand text-[15px] font-medium leading-[1.65] whitespace-pre-wrap shadow-sm">
                        {displayContent}
                      </div>
                    ) : (
                      <div className="relative w-full">
                        <div className="mb-2 inline-flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">Cultisia</span>
                          <span className="ork-avatar-ai-label">IA</span>
                        </div>
                        {displayContent && (
                          <div className="prose prose-sm md:prose-base max-w-none text-foreground leading-[1.75]
                            prose-headings:font-title prose-headings:font-bold prose-headings:text-t-brand 
                            prose-h1:text-[22px] prose-h2:text-[18px] prose-h3:text-[15px] prose-h1:border-b prose-h1:border-[var(--ork-use-border-default)] prose-h1:pb-2
                            prose-p:text-[15px] prose-p:mb-4
                            prose-strong:text-t-brand prose-strong:font-bold
                            prose-a:text-t-action prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                            prose-ul:list-disc prose-ul:pl-5 prose-li:mb-2
                            prose-blockquote:border prose-blockquote:border-[var(--ork-use-border-default)] prose-blockquote:bg-[var(--ork-use-surface-sunken)] prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-lg prose-blockquote:italic
                            prose-code:bg-sunken prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-t-action prose-code:text-[13px] prose-code:font-mono
                            prose-pre:bg-[var(--ork-ref-primary-15)] prose-pre:text-[var(--ork-ref-neutral-95)] prose-pre:rounded-xl prose-pre:shadow-sm"
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {displayContent}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-6 border-t border-border bg-surface shrink-0 text-center flex flex-col items-center justify-center">
        <p className="text-[13px] text-muted font-medium mb-3">Réponse générée avec Cultisia (IA) — vérifiez selon les conditions réelles de votre parcelle.</p>
        <a 
          href="/" 
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-action text-on-action rounded-lg text-[13px] font-bold hover:bg-[var(--ork-use-background-action-bold-hover)] transition-colors shadow-sm"
        >
          Découvrir Cultiso
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>
        </a>
      </footer>
    </div>
  );
}
