"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { usePathname } from 'next/navigation';
import { Button } from 'antd';
import { MegaMenuProducts } from './MegaMenuProducts';
import { MegaMenuSolutions } from './MegaMenuSolutions';
import { MegaMenuResources } from './MegaMenuResources';

export const Header = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);

  const toggleMobileSection = (section: string) => {
    setOpenMobileSection(prev => prev === section ? null : section);
  };
  
  if (pathname === '/cultisia' || pathname === '/cultiplan' || pathname === '/cultiseil') return null;

  return (
    <header className={`border-b border-border sticky top-0 z-50 transition-colors duration-300 ${mobileMenuOpen ? 'bg-surface' : 'bg-surface/92 backdrop-blur-md'}`}>
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex justify-between items-center py-4">
          
          {/* Logo officiel Cultiso (bascule auto clair/nuit) */}
          <div className="flex-shrink-0 flex items-center z-50">
            <Link href="/" aria-label="Cultiso, accueil" className="block transition-transform active:scale-[0.96]" onClick={() => setMobileMenuOpen(false)}>
              <span className="inline-flex [[data-theme=dark]_&]:hidden">
                <Logo variant="horizontal" size="md" tone="on-light" priority className="w-[148px] sm:w-[168px] shrink-0" />
              </span>
              <span className="hidden [[data-theme=dark]_&]:inline-flex">
                <Logo variant="horizontal" size="md" tone="on-dark" priority className="w-[148px] sm:w-[168px] shrink-0" />
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Navigation principale" className="hidden lg:flex items-center space-x-2">
            <div className="group flex items-center">
              <button type="button" className="text-foreground hover:bg-sunken rounded-lg font-medium px-3.5 py-2 min-h-[44px] text-[14.5px] flex items-center cursor-default transition-colors">
                Produits
                <svg className="w-3.5 h-3.5 ml-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <MegaMenuProducts />
            </div>

            <div className="group flex items-center">
              <button type="button" className="text-foreground hover:bg-sunken rounded-lg font-medium px-3.5 py-2 min-h-[44px] text-[14.5px] flex items-center cursor-default transition-colors">
                Solutions
                <svg className="w-3.5 h-3.5 ml-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <MegaMenuSolutions />
            </div>

            <Link href="/cours-des-prix" className="text-foreground hover:bg-sunken rounded-lg font-medium px-3.5 py-2 min-h-[44px] text-[14.5px] flex items-center transition-colors">
              Cours des prix
            </Link>
            
            <div className="group flex items-center">
              <button type="button" className="text-foreground hover:bg-sunken rounded-lg font-medium px-3.5 py-2 min-h-[44px] text-[14.5px] flex items-center cursor-default transition-colors">
                Ressources
                <svg className="w-3.5 h-3.5 ml-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <MegaMenuResources />
            </div>

            <Link href="/contact" className="text-foreground hover:bg-sunken rounded-lg font-medium px-3.5 py-2 min-h-[44px] text-[14.5px] flex items-center transition-colors">
              Nous contacter
            </Link>
          </nav>

          {/* CTA & Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 z-50">
            <div className="hidden lg:block">
              <Link href="/login">
                <Button className="font-semibold text-[14px] px-5 !h-[44px] !bg-[var(--ork-use-surface-sunken)] hover:!bg-[var(--ork-use-background-neutral-default-hover)] !border !border-border !text-foreground rounded-lg flex items-center justify-center transition-all">
                  Se connecter
                </Button>
              </Link>
            </div>
            
            <Link href="/register">
              <Button type="primary" className="font-semibold text-[13px] sm:text-[14px] px-4 sm:px-5 !h-[44px] !bg-action hover:!bg-[var(--ork-use-background-action-bold-hover)] !text-on-action border-none shadow-sm rounded-lg flex items-center justify-center transition-all">
                S&apos;inscrire
              </Button>
            </Link>

            {/* Mobile Menu Toggle (>= 44px touch target) */}
            <button 
              type="button"
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center -mr-1.5 text-foreground hover:bg-sunken rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Overlay (sans translate-x-full pour zéro débordement horizontal à 360/768px) */}
      <div 
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-0 bg-surface z-40 transition-all duration-200 lg:hidden flex flex-col pt-[88px] px-6 pb-6 overflow-y-auto ${mobileMenuOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'}`}
      >
        <nav aria-label="Menu mobile" className="flex flex-col text-foreground">
          <div className="border-b border-border">
            <button 
              type="button"
              className="w-full flex justify-between items-center py-5 text-[20px] font-bold tracking-tight"
              onClick={() => toggleMobileSection('produits')}
            >
              Produits
              <svg className={`w-5 h-5 transition-transform duration-200 ${openMobileSection === 'produits' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${openMobileSection === 'produits' ? 'max-h-[300px] mb-4' : 'max-h-0'}`}>
              <div className="flex flex-col gap-3 pl-4 text-[16px] font-medium text-muted">
                <Link href="/register" className="py-1" onClick={() => setMobileMenuOpen(false)}>Cultisia</Link>
                <Link href="/register" className="py-1" onClick={() => setMobileMenuOpen(false)}>Cultiplan</Link>
                <Link href="/register" className="py-1" onClick={() => setMobileMenuOpen(false)}>Cultiseil</Link>
                <span className="text-[var(--ork-use-text-disabled)] py-1">Cultishop (Bientôt)</span>
              </div>
            </div>
          </div>

          <div className="border-b border-border">
            <button 
              type="button"
              className="w-full flex justify-between items-center py-5 text-[20px] font-bold tracking-tight"
              onClick={() => toggleMobileSection('solutions')}
            >
              Solutions
              <svg className={`w-5 h-5 transition-transform duration-200 ${openMobileSection === 'solutions' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${openMobileSection === 'solutions' ? 'max-h-[300px] mb-4' : 'max-h-0'}`}>
              <div className="flex flex-col gap-3 pl-4 text-[16px] font-medium text-muted">
                <Link href="#" className="py-1" onClick={() => setMobileMenuOpen(false)}>Pour les agriculteurs</Link>
                <Link href="#" className="py-1" onClick={() => setMobileMenuOpen(false)}>Pour les coopératives</Link>
              </div>
            </div>
          </div>

          <div className="border-b border-border">
            <button 
              type="button"
              className="w-full flex justify-between items-center py-5 text-[20px] font-bold tracking-tight"
              onClick={() => toggleMobileSection('ressources')}
            >
              Ressources
              <svg className={`w-5 h-5 transition-transform duration-200 ${openMobileSection === 'ressources' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${openMobileSection === 'ressources' ? 'max-h-[300px] mb-4' : 'max-h-0'}`}>
              <div className="flex flex-col gap-3 pl-4 text-[16px] font-medium text-muted">
                <Link href="/blog" className="py-1" onClick={() => setMobileMenuOpen(false)}>Le Blog</Link>
                <Link href="#" className="py-1" onClick={() => setMobileMenuOpen(false)}>Guides Agrobusiness</Link>
                <Link href="#" className="py-1" onClick={() => setMobileMenuOpen(false)}>Académie Cultiso</Link>
              </div>
            </div>
          </div>

          <Link href="/cours-des-prix" className="block py-5 text-[20px] font-bold tracking-tight border-b border-border" onClick={() => setMobileMenuOpen(false)}>
            Cours des prix
          </Link>
          
          <Link href="/contact" className="block py-5 text-[20px] font-bold tracking-tight border-b border-border" onClick={() => setMobileMenuOpen(false)}>
            Nous contacter
          </Link>
          
          <div className="mt-8">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full !h-[48px] font-semibold text-[15px] !bg-sunken hover:!bg-[var(--ork-use-background-neutral-default-hover)] !border !border-border !text-foreground rounded-lg flex items-center justify-center transition-all">
                Se connecter
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
};
