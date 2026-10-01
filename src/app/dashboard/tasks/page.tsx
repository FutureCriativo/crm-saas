'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PageHeader, Loading, Empty, Segmented, ErrorBox } from '@/components/ui';
import TaskCard from '@/components/features/TaskCard';
import { useAsync } from '@/hooks/useAsync';
import { listTasks } from '@/services/tasks';
import { listTechnicians } from '@/services/technicians';
import { IconPlus, IconSearch } from '@/components/icons';
import type { TaskStatus } from '@/types';

export default function TasksPage() {
  const [tab, setTab] = useState<TaskStatus | 'all'>('pending');
  const [tech, setTech] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error } = useAsync(() => listTasks({ status: tab === 'all' ? undefined : tab, assignedTo: tech || undefined }), [tab, tech]);
  const { data: techs } = useAsync(() => listTechnicians(), []);
  const names = new Map((techs || []).map((t) => [t.id, t.name || t.username || '']));

  const term = q.trim().toLowerCase();
  const list = (data || []).filter((t) => !term || t.order_number.toLowerCase().includes(term) || (t.clients?.name || '').toLowerCase().includes(term));

  return (
    <>
      <PageHeader title="Tarefas" subtitle="Instalações e manutenções (cada tarefa é uma OS)" action={<Link href="/dashboard/tasks/new" className="btn-primary"><IconPlus className="h-5 w-5" /> Nova tarefa</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pendentes' }, { value: 'done', label: 'Concluídas' }, { value: 'all', label: 'Todas' }]} />
        <select className="input max-w-[14rem]" value={tech} onChange={(e) => setTech(e.target.value)} aria-label="Filtrar por técnico">
          <option value="">Todos os técnicos</option>
          {(techs || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="relative mb-5">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input className="input pl-11" placeholder="Buscar por cliente ou número da OS..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox text={error} />
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty text="Nenhuma tarefa encontrada." action={<Link href="/dashboard/tasks/new" className="btn-primary">Criar tarefa</Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{list.map((t) => <TaskCard key={t.id} task={t} href={`/dashboard/tasks/${t.id}`} techName={names.get(t.assigned_to || '') || ''} showWarranty />)}</div>
      )}
    </>
  );
}
