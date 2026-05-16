import React from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  Search,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  ScrollText,
  Truck,
  FileText,
  Settings,
  DollarSign,
  Tag,
  Warehouse,
  ArrowRightLeft,
  Clock,
  CreditCard,
  Gift,
  Building2,
  FileBox,
  UserCheck,
  TrendingUp,
  Car,
  Wrench,
  CalendarDays,
  Store,
  Boxes,
  Undo2,
  BarChart3,
  ClipboardList
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TutorialStep {
  title: string;
  description: string;
}

interface TutorialMenu {
  id: string;
  label: string;
  icon: any;
  description: string;
  image?: string;
  steps: TutorialStep[];
}

const tutorials: TutorialMenu[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Visão geral do seu negócio em tempo real.',
    image: '/screenshots/dashboard.png',
    steps: [
      { title: 'Resumo de Vendas', description: 'Veja o faturamento do dia, mês e ticket médio no topo da página. Os cards mostram o total bruto e líquido.' },
      { title: 'Gráficos de Desempenho', description: 'Acompanhe a evolução das vendas diárias e mensais através dos gráficos interativos de faturamento dos últimos 7 dias.' },
      { title: 'Alertas de Estoque', description: 'O sistema destaca automaticamente produtos que estão com estoque baixo (abaixo de 10 unidades).' },
      { title: 'Entregas e Montagens', description: 'Visualize rapidamente quantas entregas e montagens estão pendentes ou agendadas para hoje.' },
      { title: 'Ranking e Metas', description: 'Acompanhe o desempenho da equipe com o ranking de vendedores e o progresso em relação às metas mensais.' },
    ]
  },
  {
    id: 'pdv',
    label: 'PDV (Ponto de Venda)',
    icon: ShoppingCart,
    description: 'Realize vendas de forma rápida e eficiente.',
    image: '/screenshots/pdv.png',
    steps: [
      { title: 'Seleção de Produtos', description: 'Pesquise produtos pelo nome ou bipe o código de barras. O sistema carrega os preços padrão ou promocionais automaticamente.' },
      { title: 'Identificação do Cliente', description: 'Vincule a venda a um cliente para gerenciar histórico, crediário ou aplicar descontos personalizados.' },
      { title: 'Taxas e Observações', description: 'Adicione taxas de entrega, montagem ou observações específicas que sairão no comprovante da venda.' },
      { title: 'Pagamento Múltiplo', description: 'O sistema permite dividir o pagamento em várias formas (ex: parte em dinheiro, parte no cartão).' },
      { title: 'Finalização e Documentos', description: 'Ao finalizar, escolha entre salvar como rascunho ou concluir a venda para emissão de NFC-e ou Recibo.' },
    ]
  },
  {
    id: 'products',
    label: 'Produtos & Estoque',
    icon: Package,
    description: 'Gestão completa do seu catálogo e estoque.',
    image: '/screenshots/products.png',
    steps: [
      { title: 'Cadastro Detalhado', description: 'Cadastre SKU, nome, unidade, preços de custo e venda, além de informações fiscais (NCM, CEST, CFOP).' },
      { title: 'Gestão de Categorias', description: 'Organize seus produtos por categorias e grupos para facilitar a navegação no PDV e relatórios.' },
      { title: 'Controle de Validades', description: 'Registre lotes e datas de validade para receber alertas de produtos próximos ao vencimento.' },
      { title: 'Transferências entre Lojas', description: 'Mova seu estoque entre diferentes unidades de forma controlada, gerando um histórico de movimentação.' },
      { title: 'Impressão de Etiquetas', description: 'Gere etiquetas personalizadas com código de barras para seus produtos diretamente pelo sistema.' },
    ]
  },
  {
    id: 'sales',
    label: 'Vendas & Relatórios',
    icon: Receipt,
    description: 'Acompanhamento de todas as transações realizadas.',
    image: '/screenshots/sales.png',
    steps: [
      { title: 'Listagem de Vendas', description: 'Visualize todas as vendas realizadas com filtros por período, status, vendedor e loja.' },
      { title: 'Status da Venda', description: 'Acompanhe se a venda está Aberta, Paga, Cancelada ou se é um Rascunho.' },
      { title: 'Recebimento de Crediário', description: 'O sistema lista separadamente os recebimentos de parcelas de crediário que entraram no caixa.' },
      { title: 'Exportação de Dados', description: 'Exporte suas vendas para planilhas CSV para análises externas ou contabilidade.' },
      { title: 'Visualização Detalhada', description: 'Clique no ícone de olho para ver os itens da venda, pagamentos, histórico e documentos fiscais vinculados.' },
    ]
  },
  {
    id: 'customers',
    label: 'Clientes & CRM',
    icon: Users,
    description: 'Gerencie o relacionamento com seus clientes.',
    steps: [
      { title: 'Cadastro Completo', description: 'Armazene dados de contato, CPF/CNPJ, endereços de entrega e limites de crédito.' },
      { title: 'Gestão de Crediário', description: 'Autorize ou bloqueie o uso de crediário para clientes específicos e defina limites de valor.' },
      { title: 'Créditos de Loja', description: 'Gerencie saldos provenientes de devoluções que podem ser usados como forma de pagamento.' },
      { title: 'Histórico e Pontuação', description: 'Acompanhe a fidelidade do cliente através do histórico de compras e comportamento.' },
    ]
  },
  {
    id: 'commercial',
    label: 'Comercial & Compras',
    icon: ScrollText,
    description: 'Gestão de pedidos, orçamentos e fornecedores.',
    steps: [
      { title: 'Orçamentos (Cotações)', description: 'Crie orçamentos profissionais e envie para seus clientes. Converta em venda com um clique.' },
      { title: 'Gestão de Fornecedores', description: 'Mantenha um banco de dados de fornecedores vinculados aos seus respectivos produtos.' },
      { title: 'Pedidos de Compra', description: 'Gere pedidos de reposição e controle a entrada de mercadorias no estoque.' },
      { title: 'Sugestões de Reposição', description: 'Deixe o sistema sugerir o que comprar com base no giro de estoque e estoque mínimo.' },
    ]
  },
  {
    id: 'finance',
    label: 'Financeiro',
    icon: DollarSign,
    description: 'Saúde financeira da sua empresa.',
    steps: [
      { title: 'Controle de Fluxo de Caixa', description: 'Monitore as entradas e saídas diárias de todos os caixas da loja.' },
      { title: 'Contas a Pagar e Receber', description: 'Agende seus compromissos financeiros e não perca prazos de recebimento.' },
      { title: 'Gestão de Comissões', description: 'Cálculo automático de comissões por vendedor ou metas atingidas.' },
      { title: 'Extratos de Pagamentos', description: 'Veja detalhadamente cada pagamento recebido, incluindo taxas de cartão e prazos de repasse.' },
    ]
  },
  {
    id: 'logistics',
    label: 'Logística & Montagem',
    icon: Truck,
    description: 'Entrega e montagem de produtos.',
    steps: [
      { title: 'Expedição (Picking)', description: 'Separe e confira os itens vendidos antes de saírem para entrega ou retirada.' },
      { title: 'Roteirização de Entregas', description: 'Organize as entregas por motorista, veículo e região para otimizar o tempo.' },
      { title: 'Agenda de Montagem', description: 'Gerencie o cronograma dos montadores e o status de cada serviço realizado.' },
      { title: 'Status em Tempo Real', description: 'Acompanhe se o pedido está "Em Rota", "Entregue" ou se houve alguma ocorrência.' },
    ]
  },
  {
    id: 'fiscal',
    label: 'Fiscal & Documentos',
    icon: FileText,
    description: 'Emissão de documentos e obrigações fiscais.',
    steps: [
      { title: 'Emissão de NF-e e NFC-e', description: 'Emita notas de venda, devolução, remessa e cupons fiscais eletrônicos com um clique.' },
      { title: 'Importação de XML', description: 'Agilize a entrada de estoque e cadastro de produtos importando o XML do fornecedor.' },
      { title: 'Painel do Contador', description: 'Área dedicada para exportação de XMLs e PDFs de todos os documentos do mês.' },
      { title: 'Configurações Fiscais', description: 'Mantenha os certificados digitais e regras tributárias atualizados por loja.' },
    ]
  },
  {
    id: 'settings',
    label: 'Configurações & Admin',
    icon: Settings,
    description: 'Personalize o sistema para sua empresa.',
    steps: [
      { title: 'Gestão de Lojas e Usuários', description: 'Adicione novas filiais e gerencie as permissões de acesso de cada colaborador.' },
      { title: 'Configurações da Empresa', description: 'Ajuste logotipos, dados fiscais e informações de contato da matriz.' },
      { title: 'Integrações Externas', description: 'Configure Mercado Pago, WooCommerce e outras ferramentas de terceiros.' },
      { title: 'Segurança e Logs', description: 'Acompanhe o registro de atividades para saber quem fez o quê no sistema.' },
    ]
  }
];

