src/
├── types/index.ts — Product, CartItem interfaces
├── store/
│ ├── apiSlice.ts — RTK Query API (health/products/stores/sessions/orders)
│ └── index.ts — Redux store config
├── components/
│ ├── Sidebar.tsx — Navigation + server status + store selector
│ ├── PosView.tsx — Product catalog grid + search + category filter
│ ├── CartView.tsx — Cart items + quantity controls + bill summary
│ ├── PaymentModal.tsx — Payment method picker + cash change calc
│ ├── InventoryView.tsx — Products table with stock status badges
│ ├── SessionsView.tsx — Session log cards (live or mock fallback)
│ └── SettingsView.tsx — Store config, tax, receipt, sync settings
└── App.tsx — Clean orchestrator (~155 lines)
