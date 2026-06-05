'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  Film, Users, Package, MapPin, FileText, ClipboardList,
  CheckSquare, Layers, BarChart3, Zap, Globe,
  ArrowRight, Star, ChevronRight,
  ClipboardCheck, IdCard, BookImage, Loader2, CreditCard,
} from 'lucide-react';

const FEATURES = [
  { icon: Film,          title: 'Productions',       desc: 'Manage every production from brief to wrap. Track status, schedule, crew, and locations in one place.',          color: 'bg-purple-500/10 text-purple-400' },
  { icon: FileText,      title: 'Documents & PDFs',  desc: 'Generate call sheets, NDAs, crew deals, shot lists, and location releases — pre-filled with your production data.', color: 'bg-blue-500/10 text-blue-400' },
  { icon: Users,         title: 'Crew & Cast',       desc: 'Full profiles, departments, rates, availability, ID cards with QR codes, and digital deal memos.',                 color: 'bg-green-500/10 text-green-400' },
  { icon: Package,       title: 'Equipment Inventory', desc: 'Catalog every piece of gear. Check-out, return inspection, maintenance logs, and asset retirement forms.',      color: 'bg-orange-500/10 text-orange-400' },
  { icon: BookImage,     title: 'Stripboard',        desc: 'Drag-and-drop scene scheduling with color-coded strips, scene breakdowns, and instant PDF export.',                color: 'bg-red-500/10 text-red-400' },
  { icon: Layers,        title: 'Storyboard',        desc: 'Draw panel-by-panel directly in the browser. Pen, pencil, and marker tools. Reorder with drag & drop.',            color: 'bg-indigo-500/10 text-indigo-400' },
  { icon: MapPin,        title: 'Location Blueprint', desc: 'Design your set layout on a canvas. Place equipment, crew marks, lighting, and props from your inventory.',      color: 'bg-teal-500/10 text-teal-400' },
  { icon: CheckSquare,   title: 'Checklists',        desc: '9 pre-built checklists plus custom lists. Track shoot readiness % per production — live on the dashboard.',       color: 'bg-yellow-500/10 text-yellow-400' },
  { icon: IdCard,        title: 'ID Cards',          desc: 'Color-coded crew ID cards with QR codes. Print on Avery sheets — one click for every department.',                 color: 'bg-pink-500/10 text-pink-400' },
  { icon: ClipboardCheck, title: 'Equipment Forms',  desc: 'Digital check-out, return inspection, maintenance, and retirement forms with mobile finger signatures.',           color: 'bg-cyan-500/10 text-cyan-400' },
  { icon: BarChart3,     title: 'Gantt Chart',       desc: 'Visual timeline across your entire production schedule. See every task, dependency, and deadline at once.',        color: 'bg-emerald-500/10 text-emerald-400' },
  { icon: ClipboardList, title: 'Shoot Log',         desc: 'On-set take journal: scene, shot, lens, aperture, ISO, shutter speed, sound roll — all logged in real time.',     color: 'bg-violet-500/10 text-violet-400' },
];

const PLANS = [
  {
    name: 'Free', price: '$0', period: 'forever', planKey: null,
    features: ['1 active production', 'Up to 5 crew members', 'Up to 10 inventory items', 'Basic call sheet PDF', 'Community support'],
    cta: 'Get started free', highlight: false,
  },
  {
    name: 'Pro', price: '$29', period: '/month', planKey: 'pro',
    features: ['Unlimited productions', 'Unlimited crew & inventory', 'All PDF documents', 'Storyboard + Blueprint', 'Equipment forms & ID cards', 'Priority support'],
    cta: 'Subscribe — $29/mo', highlight: true, badge: 'Most Popular',
  },
  {
    name: 'Studio', price: '$79', period: '/month', planKey: 'studio',
    features: ['Everything in Pro', 'Team workspaces & multi-user', 'Custom branding', 'API access', 'Dedicated support'],
    cta: 'Subscribe — $79/mo', highlight: false,
  },
];

