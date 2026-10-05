import { useState, useEffect } from "react";
import {
  useGetHealthQuery,
  useGetProductsQuery,
  useGetStoresQuery,
  useGetSessionsQuery,
  useCreateOrderMutation,
  Store as ApiStore,
} from "./store/apiSlice";
import { Product, CartItem } from "./types";

import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { PosView } from "./components/PosView";
import { CartView } from "./components/CartView";
import { InventoryView } from "./components/InventoryView";
import { SessionsView } from "./components/SessionsView";
import { SettingsView } from "./components/SettingsView";
import { PaymentModal } from "./components/PaymentModal";

const INITIAL_PRODUCTS: Product[] = [
  { id: "1", name: "Espresso Roast Coffee Beans (500g)", category: "Beverages", price: 18500, sku: "COF-001", stock: 45, barcode: "8850001001" },
  { id: "2", name: "Iced Caramel Macchiato", category: "Beverages", price: 6500, sku: "BEV-002", stock: 120, barcode: "8850001002" },
  { id: "3", name: "Matcha Latte (Hot/Iced)", category: "Beverages", price: 7000, sku: "BEV-003", stock: 85, barcode: "8850001003" },
  { id: "4", name: "Butter Croissant", category: "Bakery", price: 4500, sku: "BAK-001", stock: 30, barcode: "8850002001" },
  { id: "5", name: "Chocolate Fudge Cake", category: "Bakery", price: 8500, sku: "BAK-002", stock: 15, barcode: "8850002002" },
  { id: "6", name: "Avocado Toast with Egg", category: "Food", price: 12000, sku: "FOD-001", stock: 25, barcode: "8850003001" },
  { id: "7", name: "Club Sandwich", category: "Food", price: 9500, sku: "FOD-002", stock: 40, barcode: "8850003002" },
  { id: "8", name: "Sparkling Lemonade", category: "Beverages", price: 5500, sku: "BEV-004", stock: 60, barcode: "8850001004" },
];

const CATEGORIES = ["All", "Beverages", "Bakery", "Food"];

// ── POS Shell (rendered only when authenticated) ───────────────────────────
function PosShell({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<"pos" | "inventory" | "sessions" | "settings">("pos");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "kpay" | "wave" | "card">("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [selectedStore, setSelectedStore] = useState<ApiStore | null>(null);

  // RTK Query — live data from kanitt_server
  const {
    data: healthData,
    isError: isHealthError,
    isLoading: isHealthLoading,
    refetch: refetchHealth,
  } = useGetHealthQuery();
  const { data: apiProducts, isLoading: isProductsLoading, refetch: refetchProducts } = useGetProductsQuery();
  const { data: apiStores, refetch: refetchStores } = useGetStoresQuery();
  const { data: apiSessions, refetch: refetchSessions } = useGetSessionsQuery();
  const [createOrderApi] = useCreateOrderMutation();

  const isConnected = !isHealthError && healthData?.status === "ok";
  const isRTKLoading = isHealthLoading || isProductsLoading;

  // Normalize API products — fix category union type to plain string
  const products: Product[] = (() => {
    if (!apiProducts || apiProducts.length === 0) return INITIAL_PRODUCTS;
    return apiProducts.map((p) => ({
      ...p,
      category:
        typeof p.category === "object" && p.category !== null
          ? (p.category as { name: string }).name
          : (p.category as string) || "General",
      stock: p.stock ?? 0,
      barcode: p.barcode || "",
    })) as Product[];
  })();

  const stores = apiStores || [];

  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0]);
    }
  }, [stores, selectedStore]);

  const syncWithServer = () => {
    refetchHealth();
    refetchProducts();
    refetchStores();
    refetchSessions();
  };

  const liveCategories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];
  const categories = products === INITIAL_PRODUCTS ? CATEGORIES : liveCategories;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;
  const changeAmount = Math.max(0, (Number(receivedAmount) || 0) - total);

  const handleCheckoutSuccess = async () => {
    if (isConnected && selectedStore) {
      try {
        await createOrderApi({
          storeId: selectedStore.id,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity, price: item.price })),
          totalAmount: total,
          paymentMethod,
        }).unwrap();
      } catch (e) {
        console.warn("Order sync warning:", e);
      }
    }
    alert(`Order completed! Change: ${changeAmount.toLocaleString()} MMK`);
    setCart([]);
    setPaymentModalOpen(false);
    setReceivedAmount("");
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        isLoading={isRTKLoading}
        syncWithServer={syncWithServer}
        stores={stores}
        selectedStore={selectedStore}
        setSelectedStore={setSelectedStore}
        onLogout={onLogout}
      />

      {activeTab === "pos" && (
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <PosView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
            filteredProducts={filteredProducts}
            addToCart={addToCart}
          />
          <CartView
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            setCart={setCart}
            subtotal={subtotal}
            tax={tax}
            total={total}
            setPaymentModalOpen={setPaymentModalOpen}
          />
        </main>
      )}

      {activeTab === "inventory" && <InventoryView products={products} />}
      {activeTab === "sessions" && <SessionsView sessions={apiSessions} />}
      {activeTab === "settings" && <SettingsView />}

      <PaymentModal
        paymentModalOpen={paymentModalOpen}
        setPaymentModalOpen={setPaymentModalOpen}
        total={total}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        receivedAmount={receivedAmount}
        setReceivedAmount={setReceivedAmount}
        changeAmount={changeAmount}
        handleCheckoutSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}

// ── Root App — auth gate only, no other hooks ──────────────────────────────
export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("kanitt_token"));

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("kanitt_token");
    setToken(null);
  };

  if (!token) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return <PosShell onLogout={handleLogout} />;
}
