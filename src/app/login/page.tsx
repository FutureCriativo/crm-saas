'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';
import { IconShield, IconUsers, IconWrench } from '@/components/icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel da marca (computador) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-200 via-brand-300 to-brand-400 p-12 lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/20" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10" />
        <div className="relative"><Logo /></div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-brand-900">{APP_TAGLINE}</h1>
          <ul className="mt-8 space-y-3 text-brand-900/80">
            <li className="flex items-center gap-3"><IconUsers className="h-5 w-5" /> Cadastro de clientes em segundos</li>
            <li className="flex items-center gap-3"><IconWrench className="h-5 w-5" /> OS numerada automaticamente</li>
            <li className="flex items-center gap-3"><IconShield className="h-5 w-5" /> Garantias sempre sob controle</li>
          </ul>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden"><Logo /></div>
          <h2 className="mt-8 text-2xl font-bold tracking-tight text-slate-900 lg:mt-0">Entrar</h2>
          <p className="mt-1 text-sm text-slate-500">Acesse o {APP_NAME} com seu e-mail.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="label">E-mail</label>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" className="input" required />
            </div>
            <div>
              <label className="label">Senha</label>
              <input type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" required />
            </div>

            {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
