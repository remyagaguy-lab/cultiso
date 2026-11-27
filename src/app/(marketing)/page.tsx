import Logo from "@/components/ui/Logo";
import Link from 'next/link';

export default function Home() {
  return (
    <div className="w-full flex-grow flex flex-col items-center">
        {/* --- 1. HERO SECTION --- */}
        <section className="relative w-full px-6 pt-[64px] pb-16 md:pt-[64px] lg:pt-[64px] lg:pb-24 flex items-center bg-[var(--ork-ref-primary-15)] overflow-hidden">
          {/* Image d'arrière-plan avec voile sarcelle sombre Orkedio */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--ork-ref-primary-15)] via-[var(--ork-ref-primary-15)]/92 to-[var(--ork-ref-primary-15)]/25 z-10"></div>
            <img 
              src="/hero-bg.jpeg" 
              alt="Agriculteur dans une serre" 
              className="w-full h-full object-cover object-right md:object-center" 
            />
          </div>

          <div className="max-w-[1200px] w-full mx-auto relative z-20">
            <div className="max-w-[850px] flex flex-col items-start">
              <Link href="#processus" className="group mb-5 md:mb-6 inline-flex items-center gap-1.5 sm:gap-3 pr-2.5 sm:pr-5 pl-1 sm:pl-1.5 py-1 sm:py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/25 transition-all duration-300 w-fit max-w-full overflow-hidden">
                  <span className="bg-[var(--ork-ref-primary-40)] text-white text-[9px] sm:text-[10px] md:text-[11px] font-bold uppercase tracking-widest px-2 sm:px-3 py-1 rounded-full shrink-0">Cultiso</span>
                  <span className="text-[9.5px] sm:text-[13px] md:text-[14px] text-white/90 font-medium tracking-wide whitespace-nowrap truncate">
                    <span className="sm:hidden">1er écosystème intelligent pour l&apos;agriculture</span>
                    <span className="hidden sm:inline">Le premier écosystème intelligent pour l&apos;agriculture</span>
                  </span>
                </Link>
              
              <h1 className="mb-6 md:mb-6 text-[clamp(36px,6vw,68px)] font-title font-bold text-white leading-[1.05] tracking-[-0.03em]">
                <span className="sm:whitespace-nowrap">L&apos;agribusiness africain,</span> <br className="hidden sm:block" />
                <span className="text-[var(--ork-ref-secondary-70)] sm:whitespace-nowrap">sans improvisation.</span>
              </h1>
              
              <p className="mb-6 md:mb-8 text-[17px] md:text-[19px] leading-[1.5] text-white/95 font-sans font-semibold">
                Repérer les meilleures <span className="text-[var(--ork-ref-secondary-70)] font-bold">opportunités</span> d&apos;investissement, simuler la <span className="text-[var(--ork-ref-secondary-70)] font-bold">rentabilité</span> financière de vos projets avant d&apos;<span className="text-[var(--ork-ref-secondary-70)] font-bold">investir</span>, <span className="text-[var(--ork-ref-secondary-70)] font-bold">produire</span> sans improvisation et <span className="text-[var(--ork-ref-secondary-70)] font-bold">vendre</span> vos récoltes au meilleur prix...
                <span className="block mt-4 md:mt-0 md:inline">
                  {' '}C&apos;est ce que <span className="text-[var(--ork-ref-secondary-70)] font-bold">Cultiso</span> vous permet de faire grâce à un ensemble d&apos;outils conçus pour vous <span className="text-[var(--ork-ref-secondary-70)] font-bold">accompagner</span> dans la <span className="text-[var(--ork-ref-secondary-70)] font-bold">mise en place</span> et la <span className="text-[var(--ork-ref-secondary-70)] font-bold">gestion</span> de vos <span className="text-[var(--ork-ref-secondary-70)] font-bold">projets agricoles</span>.
                </span>
              </p>
              
              <div className="pt-0 md:pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                  <Link href="/cultiplan" className="group">
                    <button type="button" className="px-6 sm:px-8 h-[52px] text-[15.5px] font-bold bg-[var(--ork-ref-secondary-40)] hover:bg-[var(--ork-ref-secondary-35)] text-white rounded-lg shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2.5">
                      <svg className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Simuler mon business
                      <svg className="w-4 h-4 ml-0.5 transform group-hover:translate-x-1.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                  </Link>
                  
                  <div className="flex items-center gap-3 mt-1 sm:mt-0">
                    <div className="flex -space-x-2">
                      <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--ork-ref-primary-15)] bg-[var(--ork-ref-primary-40)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">MK</div>
                      <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--ork-ref-primary-15)] bg-brand-orange flex items-center justify-center text-[10px] font-bold text-white shadow-sm">SA</div>
                      <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--ork-ref-primary-15)] bg-[var(--ork-ref-secondary-50)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">TR</div>
                      <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--ork-ref-primary-15)] bg-white/10 backdrop-blur-md flex items-center justify-center text-[11px] font-bold text-white shadow-sm">+</div>
                    </div>
                    <div className="flex flex-col items-start justify-center">
                      <div className="flex text-[var(--ork-ref-secondary-70)] mb-1">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      </div>
                      <span className="text-white/90 text-[12.5px] font-medium leading-none tracking-wide">Déjà +50 agripreneurs inscrits</span>
                    </div>
                  </div>
                </div>

            </div>
          </div>
        </section>

        {/* --- 2. WORKFLOW SECTION --- */}
        <section id="processus" className="w-full bg-surface px-6 py-20 lg:py-24 border-t border-border">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center max-w-[1000px] mx-auto mb-16 md:mb-20">
              <h2 className="text-[20px] md:text-[clamp(28px,3.5vw,36px)] font-title font-bold text-foreground mb-6 tracking-[-0.02em] leading-[1.2]">
                L&apos;improvisation ruine vos investissements <br className="hidden md:block" /> 
                <span className="text-t-brand">— <span className="text-t-action">Cultiso</span> vous donne les outils pour les rentabiliser.</span>
              </h2>
              <p className="text-[16px] md:text-[18px] text-muted font-sans max-w-3xl mx-auto leading-relaxed">
                Des outils intelligents pour gérer et sécuriser chaque aspect de votre agrobusiness, de l&apos;idée jusqu&apos;à la vente de vos produits.
              </p>
            </div>

            <div className="max-w-[1100px] mx-auto mt-16 lg:mt-24">
              {/* Desktop layout: 2 rows of 3 columns */}
              <div className="hidden md:flex flex-col gap-16 lg:gap-20 w-full relative">
                
                {/* Row 1 */}
                <div className="relative grid grid-cols-3 gap-12 lg:gap-16 w-full">
                  <div className="absolute top-[32px] lg:top-[40px] left-[16.66%] right-[16.66%] h-[1px] bg-border z-0"></div>

                  {/* Step 1 */}
                  <div className="flex flex-col items-start relative group z-10">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-surface rounded-2xl lg:rounded-3xl shadow-sm border border-border flex items-center justify-center relative z-10 group-hover:-translate-y-2 transition-transform duration-500">
                      <svg className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ork-use-data-3-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    </div>
                    <div className="w-[1px] h-8 lg:h-12 bg-border ml-8 lg:ml-10 relative z-0"></div>
                    <div className="pt-2">
                      <div className="text-[13px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">01.</div>
                      <h4 className="font-extrabold text-foreground text-[20px] lg:text-[22px] tracking-tight mb-2">Opportunités</h4>
                      <p className="text-[14px] lg:text-[15px] text-muted font-medium leading-relaxed">Identifiez et analysez les meilleures opportunités d&apos;investissement agricole.</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex flex-col items-start relative group z-10">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-surface rounded-2xl lg:rounded-3xl shadow-sm border border-border flex items-center justify-center relative z-10 group-hover:-translate-y-2 transition-transform duration-500">
                      <svg className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ork-use-data-4-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="w-[1px] h-8 lg:h-12 bg-border ml-8 lg:ml-10 relative z-0"></div>
                    <div className="pt-2">
                      <div className="text-[13px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">02.</div>
                      <h4 className="font-extrabold text-foreground text-[20px] lg:text-[22px] tracking-tight mb-2">Rentabilité</h4>
                      <p className="text-[14px] lg:text-[15px] text-muted font-medium leading-relaxed">Simulez vos coûts et anticipez la rentabilité financière de votre projet.</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex flex-col items-start relative group z-10">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-surface rounded-2xl lg:rounded-3xl shadow-sm border border-border flex items-center justify-center relative z-10 group-hover:-translate-y-2 transition-transform duration-500">
                      <svg className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ork-use-data-2-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <div className="w-[1px] h-8 lg:h-12 bg-border ml-8 lg:ml-10 relative z-0"></div>
                    <div className="pt-2">
                      <div className="text-[13px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">03.</div>
                      <h4 className="font-extrabold text-foreground text-[20px] lg:text-[22px] tracking-tight mb-2">Mise en place</h4>
                      <p className="text-[14px] lg:text-[15px] text-muted font-medium leading-relaxed">Faites-vous accompagner par des experts qualifiés pour un lancement réussi.</p>
                    </div>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="relative grid grid-cols-3 gap-12 lg:gap-16 w-full">
                  <div className="absolute top-[32px] lg:top-[40px] left-[16.66%] right-[16.66%] h-[1px] bg-border z-0"></div>

                  {/* Step 4 */}
                  <div className="flex flex-col items-start relative group z-10">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-surface rounded-2xl lg:rounded-3xl shadow-sm border border-border flex items-center justify-center relative z-10 group-hover:-translate-y-2 transition-transform duration-500">
                      <svg className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ork-use-data-5-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                    </div>
                    <div className="w-[1px] h-8 lg:h-12 bg-border ml-8 lg:ml-10 relative z-0"></div>
                    <div className="pt-2">
                      <div className="text-[13px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">04.</div>
                      <h4 className="font-extrabold text-foreground text-[20px] lg:text-[22px] tracking-tight mb-2">Pilotage IA</h4>
                      <p className="text-[14px] lg:text-[15px] text-muted font-medium leading-relaxed">Pilotez votre exploitation avec précision au quotidien grâce à nos algorithmes intelligents.</p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex flex-col items-start relative group z-10">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-surface rounded-2xl lg:rounded-3xl shadow-sm border border-border flex items-center justify-center relative z-10 group-hover:-translate-y-2 transition-transform duration-500">
                      <svg className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ork-use-data-6-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    </div>
                    <div className="w-[1px] h-8 lg:h-12 bg-border ml-8 lg:ml-10 relative z-0"></div>
                    <div className="pt-2">
                      <div className="text-[13px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">05.</div>
                      <h4 className="font-extrabold text-foreground text-[20px] lg:text-[22px] tracking-tight mb-2">Production</h4>
                      <p className="text-[14px] lg:text-[15px] text-muted font-medium leading-relaxed">Menez à bien vos cycles agricoles et produisez en quantité ainsi qu&apos;en qualité.</p>
                    </div>
                  </div>

                  {/* Step 6 */}
                  <div className="flex flex-col items-start relative group z-10">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-selected rounded-2xl lg:rounded-3xl shadow-sm border-2 border-[var(--ork-use-border-selected)] flex items-center justify-center relative z-10 group-hover:-translate-y-2 transition-transform duration-500">
                      <svg className="w-8 h-8 lg:w-10 lg:h-10 text-t-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="w-[1px] h-8 lg:h-12 bg-[var(--ork-use-border-selected)] opacity-40 ml-8 lg:ml-10 relative z-0"></div>
                    <div className="pt-2">
                      <div className="text-[13px] font-extrabold text-t-brand tracking-wider mb-1 font-mono-numbers">06.</div>
                      <h4 className="font-extrabold text-foreground text-[20px] lg:text-[22px] tracking-tight mb-2">Ventes</h4>
                      <p className="text-[14px] lg:text-[15px] text-muted font-medium leading-relaxed">Accédez aux marchés porteurs et vendez vos récoltes agricoles au meilleur prix.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile layout: 3 rows of 2 columns */}
              <div className="flex md:hidden flex-col gap-10 w-full relative">
                
                {/* Row 1 */}
                <div className="relative grid grid-cols-2 gap-6 w-full">
                  <div className="absolute top-[28px] left-[25%] right-[25%] h-[1px] bg-border z-0"></div>

                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-14 h-14 bg-surface rounded-2xl shadow-sm border border-border flex items-center justify-center relative z-10">
                      <svg className="w-7 h-7 text-[var(--ork-use-data-3-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    </div>
                    <div className="w-[1px] h-6 bg-border mx-auto relative z-0"></div>
                    <div className="pt-1 flex flex-col items-center">
                      <div className="text-[11px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">01.</div>
                      <h4 className="font-extrabold text-foreground text-[16px] leading-tight mb-1">Opportunités</h4>
                      <p className="text-[13px] text-muted font-medium leading-snug">Identifiez et analysez les meilleures opportunités d&apos;investissement agricole.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-14 h-14 bg-surface rounded-2xl shadow-sm border border-border flex items-center justify-center relative z-10">
                      <svg className="w-7 h-7 text-[var(--ork-use-data-4-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="w-[1px] h-6 bg-border mx-auto relative z-0"></div>
                    <div className="pt-1 flex flex-col items-center">
                      <div className="text-[11px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">02.</div>
                      <h4 className="font-extrabold text-foreground text-[16px] leading-tight mb-1">Rentabilité</h4>
                      <p className="text-[13px] text-muted font-medium leading-snug">Simulez vos coûts et anticipez la rentabilité de votre projet.</p>
                    </div>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="relative grid grid-cols-2 gap-6 w-full">
                  <div className="absolute top-[28px] left-[25%] right-[25%] h-[1px] bg-border z-0"></div>

                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-14 h-14 bg-surface rounded-2xl shadow-sm border border-border flex items-center justify-center relative z-10">
                      <svg className="w-7 h-7 text-[var(--ork-use-data-2-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <div className="w-[1px] h-6 bg-border mx-auto relative z-0"></div>
                    <div className="pt-1 flex flex-col items-center">
                      <div className="text-[11px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">03.</div>
                      <h4 className="font-extrabold text-foreground text-[16px] leading-tight mb-1">Mise en place</h4>
                      <p className="text-[13px] text-muted font-medium leading-snug">Faites-vous accompagner par des experts qualifiés.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-14 h-14 bg-surface rounded-2xl shadow-sm border border-border flex items-center justify-center relative z-10">
                      <svg className="w-7 h-7 text-[var(--ork-use-data-5-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                    </div>
                    <div className="w-[1px] h-6 bg-border mx-auto relative z-0"></div>
                    <div className="pt-1 flex flex-col items-center">
                      <div className="text-[11px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">04.</div>
                      <h4 className="font-extrabold text-foreground text-[16px] leading-tight mb-1">Pilotage IA</h4>
                      <p className="text-[13px] text-muted font-medium leading-snug">Pilotez votre exploitation avec précision au quotidien.</p>
                    </div>
                  </div>
                </div>

                {/* Row 3 */}
                <div className="relative grid grid-cols-2 gap-6 w-full">
                  <div className="absolute top-[28px] left-[25%] right-[25%] h-[1px] bg-border z-0"></div>

                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-14 h-14 bg-surface rounded-2xl shadow-sm border border-border flex items-center justify-center relative z-10">
                      <svg className="w-7 h-7 text-[var(--ork-use-data-6-mark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    </div>
                    <div className="w-[1px] h-6 bg-border mx-auto relative z-0"></div>
                    <div className="pt-1 flex flex-col items-center">
                      <div className="text-[11px] font-extrabold text-muted opacity-65 tracking-wider mb-1 font-mono-numbers">05.</div>
                      <h4 className="font-extrabold text-foreground text-[16px] leading-tight mb-1">Production</h4>
                      <p className="text-[13px] text-muted font-medium leading-snug">Menez à bien vos cycles et produisez en quantité et en qualité.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="w-14 h-14 bg-selected rounded-2xl shadow-sm border-2 border-[var(--ork-use-border-selected)] flex items-center justify-center relative z-10">
                      <svg className="w-7 h-7 text-t-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="w-[1px] h-6 bg-[var(--ork-use-border-selected)] opacity-40 mx-auto relative z-0"></div>
                    <div className="pt-1 flex flex-col items-center">
                      <div className="text-[11px] font-extrabold text-t-brand tracking-wider mb-1 font-mono-numbers">06.</div>
                      <h4 className="font-extrabold text-foreground text-[16px] leading-tight mb-1">Ventes</h4>
                      <p className="text-[13px] text-muted font-medium leading-snug">Accédez aux marchés et vendez au meilleur prix.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* --- 4.1 CULTIPLAN --- */}
        <section className="w-full bg-background px-6 py-20 lg:py-32 overflow-hidden border-t border-border">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              
              {/* Content Column */}
              <div className="w-full lg:w-[45%] flex flex-col items-start text-left z-10">
                <div className="flex items-center gap-2 mb-6">
                  <span className="inline-flex [[data-theme=dark]_&]:hidden">
                    <Logo variant="symbol" size="sm" tone="on-light" className="w-10" />
                  </span>
                  <span className="hidden [[data-theme=dark]_&]:inline-flex">
                    <Logo variant="symbol" size="sm" tone="on-dark" className="w-10" />
                  </span>
                  <span className="font-title font-bold text-foreground text-lg tracking-tight">Cultiplan</span>
                </div>
                
                <h2 className="text-[clamp(32px,4vw,48px)] font-title font-bold text-foreground leading-[1.1] mb-6">
                  Étudiez le marché avant d&apos;investir
                </h2>
                
                <p className="text-[17px] text-muted font-sans mb-10 leading-relaxed max-w-lg">
                  Analysez la faisabilité et la rentabilité financière de votre projet agrobusiness. Cultiplan génère automatiquement votre plan d&apos;affaires sur-mesure grâce à l&apos;Intelligence Artificielle.
                </p>
                
                {/* Checkmarks */}
                <div className="flex flex-col gap-5 mb-10 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 text-on-brand">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Génération automatique de Business Plan</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 text-on-brand">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Simulateur de rentabilité financière IA</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 text-on-brand">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Export PDF professionnel</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/cultiplan" className="bg-brand hover:opacity-95 text-on-brand px-7 h-[48px] rounded-lg font-bold text-[15px] transition-all duration-300 hover:-translate-y-0.5 shadow-md flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Lancer Cultiplan
                  </Link>
                </div>
              </div>

              {/* 3D Mockup Column */}
              <div className="w-full lg:w-[55%] relative min-h-[500px] lg:min-h-[600px] flex items-center justify-center" style={{ perspective: '1200px' }}>
                <div className="w-full max-w-[680px] transition-transform duration-700 ease-out" 
                     style={{ transform: 'rotateY(-8deg) rotateX(4deg)', transformStyle: 'preserve-3d' }}>
                  
                  <div className="bg-surface rounded-2xl border border-border shadow-xl w-full flex flex-col overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-gradient-to-r from-[var(--ork-ref-primary-15)] to-[var(--ork-ref-primary-25)]">
                      <div className="flex items-center gap-3">
                        <span className="font-title font-bold text-white text-sm">Cultiplan</span>
                        <span className="text-[10px] text-white/65 font-medium">Business Plan</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="px-2.5 py-1 bg-[var(--ork-ref-secondary-40)] rounded-md text-[10px] font-bold text-white flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Exporter PDF
                        </button>
                        <div className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center text-[10px] font-bold">KA</div>
                      </div>
                    </div>
                    <div className="px-5 py-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-foreground text-[15px] mb-0.5">Culture de Tomate — Région Maritime</div>
                          <div className="text-[11px] text-muted flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Avépozo, Togo
                            </span>
                            <span>2 hectares</span>
                            <span>Cycle: 90 jours</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-[var(--ork-use-background-success-bold)] animate-pulse"></div>
                          <span className="text-[10px] font-bold text-t-success">Viable</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 pt-4 pb-3">
                      <div className="bg-sunken border border-border rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Marge nette prévisionnelle</div>
                          <div className="text-2xl font-black text-foreground font-title font-mono-numbers tracking-tight">12 450 000 <span className="text-sm text-muted font-bold font-sans">FCFA</span></div>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="relative w-16 h-16">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--ork-use-border-default)" strokeWidth="3" />
                              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--ork-use-data-2-mark)" strokeWidth="3" strokeDasharray="64 100" strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[11px] font-black text-t-action font-mono-numbers">+145%</span>
                            </div>
                          </div>
                          <span className="text-[8px] font-bold text-muted mt-1">ROI</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 pb-3 grid grid-cols-3 gap-3">
                      <div className="bg-sunken rounded-xl p-3 border border-border">
                        <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Chiffre d&apos;affaires</div>
                        <div className="text-[15px] font-black text-foreground font-mono-numbers">21,0M <span className="text-[9px] text-muted font-sans">F</span></div>
                      </div>
                      <div className="bg-sunken rounded-xl p-3 border border-border">
                        <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Charges totales</div>
                        <div className="text-[15px] font-black text-foreground font-mono-numbers">8,55M <span className="text-[9px] text-muted font-sans">F</span></div>
                      </div>
                      <div className="bg-sunken rounded-xl p-3 border border-border">
                        <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Point mort</div>
                        <div className="text-[15px] font-black text-foreground font-mono-numbers">J+38</div>
                      </div>
                    </div>
                    <div className="px-5 pb-4">
                      <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Répartition des charges</div>
                      <div className="space-y-2.5">
                        <div>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-bold text-foreground">Intrants &amp; Semences</span>
                            <span className="font-bold text-t-action font-mono-numbers">45%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-sunken"><div className="h-full bg-[var(--ork-use-data-2-mark)] rounded-full" style={{width: "45%"}}></div></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-bold text-foreground">Main d&apos;œuvre</span>
                            <span className="font-bold text-t-brand font-mono-numbers">35%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-sunken"><div className="h-full bg-[var(--ork-use-data-4-mark)] rounded-full" style={{width: "35%"}}></div></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-bold text-foreground">Logistique &amp; Divers</span>
                            <span className="font-bold text-t-info font-mono-numbers">20%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-sunken"><div className="h-full bg-[var(--ork-use-data-3-mark)] rounded-full" style={{width: "20%"}}></div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>

            </div>
          </div>
        </section>

