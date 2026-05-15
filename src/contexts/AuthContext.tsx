import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Account, Membership, Store, AccountRole } from '@/types/database';

export interface AuthContextType {
  dataLoaded: boolean;
  user: User | null;
  session: Session | null;
  loading: boolean;
  accounts: Account[];
  currentAccount: Account | null;
  currentMembership: Membership | null;
  stores: Store[];
  currentStore: Store | null;
  userRole: AccountRole | null;
  setCurrentAccount: (account: Account | null) => void;
  setCurrentStore: (store: Store | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  canEdit: boolean;
  canManage: boolean;
  isOwnerOrAdmin: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [currentMembership, setCurrentMembership] = useState<Membership | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);

  const userRole = currentMembership?.role || null;
  const canEdit = userRole ? ['owner', 'admin', 'manager'].includes(userRole) : false;
  const canManage = userRole ? ['owner', 'admin'].includes(userRole) : false;
  const isOwnerOrAdmin = userRole ? ['owner', 'admin'].includes(userRole) : false;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          setAccounts([]);
          setCurrentAccount(null);
          setCurrentMembership(null);
          setStores([]);
          setCurrentStore(null);
          setDataLoaded(false);
          setLoading(false);
        } else if (event === 'SIGNED_IN') {
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setDataLoaded(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      // Load memberships and accounts
      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select('*, accounts(*, plan_id)')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (membershipError) throw membershipError;

      if (memberships && memberships.length > 0) {
        const userAccounts = memberships
          .map((m: any) => m.accounts)
          .filter(Boolean) as Account[];
        
        setAccounts(userAccounts);
        
        // Set first account as current if none selected
        const savedAccountId = localStorage.getItem('currentAccountId');
        const savedAccount = userAccounts.find(a => a.id === savedAccountId);
        const accountToSet = savedAccount || userAccounts[0];
        
        setCurrentAccount(accountToSet);
        
        const membership = memberships.find((m: any) => m.account_id === accountToSet.id);
        setCurrentMembership(membership || null);

        // Load stores for the account (pass role for seller filtering)
        await loadStores(accountToSet.id, membership?.role as AccountRole, userId);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setDataLoaded(true);
      setLoading(false);
    }
  };

  const loadStores = async (accountId: string, role?: AccountRole, userId?: string) => {
    try {
      const { data: storesData, error } = await supabase
        .from('stores')
        .select('*')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      let filteredStores = storesData || [];

      // Sellers and Managers only see stores they are assigned to via store_memberships
      const effectiveUserId = userId || user?.id;
      if ((role === 'seller' || role === 'manager') && effectiveUserId) {
        const { data: assignments } = await supabase
          .from('store_memberships')
          .select('store_id')
          .eq('user_id', effectiveUserId)
          .eq('is_active', true);

        if (assignments && assignments.length > 0) {
          const assignedIds = new Set(assignments.map(a => a.store_id));
          filteredStores = filteredStores.filter(s => assignedIds.has(s.id));
        } else {
          // No assignments = no stores visible
          filteredStores = [];
        }
      }

      setStores(filteredStores);

      // Set first store as current if none selected
      if (filteredStores.length > 0) {
        const savedStoreId = localStorage.getItem('currentStoreId');
        const savedStore = filteredStores.find(s => s.id === savedStoreId);
        setCurrentStore(savedStore || filteredStores[0]);
      } else {
        setCurrentStore(null);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleSetCurrentAccount = (account: Account | null) => {
    setCurrentAccount(account);
    if (account) {
      localStorage.setItem('currentAccountId', account.id);
      // Find membership for this account
      const loadMembershipAndStores = async () => {
        const { data: membership } = await supabase
          .from('memberships')
          .select('*')
          .eq('account_id', account.id)
          .eq('user_id', user?.id)
          .eq('is_active', true)
          .single();
        
        setCurrentMembership(membership);
        await loadStores(account.id, membership?.role as AccountRole, user?.id);
      };
      loadMembershipAndStores();
    } else {
      localStorage.removeItem('currentAccountId');
      setCurrentMembership(null);
      setStores([]);
      setCurrentStore(null);
    }
  };

  const handleSetCurrentStore = (store: Store | null) => {
    setCurrentStore(store);
    if (store) {
      localStorage.setItem('currentStoreId', store.id);
    } else {
      localStorage.removeItem('currentStoreId');
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error && data.user) {
      // Log login activity asynchronously
      const { data: memberships } = await supabase.from('memberships').select('account_id').eq('user_id', data.user.id).eq('is_active', true).limit(1);
      if (memberships && memberships.length > 0) {
        supabase.from('activity_logs' as any).insert({
          account_id: memberships[0].account_id,
          user_id: data.user.id,
          user_name: data.user.email,
          action: 'login',
          entity_type: 'session',
        }).then(() => {});
      }
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          ...(phone ? { phone } : {}),
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAccounts([]);
    setCurrentAccount(null);
    setCurrentMembership(null);
    setStores([]);
    setCurrentStore(null);
    localStorage.removeItem('currentAccountId');
    localStorage.removeItem('currentStoreId');
  };

  return (
    <AuthContext.Provider
      value={{
        dataLoaded,
        user,
        session,
        loading,
        accounts,
        currentAccount,
        currentMembership,
        stores,
        currentStore,
        userRole,
        setCurrentAccount: handleSetCurrentAccount,
        setCurrentStore: handleSetCurrentStore,
        signIn,
        signUp,
        signOut,
        canEdit,
        canManage,
        isOwnerOrAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