const TESTIMONIALS = [
  { name: 'Marco T.', role: 'Director of Photography', quote: 'PRO-LOGIC replaced three separate tools. Call sheets, inventory tracking, and crew management all in one. Game changer on set.' },
  { name: 'Sara L.', role: 'Line Producer', quote: 'The equipment check-out forms with mobile signatures saved us so much paperwork. Our gear is finally fully accountable.' },
  { name: 'James R.', role: 'Production Coordinator', quote: 'The shoot readiness dashboard tells me exactly where we stand every morning — before I even get to set.' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  const handleSubscribe = async (planKey: string) => {
    setCheckingOut(planKey);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planKey,
          uid: user?.uid || '',
          email: user?.email || '',
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Could not start checkout. Please try again.');
      }
    } catch (e: any) {
      alert(e?.message || 'Could not start checkout. Please try again.');
    } finally {
      setCheckingOut(null);
    }
  };

  if (loading || user) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden" style={{ fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)' }}>

      {/* ── NAV ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <img src="/logo-white.svg" alt="PRO-LOGIC" className="h-8 object-contain" />
          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
            <a href="#reviews"  className="hover:text-white transition-colors">Reviews</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth" className="text-sm text-zinc-400 hover:text-white transition-colors px-2 sm:px-3 py-1.5 hidden sm:block">
              Sign in
            </Link>
            <Link href="/auth" className="bg-white text-zinc-950 text-xs sm:text-sm font-bold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl hover:bg-zinc-100 transition-colors whitespace-nowrap">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO — full-screen bg image ───────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-end">
        {/* Background photo */}
        <div className="absolute inset-0">
          <img
            src="/img-hero.jpg"
            alt=""
            className="w-full h-full object-cover object-center"
          />
          {/* Multi-layer overlay for legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/30 to-zinc-950/90" />
          <div className="absolute inset-0 bg-zinc-950/20" />
        </div>

        {/* Hero content — pinned to bottom of viewport */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-20 pt-32">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-zinc-300 mb-6">
            <Zap size={12} className="text-yellow-400" />
            Built for film & video production teams
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-none tracking-tight mb-6 max-w-4xl">
            Every production tool
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
              {' '}in one platform.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-300 max-w-2xl mb-10 leading-relaxed">
            PRO-LOGIC Studio is the all-in-one production management platform for video and film professionals.
            Manage crew, gear, documents, scheduling, and on-set operations — from any device.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/auth"
              className="inline-flex items-center justify-center gap-2 bg-white text-zinc-950 font-bold text-base sm:text-lg px-8 py-4 sm:py-5 rounded-2xl hover:bg-zinc-100 transition-all hover:scale-[1.02] shadow-2xl">
              Start for free <ArrowRight size={20} />
            </Link>
            <a href="#features"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-medium text-base sm:text-lg px-8 py-4 sm:py-5 rounded-2xl hover:bg-white/10 transition-colors backdrop-blur-sm">
              Explore features <ChevronRight size={20} />
            </a>
          </div>
          <p className="text-xs text-zinc-500 mt-5">No credit card required · Free plan forever · Cancel anytime</p>
        </div>
      </section>

      {/* ── STAT STRIP ───────────────────────────────────────── */}
      <section className="border-y border-white/10 py-10 sm:py-14 px-4 bg-zinc-900/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 text-center">
          {[
            { value: '12+', label: 'Production tools' },
            { value: '9',   label: 'Checklist categories' },
            { value: '7',   label: 'PDF document types' },
            { value: '∞',   label: 'Productions on Studio plan' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl sm:text-5xl font-black text-white mb-1">{value}</div>
              <div className="text-xs sm:text-sm text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FULL-WIDTH CREW PHOTO + TAGLINE ──────────────────── */}
      <section className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] overflow-hidden">
        <img
          src="/img-studio-crew.jpg"
          alt="Film production crew on set"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/40 to-zinc-950/10" />
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 lg:px-24">
          <div className="max-w-xl">
            <p className="text-xs sm:text-sm text-zinc-400 uppercase tracking-widest mb-3 font-semibold">Built for the set</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight text-white mb-4">
              Every department.<br />One system.
            </h2>
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
              From camera package to transportation, grip to catering —
              every crew member and every piece of gear tracked in real time.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">
              Everything you need,<br />
              <span className="text-zinc-500">nothing you don't.</span>
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">
              From pre-production planning to post-wrap reports — every workflow in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title}
                className="bg-zinc-900 border border-white/5 rounded-2xl p-5 hover:border-white/20 hover:bg-zinc-800/60 transition-all group cursor-default">
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

      {/* ── SPLIT: CAMERA + SLATE ────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="flex flex-col lg:flex-row min-h-[60vh]">
          {/* Image left */}
          <div className="relative w-full lg:w-1/2 h-64 sm:h-80 lg:h-auto">
            <img
              src="/img-camera-slate.jpg"
              alt="Hollywood production camera and clapperboard"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-zinc-950/80 hidden lg:block" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950/80 lg:hidden" />
          </div>
          {/* Text right */}
          <div className="w-full lg:w-1/2 bg-zinc-950 flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-14 lg:py-20">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-semibold">Documents</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-6">
              Professional PDFs,<br />generated in seconds.
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-8">
              Call sheets, NDAs, crew deal memos, shot lists, location releases, stripboards,
              and character breakdowns — all pre-filled with your production data.
              One click. Print-ready.
            </p>
            <Link href="/auth"
              className="inline-flex items-center gap-2 bg-white text-zinc-950 font-bold px-6 py-3 rounded-xl hover:bg-zinc-100 transition-colors w-fit text-sm">
              Try it free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SPLIT: FILM STUDIO (reversed) ────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="flex flex-col-reverse lg:flex-row min-h-[60vh]">
          {/* Text left */}
          <div className="w-full lg:w-1/2 bg-zinc-900 flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-14 lg:py-20">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3 font-semibold">Equipment</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight mb-6">
              Every piece of gear.<br />Fully accountable.
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-8">
              Digital check-out forms with mobile signatures. Return inspections with
              damage assessment. Maintenance logs. Asset retirement reports. Your
              entire equipment lifecycle — paperless, on any device.
            </p>
            <Link href="/auth"
              className="inline-flex items-center gap-2 border border-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors w-fit text-sm">
              Explore equipment tools <ArrowRight size={16} />
            </Link>
          </div>
          {/* Image right */}
          <div className="relative w-full lg:w-1/2 h-64 sm:h-80 lg:h-auto">
            <img
              src="/img-film-studio.jpg"
              alt="Film studio with camera and lighting"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-zinc-900/80 hidden lg:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-zinc-900/60 lg:hidden" />
          </div>
        </div>
      </section>

      {/* ── LIGHTING RIG — full width atmospheric ────────────── */}
      <section className="relative h-[40vh] sm:h-[50vh] md:h-[55vh] overflow-hidden">
        <img
          src="/img-lighting-rig.jpg"
          alt="Stage lighting rigging technicians"
          className="w-full h-full object-cover object-[center_60%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-zinc-950/20" />
        <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-12 lg:px-24 pb-10 sm:pb-16">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-zinc-400 text-sm sm:text-base md:text-lg leading-relaxed">
              "From the production office to the set floor — PRO-LOGIC keeps every department
              connected, every piece of gear tracked, every call sheet ready."
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-zinc-900/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">
              From setup to shoot day<br />
              <span className="text-zinc-500">in minutes.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {[
              { step: '01', title: 'Create your production', desc: 'Add project details, assign crew, link locations, and attach your equipment inventory. Everything in one place from day one.' },
              { step: '02', title: 'Generate all documents', desc: 'One click produces call sheets, NDAs, deal memos, shot lists — all pre-filled with your production data. No manual entry.' },
              { step: '03', title: 'Manage on-set', desc: 'Log takes in real time, check out gear with digital signatures, track checklist readiness live, and stay in control from any device.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative pl-4 border-l border-white/10">
                <div className="text-6xl sm:text-7xl font-black text-white/5 mb-2 leading-none">{step}</div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section id="reviews" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Clapper image header */}
          <div className="relative h-48 sm:h-64 rounded-3xl overflow-hidden mb-14">
            <img
              src="/img-clapper.jpg"
              alt="Film production clapperboard"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2 font-semibold">Testimonials</p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black">Trusted by production teams</h2>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {TESTIMONIALS.map(({ name, role, quote }) => (
              <div key={name} className="bg-zinc-900 border border-white/10 rounded-2xl p-6 sm:p-7 flex flex-col">
                <div className="flex gap-0.5 mb-5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <p className="text-zinc-300 text-sm sm:text-base leading-relaxed flex-1 mb-6">"{quote}"</p>
                <div>
                  <div className="font-bold text-white text-sm">{name}</div>
                  <div className="text-zinc-500 text-xs mt-0.5">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">Simple, transparent pricing</h2>
            <p className="text-zinc-400 text-base sm:text-lg">Start free. Scale as your studio grows.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-start md:items-center">
            {PLANS.map(({ name, price, period, features, cta, highlight, badge, planKey }) => (
              <div key={name}
                className={`rounded-2xl p-7 sm:p-8 flex flex-col transition-all ${highlight ? 'bg-white text-zinc-950 shadow-[0_0_60px_rgba(255,255,255,0.15)] md:scale-105' : 'bg-zinc-900 border border-white/10'}`}>
                {badge && (
                  <div className="inline-flex items-center bg-black text-white text-xs font-bold px-3 py-1 rounded-full mb-4 w-fit">{badge}</div>
                )}
                <div className="mb-1 text-xs font-bold uppercase tracking-widest opacity-50">{name}</div>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl sm:text-5xl font-black">{price}</span>
                  <span className="text-sm mb-2 text-zinc-500">{period}</span>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className={`mt-0.5 shrink-0 font-bold ${highlight ? 'text-green-600' : 'text-zinc-600'}`}>✓</span>
                      <span className={highlight ? 'text-zinc-700' : 'text-zinc-400'}>{f}</span>
                    </li>
                  ))}
                </ul>

                {planKey ? (
                  <button
                    onClick={() => handleSubscribe(planKey)}
                    disabled={checkingOut !== null}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${highlight ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'border border-white/15 text-white hover:bg-white/10 hover:border-white/30'}`}>
                    {checkingOut === planKey
                      ? <><Loader2 size={15} className="animate-spin" /> Redirecting…</>
                      : <><CreditCard size={15} /> {cta}</>}
                  </button>
                ) : (
                  <Link href="/auth"
                    className={`text-center py-3.5 rounded-xl text-sm font-bold transition-all border border-white/15 text-white hover:bg-white/10 hover:border-white/30`}>
                    {cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONCERT CTA — full screen image (user-requested bottom) */}
      <section className="relative min-h-[70vh] sm:min-h-[80vh] flex flex-col justify-end overflow-hidden">
        <img
          src="/img-concert.jpg"
          alt="Sound engineer at live concert"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Rich gradient from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/10" />
        <div className="absolute inset-0 bg-zinc-950/20" />

        <div className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 text-center">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4 font-semibold">Get started today</p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
            Your next production,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
              fully organized.
            </span>
          </h2>
          <p className="text-zinc-300 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Join production teams that run tighter sets, ship faster deliverables,
            and never lose track of a single piece of gear.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth"
              className="inline-flex items-center justify-center gap-2 bg-white text-zinc-950 font-black text-base sm:text-lg px-10 py-5 rounded-2xl hover:bg-zinc-100 transition-all hover:scale-[1.03] shadow-2xl">
              Start for free — it's on us <ArrowRight size={20} />
            </Link>
          </div>
          <p className="text-xs text-zinc-600 mt-6">No credit card · Free forever plan · Upgrade when ready</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8 bg-zinc-950">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3 sm:gap-5">
            <img src="/logo-white.svg" alt="PRO-LOGIC" className="h-7 object-contain" />
            <span className="text-zinc-600 text-xs text-center sm:text-left">
              © {new Date().getFullYear()} PRO-LOGIC Studio. All rights reserved.
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-zinc-600">
            <a href="#features"  className="hover:text-zinc-300 transition-colors">Features</a>
            <a href="#pricing"   className="hover:text-zinc-300 transition-colors">Pricing</a>
            <a href="#reviews"   className="hover:text-zinc-300 transition-colors">Reviews</a>
            <Link href="/auth"   className="hover:text-zinc-300 transition-colors">Sign in</Link>
            <div className="flex items-center gap-1.5">
              <Globe size={12} />
              <span>pro-logic.studio</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