{/* --- 4.2 CULTISIA --- */}
        <section className="w-full bg-surface px-6 py-20 lg:py-32 overflow-hidden border-t border-border">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
              
              {/* Content Column */}
              <div className="w-full lg:w-[45%] flex flex-col items-start text-left z-10">
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="ork-avatar ork-avatar--ai w-9 h-9 shrink-0" aria-hidden="true">
                    <span className="inline-flex [[data-theme=dark]_&]:hidden">
                      <Logo variant="symbol" size="xs" tone="on-light" decorative className="w-5" />
                    </span>
                    <span className="hidden [[data-theme=dark]_&]:inline-flex">
                      <Logo variant="symbol" size="xs" tone="on-dark" decorative className="w-5" />
                    </span>
                  </div>
                  <span className="font-title font-bold text-t-action text-lg tracking-tight">Cultisia</span>
                  <span className="ork-avatar-ai-label">IA</span>
                </div>
                
                <h2 className="text-[clamp(32px,4vw,48px)] font-title font-bold text-foreground leading-[1.1] mb-6">
                  Votre ingénieur agronome en poche
                </h2>
                
                <p className="text-[17px] text-muted mb-10 leading-relaxed max-w-lg">
                  Cultisia est l&apos;intelligence artificielle au cœur de notre application. Posez-lui vos questions, parlez-lui de vos projets, et laissez-la vous guider simplement, étape par étape, sans jargon technique complexe.
                </p>
                
                {/* Checkmarks */}
                <div className="flex flex-col gap-5 mb-10 w-full">

                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action text-on-action flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Assistance disponible 24h/24 et 7j/7</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action text-on-action flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Réponses simples et adaptées à votre réalité</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action text-on-action flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Orientation vers les bons outils et experts</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/register" className="bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action px-7 h-[48px] rounded-[var(--ork-use-radius-button)] font-bold text-[15px] transition-all duration-300 hover:-translate-y-0.5 shadow-raised flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Discuter avec Cultisia
                  </Link>
                </div>
              </div>

              {/* 3D Mockup Column */}
              <div className="w-full lg:w-[55%] relative min-h-[500px] lg:min-h-[600px] flex items-center justify-center" style={{ perspective: '1200px' }}>
                <div className="w-full max-w-[680px] transition-transform duration-700 ease-out" 
                     style={{ transform: 'rotateY(8deg) rotateX(4deg)', transformStyle: 'preserve-3d' }}>
                  
                  {/* Cultisia Dashboard Mockup */}
                  <div className="bg-surface rounded-2xl border border-border shadow-overlay w-full flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-[52px] bg-[var(--ork-ref-primary-15)] flex flex-col items-center py-4 gap-4 flex-shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mt-auto">
                        <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      {/* Top Bar */}
                      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-title font-bold text-foreground text-sm">Cultisia</span>
                          <span className="text-[10px] text-muted font-medium">Intelligence Marché</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-[var(--ork-use-background-success-subtle)] text-t-success rounded-md text-[10px] font-bold">Live</span>
                          <div className="w-7 h-7 rounded-full bg-[var(--ork-ref-primary-25)] text-white flex items-center justify-center text-[10px] font-bold">AK</div>
                        </div>
                      </div>
                      {/* KPI Row */}
                      <div className="px-5 pt-4 pb-3 grid grid-cols-3 gap-3">
                        <div className="bg-sunken rounded-xl p-3 border border-border">
                          <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Tomate Ronde</div>
                          <div className="text-lg font-black text-foreground font-mono-numbers">450 <span className="text-[10px] text-muted font-bold font-sans">F/kg</span></div>
                          <div className="text-[10px] font-bold text-t-success flex items-center gap-0.5 mt-1 font-mono-numbers">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                            +12,5%
                          </div>
                        </div>
                        <div className="bg-sunken rounded-xl p-3 border border-border">
                          <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Maïs Blanc</div>
                          <div className="text-lg font-black text-foreground font-mono-numbers">280 <span className="text-[10px] text-muted font-bold font-sans">F/kg</span></div>
                          <div className="text-[10px] font-bold text-t-danger flex items-center gap-0.5 mt-1 font-mono-numbers">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                            -3,2%
                          </div>
                        </div>
                        <div className="bg-sunken rounded-xl p-3 border border-border">
                          <div className="text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Piment Frais</div>
                          <div className="text-lg font-black text-foreground font-mono-numbers">1 200 <span className="text-[10px] text-muted font-bold font-sans">F/kg</span></div>
                          <div className="text-[10px] font-bold text-t-success flex items-center gap-0.5 mt-1 font-mono-numbers">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                            +8,1%
                          </div>
                        </div>
                      </div>
                      {/* Chart */}
                      <div className="px-5 pb-3">
                        <div className="bg-sunken rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-[11px] font-bold text-foreground">Évolution des prix — Lomé</div>
                            <div className="flex gap-1">
                              <span className="px-2 py-0.5 bg-surface border border-border rounded text-[9px] font-bold text-muted">7j</span>
                              <span className="px-2 py-0.5 bg-brand rounded text-[9px] font-bold text-on-brand">30j</span>
                              <span className="px-2 py-0.5 bg-surface border border-border rounded text-[9px] font-bold text-muted">90j</span>
                            </div>
                          </div>
                          <div className="h-[100px] w-full relative">
                            <svg viewBox="0 0 500 100" preserveAspectRatio="none" className="w-full h-full">
                              <defs>
                                <linearGradient id="cultisia-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--ork-use-text-brand)" stopOpacity="0.22" />
                                  <stop offset="100%" stopColor="var(--ork-use-text-brand)" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path d="M0,85 C30,80 60,75 100,70 C140,65 170,80 210,55 C250,30 290,60 330,35 C370,15 420,25 460,10 L500,5 L500,100 L0,100 Z" fill="url(#cultisia-grad)" />
                              <path d="M0,85 C30,80 60,75 100,70 C140,65 170,80 210,55 C250,30 290,60 330,35 C370,15 420,25 460,10 L500,5" fill="none" stroke="var(--ork-use-text-brand)" strokeWidth="2.5" strokeLinecap="round" />
                              <circle cx="460" cy="10" r="4" fill="var(--ork-use-text-brand)" />
                              <circle cx="460" cy="10" r="7" fill="var(--ork-use-text-brand)" fillOpacity="0.2" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      {/* Table */}
                      <div className="px-5 pb-4">
                        <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Marchés à surveiller</div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between bg-[var(--ork-use-background-success-subtle)] border border-border rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[var(--ork-use-data-4-mark)]"></div>
                              <span className="text-[11px] font-bold text-foreground">Lomé — Grand Marché</span>
                            </div>
                            <span className="text-[10px] font-bold text-t-success">Forte demande</span>
                          </div>
                          <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[var(--ork-use-data-2-mark)]"></div>
                              <span className="text-[11px] font-bold text-foreground">Kara — Marché Central</span>
                            </div>
                            <span className="text-[10px] font-bold text-t-action">Modéré</span>
                          </div>
                          <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[var(--ork-use-data-3-mark)]"></div>
                              <span className="text-[11px] font-bold text-foreground">Sokodé — Gare routière</span>
                            </div>
                            <span className="text-[10px] font-bold text-t-info">Stable</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* --- 4.3 CULTIMA --- */}
        <section className="w-full bg-sunken px-6 py-20 lg:py-32 overflow-hidden border-t border-border">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
              {/* Content Column */}
              <div className="w-full lg:w-[45%] flex flex-col items-start text-left z-10">
                <div className="flex items-center gap-2 mb-6">
                  <span className="inline-flex [[data-theme=dark]_&]:hidden">
                    <Logo variant="symbol" size="sm" tone="on-light" className="w-10" />
                  </span>
                  <span className="hidden [[data-theme=dark]_&]:inline-flex">
                    <Logo variant="symbol" size="sm" tone="on-dark" className="w-10" />
                  </span>
                  <span className="font-title font-bold text-t-action text-lg tracking-tight">Cultima</span>
                </div>
                
                <h2 className="text-[clamp(32px,4vw,48px)] font-title font-bold text-foreground leading-[1.1] mb-6">
                  Gérez votre business au quotidien
                </h2>
                
                <p className="text-[17px] text-muted font-sans mb-10 leading-relaxed max-w-lg">
                  Prenez le contrôle total de votre business agricole. De la gestion des finances à la formulation de provendes en passant par le calendrier des semis, Cultima est votre tableau de bord ERP complet.
                </p>
                
                {/* Checkmarks */}
                <div className="flex flex-col gap-5 mb-10 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action flex items-center justify-center flex-shrink-0 text-on-action">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Suivi financier &amp; Trésorerie</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action flex items-center justify-center flex-shrink-0 text-on-action">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Calendrier de Semis &amp; Récoltes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action flex items-center justify-center flex-shrink-0 text-on-action">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Formulation de Provendes (Élevage)</span>
                  </div>
                </div>
                
                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/cultima" className="bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action px-7 h-[48px] rounded-lg font-bold text-[15px] transition-all duration-300 hover:-translate-y-0.5 shadow-md flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    Gérer mon business
                  </Link>
                </div>
              </div>

              {/* 3D Mockup Column */}
              <div className="w-full lg:w-[55%] relative min-h-[500px] lg:min-h-[600px] flex items-center justify-center" style={{ perspective: '1200px' }}>
                <div className="w-full max-w-[680px] transition-transform duration-700 ease-out" 
                     style={{ transform: 'rotateY(8deg) rotateX(4deg)', transformStyle: 'preserve-3d' }}>
                  
                  <div className="bg-surface rounded-2xl border border-border shadow-xl w-full flex flex-col overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-sunken">
                      <div className="flex items-center gap-3">
                        <span className="font-title font-bold text-t-action text-sm">Cultima</span>
                        <span className="text-[10px] text-muted font-medium">Tableau de bord</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--ork-use-background-action-subtle)] text-t-action flex items-center justify-center text-[10px] font-bold">KA</div>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-4 bg-background">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-surface p-3 rounded-xl border border-border shadow-sm">
                          <div className="text-[10px] text-muted font-bold mb-1 uppercase tracking-wider">Trésorerie</div>
                          <div className="text-[18px] font-bold text-foreground font-mono-numbers">1 250 000 F</div>
                        </div>
                        <div className="bg-surface p-3 rounded-xl border border-border shadow-sm">
                          <div className="text-[10px] text-muted font-bold mb-1 uppercase tracking-wider">Dépenses (Mois)</div>
                          <div className="text-[18px] font-bold text-t-danger font-mono-numbers">- 450 000 F</div>
                        </div>
                        <div className="bg-[var(--ork-use-background-action-subtle)] p-3 rounded-xl border border-border shadow-sm">
                          <div className="text-[10px] text-t-action font-bold mb-1 uppercase tracking-wider">Ventes (Mois)</div>
                          <div className="text-[18px] font-bold text-t-action font-mono-numbers">+ 800 000 F</div>
                        </div>
                      </div>
                      
                      <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
                        <h4 className="text-[13px] font-bold text-foreground mb-3">Tâches du jour (Semis)</h4>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3 p-2 hover:bg-sunken rounded-lg">
                            <input type="checkbox" readOnly className="w-4 h-4 rounded border-border accent-[var(--ork-use-text-brand)]" />
                            <span className="text-[12px] font-medium text-foreground">Semer Tomate (Parcelle A)</span>
                            <span className="ml-auto text-[10px] font-bold px-2 py-1 bg-[var(--ork-use-background-success-subtle)] text-t-success rounded">Urgent</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 hover:bg-sunken rounded-lg">
                            <input type="checkbox" readOnly className="w-4 h-4 rounded border-border accent-[var(--ork-use-text-brand)]" />
                            <span className="text-[12px] font-medium text-foreground">Vérifier système d&apos;irrigation</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- 4.4 CULTISEIL --- */}
        <section className="w-full bg-background px-6 py-20 lg:py-32 overflow-hidden border-t border-border">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              
              {/* Content Column */}
              <div className="w-full lg:w-[45%] flex flex-col items-start text-left z-10">
                <div className="flex items-center gap-2 mb-6">
                  <span className="inline-flex [[data-theme=dark]_&]:hidden">
                    <Logo variant="symbol" size="sm" tone="on-light" className="w-10" />
                  </span>
                  <span className="hidden [[data-theme=dark]_&]:inline-flex">
                    <Logo variant="symbol" size="sm" tone="on-dark" className="w-10" />
                  </span>
                  <span className="font-title font-bold text-foreground text-lg tracking-tight">Cultiseil</span>
                  <span className="ml-2 px-2.5 py-1 bg-sunken text-muted rounded-md text-[10px] font-bold uppercase tracking-wider border border-border">Bientôt disponible</span>
                </div>
                
                <h2 className="text-[clamp(32px,4vw,48px)] font-title font-bold text-foreground leading-[1.1] mb-6">
                  Produisez avec précision
                </h2>
                
                <p className="text-[17px] text-muted font-sans mb-10 leading-relaxed max-w-lg">
                  L&apos;outil indispensable sur le terrain. Identifiez les maladies de vos plantes, analysez l&apos;état de vos sols et adaptez vos traitements agricoles grâce à nos algorithmes et données météorologiques locales.
                </p>
                
                {/* Checkmarks */}
                <div className="flex flex-col gap-5 mb-10 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 text-on-brand">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Diagnostic visuel des maladies et ravageurs</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 text-on-brand">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Analyse des sols et conseils de fertilisation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 text-on-brand">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Prévisions météo et alertes climatiques locales</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/register" className="bg-surface border-2 border-[var(--ork-use-border-bold)] text-foreground hover:bg-sunken px-7 h-[48px] rounded-lg font-bold text-[15px] transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    M&apos;avertir du lancement
                  </Link>
                </div>
              </div>

              {/* 3D Mockup Column */}
              <div className="w-full lg:w-[55%] relative lg:min-h-[600px] flex items-center justify-center lg:[perspective:1200px]">
                <div className="w-full max-w-[680px] transition-transform duration-700 ease-out lg:[transform:rotateY(-8deg)_rotateX(4deg)] lg:[transform-style:preserve-3d]">
                  
                  <div className="bg-surface rounded-2xl border border-border shadow-xl w-full flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-[44px] sm:w-[52px] bg-[var(--ork-ref-primary-15)] flex flex-col items-center py-4 gap-4 flex-shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white/55" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white/55" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mt-auto">
                        <svg className="w-4 h-4 text-white/55" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                    </div>
                    {/* Main Content */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="px-3 sm:px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-title font-bold text-foreground text-sm shrink-0">Cultiseil</span>
                          <span className="text-[10px] text-muted font-medium truncate">Accompagnement Technique</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="px-2 py-1 bg-[var(--ork-use-background-danger-subtle)] border border-border rounded-md text-[10px] font-bold text-t-danger flex items-center gap-1 whitespace-nowrap">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--ork-use-background-danger-bold)] animate-pulse"></div>
                            2 alertes
                          </div>
                          <div className="w-7 h-7 rounded-full bg-[var(--ork-ref-primary-25)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">FA</div>
                        </div>
                      </div>
                      <div className="px-3 sm:px-5 pt-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-sunken rounded-xl p-3 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-border">
                              <svg className="w-4 h-4 text-t-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                            </div>
                            <div>
                              <div className="font-bold text-foreground text-[11px]">Ferme d&apos;Avépozo</div>
                              <div className="text-[9px] text-muted">Production Mixte • 2 ha</div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-sunken rounded-xl p-3 border border-border flex items-center gap-3">
                          <div className="text-center">
                            <div className="text-xl font-black text-foreground font-mono-numbers">32°C</div>
                            <div className="text-[9px] text-muted font-bold">Humid. 78%</div>
                          </div>
                          <div className="flex-1 flex flex-col gap-1">
                            <div className="bg-[var(--ork-use-background-danger-subtle)] border border-border rounded-md px-2 py-1">
                              <div className="text-[9px] font-bold text-t-danger flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                Alerte sanitaire
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 pb-3">
                        <div className="bg-sunken rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-[11px] font-bold text-foreground">Itinéraire Technique — Jour 42/90</div>
                            <div className="text-[10px] font-bold text-t-brand bg-selected px-2 py-0.5 rounded font-mono-numbers">47%</div>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface border border-border mb-4">
                            <div className="h-full bg-brand rounded-full" style={{width: "47%"}}></div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2.5 opacity-60">
                              <div className="w-4 h-4 rounded bg-brand flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-3 h-3 text-on-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              </div>
                              <div className="text-[11px] font-bold text-muted line-through">Irrigation matinale — 6h00</div>
                            </div>
                            <div className="flex items-start gap-2.5 bg-[var(--ork-use-background-danger-subtle)] -mx-2 px-2 py-1.5 rounded-lg border border-border">
                              <div className="w-4 h-4 rounded border-2 border-[var(--ork-use-text-danger)] flex-shrink-0 mt-0.5"></div>
                              <div>
                                <div className="text-[11px] font-bold text-t-danger">Contrôle Préventif</div>
                                <div className="text-[9px] text-muted mt-0.5">Vérifier l&apos;apparition de tâches sur les feuilles.</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <div className="w-4 h-4 rounded border-2 border-border flex-shrink-0 mt-0.5"></div>
                              <div className="text-[11px] font-bold text-muted">Application d&apos;engrais foliaire — 15h00</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 pb-4">
                        <div className="bg-sunken rounded-xl border border-border p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-[var(--ork-ref-primary-25)] text-white flex items-center justify-center text-[8px] font-bold">Dr</div>
                            <div>
                              <span className="text-[10px] font-bold text-foreground">Dr. Kofi Mensah</span>
                              <span className="text-[9px] text-muted ml-1">• Agronome certifié</span>
                            </div>
                            <div className="ml-auto w-2 h-2 rounded-full bg-[var(--ork-use-background-success-bold)]"></div>
                          </div>
                          <div className="bg-surface rounded-lg p-2 border border-border text-[10px] text-muted leading-relaxed">
                            &ldquo;Les tâches observées correspondent à une septoriose précoce. Je recommande un traitement fongique immédiat.&rdquo;
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>

            </div>
          </div>
        </section>

