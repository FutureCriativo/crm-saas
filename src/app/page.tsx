import Link from 'next/link';
import Logo from '@/components/Logo';
import LeadForm from '@/components/LeadForm';
import { SITE, whatsappLink } from '@/config/site';
import { APP_NAME } from '@/lib/brand';
import {
  IconWrench, IconShield, IconSparkle, IconCalendar, IconChat, IconMail, IconCheck, IconUsers, IconLock,
} from '@/components/icons';

const serviceIcons = [IconWrench, IconCalendar, IconSparkle, IconShield];

export default function HomePage() {
  const wa = whatsappLink();

  return (
    <div className="bg-white">
      {/* Topo */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="sm:hidden"><Logo compact /></div>
          <div className="hidden sm:block"><Logo /></div>
          <nav className="flex items-center gap-2">
            <a href="#servicos" className="hidden px-3 py-2 text-sm text-slate-600 hover:text-slate-900 md:inline">Serviços</a>
            <a href="#orcamento" className="hidden px-3 py-2 text-sm text-slate-600 hover:text-slate-900 md:inline">Orçamento</a>
          </nav>
        </div>
      </header>

      {/* Destaque */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/50 blur-2xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              {SITE.businessName} · {SITE.city}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl">{SITE.headline}</h1>
            <p className="mt-5 text-lg text-slate-600">{SITE.subheadline}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#orcamento" className="btn-primary px-6 py-3 text-base">Pedir orçamento grátis</a>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost border border-slate-200 px-6 py-3 text-base">
                  <IconChat className="h-5 w-5" /> Chamar no WhatsApp
                </a>
              ) : (
                <a href={`mailto:${SITE.email}`} className="btn-ghost border border-slate-200 px-6 py-3 text-base">
                  <IconMail className="h-5 w-5" /> Enviar e-mail
                </a>
              )}
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-2 text-sm text-slate-600">
              {SITE.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2"><IconCheck className="h-4 w-4 text-brand-600" /> {h}</li>
              ))}
            </ul>
          </div>

          {/* Prévia do painel */}
          <div className="card hidden p-5 shadow-xl md:block">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">Painel da empresa</p>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800">{APP_NAME}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[['128', 'Clientes'], ['96', 'Em garantia'], ['7', 'Vencem em 30d']].map(([n, l]) => (
                <div key={l} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-2xl font-bold text-slate-900">{n}</p>
                  <p className="text-xs text-slate-500">{l}</p>
                </div>
              ))}
            </div>
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {[['2026-0128', 'Split 12.000 BTU', 'Ativa'], ['2026-0127', 'Higienização', 'Ativa'], ['2025-0981', 'Split 9.000 BTU', 'Vencendo']].map(([os, eq, st]) => (
                <li key={os} className="flex items-center justify-between py-2.5">
                  <span><b className="font-mono text-brand-800">{os}</b> · {eq}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st === 'Ativa' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{st}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Serviços</h2>
        <p className="mt-2 text-slate-500">Tudo o que o seu ar-condicionado precisa, do início ao fim.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SITE.services.map((s, i) => {
            const Icon = serviceIcons[i % serviceIcons.length];
            return (
              <div key={s.title} className="card p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Orçamento - DESTAQUE */}
      <section id="orcamento" className="scroll-mt-20 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900">Peça seu orçamento</h2>
            <p className="mt-4 text-lg text-slate-600">Responda em menos de 1 minuto. Retornamos pelo telefone ou WhatsApp.</p>
            <div className="mt-8 space-y-3 text-base">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-700 hover:text-brand-700 font-semibold">
                  <IconChat className="h-5 w-5 text-brand-600" /> WhatsApp - Resposta rápida
                </a>
              )}
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 text-slate-700 hover:text-brand-700">
                <IconMail className="h-5 w-5 text-brand-600" /> {SITE.email}
              </a>
            </div>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* Como funciona */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Como funciona</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {SITE.steps.map((s, i) => (
              <li key={s.title} className="card p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-300 font-bold text-brand-900">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Acesso - Área do cliente e gestor */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-center text-sm text-slate-500 mb-6">Já é cliente ou gestor?</p>
          <div className="grid gap-3 md:grid-cols-2 md:max-w-md md:mx-auto">
            <Link href="/login?perfil=cliente" className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <IconShield className="h-4 w-4" /> Área do cliente
            </Link>
            <Link href="/login?perfil=gestor" className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition">
              <IconUsers className="h-4 w-4" /> Área do gestor
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 md:flex-row">
          <Logo />
          <p className="flex items-center gap-2"><IconLock className="h-4 w-4" /> Dados protegidos · © {new Date().getFullYear()} {SITE.businessName}</p>
        </div>
      </footer>
    </div>
  );
}
