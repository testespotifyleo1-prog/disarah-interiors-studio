import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Pencil, Trash2, Loader2, Tag, Upload, Image as ImageIcon, Sparkles, Wand2,
  ChevronDown, ChevronRight, Zap, Merge,
} from 'lucide-react';
import { findDuplicateGroups } from '@/utils/categoryNormalizer';
import BulkActionsModal from '@/components/categories/BulkActionsModal';

interface Subcat { name: string; productCount: number; }
interface CategoryInfo {
  name: string;
  productCount: number;
  imageUrl?: string;
  subcategories: Subcat[];
}

export default function Categories() {
  const { currentAccount, canEdit } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [normalizing, setNormalizing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formImage, setFormImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<CategoryInfo | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  useEffect(() => {
    if (currentAccount) loadCategories();
  }, [currentAccount]);

  const loadCategories = async () => {
    if (!currentAccount) return;
    setLoading(true);

    let allProducts: { category: string | null; subcategory: string | null }[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from('products')
        .select('category, subcategory')
        .eq('account_id', currentAccount.id)
        .eq('is_active', true)
        .not('category', 'is', null)
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      allProducts = allProducts.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Group: category → { count, subcategories: { subcat → count } }
    const map = new Map<string, { count: number; subs: Map<string, number> }>();
    for (const p of allProducts) {
      const cat = p.category!;
      if (!map.has(cat)) map.set(cat, { count: 0, subs: new Map() });
      const entry = map.get(cat)!;
      entry.count++;
      if (p.subcategory) {
        entry.subs.set(p.subcategory, (entry.subs.get(p.subcategory) || 0) + 1);
      }
    }

    // Load images from ecommerce settings
    const { data: ecomData } = await supabase
      .from('store_ecommerce_settings')
      .select('categories')
      .eq('account_id', currentAccount.id)
      .limit(1)
      .maybeSingle();
    const storedCats: { name: string; icon_url?: string }[] = Array.isArray(ecomData?.categories) ? ecomData.categories as any : [];
    const imageMap: Record<string, string> = {};
    storedCats.forEach(c => { if (c.icon_url) imageMap[c.name] = c.icon_url; });

    // Ensure stored categories without products still appear
    storedCats.forEach(c => {
      if (c.name && !map.has(c.name)) {
        map.set(c.name, { count: 0, subs: new Map() });
      }
    });

    const result: CategoryInfo[] = Array.from(map.entries())
      .map(([name, { count, subs }]) => ({
        name,
        productCount: count,
        imageUrl: imageMap[name],
        subcategories: Array.from(subs.entries())
          .map(([n, c]) => ({ name: n, productCount: c }))
          .sort((a, b) => b.productCount - a.productCount),
      }))
      .sort((a, b) => b.productCount - a.productCount);

    setCategories(result);
    setLoading(false);
  };

  const duplicates = useMemo(() => findDuplicateGroups(categories), [categories]);

  const normalizeAll = async () => {
    if (!currentAccount || duplicates.length === 0) return;
    setNormalizing(true);
    try {
      let total = 0;
      for (const group of duplicates) {
        for (const variant of group.variants) {
          if (variant.name === group.canonical) continue;
          const { error } = await supabase
            .from('products')
            .update({ category: group.canonical })
            .eq('account_id', currentAccount.id)
            .eq('category', variant.name);
          if (!error) total += variant.count;
        }
      }
      toast({ title: '✅ Normalização concluída!', description: `${total} produto(s) reorganizados em ${duplicates.length} grupo(s).` });
      loadCategories();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setNormalizing(false);
    }
  };

  const mergeGroup = async (canonical: string, variants: string[]) => {
    if (!currentAccount) return;
    try {
      for (const v of variants) {
        if (v === canonical) continue;
        await supabase.from('products').update({ category: canonical })
          .eq('account_id', currentAccount.id).eq('category', v);
      }
      toast({ title: 'Mesclado!' });
      loadCategories();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const openCreate = () => { setEditingName(null); setFormName(''); setFormImage(''); setShowModal(true); };
  const openEdit = (cat: CategoryInfo) => { setEditingName(cat.name); setFormName(cat.name); setFormImage(cat.imageUrl || ''); setShowModal(true); };

  const handleSave = async () => {
    if (!formName.trim() || !currentAccount) return;
    setSaving(true);
    try {
      if (editingName && editingName !== formName.trim()) {
        const { error } = await supabase.from('products').update({ category: formName.trim() })
          .eq('account_id', currentAccount.id).eq('category', editingName);
        if (error) throw error;
      }
      await saveCategoryImage(formName.trim(), formImage);
      toast({ title: editingName ? 'Categoria atualizada!' : 'Categoria criada!' });
      setShowModal(false);
      loadCategories();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const saveCategoryImage = async (catName: string, imageUrl: string) => {
    if (!currentAccount) return;
    const { data: ecomData } = await supabase.from('store_ecommerce_settings')
      .select('id, categories').eq('account_id', currentAccount.id).limit(1).maybeSingle();
    const cats: any[] = Array.isArray(ecomData?.categories) ? [...(ecomData!.categories as any)] : [];
    const idx = cats.findIndex((c: any) => c.name === catName || (editingName && c.name === editingName));
    if (idx >= 0) cats[idx] = { ...cats[idx], name: catName, icon_url: imageUrl || undefined };
    else cats.push({ id: catName, name: catName, icon_url: imageUrl || undefined });
    if (ecomData?.id) {
      await supabase.from('store_ecommerce_settings').update({ categories: cats }).eq('id', ecomData.id);
      return;
    }
    // Need a store + slug to create the row
    const { data: store } = await supabase.from('stores')
      .select('id, name').eq('account_id', currentAccount.id).eq('is_active', true).limit(1).maybeSingle();
    if (!store) return;
    const baseSlug = (store.name || 'loja').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'loja';
    const slug = `${baseSlug}-${currentAccount.id.slice(0, 6)}`;
    await supabase.from('store_ecommerce_settings').insert([{
      account_id: currentAccount.id,
      store_id: store.id,
      slug,
      categories: cats,
    }]);
  };

  const handleDelete = async () => {
    if (!deletingName || !currentAccount) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('products').update({ category: null })
        .eq('account_id', currentAccount.id).eq('category', deletingName);
      if (error) throw error;
      toast({ title: 'Categoria removida dos produtos!' });
      setDeletingName(null);
      loadCategories();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!currentAccount) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${currentAccount.id}/categories/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('store-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('store-assets').getPublicUrl(path);
      setFormImage(urlData.publicUrl);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: err.message });
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const allCategoryNames = categories.map(c => c.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-sm text-muted-foreground">Organize, normalize e aplique ações em massa</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {duplicates.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowDuplicates(true)}>
              <Merge className="mr-1 h-4 w-4" />
              {duplicates.length} duplicata(s)
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> Nova
            </Button>
          )}
        </div>
      </div>

      {duplicates.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <span><strong>{duplicates.length}</strong> grupo(s) com nomes parecidos detectados.</span>
            </div>
            <Button size="sm" variant="default" onClick={normalizeAll} disabled={normalizing}>
              {normalizing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
              Normalizar tudo
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categorias ({categories.length})
          </CardTitle>
          <CardDescription>
            Clique no <ChevronRight className="inline h-3 w-3" /> para ver subcategorias. Use <Zap className="inline h-3 w-3" /> para ações em massa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma categoria encontrada.</div>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => {
                const isOpen = expanded.has(cat.name);
                return (
                  <div key={cat.name} className="border rounded-lg">
                    <div className="flex items-center gap-3 p-3">
                      {cat.subcategories.length > 0 ? (
                        <button onClick={() => toggleExpand(cat.name)} className="text-muted-foreground hover:text-foreground">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : <div className="w-4" />}
                      {cat.imageUrl ? (
                        <img src={cat.imageUrl} alt={cat.name} className="h-10 w-10 rounded-lg object-cover border flex-shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{cat.name}</p>
                          <Badge variant="secondary" className="text-xs">{cat.productCount}</Badge>
                          {cat.subcategories.length > 0 && (
                            <Badge variant="outline" className="text-xs">{cat.subcategories.length} sub</Badge>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="default" size="sm" className="h-8" onClick={() => setBulkCategory(cat)}>
                            <Zap className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Ações</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingName(cat.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {isOpen && cat.subcategories.length > 0 && (
                      <div className="border-t bg-muted/30 px-3 py-2">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {cat.subcategories.map(sub => (
                            <div key={sub.name} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-background border">
                              <span className="truncate">{sub.name}</span>
                              <Badge variant="secondary" className="text-xs ml-2">{sub.productCount}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingName ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              {editingName ? 'Renomeie ou altere a imagem.' : 'Crie uma nova categoria.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Sofás" />
            </div>
            <div className="space-y-2">
              <Label>Imagem</Label>
              <div className="flex items-center gap-3">
                {formImage ? (
                  <img src={formImage} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <Button variant="outline" size="sm" className="relative" disabled={uploadingImage}>
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    Upload
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                  </Button>
                  <Input placeholder="Ou cole URL" value={formImage} onChange={e => setFormImage(e.target.value)} className="h-8 text-xs mt-1" />
                  {formImage && (
                    <Button variant="ghost" size="sm" className="text-destructive text-xs p-0 h-auto" onClick={() => setFormImage('')}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingName} onOpenChange={open => !open && setDeletingName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Remover "{deletingName}"? Os produtos ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicates review */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar duplicatas</DialogTitle>
            <DialogDescription>Escolha qual nome manter em cada grupo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {duplicates.map((g, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="text-xs text-muted-foreground">{g.totalProducts} produto(s) no total</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.variants.map(v => (
                    <Badge key={v.name} variant={v.name === g.canonical ? 'default' : 'outline'} className="text-xs">
                      {v.name} ({v.count})
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    defaultValue={g.canonical}
                    id={`canon-${i}`}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={() => {
                    const input = document.getElementById(`canon-${i}`) as HTMLInputElement;
                    mergeGroup(input.value || g.canonical, g.variants.map(v => v.name));
                  }}>
                    Mesclar
                  </Button>
                </div>
              </div>
            ))}
            {duplicates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem duplicatas! 🎉</p>}
          </div>
        </DialogContent>
      </Dialog>

      {bulkCategory && (
        <BulkActionsModal
          open={!!bulkCategory}
          onClose={() => setBulkCategory(null)}
          category={bulkCategory.name}
          productCount={bulkCategory.productCount}
          allCategories={allCategoryNames}
          onDone={loadCategories}
        />
      )}
    </div>
  );
}
