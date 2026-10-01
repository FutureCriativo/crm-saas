'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getProfile, homeFor } from '@/lib/profile';
import { normalizeUsername, techEmail, USERNAME_RE } from '@/lib/tech-login';
import TopNav from '@/components/layout/TopNav';
import { ErrorBox } from '@/components/ui';

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const perfilParam = params.get('perfil');
  const isTech = perfilParam === 'tecnico';
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Links antigos da "área do cliente" agora levam à consulta por código
  useEffect(() => { if (perfilParam === 'cliente') router.replace('/consulta'); }, [perfilParam, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let email = login.trim();
    if (isTech) {
      const u = normalizeUsername(login);
      if (!USERNAME_RE.test(u)) { setError('Usuário ou senha incorretos.'); setLoading(false); return; }
      email = techEmail(u);
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(/banned/i.test(authError.message)
        ? 'Acesso desativado. Fale com o gestor.'
        : /invalid login|credentials/i.test(authError.message)
          ? (isTech ? 'Usuário ou senha incorretos.' : 'E-mail ou senha incorretos.')
          : 'Não foi possível entrar. Tente novamente.');
      setLoading(false);
      return;
    }

    // Cada perfil vai para a sua área (quem decide é o banco, não o botão clicado)
    const profile = await getProfile();
    if (!profile) {
      await supabase.auth.signOut();
      setError('Seu acesso não está liberado ou foi desativado. Fale com o gestor.');
      setLoading(false);
      return;
    }
    router.replace(homeFor(profile));
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
        <Link href="/login?perfil=tecnico" role="tab" aria-selected={isTech} className={`rounded-lg px-4 py-1.5 text-sm font-medium ${isTech ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Time Técnico</Link>
        <Link href="/login?perfil=gestor" role="tab" aria-selected={!isTech} className={`rounded-lg px-4 py-1.5 text-sm font-medium ${!isTech ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Gestor</Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{isTech ? 'Entrar como técnico' : 'Entrar como gestor'}</h1>
      <p className="mt-1 text-sm text-slate-500">{isTech ? 'Use o usuário e a senha que o gestor criou para você.' : 'Acesse pedidos, tarefas, clientes e garantias.'}</p>

      <form onSubmit={handleLogin} className="mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="login">{isTech ? 'Usuário' : 'E-mail'}</label>
          {isTech
            ? <input id="login" autoComplete="username" autoCapitalize="none" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ex.: paulo" className="input" required />
            : <input id="login" type="email" autoComplete="email" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="seu@email.com" className="input" required />}
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" required />
        </div>
        <ErrorBox text={error} />
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Esqueceu a senha? {isTech ? 'Peça ao gestor para redefinir.' : 'Fale com quem administra o sistema.'}</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <div className="flex justify-center px-4 py-12">
        <Suspense fallback={null}><LoginForm /></Suspense>
      </div>
    </div>
  );
}