{/* --- 4.5 CULTISHOP --- */}
        <section className="w-full bg-surface px-6 py-20 lg:py-32 overflow-hidden border-t border-border">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
              
              <div className="w-full lg:w-[45%] flex flex-col items-start text-left z-10">
                <div className="flex items-center gap-2 mb-6">
                  <span className="inline-flex [[data-theme=dark]_&]:hidden">
                    <Logo variant="symbol" size="sm" tone="on-light" className="w-10" />
                  </span>
                  <span className="hidden [[data-theme=dark]_&]:inline-flex">
                    <Logo variant="symbol" size="sm" tone="on-dark" className="w-10" />
                  </span>
                  <span className="font-title font-bold text-t-action text-lg tracking-tight">Cultishop</span>
                  <span className="ml-2 px-2.5 py-1 bg-sunken text-muted rounded-md text-[10px] font-bold uppercase tracking-wider border border-border">Bientôt disponible</span>
                </div>
                
                <h2 className="text-[clamp(32px,4vw,48px)] font-title font-bold text-foreground leading-[1.1] mb-6">
                  Vendez et achetez mieux
                </h2>
                
                <p className="text-[17px] text-muted font-sans mb-10 leading-relaxed max-w-lg">
                  Accédez à des fournisseurs d&apos;intrants et d&apos;équipements fiables pour sécuriser vos approvisionnements.
                </p>
                
                <div className="flex flex-col gap-5 mb-10 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action flex items-center justify-center flex-shrink-0 text-on-action">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Achat d&apos;intrants et d&apos;équipements</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action flex items-center justify-center flex-shrink-0 text-on-action">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Commande simplifiée</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-action flex items-center justify-center flex-shrink-0 text-on-action">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-foreground font-bold text-[15px] leading-tight">Mise en relation avec des fournisseurs fiables</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/register" className="bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action px-7 h-[48px] rounded-lg font-bold text-[15px] transition-all duration-300 hover:-translate-y-0.5 shadow-md flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    Acheter des intrants
                  </Link>
                  <Link href="/register" className="bg-transparent border-2 border-[var(--ork-use-border-bold)] text-t-action hover:bg-sunken px-7 h-[48px] rounded-lg font-bold text-[15px] transition-all duration-300 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Vendre mes récoltes
                  </Link>
                </div>
              </div>

              <div className="w-full lg:w-[55%] relative min-h-[500px] lg:min-h-[600px] flex items-center justify-center" style={{ perspective: '1200px' }}>
                <div className="w-full max-w-[680px] transition-transform duration-700 ease-out" 
                     style={{ transform: 'rotateY(8deg) rotateX(4deg)', transformStyle: 'preserve-3d' }}>
                  
                  <div className="bg-surface rounded-2xl border border-border shadow-xl w-full flex flex-col overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-title font-bold text-foreground text-sm">Cultishop</span>
                        <span className="text-[10px] text-muted font-medium">Marketplace B2B</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-sunken border border-border rounded-lg px-2.5 py-1.5 text-[10px] text-muted w-[140px]">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          Rechercher...
                        </div>
                        <div className="w-7 h-7 rounded-full bg-[var(--ork-ref-primary-25)] text-white flex items-center justify-center text-[10px] font-bold">AK</div>
                      </div>
                    </div>
                    <div className="px-5 pt-3 pb-1 flex gap-1.5 border-b border-border">
                      <div className="px-3 py-1.5 bg-selected text-t-brand ring-1 ring-inset ring-[var(--ork-use-border-selected)] rounded-md text-[10px] font-bold">Offres reçues</div>
                      <div className="px-3 py-1.5 text-muted text-[10px] font-bold hover:bg-sunken rounded-md">Mes annonces</div>
                      <div className="px-3 py-1.5 text-muted text-[10px] font-bold hover:bg-sunken rounded-md">Intrants</div>
                    </div>
                    <div className="px-5 pt-4 pb-3">
                      <div className="bg-sunken rounded-xl border border-border p-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-action text-on-action text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">Meilleure offre</div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-[var(--ork-ref-primary-25)] flex items-center justify-center font-bold text-xs text-white">SR</div>
                          <div>
                            <div className="font-bold text-foreground text-[13px]">Supermarché Ramco</div>
                            <div className="flex items-center gap-1 text-[10px] text-muted">
                              <svg className="w-3 h-3 text-t-success" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              Acheteur vérifié • Lomé
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3 bg-surface rounded-lg p-2.5 border border-border">
                          <div>
                            <div className="text-[9px] text-muted mb-0.5">Demande</div>
                            <div className="font-bold text-foreground text-[11px]">12 T. de Maïs</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-muted mb-0.5">Prix proposé</div>
                            <div className="font-bold text-t-success text-[11px] font-mono-numbers">450 F/kg</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-muted mb-0.5">Valeur totale</div>
                            <div className="font-bold text-foreground text-[11px] font-mono-numbers">5,4M FCFA</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="flex-1 bg-brand hover:opacity-95 text-on-brand font-bold py-2 rounded-lg text-[11px] transition-colors">Accepter l&apos;offre</button>
                          <button type="button" className="flex-1 bg-surface border border-border text-foreground font-bold py-2 rounded-lg text-[11px] transition-colors">Négocier</button>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 pb-3">
                      <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Autres offres (3)</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-sunken border border-border rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-surface border border-border text-muted flex items-center justify-center font-bold text-[10px]">CK</div>
                            <div>
                              <div className="font-bold text-foreground text-[11px]">Coop. de Kpalimé</div>
                              <div className="text-[9px] text-muted">5 Tonnes • 420 F/kg</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-foreground bg-surface border border-border px-2 py-0.5 rounded font-mono-numbers">2,1M F</span>
                        </div>
                        <div className="flex items-center justify-between bg-sunken border border-border rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-surface border border-border text-muted flex items-center justify-center font-bold text-[10px]">HA</div>
                            <div>
                              <div className="font-bold text-foreground text-[11px]">Hôtel Agbodrafo</div>
                              <div className="text-[9px] text-muted">2 Tonnes • 480 F/kg</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-foreground bg-surface border border-border px-2 py-0.5 rounded font-mono-numbers">960K F</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 pb-4">
                      <div className="bg-sunken rounded-xl border border-border p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-t-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          <span className="text-[10px] font-bold text-foreground">Paiement sécurisé Cultiso</span>
                        </div>
                        <span className="text-[10px] font-bold text-t-success">Escrow activé</span>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="w-full bg-background px-6 py-24 lg:py-32 border-t border-border">
          <div className="max-w-[1000px] mx-auto text-center flex flex-col items-center">
            
            <h2 className="text-[clamp(32px,5vw,56px)] font-title font-bold text-foreground leading-[1.1] mb-6 tracking-[-0.02em]">
              Prêt à structurer votre projet agricole ?
            </h2>
            
            <p className="text-[17px] md:text-[19px] text-muted font-sans mb-12 max-w-[600px] leading-relaxed">
              Découvrez la puissance de Cultiplan sans créer de compte. Calculez votre rentabilité en quelques minutes et prenez les bonnes décisions avant d&apos;investir.
            </p>
            
            <Link href="/cultiplan" className="inline-block group">
              <button type="button" className="px-10 h-[56px] text-[16px] font-bold bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action rounded-lg shadow-md transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 mx-auto">
                Démarrer une simulation
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </Link>
            
          </div>
        </section>
    </div>
  );
}








