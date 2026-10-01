'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, Loading, ErrorBox, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import ClientForm from '../ClientForm';
import { useAsync } from '@/hooks/useAsync';
import { useSettings } from '@/hooks/useSettings';
import { getClient, updateClient } from '@/services/clients';
import { listTasks } from '@/services/tasks';
import { codeMessage, waToClient } from '@/lib/whatsapp';
import { APP_NAME } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { IconChat, IconCopy, IconPlus } from '@/components/icons';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { data: client, loading, error, reload } = useAsync(() => getClient(id), [id]);
  const { data: tasks } = useAsync(() => listTasks({ clientId: id }), [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox text={error} />;
  if (!client) return <div className="card p-8 text-center text-slate-500">Cliente não encontrado.</div>;
  const wa = waToClient(client.phone, codeMessage(client.name, client.client_code, settings?.business_name || APP_NAME));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/dashboard/clients" className="text-sm text-slate-500 hover:text-slate-800">← Clientes</Link>
      <PageHeader title={client.name} subtitle="Cadastro do cliente" action={<Link href={`/dashboard/tasks/new?client=${client.id}`} className="btn-primary"><IconPlus className="h-5 w-5" /> Nova tarefa</Link>} />

      <div className="card flex flex-wrap items-center gap-3 p-5">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Código de cliente</p>
          <p className="font-mono text-2xl font-bold tracking-[0.25em] text-slate-900" data-testid="client-code">{client.client_code}</p>
        </div>
        <button onClick={async () => { try { await navigator.clipboard.writeText(client.client_code); toast('Código copiado.'); } catch { toast('Não foi possível copiar.', 'error'); } }} className="btn-ghost border border-slate-200 text-sm"><IconCopy className="h-4 w-4" /> Copiar</button>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost border border-slate-200 text-sm"><IconChat className="h-4 w-4" /> Enviar ao cliente</a>}
      </div>

      <ClientForm initial={client} submitLabel="Salvar alterações" onSubmit={async (c) => { await updateClient(client.id, c); toast('Cliente atualizado.'); reload(); }} />

      <section className="card">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Histórico de tarefas</h2></div>
        {!tasks || tasks.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma tarefa para este cliente.</p> : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.id}><Link href={`/dashboard/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                <span className="font-mono text-xs font-semibold text-brand-800">{t.order_number}</span>
                <span className="flex-1 text-sm text-slate-700">{t.kind === 'installation' ? 'Instalação' : 'Manutenção'} · {formatDate(t.done_on || t.scheduled_date)}</span>
                <Badge tone={t.status === 'done' ? 'green' : 'slate'}>{t.status === 'done' ? 'Concluída' : 'Pendente'}</Badge>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
