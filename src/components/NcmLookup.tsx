import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

// Tabela NCM abrangente para comércio varejista
const NCM_TABLE: { code: string; desc: string }[] = [
  // Alimentos
  { code: "0401.40.10", desc: "Creme de leite" },
  { code: "0402.10.10", desc: "Leite em pó desnatado" },
  { code: "0402.21.10", desc: "Leite em pó integral" },
  { code: "0402.99.00", desc: "Leite condensado" },
  { code: "0405.10.00", desc: "Manteiga" },
  { code: "0409.00.00", desc: "Mel natural" },
  { code: "0713.33.19", desc: "Feijão" },
  { code: "0801.19.00", desc: "Coco ralado / coco seco" },
  { code: "0901.21.00", desc: "Café torrado não descafeinado" },
  { code: "1001.99.00", desc: "Trigo" },
  { code: "1006.30.21", desc: "Arroz beneficiado" },
  { code: "1101.00.10", desc: "Farinha de trigo" },
  { code: "1104.12.00", desc: "Aveia em flocos" },
  { code: "1108.12.00", desc: "Amido de milho (maisena)" },
  { code: "1108.14.00", desc: "Polvilho / fécula de mandioca" },
  { code: "1507.90.11", desc: "Óleo de soja" },
  { code: "1517.10.00", desc: "Margarina" },
  { code: "1701.14.00", desc: "Açúcar de cana bruto" },
  { code: "1701.99.00", desc: "Açúcar refinado / cristal / de confeiteiro" },
  { code: "1704.10.00", desc: "Goma de mascar (chiclete)" },
  { code: "1704.90.10", desc: "Chocolate branco" },
  { code: "1704.90.20", desc: "Balas, caramelos e pastilhas" },
  { code: "1704.90.90", desc: "Balas, doces, confeitos açucarados, marshmallow" },
  { code: "1806.20.00", desc: "Cobertura de chocolate, recheio de chocolate" },
  { code: "1806.31.10", desc: "Chocolate recheado em tablete" },
  { code: "1806.31.20", desc: "Chocolate em tablete" },
  { code: "1806.32.10", desc: "Chocolate em barra recheado" },
  { code: "1806.32.20", desc: "Chocolate em barra" },
  { code: "1806.90.00", desc: "Chocolates diversos, bombons, achocolatados" },
  { code: "1901.20.00", desc: "Misturas para bolo, pão" },
  { code: "1901.90.20", desc: "Chantilly, creme chantilly" },
  { code: "1901.90.90", desc: "Preparações alimentícias diversas" },
  { code: "1902.11.00", desc: "Macarrão, massas alimentícias" },
  { code: "1904.10.00", desc: "Cereais expandidos (cereal matinal)" },
  { code: "1904.20.00", desc: "Barra de cereal, granola" },
  { code: "1905.20.00", desc: "Pão de gengibre / pão de mel" },
  { code: "1905.31.00", desc: "Biscoito doce / bolacha doce / wafer" },
  { code: "1905.32.00", desc: "Wafer recheado" },
  { code: "1905.40.00", desc: "Torrada, pão torrado" },
  { code: "1905.90.10", desc: "Panetone" },
  { code: "1905.90.90", desc: "Pão, bolo, pastel, outros produtos de padaria" },
  { code: "2005.20.00", desc: "Batata frita / chips / snacks de batata" },
  { code: "2006.00.00", desc: "Frutas cristalizadas" },
  { code: "2007.99.90", desc: "Geleias, compotas" },
  { code: "2008.70.00", desc: "Ameixa em calda" },
  { code: "2008.99.00", desc: "Frutas em calda" },
  { code: "2009.89.00", desc: "Suco de fruta" },
  { code: "2101.11.10", desc: "Café solúvel" },
  { code: "2103.10.10", desc: "Molho de soja (shoyu)" },
  { code: "2103.20.10", desc: "Ketchup" },
  { code: "2103.30.21", desc: "Mostarda" },
  { code: "2103.90.11", desc: "Maionese" },
  { code: "2103.90.91", desc: "Molhos e condimentos diversos" },
  { code: "2104.10.11", desc: "Caldo em cubos / temperos em pó" },
  { code: "2106.90.10", desc: "Xarope, concentrado para bebida" },
  { code: "2106.90.29", desc: "Preparações alimentícias diversas (corante alimentar, gelatina em pó, essência)" },

  // Bebidas
  { code: "2201.10.00", desc: "Água mineral natural" },
  { code: "2202.10.00", desc: "Refrigerante, água gaseificada com sabor" },
  { code: "2202.99.00", desc: "Bebidas não alcoólicas diversas (energético, isotônico)" },
  { code: "2203.00.00", desc: "Cerveja de malte" },
  { code: "2204.21.00", desc: "Vinho" },
  { code: "2207.20.19", desc: "Álcool etílico (álcool gel)" },
  { code: "2208.20.00", desc: "Aguardente de vinho (conhaque, brandy)" },
  { code: "2208.30.20", desc: "Whisky" },
  { code: "2208.40.00", desc: "Rum" },
  { code: "2208.50.00", desc: "Gin" },
  { code: "2208.60.00", desc: "Vodka" },
  { code: "2208.70.00", desc: "Licor, aperitivo" },
  { code: "2208.90.00", desc: "Cachaça, aguardente" },

  // Produtos químicos / limpeza
  { code: "3204.90.00", desc: "Corantes sintéticos industriais" },
  { code: "3302.10.90", desc: "Essências e aromatizantes alimentícios" },
  { code: "3304.99.10", desc: "Cosméticos para pele" },
  { code: "3306.10.00", desc: "Creme dental" },
  { code: "3307.90.00", desc: "Produtos perfumaria diversos" },
  { code: "3401.11.90", desc: "Sabonete" },
  { code: "3401.20.10", desc: "Sabão em barra" },
  { code: "3402.20.00", desc: "Detergente líquido" },
  { code: "3402.90.00", desc: "Produtos de limpeza diversos" },
  { code: "3406.00.00", desc: "Velas (decorativas, aniversário, etc)" },
  { code: "3506.10.00", desc: "Cola, adesivo, cola quente" },
  { code: "3604.10.00", desc: "Fogos de artifício" },

  // Plásticos
  { code: "3917.32.90", desc: "Canudo plástico, tubo plástico flexível" },
  { code: "3919.90.00", desc: "Fita adesiva, fita crepe, fita dupla face" },
  { code: "3920.49.00", desc: "Folha de acetato, filme plástico rígido" },
  { code: "3923.10.90", desc: "Caixa plástica, embalagem plástica rígida" },
  { code: "3923.21.90", desc: "Saco plástico de polietileno" },
  { code: "3923.29.90", desc: "Saco plástico, sacola plástica" },
  { code: "3923.30.00", desc: "Garrafão, garrafa plástica" },
  { code: "3923.50.00", desc: "Tampa plástica, rolha plástica" },
  { code: "3924.10.00", desc: "Copo plástico, prato plástico, forma plástica, taça plástica" },
  { code: "3924.90.00", desc: "Utensílio plástico (espátula, balde, baleiro, tubete)" },
  { code: "3926.20.00", desc: "Luva plástica, avental plástico" },
  { code: "3926.90.90", desc: "Artigo plástico diverso (cachepô plástico, cesto plástico)" },

  // Borracha
  { code: "4014.90.90", desc: "Bico de mamadeira, chupeta" },
  { code: "4016.99.90", desc: "Artigos de borracha diversos" },

  // Papel e papelão
  { code: "4802.56.99", desc: "Papel sulfite, papel kraft" },
  { code: "4811.90.90", desc: "Papel celofane, papel de seda" },
  { code: "4819.10.00", desc: "Caixa de papelão, embalagem de papel/papelão" },
  { code: "4819.20.00", desc: "Caixa dobrável de papel" },
  { code: "4821.10.00", desc: "Etiqueta adesiva, tag de papel" },
  { code: "4823.69.00", desc: "Forminha de papel, bandeja de papel" },
  { code: "4823.90.00", desc: "Tapetinho de papel, cake board, suporte de papel" },

  // Têxteis
  { code: "5607.49.00", desc: "Barbante, cordão" },
  { code: "5806.32.00", desc: "Fita de cetim, fita decorativa" },
  { code: "6217.10.00", desc: "Toalha de mesa descartável TNT" },
  { code: "6301.40.00", desc: "Cobertor, manta de fibra sintética" },
  { code: "6302.10.00", desc: "Roupa de cama, lençol, fronha" },
  { code: "6302.60.00", desc: "Toalha de banho, toalha de rosto (algodão)" },
  { code: "6303.12.00", desc: "Cortina de fibra sintética" },
  { code: "6304.19.00", desc: "Colcha, cobre-leito" },
  { code: "6304.92.00", desc: "Almofada decorativa (não de malha)" },
  { code: "6307.90.90", desc: "Avental descartável, pano descartável" },

  // Tapetes e carpetes
  { code: "5702.42.00", desc: "Tapete de fibra sintética (não tufado)" },
  { code: "5703.30.00", desc: "Tapete tufado de fibra sintética" },
  { code: "5705.00.00", desc: "Tapete e revestimento de piso diversos" },

  // Flores artificiais
  { code: "6702.90.00", desc: "Flor artificial, arranjo artificial" },

  // Vidro / cerâmica / louça
  { code: "6911.10.10", desc: "Louça de porcelana (prato, xícara, tigela)" },
  { code: "6911.10.90", desc: "Artigos de porcelana para mesa e cozinha" },
  { code: "6912.00.00", desc: "Louça de cerâmica (prato, caneca, vaso cerâmico)" },
  { code: "6913.10.00", desc: "Estatueta, objeto decorativo de porcelana" },
  { code: "6913.90.00", desc: "Estatueta, objeto decorativo de cerâmica" },
  { code: "6914.90.00", desc: "Artigos de cerâmica diversos (vaso, cachepô)" },
  { code: "7013.22.00", desc: "Copo de cristal de chumbo" },
  { code: "7013.28.00", desc: "Copo de vidro (copos, taças)" },
  { code: "7013.37.00", desc: "Travessa de vidro, tigela de vidro" },
  { code: "7013.49.00", desc: "Artigos de vidro para mesa (jarra, garrafa decorativa)" },
  { code: "7013.99.00", desc: "Artigos de vidro diversos (vaso de vidro, centro de mesa)" },
  { code: "7018.90.00", desc: "Pérolas de vidro, contas de vidro decorativas" },

  // Alumínio / metal
  { code: "7217.90.00", desc: "Arame revestido" },
  { code: "7323.93.00", desc: "Utensílio inox (bico confeiteiro, espátula inox)" },
  { code: "7323.99.00", desc: "Artigos de ferro/aço para mesa e cozinha" },
  { code: "7326.90.90", desc: "Artigos de ferro/aço diversos (suporte, mão francesa, gancho)" },
  { code: "7418.19.00", desc: "Artigos de cobre para mesa e cozinha" },
  { code: "7607.19.90", desc: "Folha de alumínio, papel alumínio" },
  { code: "7615.10.00", desc: "Assadeira de alumínio, forma de alumínio" },
  { code: "7615.20.00", desc: "Artigos de higiene/sanitário de alumínio" },
  { code: "7616.99.00", desc: "Artigos de alumínio diversos (moldura, suporte)" },
  { code: "8302.10.00", desc: "Dobradiça, ferragem para móveis" },
  { code: "8302.42.00", desc: "Guarnição, ferragem para móveis" },
  { code: "8301.30.00", desc: "Fechadura para móveis" },
  { code: "8302.50.00", desc: "Cabide, porta-chapéu, suporte de metal" },
  { code: "8306.21.00", desc: "Estatueta de metal (bronze, latão, zamac)" },
  { code: "8306.29.00", desc: "Artigos decorativos de metal (porta-retrato, escultura)" },

  // Equipamentos
  { code: "8213.00.00", desc: "Tesoura" },
  { code: "8423.10.00", desc: "Balança digital de cozinha" },
  { code: "8516.79.90", desc: "Máquina de algodão doce, máquina de crepe" },

  // Luminárias e iluminação
  { code: "8539.50.00", desc: "Lâmpada LED" },
  { code: "9405.10.99", desc: "Lustre, luminária de teto, pendente" },
  { code: "9405.20.00", desc: "Luminária de mesa, abajur" },
  { code: "9405.30.00", desc: "Luminária de Natal, luzes decorativas, cordão de LED" },
  { code: "9405.40.90", desc: "Luminária, arandela, plafon" },
  { code: "9405.50.00", desc: "Luminária e candeeiro não elétrico (vela decorativa, lanterna)" },
  { code: "9405.99.00", desc: "Partes de luminária (cúpula, base)" },

  // === MÓVEIS ===
  { code: "9401.20.00", desc: "Assento/cadeira para veículos" },
  { code: "9401.30.90", desc: "Cadeira giratória, cadeira de escritório" },
  { code: "9401.40.00", desc: "Assento conversível em cama (sofá-cama)" },
  { code: "9401.41.00", desc: "Assento de bambu ou vime" },
  { code: "9401.49.00", desc: "Assento com armação de madeira, poltrona" },
  { code: "9401.51.00", desc: "Assento de bambu ou vime" },
  { code: "9401.59.00", desc: "Assento de vime, poltrona de vime" },
  { code: "9401.61.00", desc: "Assento estofado com armação de madeira" },
  { code: "9401.69.00", desc: "Cadeira de madeira (não estofada)" },
  { code: "9401.71.00", desc: "Assento estofado com armação de metal" },
  { code: "9401.79.00", desc: "Cadeira de metal (não estofada), banqueta de metal" },
  { code: "9401.80.00", desc: "Assento/cadeira de outros materiais (plástico)" },
  { code: "9401.90.90", desc: "Partes de assentos (encosto, base, braço)" },
  { code: "9403.10.00", desc: "Móvel de metal para escritório (arquivo, armário de aço)" },
  { code: "9403.20.00", desc: "Móvel de metal diversos (estante de aço, rack metálico)" },
  { code: "9403.30.00", desc: "Móvel de madeira para escritório (mesa de escritório, escrivaninha)" },
  { code: "9403.40.00", desc: "Móvel de madeira para cozinha (armário de cozinha, balcão)" },
  { code: "9403.50.00", desc: "Móvel de madeira para quarto (cama, guarda-roupa, cômoda, criado-mudo)" },
  { code: "9403.60.00", desc: "Móvel de madeira diversos (estante, rack, aparador, buffet, mesa de jantar, mesa de centro, sapateira, cristaleira)" },
  { code: "9403.70.00", desc: "Móvel de plástico (mesa plástica, estante plástica)" },
  { code: "9403.82.00", desc: "Móvel de bambu" },
  { code: "9403.83.00", desc: "Móvel de vime" },
  { code: "9403.89.00", desc: "Móvel de outros materiais (MDF, MDP, compensado)" },
  { code: "9403.90.10", desc: "Partes de móvel de madeira (prateleira, gaveta, porta de armário)" },
  { code: "9403.90.90", desc: "Partes de móvel de metal ou outros materiais" },
  { code: "9404.10.00", desc: "Suporte elástico para cama (estrado)" },
  { code: "9404.21.00", desc: "Colchão de borracha ou plástico celular" },
  { code: "9404.29.00", desc: "Colchão de mola, colchão de espuma" },
  { code: "9404.30.00", desc: "Saco de dormir" },
  { code: "9404.90.00", desc: "Almofada, travesseiro, edredom, protetor de colchão" },

  // Espelhos e molduras
  { code: "7009.92.00", desc: "Espelho emoldurado, espelho decorativo" },
  { code: "4414.00.00", desc: "Moldura de madeira para quadro ou espelho" },

  // Objetos de decoração / artigos de interiores
  { code: "4420.10.00", desc: "Estatueta de madeira, objeto decorativo de madeira" },
  { code: "4420.90.00", desc: "Artigos de madeira para decoração (bandeja, caixa decorativa)" },
  { code: "4421.99.00", desc: "Artigos de madeira diversos (cabideiro, prateleira solta)" },
  { code: "4602.19.00", desc: "Cestaria, cesto de vime, cesto de palha, cesto decorativo" },
  { code: "6802.99.90", desc: "Pedra trabalhada decorativa (mármore, granito polido)" },
  { code: "4601.29.00", desc: "Esteira de fibra vegetal, jogo americano de palha" },

  // Quadros e arte
  { code: "4911.91.00", desc: "Gravura, estampa, fotografia impressa (quadro, poster, pôster)" },
  { code: "9701.10.00", desc: "Pintura, quadro, tela pintada à mão" },
  { code: "9701.90.00", desc: "Colagem, painel decorativo artístico" },

  // Relógios
  { code: "9105.11.00", desc: "Relógio de parede, relógio despertador (elétrico)" },
  { code: "9105.19.00", desc: "Relógio de parede (não elétrico)" },
  { code: "9105.21.00", desc: "Relógio de mesa, relógio decorativo" },

  // Brinquedos e festas
  { code: "9503.00.10", desc: "Brinquedo de plástico" },
  { code: "9503.00.21", desc: "Pelúcia, urso de pelúcia" },
  { code: "9504.40.00", desc: "Baralho, jogos de cartas" },
  { code: "9505.10.00", desc: "Artigos de Natal (árvore, festão, enfeite natalino)" },
  { code: "9505.90.00", desc: "Artigos de festa (decoração, fantasia, máscara, topo de bolo, balão)" },

  // Papelaria
  { code: "9603.30.00", desc: "Pincel artístico, pincel de confeitaria" },
  { code: "9608.10.00", desc: "Caneta, lápis, apontador" },

  // Utilidades domésticas
  { code: "4419.19.00", desc: "Tábua de corte de madeira, utensílio de cozinha de madeira" },
  { code: "6911.90.00", desc: "Artigos de porcelana para uso doméstico (saboneteira, porta-escova)" },
  { code: "7324.90.00", desc: "Artigos de higiene de aço inox (lixeira, porta-papel)" },
  { code: "7418.20.00", desc: "Artigos de higiene de cobre/latão (saboneteira, porta-toalha)" },
  { code: "8215.20.00", desc: "Conjunto de talheres (garfo, faca, colher)" },
  { code: "8215.99.10", desc: "Talheres avulsos (colher de servir, espátula de cozinha)" },
  { code: "6910.10.00", desc: "Pia, lavatório, banheira de porcelana/cerâmica" },
];

interface NcmLookupProps {
  value: string;
  onChange: (ncm: string) => void;
}

export default function NcmLookup({ value, onChange }: NcmLookupProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return NCM_TABLE;
    const terms = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/);
    return NCM_TABLE.filter(item => {
      const text = `${item.code} ${item.desc}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return terms.every(t => text.includes(t));
    });
  }, [search]);

  return (
    <>
      <div className="flex gap-1">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0000.00.00"
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" className="flex-shrink-0" onClick={() => { setSearch(""); setOpen(true); }} title="Pesquisar NCM">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pesquisar NCM</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Busque por código ou descrição... ex: biscoito, copo, chocolate"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <ScrollArea className="flex-1 min-h-0 max-h-[50vh] border rounded-md">
            <div className="divide-y">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum NCM encontrado</p>
              )}
              {filtered.map(item => (
                <button
                  key={item.code}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                  onClick={() => { onChange(item.code); setOpen(false); }}
                >
                  <span className="font-mono text-sm font-semibold text-primary">{item.code}</span>
                  <span className="text-xs text-muted-foreground ml-2">{item.desc}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
          <p className="text-[10px] text-muted-foreground">Tabela simplificada com NCMs mais comuns do varejo. Confirme com seu contador.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
