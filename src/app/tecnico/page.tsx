'use client';
import { useState } from 'react';
import { Segmented, Loading, Empty, ErrorBox, PageHeader } from '@/components/ui';
import TaskCard from '@/components/features/TaskCard';
import { useAsync } from '@/hooks/useAsync';
import { listTasks } from '@/services/tasks';

// Tarefas do técnico: só as dele (o banco garante), pendentes primeiro
export default function TecnicoHome() {
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const { data, loading, error } = useAsync(() => listTasks({ status: tab }), [tab]);
  const tasks = data || [];
  return (
    <>
      <PageHeader title="Minhas tarefas" subtitle={tab === 'pending' ? 'O que você precisa fazer' : 'Serviços já concluídos'} />
      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pendentes' }, { value: 'done', label: 'Concluídas' }]} /></div>
      <ErrorBox text={error} />
      {loading ? <Loading /> : tasks.length === 0 ? (
        <Empty text={tab === 'pending' ? 'Nenhuma tarefa pendente. Bom trabalho!' : 'Nenhuma tarefa concluída ainda.'} />
      ) : (
        <div className="space-y-3">{tasks.map((t) => <TaskCard key={t.id} task={t} href={`/tecnico/tarefa/${t.id}`} showWarranty={tab === 'done'} />)}</div>
      )}
    </>
  );
}
