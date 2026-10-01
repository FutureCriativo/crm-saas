'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, homeFor } from '@/lib/profile';
import type { Profile, Role } from '@/types';

// Exige login e papel. Quem não pode estar aqui é levado para o lugar certo (o banco é quem realmente protege os dados).
export function useRequireRole(role: Role) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    getProfile().then((p) => {
      if (!p) router.replace(`/login?perfil=${role === 'owner' ? 'gestor' : 'tecnico'}`);
      else if (p.role !== role) router.replace(homeFor(p));
      else setProfile(p);
    });
  }, [router, role]);
  return profile;
}
