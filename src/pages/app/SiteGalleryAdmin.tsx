import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Image as ImageIcon, Upload, Pencil, ExternalLink } from 'lucide-react';
import { sitePhotoUrl, uploadSitePhoto, SITE_BUCKET } from '@/utils/sitePhotos';
import { Link } from 'react-router-dom';

export default function SiteGalleryAdmin() {
  const qc = useQueryClient();
  const [selectedCat, setSelectedCat] = useState<any>(null);
  const [catModal, setCatModal] = useState<{ open: boolean; data: any }>({ open: false, data: {} });
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['admin_site_categories'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('site_categories').select('*').order('sort_order');
      return data || [];
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['admin_site_photos', selectedCat?.id],
    enabled: !!selectedCat,
    queryFn: async () => {
      const { data } = await (supabase as any).from('site_photos').select('*').eq('category_id', selectedCat.id).order('sort_order');
      return data || [];
    },
  });

  const reloadCats = () => qc.invalidateQueries({ queryKey: ['admin_site_categories'] });
  const reloadPhotos = () => qc.invalidateQueries({ queryKey: ['admin_site_photos', selectedCat?.id] });

  const saveCat = async () => {
    const d = catModal.data;
    if (!d.name) return toast.error('Informe o nome');
    const slug = (d.slug || d.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const payload = { name: d.name, slug, description: d.description || null, sort_order: d.sort_order ?? 0, is_active: d.is_active !== false };
    const { error } = d.id
      ? await (supabase as any).from('site_categories').update(payload).eq('id', d.id)
      : await (supabase as any).from('site_categories').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Categoria salva');
    setCatModal({ open: false, data: {} });
    reloadCats();
  };

  const delCat = async (id: string) => {
    if (!confirm('Excluir categoria e todas as suas fotos?')) return;
    const { error } = await (supabase as any).from('site_categories').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Categoria removida');
    if (selectedCat?.id === id) setSelectedCat(null);
    reloadCats();
  };

  const uploadCover = async (file: File) => {
    if (!selectedCat) return;
    try {
      const path = await uploadSitePhoto(file, `covers/${selectedCat.slug}`);
      await (supabase as any).from('site_categories').update({ cover_path: path }).eq('id', selectedCat.id);
      toast.success('Capa atualizada');
      reloadCats();
      setSelectedCat({ ...selectedCat, cover_path: path });
    } catch (e: any) { toast.error(e.message); }
  };

  const uploadPhotos = async (files: FileList) => {
    if (!selectedCat) return;
    try {
      for (const file of Array.from(files)) {
        const path = await uploadSitePhoto(file, `gallery/${selectedCat.slug}`);
        await (supabase as any).from('site_photos').insert({ category_id: selectedCat.id, image_path: path });
      }
      toast.success(`${files.length} foto(s) enviada(s)`);
      reloadPhotos();
    } catch (e: any) { toast.error(e.message); }
  };

  const delPhoto = async (p: any) => {
    if (!confirm('Excluir foto?')) return;
    await supabase.storage.from(SITE_BUCKET).remove([p.image_path]);
    await (supabase as any).from('site_photos').delete().eq('id', p.id);
    toast.success('Foto removida');
    reloadPhotos();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Galeria do Site</h1>
          <p className="text-muted-foreground text-sm">Organize suas fotos por categoria.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/site/galeria" target="_blank"><ExternalLink className="h-4 w-4 mr-2" />Ver galeria</Link></Button>
          <Button asChild variant="secondary"><Link to="/app/site/settings">Personalizar Site</Link></Button>
          <Button onClick={() => setCatModal({ open: true, data: {} })}><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Categorias</CardTitle></CardHeader>
          <CardContent className="space-y-1 p-2">
            {categories.map((c: any) => (
              <div key={c.id} className={`group flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${selectedCat?.id === c.id ? 'bg-muted' : ''}`} onClick={() => setSelectedCat(c)}>
                <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">
                  {c.cover_path && <img src={sitePhotoUrl(c.cover_path)} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">/{c.slug}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setCatModal({ open: true, data: c }); }} className="opacity-0 group-hover:opacity-100 p-1"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={(e) => { e.stopPropagation(); delCat(c.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div>
          {!selectedCat ? (
            <Card><CardContent className="py-20 text-center text-muted-foreground"><ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" /><p>Selecione uma categoria para gerenciar suas fotos.</p></CardContent></Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{selectedCat.name}</CardTitle>
                  <div className="flex gap-2">
                    <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                    <Button size="sm" variant="outline" onClick={() => coverRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Trocar Capa</Button>
                    <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && uploadPhotos(e.target.files)} />
                    <Button size="sm" onClick={() => fileRef.current?.click()}><Plus className="h-4 w-4 mr-2" />Adicionar Fotos</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {photos.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">Nenhuma foto. Clique em "Adicionar Fotos".</p>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {photos.map((p: any) => (
                        <div key={p.id} className="group relative aspect-square bg-muted rounded overflow-hidden">
                          <img src={sitePhotoUrl(p.image_path)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => delPhoto(p)} className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 grid place-items-center"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog open={catModal.open} onOpenChange={(o) => setCatModal({ open: o, data: o ? catModal.data : {} })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{catModal.data.id ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={catModal.data.name || ''} onChange={(e) => setCatModal({ ...catModal, data: { ...catModal.data, name: e.target.value } })} /></div>
            <div><Label>Descrição</Label><Textarea value={catModal.data.description || ''} onChange={(e) => setCatModal({ ...catModal, data: { ...catModal.data, description: e.target.value } })} rows={2} /></div>
            <div><Label>Ordem</Label><Input type="number" value={catModal.data.sort_order ?? 0} onChange={(e) => setCatModal({ ...catModal, data: { ...catModal.data, sort_order: Number(e.target.value) } })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatModal({ open: false, data: {} })}>Cancelar</Button>
            <Button onClick={saveCat}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
