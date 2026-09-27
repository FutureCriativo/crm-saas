'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate, warrantyStatus } from '@/lib/format';
import { PageHeader, WarrantyBadge, Loading, Empty } from '@/components/ui';
import { SITE, whatsappLink } from '@/config/site';
import { IconChat, IconMail } from '@/components/icons';

export default function PortalPage() {
  const [client, setClient] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // O banco (RLS) só devolve o cadastro e as OS deste cliente
      const [{ data: c }, { data: inst }] = await Promise.all([
        supabase.from('clients').select('name').maybeSingle(),
        supabase.from('installations')
          .select('id, order_number, machine_type, machine_brand, installation_date, warranty_expires_at')
          .order('installation_date', { ascending: false }),
      ]);
      setClient(c);
      setItems(inst || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Loading />;

  const wa = whatsappLink('Olá! Sou cliente e gostaria de agendar uma manutenção.');

  return (
    <>
      <PageHeader
        title={client?.name ? `Olá, ${client.name.split(' ')[0]}` : 'Minha área'}
        subtitle="Suas instalações e garantias"
        action={
          wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary"><IconChat className="h-5 w-5" /> Pedir manutenção</a>
          ) : (
            <a href={`mailto:${SITE.email}?subject=Pedido de manutenção`} className="btn-primary"><IconMail className="h-5 w-5" /> Pedir manutenção</a>
          )
        }
      />

      {items.length === 0 ? (
        <Empty text="Nenhuma instalação vinculada à sua conta ainda." />
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-xs font-semibold text-brand-800">OS {i.order_number}</span>
                <WarrantyBadge status={warrantyStatus(i.warranty_expires_at)} />
              </div>
              <p className="mt-3 font-semibold text-slate-900">
                {i.machine_type}{i.machine_brand && <span className="font-normal text-slate-400"> · {i.machine_brand}</span>}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Instalado em {formatDate(i.installation_date)} · Garantia até {formatDate(i.warranty_expires_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
