'use client';
import { BTU_OPTIONS } from '@/lib/config';
import { IconPlus, IconTrash } from '../icons';
import type { CatalogModel, ItemInput, TaskItem } from '@/types';

// Lista de aparelhos (usada no pedido do cliente e na tarefa do técnico/gestor)
export type ItemDraft = { key: string; catalogId: string; brand: string; model: string; btus: string; serial_number: string; location: string };

const rnd = () => Math.random().toString(36).slice(2, 10);
export const newItem = (): ItemDraft => ({ key: rnd(), catalogId: '', brand: '', model: '', btus: '', serial_number: '', location: '' });

export function toPayload(items: ItemDraft[]): ItemInput[] {
  return items
    .filter((i) => i.model.trim())
    .map((i) => ({
      brand: i.brand.trim() || null, model: i.model.trim(), btus: i.btus ? Number(i.btus) : null,
      serial_number: i.serial_number.trim() || null, location: i.location.trim() || null,
    }));
}

export function fromTaskItems(items: TaskItem[], catalog: CatalogModel[]): ItemDraft[] {
  return items.map((i) => {
    const hit = catalog.find((c) => c.brand.toLowerCase() === (i.brand || '').toLowerCase() && c.line.toLowerCase() === i.model.toLowerCase());
    return {
      key: rnd(), catalogId: hit ? hit.id : 'other', brand: i.brand || '', model: i.model, btus: i.btus ? String(i.btus) : '',
      serial_number: i.serial_number || '', location: i.location || '',
    };
  });
}

type Props = {
  items: ItemDraft[]; onChange: (items: ItemDraft[]) => void; catalog: CatalogModel[];
  detailed?: boolean; max?: number; minOne?: boolean; addLabel?: string;
};

export default function ItemsEditor({ items, onChange, catalog, detailed = false, max = 10, minOne = true, addLabel = 'Adicionar outro aparelho' }: Props) {
  const update = (key: string, patch: Partial<ItemDraft>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const pick = (key: string, id: string) => {
    if (id === 'other' || id === '') return update(key, { catalogId: id, ...(id === '' ? { brand: '', model: '' } : {}) });
    const c = catalog.find((x) => x.id === id);
    update(key, { catalogId: id, brand: c?.brand || '', model: c?.line || '' });
  };

  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const btuOptions = it.btus && !BTU_OPTIONS.includes(Number(it.btus)) ? [...BTU_OPTIONS, Number(it.btus)].sort((a, b) => a - b) : BTU_OPTIONS;
        return (
          <div key={it.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5" data-testid="item-row">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Aparelho {idx + 1}</p>
              {(!minOne || items.length > 1) && (
                <button type="button" onClick={() => onChange(items.filter((i) => i.key !== it.key))}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50" aria-label={`Remover aparelho ${idx + 1}`}>
                  <IconTrash className="h-4 w-4" /> Remover
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Modelo</label>
                <select className="input" value={it.catalogId} onChange={(e) => pick(it.key, e.target.value)} aria-label={`Modelo do aparelho ${idx + 1}`}>
                  <option value="">Selecione...</option>
                  {catalog.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.line}</option>)}
                  <option value="other">Outro (digitar)</option>
                </select>
              </div>
              <div>
                <label className="label">Potência</label>
                <select className="input" value={it.btus} onChange={(e) => update(it.key, { btus: e.target.value })} aria-label={`Potência do aparelho ${idx + 1}`}>
                  <option value="">Não sei</option>
                  {btuOptions.map((b) => <option key={b} value={b}>{b.toLocaleString('pt-BR')} BTUs</option>)}
                </select>
              </div>
              {it.catalogId === 'other' && (
                <>
                  <div>
                    <label className="label">Marca</label>
                    <input className="input" value={it.brand} maxLength={40} onChange={(e) => update(it.key, { brand: e.target.value })} placeholder="Ex.: Daikin" />
                  </div>
                  <div>
                    <label className="label">Modelo / linha</label>
                    <input className="input" value={it.model} maxLength={80} onChange={(e) => update(it.key, { model: e.target.value })} placeholder="Ex.: Inverter Ecoswing" />
                  </div>
                </>
              )}
              {detailed && (
                <>
                  <div>
                    <label className="label">Nº de série</label>
                    <input className="input" value={it.serial_number} maxLength={60} onChange={(e) => update(it.key, { serial_number: e.target.value })} placeholder="opcional" />
                  </div>
                  <div>
                    <label className="label">Local</label>
                    <input className="input" value={it.location} maxLength={60} onChange={(e) => update(it.key, { location: e.target.value })} placeholder="Ex.: sala, quarto" />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, newItem()])}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
          <IconPlus className="h-5 w-5" /> {addLabel}
        </button>
      )}
    </div>
  );
}