export default function Training() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTutorial, setActiveTutorial] = React.useState<TutorialMenu>(tutorials[0]);

  const filteredTutorials = tutorials.filter(t => 
    t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Treinamento</h1>
          <p className="text-muted-foreground">
            Aprenda a utilizar todas as funcionalidades do sistema passo a passo.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar funcionalidade..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <Card className="md:col-span-4 lg:col-span-3">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-1">
                {filteredTutorials.map((tutorial) => {
                  const Icon = tutorial.icon;
                  return (
                    <button
                      key={tutorial.id}
                      onClick={() => setActiveTutorial(tutorial)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                        activeTutorial.id === tutorial.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", activeTutorial.id === tutorial.id ? "text-primary-foreground" : "text-primary")} />
                      {tutorial.label}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Content Area */}
        <Card className="md:col-span-8 lg:col-span-9">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <activeTutorial.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{activeTutorial.label}</CardTitle>
                  <CardDescription>{activeTutorial.description}</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {activeTutorial.image && (
                <div className="relative rounded-xl overflow-hidden border shadow-sm group">
                  <img 
                    src={activeTutorial.image} 
                    alt={activeTutorial.label}
                    className="w-full h-auto object-cover max-h-[400px] transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              )}

              <div className="grid gap-4">
                {activeTutorial.steps.map((step, index) => (
                  <div key={index} className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{step.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50">
                <div className="flex gap-3">
                  <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300">Dica Pro</h4>
                    <p className="text-sm text-blue-800/80 dark:text-blue-400/80">
                      Você pode acessar rapidamente esta funcionalidade clicando no menu <strong>{activeTutorial.label}</strong> na barra lateral esquerda.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
