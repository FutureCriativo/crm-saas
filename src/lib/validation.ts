import { z } from 'zod';
import { USERNAME_RE } from './tech-login';

// Regras de validação usadas pelas rotas do servidor (nunca confie só na tela)
export const technicianCreateSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(80),
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, 'Usuário: 3 a 30 letras minúsculas, números, ponto, traço ou sublinhado.'),
  password: z.string().min(6, 'A senha precisa de pelo menos 6 caracteres.').max(72, 'Senha muito longa.'),
});

export const technicianPatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset_password'), password: z.string().min(6, 'A senha precisa de pelo menos 6 caracteres.').max(72) }),
  z.object({ action: z.literal('set_active'), active: z.boolean() }),
]);

export const dispatchSchema = z.object({ notification_id: z.string().uuid() });

export const isPhoneBR = (v: string) => {
  const d = (v || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length === 10 || d.length === 11;
};
