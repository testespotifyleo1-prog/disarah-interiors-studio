import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Pencil, AlertTriangle, Loader2, Plus, Package, ArrowRightLeft, Store as StoreIcon, ChevronsUpDown, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryWithProduct, Product, Store } from '@/types/database';
import SmartPagination from '@/components/SmartPagination';

/* ── Searchable Product Combobox ── */
interface ProductComboboxProps {
  products: { id: string; name: string; sku?: string | null; extra?: string }[];
  value: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function ProductCombobox({ products, value, onSelect, placeholder = 'Buscar produto...', disabled }: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = products.find(p => p.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50);
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [products, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal h-10 text-sm"
        >
          <span className="truncate">
            {selected ? `${selected.name}${selected.sku ? ` (${selected.sku})` : ''}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {filtered.map(p => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => { onSelect(p.id); setOpen(false); setSearch(''); }}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.sku || 'Sem SKU'}{p.extra ? ` — ${p.extra}` : ''}
                    </span>
                  </div>
                  <Check className={cn("ml-2 h-4 w-4 shrink-0", value === p.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface StoreInventoryMap {
  [storeId: string]: { qty_on_hand: number; min_qty: number; id?: string };
}

interface UnifiedProduct {
  product: Product;
  stores: StoreInventoryMap;
  totalQty: number;
}

export default function Inventory() {
  const { user, currentAccount, stores, canEdit } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allInventory, setAllInventory] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('unified');
  const [invPage, setInvPage] = useState(1);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editStoreId, setEditStoreId] = useState('');
  const [editQty, setEditQty] = useState(0);
  const [editMinQty, setEditMinQty] = useState(0);
  const [editExpDate, setEditExpDate] = useState('');
  const [editInventoryId, setEditInventoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add product modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addStoreId, setAddStoreId] = useState('');
  const [newQty, setNewQty] = useState(0);
  const [newMinQty, setNewMinQty] = useState(0);


  useEffect(() => {
    if (currentAccount && stores.length > 0) {
      loadAll();
    }
  }, [currentAccount, stores]);

  const loadAll = async () => {
    if (!currentAccount) return;
    setLoading(true);

    const storeIds = stores.map(s => s.id);

    // Load ALL inventory rows (bypass 1000 row limit)
    const loadAllInventory = async () => {
      const allRows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from('inventory')
          .select('*, products(name, sku, unit, price_default)')
          .in('store_id', storeIds)
          .range(from, from + pageSize - 1)
          .order('updated_at', { ascending: false });
        if (data && data.length > 0) {
          allRows.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      return allRows;
    };

    // Load ALL products (bypass 1000 row limit)
    const loadAllProducts = async () => {
      const allRows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('account_id', currentAccount!.id)
          .eq('is_active', true)
          .range(from, from + pageSize - 1)
          .order('name');
        if (data && data.length > 0) {
          allRows.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      return allRows;
    };

    const [invData, prodData] = await Promise.all([
      loadAllInventory(),
      loadAllProducts(),
    ]);

    setAllInventory(invData);
    setProducts(prodData);
    setLoading(false);
  };

  // Build unified view: product → { storeId: qty }
  const unifiedProducts: UnifiedProduct[] = products.map(product => {
    const storeMap: StoreInventoryMap = {};
    let totalQty = 0;
    stores.forEach(store => {
      const inv = allInventory.find(i => i.product_id === product.id && i.store_id === store.id);
      if (inv) {
        storeMap[store.id] = { qty_on_hand: inv.qty_on_hand, min_qty: inv.min_qty, id: inv.id };
        totalQty += inv.qty_on_hand;
      } else {
        storeMap[store.id] = { qty_on_hand: 0, min_qty: 0 };
      }
    });
    return { product, stores: storeMap, totalQty };
  });

  const filteredUnified = unifiedProducts.filter(up => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return up.product.name.toLowerCase().includes(q) || up.product.sku?.toLowerCase().includes(q);
  });

  // Only show products that have inventory somewhere
  const productsWithInventory = filteredUnified.filter(up =>
    up.totalQty > 0 || Object.values(up.stores).some(s => s.id)
  );

  const allFiltered = searchQuery.trim() ? filteredUnified : productsWithInventory.length > 0 ? productsWithInventory : filteredUnified;

  const INV_PAGE_SIZE = 50;
  const invTotalPages = Math.max(1, Math.ceil(allFiltered.length / INV_PAGE_SIZE));
  const invSafePage = Math.min(invPage, invTotalPages);
  const paginatedFiltered = allFiltered.slice((invSafePage - 1) * INV_PAGE_SIZE, invSafePage * INV_PAGE_SIZE);

  // Reset page on search or tab change
  useEffect(() => { setInvPage(1); }, [searchQuery, activeTab]);

  const lowStockCount = allInventory.filter(i => i.min_qty > 0 && i.qty_on_hand <= i.min_qty).length;
  const totalItems = Math.round(allInventory.reduce((s, i) => s + Number(i.qty_on_hand || 0), 0));

  const openEditModal = (product: Product, storeId: string) => {
    const inv = allInventory.find(i => i.product_id === product.id && i.store_id === storeId);
    setEditProduct(product);
    setEditStoreId(storeId);
    setEditQty(inv?.qty_on_hand || 0);
    setEditMinQty(inv?.min_qty || 0);
    setEditExpDate(inv?.expiration_date || '');
    setEditInventoryId(inv?.id || null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editProduct) return;
    setSaving(true);
    try {
      if (editInventoryId) {
        const { error } = await supabase.from('inventory').update({
          qty_on_hand: editQty, min_qty: editMinQty, expiration_date: editExpDate || null, updated_at: new Date().toISOString(),
        }).eq('id', editInventoryId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory').insert({
          store_id: editStoreId, product_id: editProduct.id,
          qty_on_hand: editQty, min_qty: editMinQty, expiration_date: editExpDate || null,
        });
        if (error) throw error;
      }
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'update', entityType: 'inventory', details: { produto: editProduct.name, quantidade: editQty } });
      toast({ title: 'Estoque atualizado!' });
      setShowEditModal(false);
      loadAll();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };

  const handleAddProduct = async () => {
    if (!selectedProductId || !addStoreId) {
      toast({ variant: 'destructive', title: 'Selecione produto e loja' });
      return;
    }
    const exists = allInventory.find(i => i.product_id === selectedProductId && i.store_id === addStoreId);
    if (exists) {
      toast({ variant: 'destructive', title: 'Produto já existe no estoque desta loja' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('inventory').insert({
        store_id: addStoreId, product_id: selectedProductId,
        qty_on_hand: newQty, min_qty: newMinQty,
      });
      if (error) throw error;
      await logActivity({ accountId: currentAccount!.id, userId: user!.id, userName: user!.email, action: 'create', entityType: 'inventory', details: { produto_id: selectedProductId, loja_id: addStoreId, quantidade: newQty } });
      toast({ title: 'Produto adicionado ao estoque!' });
      setShowAddModal(false);
      loadAll();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSaving(false); }
  };


  const storeName = (id: string) => stores.find(s => s.id === id)?.name || 'Loja';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Estoque Unificado</h1>
          <p className="text-sm text-muted-foreground">
            {stores.length} loja{stores.length !== 1 ? 's' : ''} ativa{stores.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setShowAddModal(true); setSelectedProductId(''); setAddStoreId(''); setNewQty(0); setNewMinQty(0); }}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/app/transfers/new')}>
              <ArrowRightLeft className="mr-1 h-4 w-4" /> Transferir
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Lojas</CardTitle>
            <StoreIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stores.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalItems.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-destructive">{lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full overflow-x-auto flex-nowrap">
            <TabsTrigger value="unified" className="flex-shrink-0">Visão Geral</TabsTrigger>
            {stores.map(store => (
              <TabsTrigger key={store.id} value={store.id} className="flex-shrink-0">
                {store.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Unified View */}
          <TabsContent value="unified">
            <div className="space-y-2">
              {allFiltered.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum produto encontrado</p>
                </CardContent></Card>
              ) : (
                paginatedFiltered.map(up => (
                  <Card key={up.product.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm sm:text-base">{up.product.name}</p>
                            {up.product.sku && <p className="text-xs text-muted-foreground">SKU: {up.product.sku}</p>}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Total: {up.totalQty} {up.product.unit}
                          </Badge>
                        </div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(stores.length, 3)}, 1fr)` }}>
                          {stores.map(store => {
                            const inv = up.stores[store.id];
                            const isLow = inv.id && inv.qty_on_hand <= inv.min_qty;
                            return (
                              <div
                                key={store.id}
                                className={`rounded-md border p-2 text-center cursor-pointer hover:bg-accent transition-colors ${isLow ? 'border-destructive/50 bg-destructive/5' : ''}`}
                                onClick={() => canEdit && openEditModal(up.product, store.id)}
                              >
                                <p className="text-xs text-muted-foreground truncate">{store.name}</p>
                                <p className={`text-sm font-bold ${isLow ? 'text-destructive' : ''}`}>
                                  {inv.qty_on_hand} {up.product.unit}
                                </p>
                                {isLow && <AlertTriangle className="h-3 w-3 text-destructive mx-auto mt-1" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              <SmartPagination currentPage={invSafePage} totalPages={invTotalPages} totalItems={allFiltered.length} pageSize={INV_PAGE_SIZE} onPageChange={setInvPage} />
            </div>
          </TabsContent>

          {/* Per-store tabs */}
          {stores.map(store => {
            const storeInv = allInventory
              .filter((i: any) => i.store_id === store.id)
              .filter((i: any) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return i.products?.name?.toLowerCase().includes(q) || i.products?.sku?.toLowerCase().includes(q);
              });
            return (
              <TabsContent key={store.id} value={store.id}>
                <div className="space-y-2">
                  {storeInv.length === 0 ? (
                    <Card><CardContent className="py-8 text-center text-muted-foreground">
                      <p>Nenhum item no estoque de {store.name}</p>
                    </CardContent></Card>
                  ) : (
                    storeInv.map((item: any) => (
                      <Card key={item.id}>
                        <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{item.products?.name}</p>
                            <p className="text-xs text-muted-foreground">{item.products?.sku || '-'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${item.qty_on_hand <= item.min_qty ? 'text-destructive' : ''}`}>
                                {item.qty_on_hand} {item.products?.unit}
                              </p>
                              <p className="text-xs text-muted-foreground">mín: {item.min_qty}</p>
                            </div>
                            {item.qty_on_hand <= item.min_qty && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" /> Baixo
                              </Badge>
                            )}
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => {
                                setEditProduct(products.find(p => p.id === item.product_id) || null);
                                setEditStoreId(store.id);
                                setEditQty(item.qty_on_hand);
                                setEditMinQty(item.min_qty);
                                setEditInventoryId(item.id);
                                setShowEditModal(true);
                              }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
            <DialogDescription>
              {editProduct?.name} — {storeName(editStoreId)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantidade em Estoque</Label>
              <Input type="number" value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} min={0} step={0.001} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade Mínima</Label>
              <Input type="number" value={editMinQty} onChange={(e) => setEditMinQty(Number(e.target.value))} min={0} step={0.001} />
            </div>
            <div className="space-y-2">
              <Label>Data de Validade</Label>
              <Input type="date" value={editExpDate} onChange={(e) => setEditExpDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe vazio se não aplicável</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Produto ao Estoque</DialogTitle>
            <DialogDescription>Selecione produto e loja</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto *</Label>
              <ProductCombobox
                products={products.map(p => ({ id: p.id, name: p.name, sku: p.sku }))}
                value={selectedProductId}
                onSelect={setSelectedProductId}
                placeholder="Buscar produto por nome ou SKU..."
              />
            </div>
            <div className="space-y-2">
              <Label>Loja *</Label>
              <Select value={addStoreId} onValueChange={setAddStoreId}>
                <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade Inicial</Label>
                <Input type="number" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} min={0} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade Mínima</Label>
                <Input type="number" value={newMinQty} onChange={(e) => setNewMinQty(Number(e.target.value))} min={0} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAddProduct} disabled={saving || !selectedProductId || !addStoreId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
