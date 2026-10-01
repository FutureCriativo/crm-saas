'use client';
import { useState } from 'react';
import { PageHeader, Loading, Empty, Badge, Modal, Field, ErrorBox } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAsync } from '@/hooks/useAsync';
import { createTechnician, listTechnicians, resetTechnicianPassword, setTechnicianActive } from '@/services/technicians';
import { friendlyError } from '@/lib/errors';
import { normalizeUsername, USERNAME_RE } from '@/lib/tech-login';
import { IconCopy, IconKey, IconPlus } from '@/components/icons';
import type { Technician } from '@/types';

export default function TechniciansPage() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync(() => listTechnicians(), []);
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [resetFor, setResetFor] = useState<Technician | null>(null);
  const [newPass, setNewPass] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setCreated(null);
    const username = normalizeUsername(form.username);
    if (form.name.trim().length < 2) return setFormError('Informe o nome do técnico.');
    if (!USERNAME_RE.test(username)) return setFormError('Usuário: 3 a 30 letras minúsculas, números, ponto, traço ou sublinhado. Ex.: paulo');
    if (form.password.length < 6) return setFormError('A senha precisa de pelo menos 6 caracteres.');
    setCreating(true);
    try {
      await createTechnician({ name: form.name.trim(), username, password: form.password });
      setCreated({ username, password: form.password });
      setForm({ name: '', username: '', password: '' });
      reload();
    } catch (err: any) { setFormError(err?.message || friendlyError(err)); } finally { setCreating(false); }
  };

  const doReset = async () => {
    if (!resetFor) return;
    setResetErr('');
    if (newPass.length < 6) return setResetErr('A senha precisa de pelo menos 6 caracteres.');
    setBusy(true);
    try { await resetTechnicianPassword(resetFor.id, newPass); toast(`Senha de ${resetFor.name} redefinida.`); setResetFor(null); setNewPass(''); }
    catch (err: any) { setResetErr(err?.message || 'Não foi possível redefinir.'); } finally { setBusy(false); }
  };

  const toggle = async (t: Technician) => {
    try { await setTechnicianActive(t.id, !t.active); toast(t.active ? `${t.name} desativado.` : `${t.name} reativado.`); reload(); }
    catch (err: any) { toast(err?.message || 'Não foi possível alterar.', 'error'); }
  };

  const copyAccess = async () => {
    if (!created) return;
    const text = `Acesso ao sistema\nEndereço: ${window.location.origin}/login?perfil=tecnico\nUsuário: ${created.username}\nSenha: ${created.password}`;
    try { await navigator.clipboard.writeText(text); toast('Acesso copiado. Envie ao técnico.'); } catch { toast('Não foi possível copiar.', 'error'); }
  };

  return (
    <>
      <PageHeader title="Técnicos" subtitle="Cada técnico entra com usuário e senha, sem precisar de e-mail" />

      <form onSubmit={create} className="card mb-6 space-y-4 p-5" aria-label="Novo técnico">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><IconPlus className="h-5 w-5 text-brand-600" /> Novo técnico</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="Paulo Souza" /></Field>
          <Field label="Usuário" hint="Letras minúsculas e números"><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} maxLength={30} autoCapitalize="none" placeholder="paulo" /></Field>
          <Field label="Senha" hint="Mínimo 6 caracteres"><input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} maxLength={72} autoComplete="off" /></Field>
        </div>
        <ErrorBox text={formError} />
        {created && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="tech-created">
            <span className="flex-1">Técnico criado! Usuário <b>{created.username}</b>. Envie o acesso a ele (a senha não aparece de novo).</span>
            <button type="button" onClick={copyAccess} className="btn-ghost border border-emerald-200 text-sm"><IconCopy className="h-4 w-4" /> Copiar acesso</button>
          </div>
        )}
        <div className="flex justify-end"><button className="btn-primary" disabled={creating} data-testid="btn-create-tech">{creating ? 'Criando...' : 'Criar técnico'}</button></div>
      </form>

      <ErrorBox text={error} />
      {loading ? <Loading /> : !data || data.length === 0 ? <Empty text="Nenhum técnico cadastrado ainda." /> : (
        <ul className="space-y-3">
          {data.map((t) => (
            <li key={t.id} className="card flex flex-wrap items-center gap-3 p-4" data-testid="tech-row">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-500">usuário: <span className="font-mono">{t.username}</span></p>
              </div>
              <Badge tone={t.active ? 'green' : 'slate'}>{t.active ? 'Ativo' : 'Desativado'}</Badge>
              <button onClick={() => { setResetFor(t); setNewPass(''); setResetErr(''); }} className="btn-ghost border border-slate-200 text-sm"><IconKey className="h-4 w-4" /> Redefinir senha</button>
              <button onClick={() => toggle(t)} className={`btn-ghost text-sm ${t.active ? 'text-rose-600' : ''}`}>{t.active ? 'Desativar' : 'Reativar'}</button>
            </li>
          ))}
        </ul>
      )}

      {resetFor && (
        <Modal title={`Nova senha de ${resetFor.name}`} onClose={() => setResetFor(null)}>
          <Field label="Nova senha" hint="Mínimo 6 caracteres. Avise o técnico."><input className="input" value={newPass} onChange={(e) => setNewPass(e.target.value)} maxLength={72} autoComplete="off" autoFocus /></Field>
          <div className="mt-3"><ErrorBox text={resetErr} /></div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setResetFor(null)}>Cancelar</button>
            <button className="btn-primary" disabled={busy} onClick={doReset}>{busy ? 'Salvando...' : 'Redefinir'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
