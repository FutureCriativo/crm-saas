import { applianceLabel, formatDate } from './format';
import type { ItemInput, RequestKind } from '@/types';

export const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');

// wa.me exige número com DDI, só dígitos. Sem número configurado, não existe link.
export function waLink(number: string | null | undefined, text: string): string {
  const n = onlyDigits(number || '');
  if (n.length < 12) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

// Link para falar COM o cliente (telefone salvo sem DDI)
export function waToClient(phone: string | null | undefined, text: string): string {
  let d = onlyDigits(phone || '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return waLink(d, text);
}

export function requestMessage(args: {
  kind: RequestKind; number: number; name: string; address: string; items: ItemInput[];
  preferredDate?: string | null; problem?: string; urgency?: string; message?: string; code?: string;
}): string {
  const lines = [
    `Olá! Acabei de enviar o pedido #${args.number} de *${args.kind === 'installation' ? 'instalação' : 'manutenção'}* pelo site.`,
    `Nome: ${args.name}`,
    args.code ? `Código de cliente: ${args.code}` : '',
    `Endereço: ${args.address}`,
    args.items.length ? `Aparelho(s): ${args.items.map(applianceLabel).join('; ')}` : '',
    args.problem ? `Problema: ${args.problem}` : '',
    args.urgency === 'high' ? 'Urgente: sim' : '',
    args.preferredDate ? `Data desejada: ${formatDate(args.preferredDate)}` : '',
    args.message ? `Obs.: ${args.message}` : '',
  ];
  return lines.filter(Boolean).join('\n').slice(0, 900);
}

// Mensagem para o gestor enviar o código de cliente
export function codeMessage(name: string, code: string, business: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `Olá ${name.split(' ')[0]}! Seu código de cliente na ${business} é *${code}*. Com ele você consulta a garantia dos seus aparelhos em ${origin}/consulta`;
}
