'use client';
import { useState } from 'react';
import Link from 'next/link';
import TopNav from '@/components/layout/TopNav';
import PublicFooter from '@/components/layout/PublicFooter';
import PushToggle from '@/components/features/PushToggle';
import { WarrantyBadge, ErrorBox } from '@/components/ui';
import { IconChat, IconShield } from '@/components/icons';
import { useSettings } from '@/hooks/useSettings';
import { lookupWarranty } from '@/services/warranty';
import { friendlyError } from '@/lib/errors';
import { applianceLabel, formatDate, warrantyStatus } from '@/lib/format';
import { waLink } from '@/lib/whatsapp';
import type { WarrantyItem } from '@/types';

// Cliente digita o código e vê só aparelho + datas (nunca nome, telefone ou endereço)
export default function ConsultaPage() {
  const { settings } = useSettings();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; items: WarrantyItem[] } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    setError(''); setResult(null); setNotFound(false);
    if (!/^[A-Z0-9]{6}$/.test(c)) return setError('O código tem 6 letras e números. Confira e tente de novo.');
    setLoading(true);
    try {
      const r = await lookupWarranty(c);
      if (r.found) setResult({ code: c, items: r.items }); else setNotFound(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const wa = settings?.whatsapp || null;
  const support = (i?: WarrantyItem) =>
    waLink(wa, i
      ? `Olá! Meu código de cliente é ${result?.code}. Preciso de suporte no aparelho ${applianceLabel(i)} (OS ${i.os}).`
      : `Olá! Meu código de cliente é ${result?.code}. Gostaria de falar sobre meus aparelhos.`);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-2xl px-4 pt-8">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Voltar</Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Consultar garantia</h1>
        <p className="mb-6 mt-2 text-slate-500">Digite o código de cliente que enviamos para você (6 letras e números).</p>

        <form onSubmit={search} className="card flex flex-col gap-3 p-5 sm:flex-row" noValidate>
          <input className="input flex-1 text-center font-mono text-lg uppercase tracking-[0.3em]" value={code} maxLength={6} autoCapitalize="characters" autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="K7M2QA" aria-label="Código de cliente" />
          <button className="btn-primary sm:w-40" disabled={loading}>{loading ? 'Buscando...' : 'Consultar'}</button>
        </form>
        <div className="mt-3"><ErrorBox text={error} /></div>

        {notFound && (
          <div className="card mt-4 p-5" data-testid="not-found">
            <p className="font-semibold text-slate-900">Código não encontrado</p>
            <p className="mt-1 text-sm text-slate-500">Confira as letras e números. Se o problema continuar, fale com a gente.</p>
            {waLink(wa, 'Olá! Não consegui consultar minha garantia com o código de cliente.') && (
              <a href={waLink(wa, 'Olá! Não consegui consultar minha garantia com o código de cliente.')} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3 border border-slate-200"><IconChat className="h-5 w-5" /> Falar no WhatsApp</a>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4" data-testid="warranty-result">
            {result.items.length === 0 ? (
              <div className="card p-5"><p className="font-semibold text-slate-900">Código válido</p>
                <p className="mt-1 text-sm text-slate-500">Ainda não há instalação concluída registrada para este código.</p></div>
            ) : (
              <ul className="space-y-3">
                {result.items.map((i, idx) => {
                  const s = warrantyStatus(i.warranty_expires_at);
                  return (
                    <li key={`${i.os}-${idx}`} className="card p-5" data-testid="warranty-item">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-xs font-semibold text-brand-800">OS {i.os}</span>
                        <WarrantyBadge status={s} />
                      </div>
                      <p className="mt-3 flex items-center gap-2 font-semibold text-slate-900"><IconShield className="h-5 w-5 text-brand-600" /> {applianceLabel(i)}</p>
                      <p className="mt-1 text-sm text-slate-500">Instalado em {formatDate(i.installed_on)} · {i.warranty_expires_at ? `Garantia até ${formatDate(i.warranty_expires_at)}` : 'Sem garantia registrada'}</p>
                      {support(i) && <a href={support(i)} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3 border border-slate-200 text-sm"><IconChat className="h-4 w-4" /> Pedir suporte deste aparelho</a>}
                    </li>
                  );
                })}
              </ul>
            )}
            {support() && <a href={support()} target="_blank" rel="noopener noreferrer" className="btn-primary w-full bg-emerald-500 text-white hover:bg-emerald-600"><IconChat className="h-5 w-5" /> Falar com a empresa no WhatsApp</a>}
            <PushToggle code={result.code} />
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
