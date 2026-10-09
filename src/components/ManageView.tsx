import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Box, Building2, ContactRound, Download, FileSpreadsheet, PackagePlus, Plus, Printer, RotateCcw, Tags, Truck, Users, X } from "lucide-react";
import QRCode from "qrcode";
import { Product } from "../types";

type Section = "products" | "stock" | "staff" | "brands" | "categories" | "suppliers" | "customers" | "qr";
type EntitySection = Exclude<Section, "stock" | "qr">;
type Destination = "inventory" | "sessions" | "settings";
type Fields = Record<string, string>;

const sections: { id: Section; title: string; icon: typeof PackagePlus }[] = [
  { id: "products", title: "Products", icon: Box }, { id: "stock", title: "Stock adjustment", icon: RotateCcw },
  { id: "staff", title: "Staff", icon: Users }, { id: "brands", title: "Brands", icon: Tags },
  { id: "categories", title: "Categories", icon: Building2 }, { id: "suppliers", title: "Suppliers", icon: Truck },
  { id: "customers", title: "Customers", icon: ContactRound }, { id: "qr", title: "QR & barcode", icon: Barcode },
];

interface Props {
  products: Product[]; categories: any[]; brands: any[]; suppliers: any[]; customers: any[]; staff: any[];
  storeId?: string; stores: { id: string; name: string }[]; loading: boolean;
  onCreateProduct: (payload: Record<string, unknown>) => Promise<unknown>;
  onCreateEntity: (section: EntitySection, payload: Record<string, unknown>) => Promise<unknown>;
  onUpdateEntity: (section: EntitySection, id: string, payload: Record<string, unknown>) => Promise<unknown>;
  onAdjustStock: (productId: string, variantId: string | undefined, delta: number, reason: string) => Promise<unknown>;
  onAssignBarcode: (productId: string, barcode: string) => Promise<unknown>;
  onNavigate: (tab: Destination) => void;
}

const emptyProduct: Fields = { name: "", sku: "", barcode: "", categoryId: "", brandId: "", supplierId: "", costPrice: "", sellingPrice: "", initialStock: "0" };
const formFields: Record<EntitySection, { name: string; label: string; type?: string; required?: boolean }[]> = {
  products: [],
  staff: [{ name: "name", label: "Full name", required: true }, { name: "username", label: "Username", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "password", label: "Temporary password", type: "password", required: true }, { name: "role", label: "Role", type: "select:ADMIN,MANAGER,CASHIER,ACCOUNTANT", required: true }],
  brands: [{ name: "name", label: "Brand name", required: true }, { name: "description", label: "Description" }],
  categories: [{ name: "name", label: "Category name", required: true }, { name: "description", label: "Description" }],
  suppliers: [{ name: "name", label: "Supplier name", required: true }, { name: "code", label: "Supplier code" }, { name: "contactName", label: "Contact person" }, { name: "phone", label: "Phone" }, { name: "email", label: "Email", type: "email" }, { name: "address", label: "Address" }, { name: "taxId", label: "Tax ID" }],
  customers: [{ name: "name", label: "Customer name", required: true }, { name: "code", label: "Customer code" }, { name: "phone", label: "Phone" }, { name: "email", label: "Email", type: "email" }, { name: "address", label: "Address" }, { name: "tier", label: "Loyalty tier", type: "select:BRONZE,SILVER,GOLD,PLATINUM" }],
};

