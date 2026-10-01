'use client';
import { useEffect, useState } from 'react';
import { currentSubscription, disablePush, enablePush, needsInstallOnIos, pushSupported } from '@/services/push';
import { IconBell } from '../icons';

// Cliente (já com o código validado) liga/desliga os avisos neste aparelho
export default function PushToggle({ code }: { code: string }) {
  const [supported, setSupported] = useState(true);
  const [ios, setIos] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setSupported(pushSupported());
    setIos(needsInstallOnIos());
    currentSubscription().then((s) => setOn(!!s)).catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true); setMsg('');
    if (on) { await disablePush(); setOn(false); setBusy(false); return; }
    const r = await enablePush(code);
    if (r === 'ok') setOn(true);
    else if (r === 'denied') setMsg('Você bloqueou os avisos. Para ativar, libere as notificações nas configurações do navegador.');
    else if (r === 'no-key') setMsg('Os avisos ainda não estão configurados pela empresa.');
    else if (r === 'invalid-code') setMsg('Código não reconhecido.');
    else if (r === 'unsupported') setMsg('Este navegador não permite avisos.');
    else setMsg('Não foi possível ativar agora. Tente de novo.');
    setBusy(false);
  };

  return (
    <div className="card p-5" data-testid="push-card">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><IconBell className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Receber avisos no celular</p>
          <p className="mt-1 text-sm text-slate-500">Lembretes de manutenção e aviso quando a garantia estiver perto de vencer.</p>
          {ios && <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">No iPhone: toque em Compartilhar e depois em <b>Adicionar à Tela de Início</b>. Abra o app por lá para ativar os avisos.</p>}
          {!supported && !ios && <p className="mt-2 text-xs text-slate-400">Este navegador não permite avisos.</p>}
          {msg && <p className="mt-2 text-xs text-rose-600" role="alert">{msg}</p>}
          {(supported || ios) && (
            <button onClick={toggle} disabled={busy || (ios && !supported)} className={`mt-3 ${on ? 'btn-ghost border border-slate-200' : 'btn-primary'}`}>
              {busy ? 'Aguarde...' : on ? 'Desativar avisos neste aparelho' : 'Ativar avisos neste aparelho'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
