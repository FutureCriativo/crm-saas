'use client';
import TopNav from '@/components/layout/TopNav';
import PublicFooter from '@/components/layout/PublicFooter';
import { useSettings } from '@/hooks/useSettings';
import { APP_NAME } from '@/lib/brand';
import { waLink } from '@/lib/whatsapp';

// Política de privacidade (LGPD) em linguagem simples. Contato e nome vêm das Configurações.
export default function PrivacidadePage() {
  const { settings } = useSettings();
  const empresa = settings?.business_name || APP_NAME;
  const wa = waLink(settings?.whatsapp, 'Olá! Quero falar sobre os meus dados pessoais no site.');
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold text-slate-900">Privacidade e seus dados</h1>
        <p className="mt-3 text-slate-600">Explicamos de forma simples o que {empresa} guarda quando você usa este site (Lei Geral de Proteção de Dados, LGPD).</p>

        <Section title="Quais dados pedimos">
          Nome, telefone (WhatsApp), endereço, cidade e, se quiser, e-mail. Também guardamos os aparelhos, o problema descrito, a data desejada e as observações do pedido.
        </Section>
        <Section title="Para que usamos">
          Só para atender o seu pedido: combinar a visita, fazer a instalação ou manutenção, registrar a ordem de serviço e calcular a sua garantia. Não vendemos nem compartilhamos seus dados para propaganda.
        </Section>
        <Section title="Quem vê">
          A equipe de {empresa} (gestor e o técnico que fará o seu atendimento). A consulta de garantia mostra apenas aparelho e datas, nunca nome, telefone ou endereço. O código de cliente é pessoal: não compartilhe.
        </Section>
        <Section title="Avisos no celular (opcional)">
          Se você ativar os avisos, guardamos um identificador do seu aparelho para enviar lembretes de garantia. Você pode desativar quando quiser na tela de consulta ou nas configurações do navegador.
        </Section>
        <Section title="Onde ficam e por quanto tempo">
          Em banco de dados protegido, com acesso restrito por empresa e por perfil. Guardamos enquanto houver relação de atendimento e garantia, ou pelo prazo exigido por lei.
        </Section>
        <Section title="Seus direitos">
          Você pode pedir a qualquer momento: ver seus dados, corrigir, apagar ou saber com quem foram compartilhados. É só chamar a gente:
          <div className="mt-3">
            {wa
              ? <a className="btn-primary inline-flex" href={wa} target="_blank" rel="noopener noreferrer">Falar sobre meus dados no WhatsApp</a>
              : <span className="text-slate-500">Entre em contato pelo telefone que consta no nosso atendimento.</span>}
          </div>
        </Section>
        <p className="mt-10 text-xs text-slate-400">Atualizado em setembro de 2026.</p>
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 text-slate-600">{children}</div>
    </section>
  );
}
