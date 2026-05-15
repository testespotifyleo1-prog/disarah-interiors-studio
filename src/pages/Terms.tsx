import { Link } from 'react-router-dom';
import { TyposLogo } from '@/components/brand/TyposLogo';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Voltar à página inicial
        </Link>

        <TyposLogo size="sm" showCredit className="mb-8" />

        <h1 className="text-3xl font-black text-foreground mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar o Typos! ERP ("Sistema"), você concorda com estes Termos de Uso. Caso não concorde, não utilize o Sistema.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">2. Descrição do Serviço</h2>
            <p>O Typos! ERP é um sistema de gestão empresarial (ERP) baseado em nuvem que oferece funcionalidades de ponto de venda (PDV), controle de estoque, emissão fiscal, gestão financeira, e-commerce, chatbot com inteligência artificial, entre outras.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">3. Cadastro e Conta</h2>
            <p>Para utilizar o Sistema, é necessário criar uma conta fornecendo informações verdadeiras e completas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">4. Período de Teste</h2>
            <p>Oferecemos um período de teste gratuito de 7 (sete) dias corridos. Após o término do período de teste, será necessário contratar um plano pago para continuar utilizando o Sistema.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">5. Pagamento e Renovação</h2>
            <p>Os planos são cobrados mensalmente. A renovação é automática, podendo ser cancelada a qualquer momento antes do próximo ciclo de cobrança. Não há fidelidade mínima.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">6. Uso Aceitável</h2>
            <p>Você concorda em não utilizar o Sistema para fins ilegais, fraudulentos ou que violem direitos de terceiros. É proibido tentar acessar áreas restritas do Sistema, realizar engenharia reversa ou sobrecarregar intencionalmente os servidores.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">7. Propriedade Intelectual</h2>
            <p>Todo o conteúdo, código-fonte, design, marcas e materiais do Typos! ERP são de propriedade exclusiva de seus criadores e estão protegidos por leis de propriedade intelectual.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">8. Dados e Privacidade</h2>
            <p>O tratamento de dados pessoais é regido pela nossa Política de Privacidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">9. Limitação de Responsabilidade</h2>
            <p>O Typos! ERP é fornecido "como está". Não garantimos que o Sistema será ininterrupto ou livre de erros. Em nenhuma hipótese seremos responsáveis por danos indiretos, incidentais ou consequenciais.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">10. Modificações</h2>
            <p>Reservamo-nos o direito de modificar estes Termos a qualquer momento. Alterações significativas serão comunicadas por e-mail ou notificação no Sistema.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">11. Contato</h2>
            <p>Para dúvidas sobre estes Termos, entre em contato pelo e-mail contato@typoserp.com.br.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
