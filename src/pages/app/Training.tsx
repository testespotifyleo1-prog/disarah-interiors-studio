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
  steps: TutorialStep[];
}

const tutorials: TutorialMenu[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Visão geral do seu negócio em tempo real.',
    steps: [
      { title: 'Resumo de Vendas', description: 'Veja o faturamento do dia, mês e ticket médio no topo da página.' },
      { title: 'Gráficos de Desempenho', description: 'Acompanhe a evolução das vendas diárias e mensais através dos gráficos interativos.' },
      { title: 'Ranking de Vendedores', description: 'Identifique quais vendedores estão performando melhor no período selecionado.' },
      { title: 'Produtos Mais Vendidos', description: 'Veja a lista dos itens que mais saem para planejar melhor seu estoque.' },
    ]
  },
  {
    id: 'pdv',
    label: 'PDV (Ponto de Venda)',
    icon: ShoppingCart,
    description: 'Realize vendas de forma rápida e eficiente.',
    steps: [
      { title: 'Seleção de Produtos', description: 'Bip o código de barras ou pesquise pelo nome do produto na lateral.' },
      { title: 'Carrinho de Vendas', description: 'Ajuste quantidades e aplique descontos diretamente nos itens do carrinho.' },
      { title: 'Identificação do Cliente', description: 'Vincule a venda a um cliente cadastrado para gerar histórico e pontos.' },
      { title: 'Finalização', description: 'Escolha a forma de pagamento (Dinheiro, Cartão, PIX ou Crediário) e conclua a venda.' },
      { title: 'Emissão de Nota', description: 'Ao finalizar, você pode optar por emitir o cupom fiscal (NFC-e) instantaneamente.' },
    ]
  },
  {
    id: 'products',
    label: 'Produtos & Estoque',
    icon: Package,
    description: 'Gestão completa do seu catálogo e estoque.',
    steps: [
      { title: 'Cadastro de Produtos', description: 'Insira fotos, descrições, preços de custo/venda e fornecedores.' },
      { title: 'Controle de Estoque', description: 'Visualize o saldo atual, estoque mínimo e movimentações de cada item.' },
      { title: 'Categorias', description: 'Organize seus produtos por categorias para facilitar a busca e relatórios.' },
      { title: 'Transferências', description: 'Mova produtos entre lojas de forma documentada e segura.' },
      { title: 'Etiquetas', description: 'Gere e imprima etiquetas com código de barras para seus produtos.' },
    ]
  },
  {
    id: 'customers',
    label: 'Clientes & CRM',
    icon: Users,
    description: 'Gerencie o relacionamento com seus clientes.',
    steps: [
      { title: 'Cadastro de Clientes', description: 'Mantenha dados de contato, endereço e CPF atualizados.' },
      { title: 'Histórico de Compras', description: 'Veja tudo o que o cliente já comprou para oferecer um atendimento personalizado.' },
      { title: 'Crediário', description: 'Gerencie as contas a receber, limites de crédito e parcelas em aberto.' },
      { title: 'Créditos de Loja', description: 'Controle saldos de devoluções que o cliente pode usar como pagamento.' },
    ]
  },
  {
    id: 'commercial',
    label: 'Comercial & Compras',
    icon: ScrollText,
    description: 'Gestão de pedidos, orçamentos e fornecedores.',
    steps: [
      { title: 'Orçamentos', description: 'Crie propostas para clientes e converta-as em vendas com um clique.' },
      { title: 'Fornecedores', description: 'Cadastre seus parceiros de negócio e gerencie os contatos.' },
      { title: 'Pedidos de Compra', description: 'Organize suas reposições de estoque enviando pedidos formais aos fornecedores.' },
      { title: 'Sugestão de Reposição', description: 'O sistema analisa as vendas e sugere o que você precisa comprar.' },
    ]
  },
  {
    id: 'finance',
    label: 'Financeiro',
    icon: DollarSign,
    description: 'Saúde financeira da sua empresa.',
    steps: [
      { title: 'Controle de Caixa', description: 'Acompanhe aberturas, fechamentos e sangrias de todos os caixas.' },
      { title: 'Contas a Pagar/Receber', description: 'Gerencie seus compromissos financeiros e entradas previstas.' },
      { title: 'Comissões', description: 'Cálculo automático de comissões para sua equipe de vendas.' },
      { title: 'Metas', description: 'Defina e acompanhe metas de faturamento para a loja e vendedores.' },
    ]
  },
  {
    id: 'logistics',
    label: 'Logística',
    icon: Truck,
    description: 'Entrega e montagem de produtos.',
    steps: [
      { title: 'Expedição (Picking)', description: 'Prepare os produtos vendidos para entrega ou retirada.' },
      { title: 'Gestão de Entregas', description: 'Roteirize e acompanhe o status das entregas com motoristas.' },
      { title: 'Montagem', description: 'Para lojas de móveis: gerencie a agenda de montadores e status dos serviços.' },
    ]
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    icon: FileText,
    description: 'Emissão de documentos e obrigações fiscais.',
    steps: [
      { title: 'Emissão de NF-e', description: 'Gere notas fiscais de venda, devolução ou remessa.' },
      { title: 'Entrada via XML', description: 'Importe produtos automaticamente ao subir o XML do fornecedor.' },
      { title: 'Painel do Contador', description: 'Exporte todos os documentos do mês de uma vez para sua contabilidade.' },
    ]
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: Settings,
    description: 'Personalize o sistema para sua empresa.',
    steps: [
      { title: 'Dados da Empresa', description: 'Configure CNPJ, endereço e informações que saem nos comprovantes.' },
      { title: 'Gerenciamento de Lojas', description: 'Adicione ou edite as filiais do seu negócio.' },
      { title: 'Personalização do Site', description: 'Altere cores, banners e fotos do seu catálogo online.' },
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
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-full bg-primary/10">
                <activeTutorial.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{activeTutorial.label}</CardTitle>
                <CardDescription>{activeTutorial.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4">
                {activeTutorial.steps.map((step, index) => (
                  <div key={index} className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors">
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
