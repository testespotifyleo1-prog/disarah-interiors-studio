import { useState } from 'react';
import { Store, ChevronDown, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { SupportNotificationBell } from '@/components/notifications/SupportNotificationBell';

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
};

export function AppHeader() {
  const { user, stores, currentStore, setCurrentStore, userRole } = useAuth();
  const [pendingStore, setPendingStore] = useState<any>(null);

  const handleStoreSelect = (store: any) => {
    if (currentStore?.id === store.id) return;
    setPendingStore(store);
  };

  const confirmStoreSwitch = () => {
    if (pendingStore) {
      setCurrentStore(pendingStore);
      setPendingStore(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        
        {/* Active store name - prominent */}
        {currentStore && (
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm lg:text-base text-foreground truncate max-w-[200px] lg:max-w-[300px]">
              {currentStore.name}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Store Selector */}
        {stores.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span className="hidden sm:inline-block text-xs">Trocar Loja</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Selecionar Loja</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {stores.map((store) => (
                <DropdownMenuItem
                  key={store.id}
                  onClick={() => handleStoreSelect(store)}
                  className={currentStore?.id === store.id ? 'bg-accent' : ''}
                >
                  <Store className="mr-2 h-4 w-4" />
                  <span className="truncate">{store.name}</span>
                  {currentStore?.id === store.id && (
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">Ativa</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications bell (support tickets needing attention) */}
        <SupportNotificationBell />

        {/* User Info */}
        <div className="flex items-center gap-3">
          {userRole && (
            <Badge variant="secondary" className="hidden sm:flex">
              {roleLabels[userRole] || userRole}
            </Badge>
          )}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
        </div>
      </header>

      {/* Store switch confirmation dialog */}
      <Dialog open={!!pendingStore} onOpenChange={(open) => { if (!open) setPendingStore(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar troca de loja</DialogTitle>
            <DialogDescription>
              Você está na loja <strong className="text-foreground">{currentStore?.name}</strong> e deseja trocar para <strong className="text-foreground">{pendingStore?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vendas, estoque e relatórios serão atualizados para a nova loja selecionada.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStore(null)}>Cancelar</Button>
            <Button onClick={confirmStoreSwitch}>Confirmar Troca</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
