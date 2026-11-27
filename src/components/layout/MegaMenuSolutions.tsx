import React from 'react';
import Link from 'next/link';

export const MegaMenuSolutions = () => {
  return (
    <div className="absolute top-[calc(100%+10px)] left-1/2 before:absolute before:-top-5 before:left-0 before:w-full before:h-5 before:bg-transparent before:content-[''] -translate-x-1/2 w-[1050px] bg-surface border border-border shadow-lg rounded-2xl hidden group-hover:block transition-all duration-300 z-50 overflow-hidden">
      <div className="flex p-10">
        <div className="w-[60%] grid grid-cols-2 gap-x-12 gap-y-2 pr-10">
          <div>
            <h3 className="text-[11px] font-bold text-muted mb-5 uppercase tracking-[0.1em]">Acteurs de Terrain</h3>
            <div className="space-y-1">
              <Link href="/cultima" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Producteurs</span>
                  <span className="text-[14px] text-muted leading-snug block">Optimisez vos rendements</span>
                </div>
              </Link>
              <Link href="/cultima?view=animal" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Éleveurs</span>
                  <span className="text-[14px] text-muted leading-snug block">Gérez votre cheptel efficacement</span>
                </div>
              </Link>
              <Link href="/cultima?view=transformation" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Transformateurs</span>
                  <span className="text-[14px] text-muted leading-snug block">Valorisez vos produits bruts</span>
                </div>
              </Link>
            </div>
          </div>
          
          <div>
            <h3 className="text-[11px] font-bold text-muted mb-5 uppercase tracking-[0.1em]">Partenaires &amp; Porteurs</h3>
            <div className="space-y-1">
              <Link href="/cultiplan" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Porteurs de projets</span>
                  <span className="text-[14px] text-muted leading-snug block">Structurez votre idée</span>
                </div>
              </Link>
              <Link href="/cours-des-prix" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Acheteurs</span>
                  <span className="text-[14px] text-muted leading-snug block">Sécurisez vos approvisionnements</span>
                </div>
              </Link>
              <Link href="/cultima?view=negoce" className="group/link flex items-start p-3 -mx-3 rounded-xl hover:bg-sunken transition-colors">
                <div className="text-t-brand mt-0.5 mr-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </div>
                <div>
                  <span className="font-bold text-foreground block text-[15px] mb-0.5">Fournisseurs</span>
                  <span className="text-[14px] text-muted leading-snug block">Développez votre marché</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="w-[40%] pl-10 border-l border-border">
          <h3 className="text-[11px] font-bold text-muted mb-5 uppercase tracking-[0.1em]">À la une</h3>
          <Link href="/blog" className="block group/card">
            <div className="relative h-[220px] bg-sunken rounded-xl overflow-hidden mb-6 border border-border">
              <div className="absolute top-6 left-0 right-0 h-[1px] bg-brand opacity-20"></div>
              <div className="absolute bottom-6 left-0 right-0 h-[1px] bg-brand opacity-20"></div>
              <div className="absolute left-6 top-0 bottom-0 w-[1px] bg-brand opacity-20"></div>
              <div className="absolute right-6 top-0 bottom-0 w-[1px] bg-brand opacity-20"></div>
              <div className="absolute inset-0 pt-12 pl-12 pr-10 flex flex-col items-start">
                <div className="inline-flex bg-brand text-on-brand text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm mb-3">
                  NOTRE MANIFESTE
                </div>
                <h4 className="text-[22px] font-semibold text-t-brand leading-tight">
                  La vision<br />Cultiso
                </h4>
                <span className="text-muted font-sans text-xs mt-1.5 font-medium">L&apos;infrastructure agrobusiness</span>
              </div>
            </div>
            <h4 className="font-bold text-foreground text-[16px] mb-1.5 group-hover/card:text-t-brand transition-colors">
              L&apos;agrobusiness africain, sans improvisation
            </h4>
            <p className="text-[14px] text-muted leading-relaxed">
              Une suite d&apos;outils conçue pour les réalités du terrain en Afrique de l&apos;Ouest.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};
