import Image from 'next/image';
import Link from 'next/link';

// Données factices pour les articles
const FEATURED_POST = {
  id: 'featured-1',
  category: 'AGRONOMIE',
  date: '15 AOÛT 2026',
  title: 'Optimiser le rendement de votre maïs en saison sèche',
  excerpt: 'Découvrez nos techniques éprouvées d\'irrigation de précision et de gestion des sols pour maximiser votre production même lorsque la pluie se fait rare. Une analyse complète basée sur nos données terrain.',
  imageUrl: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?q=80&w=1000&auto=format&fit=crop',
};

const POSTS = [
  {
    id: 1,
    category: 'MARCHÉS',
    date: '3 AOÛT 2026',
    title: 'Analyse des prix : La flambée du soja en Afrique de l\'Ouest',
    excerpt: 'Pourquoi le prix du soja a-t-il augmenté de 40% ce trimestre ? Décryptage des facteurs économiques et opportunités pour les producteurs.',
    imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 2,
    category: 'ÉLEVAGE',
    date: '2 AOÛT 2026',
    title: 'Aviculture : Réduire le taux de mortalité des poussins',
    excerpt: 'Guide pratique pour les 14 premiers jours critiques. Température, alimentation et protocoles de biosécurité indispensables.',
    imageUrl: '/images/cultiseil_iso.jpg',
  },
  {
    id: 3,
    category: 'BUSINESS PLAN',
    date: '27 JUIL 2026',
    title: 'Comment structurer votre plan de financement agricole',
    excerpt: 'Les erreurs à éviter face aux banques et comment présenter un prévisionnel financier solide avec le module Cultiplan.',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 4,
    category: 'AGRONOMIE',
    date: '24 JUIL 2026',
    title: 'Rotation des cultures : Améliorer la fertilité des sols',
    excerpt: 'Planifiez vos cycles sur 3 ans pour réduire l\'utilisation d\'engrais chimiques tout en augmentant vos rendements globaux.',
    imageUrl: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 5,
    category: 'TECHNOLOGIE',
    date: '23 JUIL 2026',
    title: 'Les drones agricoles : Gadget ou vrai outil de rentabilité ?',
    excerpt: 'Retour sur investissement de la cartographie par drone pour les exploitations de plus de 50 hectares.',
    imageUrl: 'https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 6,
    category: 'AGROALIMENTAIRE',
    date: '14 JUIL 2026',
    title: 'Transformation du manioc : De la racine à l\'export',
    excerpt: 'Étude de cas sur une unité de transformation d\'attiéké et de gari. Normes sanitaires et conditionnement.',
    imageUrl: '/images/cultishop_iso.jpg',
  },
];

const CATEGORIES = ['TOUT', 'AGRONOMIE', 'MARCHÉS', 'ÉLEVAGE', 'BUSINESS PLAN', 'AGROALIMENTAIRE'];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background pt-28 pb-0 font-sans">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        
        {/* En-tête de la page */}
        <div className="mb-16 mt-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground font-title mb-4">
            Insights pour l&apos;agrobusiness
          </h1>
          <p className="text-xl text-muted max-w-2xl">
            Guides pratiques, analyses de marché et conseils techniques pour structurer, financer et piloter vos projets agricoles en Afrique.
          </p>
        </div>

        {/* Featured Post */}
        <div className="flex flex-col md:flex-row gap-12 items-center mb-24 bg-sunken p-8 md:p-12 rounded-[2rem] border border-border">
          <div className="w-full md:w-5/12 flex flex-col items-start order-2 md:order-1">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-t-brand mb-6 uppercase">
              <span>{FEATURED_POST.category}</span>
              <span className="text-muted opacity-50">•</span>
              <span className="text-muted">{FEATURED_POST.date}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground font-title mb-4 leading-tight">
              {FEATURED_POST.title}
            </h2>
            <p className="text-lg text-muted mb-8 leading-relaxed">
              {FEATURED_POST.excerpt}
            </p>
            <Link 
              href={`/blog/${FEATURED_POST.id}`}
              className="group flex items-center text-t-brand font-bold text-sm tracking-wider uppercase"
            >
              LIRE LA SUITE 
              <span className="ml-2 group-hover:translate-x-2 transition-transform duration-300">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </Link>
          </div>
          <div className="w-full md:w-7/12 order-1 md:order-2">
            <div className="relative aspect-[4/3] md:aspect-[16/10] w-full rounded-2xl overflow-hidden shadow-sm">
              <Image 
                src={FEATURED_POST.imageUrl} 
                alt={FEATURED_POST.title}
                fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
          </div>
        </div>

        {/* Barre de filtres */}
        <div className="flex flex-wrap gap-3 mb-12">
          {CATEGORIES.map((category, index) => (
            <button
              key={category}
              type="button"
              className={`px-4 py-2 min-h-[44px] text-[11px] font-bold uppercase tracking-widest rounded-lg border transition-colors ${
                index === 0 
                  ? 'border-[var(--ork-use-border-selected)] text-t-brand bg-selected' 
                  : 'border-border text-muted hover:text-foreground hover:bg-sunken bg-surface'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Grille d'articles (3 colonnes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 mb-20">
          {POSTS.map((post) => (
            <Link href={`/blog/${post.id}`} key={post.id} className="group flex flex-col h-full cursor-pointer">
              <div className="relative aspect-[16/10] w-full rounded-[20px] overflow-hidden bg-sunken mb-5 border border-border">
                <Image 
                  src={post.imageUrl} 
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              
              <div className="flex flex-col flex-grow">
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-t-brand mb-3 uppercase">
                  <span>{post.category}</span>
                  <span className="text-muted opacity-50">•</span>
                  <span className="text-muted">{post.date}</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2 leading-snug group-hover:text-t-action transition-colors line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-[15px] text-muted leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Bouton Charger plus */}
        <div className="flex justify-center mb-32">
          <button type="button" className="px-6 py-2.5 min-h-[44px] border border-[var(--ork-use-border-selected)] text-t-brand text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-brand hover:text-on-brand transition-colors">
            Voir plus d&apos;articles
          </button>
        </div>

      </div>

      {/* Section CTA Blueprint */}
      <div className="relative border-t border-border bg-sunken overflow-hidden py-32">
        <div className="absolute inset-0 z-0 opacity-10" 
             style={{ 
               backgroundImage: 'linear-gradient(to right, var(--ork-use-border-bold) 1px, transparent 1px), linear-gradient(to bottom, var(--ork-use-border-bold) 1px, transparent 1px)', 
               backgroundSize: '48px 48px' 
             }}>
        </div>
        
        <div className="relative z-10 max-w-[800px] mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-foreground font-title mb-10 leading-tight">
            Rejoignez les agripreneurs qui s&apos;appuient sur Cultiso pour réussir.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/cultiplan" 
              className="w-full sm:w-auto px-8 py-3 min-h-[44px] inline-flex items-center justify-center bg-action text-on-action font-bold rounded-lg hover:bg-[var(--ork-use-background-action-bold-hover)] transition-colors text-center text-xs tracking-widest uppercase"
            >
              Créer mon business plan
            </Link>
            <Link 
              href="/register" 
              className="w-full sm:w-auto px-8 py-3 min-h-[44px] inline-flex items-center justify-center border border-[var(--ork-use-border-selected)] text-t-brand bg-surface font-bold rounded-lg hover:bg-selected transition-colors text-center uppercase text-xs tracking-widest"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
