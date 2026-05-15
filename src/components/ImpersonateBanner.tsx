import { useEffect, useState } from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isImpersonating, getImpersonateMeta, stopImpersonation } from '@/lib/impersonate';

export function ImpersonateBanner() {
  const [meta, setMeta] = useState(getImpersonateMeta());
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setMeta(getImpersonateMeta());
  }, []);

  if (!isImpersonating() || !meta) return null;

  const handleExit = async () => {
    setExiting(true);
    try {
      await stopImpersonation();
    } catch (e) {
      setExiting(false);
    }
  };

  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between text-sm shadow-md sticky top-0 z-50">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          <strong>Modo Impersonate:</strong> você está logado como <strong>{meta.target_email}</strong>
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleExit}
        disabled={exiting}
        className="gap-1.5 h-7 text-xs flex-shrink-0"
      >
        <LogOut className="h-3.5 w-3.5" />
        {exiting ? 'Saindo...' : 'Sair do modo'}
      </Button>
    </div>
  );
}
