'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  Film, Users, Package, MapPin, FileText, ClipboardList,
  CheckSquare, Layers, BarChart3, Shield, Zap, Globe,
  ArrowRight, Star, ChevronRight, Camera, Mic, Lightbulb,
  ClipboardCheck, IdCard, BookImage,
} from 'lucide-react';

const FEATURES = [
  { icon: Film, title: 'Productions', desc: 'Manage every production from brief to wrap. Track status, schedule, crew, and locations in one place.', color: 'bg-purple-50 text-purple-600' },
  { icon: FileText, title: 'Documents & PDFs', desc: 'Generate professional call sheets, NDAs, crew deals, shot lists, and location releases — pre-filled instantly.', color: 'bg-blue-50 text-blue-600' },
  { icon: Users, title: 'Crew & Cast', desc: 'Full crew profiles with departments, rates, availability, ID cards with QR codes, and deal memo signing.', color: 'bg-green-50 text-green-600' },
  { icon: Package, title: 'Equipment Inventory', desc: 'Catalog every piece of gear with check-out/return forms, maintenance logs, and retirement reports.', color: 'bg-orange-50 text-orange-600' },
  { icon: BookImage, title: 'Stripboard', desc: 'Professional scene scheduling with drag-and-drop strips, color coding, and instant PDF export.', color: 'bg-red-50 text-red-600' },
  { icon: Layers, title: 'Storyboard Creator', desc: 'Draw storyboard panels directly in the browser with pen, pencil, and marker tools. Reorder with drag & drop.', color: 'bg-indigo-50 text-indigo-600' },
  { icon: MapPin, title: 'Location Blueprint', desc: 'Design your set layout on an interactive canvas. Place equipment, crew marks, lighting, and props.', color: 'bg-teal-50 text-teal-600' },
  { icon: CheckSquare, title: 'Equipment Checklists', desc: '9 pre-built checklists (camera, audio, lighting…) plus custom lists. Track readiness % per production.', color: 'bg-yellow-50 text-yellow-600' },
  { icon: IdCard, title: 'ID Cards', desc: 'Generate color-coded crew ID cards with QR codes. Print on Avery sheets for every department.', color: 'bg-pink-50 text-pink-600' },
  { icon: ClipboardCheck, title: 'Equipment Forms', desc: 'Digital check-out, return inspection, maintenance, and asset retirement forms with mobile signatures.', color: 'bg-cyan-50 text-cyan-600' },
  { icon: BarChart3, title: 'Gantt & Scheduling', desc: 'Visual Gantt chart for your entire production timeline. See every task across all productions at once.', color: 'bg-emerald-50 text-emerald-600' },
  { icon: ClipboardList, title: 'Shoot Log', desc: 'On-set take journal: log scene, shot, take, lens, aperture, ISO, shutter, sound roll — in real time.', color: 'bg-violet-50 text-violet-600' },
];

const PLANS = [
  {
    name: 'Free', price: '$0', period: 'forever',
    features: ['1 active production', 'Up to 5 crew members', 'Up to 10 inventory items', 'Basic call sheet PDF', 'Community support'],
    cta: 'Get started free', highlight: false,
  },
  {
    name: 'Pro', price: '$29', period: '/month',
    features: ['Unlimited productions', 'Unlimited crew & inventory', 'All PDF documents', 'Storyboard + Blueprint', 'Equipment database', 'Priority support'],
    cta: 'Start Pro trial', highlight: true, badge: 'Most Popular',
  },
  {
    name: 'Studio', price: '$79', period: '/month',
    features: ['Everything in Pro', 'Team workspaces', 'Multi-user access', 'Custom branding', 'Dedicated support', 'API access'],
    cta: 'Contact sales', highlight: false,
  },
];

