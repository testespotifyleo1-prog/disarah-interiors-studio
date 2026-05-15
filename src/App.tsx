import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlanProvider } from "@/contexts/PlanContext";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

import MercadoLivreCallback from "./pages/MercadoLivreCallback";
import TrackOrder from "./pages/TrackOrder";

// App Pages
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import PDV from "./pages/app/PDV";
import PDVRapido from "./pages/app/PDVRapido";
import Sales from "./pages/app/Sales";
import SaleDetail from "./pages/app/SaleDetail";
import Products from "./pages/app/Products";
import Inventory from "./pages/app/Inventory";
import Customers from "./pages/app/Customers";
import BirthdayCampaign from "./pages/app/BirthdayCampaign";
import Sellers from "./pages/app/Sellers";
import Finance from "./pages/app/Finance";
import MyCommissions from "./pages/app/MyCommissions";
import Drivers from "./pages/app/Drivers";
import Deliveries from "./pages/app/Deliveries";
import Stores from "./pages/app/Stores";
import FiscalSettings from "./pages/app/FiscalSettings";
import ImportProducts from "./pages/app/ImportProducts";
import ImportCustomers from "./pages/app/ImportCustomers";
import Assemblers from "./pages/app/Assemblers";
import Assemblies from "./pages/app/Assemblies";
import ResetData from "./pages/app/ResetData";
import OwnerPinSettings from "./pages/app/OwnerPinSettings";
import BusinessTypeSettings from "./pages/app/BusinessTypeSettings";

