import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Loader2 } from 'lucide-react';
import { SellerTips } from '@/components/SellerTips';

export function AppLayout() {
  const { user, loading, dataLoaded } = useAuth();

  if (loading || (user && !dataLoaded)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <div className="flex flex-1 w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <SellerTips />
        </div>
      </div>
    </SidebarProvider>
  );
}
