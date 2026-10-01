import Link from 'next/link';
import TopNav from '@/components/layout/TopNav';
import PublicFooter from '@/components/layout/PublicFooter';
import { SITE } from '@/config/site';
import { IconWrench, IconSnow, IconShield, IconCheck, IconChevron } from '@/components/icons';

// Aba "Assistência": tela inicial pública
const ACTIONS = [
  { href: '/assistencia/instalacao', title: 'Organizar instalação', text: 'Conte quantos aparelhos e onde. Combinamos a data com você.', icon: IconSnow },
  { href: '/assistencia/manutencao', title: 'Manutenção de serviço', text: 'Seu ar não gela, pinga ou faz barulho? Peça uma visita.', icon: IconWrench },
  { href: '/consulta', title: 'Consultar garantia', text: 'Digite seu código de cliente e veja a garantia dos seus aparelhos.', icon: IconShield },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/50 blur-2xl" />
        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-12 md:pb-14 md:pt-20">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">{SITE.city}</span>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl">{SITE.headline}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">{SITE.subheadline}</p>
          <ul className="mt-6 grid max-w-xl grid-cols-2 gap-2 text-sm text-slate-600">
            {SITE.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2"><IconCheck className="h-4 w-4 text-brand-600" /> {h}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4" aria-label="O que você precisa?">
        <h2 className="text-xl font-bold text-slate-900">O que você precisa?</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {ACTIONS.map(({ href, title, text, icon: Icon }) => (
            <Link key={href} href={href} className="card group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-300 text-brand-900"><Icon className="h-6 w-6" /></span>
              <span className="text-lg font-semibold text-slate-900">{title}</span>
              <span className="flex-1 text-sm text-slate-500">{text}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-brand-700">Começar <IconChevron className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4">
        <h2 className="text-xl font-bold text-slate-900">Como funciona</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {SITE.steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-slate-50 p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-300 font-bold text-brand-900">{i + 1}</span>
              <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <PublicFooter />
    </div>
  );
}
