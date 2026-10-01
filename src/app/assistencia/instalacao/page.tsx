import Link from 'next/link';
import type { Metadata } from 'next';
import TopNav from '@/components/layout/TopNav';
import PublicFooter from '@/components/layout/PublicFooter';
import RequestForm from '@/components/forms/RequestForm';

export const metadata: Metadata = { title: 'Organizar instalação' };

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-2xl px-4 pt-8">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Voltar</Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Organizar instalação</h1>
        <p className="mb-6 mt-2 text-slate-500">Informe os aparelhos e o endereço. Depois do envio, abrimos o WhatsApp para alinhar a data.</p>
        <RequestForm kind="installation" />
      </main>
      <PublicFooter />
    </div>
  );
}