const TESTIMONIALS = [
  { name: 'Marco T.', role: 'Director of Photography', quote: 'PRO-LOGIC replaced three separate tools. Call sheets, inventory tracking, and crew management all in one. Game changer on set.' },
  { name: 'Sara L.', role: 'Line Producer', quote: 'The equipment check-out forms with mobile signatures saved us so much paperwork. Our gear is finally accountable.' },
  { name: 'James R.', role: 'Production Coordinator', quote: 'The checklists and shoot readiness dashboard on the main screen lets me know exactly where we stand every morning.' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading || user) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)' }}>

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <img src="/logo-white.svg" alt="PRO-LOGIC" className="h-8 object-contain" />
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth" className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5">Sign in</Link>
            <Link href="/auth"
              className="bg-white text-zinc-950 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-zinc-100 transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs text-zinc-300 mb-8">
            <Zap size={12} className="text-yellow-400" />
            Built for film & video production teams
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tight mb-6">
            Every production tool
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
              in one platform.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            PRO-LOGIC Studio is the all-in-one production management platform for video and film professionals.
            Manage crew, gear, documents, scheduling, and on-set operations from any device.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth"
              className="inline-flex items-center justify-center gap-2 bg-white text-zinc-950 font-bold text-base px-8 py-4 rounded-2xl hover:bg-zinc-100 transition-all hover:scale-105">
              Start for free <ArrowRight size={18} />
            </Link>
            <a href="#features"
              className="inline-flex items-center justify-center gap-2 border border-white/20 text-zinc-300 font-medium text-base px-8 py-4 rounded-2xl hover:bg-white/5 transition-colors">
              Explore features <ChevronRight size={18} />
            </a>
          </div>

          <p className="text-xs text-zinc-600 mt-6">No credit card required · Free plan forever · Cancel anytime</p>
        </div>

        {/* Feature strip */}
        <div className="max-w-5xl mx-auto mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Film, label: 'Productions' },
            { icon: Users, label: 'Crew & Cast' },
            { icon: Package, label: 'Equipment' },
            { icon: FileText, label: 'PDF Documents' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl py-4 px-3">
              <Icon size={18} className="text-zinc-400 shrink-0" />
              <span className="text-sm text-zinc-300 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────── */}
      <section className="border-y border-white/10 py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '12+', label: 'Production tools' },
            { value: '9', label: 'Checklist categories' },
            { value: '7', label: 'PDF document types' },
            { value: '∞', label: 'Productions on Studio plan' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-4xl font-black text-white mb-1">{value}</div>
              <div className="text-sm text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">
              Everything you need,<br />
              <span className="text-zinc-400">nothing you don't.</span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              From pre-production planning to post-wrap reports, every workflow is covered.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title}
                className="bg-zinc-900 border border-white/5 rounded-2xl p-5 hover:border-white/20 hover:bg-zinc-800/60 transition-all group">
                <div className={`inline-flex p-2.5 rounded-xl mb-4 ${color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed group-hover:text-zinc-400 transition-colors">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">From setup to shoot day in minutes</h2>
            <p className="text-zinc-400">Get your entire production organized in three steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create your production', desc: 'Add project details, assign crew, link locations, and attach your equipment inventory.' },
              { step: '02', title: 'Generate all documents', desc: 'One click produces call sheets, NDAs, deal memos, shot lists — pre-filled with your data.' },
              { step: '03', title: 'Manage on-set', desc: 'Log takes in real time, check out gear with signatures, track checklist readiness live.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative">
                <div className="text-7xl font-black text-white/5 mb-2 leading-none">{step}</div>
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────── */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Trusted by production teams</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, quote }) => (
              <div key={name} className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-5">"{quote}"</p>
                <div>
                  <div className="font-semibold text-white text-sm">{name}</div>
                  <div className="text-zinc-500 text-xs">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Simple, transparent pricing</h2>
            <p className="text-zinc-400">Start free. Scale as your studio grows.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(({ name, price, period, features, cta, highlight, badge }) => (
              <div key={name} className={`rounded-2xl p-7 flex flex-col ${highlight ? 'bg-white text-zinc-950 shadow-2xl scale-105' : 'bg-zinc-900 border border-white/10'}`}>
                {badge && (
                  <div className="inline-flex items-center bg-black text-white text-xs font-bold px-3 py-1 rounded-full mb-4 w-fit">{badge}</div>
                )}
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-60">{name}</div>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-black">{price}</span>
                  <span className={`text-sm mb-1.5 ${highlight ? 'text-zinc-500' : 'text-zinc-500'}`}>{period}</span>
                </div>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 shrink-0 ${highlight ? 'text-green-600' : 'text-zinc-500'}`}>✓</span>
                      <span className={highlight ? 'text-zinc-700' : 'text-zinc-400'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/auth"
                  className={`text-center py-3 rounded-xl text-sm font-bold transition-colors ${highlight ? 'bg-black text-white hover:bg-zinc-800' : 'border border-white/20 text-white hover:bg-white/5'}`}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-6">
            Your next production,<br />fully organized.
          </h2>
          <p className="text-zinc-400 text-lg mb-10">
            Join production teams that run tighter sets with PRO-LOGIC Studio.
          </p>
          <Link href="/auth"
            className="inline-flex items-center gap-2 bg-white text-zinc-950 font-bold text-lg px-10 py-5 rounded-2xl hover:bg-zinc-100 transition-all hover:scale-105">
            Get started for free <ArrowRight size={20} />
          </Link>
          <p className="text-xs text-zinc-600 mt-5">No credit card · Free forever plan · Upgrade when ready</p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo-white.svg" alt="PRO-LOGIC" className="h-7 object-contain" />
            <span className="text-zinc-600 text-xs">© {new Date().getFullYear()} PRO-LOGIC Studio. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-600">
            <a href="#features" className="hover:text-zinc-300 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
            <Link href="/auth" className="hover:text-zinc-300 transition-colors">Sign in</Link>
            <div className="flex items-center gap-1">
              <Globe size={12} />
              <span>pro-logic.studio</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
