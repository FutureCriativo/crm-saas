// Conteúdo do site público (página inicial).
// Para criar o site de outra empresa, basta trocar os dados deste arquivo.
// No futuro estes dados podem vir do banco (tabela companies), um por empresa.

export const SITE = {
  businessName: 'FutureCriativo Climatização',
  headline: 'Ar-condicionado instalado certo, com garantia registrada',
  subheadline:
    'Instalação, manutenção e higienização para casas e empresas. Cada serviço fica registrado com número de OS e garantia, fácil de consultar quando precisar.',
  city: 'Sorocaba e região',

  // Contato do orçamento (por enquanto, o seu)
  whatsapp: '', // só números com DDI e DDD, ex.: '5515999999999'. Vazio = botão escondido
  email: 'futurecriativo@zohomail.com',

  services: [
    { title: 'Instalação', text: 'Split, multi-split e janela, com material de qualidade e acabamento limpo.' },
    { title: 'Manutenção preventiva', text: 'Revisão periódica para o aparelho durar mais e gastar menos energia.' },
    { title: 'Higienização', text: 'Limpeza completa de filtros e serpentina para um ar mais saudável.' },
    { title: 'Conserto', text: 'Diagnóstico e reparo com peças de reposição e garantia do serviço.' },
  ],

  steps: [
    { title: 'Peça seu orçamento', text: 'Preencha o formulário ou chame no WhatsApp.' },
    { title: 'Visita técnica', text: 'Avaliamos o local e passamos o valor sem compromisso.' },
    { title: 'Serviço com garantia', text: 'Tudo registrado com número de OS e prazo de garantia.' },
  ],

  highlights: ['Garantia registrada', 'Técnicos qualificados', 'Atendimento rápido', 'Orçamento sem compromisso'],
};

export function whatsappLink(text = 'Olá! Gostaria de um orçamento.') {
  if (!SITE.whatsapp) return '';
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}
