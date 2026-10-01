'use client';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import ClientForm from '../ClientForm';
import { createClient } from '@/services/clients';
import { getProfile } from '@/lib/profile';

export default function NewClientPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Novo cliente" subtitle="O código de cliente é criado automaticamente. Depois você já cria a tarefa." />
      <ClientForm submitLabel="Salvar e criar tarefa" onCancel={() => router.push('/dashboard/clients')}
        onSubmit={async (c) => {
          const p = await getProfile();
          if (!p) throw new Error('Sessão expirada. Entre de novo.');
          const id = await createClient(p.company_id, c);
          router.push(`/dashboard/tasks/new?client=${id}`);
        }} />
    </div>
  );
}
