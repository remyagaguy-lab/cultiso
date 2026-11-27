import React from 'react';
import Link from 'next/link';

export const MegaMenuProducts = () => {
  return (
    <div className="absolute top-[calc(100%+10px)] left-1/2 before:absolute before:-top-5 before:left-0 before:w-full before:h-5 before:bg-transparent before:content-[''] -translate-x-1/2 w-[1050px] bg-surface border border-border shadow-lg rounded-2xl hidden group-hover:block transition-all duration-300 z-50 overflow-hidden">
      <div className="flex p-10">
        <div className="w-[60%] grid grid-cols-2 gap-x-12 gap-y-2 pr-10">
          <div>
            <h3 className="text-[11px] font-bold text-muted mb-5 uppercase tracking-[0.1em]">Planification &amp; Vente</h3>
            <div className="space-y-1">
              <Link href="/register" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Cultiplan</span>
                  <span className="text-[14px] text-muted leading-snug block">Business plan et simulation financière</span>
                </div>
              </Link>
              <Link href="/register" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Cultishop</span>
                  <span className="text-[14px] text-muted leading-snug block">Boutique en ligne et marché</span>
                </div>
              </Link>
              <Link href="/register" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Cultistock</span>
                  <span className="text-[14px] text-muted leading-snug block">Gestion des stocks et logistique</span>
                </div>
              </Link>
            </div>
          </div>
          
          <div>
            <h3 className="text-[11px] font-bold text-muted mb-5 uppercase tracking-[0.1em]">Intelligence &amp; Conseil</h3>
            <div className="space-y-1">
              <Link href="/register" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Cultisia</span>
                  <span className="text-[14px] text-muted leading-snug block">IA et analyse prédictive</span>
                </div>
              </Link>
              <Link href="/register" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Cultiseil</span>
                  <span className="text-[14px] text-muted leading-snug block">Conseil d&apos;experts agricoles</span>
                </div>
              </Link>
              <Link href="/register" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Cultigreen</span>
                  <span className="text-[14px] text-muted leading-snug block">Pratiques durables et écologie</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="w-[40%] pl-10 border-l border-border">
          <h3 className="text-[11px] font-bold text-muted mb-5 uppercase tracking-[0.1em]">À la une</h3>
          <Link href="/cultiplan" className="block group/card">
            <div className="relative h-[220px] bg-sunken rounded-xl overflow-hidden mb-6 border border-border">
              <div className="absolute top-6 left-0 right-0 h-[1px] bg-brand opacity-20"></div>
              <div className="absolute bottom-6 left-0 right-0 h-[1px] bg-brand opacity-20"></div>
              <div className="absolute left-6 top-0 bottom-0 w-[1px] bg-brand opacity-20"></div>
              <div className="absolute right-6 top-0 bottom-0 w-[1px] bg-brand opacity-20"></div>
              <div className="absolute inset-0 pt-12 pl-12 pr-10 flex flex-col items-start">
                <div className="inline-flex bg-brand text-on-brand text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm mb-3">
                  NOUVEAUTÉ
                </div>
                <h4 className="text-[22px] font-semibold text-t-brand leading-tight">
                  Simulateur <br />Cultiplan
                </h4>
                <span className="text-muted font-sans text-xs mt-1.5 font-medium">Business plan agricole IA</span>
              </div>
            </div>
            <h4 className="font-bold text-foreground text-[16px] mb-1.5 group-hover/card:text-t-brand transition-colors">
              Modélisez la rentabilité de votre projet
            </h4>
            <p className="text-[14px] text-muted leading-relaxed">
              Structurez vos investissements, itinéraires techniques et flux en FCFA.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};
