import { Link } from 'react-router-dom';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Voltar à página inicial
        </Link>

        <TyposLogo size="sm" showCredit className="mb-8" />

        <h1 className="text-3xl font-black text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground">1. Informações que Coletamos</h2>
            <p>Coletamos informações que você nos fornece diretamente, como nome, e-mail, telefone, CNPJ/CPF e dados da empresa ao criar sua conta. Também coletamos dados gerados pelo uso do Sistema, como logs de acesso, vendas e movimentações.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">2. Como Usamos suas Informações</h2>
            <p>Utilizamos seus dados para: fornecer e manter o Sistema; processar transações; enviar comunicações sobre o serviço; melhorar nossa plataforma; cumprir obrigações legais e fiscais; e prevenir fraudes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">3. Compartilhamento de Dados</h2>
            <p>Não vendemos seus dados pessoais. Podemos compartilhar informações com: prestadores de serviço essenciais (hospedagem, processamento de pagamento); autoridades fiscais quando exigido por lei; e parceiros de integração que você ativar (ex: marketplaces).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">4. Armazenamento e Segurança</h2>
            <p>Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS) e em repouso. Implementamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">5. Seus Direitos (LGPD)</h2>
            <p>Em conformidade com a LGPD, você tem direito a: acessar seus dados pessoais; corrigir dados incompletos ou desatualizados; solicitar a exclusão de dados pessoais; solicitar a portabilidade dos dados; revogar o consentimento a qualquer momento.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">6. Cookies</h2>
            <p>Utilizamos cookies essenciais para o funcionamento do Sistema e cookies de análise para entender o uso da plataforma. Você pode gerenciar suas preferências de cookies nas configurações do navegador.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">7. Retenção de Dados</h2>
            <p>Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para cumprir obrigações legais. Dados fiscais são mantidos pelo prazo legal de 5 anos. Após o cancelamento da conta, seus dados serão excluídos em até 30 dias, exceto quando a retenção for legalmente exigida.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">8. Alterações nesta Política</h2>
            <p>Podemos atualizar esta Política periodicamente. Notificaremos sobre mudanças significativas por e-mail ou aviso no Sistema.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">9. Contato do Encarregado (DPO)</h2>
            <p>Para exercer seus direitos ou tirar dúvidas sobre privacidade, entre em contato: contato@typoserp.com.br.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
