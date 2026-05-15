import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, X, ImageIcon } from 'lucide-react';

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
}

interface Props {
  productId: string;
  accountId: string;
  maxImages?: number;
}

export default function ProductImageGallery({ productId, accountId, maxImages = 4 }: Props) {
  const { toast } = useToast();
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!productId) return;
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadImages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('product_images' as any)
      .select('*')
      .eq('product_id', productId)
      .order('sort_order');
    setImages((data as any) || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast({ variant: 'destructive', title: 'Limite atingido', description: `Máximo de ${maxImages} imagens por produto.` });
      return;
    }

    const toUpload = files.slice(0, remaining);
    setUploading(true);

    try {
      let nextOrder = images.length;
      for (const file of toUpload) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${accountId}/products/${productId}-${Date.now()}-${nextOrder}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('product-images')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path);
        const { error: insErr } = await supabase
          .from('product_images' as any)
          .insert({ product_id: productId, image_url: urlData.publicUrl, sort_order: nextOrder });
        if (insErr) throw insErr;
        nextOrder++;
      }
      toast({ title: 'Imagens enviadas!' });
      loadImages();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = async (img: ProductImage) => {
    const { error } = await supabase.from('product_images' as any).delete().eq('id', img.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
      return;
    }
    try {
      const url = new URL(img.image_url);
      const idx = url.pathname.indexOf('/product-images/');
      if (idx >= 0) {
        const path = decodeURIComponent(url.pathname.slice(idx + '/product-images/'.length));
        await supabase.storage.from('product-images').remove([path]);
      }
    } catch { /* ignore */ }
    setImages(prev => prev.filter(i => i.id !== img.id));
  };

  if (loading) {
    return <div className="py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5" /> Imagens adicionais ({images.length}/{maxImages})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || images.length >= maxImages}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Adicionar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {images.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {images.map(img => (
            <div key={img.id} className="relative aspect-square rounded border bg-muted overflow-hidden group">
              <img src={img.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => removeImage(img)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remover imagem"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">A primeira imagem (acima) é a principal. Use estas para ângulos extras, detalhes etc.</p>
      )}
    </div>
  );
}
