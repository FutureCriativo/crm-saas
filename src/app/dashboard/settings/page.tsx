'use client';
import { useEffect, useRef, useState } from 'react';
import { PageHeader, Loading, Field, ErrorBox, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { useSettings } from '@/hooks/useSettings';
import { addModel, deleteModel, getSettings, listModels, setModelActive, updateSettings } from '@/services/settings';
import { friendlyError } from '@/lib/errors';
import { fileToLogoDataUrl } from '@/lib/image';
import { formatPhone } from '@/lib/format';
import { getProfile } from '@/lib/profile';
import { IconTrash } from '@/components/icons';

// WhatsApp salvo com DDI (5515999999999). O gestor digita só DDD + número.
const toStored = (v: string) => { const d = v.replace(/\D/g, ''); return d.length === 10 || d.length === 11 ? `55${d}` : d; };

export default function SettingsPage() {
  const { toast } = useToast();
  const { refresh } = useSettings();
  const { data: s, loading, error, reload } = useAsync(() => getSettings(), []);
  const { data: models, reload: reloadModels } = useAsync(() => listModels(), []);
  const [f, setF] = useState({ business_name: '', whatsapp: '', warranty: '12' });
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [newModel, setNewModel] = useState({ brand: '', line: '' });
  const [modelError, setModelError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!s) return;
    setF({ business_name: s.business_name || '', whatsapp: s.whatsapp ? formatPhone(s.whatsapp) : '', warranty: String(s.warranty_months_default) });
    setLogo(s.logo_data_url);
  }, [s]);

  if (loading) return <Loading />;
  if (!s) return <ErrorBox text={error || 'Configurações não encontradas.'} />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const wa = toStored(f.whatsapp);
    if (f.whatsapp && !/^[0-9]{12,13}$/.test(wa)) return setFormError('WhatsApp inválido. Use DDD + número, ex.: (15) 99696-6519');
    const months = Number(f.warranty);
    if (!Number.isInteger(months) || months < 0 || months > 120) return setFormError('Garantia padrão: entre 0 e 120 meses.');
    setSaving(true);
    try {
      await updateSettings(s.company_id, { business_name: f.business_name.trim(), whatsapp: wa || null, logo_data_url: logo, warranty_months_default: months });
      await refresh();
      toast('Configurações salvas.');
      reload();
    } catch (err) { setFormError(friendlyError(err)); } finally { setSaving(false); }
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setLogo(await fileToLogoDataUrl(file)); setFormError(''); } catch (err: any) { setFormError(err.message || 'Não foi possível usar esta imagem.'); }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setModelError('');
    if (newModel.brand.trim().length < 2 || newModel.line.trim().length < 2) return setModelError('Informe marca e linha/modelo.');
    try {
      const p = await getProfile();
      if (!p) throw new Error('Sessão expirada.');
      await addModel(p.company_id, newModel.brand, newModel.line, (models?.length || 0) + 1);
      setNewModel({ brand: '', line: '' });
      reloadModels();
    } catch (err) { setModelError(friendlyError(err)); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Configurações" subtitle="Dados da empresa e catálogo de aparelhos" />

      <form onSubmit={save} className="card space-y-5 p-5 md:p-7" aria-label="Dados da empresa">
        <h2 className="font-semibold text-slate-900">Empresa</h2>
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="Logo" className="h-full w-full object-contain" data-testid="logo-preview" /> : <span className="text-xs text-slate-400">Sem logo</span>}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogo} aria-label="Enviar logo" data-testid="logo-input" />
            <button type="button" className="btn-ghost border border-slate-200 text-sm" onClick={() => fileRef.current?.click()}>{logo ? 'Trocar logo' : 'Enviar logo'}</button>
            {logo && <button type="button" className="btn-ghost text-sm text-rose-600" onClick={() => setLogo(null)}>Remover</button>}
            <p className="text-xs text-slate-400">PNG, JPG ou WebP. Ajustamos o tamanho sozinhos.</p>
          </div>
        </div>
        <Field label="Nome da empresa"><input className="input" value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} maxLength={80} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="WhatsApp que recebe os pedidos" hint="DDD + número. É para cá que o cliente é levado."><input className="input" inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="(15) 99696-6519" /></Field>
          <Field label="Garantia padrão (meses)" hint="Vale para tarefas novas."><input className="input" type="number" min={0} max={120} value={f.warranty} onChange={(e) => setF({ ...f, warranty: e.target.value })} /></Field>
        </div>
        <ErrorBox text={formError} />
        <div className="flex justify-end"><button className="btn-primary" disabled={saving} data-testid="btn-save-settings">{saving ? 'Salvando...' : 'Salvar'}</button></div>
      </form>

      <section className="card p-5 md:p-7" aria-label="Catálogo de aparelhos">
        <h2 className="font-semibold text-slate-900">Catálogo de aparelhos</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">Lista que aparece no formulário do cliente e nas tarefas. Comece pelos mais populares.</p>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {(models || []).map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2.5" data-testid="model-row">
              <span className={`flex-1 text-sm ${m.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{m.brand} {m.line}</span>
              {!m.active && <Badge>Oculto</Badge>}
              <button onClick={async () => { await setModelActive(m.id, !m.active).catch(() => {}); reloadModels(); }} className="text-xs font-medium text-brand-700">{m.active ? 'Ocultar' : 'Mostrar'}</button>
              <button onClick={async () => { await deleteModel(m.id).catch(() => {}); reloadModels(); }} aria-label={`Remover ${m.brand} ${m.line}`} className="text-slate-400 hover:text-rose-600"><IconTrash className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="Marca (ex.: Daikin)" value={newModel.brand} onChange={(e) => setNewModel({ ...newModel, brand: e.target.value })} maxLength={40} aria-label="Marca" />
          <input className="input" placeholder="Linha/modelo (ex.: Inverter)" value={newModel.line} onChange={(e) => setNewModel({ ...newModel, line: e.target.value })} maxLength={60} aria-label="Linha ou modelo" />
          <button className="btn-primary" data-testid="btn-add-model">Adicionar</button>
        </form>
        <div className="mt-3"><ErrorBox text={modelError} /></div>
      </section>
    </div>
  );
}