const listFor = (section: EntitySection, props: Props): any[] => ({ products: props.products, staff: props.staff, brands: props.brands, categories: props.categories, suppliers: props.suppliers, customers: props.customers }[section]);
const labels: Record<EntitySection, string> = { products: "Product", staff: "Staff member", brands: "Brand", categories: "Category", suppliers: "Supplier", customers: "Customer" };
const serial = () => `KNT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

export function ManageView(props: Props) {
  const [section, setSection] = useState<Section>("products");
  const [dialog, setDialog] = useState<"create" | "edit" | "stock" | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [fields, setFields] = useState<Fields>({ ...emptyProduct });
  const [stockFields, setStockFields] = useState({ productId: "", variantId: "", mode: "IN", quantity: "", reason: "" });
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedQrProduct, setSelectedQrProduct] = useState("");
  const [qrData, setQrData] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedProduct = props.products.find((product) => product.id === selectedQrProduct) ?? props.products[0];
  const activeSection = section === "stock" ? "products" : section === "qr" ? "products" : section;
  const rows = listFor(activeSection, props);
  const filteredRows = useMemo(() => rows.filter((item: any) => `${item.name ?? ""} ${item.sku ?? ""} ${item.code ?? ""} ${item.email ?? ""} ${item.phone ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [rows, search]);

  useEffect(() => {
    const value = selectedProduct?.barcode || selectedProduct?.sku;
    if (!value) { setQrData(""); return; }
    let disposed = false;
    void QRCode.toDataURL(value, { width: 220, margin: 1, errorCorrectionLevel: "M" }).then((url) => { if (!disposed) setQrData(url); }).catch(() => setQrData(""));
    return () => { disposed = true; };
  }, [selectedProduct?.id, selectedProduct?.barcode, selectedProduct?.sku]);

  const openCreate = () => { setFields({ ...emptyProduct, name: "", sku: serial(), barcode: "", categoryId: props.categories[0]?.id ?? "", initialStock: "0" }); setStaffPermissions([]); setDialog("create"); setError(null); setNotice(null); };
  const openEdit = (item: any) => {
    setEditing(item);
    const values: Fields = section === "products"
      ? { name: item.name || "", sku: item.sku || "", barcode: item.barcode || "", categoryId: item.categoryId || "", brandId: item.brandId || "", supplierId: item.supplierId || "", costPrice: String(item.costPrice ?? ""), sellingPrice: String(item.price ?? "") }
      : Object.fromEntries(formFields[section as EntitySection].map(({ name }) => [name, name === "password" ? "" : String(item[name] ?? "")]));
    setFields(values); setStaffPermissions(item.permissions ?? []); setDialog("edit"); setError(null); setNotice(null);
  };
  const openStock = (productId = "") => { if (!props.storeId) { setError("Select a store before adjusting stock."); return; } setStockFields({ productId, variantId: "", mode: "IN", quantity: "", reason: "" }); setDialog("stock"); setError(null); setNotice(null); };
  const setField = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      if (dialog === "stock") {
        const quantity = Number(stockFields.quantity);
        if (!stockFields.productId || !Number.isInteger(quantity) || quantity < 1 || !stockFields.reason.trim()) throw new Error("Choose a product, enter a positive whole quantity, and add a reason.");
        await props.onAdjustStock(stockFields.productId, stockFields.variantId || undefined, stockFields.mode === "IN" ? quantity : -quantity, stockFields.reason.trim());
        setNotice("Stock adjustment saved to the server.");
      } else if (dialog === "edit") {
        if (!editing?.id) throw new Error("Select a record to edit.");
        const payload: Record<string, unknown> = {};
        if (section === "products") {
          payload.name = fields.name.trim(); payload.sellingPrice = Number(fields.sellingPrice);
          for (const key of ["sku", "barcode"] as const) if (fields[key]?.trim()) payload[key] = fields[key].trim();
          if (fields.costPrice !== "") payload.costPrice = Number(fields.costPrice);
          if (fields.categoryId) payload.categoryId = fields.categoryId;
          if (fields.brandId) payload.brandId = fields.brandId;
          if (fields.supplierId) payload.supplierId = fields.supplierId;
        } else {
          for (const field of formFields[section as EntitySection]) { const value = fields[field.name]?.trim(); if (value && field.name !== "password") payload[field.name] = value; }
          if (section === "staff") { payload.permissions = staffPermissions; if (fields.password?.trim()) payload.password = fields.password.trim(); if (props.storeId) payload.storeId = props.storeId; }
        }
        await props.onUpdateEntity(section as EntitySection, editing.id, payload);
        setNotice(`${labels[section as EntitySection]} updated successfully.`);
      } else if (section === "products") {
        if (!props.storeId) throw new Error("Select a store before creating a product.");
        const stock = Math.max(0, Math.floor(Number(fields.initialStock) || 0));
        await props.onCreateProduct({ name: fields.name.trim(), sku: fields.sku.trim() || undefined, barcode: fields.barcode.trim() || undefined, categoryId: fields.categoryId || undefined, brandId: fields.brandId || undefined, supplierId: fields.supplierId || undefined, costPrice: Number(fields.costPrice) || 0, sellingPrice: Number(fields.sellingPrice) || 0, storeId: props.storeId, initialStock: stock });
        setNotice("Product created and linked to the selected store.");
      } else {
        const payload: Record<string, unknown> = {};
        for (const field of formFields[section as EntitySection]) {
          const value = fields[field.name]?.trim();
          if (value) payload[field.name] = value;
        }
        if (section === "staff") { payload.permissions = staffPermissions; payload.isActive = true; payload.role ||= "CASHIER"; if (props.storeId) payload.storeId = props.storeId; }
        if (section === "customers" && !payload.tier) payload.tier = "BRONZE";
        await props.onCreateEntity(section as EntitySection, payload);
        setNotice(`${labels[section as EntitySection]} added successfully.`);
      }
      setDialog(null);
    } catch (cause) {
      const err = cause as { data?: { message?: string }; message?: string };
      setError(err.data?.message || err.message || "Could not save this change.");
    } finally { setBusy(false); }
  };

  const printQr = () => {
    if (!selectedProduct || !qrData) return;
    const popup = window.open("", "kanitt-label", "width=500,height=500");
    if (!popup) { setError("The print window was blocked. Allow pop-ups for this app and retry."); return; }
    const title = selectedProduct.name.replace(/[&<>"']/g, "");
    const code = (selectedProduct.barcode || selectedProduct.sku).replace(/[&<>"']/g, "");
    popup.document.write(`<!doctype html><html><head><title>QR label</title><style>body{font:14px Arial;text-align:center;padding:24px}.label{border:1px dashed #999;padding:20px;display:inline-block;max-width:300px}img{width:200px;height:200px}h2{font-size:18px}</style></head><body><article class="label"><h2>${title}</h2><img src="${qrData}"/><p>${code}</p><p>${Number(selectedProduct.price).toLocaleString()} MMK</p></article><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadExcelTemplate = () => {
    const headers = "Product Name,SKU,Barcode,Cost Price,Selling Price,Initial Stock,Category Name\n";
    const exampleRow1 = "Sample Product 1,SKU-1001,8850001001,5000,7500,50,General\n";
    const exampleRow2 = "Sample Product 2,SKU-1002,8850001002,12000,16000,100,Beverages\n";
    const blob = new Blob([headers + exampleRow1 + exampleRow2], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Kanitt_Product_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!props.storeId) {
      setError("Please select an active store before importing products.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setBusy(true);
    setError(null);
    setNotice("Reading and importing products file...");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) throw new Error("File is empty or missing data rows.");

      let successCount = 0;
      let failCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map((col) => col.trim().replace(/^["']|["']$/g, ""));
        if (!row[0]) continue; // Skip if no name

        const [name, sku, barcode, costPriceStr, sellingPriceStr, initialStockStr, categoryName] = row;
        const sellingPrice = Number(sellingPriceStr) || 0;
        const costPrice = Number(costPriceStr) || 0;
        const initialStock = Math.max(0, Math.floor(Number(initialStockStr) || 0));

        // Find or fallback categoryId
        let catId = props.categories[0]?.id;
        if (categoryName) {
          const matchedCat = props.categories.find((c: any) => c.name.toLowerCase() === categoryName.toLowerCase());
          if (matchedCat) catId = matchedCat.id;
        }

        try {
          await props.onCreateProduct({
            name,
            sku: sku || `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            barcode: barcode || undefined,
            costPrice,
            sellingPrice,
            storeId: props.storeId,
            initialStock,
            categoryId: catId,
          });
          successCount++;
        } catch {
          failCount++;
        }
      }

      setNotice(`Batch import complete: ${successCount} products added successfully.${failCount > 0 ? ` (${failCount} skipped/failed)` : ""}`);
    } catch (err: any) {
      setError(err.message || "Failed to process import file.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return <main className="flex-1 overflow-y-auto p-7"><header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Workspace tools</p><h1 className="mt-2 text-3xl font-black text-white">Manage</h1><p className="mt-1 text-sm text-slate-400">Catalog, stock, people and customer records for {props.stores.find((store) => store.id === props.storeId)?.name ?? "your workspace"}.</p></div><span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">{props.loading ? "Refreshing data…" : "Live server data"}</span></header>
    <nav className="mb-5 flex flex-wrap gap-2">{sections.map(({ id, title, icon: Icon }) => <button key={id} onClick={() => { setSection(id); setSearch(""); setNotice(null); setError(null); }} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${section === id ? "border-sky-400/50 bg-sky-400/10 text-sky-200" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" />{title}</button>)}</nav>
    {error && !dialog && <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}{notice && !dialog && <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p>}
    {section === "stock" ? <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6"><h2 className="text-lg font-bold text-white">Adjust store stock</h2><p className="mb-5 mt-1 text-sm text-slate-400">Each adjustment is written to the server movement ledger with your reason.</p><button onClick={() => openStock()} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400"><Plus className="h-4 w-4" />New adjustment</button><p className="mt-4 text-xs text-slate-500">Requires an ADMIN or MANAGER account with inventory permission.</p></section> : section === "qr" ? <section className="grid gap-5 xl:grid-cols-[1fr_340px]"><div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"><div className="flex items-center gap-3 border-b border-slate-800 p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find product by name, SKU or code" className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500" /></div><div className="max-h-[65vh] overflow-y-auto">{filteredRows.map((product: Product) => <button key={product.id} onClick={() => setSelectedQrProduct(product.id)} className={`flex w-full items-center justify-between border-b border-slate-800/70 px-4 py-3 text-left ${selectedQrProduct === product.id ? "bg-sky-500/10" : "hover:bg-slate-800/40"}`}><span><span className="block text-sm font-semibold text-slate-100">{product.name}</span><span className="mt-1 block font-mono text-xs text-slate-500">{product.barcode || product.sku}</span></span><Barcode className="h-4 w-4 text-sky-300" /></button>)}</div></div><aside className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center"><h2 className="font-bold text-white">QR label preview</h2>{selectedProduct && qrData ? <><img src={qrData} alt={`QR for ${selectedProduct.name}`} className="mt-4 h-52 w-52 rounded-xl bg-white p-2"/><p className="mt-3 text-sm font-semibold text-slate-200">{selectedProduct.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{selectedProduct.barcode || selectedProduct.sku}</p><div className="mt-4 flex w-full gap-2"><button onClick={async () => { if (!selectedProduct.barcode) { const value = serial(); try { await props.onAssignBarcode(selectedProduct.id, value); setNotice(`QR/barcode ${value} assigned.`); } catch (cause) { const err = cause as { data?: { message?: string }; message?: string }; setError(err.data?.message || err.message || "Could not assign barcode."); return; } } }} className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800">{selectedProduct.barcode ? "Code assigned" : "Assign code"}</button><button onClick={printQr} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-sky-400"><Printer className="h-3.5 w-3.5" />Print</button></div></> : <p className="mt-10 text-sm text-slate-500">Select a product with a SKU to preview its QR code.</p>}</aside></section> : <><section className="mb-4 flex flex-wrap items-center gap-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${section}`} className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-500" />{section === "products" && <><button onClick={downloadExcelTemplate} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors" title="Download sample CSV/Excel template"><Download className="h-4 w-4 text-emerald-400" />Template</button><input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls" onChange={handleExcelFileUpload} className="hidden" /><button onClick={() => fileInputRef.current?.click()} disabled={busy} className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50" title="Import multiple products from CSV/Excel"><FileSpreadsheet className="h-4 w-4" />Import Excel/CSV</button><button onClick={() => openStock()} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-900"><RotateCcw className="h-4 w-4" />Adjust stock</button></>}<button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400"><Plus className="h-4 w-4" />Add {labels[section as EntitySection]}</button></section><section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"><div className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>Name</span><span>{section === "products" ? "SKU / barcode" : section === "staff" ? "Role" : "Contact"}</span><span>{section === "products" ? "Price" : "Code / status"}</span><span>Details</span></div>{filteredRows.map((item: any) => <div key={item.id} className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-slate-800/70 px-5 py-3.5 last:border-0"><span className="truncate text-sm font-semibold text-slate-100">{item.name}</span><span className="truncate font-mono text-xs text-slate-400">{section === "products" ? `${item.sku || "—"} · ${item.barcode || "—"}` : section === "staff" ? item.role : item.email || item.phone || item.contactName || "—"}</span><span className="truncate text-xs text-slate-400">{section === "products" ? `${Number(item.price).toLocaleString()} MMK · ${item.stock} in stock` : item.code || (item.isActive === false ? "Inactive" : "Active")}</span><span className="text-xs text-slate-500">{item._count?.products ?? item.storeName ?? "—"}</span><button onClick={() => openEdit(item)} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:border-sky-400/40 hover:text-white">Edit</button></div>)}{!filteredRows.length && <p className="p-10 text-center text-sm text-slate-400">{props.loading ? "Loading…" : `No ${section} found.`}</p>}</section></>}
    <section className="mt-6 flex flex-wrap gap-2 text-xs">{([ ["Inventory view", "inventory"], ["Register sessions", "sessions"], ["Workspace settings", "settings"] ] as const).map(([title, tab]) => <button key={tab} onClick={() => props.onNavigate(tab)} className="rounded-lg border border-slate-800 px-3 py-2 text-slate-400 hover:text-slate-200">{title} →</button>)}</section>
    {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">{dialog === "stock" ? "Stock adjustment" : dialog === "edit" ? `Edit ${labels[section as EntitySection]}` : `Add ${labels[section as EntitySection]}`}</h2><p className="mt-1 text-xs text-slate-400">Saved directly to the selected tenant.</p></div><button type="button" onClick={() => setDialog(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
      {dialog === "stock" ? <div className="space-y-4"><label className="block text-xs text-slate-400">Product<select required value={stockFields.productId} onChange={(event) => setStockFields((current) => ({ ...current, productId: event.target.value, variantId: "" }))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"><option value="">Choose product</option>{props.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stock} in stock</option>)}</select></label>{props.products.find((product) => product.id === stockFields.productId)?.variants?.length ? <label className="block text-xs text-slate-400">Option<select value={stockFields.variantId} onChange={(event) => setStockFields((current) => ({ ...current, variantId: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"><option value="">Default active option</option>{props.products.find((product) => product.id === stockFields.productId)?.variants?.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label> : null}<div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">Adjustment<select value={stockFields.mode} onChange={(event) => setStockFields((current) => ({ ...current, mode: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"><option value="IN">Add stock</option><option value="OUT">Remove stock</option></select></label><label className="text-xs text-slate-400">Quantity<input type="number" min="1" step="1" required value={stockFields.quantity} onChange={(event) => setStockFields((current) => ({ ...current, quantity: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" /></label></div><label className="block text-xs text-slate-400">Reason<input required minLength={3} value={stockFields.reason} onChange={(event) => setStockFields((current) => ({ ...current, reason: event.target.value }))} placeholder="e.g. Received supplier delivery" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" /></label></div> : section === "products" ? <div className="grid gap-3 sm:grid-cols-2">{[{ name: "name", label: "Product name", required: true }, { name: "sku", label: "SKU" }, { name: "barcode", label: "Barcode / QR value" }, { name: "costPrice", label: "Cost price", type: "number" }, { name: "sellingPrice", label: "Selling price", type: "number", required: true }, ...(dialog === "edit" ? [] : [{ name: "initialStock", label: "Initial stock", type: "number" }])].map((field) => <label key={field.name} className="text-xs text-slate-400">{field.label}<input required={dialog === "create" && field.required} type={field.type || "text"} min={field.type === "number" ? "0" : undefined} step={field.name.includes("Price") ? "0.01" : field.type === "number" ? "1" : undefined} value={fields[field.name]} onChange={(event) => setField(field.name, event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" /></label>)}<label className="text-xs text-slate-400">Category<select required value={fields.categoryId} onChange={(event) => setField("categoryId", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"><option value="">Choose category</option>{props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{!props.categories.length && <span className="mt-1 block text-amber-300">Create a category first.</span>}</label><label className="text-xs text-slate-400">Brand (optional)<select value={fields.brandId} onChange={(event) => setField("brandId", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"><option value="">No brand</option>{props.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="text-xs text-slate-400 sm:col-span-2">Supplier (optional)<select value={fields.supplierId} onChange={(event) => setField("supplierId", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"><option value="">No supplier</option>{props.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label></div> : <div className="grid gap-3 sm:grid-cols-2">{formFields[section as EntitySection].map((field) => <label key={field.name} className="text-xs text-slate-400">{field.label}{field.type?.startsWith("select:") ? <select required={dialog === "create" && field.required} value={fields[field.name] || (field.type.includes("BRONZE") ? "BRONZE" : "CASHIER")} onChange={(event) => setField(field.name, event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white">{field.type.split(":")[1].split(",").map((option) => <option key={option}>{option}</option>)}</select> : <input required={dialog === "create" && field.required} type={field.type || "text"} minLength={field.name === "password" && dialog === "create" ? 6 : undefined} value={fields[field.name] || ""} onChange={(event) => setField(field.name, event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" />}</label>)}{section === "staff" && <fieldset className="sm:col-span-2"><legend className="mb-2 text-xs font-semibold text-slate-400">Additional permissions (server validates what you can delegate)</legend><div className="grid grid-cols-2 gap-2">{["MANAGE_STAFF", "MANAGE_INVENTORY", "EDIT_PRICES", "VOID_ORDERS", "REFUND_ORDERS", "VIEW_REPORTS", "VIEW_ANALYTICS"].map((permission) => <label key={permission} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300"><input type="checkbox" checked={staffPermissions.includes(permission)} onChange={(event) => setStaffPermissions((current) => event.target.checked ? [...current, permission] : current.filter((value) => value !== permission))} />{permission.split("_").join(" ").toLowerCase()}</label>)}</div></fieldset>}</div>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDialog(null)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">Cancel</button><button disabled={busy} className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : dialog === "stock" ? "Save adjustment" : dialog === "edit" ? "Save changes" : `Create ${labels[section as EntitySection]}`}</button></div></form></div>}
  </main>;
}