import FiscalReturns from "./pages/app/FiscalReturns";
import FiscalEntries from "./pages/app/FiscalEntries";
import NewFiscalEntry from "./pages/app/NewFiscalEntry";
import FiscalEntryDetail from "./pages/app/FiscalEntryDetail";
import Crediario from "./pages/app/Crediario";
import ActivityLogs from "./pages/app/ActivityLogs";
import Suppliers from "./pages/app/Suppliers";
import SupplierReturns from "./pages/app/SupplierReturns";
import ChatbotSettings from "./pages/app/ChatbotSettings";
import ChatConversations from "./pages/app/ChatConversations";
import CommissionTiers from "./pages/app/CommissionTiers";
import FiscalCounter from "./pages/app/FiscalCounter";
import FiscalExtras from "./pages/app/FiscalExtras";
import FiscalDashboard from "./pages/app/FiscalDashboard";
import EcommerceSettings from "./pages/app/EcommerceSettings";
import Storefront from "./pages/Storefront";
import ImportSuppliers from "./pages/app/ImportSuppliers";
import Categories from "./pages/app/Categories";
import CashRegisterSummary from "./pages/app/CashRegisterSummary";
import Integrations from "./pages/app/Integrations";
import ShopeeIntegration from "./pages/app/ShopeeIntegration";
import MercadoLivreIntegration from "./pages/app/MercadoLivreIntegration";
import MercadoPagoIntegration from "./pages/app/MercadoPagoIntegration";
import AmazonIntegration from "./pages/app/AmazonIntegration";
import MagaluIntegration from "./pages/app/MagaluIntegration";
import MelhorEnvioIntegration from "./pages/app/MelhorEnvioIntegration";
import UberDirectIntegration from "./pages/app/UberDirectIntegration";
import StoreCredits from "./pages/app/StoreCredits";
import SuperAdmin from "./pages/SuperAdmin";
import Labels from "./pages/app/Labels";
import ExpirationReport from "./pages/app/ExpirationReport";
import StoreTransfers from "./pages/app/StoreTransfers";
import NewStoreTransfer from "./pages/app/NewStoreTransfer";
import StoreTransferDetail from "./pages/app/StoreTransferDetail";
import PurchaseOrders from "./pages/app/PurchaseOrders";
import NewPurchaseOrder from "./pages/app/NewPurchaseOrder";
import PurchaseOrderDetail from "./pages/app/PurchaseOrderDetail";
import ReplenishmentSuggestions from "./pages/app/ReplenishmentSuggestions";
import Quotes from "./pages/app/Quotes";
import NewQuote from "./pages/app/NewQuote";
import QuoteDetail from "./pages/app/QuoteDetail";
import AiSimulations from "./pages/app/AiSimulations";
import EmailCampaigns from "./pages/app/EmailCampaigns";
import Picking from "./pages/app/Picking";
import CustomerReturns from "./pages/app/CustomerReturns";
import SalesGoals from "./pages/app/SalesGoals";
import ReactivationCampaigns from "./pages/app/ReactivationCampaigns";
import Developers from "./pages/app/Developers";
import ApiConnectors from "./pages/app/ApiConnectors";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PlanProvider>
        <Toaster />
        <Sonner position="top-right" richColors closeButton expand visibleToasts={4} toastOptions={{ duration: 5000 }} />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/loja/:slug" element={<Storefront />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/superadmin" element={<SuperAdmin />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            <Route path="/meli/callback" element={<MercadoLivreCallback />} />
            <Route path="/rastreio/:token" element={<TrackOrder />} />
            <Route path="/track/:token" element={<TrackOrder />} />

            {/* App Routes */}
            <Route path="/app" element={<AppLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="pdv" element={<PDV />} />
              <Route path="pdv-rapido" element={<PDVRapido />} />
              <Route path="sales" element={<Sales />} />
              <Route path="sales/:id" element={<SaleDetail />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="products/import" element={<ImportProducts />} />
              <Route path="customers/import" element={<ImportCustomers />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/birthday-campaign" element={<BirthdayCampaign />} />
              <Route path="sellers" element={<Sellers />} />
              <Route path="finance" element={<Finance />} />
              <Route path="my-commissions" element={<MyCommissions />} />
              <Route path="drivers" element={<Drivers />} />
              <Route path="deliveries" element={<Deliveries />} />
              <Route path="stores" element={<Stores />} />
              <Route path="settings/fiscal" element={<FiscalSettings />} />
              <Route path="settings/reset" element={<ResetData />} />
              <Route path="settings/pin" element={<OwnerPinSettings />} />
              <Route path="settings/business-type" element={<BusinessTypeSettings />} />
              <Route path="assemblers" element={<Assemblers />} />
              <Route path="assemblies" element={<Assemblies />} />
              <Route path="crediario" element={<Crediario />} />
              <Route path="store-credits" element={<StoreCredits />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/import" element={<ImportSuppliers />} />
              <Route path="activity-logs" element={<ActivityLogs />} />

              <Route path="fiscal-returns" element={<FiscalReturns />} />
              <Route path="fiscal-entries" element={<FiscalEntries />} />
              <Route path="fiscal-entries/new" element={<NewFiscalEntry />} />
              <Route path="fiscal-entries/:id" element={<FiscalEntryDetail />} />
              <Route path="supplier-returns" element={<SupplierReturns />} />
              <Route path="chatbot-settings" element={<ChatbotSettings />} />
              <Route path="chat" element={<ChatConversations />} />
              <Route path="commission-tiers" element={<CommissionTiers />} />
              <Route path="fiscal-counter" element={<FiscalCounter />} />
              <Route path="fiscal-dashboard" element={<FiscalDashboard />} />
              <Route path="fiscal-extras" element={<FiscalExtras />} />
              <Route path="ecommerce" element={<EcommerceSettings />} />
              <Route path="caixa" element={<CashRegisterSummary />} />
              <Route path="labels" element={<Labels />} />
              <Route path="expiration-report" element={<ExpirationReport />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="integrations/shopee" element={<ShopeeIntegration />} />
              <Route path="integrations/mercado-livre" element={<MercadoLivreIntegration />} />
              <Route path="integrations/mercado-pago" element={<MercadoPagoIntegration />} />
              <Route path="integrations/amazon" element={<AmazonIntegration />} />
              <Route path="integrations/magalu" element={<MagaluIntegration />} />
              <Route path="integrations/melhor-envio" element={<MelhorEnvioIntegration />} />
              <Route path="integrations/uber-direct" element={<UberDirectIntegration />} />
              <Route path="transfers" element={<StoreTransfers />} />
              <Route path="transfers/new" element={<NewStoreTransfer />} />
              <Route path="transfers/:id" element={<StoreTransferDetail />} />
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="purchase-orders/new" element={<NewPurchaseOrder />} />
              <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
              <Route path="replenishment" element={<ReplenishmentSuggestions />} />
              <Route path="quotes" element={<Quotes />} />
              <Route path="quotes/new" element={<NewQuote />} />
              <Route path="quotes/:id" element={<QuoteDetail />} />
              <Route path="ai-simulations" element={<AiSimulations />} />
              <Route path="email-campaigns" element={<EmailCampaigns />} />
              <Route path="picking" element={<Picking />} />
              <Route path="customer-returns" element={<CustomerReturns />} />
              <Route path="sales-goals" element={<SalesGoals />} />
              <Route path="reactivation-campaigns" element={<ReactivationCampaigns />} />
              <Route path="developers" element={<Developers />} />
              <Route path="api-connectors" element={<ApiConnectors />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </PlanProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
