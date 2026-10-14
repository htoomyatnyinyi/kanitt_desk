// ManageView.tsx
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Barcode,
  Box,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  Package,
  PackagePlus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Store as StoreIcon,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { Product } from "../types";
import { apiService, resolveMediaUrl } from "../services/api";
// import { SearchableProductPicker } from "./SearchableProductPicker";
import { ChoiceCards } from "./ChoiceCards";

type Section =
  | "products"
  | "stock"
  | "stores"
  | "staff"
  | "brands"
  | "categories"
  | "suppliers"
  | "customers"
  | "qr";
type EntitySection = Exclude<Section, "stock" | "qr">;
type Destination = "inventory" | "sessions" | "settings";
type Fields = Record<string, string>;

const sections: { id: Section; title: string; icon: typeof PackagePlus }[] = [
  { id: "products", title: "Products", icon: Box },
  { id: "stock", title: "Stock adjustment", icon: RotateCcw },
  { id: "staff", title: "Staff", icon: Users },
  { id: "stores", title: "Stores", icon: StoreIcon },
  { id: "brands", title: "Brands", icon: Tags },
  { id: "categories", title: "Categories", icon: Building2 },
  { id: "suppliers", title: "Suppliers", icon: Truck },
  { id: "customers", title: "Customers", icon: ContactRound },
  { id: "qr", title: "QR & barcode", icon: Barcode },
];

interface Props {
  products: Product[];
  categories: any[];
  brands: any[];
  suppliers: any[];
  customers: any[];
  staff: any[];
  userRole?: string;
  storeId?: string;
  stores: {
    id: string;
    name: string;
    code?: string;
    address?: string;
    phone?: string;
    email?: string;
    taxNumber?: string;
    isActive?: boolean;
  }[];
  loading: boolean;
  onCreateProduct: (payload: Record<string, unknown>) => Promise<unknown>;
  onCreateEntity: (
    section: EntitySection,
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
  onUpdateEntity: (
    section: EntitySection,
    id: string,
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
  onAdjustStock: (
    productId: string,
    variantId: string | undefined,
    delta: number,
    reason: string,
    movementType?: "ADJUSTMENT" | "DAMAGE" | "EXPIRED",
  ) => Promise<unknown>;
  onAssignBarcode: (productId: string, barcode: string) => Promise<unknown>;
  onNavigate: (tab: Destination) => void;
}

const emptyProduct: Fields = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  brandId: "",
  supplierId: "",
  costPrice: "",
  sellingPrice: "",
  initialStock: "0",
  genericName: "",
  activeIngredient: "",
  strength: "",
  dosageForm: "",
  manufacturer: "",
  registrationNumber: "",
  baseUnitName: "",
  imageUrl: "",
};

const formFields: Record<
  EntitySection,
  {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    hint?: string;
  }[]
> = {
  products: [],
  stores: [
    { name: "name", label: "Store name", required: true },
    {
      name: "code",
      label: "Store code",
      required: true,
      hint: "Short identifier (e.g. DTN-01)",
    },
    { name: "phone", label: "Phone" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Address" },
    { name: "taxNumber", label: "Tax number" },
  ],
  staff: [
    { name: "name", label: "Full name", required: true },
    { name: "username", label: "Username", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    {
      name: "password",
      label: "Temporary password",
      type: "password",
      required: true,
      hint: "Minimum 6 characters",
    },
    {
      name: "role",
      label: "Role",
      type: "select:ADMIN,MANAGER,CASHIER,ACCOUNTANT",
      required: true,
    },
  ],
  brands: [
    { name: "name", label: "Brand name", required: true },
    { name: "description", label: "Description" },
  ],
  categories: [
    { name: "name", label: "Category name", required: true },
    { name: "description", label: "Description" },
  ],
  suppliers: [
    { name: "name", label: "Supplier name", required: true },
    {
      name: "code",
      label: "Supplier code",
      hint: "Leave blank to auto-generate",
    },
    { name: "contactName", label: "Contact person" },
    { name: "phone", label: "Phone" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Address" },
    { name: "taxId", label: "Tax ID" },
  ],
  customers: [
    { name: "name", label: "Customer name", required: true },
    { name: "code", label: "Customer code" },
    { name: "phone", label: "Phone" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Address" },
    {
      name: "tier",
      label: "Loyalty tier",
      type: "select:BRONZE,SILVER,GOLD,PLATINUM",
    },
  ],
};

const formGroups: Record<
  EntitySection,
  { title: string; icon: typeof Package; fields: string[] }[]
> = {
  products: [],
  stores: [
    { title: "Basic information", icon: StoreIcon, fields: ["name", "code"] },
    { title: "Contact", icon: ContactRound, fields: ["phone", "email"] },
    {
      title: "Address & billing",
      icon: FileSpreadsheet,
      fields: ["address", "taxNumber"],
    },
  ],
  staff: [
    {
      title: "Identity",
      icon: Users,
      fields: ["name", "username", "email", "password"],
    },
    { title: "Access", icon: Check, fields: ["role"] },
  ],
  brands: [{ title: "Brand", icon: Tags, fields: ["name", "description"] }],
  categories: [
    { title: "Category", icon: Building2, fields: ["name", "description"] },
  ],
  suppliers: [
    { title: "Basic", icon: Truck, fields: ["name", "code"] },
    {
      title: "Contact",
      icon: ContactRound,
      fields: ["contactName", "phone", "email"],
    },
    { title: "Billing", icon: FileSpreadsheet, fields: ["address", "taxId"] },
  ],
  customers: [
    { title: "Basic", icon: ContactRound, fields: ["name", "code"] },
    {
      title: "Contact",
      icon: ContactRound,
      fields: ["phone", "email", "address"],
    },
    { title: "Loyalty", icon: Sparkles, fields: ["tier"] },
  ],
};

const listFor = (section: EntitySection, props: Props): any[] =>
  ({
    products: props.products,
    stores: props.stores,
    staff: props.staff,
    brands: props.brands,
    categories: props.categories,
    suppliers: props.suppliers,
    customers: props.customers,
  })[section];

const labels: Record<EntitySection, string> = {
  products: "Product",
  stores: "Store",
  staff: "Staff member",
  brands: "Brand",
  categories: "Category",
  suppliers: "Supplier",
  customers: "Customer",
};

const serial = () =>
  `KNT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

/* ------------------------------------------------------------------ */
/*  Searchable combo select with optional inline create                */
/* ------------------------------------------------------------------ */

function ComboSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  hint,
  allowNone = true,
  noneLabel = "None",
  required,
  disabled,
  onCreate,
  createLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string; meta?: string }[];
  placeholder?: string;
  hint?: string;
  allowNone?: boolean;
  noneLabel?: string;
  required?: boolean;
  disabled?: boolean;
  onCreate?: (name: string) => Promise<{ id: string; name: string } | void>;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
        setCreateErr("");
      }
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) =>
        `${o.name} ${o.meta ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateErr("Enter a name.");
      return;
    }
    if (!onCreate) return;
    setBusyCreate(true);
    setCreateErr("");
    try {
      const created = await onCreate(trimmed);
      if (created && "id" in created) onChange(created.id);
      setCreating(false);
      setNewName("");
      setOpen(false);
      setQuery("");
    } catch (cause) {
      const err = cause as { data?: { message?: string }; message?: string };
      setCreateErr(
        err.data?.message || err.message || "Could not create record.",
      );
    } finally {
      setBusyCreate(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-slate-400">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-left text-sm text-white outline-none transition-all hover:border-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
      >
        <span
          className={`truncate ${selected ? "text-white" : "text-slate-500"}`}
        >
          {selected ? selected.name : placeholder}
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-800 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {allowNone && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-800 ${
                  !value ? "text-sky-300" : "text-slate-400"
                }`}
              >
                <span>{noneLabel}</span>
                {!value && <Check className="h-3.5 w-3.5" />}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                No matches found.
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-800 ${
                    value === o.id ? "text-sky-300" : "text-slate-200"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {o.name}
                    </span>
                    {o.meta && (
                      <span className="block truncate text-[10px] text-slate-500">
                        {o.meta}
                      </span>
                    )}
                  </span>
                  {value === o.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ))
            )}
          </div>

          {/* Inline "create new" area */}
          {onCreate &&
            (creating ? (
              <div className="space-y-2 border-t border-slate-800 bg-slate-900/60 p-2.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreate();
                    }
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                      setCreateErr("");
                    }
                  }}
                  placeholder={`New ${label.toLowerCase()} name`}
                  className="w-full rounded-lg border border-sky-500/40 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none focus:border-sky-400"
                />
                {createErr && (
                  <p className="text-[10px] text-rose-300">{createErr}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={busyCreate}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-[11px] font-bold text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    {busyCreate && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                      setCreateErr("");
                    }}
                    disabled={busyCreate}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center justify-center gap-1.5 border-t border-slate-800 bg-slate-900/40 px-3 py-2.5 text-[11px] font-bold text-sky-300 transition-colors hover:bg-sky-500/10"
              >
                <Plus className="h-3.5 w-3.5" />
                {createLabel ?? `Create new ${label.toLowerCase()}`}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CSV helpers                                                        */
/* ------------------------------------------------------------------ */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value.trim());
      value = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else value += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quotation mark.");
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

const csvHeaderKey = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export function ManageView(props: Props) {
  const [section, setSection] = useState<Section>("products");
  const [dialog, setDialog] = useState<"create" | "edit" | "stock" | null>(
    null,
  );
  const [expandedVariant, setExpandedVariant] = useState<number | null>(0);
  const [editing, setEditing] = useState<any>(null);
  const [fields, setFields] = useState<Fields>({ ...emptyProduct });
  const [stockFields, setStockFields] = useState({
    productId: "",
    variantId: "",
    mode: "IN",
    movementType: "ADJUSTMENT" as "ADJUSTMENT" | "DAMAGE" | "EXPIRED",
    quantity: "",
    reason: "",
  });
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedQrProduct, setSelectedQrProduct] = useState("");
  const [qrData, setQrData] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  /* Locally created records (so newly added ComboSelect items appear without refresh) */
  const [localCreated, setLocalCreated] = useState<Record<string, any[]>>({});
  const mergeCreated = (sectionKey: EntitySection, list: any[]) => [
    ...list,
    ...(localCreated[sectionKey] ?? []),
  ];
  const rememberCreated = (sectionKey: EntitySection, item: any) => {
    if (!item?.id) return;
    setLocalCreated((prev) => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] ?? []), item],
    }));
  };

  /* Stock adjustment left-panel search */
  const [stockSearch, setStockSearch] = useState("");

  const selectedProduct =
    props.products.find((product) => product.id === selectedQrProduct) ??
    props.products[0];
  const stockProduct = props.products.find(
    (product) => product.id === stockFields.productId,
  );
  const stockVariant = stockProduct?.variants?.find(
    (variant) => variant.id === stockFields.variantId,
  );
  const currentStock = Number(stockVariant?.stock ?? 0);
  const enteredStockDelta =
    Number(stockFields.quantity || 0) * (stockFields.mode === "OUT" ? -1 : 1);
  const resultingStock = currentStock + enteredStockDelta;

  const activeSection =
    section === "stock" ? "products" : section === "qr" ? "products" : section;
  const rows = listFor(activeSection, props);
  const filteredRows = useMemo(
    () =>
      rows.filter((item: any) =>
        `${item.name ?? ""} ${item.sku ?? ""} ${item.code ?? ""} ${item.email ?? ""} ${item.phone ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [rows, search],
  );

  const totalItems = filteredRows.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
  const activePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize <= 0) return filteredRows;
    const start = (activePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, activePage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const endItem =
    pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

  useEffect(() => {
    const value = selectedProduct?.barcode || selectedProduct?.sku;
    if (!value) {
      setQrData("");
      return;
    }
    let disposed = false;
    void QRCode.toDataURL(value, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!disposed) setQrData(url);
      })
      .catch(() => setQrData(""));
    return () => {
      disposed = true;
    };
  }, [selectedProduct?.id, selectedProduct?.barcode, selectedProduct?.sku]);

  const [variantInputs, setVariantInputs] = useState<
    {
      id?: string;
      name: string;
      sku: string;
      price: string;
      costPrice?: string;
      barcode?: string;
      initialStock?: string;
      wholesalePrice?: string;
      wholesaleMinQuantity?: string;
      color?: string;
      size?: string;
      manufacturingDate?: string;
      expiryDate?: string;
      bestBeforeDate?: string;
      unitFactor?: string;
    }[]
  >([]);

  const slugifySkuToken = (str: string) =>
    str
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);

  const generateVariantSku = (productName?: string, variantName?: string) => {
    const prodCode = productName ? slugifySkuToken(productName) : "PRD";
    const varCode = variantName ? slugifySkuToken(variantName) : "VAR";
    const randomSuffix = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${prodCode || "ITEM"}-${varCode || "OPT"}-${randomSuffix}`;
  };

  const generateVariantBarcode = () =>
    `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

  const addVariantInput = () => {
    setVariantInputs((prev) => [
      ...prev,
      {
        name: "",
        sku: generateVariantSku(fields.name, `VAR-${prev.length + 1}`),
        price: "",
        costPrice: "",
        barcode: generateVariantBarcode(),
        initialStock: "0",
        wholesalePrice: "",
        wholesaleMinQuantity: "1",
        color: "",
        size: "",
        manufacturingDate: "",
        expiryDate: "",
        bestBeforeDate: "",
        unitFactor: "1",
      },
    ]);
  };

  const removeVariantInput = (index: number) => {
    setVariantInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const setField = (key: string, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const updateVariantInput = (index: number, key: string, value: string) => {
    setVariantInputs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const openCreate = () => {
    setFields({
      ...emptyProduct,
      name: "",
      categoryId: props.categories[0]?.id ?? "",
      initialStock: "0",
    });
    setVariantInputs([
      {
        name: "Each",
        sku: generateVariantSku("ITEM", "EACH"),
        price: "",
        costPrice: "",
        barcode: generateVariantBarcode(),
        initialStock: "0",
        wholesalePrice: "",
        wholesaleMinQuantity: "1",
        color: "",
        size: "",
        manufacturingDate: "",
        expiryDate: "",
        bestBeforeDate: "",
        unitFactor: "1",
      },
    ]);
    setStaffPermissions([]);
    setExpandedVariant(0);
    setDialog("create");
    setError(null);
    setNotice(null);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const values: Fields =
      section === "products"
        ? {
            name: item.name || "",
            imageUrl: item.imageUrl || item.image || "",
            categoryId: item.categoryId || "",
            brandId: item.brandId || "",
            supplierId: item.supplierId || "",
            costPrice: String(item.costPrice ?? ""),
            sellingPrice: String(item.price ?? ""),
            genericName: item.genericName || "",
            activeIngredient: item.activeIngredient || "",
            strength: item.strength || "",
            dosageForm: item.dosageForm || "",
            manufacturer: item.manufacturer || "",
            registrationNumber: item.registrationNumber || "",
            baseUnitName: item.baseUnitName || "",
          }
        : Object.fromEntries(
            formFields[section as EntitySection].map(({ name }) => [
              name,
              name === "password" ? "" : String(item[name] ?? ""),
            ]),
          );
    setFields(values);
    if (section === "products" && item.variants?.length) {
      setVariantInputs(
        [...item.variants]
          .sort(
            (a: any, b: any) =>
              Number(b.id === item.baseUnitVariantId) -
              Number(a.id === item.baseUnitVariantId),
          )
          .map((v: any) => ({
            id: v.id,
            name: v.name || "",
            sku: v.sku || generateVariantSku(),
            price: String(v.price ?? ""),
            costPrice: String(v.costPrice ?? ""),
            barcode: v.barcode || generateVariantBarcode(),
            initialStock: String(v.stock ?? 0),
            wholesalePrice:
              v.wholesalePrice == null ? "" : String(v.wholesalePrice),
            wholesaleMinQuantity: String(v.wholesaleMinQuantity ?? 1),
            unitFactor: String(v.unitFactor ?? 1),
            color: v.color || "",
            size: v.size || "",
            manufacturingDate: v.manufacturingDate || "",
            expiryDate: v.expiryDate || "",
            bestBeforeDate: v.bestBeforeDate || "",
          })),
      );
    } else {
      setVariantInputs(
        section === "products"
          ? [
              {
                name: "Each",
                sku: generateVariantSku(),
                price: String(item.price ?? 0),
                costPrice: String(item.costPrice ?? 0),
                barcode: generateVariantBarcode(),
                initialStock: String(item.stock ?? 0),
                wholesalePrice: "",
                wholesaleMinQuantity: "1",
                color: "",
                size: "",
                manufacturingDate: "",
                expiryDate: "",
                bestBeforeDate: "",
                unitFactor: "1",
              },
            ]
          : [],
      );
    }
    setStaffPermissions(item.permissions ?? []);
    setExpandedVariant(0);
    setDialog("edit");
    setError(null);
    setNotice(null);
  };

  const openStock = (productId = "") => {
    if (!props.storeId) {
      setError("Select a store before adjusting stock.");
      return;
    }
    setStockFields({
      productId,
      variantId: "",
      mode: "IN",
      movementType: "ADJUSTMENT",
      quantity: "",
      reason: "",
    });
    setStockSearch("");
    setDialog("stock");
    setError(null);
    setNotice(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (dialog === "stock") {
        const quantity = Number(stockFields.quantity);
        if (
          !stockFields.productId ||
          !stockFields.variantId ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          !stockFields.reason.trim()
        )
          throw new Error(
            "Choose a product option, enter a positive whole quantity, and add a reason.",
          );
        if (resultingStock < 0)
          throw new Error(
            "You cannot remove more stock than this option currently has.",
          );
        await props.onAdjustStock(
          stockFields.productId,
          stockFields.variantId || undefined,
          stockFields.mode === "IN" ? quantity : -quantity,
          stockFields.reason.trim(),
          stockFields.mode === "OUT" ? stockFields.movementType : "ADJUSTMENT",
        );
        setNotice("Stock adjustment saved to the server.");
      } else if (dialog === "edit") {
        if (!editing?.id) throw new Error("Select a record to edit.");
        const payload: Record<string, unknown> = {};
        if (section === "products") {
          payload.name = fields.name.trim();
          payload.imageUrl = fields.imageUrl || undefined;
          for (const key of ["sku", "barcode"] as const)
            if (fields[key]?.trim()) payload[key] = fields[key].trim();
          if (fields.costPrice !== "")
            payload.costPrice = Number(fields.costPrice);
          if (fields.categoryId) payload.categoryId = fields.categoryId;
          if (fields.brandId) payload.brandId = fields.brandId;
          if (fields.supplierId) payload.supplierId = fields.supplierId;
          payload.genericName = fields.genericName?.trim() || undefined;
          payload.activeIngredient =
            fields.activeIngredient?.trim() || undefined;
          payload.strength = fields.strength?.trim() || undefined;
          payload.dosageForm = fields.dosageForm?.trim() || undefined;
          payload.manufacturer = fields.manufacturer?.trim() || undefined;
          payload.registrationNumber =
            fields.registrationNumber?.trim() || undefined;
          payload.baseUnitName = fields.baseUnitName?.trim() || "";
          payload.baseUnitVariantId = fields.baseUnitName?.trim()
            ? editing.baseUnitVariantId
            : undefined;
          if (variantInputs.length > 0) {
            payload.sellingPrice = Number(variantInputs[0].price) || 0;
            payload.costPrice = Number(variantInputs[0].costPrice) || 0;
            payload.variants = variantInputs.map((v) => ({
              id: v.id,
              name: v.name.trim(),
              sku: v.sku.trim() || undefined,
              price: Number(v.price) || Number(fields.sellingPrice) || 0,
              costPrice: v.costPrice ? Number(v.costPrice) : undefined,
              barcode: v.barcode?.trim() || undefined,
              wholesalePrice: v.wholesalePrice
                ? Number(v.wholesalePrice)
                : undefined,
              wholesaleMinQuantity: Math.max(
                1,
                Number(v.wholesaleMinQuantity) || 1,
              ),
              unitFactor: Math.max(1, Math.floor(Number(v.unitFactor) || 1)),
              color: v.color?.trim() || undefined,
              size: v.size?.trim() || undefined,
              manufacturingDate: v.manufacturingDate || undefined,
              expiryDate: v.expiryDate || undefined,
              bestBeforeDate: v.bestBeforeDate || undefined,
            }));
          }
        } else {
          for (const field of formFields[section as EntitySection]) {
            const value = fields[field.name]?.trim();
            if (value && field.name !== "password") payload[field.name] = value;
          }
          if (section === "staff") {
            payload.permissions = staffPermissions;
            if (fields.password?.trim())
              payload.password = fields.password.trim();
            if (props.storeId) payload.storeId = props.storeId;
          }
        }
        await props.onUpdateEntity(
          section as EntitySection,
          editing.id,
          payload,
        );
        setNotice(`${labels[section as EntitySection]} updated successfully.`);
      } else if (section === "products") {
        if (!props.storeId)
          throw new Error("Select a store before creating a product.");
        const parsedVariants = variantInputs
          .filter((v) => v.name.trim())
          .map((v, idx) => ({
            name: v.name.trim(),
            sku:
              v.sku.trim() ||
              generateVariantSku(fields.name, v.name.trim() || `VAR${idx + 1}`),
            price: Number(v.price) || Number(fields.sellingPrice) || 0,
            costPrice: v.costPrice ? Number(v.costPrice) : undefined,
            barcode: v.barcode?.trim() || generateVariantBarcode(),
            initialStock: Math.max(0, Math.floor(Number(v.initialStock) || 0)),
            wholesalePrice: v.wholesalePrice
              ? Number(v.wholesalePrice)
              : undefined,
            wholesaleMinQuantity: Math.max(
              1,
              Number(v.wholesaleMinQuantity) || 1,
            ),
            unitFactor: Math.max(1, Math.floor(Number(v.unitFactor) || 1)),
            color: v.color?.trim() || undefined,
            size: v.size?.trim() || undefined,
            manufacturingDate: v.manufacturingDate || undefined,
            expiryDate: v.expiryDate || undefined,
            bestBeforeDate: v.bestBeforeDate || undefined,
          }));

        if (!parsedVariants.length)
          throw new Error("Add at least one named sellable option.");
        const primaryVariant = parsedVariants[0];

        await props.onCreateProduct({
          name: fields.name.trim(),
          imageUrl: fields.imageUrl || undefined,
          sku: fields.sku.trim() || undefined,
          barcode: fields.barcode.trim() || undefined,
          categoryId: fields.categoryId || undefined,
          brandId: fields.brandId || undefined,
          supplierId: fields.supplierId || undefined,
          costPrice: primaryVariant.costPrice || 0,
          sellingPrice: primaryVariant.price,
          storeId: props.storeId,
          variants: parsedVariants.length > 0 ? parsedVariants : undefined,
          genericName: fields.genericName?.trim() || undefined,
          activeIngredient: fields.activeIngredient?.trim() || undefined,
          strength: fields.strength?.trim() || undefined,
          dosageForm: fields.dosageForm?.trim() || undefined,
          manufacturer: fields.manufacturer?.trim() || undefined,
          registrationNumber: fields.registrationNumber?.trim() || undefined,
          baseUnitName: fields.baseUnitName?.trim() || undefined,
        });
        setNotice("Product created with variants and linked to store.");
      } else {
        const payload: Record<string, unknown> = {};
        for (const field of formFields[section as EntitySection]) {
          const value = fields[field.name]?.trim();
          if (value) payload[field.name] = value;
        }
        if (section === "staff") {
          if (props.userRole === "MANAGER" && !props.storeId) {
            throw new Error(
              "Your account has no assigned store. Ask an admin to assign one first.",
            );
          }
          payload.permissions = staffPermissions;
          payload.isActive = true;
          payload.role ||= "CASHIER";
          if (props.storeId) payload.storeId = props.storeId;
        }
        if (section === "customers" && !payload.tier) payload.tier = "BRONZE";
        await props.onCreateEntity(section as EntitySection, payload);
        setNotice(`${labels[section as EntitySection]} added successfully.`);
      }
      setDialog(null);
    } catch (cause) {
      const err = cause as { data?: { message?: string }; message?: string };
      setError(
        err.data?.message || err.message || "Could not save this change.",
      );
    } finally {
      setBusy(false);
    }
  };

  /* ------------ Inline-created records ------------ */
  const createCategoryInline = async (name: string) => {
    const created = (await props.onCreateEntity("categories", {
      name,
    })) as any;
    if (created?.id) {
      const item = { id: created.id, name };
      rememberCreated("categories", item);
      return item;
    }
    return { id: "", name };
  };
  const createBrandInline = async (name: string) => {
    const created = (await props.onCreateEntity("brands", { name })) as any;
    if (created?.id) {
      const item = { id: created.id, name };
      rememberCreated("brands", item);
      return item;
    }
    return { id: "", name };
  };
  const createSupplierInline = async (name: string) => {
    const created = (await props.onCreateEntity("suppliers", {
      name,
    })) as any;
    if (created?.id) {
      const item = { id: created.id, name };
      rememberCreated("suppliers", item);
      return item;
    }
    return { id: "", name };
  };

  const printQr = () => {
    if (!selectedProduct || !qrData) return;
    const popup = window.open("", "kanitt-label", "width=500,height=500");
    if (!popup) {
      setError(
        "The print window was blocked. Allow pop-ups for this app and retry.",
      );
      return;
    }
    const title = selectedProduct.name.replace(/[&<>"']/g, "");
    const code = (selectedProduct.barcode || selectedProduct.sku).replace(
      /[&<>"']/g,
      "",
    );
    popup.document.write(
      `<!doctype html><html><head><title>QR label</title><style>body{font:14px Arial;text-align:center;padding:24px}.label{border:1px dashed #999;padding:20px;display:inline-block;max-width:300px}img{width:200px;height:200px}h2{font-size:18px}</style></head><body><article class="label"><h2>${title}</h2><img src="${qrData}"/><p>${code}</p><p>${Number(selectedProduct.price).toLocaleString()} MMK</p></article><script>window.onload=()=>window.print()</script></body></html>`,
    );
    popup.document.close();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadExcelTemplate = () => {
    const headers =
      "Product Name,Product SKU,Product Barcode,Category Name,Brand Name,Supplier Name,Generic Name,Active Ingredient,Strength,Dosage Form,Manufacturer,Registration Number,Base Unit,Variant Name,Variant SKU,Variant Barcode,Selling Price,Cost Price,Variant Initial Stock,Base Units per Variant,Wholesale Price,Min Wholesale Qty,Color,Size,Mfg Date,Expiry Date,Best Before Date\n";
    const exampleRow1 =
      "Sample T-Shirt,TSHIRT-001,,Apparel,Nike,Main Supplier,,,,,,,,Red / M,TS-1001-RED-M,885000100101,7500,5000,25,1,7000,10,Red,M,2026-01-01,,\n";
    const exampleRow2 =
      "Sample T-Shirt,TSHIRT-001,,Apparel,Nike,Main Supplier,,,,,,,,Blue / L,TS-1001-BLUE-L,885000100102,7800,5100,25,1,7200,10,Blue,L,2026-01-01,,\n";
    const exampleRow3 =
      "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Tablet,PCM-500-TAB,885000200199,200,100,0,1,180,10,,,,2025-06-01,2028-06-01,\n";
    const exampleRow4 =
      "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Strip (10s),PCM-500-STRIP,885000200200,1800,900,0,10,1600,10,,,,2025-06-01,2028-06-01,\n";
    const exampleRow5 =
      "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Box (100s),PCM-500-BOX,885000200201,12000,9000,20,100,11000,5,,,,2025-06-01,2028-06-01,\n";
    const blob = new Blob(
      [
        "\uFEFF",
        headers,
        exampleRow1,
        exampleRow2,
        exampleRow3,
        exampleRow4,
        exampleRow5,
      ],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Kanitt_Product_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ---------------------------------------------------------------- */
  /*  CSV import with auto-create for missing categories/brands/suppliers */
  /* ---------------------------------------------------------------- */
  const handleExcelFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError(
        "This importer accepts CSV files only. Save the Excel file as CSV UTF-8, then import that CSV.",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!props.storeId) {
      setError("Please select an active store before importing products.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setBusy(true);
    setError(null);
    setNotice("Reading product template...");

    /* Working caches (auto-created items are remembered for subsequent rows) */
    const categoryCache: any[] = [...props.categories];
    const brandCache: any[] = [...props.brands];
    const supplierCache: any[] = [...props.suppliers];
    const autoCreatedCategories: string[] = [];
    const autoCreatedBrands: string[] = [];
    const autoCreatedSuppliers: string[] = [];

    const findByName = (list: any[], name: string) =>
      list.find(
        (item: any) =>
          String(item.name ?? "")
            .trim()
            .toLowerCase() === name.trim().toLowerCase(),
      );

    const ensureCategory = async (name: string) => {
      if (!name) return undefined;
      let found = findByName(categoryCache, name);
      if (found) return found;
      try {
        const created = (await props.onCreateEntity("categories", {
          name,
          description: "Auto-created from CSV import",
        })) as any;
        if (created?.id) {
          found = { id: created.id, name };
          categoryCache.push(found);
          autoCreatedCategories.push(name);
        }
      } catch {
        /* ignore — will be reported below if still not found */
      }
      return found;
    };
    const ensureBrand = async (name: string) => {
      if (!name) return undefined;
      let found = findByName(brandCache, name);
      if (found) return found;
      try {
        const created = (await props.onCreateEntity("brands", {
          name,
          description: "Auto-created from CSV import",
        })) as any;
        if (created?.id) {
          found = { id: created.id, name };
          brandCache.push(found);
          autoCreatedBrands.push(name);
        }
      } catch {
        /* ignore */
      }
      return found;
    };
    const ensureSupplier = async (name: string) => {
      if (!name) return undefined;
      let found = findByName(supplierCache, name);
      if (found) return found;
      try {
        const created = (await props.onCreateEntity("suppliers", {
          name,
        })) as any;
        if (created?.id) {
          found = { id: created.id, name };
          supplierCache.push(found);
          autoCreatedSuppliers.push(name);
        }
      } catch {
        /* ignore */
      }
      return found;
    };

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2)
        throw new Error("The CSV is empty or has no product rows.");
      const headers = rows[0].map(csvHeaderKey);
      const findColumn = (...names: string[]) =>
        headers.findIndex((header) => names.includes(header));
      const columns = {
        name: findColumn("productname", "name"),
        category: findColumn("categoryname", "category"),
        brand: findColumn("brandname", "brand"),
        supplier: findColumn("suppliername", "supplier"),
        genericName: findColumn("genericname", "generic"),
        activeIngredient: findColumn("activeingredient", "ingredient"),
        strength: findColumn("strength", "dose"),
        dosageForm: findColumn("dosageform", "form"),
        manufacturer: findColumn("manufacturer", "maker"),
        registrationNumber: findColumn(
          "registrationnumber",
          "registrationid",
          "drugregistration",
        ),
        baseUnit: findColumn("baseunit", "stockbaseunit", "smallestunit"),
        productSku: findColumn("productsku", "mastersku"),
        productBarcode: findColumn("productbarcode", "masterbarcode"),
        variant: findColumn("variantname", "optionname", "variant"),
        variantSku: findColumn("variantsku", "optionsku", "sku"),
        variantBarcode: findColumn(
          "variantbarcode",
          "optionbarcode",
          "barcode",
        ),
        price: findColumn("sellingprice", "price", "variantprice"),
        cost: findColumn("costprice", "cost"),
        stock: findColumn(
          "variantinitialstock",
          "variantstock",
          "initialstock",
          "startingstock",
          "stock",
          "quantity",
        ),
        unitFactor: findColumn(
          "baseunitspervariant",
          "unitfactor",
          "packconversion",
          "conversionfactor",
        ),
        wholesalePrice: findColumn("wholesaleprice", "wholesalecost"),
        wholesaleMinQuantity: findColumn(
          "minwholesaleqty",
          "wholesaleqty",
          "minwholesalequantity",
        ),
        color: findColumn("color", "colour"),
        size: findColumn("size"),
        manufacturingDate: findColumn("mfgdate", "manufacturingdate"),
        expiryDate: findColumn("expirydate", "expdate"),
        bestBeforeDate: findColumn("bestbeforedate", "bestbefore"),
      };
      if (columns.name < 0 || columns.price < 0) {
        throw new Error(
          "Template headers are missing. Use the downloaded template with Product Name and Selling Price columns.",
        );
      }

      const products = new Map<
        string,
        {
          name: string;
          sku: string;
          barcode: string;
          categoryName: string;
          brandName: string;
          supplierName: string;
          genericName: string;
          activeIngredient: string;
          strength: string;
          dosageForm: string;
          manufacturer: string;
          registrationNumber: string;
          baseUnitName: string;
          variants: Record<string, unknown>[];
        }
      >();

      for (const [index, row] of rows.slice(1).entries()) {
        const cell = (column: number) =>
          column < 0 ? "" : String(row[column] ?? "").trim();
        const name = cell(columns.name);
        if (!name)
          throw new Error(`Row ${index + 2}: Product Name is required.`);
        const variantName = cell(columns.variant) || "Each";
        const productSku = cell(columns.productSku);
        const productBarcode = cell(columns.productBarcode);
        const priceText = cell(columns.price).replace(/,/g, "");
        const costText = cell(columns.cost).replace(/,/g, "");
        const stockText = cell(columns.stock).replace(/,/g, "");
        const price = Number(priceText);
        const costPrice = costText ? Number(costText) : 0;
        const initialStock = stockText ? Number(stockText) : 0;
        const baseUnitName = cell(columns.baseUnit);
        const unitFactorText = cell(columns.unitFactor).replace(/,/g, "");
        const unitFactor = unitFactorText ? Number(unitFactorText) : 1;

        if (!priceText || !Number.isFinite(price) || price < 0)
          throw new Error(
            `Row ${index + 2}: Selling Price must be a valid non-negative number.`,
          );
        if (!Number.isFinite(costPrice) || costPrice < 0)
          throw new Error(
            `Row ${index + 2}: Cost Price must be a valid non-negative number.`,
          );
        if (!Number.isInteger(initialStock) || initialStock < 0)
          throw new Error(
            `Row ${index + 2}: Initial Stock must be a non-negative whole number.`,
          );
        if (!Number.isInteger(unitFactor) || unitFactor < 1)
          throw new Error(
            `Row ${index + 2}: Base Units per Variant must be a positive whole number.`,
          );
        if (!baseUnitName && unitFactor !== 1)
          throw new Error(
            `Row ${index + 2}: Set a Base Unit before using a pack conversion.`,
          );

        const categoryName = cell(columns.category);
        const brandName = cell(columns.brand);
        const supplierName = cell(columns.supplier);
        const medicine = {
          genericName: cell(columns.genericName),
          activeIngredient: cell(columns.activeIngredient),
          strength: cell(columns.strength),
          dosageForm: cell(columns.dosageForm),
          manufacturer: cell(columns.manufacturer),
          registrationNumber: cell(columns.registrationNumber),
        };

        const wholesalePriceText = cell(columns.wholesalePrice).replace(
          /,/g,
          "",
        );
        const wholesaleMinQtyText = cell(columns.wholesaleMinQuantity).replace(
          /,/g,
          "",
        );

        const variantObj: Record<string, unknown> = {
          name: variantName,
          sku:
            cell(columns.variantSku) || generateVariantSku(name, variantName),
          barcode: cell(columns.variantBarcode) || generateVariantBarcode(),
          price,
          costPrice,
          initialStock,
          unitFactor,
          wholesalePrice: wholesalePriceText
            ? Number(wholesalePriceText)
            : undefined,
          wholesaleMinQuantity: wholesaleMinQtyText
            ? Number(wholesaleMinQtyText)
            : undefined,
          color: cell(columns.color) || undefined,
          size: cell(columns.size) || undefined,
          manufacturingDate: cell(columns.manufacturingDate) || undefined,
          expiryDate: cell(columns.expiryDate) || undefined,
          bestBeforeDate: cell(columns.bestBeforeDate) || undefined,
        };

        const key = (productSku || name).toLocaleLowerCase();
        const product = products.get(key) ?? {
          name,
          sku: productSku,
          barcode: productBarcode,
          categoryName,
          brandName,
          supplierName,
          ...medicine,
          baseUnitName,
          variants: [],
        };

        if (product.name.toLocaleLowerCase() !== name.toLocaleLowerCase()) {
          throw new Error(
            `Rows for product SKU "${productSku}" use different product names.`,
          );
        }

        if (
          product.categoryName &&
          categoryName &&
          product.categoryName.toLocaleLowerCase() !==
            categoryName.toLocaleLowerCase()
        ) {
          throw new Error(
            `Rows for "${name}" use different categories. Keep one category per product.`,
          );
        }
        if (!product.categoryName) product.categoryName = categoryName;
        if (
          product.sku &&
          productSku &&
          product.sku.toLowerCase() !== productSku.toLowerCase()
        ) {
          throw new Error(`Rows for "${name}" use different product SKUs.`);
        }
        if (
          product.barcode &&
          productBarcode &&
          product.barcode !== productBarcode
        ) {
          throw new Error(`Rows for "${name}" use different product barcodes.`);
        }
        if (!product.brandName) product.brandName = brandName;
        if (!product.supplierName) product.supplierName = supplierName;
        if (
          product.baseUnitName &&
          baseUnitName &&
          product.baseUnitName.toLocaleLowerCase() !==
            baseUnitName.toLocaleLowerCase()
        ) {
          throw new Error(`Rows for "${name}" use different Base Units.`);
        }
        if (!product.baseUnitName) product.baseUnitName = baseUnitName;

        product.variants.push(variantObj);
        products.set(key, product);
      }

      let successCount = 0;
      let importedOptionCount = 0;
      const failures: string[] = [];

      for (const product of products.values()) {
        /* Auto-create category/brand/supplier if missing */
        const category = product.categoryName
          ? await ensureCategory(product.categoryName)
          : undefined;
        const brand = product.brandName
          ? await ensureBrand(product.brandName)
          : undefined;
        const supplier = product.supplierName
          ? await ensureSupplier(product.supplierName)
          : undefined;

        if (product.categoryName && !category) {
          failures.push(
            `${product.name}: category "${product.categoryName}" could not be created`,
          );
          continue;
        }

        const primaryVariant = product.variants[0] as any;
        if (
          product.baseUnitName &&
          Number(primaryVariant.unitFactor ?? 1) !== 1
        ) {
          failures.push(
            `${product.name}: put the base-unit option (conversion 1) on the first row for this product`,
          );
          continue;
        }

        try {
          await props.onCreateProduct({
            name: product.name,
            sku: product.sku || serial(),
            barcode: product.barcode || undefined,
            categoryId: category?.id,
            brandId: brand?.id,
            supplierId: supplier?.id,
            storeId: props.storeId,
            sellingPrice: primaryVariant.price,
            costPrice: primaryVariant.costPrice,
            genericName: product.genericName || undefined,
            activeIngredient: product.activeIngredient || undefined,
            strength: product.strength || undefined,
            dosageForm: product.dosageForm || undefined,
            manufacturer: product.manufacturer || undefined,
            registrationNumber: product.registrationNumber || undefined,
            baseUnitName: product.baseUnitName || undefined,
            variants: product.variants,
          });
          successCount++;
          importedOptionCount += product.variants.length;
        } catch (cause) {
          const error = cause as {
            data?: { message?: string };
            message?: string;
          };
          failures.push(
            `${product.name}: ${error.data?.message || error.message || "could not be imported"}`,
          );
        }
      }

      /* Refresh local create-tracking so newly auto-created options appear in ComboSelect */
      if (autoCreatedCategories.length) {
        setLocalCreated((prev) => ({
          ...prev,
          categories: [
            ...(prev.categories ?? []),
            ...categoryCache.slice(props.categories.length),
          ],
        }));
      }
      if (autoCreatedBrands.length) {
        setLocalCreated((prev) => ({
          ...prev,
          brands: [
            ...(prev.brands ?? []),
            ...brandCache.slice(props.brands.length),
          ],
        }));
      }
      if (autoCreatedSuppliers.length) {
        setLocalCreated((prev) => ({
          ...prev,
          suppliers: [
            ...(prev.suppliers ?? []),
            ...supplierCache.slice(props.suppliers.length),
          ],
        }));
      }

      const autoBits: string[] = [];
      if (autoCreatedCategories.length)
        autoBits.push(
          `${autoCreatedCategories.length} categor${autoCreatedCategories.length === 1 ? "y" : "ies"}`,
        );
      if (autoCreatedBrands.length)
        autoBits.push(
          `${autoCreatedBrands.length} brand${autoCreatedBrands.length === 1 ? "" : "s"}`,
        );
      if (autoCreatedSuppliers.length)
        autoBits.push(
          `${autoCreatedSuppliers.length} supplier${autoCreatedSuppliers.length === 1 ? "" : "s"}`,
        );

      setNotice(
        `Imported ${successCount} product${successCount === 1 ? "" : "s"} with ${importedOptionCount} sellable option${importedOptionCount === 1 ? "" : "s"}.${autoBits.length ? ` Auto-created ${autoBits.join(", ")}.` : ""}`,
      );
      if (failures.length)
        setError(
          `Could not import ${failures.length} product${failures.length === 1 ? "" : "s"}: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "; see the file and try again" : ""}`,
        );
    } catch (err: any) {
      setError(err.message || "Failed to process import file.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ---------------------- option lists ---------------------- */
  const categoryOptions = mergeCreated("categories", props.categories).map(
    (c: any) => ({
      id: c.id,
      name: c.name,
      meta: c.description || undefined,
    }),
  );
  const brandOptions = mergeCreated("brands", props.brands).map((b: any) => ({
    id: b.id,
    name: b.name,
    meta: b.description || undefined,
  }));
  const supplierOptions = mergeCreated("suppliers", props.suppliers).map(
    (s: any) => ({
      id: s.id,
      name: s.name,
      meta: [s.code, s.phone].filter(Boolean).join(" · ") || undefined,
    }),
  );

  /* Filtered list for the stock adjustment left panel */
  const stockFilteredProducts = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return props.products;
    return props.products.filter((product) =>
      `${product.name} ${product.sku ?? ""} ${product.barcode ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [props.products, stockSearch]);

  /* ---------------------- render ---------------------- */
  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
            Workspace tools
          </p>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
            Manage
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Catalog, stock, people and customer records for{" "}
            {props.stores.find((store) => store.id === props.storeId)?.name ??
              "your workspace"}
            .
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
          {props.loading ? "Refreshing data…" : "Live server data"}
        </span>
      </header>

      <nav className="mb-5 flex flex-wrap gap-2">
        {sections
          .filter(
            ({ id }) =>
              id !== "stores" ||
              props.userRole === "ADMIN" ||
              props.userRole === "SUPER_ADMIN",
          )
          .map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setSearch("");
                setNotice(null);
                setError(null);
              }}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
                section === id
                  ? "border-sky-400/50 bg-sky-400/10 text-sky-200"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {title}
            </button>
          ))}
      </nav>

      {error && !dialog && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </p>
      )}
      {notice && !dialog && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          {notice}
        </p>
      )}

      {section === "stock" ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-bold text-white">Adjust store stock</h2>
          <p className="mb-5 mt-1 text-sm text-slate-400">
            Search by product name, SKU or barcode. Updates apply to{" "}
            {props.stores.find((store) => store.id === props.storeId)?.name ||
              "the selected store"}{" "}
            and are recorded in the stock movement history.
          </p>
          <button
            onClick={() => openStock()}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            New adjustment
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Requires an ADMIN or MANAGER account with inventory permission.
          </p>
        </section>
      ) : section === "qr" ? (
        <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="flex items-center gap-3 border-b border-slate-800 p-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find product by name, SKU or code"
                className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
              />
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
              {filteredRows.map((product: Product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedQrProduct(product.id)}
                  className={`flex w-full items-center justify-between border-b border-slate-800/70 px-4 py-3 text-left ${
                    selectedQrProduct === product.id
                      ? "bg-sky-500/10"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-100">
                      {product.name}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-slate-500">
                      {product.barcode || product.sku}
                    </span>
                  </span>
                  <Barcode className="h-4 w-4 text-sky-300" />
                </button>
              ))}
            </div>
          </div>
          <aside className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center">
            <h2 className="font-bold text-white">QR label preview</h2>
            {selectedProduct && qrData ? (
              <>
                <img
                  src={qrData}
                  alt={`QR for ${selectedProduct.name}`}
                  className="mt-4 h-52 w-52 rounded-xl bg-white p-2"
                />
                <p className="mt-3 text-sm font-semibold text-slate-200">
                  {selectedProduct.name}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {selectedProduct.barcode || selectedProduct.sku}
                </p>
                <div className="mt-4 flex w-full gap-2">
                  <button
                    onClick={async () => {
                      if (!selectedProduct.barcode) {
                        const value = serial();
                        try {
                          await props.onAssignBarcode(
                            selectedProduct.id,
                            value,
                          );
                          setNotice(`QR/barcode ${value} assigned.`);
                        } catch (cause) {
                          const err = cause as {
                            data?: { message?: string };
                            message?: string;
                          };
                          setError(
                            err.data?.message ||
                              err.message ||
                              "Could not assign barcode.",
                          );
                          return;
                        }
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
                  >
                    {selectedProduct.barcode ? "Code assigned" : "Assign code"}
                  </button>
                  <button
                    onClick={printQr}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-sky-400"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-10 text-sm text-slate-500">
                Select a product with a SKU to preview its QR code.
              </p>
            )}
          </aside>
        </section>
      ) : (
        <>
          <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-[280px] flex-1 items-center gap-3">
              <div className="relative min-w-64 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={`Search ${section}…`}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={0}>All ({totalItems})</option>
                </select>
              </label>

              {section === "products" && (
                <>
                  <button
                    onClick={downloadExcelTemplate}
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                    title="Download UTF-8 CSV product template"
                  >
                    <Download className="h-4 w-4 text-emerald-400" />
                    Template
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,text/csv"
                    onChange={handleExcelFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                    title="Import products from a CSV file (missing categories/brands/suppliers are auto-created)"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Import CSV
                  </button>
                  <button
                    onClick={() => openStock()}
                    className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-900"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Adjust stock
                  </button>
                </>
              )}
              <button
                onClick={openCreate}
                className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400"
              >
                <Plus className="h-4 w-4" />
                Add {labels[section as EntitySection]}
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Name</span>
              <span>
                {section === "products"
                  ? "SKU / barcode"
                  : section === "stores"
                    ? "Store code"
                    : section === "staff"
                      ? "Role"
                      : "Contact"}
              </span>
              <span>
                {section === "products"
                  ? "Price"
                  : section === "stores"
                    ? "Status"
                    : "Code / status"}
              </span>
              <span>
                {section === "stores" ? "Address / phone" : "Details"}
              </span>
            </div>
            {paginatedRows.map((item: any) => (
              <div
                key={item.id}
                className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-slate-800/70 px-5 py-3.5 last:border-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {section === "products" &&
                    (item.imageUrl || item.image ? (
                      <img
                        src={resolveMediaUrl(item.imageUrl || item.image)}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-lg bg-slate-800 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
                        <Package className="h-4 w-4" />
                      </div>
                    ))}
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-100">
                      {item.name}
                    </span>
                    {section === "products" &&
                      (item.genericName ||
                        item.activeIngredient ||
                        item.strength ||
                        item.dosageForm) && (
                        <span className="mt-0.5 block truncate text-[11px] font-medium text-emerald-400/90">
                          {[
                            item.genericName,
                            item.activeIngredient,
                            item.strength,
                            item.dosageForm,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                  </div>
                </div>
                <span className="truncate font-mono text-xs text-slate-400">
                  {section === "products"
                    ? `${item.sku || "—"} · ${item.barcode || "—"}`
                    : section === "stores"
                      ? item.code || "—"
                      : section === "staff"
                        ? item.role
                        : item.email || item.phone || item.contactName || "—"}
                </span>
                <span className="truncate text-xs text-slate-400">
                  {section === "products"
                    ? `${Number(item.price).toLocaleString()} MMK · ${item.variants?.length ?? 0} options`
                    : section === "stores"
                      ? item.isActive === false
                        ? "Inactive"
                        : "Active"
                      : item.code ||
                        (item.isActive === false ? "Inactive" : "Active")}
                </span>
                <span className="text-xs text-slate-500">
                  {section === "stores"
                    ? item.address || item.phone || "—"
                    : (item._count?.products ?? item.storeName ?? "—")}
                </span>
                <button
                  onClick={() => openEdit(item)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:border-sky-400/40 hover:text-white"
                >
                  Edit
                </button>
              </div>
            ))}
            {!filteredRows.length && (
              <p className="p-10 text-center text-sm text-slate-400">
                {props.loading ? "Loading…" : `No ${section} found.`}
              </p>
            )}
          </section>

          {totalItems > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
              <p className="text-xs text-slate-400">
                Showing{" "}
                <strong className="text-white">
                  {startItem.toLocaleString()}
                </strong>{" "}
                to{" "}
                <strong className="text-white">
                  {endItem.toLocaleString()}
                </strong>{" "}
                of{" "}
                <strong className="text-white">
                  {totalItems.toLocaleString()}
                </strong>{" "}
                {section}
              </p>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={activePage <= 1}
                    className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <span className="px-2 text-xs text-slate-400">
                    Page <strong className="text-white">{activePage}</strong> of{" "}
                    {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={activePage >= totalPages}
                    className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <section className="mt-6 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["Inventory view", "inventory"],
            ["Register sessions", "sessions"],
            ["Workspace settings", "settings"],
          ] as const
        ).map(([title, tab]) => (
          <button
            key={tab}
            onClick={() => props.onNavigate(tab)}
            className="rounded-lg border border-slate-800 px-3 py-2 text-slate-400 hover:text-slate-200"
          >
            {title} →
          </button>
        ))}
      </section>

      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <form
            onSubmit={submit}
            className={`max-h-[96dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl ${
              section === "products" && dialog !== "stock"
                ? "max-w-6xl"
                : dialog === "stock"
                  ? "max-w-5xl"
                  : "max-w-3xl"
            }`}
            style={{ padding: 0 }}
          >
            {/* ============ STOCK ADJUSTMENT (2-panel) ============ */}
            {dialog === "stock" ? (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Stock adjustment
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {props.stores.find((s) => s.id === props.storeId)?.name ||
                        "Selected store"}{" "}
                      · updates stock movement history
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.1fr_1fr]">
                  {/* LEFT — Product & variant picker */}
                  <div className="flex max-h-[60vh] flex-col overflow-hidden border-b border-slate-800 md:max-h-[70vh] md:border-b-0 md:border-r">
                    <div className="border-b border-slate-800 bg-slate-900/60 p-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          value={stockSearch}
                          onChange={(e) => setStockSearch(e.target.value)}
                          placeholder="Search products by name, SKU, barcode…"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {stockFilteredProducts.length === 0 ? (
                        <p className="py-10 text-center text-xs text-slate-500">
                          No matching products.
                        </p>
                      ) : (
                        stockFilteredProducts.slice(0, 200).map((product) => {
                          const selected = stockFields.productId === product.id;
                          return (
                            <div
                              key={product.id}
                              className={`mb-1.5 rounded-xl border transition ${
                                selected
                                  ? "border-sky-500/40 bg-sky-500/5"
                                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setStockFields((current) => ({
                                    ...current,
                                    productId: product.id,
                                    variantId:
                                      product.variants?.length === 1
                                        ? product.variants[0].id
                                        : "",
                                  }));
                                }}
                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                              >
                                {product.imageUrl || (product as any).image ? (
                                  <img
                                    src={resolveMediaUrl(
                                      product.imageUrl ||
                                        (product as any).image,
                                    )}
                                    alt=""
                                    className="h-9 w-9 shrink-0 rounded-lg bg-slate-800 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
                                    <Package className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-100">
                                    {product.name}
                                  </p>
                                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                                    {product.sku} ·{" "}
                                    {product.variants?.length ?? 0} option
                                    {(product.variants?.length ?? 0) === 1
                                      ? ""
                                      : "s"}
                                  </p>
                                </div>
                                {selected && (
                                  <Check className="h-4 w-4 shrink-0 text-sky-400" />
                                )}
                              </button>
                              {selected &&
                                (product.variants?.length ?? 0) > 0 && (
                                  <div className="space-y-1 border-t border-slate-800/70 px-3 py-2">
                                    {product.variants!.map((variant: any) => {
                                      const active =
                                        stockFields.variantId === variant.id;
                                      return (
                                        <button
                                          key={variant.id}
                                          type="button"
                                          onClick={() =>
                                            setStockFields((current) => ({
                                              ...current,
                                              variantId: variant.id,
                                            }))
                                          }
                                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                                            active
                                              ? "bg-sky-500/15 text-sky-200"
                                              : "text-slate-300 hover:bg-slate-800/60"
                                          }`}
                                        >
                                          <span className="min-w-0 flex-1 truncate font-semibold">
                                            {variant.name}
                                          </span>
                                          <span className="shrink-0 text-[10px] text-slate-500">
                                            Stock{" "}
                                            {Number(
                                              variant.stock ?? 0,
                                            ).toLocaleString()}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* RIGHT — Adjustment form */}
                  <div className="flex flex-col overflow-y-auto p-5">
                    {!stockProduct ? (
                      <div className="my-auto py-10 text-center text-sm text-slate-500">
                        <RotateCcw className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                        Pick a product on the left to begin.
                      </div>
                    ) : !stockFields.variantId ? (
                      <div className="my-auto py-10 text-center text-sm text-slate-500">
                        <Layers className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                        Choose a variant to continue.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Selected
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {stockProduct.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {stockVariant?.name}
                            {stockVariant?.sku ? ` · ${stockVariant.sku}` : ""}
                          </p>
                          <div className="mt-3 grid grid-cols-3 items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-center">
                            <div>
                              <p className="text-[10px] text-slate-500">
                                On hand
                              </p>
                              <p className="text-sm font-bold text-white">
                                {currentStock}
                              </p>
                            </div>
                            <div className="text-slate-600">→</div>
                            <div>
                              <p className="text-[10px] text-slate-500">
                                After
                              </p>
                              <p
                                className={`text-sm font-bold ${
                                  resultingStock < 0
                                    ? "text-rose-300"
                                    : "text-emerald-300"
                                }`}
                              >
                                {resultingStock}
                              </p>
                            </div>
                          </div>
                        </div>

                        <ChoiceCards
                          label="Adjustment type"
                          value={stockFields.mode}
                          onChange={(mode) =>
                            setStockFields((current) => ({
                              ...current,
                              mode,
                            }))
                          }
                          options={[
                            {
                              value: "IN",
                              label: "Add stock",
                              description:
                                "Physical count is higher than the system.",
                            },
                            {
                              value: "OUT",
                              label: "Remove stock",
                              description:
                                "Damage, expiry, or a count correction.",
                            },
                          ]}
                        />

                        {stockFields.mode === "OUT" && (
                          <ChoiceCards
                            label="Reason type"
                            value={stockFields.movementType}
                            onChange={(movementType) =>
                              setStockFields((current) => ({
                                ...current,
                                movementType: movementType as
                                  | "ADJUSTMENT"
                                  | "DAMAGE"
                                  | "EXPIRED",
                              }))
                            }
                            options={[
                              {
                                value: "ADJUSTMENT",
                                label: "Count correction",
                              },
                              { value: "DAMAGE", label: "Damaged" },
                              { value: "EXPIRED", label: "Expired" },
                            ]}
                          />
                        )}

                        <label className="block text-xs text-slate-400">
                          Units
                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={stockFields.quantity}
                            onChange={(e) =>
                              setStockFields((current) => ({
                                ...current,
                                quantity: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500"
                          />
                        </label>

                        <label className="block text-xs text-slate-400">
                          Reason
                          <input
                            required
                            minLength={3}
                            value={stockFields.reason}
                            onChange={(e) =>
                              setStockFields((current) => ({
                                ...current,
                                reason: e.target.value,
                              }))
                            }
                            placeholder="e.g. Count correction or damaged units"
                            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500"
                          />
                        </label>

                        <p className="text-[11px] leading-relaxed text-slate-500">
                          Use a purchase order to receive supplier deliveries.
                          This form is for stock corrections and losses.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mx-6 mt-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
                  >
                    {error}
                  </p>
                )}

                <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-2xl border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={
                      busy ||
                      !stockFields.variantId ||
                      !stockFields.quantity ||
                      !stockFields.reason.trim()
                    }
                    className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Save adjustment"}
                  </button>
                </div>
              </>
            ) : section === "products" ? (
              /* ============ PRODUCT CREATE/EDIT (2-panel, live preview) ============ */
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {dialog === "edit" ? "Edit product" : "New product"}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Left: form · Right: live preview · Saved to the selected
                      tenant
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.4fr_1fr]">
                  {/* LEFT — form sections */}
                  <div className="max-h-[70vh] overflow-y-auto border-b border-slate-800 p-5 lg:border-b-0 lg:border-r">
                    <div className="space-y-5">
                      {/* BASIC */}
                      <section className="rounded-xl border border-slate-800 bg-slate-950/40">
                        <div className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-800/20 px-4 py-2.5">
                          <Package className="h-3.5 w-3.5 text-sky-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Basic information
                          </h4>
                        </div>
                        <div className="space-y-4 p-4">
                          <label className="block text-xs font-medium text-slate-400">
                            Product name{" "}
                            <span className="text-rose-400">*</span>
                            <input
                              required
                              autoFocus
                              placeholder="e.g. Classic White T-Shirt"
                              value={fields.name}
                              onChange={(e) => setField("name", e.target.value)}
                              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
                            />
                          </label>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <ComboSelect
                              label="Category"
                              value={fields.categoryId}
                              onChange={(v) => setField("categoryId", v)}
                              options={categoryOptions}
                              placeholder="No category"
                              noneLabel="No category"
                              onCreate={createCategoryInline}
                              createLabel="+ Create new category"
                            />
                            <ComboSelect
                              label="Brand"
                              value={fields.brandId}
                              onChange={(v) => setField("brandId", v)}
                              options={brandOptions}
                              placeholder="No brand"
                              noneLabel="No brand"
                              onCreate={createBrandInline}
                              createLabel="+ Create new brand"
                            />
                          </div>
                          <ComboSelect
                            label="Supplier"
                            value={fields.supplierId}
                            onChange={(v) => setField("supplierId", v)}
                            options={supplierOptions}
                            placeholder="No supplier"
                            noneLabel="No supplier"
                            hint="Start typing to filter, or create a new supplier."
                            onCreate={createSupplierInline}
                            createLabel="+ Create new supplier"
                          />

                          {/* IMAGE */}
                          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <label className="block text-xs font-semibold text-slate-300">
                              Product photo{" "}
                              <span className="font-normal text-slate-500">
                                (JPG, PNG or WebP · up to 5 MB)
                              </span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                                onChange={async (event) => {
                                  const input = event.currentTarget;
                                  const file = input.files?.[0];
                                  if (!file || !props.storeId) return;
                                  setBusy(true);
                                  setError(null);
                                  try {
                                    const imageUrl =
                                      await apiService.uploadProductImage(
                                        file,
                                        props.storeId,
                                        editing?.id,
                                      );
                                    setField("imageUrl", imageUrl);
                                  } catch (cause) {
                                    setError(
                                      cause instanceof Error
                                        ? cause.message
                                        : "Image upload failed.",
                                    );
                                  } finally {
                                    setBusy(false);
                                    input.value = "";
                                  }
                                }}
                              />
                            </label>
                            {fields.imageUrl && (
                              <div className="mt-3 flex items-center gap-3">
                                <img
                                  src={resolveMediaUrl(fields.imageUrl)}
                                  alt="Product preview"
                                  className="h-16 w-16 rounded-lg bg-slate-800 object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => setField("imageUrl", "")}
                                  className="text-xs text-rose-300 hover:text-rose-200"
                                >
                                  Remove photo
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* MEDICINE */}
                      <details className="group overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10">
                          <Sparkles className="h-4 w-4" />
                          Medicine / Pharmacy details
                          <span className="ml-1 text-[10px] font-normal text-slate-500">
                            (optional — expand for drug catalog fields)
                          </span>
                        </summary>
                        <div className="space-y-4 border-t border-emerald-500/10 px-4 pb-4 pt-3">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-xs font-medium text-slate-400">
                              Generic Name
                              <input
                                placeholder="e.g. Paracetamol"
                                value={fields.genericName}
                                onChange={(e) =>
                                  setField("genericName", e.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
                              />
                            </label>
                            <label className="block text-xs font-medium text-slate-400">
                              Active Ingredient
                              <input
                                placeholder="e.g. Paracetamol"
                                value={fields.activeIngredient}
                                onChange={(e) =>
                                  setField("activeIngredient", e.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
                              />
                            </label>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <label className="block text-xs font-medium text-slate-400">
                              Strength
                              <input
                                placeholder="e.g. 500mg"
                                value={fields.strength}
                                onChange={(e) =>
                                  setField("strength", e.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
                              />
                            </label>
                            <label className="block text-xs font-medium text-slate-400">
                              Dosage Form
                              <input
                                placeholder="e.g. Tablet, Syrup"
                                value={fields.dosageForm}
                                onChange={(e) =>
                                  setField("dosageForm", e.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
                              />
                            </label>
                            <label className="block text-xs font-medium text-slate-400">
                              Registration No.
                              <input
                                placeholder="e.g. REG-12345"
                                value={fields.registrationNumber}
                                onChange={(e) =>
                                  setField("registrationNumber", e.target.value)
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
                              />
                            </label>
                          </div>
                          <label className="block text-xs font-medium text-slate-400">
                            Manufacturer
                            <input
                              placeholder="e.g. BPI, GPO"
                              value={fields.manufacturer}
                              onChange={(e) =>
                                setField("manufacturer", e.target.value)
                              }
                              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
                            />
                          </label>
                        </div>
                      </details>

                      {/* BASE UNIT */}
                      <section className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03]">
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                            <Layers className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-emerald-200">
                              Smallest stock unit
                              <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                                optional · for pharmacy / packaged goods
                              </span>
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              Set this if you sell the same product in multiple
                              pack sizes.
                            </p>
                          </div>
                          <input
                            value={fields.baseUnitName || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setField("baseUnitName", value);
                              if (!value)
                                setVariantInputs((current) =>
                                  current.map((variant) => ({
                                    ...variant,
                                    unitFactor: "1",
                                  })),
                                );
                            }}
                            placeholder="e.g. Tablet"
                            className="w-32 shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/60"
                          />
                        </div>
                      </section>

                      {/* VARIANTS */}
                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Layers className="h-4 w-4 text-sky-400" />
                            Variants & pricing
                          </h3>
                          <span className="rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-[10px] font-bold text-slate-400">
                            {variantInputs.length}{" "}
                            {variantInputs.length === 1
                              ? "variant"
                              : "variants"}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {variantInputs.map((v, i) => {
                            const expanded = expandedVariant === i;
                            const isBaseUnit =
                              i === 0 && !!fields.baseUnitName?.trim();
                            const price = Number(v.price) || 0;

                            return (
                              <article
                                key={i}
                                className={`overflow-hidden rounded-xl border transition-all ${
                                  expanded
                                    ? "border-sky-500/40 bg-slate-950/60"
                                    : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-3 px-3.5 py-3">
                                  <span
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                                    style={{
                                      background: isBaseUnit
                                        ? "rgba(16,185,129,0.15)"
                                        : "rgba(56,189,248,0.12)",
                                      color: isBaseUnit ? "#34d399" : "#38bdf8",
                                    }}
                                  >
                                    {i + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedVariant(expanded ? null : i)
                                    }
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-sm font-semibold text-white">
                                        {v.name || `Variant ${i + 1}`}
                                      </span>
                                      {isBaseUnit && (
                                        <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                                          Base
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                                      {v.sku && (
                                        <span className="truncate font-mono">
                                          {v.sku}
                                        </span>
                                      )}
                                      {price > 0 && (
                                        <>
                                          <span>·</span>
                                          <span className="font-semibold text-emerald-400">
                                            {price.toLocaleString()} MMK
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </button>
                                  {variantInputs.length > 1 && !isBaseUnit && (
                                    <button
                                      type="button"
                                      aria-label={`Remove variant ${i + 1}`}
                                      onClick={() => {
                                        removeVariantInput(i);
                                        if (expandedVariant === i)
                                          setExpandedVariant(null);
                                        else if (
                                          expandedVariant !== null &&
                                          expandedVariant > i
                                        )
                                          setExpandedVariant(
                                            expandedVariant - 1,
                                          );
                                      }}
                                      className="shrink-0 rounded-md p-1.5 text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedVariant(expanded ? null : i)
                                    }
                                    className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                                  >
                                    <ChevronRight
                                      className={`h-4 w-4 transition-transform duration-200 ${
                                        expanded ? "rotate-90" : ""
                                      }`}
                                    />
                                  </button>
                                </div>

                                {expanded && (
                                  <div className="border-t border-slate-800/60 bg-slate-950/30 px-4 py-4">
                                    <div className="grid gap-3.5 sm:grid-cols-2">
                                      <label className="block text-[11px] font-medium text-slate-400">
                                        Option name{" "}
                                        <span className="text-rose-400">*</span>
                                        <input
                                          required
                                          placeholder="e.g. Box (100s)"
                                          value={v.name}
                                          onChange={(e) =>
                                            updateVariantInput(
                                              i,
                                              "name",
                                              e.target.value,
                                            )
                                          }
                                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500"
                                        />
                                      </label>

                                      {fields.baseUnitName?.trim() && (
                                        <label className="block text-[11px] font-medium text-slate-400">
                                          Base units in this option{" "}
                                          {isBaseUnit && (
                                            <span className="text-[10px] text-emerald-400">
                                              (locked · base)
                                            </span>
                                          )}
                                          <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            disabled={isBaseUnit}
                                            value={
                                              isBaseUnit
                                                ? "1"
                                                : (v.unitFactor ?? "1")
                                            }
                                            onChange={(e) =>
                                              updateVariantInput(
                                                i,
                                                "unitFactor",
                                                e.target.value,
                                              )
                                            }
                                            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50"
                                          />
                                        </label>
                                      )}

                                      <label className="block text-[11px] font-medium text-slate-400">
                                        Selling price{" "}
                                        <span className="text-rose-400">*</span>
                                        <div className="relative mt-1.5">
                                          <input
                                            required
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0"
                                            value={v.price}
                                            onChange={(e) =>
                                              updateVariantInput(
                                                i,
                                                "price",
                                                e.target.value,
                                              )
                                            }
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 pr-12 text-sm text-white outline-none focus:border-sky-500"
                                          />
                                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
                                            MMK
                                          </span>
                                        </div>
                                      </label>

                                      <label className="block text-[11px] font-medium text-slate-400">
                                        Cost price{" "}
                                        <span className="text-slate-600">
                                          (optional)
                                        </span>
                                        <div className="relative mt-1.5">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0"
                                            value={v.costPrice ?? ""}
                                            onChange={(e) =>
                                              updateVariantInput(
                                                i,
                                                "costPrice",
                                                e.target.value,
                                              )
                                            }
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 pr-12 text-sm text-white outline-none focus:border-sky-500"
                                          />
                                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
                                            MMK
                                          </span>
                                        </div>
                                      </label>

                                      {dialog === "create" && (
                                        <label className="block text-[11px] font-medium text-slate-400 sm:col-span-2">
                                          Starting stock
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            placeholder="0"
                                            value={v.initialStock ?? "0"}
                                            onChange={(e) =>
                                              updateVariantInput(
                                                i,
                                                "initialStock",
                                                e.target.value,
                                              )
                                            }
                                            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
                                          />
                                        </label>
                                      )}
                                    </div>

                                    <details className="group mt-3.5 border-t border-slate-800/60 pt-3.5">
                                      <summary className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-medium text-sky-300/80 transition hover:text-sky-300">
                                        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                                        SKU, barcode & advanced details
                                      </summary>
                                      <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
                                        <label className="block text-[11px] font-medium text-slate-400">
                                          SKU
                                          <input
                                            placeholder="Auto-generated"
                                            value={v.sku ?? ""}
                                            onChange={(e) =>
                                              updateVariantInput(
                                                i,
                                                "sku",
                                                e.target.value,
                                              )
                                            }
                                            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-sky-500"
                                          />
                                        </label>
                                        <label className="block text-[11px] font-medium text-slate-400">
                                          Barcode
                                          <input
                                            placeholder="Auto-generated"
                                            value={v.barcode ?? ""}
                                            onChange={(e) =>
                                              updateVariantInput(
                                                i,
                                                "barcode",
                                                e.target.value,
                                              )
                                            }
                                            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-sky-500"
                                          />
                                        </label>

                                        {[
                                          {
                                            key: "wholesalePrice",
                                            label: "Wholesale price",
                                            type: "number",
                                          },
                                          {
                                            key: "wholesaleMinQuantity",
                                            label: "Min. wholesale qty",
                                            type: "number",
                                          },
                                          {
                                            key: "color",
                                            label: "Color",
                                            type: "text",
                                          },
                                          {
                                            key: "size",
                                            label: "Size",
                                            type: "text",
                                          },
                                          {
                                            key: "manufacturingDate",
                                            label: "Mfg date",
                                            type: "date",
                                          },
                                          {
                                            key: "expiryDate",
                                            label: "Expiry date",
                                            type: "date",
                                          },
                                          {
                                            key: "bestBeforeDate",
                                            label: "Best before",
                                            type: "date",
                                          },
                                        ].map((field) => (
                                          <label
                                            key={field.key}
                                            className="block text-[11px] font-medium text-slate-400"
                                          >
                                            {field.label}
                                            <input
                                              type={field.type}
                                              min={
                                                field.type === "number"
                                                  ? "0"
                                                  : undefined
                                              }
                                              step={
                                                field.key
                                                  .toLowerCase()
                                                  .includes("price")
                                                  ? "0.01"
                                                  : undefined
                                              }
                                              value={
                                                (v as any)[field.key] ?? ""
                                              }
                                              onChange={(e) =>
                                                updateVariantInput(
                                                  i,
                                                  field.key,
                                                  e.target.value,
                                                )
                                              }
                                              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
                                            />
                                          </label>
                                        ))}
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            addVariantInput();
                            setExpandedVariant(variantInputs.length);
                          }}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600/60 px-4 py-3 text-sm font-semibold text-sky-300/80 transition hover:border-sky-500/60 hover:bg-sky-500/5 hover:text-sky-300"
                        >
                          <Plus className="h-4 w-4" />
                          Add another variant
                        </button>
                      </section>
                    </div>
                  </div>

                  {/* RIGHT — live preview */}
                  <aside className="max-h-[70vh] overflow-y-auto bg-slate-950/40 p-5">
                    <div className="sticky top-0 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Live preview
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-white">
                          How this product will appear
                        </h3>
                      </div>

                      <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                        {fields.imageUrl ? (
                          <img
                            src={resolveMediaUrl(fields.imageUrl)}
                            alt=""
                            className="h-44 w-full bg-slate-800 object-cover"
                          />
                        ) : (
                          <div className="flex h-44 w-full items-center justify-center bg-slate-800/60">
                            <ImageIcon className="h-10 w-10 text-slate-600" />
                          </div>
                        )}
                        <div className="space-y-3 p-4">
                          <div>
                            <h4 className="truncate text-base font-bold text-white">
                              {fields.name || "Untitled product"}
                            </h4>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {[
                                props.categories.find(
                                  (c) => c.id === fields.categoryId,
                                )?.name,
                                props.brands.find(
                                  (b) => b.id === fields.brandId,
                                )?.name,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "No category / brand"}
                            </p>
                          </div>

                          {fields.supplierId && (
                            <p className="text-[11px] text-slate-500">
                              Supplier:{" "}
                              <span className="text-slate-300">
                                {props.suppliers.find(
                                  (s) => s.id === fields.supplierId,
                                )?.name || "—"}
                              </span>
                            </p>
                          )}

                          {(fields.genericName ||
                            fields.strength ||
                            fields.dosageForm) && (
                            <p className="rounded-lg bg-emerald-500/5 px-2 py-1.5 text-[10px] text-emerald-300/90">
                              {[
                                fields.genericName,
                                fields.activeIngredient,
                                fields.strength,
                                fields.dosageForm,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}

                          <div className="border-t border-slate-800 pt-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Variants ({variantInputs.length})
                            </p>
                            {variantInputs.length === 0 ? (
                              <p className="text-xs text-slate-500">
                                No variants yet.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {variantInputs.map((v, i) => (
                                  <li
                                    key={i}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-2.5 py-2 text-[11px]"
                                  >
                                    <span className="truncate text-slate-300">
                                      {v.name || `Variant ${i + 1}`}
                                    </span>
                                    <span className="shrink-0 font-bold text-emerald-400">
                                      {Number(v.price || 0).toLocaleString()}{" "}
                                      <span className="text-[9px] font-normal text-slate-500">
                                        MMK
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {variantInputs.length > 0 && (
                            <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-400">
                              <div className="flex items-center justify-between">
                                <span>Options:</span>
                                <span className="font-bold text-white">
                                  {variantInputs.length}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span>Total opening qty:</span>
                                <span className="font-bold text-white">
                                  {variantInputs.reduce(
                                    (sum, v) =>
                                      sum + Number(v.initialStock || 0),
                                    0,
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>

                      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                        <p className="text-[11px] leading-relaxed text-emerald-300/80">
                          {dialog === "edit"
                            ? "Saving will update the product and all listed variants on the server."
                            : "This will create the product with all listed variants and assign them to your active store."}
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mx-6 mt-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
                  >
                    {error}
                  </p>
                )}

                <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-2xl border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {busy ? (
                      "Saving…"
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {dialog === "edit" ? "Save changes" : "Create product"}
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* ============ OTHER ENTITIES (grouped form) ============ */
              <>
                <div className="px-6 pt-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {dialog === "edit"
                          ? `Edit ${labels[section as EntitySection]}`
                          : `Add ${labels[section as EntitySection]}`}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Saved directly to the selected tenant.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDialog(null)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-5 px-6 py-2">
                  {formGroups[section as EntitySection]?.map((group) => {
                    const GroupIcon = group.icon;
                    const groupFields = formFields[
                      section as EntitySection
                    ].filter((f) => group.fields.includes(f.name));
                    if (groupFields.length === 0) return null;

                    return (
                      <section
                        key={group.title}
                        className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
                      >
                        <div className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-800/20 px-4 py-2.5">
                          <GroupIcon className="h-3.5 w-3.5 text-sky-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {group.title}
                          </h4>
                        </div>
                        <div className="grid gap-4 p-4 sm:grid-cols-2">
                          {groupFields.map((field) => (
                            <label
                              key={field.name}
                              className={`text-xs text-slate-400 ${
                                field.name === "address" ||
                                field.name === "description"
                                  ? "sm:col-span-2"
                                  : ""
                              }`}
                            >
                              <span className="font-medium">
                                {field.label}
                                {dialog === "create" && field.required && (
                                  <span className="ml-1 text-rose-400">*</span>
                                )}
                              </span>
                              {field.hint && (
                                <span className="ml-1 text-slate-600">
                                  ({field.hint})
                                </span>
                              )}
                              {field.type?.startsWith("select:") ? (
                                <select
                                  required={
                                    dialog === "create" && field.required
                                  }
                                  value={
                                    fields[field.name] ||
                                    (field.type.includes("BRONZE")
                                      ? "BRONZE"
                                      : "CASHIER")
                                  }
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setField(field.name, value);
                                    if (
                                      section === "staff" &&
                                      field.name === "role"
                                    ) {
                                      const defaults: Record<string, string[]> =
                                        {
                                          ADMIN: [
                                            "MANAGE_STAFF",
                                            "MANAGE_INVENTORY",
                                            "EDIT_PRICES",
                                            "VOID_ORDERS",
                                            "REFUND_ORDERS",
                                            "VIEW_REPORTS",
                                            "VIEW_ANALYTICS",
                                            "MANAGE_PROMOTIONS",
                                            "VIEW_AUDIT_LOGS",
                                            "MANAGE_API_KEYS",
                                            "MANAGE_WEBHOOKS",
                                          ],
                                          MANAGER: [
                                            "VIEW_REPORTS",
                                            "EDIT_PRICES",
                                            "VOID_ORDERS",
                                            "MANAGE_STAFF",
                                            "MANAGE_INVENTORY",
                                            "REFUND_ORDERS",
                                            "MANAGE_PROMOTIONS",
                                            "VIEW_ANALYTICS",
                                          ],
                                          CASHIER: ["VIEW_REPORTS"],
                                          ACCOUNTANT: [
                                            "VIEW_REPORTS",
                                            "VIEW_ANALYTICS",
                                          ],
                                        };
                                      setStaffPermissions(
                                        defaults[value] ?? [],
                                      );
                                    }
                                  }}
                                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500"
                                >
                                  {field.type
                                    .split(":")[1]
                                    .split(",")
                                    .filter(
                                      (option) =>
                                        props.userRole !== "MANAGER" ||
                                        option === "CASHIER",
                                    )
                                    .map((option) => (
                                      <option key={option}>{option}</option>
                                    ))}
                                </select>
                              ) : (
                                <input
                                  required={
                                    dialog === "create" && field.required
                                  }
                                  type={field.type || "text"}
                                  minLength={
                                    field.name === "password" &&
                                    dialog === "create"
                                      ? 6
                                      : undefined
                                  }
                                  value={fields[field.name] || ""}
                                  onChange={(event) =>
                                    setField(field.name, event.target.value)
                                  }
                                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500"
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      </section>
                    );
                  })}

                  {section === "staff" && (
                    <section className="overflow-hidden rounded-xl border border-sky-500/20 bg-sky-500/5">
                      <div className="flex items-center gap-2 border-b border-sky-500/20 px-4 py-2.5">
                        <Check className="h-3.5 w-3.5 text-sky-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                          Permissions
                        </h4>
                      </div>
                      <div className="p-4">
                        <p className="mb-3 text-xs leading-5 text-sky-100">
                          {props.userRole === "MANAGER"
                            ? `This cashier account will be assigned to ${props.stores.find((store) => store.id === props.storeId)?.name ?? "your active store"}.`
                            : `New staff will be assigned to ${props.stores.find((store) => store.id === props.storeId)?.name ?? "the active store"}.`}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            "MANAGE_STAFF",
                            "MANAGE_INVENTORY",
                            "EDIT_PRICES",
                            "VOID_ORDERS",
                            "REFUND_ORDERS",
                            "VIEW_REPORTS",
                            "VIEW_ANALYTICS",
                            "MANAGE_PROMOTIONS",
                            "VIEW_AUDIT_LOGS",
                            "MANAGE_API_KEYS",
                            "MANAGE_WEBHOOKS",
                          ].map((permission) => (
                            <label
                              key={permission}
                              className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-900"
                            >
                              <input
                                type="checkbox"
                                checked={staffPermissions.includes(permission)}
                                onChange={(event) =>
                                  setStaffPermissions((current) =>
                                    event.target.checked
                                      ? [...current, permission]
                                      : current.filter(
                                          (value) => value !== permission,
                                        ),
                                  )
                                }
                                className="accent-sky-500"
                              />
                              {permission.split("_").join(" ").toLowerCase()}
                            </label>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mx-6 mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
                  >
                    {error}
                  </p>
                )}

                <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-2xl border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy}
                    className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    {busy
                      ? "Saving…"
                      : dialog === "edit"
                        ? "Save changes"
                        : `Create ${labels[section as EntitySection]}`}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </main>
  );
}

// // ok
// import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
// import {
//   Barcode,
//   Box,
//   Building2,
//   Check,
//   ChevronLeft,
//   ChevronRight,
//   ContactRound,
//   Download,
//   Eye,
//   FileSpreadsheet,
//   Layers,
//   Package,
//   PackagePlus,
//   Plus,
//   Printer,
//   RotateCcw,
//   Search,
//   Sparkles,
//   Store as StoreIcon,
//   Tags,
//   Truck,
//   Users,
//   X,
// } from "lucide-react";
// import QRCode from "qrcode";
// import { Product } from "../types";
// import { apiService, resolveMediaUrl } from "../services/api";
// import { SearchableProductPicker } from "./SearchableProductPicker";
// import { ChoiceCards } from "./ChoiceCards";

// type Section =
//   | "products"
//   | "stock"
//   | "stores"
//   | "staff"
//   | "brands"
//   | "categories"
//   | "suppliers"
//   | "customers"
//   | "qr";
// type EntitySection = Exclude<Section, "stock" | "qr">;
// type Destination = "inventory" | "sessions" | "settings";
// type Fields = Record<string, string>;

// const sections: { id: Section; title: string; icon: typeof PackagePlus }[] = [
//   { id: "products", title: "Products", icon: Box },
//   { id: "stock", title: "Stock adjustment", icon: RotateCcw },
//   { id: "staff", title: "Staff", icon: Users },
//   { id: "stores", title: "Stores", icon: StoreIcon },
//   { id: "brands", title: "Brands", icon: Tags },
//   { id: "categories", title: "Categories", icon: Building2 },
//   { id: "suppliers", title: "Suppliers", icon: Truck },
//   { id: "customers", title: "Customers", icon: ContactRound },
//   { id: "qr", title: "QR & barcode", icon: Barcode },
// ];

// interface Props {
//   products: Product[];
//   categories: any[];
//   brands: any[];
//   suppliers: any[];
//   customers: any[];
//   staff: any[];
//   userRole?: string;
//   storeId?: string;
//   stores: {
//     id: string;
//     name: string;
//     code?: string;
//     address?: string;
//     phone?: string;
//     email?: string;
//     taxNumber?: string;
//     isActive?: boolean;
//   }[];
//   loading: boolean;
//   onCreateProduct: (payload: Record<string, unknown>) => Promise<unknown>;
//   onCreateEntity: (
//     section: EntitySection,
//     payload: Record<string, unknown>,
//   ) => Promise<unknown>;
//   onUpdateEntity: (
//     section: EntitySection,
//     id: string,
//     payload: Record<string, unknown>,
//   ) => Promise<unknown>;
//   onAdjustStock: (
//     productId: string,
//     variantId: string | undefined,
//     delta: number,
//     reason: string,
//     movementType?: "ADJUSTMENT" | "DAMAGE" | "EXPIRED",
//   ) => Promise<unknown>;
//   onAssignBarcode: (productId: string, barcode: string) => Promise<unknown>;
//   onNavigate: (tab: Destination) => void;
// }

// const emptyProduct: Fields = {
//   name: "",
//   sku: "",
//   barcode: "",
//   categoryId: "",
//   brandId: "",
//   supplierId: "",
//   costPrice: "",
//   sellingPrice: "",
//   initialStock: "0",
//   genericName: "",
//   activeIngredient: "",
//   strength: "",
//   dosageForm: "",
//   manufacturer: "",
//   registrationNumber: "",
//   baseUnitName: "",
//   imageUrl: "",
// };

// const formFields: Record<
//   EntitySection,
//   {
//     name: string;
//     label: string;
//     type?: string;
//     required?: boolean;
//     hint?: string;
//   }[]
// > = {
//   products: [],
//   stores: [
//     { name: "name", label: "Store name", required: true },
//     {
//       name: "code",
//       label: "Store code",
//       required: true,
//       hint: "Short identifier (e.g. DTN-01)",
//     },
//     { name: "phone", label: "Phone" },
//     { name: "email", label: "Email", type: "email" },
//     { name: "address", label: "Address" },
//     { name: "taxNumber", label: "Tax number" },
//   ],
//   staff: [
//     { name: "name", label: "Full name", required: true },
//     { name: "username", label: "Username", required: true },
//     { name: "email", label: "Email", type: "email", required: true },
//     {
//       name: "password",
//       label: "Temporary password",
//       type: "password",
//       required: true,
//       hint: "Minimum 6 characters",
//     },
//     {
//       name: "role",
//       label: "Role",
//       type: "select:ADMIN,MANAGER,CASHIER,ACCOUNTANT",
//       required: true,
//     },
//   ],
//   brands: [
//     { name: "name", label: "Brand name", required: true },
//     { name: "description", label: "Description" },
//   ],
//   categories: [
//     { name: "name", label: "Category name", required: true },
//     { name: "description", label: "Description" },
//   ],
//   suppliers: [
//     { name: "name", label: "Supplier name", required: true },
//     {
//       name: "code",
//       label: "Supplier code",
//       hint: "Leave blank to auto-generate",
//     },
//     { name: "contactName", label: "Contact person" },
//     { name: "phone", label: "Phone" },
//     { name: "email", label: "Email", type: "email" },
//     { name: "address", label: "Address" },
//     { name: "taxId", label: "Tax ID" },
//   ],
//   customers: [
//     { name: "name", label: "Customer name", required: true },
//     { name: "code", label: "Customer code" },
//     { name: "phone", label: "Phone" },
//     { name: "email", label: "Email", type: "email" },
//     { name: "address", label: "Address" },
//     {
//       name: "tier",
//       label: "Loyalty tier",
//       type: "select:BRONZE,SILVER,GOLD,PLATINUM",
//     },
//   ],
// };

// const formGroups: Record<
//   EntitySection,
//   { title: string; icon: typeof Package; fields: string[] }[]
// > = {
//   products: [],
//   stores: [
//     { title: "Basic information", icon: StoreIcon, fields: ["name", "code"] },
//     { title: "Contact", icon: ContactRound, fields: ["phone", "email"] },
//     {
//       title: "Address & billing",
//       icon: FileSpreadsheet,
//       fields: ["address", "taxNumber"],
//     },
//   ],
//   staff: [
//     {
//       title: "Identity",
//       icon: Users,
//       fields: ["name", "username", "email", "password"],
//     },
//     { title: "Access", icon: Check, fields: ["role"] },
//   ],
//   brands: [{ title: "Brand", icon: Tags, fields: ["name", "description"] }],
//   categories: [
//     { title: "Category", icon: Building2, fields: ["name", "description"] },
//   ],
//   suppliers: [
//     { title: "Basic", icon: Truck, fields: ["name", "code"] },
//     {
//       title: "Contact",
//       icon: ContactRound,
//       fields: ["contactName", "phone", "email"],
//     },
//     {
//       title: "Billing",
//       icon: FileSpreadsheet,
//       fields: ["address", "taxId"],
//     },
//   ],
//   customers: [
//     { title: "Basic", icon: ContactRound, fields: ["name", "code"] },
//     {
//       title: "Contact",
//       icon: ContactRound,
//       fields: ["phone", "email", "address"],
//     },
//     { title: "Loyalty", icon: Sparkles, fields: ["tier"] },
//   ],
// };

// const listFor = (section: EntitySection, props: Props): any[] =>
//   ({
//     products: props.products,
//     stores: props.stores,
//     staff: props.staff,
//     brands: props.brands,
//     categories: props.categories,
//     suppliers: props.suppliers,
//     customers: props.customers,
//   })[section];

// const labels: Record<EntitySection, string> = {
//   products: "Product",
//   stores: "Store",
//   staff: "Staff member",
//   brands: "Brand",
//   categories: "Category",
//   suppliers: "Supplier",
//   customers: "Customer",
// };

// const serial = () =>
//   `KNT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

// /* ------------------------------------------------------------------ */
// /*  Searchable combo select                                            */
// /* ------------------------------------------------------------------ */

// function ComboSelect({
//   label,
//   value,
//   onChange,
//   options,
//   placeholder = "Choose…",
//   hint,
//   allowNone = true,
//   noneLabel = "None",
//   required,
//   disabled,
// }: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
//   options: { id: string; name: string; meta?: string }[];
//   placeholder?: string;
//   hint?: string;
//   allowNone?: boolean;
//   noneLabel?: string;
//   required?: boolean;
//   disabled?: boolean;
// }) {
//   const [open, setOpen] = useState(false);
//   const [query, setQuery] = useState("");
//   const containerRef = useRef<HTMLDivElement>(null);
//   const selected = options.find((o) => o.id === value);

//   useEffect(() => {
//     const onDocClick = (e: MouseEvent) => {
//       if (!containerRef.current) return;
//       if (!containerRef.current.contains(e.target as Node)) setOpen(false);
//     };
//     if (open) document.addEventListener("mousedown", onDocClick);
//     return () => document.removeEventListener("mousedown", onDocClick);
//   }, [open]);

//   const filtered = query.trim()
//     ? options.filter((o) =>
//         `${o.name} ${o.meta ?? ""}`.toLowerCase().includes(query.toLowerCase()),
//       )
//     : options;

//   return (
//     <div ref={containerRef} className="relative">
//       <label className="block text-xs font-medium text-slate-400">
//         {label}
//         {required && <span className="ml-1 text-rose-400">*</span>}
//       </label>
//       <button
//         type="button"
//         disabled={disabled}
//         onClick={() => setOpen((v) => !v)}
//         className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-left text-sm text-white outline-none transition-all hover:border-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50"
//       >
//         <span
//           className={`truncate ${selected ? "text-white" : "text-slate-500"}`}
//         >
//           {selected ? selected.name : placeholder}
//         </span>
//         <ChevronRight
//           className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
//             open ? "rotate-90" : ""
//           }`}
//         />
//       </button>
//       {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
//       {open && (
//         <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
//           <div className="flex items-center gap-2 border-b border-slate-800 px-2.5 py-2">
//             <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
//             <input
//               autoFocus
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               placeholder="Type to filter…"
//               className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
//             />
//           </div>
//           <div className="max-h-56 overflow-y-auto p-1.5">
//             {allowNone && (
//               <button
//                 type="button"
//                 onClick={() => {
//                   onChange("");
//                   setOpen(false);
//                   setQuery("");
//                 }}
//                 className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-800 ${
//                   !value ? "text-sky-300" : "text-slate-400"
//                 }`}
//               >
//                 <span>{noneLabel}</span>
//                 {!value && <Check className="h-3.5 w-3.5" />}
//               </button>
//             )}
//             {filtered.length === 0 ? (
//               <p className="px-3 py-6 text-center text-xs text-slate-500">
//                 No matches found.
//               </p>
//             ) : (
//               filtered.map((o) => (
//                 <button
//                   key={o.id}
//                   type="button"
//                   onClick={() => {
//                     onChange(o.id);
//                     setOpen(false);
//                     setQuery("");
//                   }}
//                   className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-800 ${
//                     value === o.id ? "text-sky-300" : "text-slate-200"
//                   }`}
//                 >
//                   <span className="min-w-0 flex-1">
//                     <span className="block truncate font-semibold">
//                       {o.name}
//                     </span>
//                     {o.meta && (
//                       <span className="block truncate text-[10px] text-slate-500">
//                         {o.meta}
//                       </span>
//                     )}
//                   </span>
//                   {value === o.id && <Check className="h-3.5 w-3.5 shrink-0" />}
//                 </button>
//               ))
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /*  CSV helpers                                                        */
// /* ------------------------------------------------------------------ */

// function parseCsv(text: string): string[][] {
//   const rows: string[][] = [];
//   let row: string[] = [];
//   let value = "";
//   let quoted = false;
//   for (let i = 0; i < text.length; i++) {
//     const char = text[i];
//     if (char === '"') {
//       if (quoted && text[i + 1] === '"') {
//         value += '"';
//         i++;
//       } else quoted = !quoted;
//     } else if (char === "," && !quoted) {
//       row.push(value.trim());
//       value = "";
//     } else if ((char === "\n" || char === "\r") && !quoted) {
//       if (char === "\r" && text[i + 1] === "\n") i++;
//       row.push(value.trim());
//       value = "";
//       if (row.some((cell) => cell !== "")) rows.push(row);
//       row = [];
//     } else value += char;
//   }
//   if (quoted) throw new Error("The CSV has an unclosed quotation mark.");
//   row.push(value.trim());
//   if (row.some((cell) => cell !== "")) rows.push(row);
//   return rows;
// }

// const csvHeaderKey = (value: string) =>
//   value
//     .replace(/^\uFEFF/, "")
//     .trim()
//     .toLowerCase()
//     .replace(/[^a-z0-9]/g, "");

// /* ------------------------------------------------------------------ */
// /*  Main view                                                          */
// /* ------------------------------------------------------------------ */

// export function ManageView(props: Props) {
//   const [section, setSection] = useState<Section>("products");
//   const [dialog, setDialog] = useState<"create" | "edit" | "stock" | null>(
//     null,
//   );
//   const [wizardStep, setWizardStep] = useState(1);
//   const [expandedVariant, setExpandedVariant] = useState<number | null>(0);
//   const [editing, setEditing] = useState<any>(null);
//   const [fields, setFields] = useState<Fields>({ ...emptyProduct });
//   const [stockFields, setStockFields] = useState({
//     productId: "",
//     variantId: "",
//     mode: "IN",
//     movementType: "ADJUSTMENT" as "ADJUSTMENT" | "DAMAGE" | "EXPIRED",
//     quantity: "",
//     reason: "",
//   });
//   const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
//   const [search, setSearch] = useState("");
//   const [selectedQrProduct, setSelectedQrProduct] = useState("");
//   const [qrData, setQrData] = useState("");
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [notice, setNotice] = useState<string | null>(null);
//   const [pageSize, setPageSize] = useState<number>(100);
//   const [currentPage, setCurrentPage] = useState<number>(1);

//   const selectedProduct =
//     props.products.find((product) => product.id === selectedQrProduct) ??
//     props.products[0];
//   const stockProduct = props.products.find(
//     (product) => product.id === stockFields.productId,
//   );
//   const stockVariant = stockProduct?.variants?.find(
//     (variant) => variant.id === stockFields.variantId,
//   );
//   const currentStock = Number(stockVariant?.stock ?? 0);
//   const enteredStockDelta =
//     Number(stockFields.quantity || 0) * (stockFields.mode === "OUT" ? -1 : 1);
//   const resultingStock = currentStock + enteredStockDelta;

//   const activeSection =
//     section === "stock" ? "products" : section === "qr" ? "products" : section;
//   const rows = listFor(activeSection, props);
//   const filteredRows = useMemo(
//     () =>
//       rows.filter((item: any) =>
//         `${item.name ?? ""} ${item.sku ?? ""} ${item.code ?? ""} ${item.email ?? ""} ${item.phone ?? ""}`
//           .toLowerCase()
//           .includes(search.trim().toLowerCase()),
//       ),
//     [rows, search],
//   );

//   const totalItems = filteredRows.length;
//   const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
//   const activePage = Math.min(currentPage, totalPages);

//   const paginatedRows = useMemo(() => {
//     if (pageSize <= 0) return filteredRows;
//     const start = (activePage - 1) * pageSize;
//     return filteredRows.slice(start, start + pageSize);
//   }, [filteredRows, activePage, pageSize]);

//   const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
//   const endItem =
//     pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

//   useEffect(() => {
//     const value = selectedProduct?.barcode || selectedProduct?.sku;
//     if (!value) {
//       setQrData("");
//       return;
//     }
//     let disposed = false;
//     void QRCode.toDataURL(value, {
//       width: 220,
//       margin: 1,
//       errorCorrectionLevel: "M",
//     })
//       .then((url) => {
//         if (!disposed) setQrData(url);
//       })
//       .catch(() => setQrData(""));
//     return () => {
//       disposed = true;
//     };
//   }, [selectedProduct?.id, selectedProduct?.barcode, selectedProduct?.sku]);

//   const [variantInputs, setVariantInputs] = useState<
//     {
//       id?: string;
//       name: string;
//       sku: string;
//       price: string;
//       costPrice?: string;
//       barcode?: string;
//       initialStock?: string;
//       wholesalePrice?: string;
//       wholesaleMinQuantity?: string;
//       color?: string;
//       size?: string;
//       manufacturingDate?: string;
//       expiryDate?: string;
//       bestBeforeDate?: string;
//       unitFactor?: string;
//     }[]
//   >([]);

//   const slugifySkuToken = (str: string) =>
//     str
//       .trim()
//       .toUpperCase()
//       .replace(/[^A-Z0-9]/g, "")
//       .slice(0, 6);

//   const generateVariantSku = (productName?: string, variantName?: string) => {
//     const prodCode = productName ? slugifySkuToken(productName) : "PRD";
//     const varCode = variantName ? slugifySkuToken(variantName) : "VAR";
//     const randomSuffix = Math.random().toString(36).slice(2, 5).toUpperCase();
//     return `${prodCode || "ITEM"}-${varCode || "OPT"}-${randomSuffix}`;
//   };

//   const generateVariantBarcode = () =>
//     `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

//   const addVariantInput = () => {
//     setVariantInputs((prev) => [
//       ...prev,
//       {
//         name: "",
//         sku: generateVariantSku(fields.name, `VAR-${prev.length + 1}`),
//         price: "",
//         costPrice: "",
//         barcode: generateVariantBarcode(),
//         initialStock: "0",
//         wholesalePrice: "",
//         wholesaleMinQuantity: "1",
//         color: "",
//         size: "",
//         manufacturingDate: "",
//         expiryDate: "",
//         bestBeforeDate: "",
//         unitFactor: "1",
//       },
//     ]);
//   };

//   const removeVariantInput = (index: number) => {
//     setVariantInputs((prev) => prev.filter((_, i) => i !== index));
//   };

//   const setField = (key: string, value: string) => {
//     setFields((current) => {
//       const updated = { ...current, [key]: value };
//       if (key === "name" && dialog === "create") {
//         setVariantInputs((prev) =>
//           prev.map((v) => ({
//             ...v,
//             sku:
//               v.sku.startsWith("ITEM-") || v.sku.includes("-")
//                 ? generateVariantSku(value, v.name || "OPTION")
//                 : v.sku,
//           })),
//         );
//       }
//       return updated;
//     });
//   };

//   const updateVariantInput = (index: number, key: string, value: string) => {
//     setVariantInputs((prev) => {
//       const next = [...prev];
//       const currentVal = next[index];
//       let newSku = currentVal.sku;

//       if (key === "name" && dialog === "create") {
//         newSku = generateVariantSku(fields.name, value || `VAR-${index + 1}`);
//       }

//       next[index] = {
//         ...next[index],
//         [key]: value,
//         sku: key === "name" ? newSku : key === "sku" ? value : currentVal.sku,
//       };
//       return next;
//     });
//   };

//   const openCreate = () => {
//     setFields({
//       ...emptyProduct,
//       name: "",
//       categoryId: props.categories[0]?.id ?? "",
//       initialStock: "0",
//     });
//     setVariantInputs([
//       {
//         name: "Each",
//         sku: generateVariantSku("ITEM", "EACH"),
//         price: "",
//         costPrice: "",
//         barcode: generateVariantBarcode(),
//         initialStock: "0",
//         wholesalePrice: "",
//         wholesaleMinQuantity: "1",
//         color: "",
//         size: "",
//         manufacturingDate: "",
//         expiryDate: "",
//         bestBeforeDate: "",
//         unitFactor: "1",
//       },
//     ]);
//     setStaffPermissions([]);
//     setWizardStep(1);
//     setExpandedVariant(0);
//     setDialog("create");
//     setError(null);
//     setNotice(null);
//   };

//   const openEdit = (item: any) => {
//     setEditing(item);
//     const values: Fields =
//       section === "products"
//         ? {
//             name: item.name || "",
//             imageUrl: item.imageUrl || item.image || "",
//             categoryId: item.categoryId || "",
//             brandId: item.brandId || "",
//             supplierId: item.supplierId || "",
//             costPrice: String(item.costPrice ?? ""),
//             sellingPrice: String(item.price ?? ""),
//             genericName: item.genericName || "",
//             activeIngredient: item.activeIngredient || "",
//             strength: item.strength || "",
//             dosageForm: item.dosageForm || "",
//             manufacturer: item.manufacturer || "",
//             registrationNumber: item.registrationNumber || "",
//             baseUnitName: item.baseUnitName || "",
//           }
//         : Object.fromEntries(
//             formFields[section as EntitySection].map(({ name }) => [
//               name,
//               name === "password" ? "" : String(item[name] ?? ""),
//             ]),
//           );
//     setFields(values);
//     if (section === "products" && item.variants?.length) {
//       setVariantInputs(
//         [...item.variants]
//           .sort(
//             (a: any, b: any) =>
//               Number(b.id === item.baseUnitVariantId) -
//               Number(a.id === item.baseUnitVariantId),
//           )
//           .map((v: any) => ({
//             id: v.id,
//             name: v.name || "",
//             sku: v.sku || generateVariantSku(),
//             price: String(v.price ?? ""),
//             costPrice: String(v.costPrice ?? ""),
//             barcode: v.barcode || generateVariantBarcode(),
//             initialStock: String(v.stock ?? 0),
//             wholesalePrice:
//               v.wholesalePrice == null ? "" : String(v.wholesalePrice),
//             wholesaleMinQuantity: String(v.wholesaleMinQuantity ?? 1),
//             unitFactor: String(v.unitFactor ?? 1),
//             color: v.color || "",
//             size: v.size || "",
//             manufacturingDate: v.manufacturingDate || "",
//             expiryDate: v.expiryDate || "",
//             bestBeforeDate: v.bestBeforeDate || "",
//           })),
//       );
//     } else {
//       setVariantInputs(
//         section === "products"
//           ? [
//               {
//                 name: "Each",
//                 sku: generateVariantSku(),
//                 price: String(item.price ?? 0),
//                 costPrice: String(item.costPrice ?? 0),
//                 barcode: generateVariantBarcode(),
//                 initialStock: String(item.stock ?? 0),
//                 wholesalePrice: "",
//                 wholesaleMinQuantity: "1",
//                 color: "",
//                 size: "",
//                 manufacturingDate: "",
//                 expiryDate: "",
//                 bestBeforeDate: "",
//                 unitFactor: "1",
//               },
//             ]
//           : [],
//       );
//     }
//     setStaffPermissions(item.permissions ?? []);
//     setWizardStep(1);
//     setExpandedVariant(0);
//     setDialog("edit");
//     setError(null);
//     setNotice(null);
//   };

//   const openStock = (productId = "") => {
//     if (!props.storeId) {
//       setError("Select a store before adjusting stock.");
//       return;
//     }
//     setStockFields({
//       productId,
//       variantId: "",
//       mode: "IN",
//       movementType: "ADJUSTMENT",
//       quantity: "",
//       reason: "",
//     });
//     setDialog("stock");
//     setError(null);
//     setNotice(null);
//   };

//   const submit = async (event: FormEvent) => {
//     event.preventDefault();
//     setBusy(true);
//     setError(null);
//     try {
//       if (dialog === "stock") {
//         const quantity = Number(stockFields.quantity);
//         if (
//           !stockFields.productId ||
//           !stockFields.variantId ||
//           !Number.isInteger(quantity) ||
//           quantity < 1 ||
//           !stockFields.reason.trim()
//         )
//           throw new Error(
//             "Choose a product option, enter a positive whole quantity, and add a reason.",
//           );
//         if (resultingStock < 0)
//           throw new Error(
//             "You cannot remove more stock than this option currently has.",
//           );
//         await props.onAdjustStock(
//           stockFields.productId,
//           stockFields.variantId || undefined,
//           stockFields.mode === "IN" ? quantity : -quantity,
//           stockFields.reason.trim(),
//           stockFields.mode === "OUT" ? stockFields.movementType : "ADJUSTMENT",
//         );
//         setNotice("Stock adjustment saved to the server.");
//       } else if (dialog === "edit") {
//         if (!editing?.id) throw new Error("Select a record to edit.");
//         const payload: Record<string, unknown> = {};
//         if (section === "products") {
//           payload.name = fields.name.trim();
//           payload.imageUrl = fields.imageUrl || undefined;
//           for (const key of ["sku", "barcode"] as const)
//             if (fields[key]?.trim()) payload[key] = fields[key].trim();
//           if (fields.costPrice !== "")
//             payload.costPrice = Number(fields.costPrice);
//           if (fields.categoryId) payload.categoryId = fields.categoryId;
//           if (fields.brandId) payload.brandId = fields.brandId;
//           if (fields.supplierId) payload.supplierId = fields.supplierId;
//           payload.genericName = fields.genericName?.trim() || undefined;
//           payload.activeIngredient =
//             fields.activeIngredient?.trim() || undefined;
//           payload.strength = fields.strength?.trim() || undefined;
//           payload.dosageForm = fields.dosageForm?.trim() || undefined;
//           payload.manufacturer = fields.manufacturer?.trim() || undefined;
//           payload.registrationNumber =
//             fields.registrationNumber?.trim() || undefined;
//           payload.baseUnitName = fields.baseUnitName?.trim() || "";
//           payload.baseUnitVariantId = fields.baseUnitName?.trim()
//             ? editing.baseUnitVariantId
//             : undefined;
//           if (variantInputs.length > 0) {
//             payload.sellingPrice = Number(variantInputs[0].price) || 0;
//             payload.costPrice = Number(variantInputs[0].costPrice) || 0;
//             payload.variants = variantInputs.map((v) => ({
//               id: v.id,
//               name: v.name.trim(),
//               sku: v.sku.trim() || undefined,
//               price: Number(v.price) || Number(fields.sellingPrice) || 0,
//               costPrice: v.costPrice ? Number(v.costPrice) : undefined,
//               barcode: v.barcode?.trim() || undefined,
//               wholesalePrice: v.wholesalePrice
//                 ? Number(v.wholesalePrice)
//                 : undefined,
//               wholesaleMinQuantity: Math.max(
//                 1,
//                 Number(v.wholesaleMinQuantity) || 1,
//               ),
//               unitFactor: Math.max(1, Math.floor(Number(v.unitFactor) || 1)),
//               color: v.color?.trim() || undefined,
//               size: v.size?.trim() || undefined,
//               manufacturingDate: v.manufacturingDate || undefined,
//               expiryDate: v.expiryDate || undefined,
//               bestBeforeDate: v.bestBeforeDate || undefined,
//             }));
//           }
//         } else {
//           for (const field of formFields[section as EntitySection]) {
//             const value = fields[field.name]?.trim();
//             if (value && field.name !== "password") payload[field.name] = value;
//           }
//           if (section === "staff") {
//             payload.permissions = staffPermissions;
//             if (fields.password?.trim())
//               payload.password = fields.password.trim();
//             if (props.storeId) payload.storeId = props.storeId;
//           }
//         }
//         await props.onUpdateEntity(
//           section as EntitySection,
//           editing.id,
//           payload,
//         );
//         setNotice(`${labels[section as EntitySection]} updated successfully.`);
//       } else if (section === "products") {
//         if (!props.storeId)
//           throw new Error("Select a store before creating a product.");
//         const parsedVariants = variantInputs
//           .filter((v) => v.name.trim())
//           .map((v, idx) => ({
//             name: v.name.trim(),
//             sku:
//               v.sku.trim() ||
//               generateVariantSku(fields.name, v.name.trim() || `VAR${idx + 1}`),
//             price: Number(v.price) || Number(fields.sellingPrice) || 0,
//             costPrice: v.costPrice ? Number(v.costPrice) : undefined,
//             barcode: v.barcode?.trim() || generateVariantBarcode(),
//             initialStock: Math.max(0, Math.floor(Number(v.initialStock) || 0)),
//             wholesalePrice: v.wholesalePrice
//               ? Number(v.wholesalePrice)
//               : undefined,
//             wholesaleMinQuantity: Math.max(
//               1,
//               Number(v.wholesaleMinQuantity) || 1,
//             ),
//             unitFactor: Math.max(1, Math.floor(Number(v.unitFactor) || 1)),
//             color: v.color?.trim() || undefined,
//             size: v.size?.trim() || undefined,
//             manufacturingDate: v.manufacturingDate || undefined,
//             expiryDate: v.expiryDate || undefined,
//             bestBeforeDate: v.bestBeforeDate || undefined,
//           }));

//         if (!parsedVariants.length)
//           throw new Error("Add at least one named sellable option.");
//         const primaryVariant = parsedVariants[0];

//         await props.onCreateProduct({
//           name: fields.name.trim(),
//           imageUrl: fields.imageUrl || undefined,
//           sku: fields.sku.trim() || undefined,
//           barcode: fields.barcode.trim() || undefined,
//           categoryId: fields.categoryId || undefined,
//           brandId: fields.brandId || undefined,
//           supplierId: fields.supplierId || undefined,
//           costPrice: primaryVariant.costPrice || 0,
//           sellingPrice: primaryVariant.price,
//           storeId: props.storeId,
//           variants: parsedVariants.length > 0 ? parsedVariants : undefined,
//           genericName: fields.genericName?.trim() || undefined,
//           activeIngredient: fields.activeIngredient?.trim() || undefined,
//           strength: fields.strength?.trim() || undefined,
//           dosageForm: fields.dosageForm?.trim() || undefined,
//           manufacturer: fields.manufacturer?.trim() || undefined,
//           registrationNumber: fields.registrationNumber?.trim() || undefined,
//           baseUnitName: fields.baseUnitName?.trim() || undefined,
//         });
//         setNotice("Product created with variants and linked to store.");
//       } else {
//         const payload: Record<string, unknown> = {};
//         for (const field of formFields[section as EntitySection]) {
//           const value = fields[field.name]?.trim();
//           if (value) payload[field.name] = value;
//         }
//         if (section === "staff") {
//           if (props.userRole === "MANAGER" && !props.storeId) {
//             throw new Error(
//               "Your account has no assigned store. Ask an admin to assign one first.",
//             );
//           }
//           payload.permissions = staffPermissions;
//           payload.isActive = true;
//           payload.role ||= "CASHIER";
//           if (props.storeId) payload.storeId = props.storeId;
//         }
//         if (section === "customers" && !payload.tier) payload.tier = "BRONZE";
//         await props.onCreateEntity(section as EntitySection, payload);
//         setNotice(`${labels[section as EntitySection]} added successfully.`);
//       }
//       setDialog(null);
//     } catch (cause) {
//       const err = cause as { data?: { message?: string }; message?: string };
//       setError(
//         err.data?.message || err.message || "Could not save this change.",
//       );
//     } finally {
//       setBusy(false);
//     }
//   };

//   const printQr = () => {
//     if (!selectedProduct || !qrData) return;
//     const popup = window.open("", "kanitt-label", "width=500,height=500");
//     if (!popup) {
//       setError(
//         "The print window was blocked. Allow pop-ups for this app and retry.",
//       );
//       return;
//     }
//     const title = selectedProduct.name.replace(/[&<>"']/g, "");
//     const code = (selectedProduct.barcode || selectedProduct.sku).replace(
//       /[&<>"']/g,
//       "",
//     );
//     popup.document.write(
//       `<!doctype html><html><head><title>QR label</title><style>body{font:14px Arial;text-align:center;padding:24px}.label{border:1px dashed #999;padding:20px;display:inline-block;max-width:300px}img{width:200px;height:200px}h2{font-size:18px}</style></head><body><article class="label"><h2>${title}</h2><img src="${qrData}"/><p>${code}</p><p>${Number(selectedProduct.price).toLocaleString()} MMK</p></article><script>window.onload=()=>window.print()</script></body></html>`,
//     );
//     popup.document.close();
//   };

//   const fileInputRef = useRef<HTMLInputElement>(null);

//   const downloadExcelTemplate = () => {
//     const headers =
//       "Product Name,Product SKU,Product Barcode,Category Name,Brand Name,Supplier Name,Generic Name,Active Ingredient,Strength,Dosage Form,Manufacturer,Registration Number,Base Unit,Variant Name,Variant SKU,Variant Barcode,Selling Price,Cost Price,Variant Initial Stock,Base Units per Variant,Wholesale Price,Min Wholesale Qty,Color,Size,Mfg Date,Expiry Date,Best Before Date\n";
//     const exampleRow1 =
//       "Sample T-Shirt,TSHIRT-001,,Apparel,Nike,Main Supplier,,,,,,,,Red / M,TS-1001-RED-M,885000100101,7500,5000,25,1,7000,10,Red,M,2026-01-01,,\n";
//     const exampleRow2 =
//       "Sample T-Shirt,TSHIRT-001,,Apparel,Nike,Main Supplier,,,,,,,,Blue / L,TS-1001-BLUE-L,885000100102,7800,5100,25,1,7200,10,Blue,L,2026-01-01,,\n";
//     const exampleRow3 =
//       "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Tablet,PCM-500-TAB,885000200199,200,100,0,1,180,10,,,,2025-06-01,2028-06-01,\n";
//     const exampleRow4 =
//       "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Strip (10s),PCM-500-STRIP,885000200200,1800,900,0,10,1600,10,,,,2025-06-01,2028-06-01,\n";
//     const exampleRow5 =
//       "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Box (100s),PCM-500-BOX,885000200201,12000,9000,20,100,11000,5,,,,2025-06-01,2028-06-01,\n";
//     const blob = new Blob(
//       [
//         "\uFEFF",
//         headers,
//         exampleRow1,
//         exampleRow2,
//         exampleRow3,
//         exampleRow4,
//         exampleRow5,
//       ],
//       { type: "text/csv;charset=utf-8;" },
//     );
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.setAttribute("download", "Kanitt_Product_Import_Template.csv");
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const handleExcelFileUpload = async (
//     event: React.ChangeEvent<HTMLInputElement>,
//   ) => {
//     const file = event.target.files?.[0];
//     if (!file) return;
//     if (!file.name.toLowerCase().endsWith(".csv")) {
//       setError(
//         "This importer accepts CSV files only. Save the Excel file as CSV UTF-8, then import that CSV.",
//       );
//       if (fileInputRef.current) fileInputRef.current.value = "";
//       return;
//     }
//     if (!props.storeId) {
//       setError("Please select an active store before importing products.");
//       if (fileInputRef.current) fileInputRef.current.value = "";
//       return;
//     }
//     setBusy(true);
//     setError(null);
//     setNotice("Reading product template...");

//     try {
//       const rows = parseCsv(await file.text());
//       if (rows.length < 2)
//         throw new Error("The CSV is empty or has no product rows.");
//       const headers = rows[0].map(csvHeaderKey);
//       const findColumn = (...names: string[]) =>
//         headers.findIndex((header) => names.includes(header));
//       const columns = {
//         name: findColumn("productname", "name"),
//         category: findColumn("categoryname", "category"),
//         brand: findColumn("brandname", "brand"),
//         supplier: findColumn("suppliername", "supplier"),
//         genericName: findColumn("genericname", "generic"),
//         activeIngredient: findColumn("activeingredient", "ingredient"),
//         strength: findColumn("strength", "dose"),
//         dosageForm: findColumn("dosageform", "form"),
//         manufacturer: findColumn("manufacturer", "maker"),
//         registrationNumber: findColumn(
//           "registrationnumber",
//           "registrationid",
//           "drugregistration",
//         ),
//         baseUnit: findColumn("baseunit", "stockbaseunit", "smallestunit"),
//         productSku: findColumn("productsku", "mastersku"),
//         productBarcode: findColumn("productbarcode", "masterbarcode"),
//         variant: findColumn("variantname", "optionname", "variant"),
//         variantSku: findColumn("variantsku", "optionsku", "sku"),
//         variantBarcode: findColumn(
//           "variantbarcode",
//           "optionbarcode",
//           "barcode",
//         ),
//         price: findColumn("sellingprice", "price", "variantprice"),
//         cost: findColumn("costprice", "cost"),
//         stock: findColumn(
//           "variantinitialstock",
//           "variantstock",
//           "initialstock",
//           "startingstock",
//           "stock",
//           "quantity",
//         ),
//         unitFactor: findColumn(
//           "baseunitspervariant",
//           "unitfactor",
//           "packconversion",
//           "conversionfactor",
//         ),
//         wholesalePrice: findColumn("wholesaleprice", "wholesalecost"),
//         wholesaleMinQuantity: findColumn(
//           "minwholesaleqty",
//           "wholesaleqty",
//           "minwholesalequantity",
//         ),
//         color: findColumn("color", "colour"),
//         size: findColumn("size"),
//         manufacturingDate: findColumn("mfgdate", "manufacturingdate"),
//         expiryDate: findColumn("expirydate", "expdate"),
//         bestBeforeDate: findColumn("bestbeforedate", "bestbefore"),
//       };
//       if (columns.name < 0 || columns.price < 0) {
//         throw new Error(
//           "Template headers are missing. Use the downloaded template with Product Name and Selling Price columns.",
//         );
//       }

//       const products = new Map<
//         string,
//         {
//           name: string;
//           sku: string;
//           barcode: string;
//           categoryName: string;
//           brandName: string;
//           supplierName: string;
//           genericName: string;
//           activeIngredient: string;
//           strength: string;
//           dosageForm: string;
//           manufacturer: string;
//           registrationNumber: string;
//           baseUnitName: string;
//           variants: Record<string, unknown>[];
//         }
//       >();

//       for (const [index, row] of rows.slice(1).entries()) {
//         const cell = (column: number) =>
//           column < 0 ? "" : String(row[column] ?? "").trim();
//         const name = cell(columns.name);
//         if (!name)
//           throw new Error(`Row ${index + 2}: Product Name is required.`);
//         const variantName = cell(columns.variant) || "Each";
//         const productSku = cell(columns.productSku);
//         const productBarcode = cell(columns.productBarcode);
//         const priceText = cell(columns.price).replace(/,/g, "");
//         const costText = cell(columns.cost).replace(/,/g, "");
//         const stockText = cell(columns.stock).replace(/,/g, "");
//         const price = Number(priceText);
//         const costPrice = costText ? Number(costText) : 0;
//         const initialStock = stockText ? Number(stockText) : 0;
//         const baseUnitName = cell(columns.baseUnit);
//         const unitFactorText = cell(columns.unitFactor).replace(/,/g, "");
//         const unitFactor = unitFactorText ? Number(unitFactorText) : 1;

//         if (!priceText || !Number.isFinite(price) || price < 0)
//           throw new Error(
//             `Row ${index + 2}: Selling Price must be a valid non-negative number.`,
//           );
//         if (!Number.isFinite(costPrice) || costPrice < 0)
//           throw new Error(
//             `Row ${index + 2}: Cost Price must be a valid non-negative number.`,
//           );
//         if (!Number.isInteger(initialStock) || initialStock < 0)
//           throw new Error(
//             `Row ${index + 2}: Initial Stock must be a non-negative whole number.`,
//           );
//         if (!Number.isInteger(unitFactor) || unitFactor < 1)
//           throw new Error(
//             `Row ${index + 2}: Base Units per Variant must be a positive whole number.`,
//           );
//         if (!baseUnitName && unitFactor !== 1)
//           throw new Error(
//             `Row ${index + 2}: Set a Base Unit before using a pack conversion.`,
//           );

//         const categoryName = cell(columns.category);
//         const brandName = cell(columns.brand);
//         const supplierName = cell(columns.supplier);
//         const medicine = {
//           genericName: cell(columns.genericName),
//           activeIngredient: cell(columns.activeIngredient),
//           strength: cell(columns.strength),
//           dosageForm: cell(columns.dosageForm),
//           manufacturer: cell(columns.manufacturer),
//           registrationNumber: cell(columns.registrationNumber),
//         };

//         const wholesalePriceText = cell(columns.wholesalePrice).replace(
//           /,/g,
//           "",
//         );
//         const wholesaleMinQtyText = cell(columns.wholesaleMinQuantity).replace(
//           /,/g,
//           "",
//         );

//         const variantObj: Record<string, unknown> = {
//           name: variantName,
//           sku:
//             cell(columns.variantSku) || generateVariantSku(name, variantName),
//           barcode: cell(columns.variantBarcode) || generateVariantBarcode(),
//           price,
//           costPrice,
//           initialStock,
//           unitFactor,
//           wholesalePrice: wholesalePriceText
//             ? Number(wholesalePriceText)
//             : undefined,
//           wholesaleMinQuantity: wholesaleMinQtyText
//             ? Number(wholesaleMinQtyText)
//             : undefined,
//           color: cell(columns.color) || undefined,
//           size: cell(columns.size) || undefined,
//           manufacturingDate: cell(columns.manufacturingDate) || undefined,
//           expiryDate: cell(columns.expiryDate) || undefined,
//           bestBeforeDate: cell(columns.bestBeforeDate) || undefined,
//         };

//         const key = (productSku || name).toLocaleLowerCase();
//         const product = products.get(key) ?? {
//           name,
//           sku: productSku,
//           barcode: productBarcode,
//           categoryName,
//           brandName,
//           supplierName,
//           ...medicine,
//           baseUnitName,
//           variants: [],
//         };

//         if (product.name.toLocaleLowerCase() !== name.toLocaleLowerCase()) {
//           throw new Error(
//             `Rows for product SKU "${productSku}" use different product names.`,
//           );
//         }

//         if (
//           product.categoryName &&
//           categoryName &&
//           product.categoryName.toLocaleLowerCase() !==
//             categoryName.toLocaleLowerCase()
//         ) {
//           throw new Error(
//             `Rows for "${name}" use different categories. Keep one category per product.`,
//           );
//         }
//         if (!product.categoryName) product.categoryName = categoryName;
//         if (
//           product.sku &&
//           productSku &&
//           product.sku.toLowerCase() !== productSku.toLowerCase()
//         ) {
//           throw new Error(`Rows for "${name}" use different product SKUs.`);
//         }
//         if (
//           product.barcode &&
//           productBarcode &&
//           product.barcode !== productBarcode
//         ) {
//           throw new Error(`Rows for "${name}" use different product barcodes.`);
//         }
//         if (!product.brandName) product.brandName = brandName;
//         if (!product.supplierName) product.supplierName = supplierName;
//         if (
//           product.baseUnitName &&
//           baseUnitName &&
//           product.baseUnitName.toLocaleLowerCase() !==
//             baseUnitName.toLocaleLowerCase()
//         ) {
//           throw new Error(`Rows for "${name}" use different Base Units.`);
//         }
//         if (!product.baseUnitName) product.baseUnitName = baseUnitName;

//         product.variants.push(variantObj);
//         products.set(key, product);
//       }

//       let successCount = 0;
//       let importedOptionCount = 0;
//       const failures: string[] = [];

//       for (const product of products.values()) {
//         const category = product.categoryName
//           ? props.categories.find(
//               (item: any) =>
//                 String(item.name).trim().toLocaleLowerCase() ===
//                 product.categoryName.toLocaleLowerCase(),
//             )
//           : undefined;
//         const brand = product.brandName
//           ? props.brands.find(
//               (item: any) =>
//                 String(item.name).trim().toLocaleLowerCase() ===
//                 product.brandName.toLocaleLowerCase(),
//             )
//           : undefined;
//         const supplier = product.supplierName
//           ? props.suppliers.find(
//               (item: any) =>
//                 String(item.name).trim().toLocaleLowerCase() ===
//                 product.supplierName.toLocaleLowerCase(),
//             )
//           : undefined;

//         if (product.categoryName && !category) {
//           failures.push(
//             `${product.name}: category "${product.categoryName}" was not found`,
//           );
//           continue;
//         }

//         const primaryVariant = product.variants[0] as any;
//         if (
//           product.baseUnitName &&
//           Number(primaryVariant.unitFactor ?? 1) !== 1
//         ) {
//           failures.push(
//             `${product.name}: put the base-unit option (conversion 1) on the first row for this product`,
//           );
//           continue;
//         }

//         try {
//           await props.onCreateProduct({
//             name: product.name,
//             sku: product.sku || serial(),
//             barcode: product.barcode || undefined,
//             categoryId: category?.id,
//             brandId: brand?.id,
//             supplierId: supplier?.id,
//             storeId: props.storeId,
//             sellingPrice: primaryVariant.price,
//             costPrice: primaryVariant.costPrice,
//             genericName: product.genericName || undefined,
//             activeIngredient: product.activeIngredient || undefined,
//             strength: product.strength || undefined,
//             dosageForm: product.dosageForm || undefined,
//             manufacturer: product.manufacturer || undefined,
//             registrationNumber: product.registrationNumber || undefined,
//             baseUnitName: product.baseUnitName || undefined,
//             variants: product.variants,
//           });
//           successCount++;
//           importedOptionCount += product.variants.length;
//         } catch (cause) {
//           const error = cause as {
//             data?: { message?: string };
//             message?: string;
//           };
//           failures.push(
//             `${product.name}: ${error.data?.message || error.message || "could not be imported"}`,
//           );
//         }
//       }

//       setNotice(
//         `Imported ${successCount} product${successCount === 1 ? "" : "s"} with ${importedOptionCount} sellable option${importedOptionCount === 1 ? "" : "s"}.`,
//       );
//       if (failures.length)
//         setError(
//           `Could not import ${failures.length} product${failures.length === 1 ? "" : "s"}: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "; see the file and try again" : ""}`,
//         );
//     } catch (err: any) {
//       setError(err.message || "Failed to process import file.");
//     } finally {
//       setBusy(false);
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     }
//   };

//   /* ---------------------- option lists ---------------------- */
//   const categoryOptions = props.categories.map((c: any) => ({
//     id: c.id,
//     name: c.name,
//     meta: c.description || undefined,
//   }));
//   const brandOptions = props.brands.map((b: any) => ({
//     id: b.id,
//     name: b.name,
//     meta: b.description || undefined,
//   }));
//   const supplierOptions = props.suppliers.map((s: any) => ({
//     id: s.id,
//     name: s.name,
//     meta: [s.code, s.phone].filter(Boolean).join(" · ") || undefined,
//   }));

//   /* ---------------------- render ---------------------- */
//   return (
//     <main className="flex-1 overflow-y-auto p-7">
//       <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
//         <div>
//           <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
//             Workspace tools
//           </p>
//           <h1 className="mt-2 text-3xl font-black text-white">Manage</h1>
//           <p className="mt-1 text-sm text-slate-400">
//             Catalog, stock, people and customer records for{" "}
//             {props.stores.find((store) => store.id === props.storeId)?.name ??
//               "your workspace"}
//             .
//           </p>
//         </div>
//         <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
//           {props.loading ? "Refreshing data…" : "Live server data"}
//         </span>
//       </header>

//       <nav className="mb-5 flex flex-wrap gap-2">
//         {sections
//           .filter(
//             ({ id }) =>
//               id !== "stores" ||
//               props.userRole === "ADMIN" ||
//               props.userRole === "SUPER_ADMIN",
//           )
//           .map(({ id, title, icon: Icon }) => (
//             <button
//               key={id}
//               onClick={() => {
//                 setSection(id);
//                 setSearch("");
//                 setNotice(null);
//                 setError(null);
//               }}
//               className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
//                 section === id
//                   ? "border-sky-400/50 bg-sky-400/10 text-sky-200"
//                   : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
//               }`}
//             >
//               <Icon className="h-4 w-4" />
//               {title}
//             </button>
//           ))}
//       </nav>

//       {error && !dialog && (
//         <p
//           role="alert"
//           className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
//         >
//           {error}
//         </p>
//       )}
//       {notice && !dialog && (
//         <p
//           role="status"
//           className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
//         >
//           {notice}
//         </p>
//       )}

//       {section === "stock" ? (
//         <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
//           <h2 className="text-lg font-bold text-white">Adjust store stock</h2>
//           <p className="mb-5 mt-1 text-sm text-slate-400">
//             Search by product name, SKU or barcode. Updates apply to{" "}
//             {props.stores.find((store) => store.id === props.storeId)?.name ||
//               "the selected store"}{" "}
//             and are recorded in the stock movement history.
//           </p>
//           <button
//             onClick={() => openStock()}
//             className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400"
//           >
//             <Plus className="h-4 w-4" />
//             New adjustment
//           </button>
//           <p className="mt-4 text-xs text-slate-500">
//             Requires an ADMIN or MANAGER account with inventory permission.
//           </p>
//         </section>
//       ) : section === "qr" ? (
//         <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
//           <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
//             <div className="flex items-center gap-3 border-b border-slate-800 p-4">
//               <input
//                 value={search}
//                 onChange={(event) => setSearch(event.target.value)}
//                 placeholder="Find product by name, SKU or code"
//                 className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
//               />
//             </div>
//             <div className="max-h-[65vh] overflow-y-auto">
//               {filteredRows.map((product: Product) => (
//                 <button
//                   key={product.id}
//                   onClick={() => setSelectedQrProduct(product.id)}
//                   className={`flex w-full items-center justify-between border-b border-slate-800/70 px-4 py-3 text-left ${
//                     selectedQrProduct === product.id
//                       ? "bg-sky-500/10"
//                       : "hover:bg-slate-800/40"
//                   }`}
//                 >
//                   <span>
//                     <span className="block text-sm font-semibold text-slate-100">
//                       {product.name}
//                     </span>
//                     <span className="mt-1 block font-mono text-xs text-slate-500">
//                       {product.barcode || product.sku}
//                     </span>
//                   </span>
//                   <Barcode className="h-4 w-4 text-sky-300" />
//                 </button>
//               ))}
//             </div>
//           </div>
//           <aside className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center">
//             <h2 className="font-bold text-white">QR label preview</h2>
//             {selectedProduct && qrData ? (
//               <>
//                 <img
//                   src={qrData}
//                   alt={`QR for ${selectedProduct.name}`}
//                   className="mt-4 h-52 w-52 rounded-xl bg-white p-2"
//                 />
//                 <p className="mt-3 text-sm font-semibold text-slate-200">
//                   {selectedProduct.name}
//                 </p>
//                 <p className="mt-1 font-mono text-xs text-slate-500">
//                   {selectedProduct.barcode || selectedProduct.sku}
//                 </p>
//                 <div className="mt-4 flex w-full gap-2">
//                   <button
//                     onClick={async () => {
//                       if (!selectedProduct.barcode) {
//                         const value = serial();
//                         try {
//                           await props.onAssignBarcode(
//                             selectedProduct.id,
//                             value,
//                           );
//                           setNotice(`QR/barcode ${value} assigned.`);
//                         } catch (cause) {
//                           const err = cause as {
//                             data?: { message?: string };
//                             message?: string;
//                           };
//                           setError(
//                             err.data?.message ||
//                               err.message ||
//                               "Could not assign barcode.",
//                           );
//                           return;
//                         }
//                       }
//                     }}
//                     className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
//                   >
//                     {selectedProduct.barcode ? "Code assigned" : "Assign code"}
//                   </button>
//                   <button
//                     onClick={printQr}
//                     className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-sky-400"
//                   >
//                     <Printer className="h-3.5 w-3.5" />
//                     Print
//                   </button>
//                 </div>
//               </>
//             ) : (
//               <p className="mt-10 text-sm text-slate-500">
//                 Select a product with a SKU to preview its QR code.
//               </p>
//             )}
//           </aside>
//         </section>
//       ) : (
//         <>
//           <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
//             <div className="flex min-w-[280px] flex-1 items-center gap-3">
//               <div className="relative min-w-64 flex-1">
//                 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
//                 <input
//                   value={search}
//                   onChange={(event) => {
//                     setSearch(event.target.value);
//                     setCurrentPage(1);
//                   }}
//                   placeholder={`Search ${section}…`}
//                   className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white outline-none focus:border-sky-500"
//                 />
//               </div>
//             </div>

//             <div className="flex flex-wrap items-center gap-3">
//               <label className="flex items-center gap-2 text-xs text-slate-400">
//                 Per page:
//                 <select
//                   value={pageSize}
//                   onChange={(e) => {
//                     setPageSize(Number(e.target.value));
//                     setCurrentPage(1);
//                   }}
//                   className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
//                 >
//                   <option value={50}>50</option>
//                   <option value={100}>100</option>
//                   <option value={250}>250</option>
//                   <option value={500}>500</option>
//                   <option value={0}>All ({totalItems})</option>
//                 </select>
//               </label>

//               {section === "products" && (
//                 <>
//                   <button
//                     onClick={downloadExcelTemplate}
//                     className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
//                     title="Download UTF-8 CSV product template"
//                   >
//                     <Download className="h-4 w-4 text-emerald-400" />
//                     Template
//                   </button>
//                   <input
//                     type="file"
//                     ref={fileInputRef}
//                     accept=".csv,text/csv"
//                     onChange={handleExcelFileUpload}
//                     className="hidden"
//                   />
//                   <button
//                     onClick={() => fileInputRef.current?.click()}
//                     disabled={busy}
//                     className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
//                     title="Import products from a CSV file"
//                   >
//                     <FileSpreadsheet className="h-4 w-4" />
//                     Import CSV
//                   </button>
//                   <button
//                     onClick={() => openStock()}
//                     className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-900"
//                   >
//                     <RotateCcw className="h-4 w-4" />
//                     Adjust stock
//                   </button>
//                 </>
//               )}
//               <button
//                 onClick={openCreate}
//                 className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400"
//               >
//                 <Plus className="h-4 w-4" />
//                 Add {labels[section as EntitySection]}
//               </button>
//             </div>
//           </section>

//           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
//             <div className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
//               <span>Name</span>
//               <span>
//                 {section === "products"
//                   ? "SKU / barcode"
//                   : section === "stores"
//                     ? "Store code"
//                     : section === "staff"
//                       ? "Role"
//                       : "Contact"}
//               </span>
//               <span>
//                 {section === "products"
//                   ? "Price"
//                   : section === "stores"
//                     ? "Status"
//                     : "Code / status"}
//               </span>
//               <span>
//                 {section === "stores" ? "Address / phone" : "Details"}
//               </span>
//             </div>
//             {paginatedRows.map((item: any) => (
//               <div
//                 key={item.id}
//                 className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-slate-800/70 px-5 py-3.5 last:border-0"
//               >
//                 <div className="flex min-w-0 items-center gap-3">
//                   {section === "products" &&
//                     (item.imageUrl || item.image ? (
//                       <img
//                         src={resolveMediaUrl(item.imageUrl || item.image)}
//                         alt=""
//                         loading="lazy"
//                         className="h-10 w-10 shrink-0 rounded-lg bg-slate-800 object-cover"
//                       />
//                     ) : (
//                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
//                         <Package className="h-4 w-4" />
//                       </div>
//                     ))}
//                   <div className="min-w-0">
//                     <span className="block truncate text-sm font-semibold text-slate-100">
//                       {item.name}
//                     </span>
//                     {section === "products" &&
//                       (item.genericName ||
//                         item.activeIngredient ||
//                         item.strength ||
//                         item.dosageForm) && (
//                         <span className="mt-0.5 block truncate text-[11px] font-medium text-emerald-400/90">
//                           {[
//                             item.genericName,
//                             item.activeIngredient,
//                             item.strength,
//                             item.dosageForm,
//                           ]
//                             .filter(Boolean)
//                             .join(" · ")}
//                         </span>
//                       )}
//                   </div>
//                 </div>
//                 <span className="truncate font-mono text-xs text-slate-400">
//                   {section === "products"
//                     ? `${item.sku || "—"} · ${item.barcode || "—"}`
//                     : section === "stores"
//                       ? item.code || "—"
//                       : section === "staff"
//                         ? item.role
//                         : item.email || item.phone || item.contactName || "—"}
//                 </span>
//                 <span className="truncate text-xs text-slate-400">
//                   {section === "products"
//                     ? `${Number(item.price).toLocaleString()} MMK · ${item.variants?.length ?? 0} options`
//                     : section === "stores"
//                       ? item.isActive === false
//                         ? "Inactive"
//                         : "Active"
//                       : item.code ||
//                         (item.isActive === false ? "Inactive" : "Active")}
//                 </span>
//                 <span className="text-xs text-slate-500">
//                   {section === "stores"
//                     ? item.address || item.phone || "—"
//                     : (item._count?.products ?? item.storeName ?? "—")}
//                 </span>
//                 <button
//                   onClick={() => openEdit(item)}
//                   className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:border-sky-400/40 hover:text-white"
//                 >
//                   Edit
//                 </button>
//               </div>
//             ))}
//             {!filteredRows.length && (
//               <p className="p-10 text-center text-sm text-slate-400">
//                 {props.loading ? "Loading…" : `No ${section} found.`}
//               </p>
//             )}
//           </section>

//           {totalItems > 0 && (
//             <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
//               <p className="text-xs text-slate-400">
//                 Showing{" "}
//                 <strong className="text-white">
//                   {startItem.toLocaleString()}
//                 </strong>{" "}
//                 to{" "}
//                 <strong className="text-white">
//                   {endItem.toLocaleString()}
//                 </strong>{" "}
//                 of{" "}
//                 <strong className="text-white">
//                   {totalItems.toLocaleString()}
//                 </strong>{" "}
//                 {section}
//               </p>

//               {pageSize > 0 && totalPages > 1 && (
//                 <div className="flex items-center gap-2">
//                   <button
//                     onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
//                     disabled={activePage <= 1}
//                     className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40"
//                   >
//                     <ChevronLeft className="h-3.5 w-3.5" /> Previous
//                   </button>
//                   <span className="px-2 text-xs text-slate-400">
//                     Page <strong className="text-white">{activePage}</strong> of{" "}
//                     {totalPages}
//                   </span>
//                   <button
//                     onClick={() =>
//                       setCurrentPage((p) => Math.min(totalPages, p + 1))
//                     }
//                     disabled={activePage >= totalPages}
//                     className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 disabled:opacity-40"
//                   >
//                     Next <ChevronRight className="h-3.5 w-3.5" />
//                   </button>
//                 </div>
//               )}
//             </div>
//           )}
//         </>
//       )}

//       <section className="mt-6 flex flex-wrap gap-2 text-xs">
//         {(
//           [
//             ["Inventory view", "inventory"],
//             ["Register sessions", "sessions"],
//             ["Workspace settings", "settings"],
//           ] as const
//         ).map(([title, tab]) => (
//           <button
//             key={tab}
//             onClick={() => props.onNavigate(tab)}
//             className="rounded-lg border border-slate-800 px-3 py-2 text-slate-400 hover:text-slate-200"
//           >
//             {title} →
//           </button>
//         ))}
//       </section>

//       {dialog && (
//         <div
//           className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
//           onClick={(e) => {
//             if (e.target === e.currentTarget) setDialog(null);
//           }}
//         >
//           <form
//             onSubmit={submit}
//             className={`max-h-[96dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-all duration-300 sm:max-h-[92dvh] sm:rounded-2xl ${
//               (dialog === "create" || dialog === "edit") &&
//               section === "products"
//                 ? "max-w-6xl"
//                 : dialog === "stock"
//                   ? "max-w-3xl"
//                   : "max-w-3xl"
//             }`}
//             style={{ padding: 0 }}
//           >
//             {/* ——— Wizard Header ——— */}
//             {(dialog === "create" || dialog === "edit") &&
//             section === "products" ? (
//               <div className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-800 bg-slate-900/95 px-6 pb-4 pt-5 backdrop-blur-sm">
//                 <div className="mb-4 flex items-center justify-between">
//                   <div>
//                     <h2 className="text-xl font-bold text-white">
//                       {dialog === "edit" ? "Edit product" : "New product"}
//                     </h2>
//                     <p className="mt-0.5 text-xs text-slate-500">
//                       Saved directly to the selected tenant.
//                     </p>
//                   </div>
//                   <button
//                     type="button"
//                     onClick={() => setDialog(null)}
//                     className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
//                   >
//                     <X className="h-5 w-5" />
//                   </button>
//                 </div>
//                 <div className="flex items-center gap-1">
//                   {[
//                     { step: 1, label: "Product Info", icon: Package },
//                     { step: 2, label: "Variants & Pricing", icon: Layers },
//                     { step: 3, label: "Review", icon: Eye },
//                   ].map(({ step, label, icon: StepIcon }, idx) => (
//                     <div key={step} className="flex flex-1 items-center">
//                       <button
//                         type="button"
//                         onClick={() => {
//                           if (
//                             step < wizardStep ||
//                             (step === 2 && fields.name.trim())
//                           )
//                             setWizardStep(step);
//                         }}
//                         className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
//                           wizardStep === step
//                             ? "border border-sky-500/30 bg-sky-500/15 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.08)]"
//                             : wizardStep > step
//                               ? "cursor-pointer border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
//                               : "cursor-default border border-slate-800 bg-slate-800/50 text-slate-500"
//                         }`}
//                       >
//                         <span
//                           className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
//                             wizardStep === step
//                               ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
//                               : wizardStep > step
//                                 ? "bg-emerald-500 text-white"
//                                 : "bg-slate-700 text-slate-400"
//                           }`}
//                         >
//                           {wizardStep > step ? (
//                             <Check className="h-3.5 w-3.5" />
//                           ) : (
//                             step
//                           )}
//                         </span>
//                         <span className="hidden truncate sm:inline">
//                           {label}
//                         </span>
//                         <StepIcon
//                           className={`h-3.5 w-3.5 flex-shrink-0 sm:hidden ${
//                             wizardStep === step
//                               ? "text-sky-400"
//                               : wizardStep > step
//                                 ? "text-emerald-400"
//                                 : "text-slate-600"
//                           }`}
//                         />
//                       </button>
//                       {idx < 2 && (
//                         <div
//                           className={`mx-1 hidden h-px w-4 flex-shrink-0 transition-colors sm:block ${
//                             wizardStep > step
//                               ? "bg-emerald-500/40"
//                               : "bg-slate-700"
//                           }`}
//                         />
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             ) : (
//               <div className="px-6 pt-6">
//                 <div className="mb-5 flex items-center justify-between">
//                   <div>
//                     <h2 className="text-xl font-bold text-white">
//                       {dialog === "stock"
//                         ? "Stock adjustment"
//                         : dialog === "edit"
//                           ? `Edit ${labels[section as EntitySection]}`
//                           : `Add ${labels[section as EntitySection]}`}
//                     </h2>
//                     <p className="mt-1 text-xs text-slate-400">
//                       Saved directly to the selected tenant.
//                     </p>
//                   </div>
//                   <button
//                     type="button"
//                     onClick={() => setDialog(null)}
//                     className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
//                   >
//                     <X className="h-5 w-5" />
//                   </button>
//                 </div>
//               </div>
//             )}

//             {dialog === "stock" ? (
//               <div className="space-y-4 px-6 py-5">
//                 <SearchableProductPicker
//                   products={props.products}
//                   value={stockFields.productId}
//                   placeholder="Search name, SKU or barcode…"
//                   onChange={(productId) => {
//                     const product = props.products.find(
//                       (item) => item.id === productId,
//                     );
//                     setStockFields((current) => ({
//                       ...current,
//                       productId,
//                       variantId:
//                         product?.variants?.length === 1
//                           ? product.variants[0].id
//                           : "",
//                     }));
//                   }}
//                 />
//                 {!!props.products.find(
//                   (product) => product.id === stockFields.productId,
//                 )?.variants?.length && (
//                   <ChoiceCards
//                     label="Choose product option"
//                     value={stockFields.variantId}
//                     onChange={(variantId) =>
//                       setStockFields((current) => ({ ...current, variantId }))
//                     }
//                     options={(
//                       props.products.find(
//                         (product) => product.id === stockFields.productId,
//                       )?.variants ?? []
//                     ).map((variant) => ({
//                       value: variant.id,
//                       label: variant.name,
//                       description: `${Number(variant.stock ?? 0).toLocaleString()} units on hand in this store`,
//                       badge: variant.sku,
//                     }))}
//                   />
//                 )}
//                 {stockVariant && (
//                   <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
//                     <p className="text-[11px] text-slate-400">
//                       This store · {stockVariant.name}
//                     </p>
//                     <div className="mt-1 flex items-center justify-between">
//                       <span className="text-sm font-semibold text-slate-200">
//                         On hand
//                       </span>
//                       <span className="text-sm font-bold text-white">
//                         {currentStock} <span className="text-slate-500">→</span>{" "}
//                         <span
//                           className={
//                             resultingStock < 0
//                               ? "text-rose-300"
//                               : "text-sky-300"
//                           }
//                         >
//                           {resultingStock}
//                         </span>
//                       </span>
//                     </div>
//                   </div>
//                 )}
//                 <div className="space-y-3">
//                   <ChoiceCards
//                     label="Adjustment"
//                     value={stockFields.mode}
//                     onChange={(mode) =>
//                       setStockFields((current) => ({ ...current, mode }))
//                     }
//                     options={[
//                       {
//                         value: "IN",
//                         label: "Add stock",
//                         description:
//                           "Physical count is higher than the system.",
//                       },
//                       {
//                         value: "OUT",
//                         label: "Remove stock",
//                         description: "Damage, expiry, or a count correction.",
//                       },
//                     ]}
//                   />
//                   <label className="block text-xs text-slate-400">
//                     Units
//                     <input
//                       type="number"
//                       min="1"
//                       step="1"
//                       required
//                       value={stockFields.quantity}
//                       onChange={(event) =>
//                         setStockFields((current) => ({
//                           ...current,
//                           quantity: event.target.value,
//                         }))
//                       }
//                       className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
//                     />
//                   </label>
//                 </div>
//                 <label className="block text-xs text-slate-400">
//                   Why is stock changing?
//                   <input
//                     required
//                     minLength={3}
//                     value={stockFields.reason}
//                     onChange={(event) =>
//                       setStockFields((current) => ({
//                         ...current,
//                         reason: event.target.value,
//                       }))
//                     }
//                     placeholder="e.g. Count correction or damaged units"
//                     className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
//                   />
//                 </label>
//                 <p className="text-[11px] leading-relaxed text-slate-500">
//                   Use a purchase order to receive supplier deliveries. This form
//                   is for stock corrections and losses.
//                 </p>
//                 {stockFields.mode === "OUT" && (
//                   <div>
//                     <ChoiceCards
//                       label="Reason type"
//                       value={stockFields.movementType}
//                       onChange={(movementType) =>
//                         setStockFields((current) => ({
//                           ...current,
//                           movementType: movementType as
//                             | "ADJUSTMENT"
//                             | "DAMAGE"
//                             | "EXPIRED",
//                         }))
//                       }
//                       options={[
//                         { value: "ADJUSTMENT", label: "Count correction" },
//                         { value: "DAMAGE", label: "Damaged" },
//                         { value: "EXPIRED", label: "Expired" },
//                       ]}
//                     />
//                   </div>
//                 )}
//               </div>
//             ) : section === "products" ? (
//               <div className="px-6 py-5">
//                 {/* ═══════ STEP 1: Product Info ═══════ */}
//                 {wizardStep === 1 && (
//                   <div className="space-y-5">
//                     <div>
//                       <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
//                         <Package className="h-4 w-4 text-sky-400" />
//                         Product details
//                       </h3>
//                       <p className="mt-1 text-xs text-slate-500">
//                         Basic information about this product. Pricing comes
//                         next.
//                       </p>
//                     </div>
//                     <div className="space-y-4">
//                       <label className="block text-xs font-medium text-slate-400">
//                         Product name <span className="text-rose-400">*</span>
//                         <input
//                           required
//                           autoFocus
//                           placeholder="e.g. Classic White T-Shirt"
//                           value={fields.name}
//                           onChange={(e) => setField("name", e.target.value)}
//                           className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
//                         />
//                       </label>
//                       <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
//                         <label className="block text-xs font-semibold text-slate-300">
//                           Product photo{" "}
//                           <span className="font-normal text-slate-500">
//                             (JPG, PNG or WebP · up to 5 MB)
//                           </span>
//                           <input
//                             type="file"
//                             accept="image/jpeg,image/png,image/webp"
//                             className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
//                             onChange={async (event) => {
//                               const input = event.currentTarget;
//                               const file = event.currentTarget.files?.[0];
//                               if (!file || !props.storeId) return;
//                               setBusy(true);
//                               setError(null);
//                               try {
//                                 const imageUrl =
//                                   await apiService.uploadProductImage(
//                                     file,
//                                     props.storeId,
//                                     editing?.id,
//                                   );
//                                 setField("imageUrl", imageUrl);
//                               } catch (cause) {
//                                 setError(
//                                   cause instanceof Error
//                                     ? cause.message
//                                     : "Image upload failed.",
//                                 );
//                               } finally {
//                                 setBusy(false);
//                                 input.value = "";
//                               }
//                             }}
//                           />
//                         </label>
//                         {fields.imageUrl && (
//                           <div className="mt-3 flex items-center gap-3">
//                             <img
//                               src={resolveMediaUrl(fields.imageUrl)}
//                               alt="Product preview"
//                               className="h-16 w-16 rounded-lg bg-slate-800 object-cover"
//                             />
//                             <button
//                               type="button"
//                               onClick={() => setField("imageUrl", "")}
//                               className="text-xs text-rose-300 hover:text-rose-200"
//                             >
//                               Remove photo
//                             </button>
//                           </div>
//                         )}
//                       </div>

//                       <div className="grid gap-4 sm:grid-cols-2">
//                         <ComboSelect
//                           label="Category"
//                           value={fields.categoryId}
//                           onChange={(v) => setField("categoryId", v)}
//                           options={categoryOptions}
//                           placeholder="No category"
//                           noneLabel="No category"
//                         />
//                         <ComboSelect
//                           label="Brand"
//                           value={fields.brandId}
//                           onChange={(v) => setField("brandId", v)}
//                           options={brandOptions}
//                           placeholder="No brand"
//                           noneLabel="No brand"
//                         />
//                       </div>
//                       <ComboSelect
//                         label="Supplier"
//                         value={fields.supplierId}
//                         onChange={(v) => setField("supplierId", v)}
//                         options={supplierOptions}
//                         placeholder="No supplier"
//                         noneLabel="No supplier"
//                         hint="Start typing to filter suppliers"
//                       />
//                     </div>

//                     <details className="group overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5">
//                       <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10">
//                         <svg
//                           className="h-4 w-4 transition-transform group-open:rotate-90"
//                           fill="none"
//                           stroke="currentColor"
//                           viewBox="0 0 24 24"
//                         >
//                           <path
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             strokeWidth={2}
//                             d="M9 5l7 7-7 7"
//                           />
//                         </svg>
//                         Medicine / Pharmacy Details
//                         <span className="ml-1 text-[10px] font-normal text-slate-500">
//                           (optional — expand for drug catalog fields)
//                         </span>
//                       </summary>
//                       <div className="space-y-4 border-t border-emerald-500/10 px-4 pb-4 pt-2">
//                         <div className="grid gap-4 sm:grid-cols-2">
//                           <label className="block text-xs font-medium text-slate-400">
//                             Generic Name
//                             <input
//                               placeholder="e.g. Paracetamol"
//                               value={fields.genericName}
//                               onChange={(e) =>
//                                 setField("genericName", e.target.value)
//                               }
//                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-emerald-500"
//                             />
//                           </label>
//                           <label className="block text-xs font-medium text-slate-400">
//                             Active Ingredient
//                             <input
//                               placeholder="e.g. Paracetamol"
//                               value={fields.activeIngredient}
//                               onChange={(e) =>
//                                 setField("activeIngredient", e.target.value)
//                               }
//                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-emerald-500"
//                             />
//                           </label>
//                         </div>
//                         <div className="grid gap-4 sm:grid-cols-3">
//                           <label className="block text-xs font-medium text-slate-400">
//                             Strength
//                             <input
//                               placeholder="e.g. 500mg"
//                               value={fields.strength}
//                               onChange={(e) =>
//                                 setField("strength", e.target.value)
//                               }
//                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-emerald-500"
//                             />
//                           </label>
//                           <label className="block text-xs font-medium text-slate-400">
//                             Dosage Form
//                             <input
//                               placeholder="e.g. Tablet, Syrup"
//                               value={fields.dosageForm}
//                               onChange={(e) =>
//                                 setField("dosageForm", e.target.value)
//                               }
//                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-emerald-500"
//                             />
//                           </label>
//                           <label className="block text-xs font-medium text-slate-400">
//                             Registration No.
//                             <input
//                               placeholder="e.g. REG-12345"
//                               value={fields.registrationNumber}
//                               onChange={(e) =>
//                                 setField("registrationNumber", e.target.value)
//                               }
//                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-emerald-500"
//                             />
//                           </label>
//                         </div>
//                         <label className="block text-xs font-medium text-slate-400">
//                           Manufacturer
//                           <input
//                             placeholder="e.g. BPI, GPO"
//                             value={fields.manufacturer}
//                             onChange={(e) =>
//                               setField("manufacturer", e.target.value)
//                             }
//                             className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-emerald-500"
//                           />
//                         </label>
//                       </div>
//                     </details>

//                     <div className="flex items-start gap-3 rounded-xl border border-sky-500/15 bg-sky-500/5 px-4 py-3">
//                       <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-400" />
//                       <p className="text-xs leading-relaxed text-sky-300/80">
//                         In the next step, you'll add sellable options (variants)
//                         with individual pricing, SKU, and stock quantities.
//                       </p>
//                     </div>
//                   </div>
//                 )}

//                 {/* ═══════ STEP 2: Variants & Pricing (REDESIGNED) ═══════ */}
//                 {wizardStep === 2 && (
//                   <div className="space-y-4">
//                     {/* ─── Smallest stock unit (compact strip) ─── */}
//                     <section className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03]">
//                       <div className="flex items-center gap-3 px-4 py-3">
//                         <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
//                           <Layers className="h-4 w-4 text-emerald-400" />
//                         </div>
//                         <div className="min-w-0 flex-1">
//                           <p className="text-xs font-semibold text-emerald-200">
//                             Smallest stock unit
//                             <span className="ml-1.5 text-[10px] font-normal text-slate-500">
//                               optional · for pharmacy / packaged goods
//                             </span>
//                           </p>
//                           {!fields.baseUnitName?.trim() && (
//                             <p className="mt-0.5 text-[10px] text-slate-500">
//                               Set this if you sell the same product in multiple
//                               pack sizes.
//                             </p>
//                           )}
//                         </div>
//                         <input
//                           value={fields.baseUnitName || ""}
//                           onChange={(event) => {
//                             const value = event.target.value;
//                             setField("baseUnitName", value);
//                             if (value && variantInputs.length)
//                               updateVariantInput(0, "name", value);
//                             if (!value)
//                               setVariantInputs((current) =>
//                                 current.map((variant) => ({
//                                   ...variant,
//                                   unitFactor: "1",
//                                 })),
//                               );
//                           }}
//                           placeholder="e.g. Tablet"
//                           className="w-32 shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-emerald-500/60"
//                         />
//                       </div>
//                       {fields.baseUnitName?.trim() && (
//                         <p className="border-t border-emerald-500/10 px-4 py-2 text-[10px] leading-4 text-slate-500">
//                           Enter stock in{" "}
//                           <strong className="text-emerald-400">
//                             {fields.baseUnitName}
//                           </strong>
//                           . First option is ×1; set Strip to 10, Box to 30 for
//                           auto-conversion.
//                         </p>
//                       )}
//                     </section>

//                     {/* ─── Variants header ─── */}
//                     <div className="flex items-center justify-between">
//                       <div>
//                         <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
//                           <Layers className="h-4 w-4 text-sky-400" />
//                           Variants & Pricing
//                         </h3>
//                         <p className="mt-0.5 text-[11px] text-slate-500">
//                           {fields.baseUnitName?.trim()
//                             ? "All options share one converted stock balance."
//                             : "Each option has its own price and barcode."}
//                         </p>
//                       </div>
//                       <span className="rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-[10px] font-bold text-slate-400">
//                         {variantInputs.length}{" "}
//                         {variantInputs.length === 1 ? "variant" : "variants"}
//                       </span>
//                     </div>

//                     {/* ─── Variant list (accordion) ─── */}
//                     <div className="space-y-2.5">
//                       {variantInputs.map((v, i) => {
//                         const expanded = expandedVariant === i;
//                         const isBaseUnit =
//                           i === 0 && !!fields.baseUnitName?.trim();
//                         const price = Number(v.price) || 0;
//                         const stock = Number(v.initialStock) || 0;

//                         return (
//                           <article
//                             key={i}
//                             className={`overflow-hidden rounded-xl border transition-all ${
//                               expanded
//                                 ? "border-sky-500/40 bg-slate-950/60 shadow-lg shadow-sky-500/5"
//                                 : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
//                             }`}
//                           >
//                             {/* ── Header ── */}
//                             <div className="flex items-center gap-3 px-3.5 py-3">
//                               <button
//                                 type="button"
//                                 onClick={() =>
//                                   setExpandedVariant(expanded ? null : i)
//                                 }
//                                 className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition"
//                                 style={{
//                                   background: isBaseUnit
//                                     ? "rgba(16,185,129,0.15)"
//                                     : "rgba(56,189,248,0.12)",
//                                   color: isBaseUnit ? "#34d399" : "#38bdf8",
//                                 }}
//                               >
//                                 {i + 1}
//                               </button>

//                               <button
//                                 type="button"
//                                 onClick={() =>
//                                   setExpandedVariant(expanded ? null : i)
//                                 }
//                                 className="min-w-0 flex-1 text-left"
//                               >
//                                 <div className="flex items-center gap-2">
//                                   <span className="truncate text-sm font-semibold text-white">
//                                     {v.name || `Variant ${i + 1}`}
//                                   </span>
//                                   {isBaseUnit && (
//                                     <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
//                                       Base
//                                     </span>
//                                   )}
//                                 </div>
//                                 <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
//                                   {v.sku && (
//                                     <span className="truncate font-mono">
//                                       {v.sku}
//                                     </span>
//                                   )}
//                                   {v.sku && price > 0 && <span>·</span>}
//                                   {price > 0 && (
//                                     <span className="font-semibold text-emerald-400">
//                                       {price.toLocaleString()} MMK
//                                     </span>
//                                   )}
//                                   {dialog === "create" && stock > 0 && (
//                                     <>
//                                       <span>·</span>
//                                       <span className="text-slate-400">
//                                         {stock} qty
//                                       </span>
//                                     </>
//                                   )}
//                                 </div>
//                               </button>

//                               {!expanded &&
//                                 v.costPrice &&
//                                 Number(v.costPrice) > 0 && (
//                                   <span className="hidden shrink-0 rounded-md bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400 sm:inline">
//                                     Cost {Number(v.costPrice).toLocaleString()}
//                                   </span>
//                                 )}

//                               {variantInputs.length > 1 && !isBaseUnit && (
//                                 <button
//                                   type="button"
//                                   aria-label={`Remove variant ${i + 1}`}
//                                   onClick={() => {
//                                     removeVariantInput(i);
//                                     if (expandedVariant === i)
//                                       setExpandedVariant(null);
//                                     else if (
//                                       expandedVariant !== null &&
//                                       expandedVariant > i
//                                     )
//                                       setExpandedVariant(expandedVariant - 1);
//                                   }}
//                                   className="shrink-0 rounded-md p-1.5 text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-400"
//                                 >
//                                   <X className="h-3.5 w-3.5" />
//                                 </button>
//                               )}

//                               <button
//                                 type="button"
//                                 onClick={() =>
//                                   setExpandedVariant(expanded ? null : i)
//                                 }
//                                 aria-label={expanded ? "Collapse" : "Expand"}
//                                 className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
//                               >
//                                 <ChevronRight
//                                   className={`h-4 w-4 transition-transform duration-200 ${
//                                     expanded ? "rotate-90" : ""
//                                   }`}
//                                 />
//                               </button>
//                             </div>

//                             {/* ── Body ── */}
//                             {expanded && (
//                               <div className="border-t border-slate-800/60 bg-slate-950/30 px-4 py-4">
//                                 {/* PRIMARY fields */}
//                                 <div className="grid gap-3.5 sm:grid-cols-2">
//                                   <label className="block text-[11px] font-medium text-slate-400">
//                                     Option name{" "}
//                                     <span className="text-rose-400">*</span>
//                                     <input
//                                       required
//                                       autoFocus
//                                       placeholder="e.g. Box (100s)"
//                                       value={v.name}
//                                       onChange={(e) =>
//                                         updateVariantInput(
//                                           i,
//                                           "name",
//                                           e.target.value,
//                                         )
//                                       }
//                                       className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
//                                     />
//                                   </label>

//                                   {fields.baseUnitName?.trim() && (
//                                     <label className="block text-[11px] font-medium text-slate-400">
//                                       Base units in this option{" "}
//                                       {isBaseUnit && (
//                                         <span className="text-[10px] text-emerald-400">
//                                           (locked · base)
//                                         </span>
//                                       )}
//                                       <input
//                                         type="number"
//                                         min="1"
//                                         step="1"
//                                         disabled={isBaseUnit}
//                                         value={
//                                           isBaseUnit
//                                             ? "1"
//                                             : (v.unitFactor ?? "1")
//                                         }
//                                         onChange={(e) =>
//                                           updateVariantInput(
//                                             i,
//                                             "unitFactor",
//                                             e.target.value,
//                                           )
//                                         }
//                                         className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
//                                       />
//                                       <span className="mt-1 block text-[10px] text-slate-500">
//                                         {isBaseUnit
//                                           ? `1 ${v.name || fields.baseUnitName}`
//                                           : `1 ${v.name || "option"} = ${v.unitFactor || 1} ${fields.baseUnitName}`}
//                                       </span>
//                                     </label>
//                                   )}

//                                   <label className="block text-[11px] font-medium text-slate-400">
//                                     Selling price (MMK){" "}
//                                     <span className="text-rose-400">*</span>
//                                     <div className="relative mt-1.5">
//                                       <input
//                                         required
//                                         type="number"
//                                         min="0"
//                                         step="0.01"
//                                         placeholder="0"
//                                         value={v.price}
//                                         onChange={(e) =>
//                                           updateVariantInput(
//                                             i,
//                                             "price",
//                                             e.target.value,
//                                           )
//                                         }
//                                         className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 pr-12 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
//                                       />
//                                       <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
//                                         MMK
//                                       </span>
//                                     </div>
//                                   </label>

//                                   <label className="block text-[11px] font-medium text-slate-400">
//                                     Cost price
//                                     <span className="ml-1 text-slate-600">
//                                       (optional)
//                                     </span>
//                                     <div className="relative mt-1.5">
//                                       <input
//                                         type="number"
//                                         min="0"
//                                         step="0.01"
//                                         placeholder="0"
//                                         value={v.costPrice ?? ""}
//                                         onChange={(e) =>
//                                           updateVariantInput(
//                                             i,
//                                             "costPrice",
//                                             e.target.value,
//                                           )
//                                         }
//                                         className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 pr-12 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
//                                       />
//                                       <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
//                                         MMK
//                                       </span>
//                                     </div>
//                                   </label>

//                                   {dialog === "create" && (
//                                     <label className="block text-[11px] font-medium text-slate-400 sm:col-span-2">
//                                       Starting stock
//                                       <span className="ml-1 text-slate-600">
//                                         (
//                                         {fields.baseUnitName?.trim()
//                                           ? `in ${v.name || "option"}`
//                                           : "in this option"}
//                                         )
//                                       </span>
//                                       <input
//                                         type="number"
//                                         min="0"
//                                         step="1"
//                                         placeholder="0"
//                                         value={v.initialStock ?? "0"}
//                                         onChange={(e) =>
//                                           updateVariantInput(
//                                             i,
//                                             "initialStock",
//                                             e.target.value,
//                                           )
//                                         }
//                                         className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
//                                       />
//                                     </label>
//                                   )}
//                                 </div>

//                                 {/* SECONDARY fields */}
//                                 <details className="group mt-3.5 border-t border-slate-800/60 pt-3.5">
//                                   <summary className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-medium text-sky-300/80 transition hover:text-sky-300">
//                                     <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
//                                     SKU, barcode & advanced details
//                                   </summary>
//                                   <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
//                                     <label className="block text-[11px] font-medium text-slate-400">
//                                       SKU
//                                       <input
//                                         placeholder="Auto-generated"
//                                         value={v.sku ?? ""}
//                                         onChange={(e) =>
//                                           updateVariantInput(
//                                             i,
//                                             "sku",
//                                             e.target.value,
//                                           )
//                                         }
//                                         className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 outline-none transition focus:border-sky-500"
//                                       />
//                                     </label>
//                                     <label className="block text-[11px] font-medium text-slate-400">
//                                       Barcode
//                                       <input
//                                         placeholder="Auto-generated"
//                                         value={v.barcode ?? ""}
//                                         onChange={(e) =>
//                                           updateVariantInput(
//                                             i,
//                                             "barcode",
//                                             e.target.value,
//                                           )
//                                         }
//                                         className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 outline-none transition focus:border-sky-500"
//                                       />
//                                     </label>

//                                     {[
//                                       {
//                                         key: "wholesalePrice",
//                                         label: "Wholesale price",
//                                         type: "number",
//                                       },
//                                       {
//                                         key: "wholesaleMinQuantity",
//                                         label: "Min. wholesale qty",
//                                         type: "number",
//                                       },
//                                       {
//                                         key: "color",
//                                         label: "Color",
//                                         type: "text",
//                                       },
//                                       {
//                                         key: "size",
//                                         label: "Size",
//                                         type: "text",
//                                       },
//                                       {
//                                         key: "manufacturingDate",
//                                         label: "Mfg date",
//                                         type: "date",
//                                       },
//                                       {
//                                         key: "expiryDate",
//                                         label: "Expiry date",
//                                         type: "date",
//                                       },
//                                       {
//                                         key: "bestBeforeDate",
//                                         label: "Best before",
//                                         type: "date",
//                                       },
//                                     ].map((field) => (
//                                       <label
//                                         key={field.key}
//                                         className="block text-[11px] font-medium text-slate-400"
//                                       >
//                                         {field.label}
//                                         <input
//                                           type={field.type}
//                                           min={
//                                             field.type === "number"
//                                               ? "0"
//                                               : undefined
//                                           }
//                                           step={
//                                             field.key
//                                               .toLowerCase()
//                                               .includes("price")
//                                               ? "0.01"
//                                               : undefined
//                                           }
//                                           value={(v as any)[field.key] ?? ""}
//                                           onChange={(e) =>
//                                             updateVariantInput(
//                                               i,
//                                               field.key,
//                                               e.target.value,
//                                             )
//                                           }
//                                           className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-500"
//                                         />
//                                       </label>
//                                     ))}
//                                   </div>
//                                 </details>
//                               </div>
//                             )}
//                           </article>
//                         );
//                       })}
//                     </div>

//                     {/* ─── Add variant ─── */}
//                     <button
//                       type="button"
//                       onClick={() => {
//                         addVariantInput();
//                         setExpandedVariant(variantInputs.length);
//                       }}
//                       className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600/60 px-4 py-3 text-sm font-semibold text-sky-300/80 transition hover:border-sky-500/60 hover:bg-sky-500/5 hover:text-sky-300"
//                     >
//                       <Plus className="h-4 w-4" />
//                       Add another variant
//                     </button>
//                   </div>
//                 )}

//                 {/* ═══════ STEP 3: Review ═══════ */}
//                 {wizardStep === 3 && (
//                   <div className="space-y-5">
//                     <div>
//                       <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
//                         <Eye className="h-4 w-4 text-sky-400" />
//                         Review before{" "}
//                         {dialog === "edit" ? "saving" : "creating"}
//                       </h3>
//                       <p className="mt-1 text-xs text-slate-500">
//                         Double-check everything looks correct.
//                       </p>
//                     </div>

//                     <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/60">
//                       <div className="border-b border-slate-800/60 bg-slate-800/20 px-4 py-2.5">
//                         <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
//                           Product
//                         </h4>
//                       </div>
//                       <div className="space-y-2 px-4 py-3">
//                         <div className="flex items-center justify-between">
//                           <span className="text-xs text-slate-500">Name</span>
//                           <span className="text-sm font-semibold text-white">
//                             {fields.name || "—"}
//                           </span>
//                         </div>
//                         <div className="flex items-center justify-between">
//                           <span className="text-xs text-slate-500">
//                             Category
//                           </span>
//                           <span className="text-sm text-slate-300">
//                             {props.categories.find(
//                               (c) => c.id === fields.categoryId,
//                             )?.name || "None"}
//                           </span>
//                         </div>
//                         <div className="flex items-center justify-between">
//                           <span className="text-xs text-slate-500">Brand</span>
//                           <span className="text-sm text-slate-300">
//                             {props.brands.find((b) => b.id === fields.brandId)
//                               ?.name || "None"}
//                           </span>
//                         </div>
//                         <div className="flex items-center justify-between">
//                           <span className="text-xs text-slate-500">
//                             Supplier
//                           </span>
//                           <span className="text-sm text-slate-300">
//                             {props.suppliers.find(
//                               (s) => s.id === fields.supplierId,
//                             )?.name || "None"}
//                           </span>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/60">
//                       <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-800/20 px-4 py-2.5">
//                         <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
//                           Variants ({variantInputs.length})
//                         </h4>
//                         <span className="text-xs text-slate-500">
//                           {fields.baseUnitName?.trim()
//                             ? `Opening quantities convert to ${fields.baseUnitName}`
//                             : "Starting stock is set per option"}
//                         </span>
//                       </div>
//                       <div className="divide-y divide-slate-800/40">
//                         {variantInputs.map((v, i) => (
//                           <div
//                             key={i}
//                             className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5"
//                           >
//                             <div>
//                               <p className="text-sm font-medium text-slate-200">
//                                 {v.name || `Variant ${i + 1}`}
//                               </p>
//                               <p className="mt-0.5 font-mono text-[10px] text-slate-500">
//                                 {v.sku}
//                               </p>
//                             </div>
//                             <div className="text-right">
//                               <p className="text-sm font-semibold text-emerald-400">
//                                 {Number(v.price || 0).toLocaleString()} MMK
//                               </p>
//                               {v.costPrice && (
//                                 <p className="text-[10px] text-slate-500">
//                                   Cost: {Number(v.costPrice).toLocaleString()}
//                                 </p>
//                               )}
//                             </div>
//                             <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400">
//                               {v.initialStock || 0} qty
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     </div>

//                     <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
//                       <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
//                       <p className="text-xs leading-relaxed text-emerald-300/80">
//                         {dialog === "edit"
//                           ? "Saving will update the product and all listed variants on the server."
//                           : "This will create the product with all listed variants and assign them to your active store."}
//                       </p>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             ) : (
//               /* ═══════ NON-PRODUCT FORMS (grouped) ═══════ */
//               <div className="space-y-5 px-6 py-5">
//                 {formGroups[section as EntitySection]?.map((group) => {
//                   const GroupIcon = group.icon;
//                   const groupFields = formFields[
//                     section as EntitySection
//                   ].filter((f) => group.fields.includes(f.name));
//                   if (groupFields.length === 0) return null;

//                   return (
//                     <section
//                       key={group.title}
//                       className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
//                     >
//                       <div className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-800/20 px-4 py-2.5">
//                         <GroupIcon className="h-3.5 w-3.5 text-sky-400" />
//                         <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
//                           {group.title}
//                         </h4>
//                       </div>
//                       <div className="grid gap-4 p-4 sm:grid-cols-2">
//                         {groupFields.map((field) => (
//                           <label
//                             key={field.name}
//                             className={`text-xs text-slate-400 ${
//                               field.name === "address" ||
//                               field.name === "description"
//                                 ? "sm:col-span-2"
//                                 : ""
//                             }`}
//                           >
//                             <span className="font-medium">
//                               {field.label}
//                               {dialog === "create" && field.required && (
//                                 <span className="ml-1 text-rose-400">*</span>
//                               )}
//                             </span>
//                             {field.hint && (
//                               <span className="ml-1 text-slate-600">
//                                 ({field.hint})
//                               </span>
//                             )}
//                             {field.type?.startsWith("select:") ? (
//                               <select
//                                 required={dialog === "create" && field.required}
//                                 value={
//                                   fields[field.name] ||
//                                   (field.type.includes("BRONZE")
//                                     ? "BRONZE"
//                                     : "CASHIER")
//                                 }
//                                 onChange={(event) => {
//                                   const value = event.target.value;
//                                   setField(field.name, value);
//                                   if (
//                                     section === "staff" &&
//                                     field.name === "role"
//                                   ) {
//                                     const defaults: Record<string, string[]> = {
//                                       ADMIN: [
//                                         "MANAGE_STAFF",
//                                         "MANAGE_INVENTORY",
//                                         "EDIT_PRICES",
//                                         "VOID_ORDERS",
//                                         "REFUND_ORDERS",
//                                         "VIEW_REPORTS",
//                                         "VIEW_ANALYTICS",
//                                         "MANAGE_PROMOTIONS",
//                                         "VIEW_AUDIT_LOGS",
//                                         "MANAGE_API_KEYS",
//                                         "MANAGE_WEBHOOKS",
//                                       ],
//                                       MANAGER: [
//                                         "VIEW_REPORTS",
//                                         "EDIT_PRICES",
//                                         "VOID_ORDERS",
//                                         "MANAGE_STAFF",
//                                         "MANAGE_INVENTORY",
//                                         "REFUND_ORDERS",
//                                         "MANAGE_PROMOTIONS",
//                                         "VIEW_ANALYTICS",
//                                       ],
//                                       CASHIER: ["VIEW_REPORTS"],
//                                       ACCOUNTANT: [
//                                         "VIEW_REPORTS",
//                                         "VIEW_ANALYTICS",
//                                       ],
//                                     };
//                                     setStaffPermissions(defaults[value] ?? []);
//                                   }
//                                 }}
//                                 className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500"
//                               >
//                                 {field.type
//                                   .split(":")[1]
//                                   .split(",")
//                                   .filter(
//                                     (option) =>
//                                       props.userRole !== "MANAGER" ||
//                                       option === "CASHIER",
//                                   )
//                                   .map((option) => (
//                                     <option key={option}>{option}</option>
//                                   ))}
//                               </select>
//                             ) : (
//                               <input
//                                 required={dialog === "create" && field.required}
//                                 type={field.type || "text"}
//                                 minLength={
//                                   field.name === "password" &&
//                                   dialog === "create"
//                                     ? 6
//                                     : undefined
//                                 }
//                                 value={fields[field.name] || ""}
//                                 onChange={(event) =>
//                                   setField(field.name, event.target.value)
//                                 }
//                                 className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500"
//                               />
//                             )}
//                           </label>
//                         ))}
//                       </div>
//                     </section>
//                   );
//                 })}

//                 {section === "staff" && (
//                   <section className="overflow-hidden rounded-xl border border-sky-500/20 bg-sky-500/5">
//                     <div className="flex items-center gap-2 border-b border-sky-500/20 px-4 py-2.5">
//                       <Check className="h-3.5 w-3.5 text-sky-400" />
//                       <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
//                         Permissions
//                       </h4>
//                     </div>
//                     <div className="p-4">
//                       <p className="mb-3 text-xs leading-5 text-sky-100">
//                         {props.userRole === "MANAGER"
//                           ? `This cashier account will be assigned to ${props.stores.find((store) => store.id === props.storeId)?.name ?? "your active store"}.`
//                           : `New staff will be assigned to ${props.stores.find((store) => store.id === props.storeId)?.name ?? "the active store"}.`}
//                       </p>
//                       <div className="grid grid-cols-2 gap-2">
//                         {[
//                           "MANAGE_STAFF",
//                           "MANAGE_INVENTORY",
//                           "EDIT_PRICES",
//                           "VOID_ORDERS",
//                           "REFUND_ORDERS",
//                           "VIEW_REPORTS",
//                           "VIEW_ANALYTICS",
//                           "MANAGE_PROMOTIONS",
//                           "VIEW_AUDIT_LOGS",
//                           "MANAGE_API_KEYS",
//                           "MANAGE_WEBHOOKS",
//                         ].map((permission) => (
//                           <label
//                             key={permission}
//                             className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-900"
//                           >
//                             <input
//                               type="checkbox"
//                               checked={staffPermissions.includes(permission)}
//                               onChange={(event) =>
//                                 setStaffPermissions((current) =>
//                                   event.target.checked
//                                     ? [...current, permission]
//                                     : current.filter(
//                                         (value) => value !== permission,
//                                       ),
//                                 )
//                               }
//                               className="accent-sky-500"
//                             />
//                             {permission.split("_").join(" ").toLowerCase()}
//                           </label>
//                         ))}
//                       </div>
//                     </div>
//                   </section>
//                 )}
//               </div>
//             )}

//             {error && (
//               <p
//                 role="alert"
//                 className="mx-6 mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
//               >
//                 {error}
//               </p>
//             )}
//             <div className="sticky bottom-0 flex items-center justify-between rounded-b-2xl border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur-sm">
//               {(dialog === "create" || dialog === "edit") &&
//               section === "products" ? (
//                 <>
//                   {wizardStep > 1 ? (
//                     <button
//                       type="button"
//                       onClick={() => {
//                         setWizardStep((s) => s - 1);
//                         setError(null);
//                       }}
//                       className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
//                     >
//                       <ChevronLeft className="h-4 w-4" />
//                       Back
//                     </button>
//                   ) : (
//                     <button
//                       type="button"
//                       onClick={() => setDialog(null)}
//                       className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
//                     >
//                       Cancel
//                     </button>
//                   )}
//                   {wizardStep < 3 ? (
//                     <button
//                       type="button"
//                       onClick={() => {
//                         setError(null);
//                         if (wizardStep === 1 && !fields.name.trim()) {
//                           setError("Product name is required.");
//                           return;
//                         }
//                         if (wizardStep === 2) {
//                           const namedVariants = variantInputs.filter((v) =>
//                             v.name.trim(),
//                           );
//                           if (!namedVariants.length) {
//                             setError("Add at least one named variant.");
//                             return;
//                           }
//                           const missingPrice = namedVariants.some(
//                             (v) => !v.price || Number(v.price) <= 0,
//                           );
//                           if (missingPrice) {
//                             setError(
//                               "Every variant needs a selling price greater than 0.",
//                             );
//                             return;
//                           }
//                         }
//                         setWizardStep((s) => s + 1);
//                       }}
//                       className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition-all hover:bg-sky-400"
//                     >
//                       Next
//                       <ChevronRight className="h-4 w-4" />
//                     </button>
//                   ) : (
//                     <button
//                       disabled={busy}
//                       className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:opacity-50"
//                     >
//                       {busy ? (
//                         "Saving…"
//                       ) : (
//                         <>
//                           <Check className="h-4 w-4" />
//                           {dialog === "edit"
//                             ? "Save changes"
//                             : "Create product"}
//                         </>
//                       )}
//                     </button>
//                   )}
//                 </>
//               ) : (
//                 <>
//                   <button
//                     type="button"
//                     onClick={() => setDialog(null)}
//                     className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     disabled={busy}
//                     className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-sky-400 disabled:opacity-50"
//                   >
//                     {busy
//                       ? "Saving…"
//                       : dialog === "stock"
//                         ? "Save adjustment"
//                         : dialog === "edit"
//                           ? "Save changes"
//                           : `Create ${labels[section as EntitySection]}`}
//                   </button>
//                 </>
//               )}
//             </div>
//           </form>
//         </div>
//       )}
//     </main>
//   );
// }

// // // original code
// // import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
// // import {
// //   Barcode,
// //   Box,
// //   Building2,
// //   Check,
// //   ChevronLeft,
// //   ChevronRight,
// //   ContactRound,
// //   Download,
// //   Eye,
// //   FileSpreadsheet,
// //   Layers,
// //   Package,
// //   PackagePlus,
// //   Plus,
// //   Printer,
// //   RotateCcw,
// //   Store as StoreIcon,
// //   Tags,
// //   Truck,
// //   Users,
// //   X,
// // } from "lucide-react";
// // import QRCode from "qrcode";
// // import { Product } from "../types";
// // import { apiService, resolveMediaUrl } from "../services/api";
// // import { SearchableProductPicker } from "./SearchableProductPicker";
// // import { ChoiceCards } from "./ChoiceCards";

// // type Section =
// //   | "products"
// //   | "stock"
// //   | "stores"
// //   | "staff"
// //   | "brands"
// //   | "categories"
// //   | "suppliers"
// //   | "customers"
// //   | "qr";
// // type EntitySection = Exclude<Section, "stock" | "qr">;
// // type Destination = "inventory" | "sessions" | "settings";
// // type Fields = Record<string, string>;

// // const sections: { id: Section; title: string; icon: typeof PackagePlus }[] = [
// //   { id: "products", title: "Products", icon: Box },
// //   { id: "stock", title: "Stock adjustment", icon: RotateCcw },
// //   { id: "staff", title: "Staff", icon: Users },
// //   { id: "stores", title: "Stores", icon: StoreIcon },
// //   { id: "brands", title: "Brands", icon: Tags },
// //   { id: "categories", title: "Categories", icon: Building2 },
// //   { id: "suppliers", title: "Suppliers", icon: Truck },
// //   { id: "customers", title: "Customers", icon: ContactRound },
// //   { id: "qr", title: "QR & barcode", icon: Barcode },
// // ];

// // interface Props {
// //   products: Product[];
// //   categories: any[];
// //   brands: any[];
// //   suppliers: any[];
// //   customers: any[];
// //   staff: any[];
// //   userRole?: string;
// //   storeId?: string;
// //   stores: {
// //     id: string;
// //     name: string;
// //     code?: string;
// //     address?: string;
// //     phone?: string;
// //     email?: string;
// //     taxNumber?: string;
// //     isActive?: boolean;
// //   }[];
// //   loading: boolean;
// //   onCreateProduct: (payload: Record<string, unknown>) => Promise<unknown>;
// //   onCreateEntity: (
// //     section: EntitySection,
// //     payload: Record<string, unknown>,
// //   ) => Promise<unknown>;
// //   onUpdateEntity: (
// //     section: EntitySection,
// //     id: string,
// //     payload: Record<string, unknown>,
// //   ) => Promise<unknown>;
// //   onAdjustStock: (
// //     productId: string,
// //     variantId: string | undefined,
// //     delta: number,
// //     reason: string,
// //     movementType?: "ADJUSTMENT" | "DAMAGE" | "EXPIRED",
// //   ) => Promise<unknown>;
// //   onAssignBarcode: (productId: string, barcode: string) => Promise<unknown>;
// //   onNavigate: (tab: Destination) => void;
// // }

// // const emptyProduct: Fields = {
// //   name: "",
// //   sku: "",
// //   barcode: "",
// //   categoryId: "",
// //   brandId: "",
// //   supplierId: "",
// //   costPrice: "",
// //   sellingPrice: "",
// //   initialStock: "0",
// //   genericName: "",
// //   activeIngredient: "",
// //   strength: "",
// //   dosageForm: "",
// //   manufacturer: "",
// //   registrationNumber: "",
// //   baseUnitName: "",
// //   imageUrl: "",
// // };
// // const formFields: Record<
// //   EntitySection,
// //   { name: string; label: string; type?: string; required?: boolean }[]
// // > = {
// //   products: [],
// //   stores: [
// //     { name: "name", label: "Store name", required: true },
// //     { name: "code", label: "Store code", required: true },
// //     { name: "address", label: "Address" },
// //     { name: "phone", label: "Phone" },
// //     { name: "email", label: "Email", type: "email" },
// //     { name: "taxNumber", label: "Tax number" },
// //   ],
// //   staff: [
// //     { name: "name", label: "Full name", required: true },
// //     { name: "username", label: "Username", required: true },
// //     { name: "email", label: "Email", type: "email", required: true },
// //     {
// //       name: "password",
// //       label: "Temporary password",
// //       type: "password",
// //       required: true,
// //     },
// //     {
// //       name: "role",
// //       label: "Role",
// //       type: "select:ADMIN,MANAGER,CASHIER,ACCOUNTANT",
// //       required: true,
// //     },
// //   ],
// //   brands: [
// //     { name: "name", label: "Brand name", required: true },
// //     { name: "description", label: "Description" },
// //   ],
// //   categories: [
// //     { name: "name", label: "Category name", required: true },
// //     { name: "description", label: "Description" },
// //   ],
// //   suppliers: [
// //     { name: "name", label: "Supplier name", required: true },
// //     { name: "code", label: "Supplier code" },
// //     { name: "contactName", label: "Contact person" },
// //     { name: "phone", label: "Phone" },
// //     { name: "email", label: "Email", type: "email" },
// //     { name: "address", label: "Address" },
// //     { name: "taxId", label: "Tax ID" },
// //   ],
// //   customers: [
// //     { name: "name", label: "Customer name", required: true },
// //     { name: "code", label: "Customer code" },
// //     { name: "phone", label: "Phone" },
// //     { name: "email", label: "Email", type: "email" },
// //     { name: "address", label: "Address" },
// //     {
// //       name: "tier",
// //       label: "Loyalty tier",
// //       type: "select:BRONZE,SILVER,GOLD,PLATINUM",
// //     },
// //   ],
// // };

// // const listFor = (section: EntitySection, props: Props): any[] =>
// //   ({
// //     products: props.products,
// //     stores: props.stores,
// //     staff: props.staff,
// //     brands: props.brands,
// //     categories: props.categories,
// //     suppliers: props.suppliers,
// //     customers: props.customers,
// //   })[section];
// // const labels: Record<EntitySection, string> = {
// //   products: "Product",
// //   stores: "Store",
// //   staff: "Staff member",
// //   brands: "Brand",
// //   categories: "Category",
// //   suppliers: "Supplier",
// //   customers: "Customer",
// // };
// // const serial = () =>
// //   `KNT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

// // function parseCsv(text: string): string[][] {
// //   const rows: string[][] = [];
// //   let row: string[] = [];
// //   let value = "";
// //   let quoted = false;
// //   for (let i = 0; i < text.length; i++) {
// //     const char = text[i];
// //     if (char === '"') {
// //       if (quoted && text[i + 1] === '"') {
// //         value += '"';
// //         i++;
// //       } else quoted = !quoted;
// //     } else if (char === "," && !quoted) {
// //       row.push(value.trim());
// //       value = "";
// //     } else if ((char === "\n" || char === "\r") && !quoted) {
// //       if (char === "\r" && text[i + 1] === "\n") i++;
// //       row.push(value.trim());
// //       value = "";
// //       if (row.some((cell) => cell !== "")) rows.push(row);
// //       row = [];
// //     } else value += char;
// //   }
// //   if (quoted) throw new Error("The CSV has an unclosed quotation mark.");
// //   row.push(value.trim());
// //   if (row.some((cell) => cell !== "")) rows.push(row);
// //   return rows;
// // }

// // const csvHeaderKey = (value: string) =>
// //   value
// //     .replace(/^\uFEFF/, "")
// //     .trim()
// //     .toLowerCase()
// //     .replace(/[^a-z0-9]/g, "");

// // export function ManageView(props: Props) {
// //   const [section, setSection] = useState<Section>("products");
// //   const [dialog, setDialog] = useState<"create" | "edit" | "stock" | null>(
// //     null,
// //   );
// //   const [wizardStep, setWizardStep] = useState(1);
// //   const [editing, setEditing] = useState<any>(null);
// //   const [fields, setFields] = useState<Fields>({ ...emptyProduct });
// //   const [stockFields, setStockFields] = useState({
// //     productId: "",
// //     variantId: "",
// //     mode: "IN",
// //     movementType: "ADJUSTMENT" as "ADJUSTMENT" | "DAMAGE" | "EXPIRED",
// //     quantity: "",
// //     reason: "",
// //   });
// //   const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
// //   const [search, setSearch] = useState("");
// //   const [selectedQrProduct, setSelectedQrProduct] = useState("");
// //   const [qrData, setQrData] = useState("");
// //   const [busy, setBusy] = useState(false);
// //   const [error, setError] = useState<string | null>(null);
// //   const [notice, setNotice] = useState<string | null>(null);
// //   const [pageSize, setPageSize] = useState<number>(100);
// //   const [currentPage, setCurrentPage] = useState<number>(1);
// //   const selectedProduct =
// //     props.products.find((product) => product.id === selectedQrProduct) ??
// //     props.products[0];
// //   const stockProduct = props.products.find(
// //     (product) => product.id === stockFields.productId,
// //   );
// //   const stockVariant = stockProduct?.variants?.find(
// //     (variant) => variant.id === stockFields.variantId,
// //   );
// //   const currentStock = Number(stockVariant?.stock ?? 0);
// //   const enteredStockDelta =
// //     Number(stockFields.quantity || 0) * (stockFields.mode === "OUT" ? -1 : 1);
// //   const resultingStock = currentStock + enteredStockDelta;
// //   const activeSection =
// //     section === "stock" ? "products" : section === "qr" ? "products" : section;
// //   const rows = listFor(activeSection, props);
// //   const filteredRows = useMemo(
// //     () =>
// //       rows.filter((item: any) =>
// //         `${item.name ?? ""} ${item.sku ?? ""} ${item.code ?? ""} ${item.email ?? ""} ${item.phone ?? ""}`
// //           .toLowerCase()
// //           .includes(search.trim().toLowerCase()),
// //       ),
// //     [rows, search],
// //   );

// //   const totalItems = filteredRows.length;
// //   const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) || 1 : 1;
// //   const activePage = Math.min(currentPage, totalPages);

// //   const paginatedRows = useMemo(() => {
// //     if (pageSize <= 0) return filteredRows;
// //     const start = (activePage - 1) * pageSize;
// //     return filteredRows.slice(start, start + pageSize);
// //   }, [filteredRows, activePage, pageSize]);

// //   const startItem = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
// //   const endItem =
// //     pageSize <= 0 ? totalItems : Math.min(activePage * pageSize, totalItems);

// //   useEffect(() => {
// //     const value = selectedProduct?.barcode || selectedProduct?.sku;
// //     if (!value) {
// //       setQrData("");
// //       return;
// //     }
// //     let disposed = false;
// //     void QRCode.toDataURL(value, {
// //       width: 220,
// //       margin: 1,
// //       errorCorrectionLevel: "M",
// //     })
// //       .then((url) => {
// //         if (!disposed) setQrData(url);
// //       })
// //       .catch(() => setQrData(""));
// //     return () => {
// //       disposed = true;
// //     };
// //   }, [selectedProduct?.id, selectedProduct?.barcode, selectedProduct?.sku]);

// //   const [variantInputs, setVariantInputs] = useState<
// //     {
// //       id?: string;
// //       name: string;
// //       sku: string;
// //       price: string;
// //       costPrice?: string;
// //       barcode?: string;
// //       initialStock?: string;
// //       wholesalePrice?: string;
// //       wholesaleMinQuantity?: string;
// //       color?: string;
// //       size?: string;
// //       manufacturingDate?: string;
// //       expiryDate?: string;
// //       bestBeforeDate?: string;
// //       unitFactor?: string;
// //     }[]
// //   >([]);

// //   const slugifySkuToken = (str: string) =>
// //     str
// //       .trim()
// //       .toUpperCase()
// //       .replace(/[^A-Z0-9]/g, "")
// //       .slice(0, 6);

// //   const generateVariantSku = (productName?: string, variantName?: string) => {
// //     const prodCode = productName ? slugifySkuToken(productName) : "PRD";
// //     const varCode = variantName ? slugifySkuToken(variantName) : "VAR";
// //     const randomSuffix = Math.random().toString(36).slice(2, 5).toUpperCase();
// //     return `${prodCode || "ITEM"}-${varCode || "OPT"}-${randomSuffix}`;
// //   };

// //   const generateVariantBarcode = () =>
// //     `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

// //   const addVariantInput = () => {
// //     setVariantInputs((prev) => [
// //       ...prev,
// //       {
// //         name: "",
// //         sku: generateVariantSku(fields.name, `VAR-${prev.length + 1}`),
// //         price: "",
// //         costPrice: "",
// //         barcode: generateVariantBarcode(),
// //         initialStock: "0",
// //         wholesalePrice: "",
// //         wholesaleMinQuantity: "1",
// //         color: "",
// //         size: "",
// //         manufacturingDate: "",
// //         expiryDate: "",
// //         bestBeforeDate: "",
// //         unitFactor: "1",
// //       },
// //     ]);
// //   };

// //   const removeVariantInput = (index: number) => {
// //     setVariantInputs((prev) => prev.filter((_, i) => i !== index));
// //   };

// //   const setField = (key: string, value: string) => {
// //     setFields((current) => {
// //       const updated = { ...current, [key]: value };
// //       if (key === "name" && dialog === "create") {
// //         setVariantInputs((prev) =>
// //           prev.map((v) => ({
// //             ...v,
// //             sku:
// //               v.sku.startsWith("ITEM-") || v.sku.includes("-")
// //                 ? generateVariantSku(value, v.name || "OPTION")
// //                 : v.sku,
// //           })),
// //         );
// //       }
// //       return updated;
// //     });
// //   };

// //   const updateVariantInput = (index: number, key: string, value: string) => {
// //     setVariantInputs((prev) => {
// //       const next = [...prev];
// //       const currentVal = next[index];
// //       let newSku = currentVal.sku;

// //       if (key === "name" && dialog === "create") {
// //         newSku = generateVariantSku(fields.name, value || `VAR-${index + 1}`);
// //       }

// //       next[index] = {
// //         ...next[index],
// //         [key]: value,
// //         sku: key === "name" ? newSku : key === "sku" ? value : currentVal.sku,
// //       };
// //       return next;
// //     });
// //   };

// //   const openCreate = () => {
// //     setFields({
// //       ...emptyProduct,
// //       name: "",
// //       categoryId: props.categories[0]?.id ?? "",
// //       initialStock: "0",
// //     });
// //     setVariantInputs([
// //       {
// //         name: "Each",
// //         sku: generateVariantSku("ITEM", "EACH"),
// //         price: "",
// //         costPrice: "",
// //         barcode: generateVariantBarcode(),
// //         initialStock: "0",
// //         wholesalePrice: "",
// //         wholesaleMinQuantity: "1",
// //         color: "",
// //         size: "",
// //         manufacturingDate: "",
// //         expiryDate: "",
// //         bestBeforeDate: "",
// //         unitFactor: "1",
// //       },
// //     ]);
// //     setStaffPermissions([]);
// //     setWizardStep(1);
// //     setDialog("create");
// //     setError(null);
// //     setNotice(null);
// //   };
// //   const openEdit = (item: any) => {
// //     setEditing(item);
// //     const values: Fields =
// //       section === "products"
// //         ? {
// //             name: item.name || "",
// //             imageUrl: item.imageUrl || item.image || "",
// //             categoryId: item.categoryId || "",
// //             brandId: item.brandId || "",
// //             supplierId: item.supplierId || "",
// //             costPrice: String(item.costPrice ?? ""),
// //             sellingPrice: String(item.price ?? ""),
// //             genericName: item.genericName || "",
// //             activeIngredient: item.activeIngredient || "",
// //             strength: item.strength || "",
// //             dosageForm: item.dosageForm || "",
// //             manufacturer: item.manufacturer || "",
// //             registrationNumber: item.registrationNumber || "",
// //             baseUnitName: item.baseUnitName || "",
// //           }
// //         : Object.fromEntries(
// //             formFields[section as EntitySection].map(({ name }) => [
// //               name,
// //               name === "password" ? "" : String(item[name] ?? ""),
// //             ]),
// //           );
// //     setFields(values);
// //     if (section === "products" && item.variants?.length) {
// //       setVariantInputs(
// //         [...item.variants]
// //           .sort(
// //             (a: any, b: any) =>
// //               Number(b.id === item.baseUnitVariantId) -
// //               Number(a.id === item.baseUnitVariantId),
// //           )
// //           .map((v: any) => ({
// //             id: v.id,
// //             name: v.name || "",
// //             sku: v.sku || generateVariantSku(),
// //             price: String(v.price ?? ""),
// //             costPrice: String(v.costPrice ?? ""),
// //             barcode: v.barcode || generateVariantBarcode(),
// //             initialStock: String(v.stock ?? 0),
// //             wholesalePrice:
// //               v.wholesalePrice == null ? "" : String(v.wholesalePrice),
// //             wholesaleMinQuantity: String(v.wholesaleMinQuantity ?? 1),
// //             unitFactor: String(v.unitFactor ?? 1),
// //             color: v.color || "",
// //             size: v.size || "",
// //             manufacturingDate: v.manufacturingDate || "",
// //             expiryDate: v.expiryDate || "",
// //             bestBeforeDate: v.bestBeforeDate || "",
// //           })),
// //       );
// //     } else {
// //       setVariantInputs(
// //         section === "products"
// //           ? [
// //               {
// //                 name: "Each",
// //                 sku: generateVariantSku(),
// //                 price: String(item.price ?? 0),
// //                 costPrice: String(item.costPrice ?? 0),
// //                 barcode: generateVariantBarcode(),
// //                 initialStock: String(item.stock ?? 0),
// //                 wholesalePrice: "",
// //                 wholesaleMinQuantity: "1",
// //                 color: "",
// //                 size: "",
// //                 manufacturingDate: "",
// //                 expiryDate: "",
// //                 bestBeforeDate: "",
// //                 unitFactor: "1",
// //               },
// //             ]
// //           : [],
// //       );
// //     }
// //     setStaffPermissions(item.permissions ?? []);
// //     setWizardStep(1);
// //     setDialog("edit");
// //     setError(null);
// //     setNotice(null);
// //   };
// //   const openStock = (productId = "") => {
// //     if (!props.storeId) {
// //       setError("Select a store before adjusting stock.");
// //       return;
// //     }
// //     setStockFields({
// //       productId,
// //       variantId: "",
// //       mode: "IN",
// //       movementType: "ADJUSTMENT",
// //       quantity: "",
// //       reason: "",
// //     });
// //     setDialog("stock");
// //     setError(null);
// //     setNotice(null);
// //   };
// //   const submit = async (event: FormEvent) => {
// //     event.preventDefault();
// //     setBusy(true);
// //     setError(null);
// //     try {
// //       if (dialog === "stock") {
// //         const quantity = Number(stockFields.quantity);
// //         if (
// //           !stockFields.productId ||
// //           !stockFields.variantId ||
// //           !Number.isInteger(quantity) ||
// //           quantity < 1 ||
// //           !stockFields.reason.trim()
// //         )
// //           throw new Error(
// //             "Choose a product option, enter a positive whole quantity, and add a reason.",
// //           );
// //         if (resultingStock < 0)
// //           throw new Error(
// //             "You cannot remove more stock than this option currently has.",
// //           );
// //         await props.onAdjustStock(
// //           stockFields.productId,
// //           stockFields.variantId || undefined,
// //           stockFields.mode === "IN" ? quantity : -quantity,
// //           stockFields.reason.trim(),
// //           stockFields.mode === "OUT" ? stockFields.movementType : "ADJUSTMENT",
// //         );
// //         setNotice("Stock adjustment saved to the server.");
// //       } else if (dialog === "edit") {
// //         if (!editing?.id) throw new Error("Select a record to edit.");
// //         const payload: Record<string, unknown> = {};
// //         if (section === "products") {
// //           payload.name = fields.name.trim();
// //           payload.imageUrl = fields.imageUrl || undefined;
// //           for (const key of ["sku", "barcode"] as const)
// //             if (fields[key]?.trim()) payload[key] = fields[key].trim();
// //           if (fields.costPrice !== "")
// //             payload.costPrice = Number(fields.costPrice);
// //           if (fields.categoryId) payload.categoryId = fields.categoryId;
// //           if (fields.brandId) payload.brandId = fields.brandId;
// //           if (fields.supplierId) payload.supplierId = fields.supplierId;
// //           // Medicine / Pharmacy fields
// //           payload.genericName = fields.genericName?.trim() || undefined;
// //           payload.activeIngredient =
// //             fields.activeIngredient?.trim() || undefined;
// //           payload.strength = fields.strength?.trim() || undefined;
// //           payload.dosageForm = fields.dosageForm?.trim() || undefined;
// //           payload.manufacturer = fields.manufacturer?.trim() || undefined;
// //           payload.registrationNumber =
// //             fields.registrationNumber?.trim() || undefined;
// //           payload.baseUnitName = fields.baseUnitName?.trim() || "";
// //           payload.baseUnitVariantId = fields.baseUnitName?.trim()
// //             ? editing.baseUnitVariantId
// //             : undefined;
// //           if (variantInputs.length > 0) {
// //             payload.sellingPrice = Number(variantInputs[0].price) || 0;
// //             payload.costPrice = Number(variantInputs[0].costPrice) || 0;
// //             payload.variants = variantInputs.map((v) => ({
// //               id: v.id,
// //               name: v.name.trim(),
// //               sku: v.sku.trim() || undefined,
// //               price: Number(v.price) || Number(fields.sellingPrice) || 0,
// //               costPrice: v.costPrice ? Number(v.costPrice) : undefined,
// //               barcode: v.barcode?.trim() || undefined,
// //               wholesalePrice: v.wholesalePrice
// //                 ? Number(v.wholesalePrice)
// //                 : undefined,
// //               wholesaleMinQuantity: Math.max(
// //                 1,
// //                 Number(v.wholesaleMinQuantity) || 1,
// //               ),
// //               unitFactor: Math.max(1, Math.floor(Number(v.unitFactor) || 1)),
// //               color: v.color?.trim() || undefined,
// //               size: v.size?.trim() || undefined,
// //               manufacturingDate: v.manufacturingDate || undefined,
// //               expiryDate: v.expiryDate || undefined,
// //               bestBeforeDate: v.bestBeforeDate || undefined,
// //             }));
// //           }
// //         } else {
// //           for (const field of formFields[section as EntitySection]) {
// //             const value = fields[field.name]?.trim();
// //             if (value && field.name !== "password") payload[field.name] = value;
// //           }
// //           if (section === "staff") {
// //             payload.permissions = staffPermissions;
// //             if (fields.password?.trim())
// //               payload.password = fields.password.trim();
// //             if (props.storeId) payload.storeId = props.storeId;
// //           }
// //         }
// //         await props.onUpdateEntity(
// //           section as EntitySection,
// //           editing.id,
// //           payload,
// //         );
// //         setNotice(`${labels[section as EntitySection]} updated successfully.`);
// //       } else if (section === "products") {
// //         if (!props.storeId)
// //           throw new Error("Select a store before creating a product.");
// //         const parsedVariants = variantInputs
// //           .filter((v) => v.name.trim())
// //           .map((v, idx) => ({
// //             name: v.name.trim(),
// //             sku:
// //               v.sku.trim() ||
// //               generateVariantSku(fields.name, v.name.trim() || `VAR${idx + 1}`),
// //             price: Number(v.price) || Number(fields.sellingPrice) || 0,
// //             costPrice: v.costPrice ? Number(v.costPrice) : undefined,
// //             barcode: v.barcode?.trim() || generateVariantBarcode(),
// //             initialStock: Math.max(0, Math.floor(Number(v.initialStock) || 0)),
// //             wholesalePrice: v.wholesalePrice
// //               ? Number(v.wholesalePrice)
// //               : undefined,
// //             wholesaleMinQuantity: Math.max(
// //               1,
// //               Number(v.wholesaleMinQuantity) || 1,
// //             ),
// //             unitFactor: Math.max(1, Math.floor(Number(v.unitFactor) || 1)),
// //             color: v.color?.trim() || undefined,
// //             size: v.size?.trim() || undefined,
// //             manufacturingDate: v.manufacturingDate || undefined,
// //             expiryDate: v.expiryDate || undefined,
// //             bestBeforeDate: v.bestBeforeDate || undefined,
// //           }));

// //         if (!parsedVariants.length)
// //           throw new Error("Add at least one named sellable option.");
// //         const primaryVariant = parsedVariants[0];

// //         await props.onCreateProduct({
// //           name: fields.name.trim(),
// //           imageUrl: fields.imageUrl || undefined,
// //           sku: fields.sku.trim() || undefined,
// //           barcode: fields.barcode.trim() || undefined,
// //           categoryId: fields.categoryId || undefined,
// //           brandId: fields.brandId || undefined,
// //           supplierId: fields.supplierId || undefined,
// //           costPrice: primaryVariant.costPrice || 0,
// //           sellingPrice: primaryVariant.price,
// //           storeId: props.storeId,
// //           variants: parsedVariants.length > 0 ? parsedVariants : undefined,
// //           // Medicine / Pharmacy fields
// //           genericName: fields.genericName?.trim() || undefined,
// //           activeIngredient: fields.activeIngredient?.trim() || undefined,
// //           strength: fields.strength?.trim() || undefined,
// //           dosageForm: fields.dosageForm?.trim() || undefined,
// //           manufacturer: fields.manufacturer?.trim() || undefined,
// //           registrationNumber: fields.registrationNumber?.trim() || undefined,
// //           baseUnitName: fields.baseUnitName?.trim() || undefined,
// //         });
// //         setNotice("Product created with variants and linked to store.");
// //       } else {
// //         const payload: Record<string, unknown> = {};
// //         for (const field of formFields[section as EntitySection]) {
// //           const value = fields[field.name]?.trim();
// //           if (value) payload[field.name] = value;
// //         }
// //         if (section === "staff") {
// //           if (props.userRole === "MANAGER" && !props.storeId) {
// //             throw new Error(
// //               "Your account has no assigned store. Ask an admin to assign one first.",
// //             );
// //           }
// //           payload.permissions = staffPermissions;
// //           payload.isActive = true;
// //           payload.role ||= "CASHIER";
// //           if (props.storeId) payload.storeId = props.storeId;
// //         }
// //         if (section === "customers" && !payload.tier) payload.tier = "BRONZE";
// //         await props.onCreateEntity(section as EntitySection, payload);
// //         setNotice(`${labels[section as EntitySection]} added successfully.`);
// //       }
// //       setDialog(null);
// //     } catch (cause) {
// //       const err = cause as { data?: { message?: string }; message?: string };
// //       setError(
// //         err.data?.message || err.message || "Could not save this change.",
// //       );
// //     } finally {
// //       setBusy(false);
// //     }
// //   };

// //   const printQr = () => {
// //     if (!selectedProduct || !qrData) return;
// //     const popup = window.open("", "kanitt-label", "width=500,height=500");
// //     if (!popup) {
// //       setError(
// //         "The print window was blocked. Allow pop-ups for this app and retry.",
// //       );
// //       return;
// //     }
// //     const title = selectedProduct.name.replace(/[&<>"']/g, "");
// //     const code = (selectedProduct.barcode || selectedProduct.sku).replace(
// //       /[&<>"']/g,
// //       "",
// //     );
// //     popup.document.write(
// //       `<!doctype html><html><head><title>QR label</title><style>body{font:14px Arial;text-align:center;padding:24px}.label{border:1px dashed #999;padding:20px;display:inline-block;max-width:300px}img{width:200px;height:200px}h2{font-size:18px}</style></head><body><article class="label"><h2>${title}</h2><img src="${qrData}"/><p>${code}</p><p>${Number(selectedProduct.price).toLocaleString()} MMK</p></article><script>window.onload=()=>window.print()</script></body></html>`,
// //     );
// //     popup.document.close();
// //   };

// //   const fileInputRef = useRef<HTMLInputElement>(null);

// //   const downloadExcelTemplate = () => {
// //     const headers =
// //       "Product Name,Product SKU,Product Barcode,Category Name,Brand Name,Supplier Name,Generic Name,Active Ingredient,Strength,Dosage Form,Manufacturer,Registration Number,Base Unit,Variant Name,Variant SKU,Variant Barcode,Selling Price,Cost Price,Variant Initial Stock,Base Units per Variant,Wholesale Price,Min Wholesale Qty,Color,Size,Mfg Date,Expiry Date,Best Before Date\n";
// //     const exampleRow1 =
// //       "Sample T-Shirt,TSHIRT-001,,Apparel,Nike,Main Supplier,,,,,,,,Red / M,TS-1001-RED-M,885000100101,7500,5000,25,1,7000,10,Red,M,2026-01-01,,\n";
// //     const exampleRow2 =
// //       "Sample T-Shirt,TSHIRT-001,,Apparel,Nike,Main Supplier,,,,,,,,Blue / L,TS-1001-BLUE-L,885000100102,7800,5100,25,1,7200,10,Blue,L,2026-01-01,,\n";
// //     const exampleRow3 =
// //       "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Tablet,PCM-500-TAB,885000200199,200,100,0,1,180,10,,,,2025-06-01,2028-06-01,\n";
// //     const exampleRow4 =
// //       "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Strip (10s),PCM-500-STRIP,885000200200,1800,900,0,10,1600,10,,,,2025-06-01,2028-06-01,\n";
// //     const exampleRow5 =
// //       "Paracetamol 500mg,PARA-500,,Medicine,,Pharma Supply,Paracetamol,Paracetamol,500mg,Tablet,BPI,REG-12345,Tablet,Box (100s),PCM-500-BOX,885000200201,12000,9000,20,100,11000,5,,,,2025-06-01,2028-06-01,\n";
// //     const blob = new Blob(
// //       [
// //         "\uFEFF",
// //         headers,
// //         exampleRow1,
// //         exampleRow2,
// //         exampleRow3,
// //         exampleRow4,
// //         exampleRow5,
// //       ],
// //       {
// //         type: "text/csv;charset=utf-8;",
// //       },
// //     );
// //     const url = URL.createObjectURL(blob);
// //     const link = document.createElement("a");
// //     link.href = url;
// //     link.setAttribute("download", "Kanitt_Product_Import_Template.csv");
// //     document.body.appendChild(link);
// //     link.click();
// //     document.body.removeChild(link);
// //   };

// //   const handleExcelFileUpload = async (
// //     event: React.ChangeEvent<HTMLInputElement>,
// //   ) => {
// //     const file = event.target.files?.[0];
// //     if (!file) return;
// //     if (!file.name.toLowerCase().endsWith(".csv")) {
// //       setError(
// //         "This importer accepts CSV files only. Save the Excel file as CSV UTF-8, then import that CSV.",
// //       );
// //       if (fileInputRef.current) fileInputRef.current.value = "";
// //       return;
// //     }
// //     if (!props.storeId) {
// //       setError("Please select an active store before importing products.");
// //       if (fileInputRef.current) fileInputRef.current.value = "";
// //       return;
// //     }
// //     setBusy(true);
// //     setError(null);
// //     setNotice("Reading product template...");

// //     try {
// //       const rows = parseCsv(await file.text());
// //       if (rows.length < 2)
// //         throw new Error("The CSV is empty or has no product rows.");
// //       const headers = rows[0].map(csvHeaderKey);
// //       const findColumn = (...names: string[]) =>
// //         headers.findIndex((header) => names.includes(header));
// //       const columns = {
// //         name: findColumn("productname", "name"),
// //         category: findColumn("categoryname", "category"),
// //         brand: findColumn("brandname", "brand"),
// //         supplier: findColumn("suppliername", "supplier"),
// //         genericName: findColumn("genericname", "generic"),
// //         activeIngredient: findColumn("activeingredient", "ingredient"),
// //         strength: findColumn("strength", "dose"),
// //         dosageForm: findColumn("dosageform", "form"),
// //         manufacturer: findColumn("manufacturer", "maker"),
// //         registrationNumber: findColumn(
// //           "registrationnumber",
// //           "registrationid",
// //           "drugregistration",
// //         ),
// //         baseUnit: findColumn("baseunit", "stockbaseunit", "smallestunit"),
// //         productSku: findColumn("productsku", "mastersku"),
// //         productBarcode: findColumn("productbarcode", "masterbarcode"),
// //         variant: findColumn("variantname", "optionname", "variant"),
// //         variantSku: findColumn("variantsku", "optionsku", "sku"),
// //         variantBarcode: findColumn(
// //           "variantbarcode",
// //           "optionbarcode",
// //           "barcode",
// //         ),
// //         price: findColumn("sellingprice", "price", "variantprice"),
// //         cost: findColumn("costprice", "cost"),
// //         stock: findColumn(
// //           "variantinitialstock",
// //           "variantstock",
// //           "initialstock",
// //           "startingstock",
// //           "stock",
// //           "quantity",
// //         ),
// //         unitFactor: findColumn(
// //           "baseunitspervariant",
// //           "unitfactor",
// //           "packconversion",
// //           "conversionfactor",
// //         ),
// //         wholesalePrice: findColumn("wholesaleprice", "wholesalecost"),
// //         wholesaleMinQuantity: findColumn(
// //           "minwholesaleqty",
// //           "wholesaleqty",
// //           "minwholesalequantity",
// //         ),
// //         color: findColumn("color", "colour"),
// //         size: findColumn("size"),
// //         manufacturingDate: findColumn("mfgdate", "manufacturingdate"),
// //         expiryDate: findColumn("expirydate", "expdate"),
// //         bestBeforeDate: findColumn("bestbeforedate", "bestbefore"),
// //       };
// //       if (columns.name < 0 || columns.price < 0) {
// //         throw new Error(
// //           "Template headers are missing. Use the downloaded template with Product Name and Selling Price columns.",
// //         );
// //       }

// //       const products = new Map<
// //         string,
// //         {
// //           name: string;
// //           sku: string;
// //           barcode: string;
// //           categoryName: string;
// //           brandName: string;
// //           supplierName: string;
// //           genericName: string;
// //           activeIngredient: string;
// //           strength: string;
// //           dosageForm: string;
// //           manufacturer: string;
// //           registrationNumber: string;
// //           baseUnitName: string;
// //           variants: Record<string, unknown>[];
// //         }
// //       >();

// //       for (const [index, row] of rows.slice(1).entries()) {
// //         const cell = (column: number) =>
// //           column < 0 ? "" : String(row[column] ?? "").trim();
// //         const name = cell(columns.name);
// //         if (!name)
// //           throw new Error(`Row ${index + 2}: Product Name is required.`);
// //         const variantName = cell(columns.variant) || "Each";
// //         const productSku = cell(columns.productSku);
// //         const productBarcode = cell(columns.productBarcode);
// //         const priceText = cell(columns.price).replace(/,/g, "");
// //         const costText = cell(columns.cost).replace(/,/g, "");
// //         const stockText = cell(columns.stock).replace(/,/g, "");
// //         const price = Number(priceText);
// //         const costPrice = costText ? Number(costText) : 0;
// //         const initialStock = stockText ? Number(stockText) : 0;
// //         const baseUnitName = cell(columns.baseUnit);
// //         const unitFactorText = cell(columns.unitFactor).replace(/,/g, "");
// //         const unitFactor = unitFactorText ? Number(unitFactorText) : 1;

// //         if (!priceText || !Number.isFinite(price) || price < 0)
// //           throw new Error(
// //             `Row ${index + 2}: Selling Price must be a valid non-negative number.`,
// //           );
// //         if (!Number.isFinite(costPrice) || costPrice < 0)
// //           throw new Error(
// //             `Row ${index + 2}: Cost Price must be a valid non-negative number.`,
// //           );
// //         if (!Number.isInteger(initialStock) || initialStock < 0)
// //           throw new Error(
// //             `Row ${index + 2}: Initial Stock must be a non-negative whole number.`,
// //           );
// //         if (!Number.isInteger(unitFactor) || unitFactor < 1)
// //           throw new Error(
// //             `Row ${index + 2}: Base Units per Variant must be a positive whole number.`,
// //           );
// //         if (!baseUnitName && unitFactor !== 1)
// //           throw new Error(
// //             `Row ${index + 2}: Set a Base Unit before using a pack conversion.`,
// //           );

// //         const categoryName = cell(columns.category);
// //         const brandName = cell(columns.brand);
// //         const supplierName = cell(columns.supplier);
// //         const medicine = {
// //           genericName: cell(columns.genericName),
// //           activeIngredient: cell(columns.activeIngredient),
// //           strength: cell(columns.strength),
// //           dosageForm: cell(columns.dosageForm),
// //           manufacturer: cell(columns.manufacturer),
// //           registrationNumber: cell(columns.registrationNumber),
// //         };

// //         const wholesalePriceText = cell(columns.wholesalePrice).replace(
// //           /,/g,
// //           "",
// //         );
// //         const wholesaleMinQtyText = cell(columns.wholesaleMinQuantity).replace(
// //           /,/g,
// //           "",
// //         );

// //         const variantObj: Record<string, unknown> = {
// //           name: variantName,
// //           sku:
// //             cell(columns.variantSku) || generateVariantSku(name, variantName),
// //           barcode: cell(columns.variantBarcode) || generateVariantBarcode(),
// //           price,
// //           costPrice,
// //           initialStock,
// //           unitFactor,
// //           wholesalePrice: wholesalePriceText
// //             ? Number(wholesalePriceText)
// //             : undefined,
// //           wholesaleMinQuantity: wholesaleMinQtyText
// //             ? Number(wholesaleMinQtyText)
// //             : undefined,
// //           color: cell(columns.color) || undefined,
// //           size: cell(columns.size) || undefined,
// //           manufacturingDate: cell(columns.manufacturingDate) || undefined,
// //           expiryDate: cell(columns.expiryDate) || undefined,
// //           bestBeforeDate: cell(columns.bestBeforeDate) || undefined,
// //         };

// //         const key = (productSku || name).toLocaleLowerCase();
// //         const product = products.get(key) ?? {
// //           name,
// //           sku: productSku,
// //           barcode: productBarcode,
// //           categoryName,
// //           brandName,
// //           supplierName,
// //           ...medicine,
// //           baseUnitName,
// //           variants: [],
// //         };

// //         if (product.name.toLocaleLowerCase() !== name.toLocaleLowerCase()) {
// //           throw new Error(
// //             `Rows for product SKU "${productSku}" use different product names.`,
// //           );
// //         }

// //         if (
// //           product.categoryName &&
// //           categoryName &&
// //           product.categoryName.toLocaleLowerCase() !==
// //             categoryName.toLocaleLowerCase()
// //         ) {
// //           throw new Error(
// //             `Rows for "${name}" use different categories. Keep one category per product.`,
// //           );
// //         }
// //         if (!product.categoryName) product.categoryName = categoryName;
// //         if (
// //           product.sku &&
// //           productSku &&
// //           product.sku.toLowerCase() !== productSku.toLowerCase()
// //         ) {
// //           throw new Error(`Rows for "${name}" use different product SKUs.`);
// //         }
// //         if (
// //           product.barcode &&
// //           productBarcode &&
// //           product.barcode !== productBarcode
// //         ) {
// //           throw new Error(`Rows for "${name}" use different product barcodes.`);
// //         }
// //         if (!product.brandName) product.brandName = brandName;
// //         if (!product.supplierName) product.supplierName = supplierName;
// //         if (
// //           product.baseUnitName &&
// //           baseUnitName &&
// //           product.baseUnitName.toLocaleLowerCase() !==
// //             baseUnitName.toLocaleLowerCase()
// //         ) {
// //           throw new Error(`Rows for "${name}" use different Base Units.`);
// //         }
// //         if (!product.baseUnitName) product.baseUnitName = baseUnitName;

// //         product.variants.push(variantObj);
// //         products.set(key, product);
// //       }

// //       let successCount = 0;
// //       let importedOptionCount = 0;
// //       const failures: string[] = [];

// //       for (const product of products.values()) {
// //         const category = product.categoryName
// //           ? props.categories.find(
// //               (item: any) =>
// //                 String(item.name).trim().toLocaleLowerCase() ===
// //                 product.categoryName.toLocaleLowerCase(),
// //             )
// //           : undefined;
// //         const brand = product.brandName
// //           ? props.brands.find(
// //               (item: any) =>
// //                 String(item.name).trim().toLocaleLowerCase() ===
// //                 product.brandName.toLocaleLowerCase(),
// //             )
// //           : undefined;
// //         const supplier = product.supplierName
// //           ? props.suppliers.find(
// //               (item: any) =>
// //                 String(item.name).trim().toLocaleLowerCase() ===
// //                 product.supplierName.toLocaleLowerCase(),
// //             )
// //           : undefined;

// //         if (product.categoryName && !category) {
// //           failures.push(
// //             `${product.name}: category "${product.categoryName}" was not found`,
// //           );
// //           continue;
// //         }

// //         const primaryVariant = product.variants[0] as any;
// //         if (
// //           product.baseUnitName &&
// //           Number(primaryVariant.unitFactor ?? 1) !== 1
// //         ) {
// //           failures.push(
// //             `${product.name}: put the base-unit option (conversion 1) on the first row for this product`,
// //           );
// //           continue;
// //         }

// //         try {
// //           await props.onCreateProduct({
// //             name: product.name,
// //             sku: product.sku || serial(),
// //             barcode: product.barcode || undefined,
// //             categoryId: category?.id,
// //             brandId: brand?.id,
// //             supplierId: supplier?.id,
// //             storeId: props.storeId,
// //             sellingPrice: primaryVariant.price,
// //             costPrice: primaryVariant.costPrice,
// //             genericName: product.genericName || undefined,
// //             activeIngredient: product.activeIngredient || undefined,
// //             strength: product.strength || undefined,
// //             dosageForm: product.dosageForm || undefined,
// //             manufacturer: product.manufacturer || undefined,
// //             registrationNumber: product.registrationNumber || undefined,
// //             baseUnitName: product.baseUnitName || undefined,
// //             variants: product.variants,
// //           });
// //           successCount++;
// //           importedOptionCount += product.variants.length;
// //         } catch (cause) {
// //           const error = cause as {
// //             data?: { message?: string };
// //             message?: string;
// //           };
// //           failures.push(
// //             `${product.name}: ${error.data?.message || error.message || "could not be imported"}`,
// //           );
// //         }
// //       }

// //       setNotice(
// //         `Imported ${successCount} product${successCount === 1 ? "" : "s"} with ${importedOptionCount} sellable option${importedOptionCount === 1 ? "" : "s"}.`,
// //       );
// //       if (failures.length)
// //         setError(
// //           `Could not import ${failures.length} product${failures.length === 1 ? "" : "s"}: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "; see the file and try again" : ""}`,
// //         );
// //     } catch (err: any) {
// //       setError(err.message || "Failed to process import file.");
// //     } finally {
// //       setBusy(false);
// //       if (fileInputRef.current) fileInputRef.current.value = "";
// //     }
// //   };

// //   return (
// //     <main className="flex-1 overflow-y-auto p-7">
// //       <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
// //         <div>
// //           <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
// //             Workspace tools
// //           </p>
// //           <h1 className="mt-2 text-3xl font-black text-white">Manage</h1>
// //           <p className="mt-1 text-sm text-slate-400">
// //             Catalog, stock, people and customer records for{" "}
// //             {props.stores.find((store) => store.id === props.storeId)?.name ??
// //               "your workspace"}
// //             .
// //           </p>
// //         </div>
// //         <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
// //           {props.loading ? "Refreshing data…" : "Live server data"}
// //         </span>
// //       </header>

// //       <nav className="mb-5 flex flex-wrap gap-2">
// //         {sections
// //           .filter(
// //             ({ id }) =>
// //               id !== "stores" ||
// //               props.userRole === "ADMIN" ||
// //               props.userRole === "SUPER_ADMIN",
// //           )
// //           .map(({ id, title, icon: Icon }) => (
// //             <button
// //               key={id}
// //               onClick={() => {
// //                 setSection(id);
// //                 setSearch("");
// //                 setNotice(null);
// //                 setError(null);
// //               }}
// //               className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${section === id ? "border-sky-400/50 bg-sky-400/10 text-sky-200" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"}`}
// //             >
// //               <Icon className="h-4 w-4" />
// //               {title}
// //             </button>
// //           ))}
// //       </nav>

// //       {error && !dialog && (
// //         <p
// //           role="alert"
// //           className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
// //         >
// //           {error}
// //         </p>
// //       )}
// //       {notice && !dialog && (
// //         <p
// //           role="status"
// //           className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
// //         >
// //           {notice}
// //         </p>
// //       )}

// //       {section === "stock" ? (
// //         <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
// //           <h2 className="text-lg font-bold text-white">Adjust store stock</h2>
// //           <p className="mb-5 mt-1 text-sm text-slate-400">
// //             Search by product name, SKU or barcode. Updates apply to{" "}
// //             {props.stores.find((store) => store.id === props.storeId)?.name ||
// //               "the selected store"}{" "}
// //             and are recorded in the stock movement history.
// //           </p>
// //           <button
// //             onClick={() => openStock()}
// //             className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400"
// //           >
// //             <Plus className="h-4 w-4" />
// //             New adjustment
// //           </button>
// //           <p className="mt-4 text-xs text-slate-500">
// //             Requires an ADMIN or MANAGER account with inventory permission.
// //           </p>
// //         </section>
// //       ) : section === "qr" ? (
// //         <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
// //           <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
// //             <div className="flex items-center gap-3 border-b border-slate-800 p-4">
// //               <input
// //                 value={search}
// //                 onChange={(event) => setSearch(event.target.value)}
// //                 placeholder="Find product by name, SKU or code"
// //                 className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //               />
// //             </div>
// //             <div className="max-h-[65vh] overflow-y-auto">
// //               {filteredRows.map((product: Product) => (
// //                 <button
// //                   key={product.id}
// //                   onClick={() => setSelectedQrProduct(product.id)}
// //                   className={`flex w-full items-center justify-between border-b border-slate-800/70 px-4 py-3 text-left ${selectedQrProduct === product.id ? "bg-sky-500/10" : "hover:bg-slate-800/40"}`}
// //                 >
// //                   <span>
// //                     <span className="block text-sm font-semibold text-slate-100">
// //                       {product.name}
// //                     </span>
// //                     <span className="mt-1 block font-mono text-xs text-slate-500">
// //                       {product.barcode || product.sku}
// //                     </span>
// //                   </span>
// //                   <Barcode className="h-4 w-4 text-sky-300" />
// //                 </button>
// //               ))}
// //             </div>
// //           </div>
// //           <aside className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center">
// //             <h2 className="font-bold text-white">QR label preview</h2>
// //             {selectedProduct && qrData ? (
// //               <>
// //                 <img
// //                   src={qrData}
// //                   alt={`QR for ${selectedProduct.name}`}
// //                   className="mt-4 h-52 w-52 rounded-xl bg-white p-2"
// //                 />
// //                 <p className="mt-3 text-sm font-semibold text-slate-200">
// //                   {selectedProduct.name}
// //                 </p>
// //                 <p className="mt-1 font-mono text-xs text-slate-500">
// //                   {selectedProduct.barcode || selectedProduct.sku}
// //                 </p>
// //                 <div className="mt-4 flex w-full gap-2">
// //                   <button
// //                     onClick={async () => {
// //                       if (!selectedProduct.barcode) {
// //                         const value = serial();
// //                         try {
// //                           await props.onAssignBarcode(
// //                             selectedProduct.id,
// //                             value,
// //                           );
// //                           setNotice(`QR/barcode ${value} assigned.`);
// //                         } catch (cause) {
// //                           const err = cause as {
// //                             data?: { message?: string };
// //                             message?: string;
// //                           };
// //                           setError(
// //                             err.data?.message ||
// //                               err.message ||
// //                               "Could not assign barcode.",
// //                           );
// //                           return;
// //                         }
// //                       }
// //                     }}
// //                     className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
// //                   >
// //                     {selectedProduct.barcode ? "Code assigned" : "Assign code"}
// //                   </button>
// //                   <button
// //                     onClick={printQr}
// //                     className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-sky-400"
// //                   >
// //                     <Printer className="h-3.5 w-3.5" />
// //                     Print
// //                   </button>
// //                 </div>
// //               </>
// //             ) : (
// //               <p className="mt-10 text-sm text-slate-500">
// //                 Select a product with a SKU to preview its QR code.
// //               </p>
// //             )}
// //           </aside>
// //         </section>
// //       ) : (
// //         <>
// //           <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
// //             <div className="flex flex-1 items-center gap-3 min-w-[280px]">
// //               <input
// //                 value={search}
// //                 onChange={(event) => {
// //                   setSearch(event.target.value);
// //                   setCurrentPage(1);
// //                 }}
// //                 placeholder={`Search ${section}...`}
// //                 className="min-w-64 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-500"
// //               />
// //             </div>

// //             <div className="flex flex-wrap items-center gap-3">
// //               <label className="text-xs text-slate-400 flex items-center gap-2">
// //                 Per page:
// //                 <select
// //                   value={pageSize}
// //                   onChange={(e) => {
// //                     setPageSize(Number(e.target.value));
// //                     setCurrentPage(1);
// //                   }}
// //                   className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-sky-500"
// //                 >
// //                   <option value={50}>50</option>
// //                   <option value={100}>100</option>
// //                   <option value={250}>250</option>
// //                   <option value={500}>500</option>
// //                   <option value={0}>All ({totalItems})</option>
// //                 </select>
// //               </label>

// //               {section === "products" && (
// //                 <>
// //                   <button
// //                     onClick={downloadExcelTemplate}
// //                     className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
// //                     title="Download UTF-8 CSV product template"
// //                   >
// //                     <Download className="h-4 w-4 text-emerald-400" />
// //                     Template
// //                   </button>
// //                   <input
// //                     type="file"
// //                     ref={fileInputRef}
// //                     accept=".csv,text/csv"
// //                     onChange={handleExcelFileUpload}
// //                     className="hidden"
// //                   />
// //                   <button
// //                     onClick={() => fileInputRef.current?.click()}
// //                     disabled={busy}
// //                     className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
// //                     title="Import products from a CSV file"
// //                   >
// //                     <FileSpreadsheet className="h-4 w-4" />
// //                     Import CSV
// //                   </button>
// //                   <button
// //                     onClick={() => openStock()}
// //                     className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-900"
// //                   >
// //                     <RotateCcw className="h-4 w-4" />
// //                     Adjust stock
// //                   </button>
// //                 </>
// //               )}
// //               <button
// //                 onClick={openCreate}
// //                 className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400"
// //               >
// //                 <Plus className="h-4 w-4" />
// //                 Add {labels[section as EntitySection]}
// //               </button>
// //             </div>
// //           </section>

// //           <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
// //             <div className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] gap-4 border-b border-slate-800 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
// //               <span>Name</span>
// //               <span>
// //                 {section === "products"
// //                   ? "SKU / barcode"
// //                   : section === "stores"
// //                     ? "Store code"
// //                     : section === "staff"
// //                       ? "Role"
// //                       : "Contact"}
// //               </span>
// //               <span>
// //                 {section === "products"
// //                   ? "Price"
// //                   : section === "stores"
// //                     ? "Status"
// //                     : "Code / status"}
// //               </span>
// //               <span>
// //                 {section === "stores" ? "Address / phone" : "Details"}
// //               </span>
// //             </div>
// //             {paginatedRows.map((item: any) => (
// //               <div
// //                 key={item.id}
// //                 className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-slate-800/70 px-5 py-3.5 last:border-0"
// //               >
// //                 <div className="flex min-w-0 items-center gap-3">
// //                   {section === "products" &&
// //                     (item.imageUrl || item.image ? (
// //                       <img
// //                         src={resolveMediaUrl(item.imageUrl || item.image)}
// //                         alt=""
// //                         loading="lazy"
// //                         className="h-10 w-10 shrink-0 rounded-lg bg-slate-800 object-cover"
// //                       />
// //                     ) : (
// //                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
// //                         <Package className="h-4 w-4" />
// //                       </div>
// //                     ))}
// //                   <div className="min-w-0">
// //                     <span className="truncate block text-sm font-semibold text-slate-100">
// //                       {item.name}
// //                     </span>
// //                     {section === "products" &&
// //                       (item.genericName ||
// //                         item.activeIngredient ||
// //                         item.strength ||
// //                         item.dosageForm) && (
// //                         <span className="block truncate text-[11px] font-medium text-emerald-400/90 mt-0.5">
// //                           {[
// //                             item.genericName,
// //                             item.activeIngredient,
// //                             item.strength,
// //                             item.dosageForm,
// //                           ]
// //                             .filter(Boolean)
// //                             .join(" · ")}
// //                         </span>
// //                       )}
// //                   </div>
// //                 </div>
// //                 <span className="truncate font-mono text-xs text-slate-400">
// //                   {section === "products"
// //                     ? `${item.sku || "—"} · ${item.barcode || "—"}`
// //                     : section === "stores"
// //                       ? item.code || "—"
// //                       : section === "staff"
// //                         ? item.role
// //                         : item.email || item.phone || item.contactName || "—"}
// //                 </span>
// //                 <span className="truncate text-xs text-slate-400">
// //                   {section === "products"
// //                     ? `${Number(item.price).toLocaleString()} MMK · ${item.variants?.length ?? 0} options`
// //                     : section === "stores"
// //                       ? item.isActive === false
// //                         ? "Inactive"
// //                         : "Active"
// //                       : item.code ||
// //                         (item.isActive === false ? "Inactive" : "Active")}
// //                 </span>
// //                 <span className="text-xs text-slate-500">
// //                   {section === "stores"
// //                     ? item.address || item.phone || "—"
// //                     : (item._count?.products ?? item.storeName ?? "—")}
// //                 </span>
// //                 <button
// //                   onClick={() => openEdit(item)}
// //                   className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:border-sky-400/40 hover:text-white"
// //                 >
// //                   Edit
// //                 </button>
// //               </div>
// //             ))}
// //             {!filteredRows.length && (
// //               <p className="p-10 text-center text-sm text-slate-400">
// //                 {props.loading ? "Loading…" : `No ${section} found.`}
// //               </p>
// //             )}
// //           </section>

// //           {totalItems > 0 && (
// //             <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
// //               <p className="text-xs text-slate-400">
// //                 Showing{" "}
// //                 <strong className="text-white">
// //                   {startItem.toLocaleString()}
// //                 </strong>{" "}
// //                 to{" "}
// //                 <strong className="text-white">
// //                   {endItem.toLocaleString()}
// //                 </strong>{" "}
// //                 of{" "}
// //                 <strong className="text-white">
// //                   {totalItems.toLocaleString()}
// //                 </strong>{" "}
// //                 {section}
// //               </p>

// //               {pageSize > 0 && totalPages > 1 && (
// //                 <div className="flex items-center gap-2">
// //                   <button
// //                     onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
// //                     disabled={activePage <= 1}
// //                     className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
// //                   >
// //                     <ChevronLeft className="h-3.5 w-3.5" /> Previous
// //                   </button>
// //                   <span className="text-xs text-slate-400 px-2">
// //                     Page <strong className="text-white">{activePage}</strong> of{" "}
// //                     {totalPages}
// //                   </span>
// //                   <button
// //                     onClick={() =>
// //                       setCurrentPage((p) => Math.min(totalPages, p + 1))
// //                     }
// //                     disabled={activePage >= totalPages}
// //                     className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 disabled:opacity-40 transition-colors"
// //                   >
// //                     Next <ChevronRight className="h-3.5 w-3.5" />
// //                   </button>
// //                 </div>
// //               )}
// //             </div>
// //           )}
// //         </>
// //       )}

// //       <section className="mt-6 flex flex-wrap gap-2 text-xs">
// //         {(
// //           [
// //             ["Inventory view", "inventory"],
// //             ["Register sessions", "sessions"],
// //             ["Workspace settings", "settings"],
// //           ] as const
// //         ).map(([title, tab]) => (
// //           <button
// //             key={tab}
// //             onClick={() => props.onNavigate(tab)}
// //             className="rounded-lg border border-slate-800 px-3 py-2 text-slate-400 hover:text-slate-200"
// //           >
// //             {title} →
// //           </button>
// //         ))}
// //       </section>

// //       {dialog && (
// //         <div
// //           className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
// //           onClick={(e) => {
// //             if (e.target === e.currentTarget) setDialog(null);
// //           }}
// //         >
// //           <form
// //             onSubmit={submit}
// //             className={`max-h-[96dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-all duration-300 sm:max-h-[92dvh] sm:rounded-2xl ${(dialog === "create" || dialog === "edit") && section === "products" ? "max-w-6xl" : dialog === "stock" ? "max-w-3xl" : "max-w-4xl"}`}
// //             style={{ padding: 0 }}
// //           >
// //             {/* ——— Wizard Header for product dialogs ——— */}
// //             {(dialog === "create" || dialog === "edit") &&
// //             section === "products" ? (
// //               <div className="sticky top-0 z-10 rounded-t-2xl border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-6 pt-5 pb-4">
// //                 <div className="flex items-center justify-between mb-4">
// //                   <div>
// //                     <h2 className="text-xl font-bold text-white">
// //                       {dialog === "edit" ? "Edit product" : "New product"}
// //                     </h2>
// //                     <p className="mt-0.5 text-xs text-slate-500">
// //                       Saved directly to the selected tenant.
// //                     </p>
// //                   </div>
// //                   <button
// //                     type="button"
// //                     onClick={() => setDialog(null)}
// //                     className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
// //                   >
// //                     <X className="h-5 w-5" />
// //                   </button>
// //                 </div>
// //                 {/* Step indicator */}
// //                 <div className="flex items-center gap-1">
// //                   {[
// //                     { step: 1, label: "Product Info", icon: Package },
// //                     { step: 2, label: "Variants & Pricing", icon: Layers },
// //                     { step: 3, label: "Review", icon: Eye },
// //                   ].map(({ step, label, icon: StepIcon }, idx) => (
// //                     <div key={step} className="flex items-center flex-1">
// //                       <button
// //                         type="button"
// //                         onClick={() => {
// //                           if (
// //                             step < wizardStep ||
// //                             (step === 2 && fields.name.trim())
// //                           )
// //                             setWizardStep(step);
// //                         }}
// //                         className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 w-full ${
// //                           wizardStep === step
// //                             ? "bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.08)]"
// //                             : wizardStep > step
// //                               ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/15"
// //                               : "bg-slate-800/50 text-slate-500 border border-slate-800 cursor-default"
// //                         }`}
// //                       >
// //                         <span
// //                           className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
// //                             wizardStep === step
// //                               ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
// //                               : wizardStep > step
// //                                 ? "bg-emerald-500 text-white"
// //                                 : "bg-slate-700 text-slate-400"
// //                           }`}
// //                         >
// //                           {wizardStep > step ? (
// //                             <Check className="h-3.5 w-3.5" />
// //                           ) : (
// //                             step
// //                           )}
// //                         </span>
// //                         <span className="hidden sm:inline truncate">
// //                           {label}
// //                         </span>
// //                         <StepIcon
// //                           className={`h-3.5 w-3.5 sm:hidden flex-shrink-0 ${wizardStep === step ? "text-sky-400" : wizardStep > step ? "text-emerald-400" : "text-slate-600"}`}
// //                         />
// //                       </button>
// //                       {idx < 2 && (
// //                         <div
// //                           className={`hidden sm:block mx-1 h-px flex-shrink-0 w-4 transition-colors ${wizardStep > step ? "bg-emerald-500/40" : "bg-slate-700"}`}
// //                         />
// //                       )}
// //                     </div>
// //                   ))}
// //                 </div>
// //               </div>
// //             ) : (
// //               <div className="px-6 pt-6">
// //                 <div className="mb-5 flex items-center justify-between">
// //                   <div>
// //                     <h2 className="text-xl font-bold text-white">
// //                       {dialog === "stock"
// //                         ? "Stock adjustment"
// //                         : dialog === "edit"
// //                           ? `Edit ${labels[section as EntitySection]}`
// //                           : `Add ${labels[section as EntitySection]}`}
// //                     </h2>
// //                     <p className="mt-1 text-xs text-slate-400">
// //                       Saved directly to the selected tenant.
// //                     </p>
// //                   </div>
// //                   <button
// //                     type="button"
// //                     onClick={() => setDialog(null)}
// //                     className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
// //                   >
// //                     <X className="h-5 w-5" />
// //                   </button>
// //                 </div>
// //               </div>
// //             )}

// //             {dialog === "stock" ? (
// //               <div className="space-y-4 px-6 py-5">
// //                 <SearchableProductPicker
// //                   products={props.products}
// //                   value={stockFields.productId}
// //                   placeholder="Search name, SKU or barcode…"
// //                   onChange={(productId) => {
// //                     const product = props.products.find(
// //                       (item) => item.id === productId,
// //                     );
// //                     setStockFields((current) => ({
// //                       ...current,
// //                       productId,
// //                       variantId:
// //                         product?.variants?.length === 1
// //                           ? product.variants[0].id
// //                           : "",
// //                     }));
// //                   }}
// //                 />
// //                 {!!props.products.find(
// //                   (product) => product.id === stockFields.productId,
// //                 )?.variants?.length && (
// //                   <ChoiceCards
// //                     label="Choose product option"
// //                     value={stockFields.variantId}
// //                     onChange={(variantId) =>
// //                       setStockFields((current) => ({ ...current, variantId }))
// //                     }
// //                     options={(
// //                       props.products.find(
// //                         (product) => product.id === stockFields.productId,
// //                       )?.variants ?? []
// //                     ).map((variant) => ({
// //                       value: variant.id,
// //                       label: variant.name,
// //                       description: `${Number(variant.stock ?? 0).toLocaleString()} units on hand in this store`,
// //                       badge: variant.sku,
// //                     }))}
// //                   />
// //                 )}
// //                 {stockVariant && (
// //                   <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
// //                     <p className="text-[11px] text-slate-400">
// //                       This store · {stockVariant.name}
// //                     </p>
// //                     <div className="mt-1 flex items-center justify-between">
// //                       <span className="text-sm font-semibold text-slate-200">
// //                         On hand
// //                       </span>
// //                       <span className="text-sm font-bold text-white">
// //                         {currentStock} <span className="text-slate-500">→</span>{" "}
// //                         <span
// //                           className={
// //                             resultingStock < 0
// //                               ? "text-rose-300"
// //                               : "text-sky-300"
// //                           }
// //                         >
// //                           {resultingStock}
// //                         </span>
// //                       </span>
// //                     </div>
// //                   </div>
// //                 )}
// //                 <div className="space-y-3">
// //                   <ChoiceCards
// //                     label="Adjustment"
// //                     value={stockFields.mode}
// //                     onChange={(mode) =>
// //                       setStockFields((current) => ({ ...current, mode }))
// //                     }
// //                     options={[
// //                       {
// //                         value: "IN",
// //                         label: "Add stock",
// //                         description:
// //                           "Physical count is higher than the system.",
// //                       },
// //                       {
// //                         value: "OUT",
// //                         label: "Remove stock",
// //                         description: "Damage, expiry, or a count correction.",
// //                       },
// //                     ]}
// //                   />
// //                   <label className="block text-xs text-slate-400">
// //                     Units
// //                     <input
// //                       type="number"
// //                       min="1"
// //                       step="1"
// //                       required
// //                       value={stockFields.quantity}
// //                       onChange={(event) =>
// //                         setStockFields((current) => ({
// //                           ...current,
// //                           quantity: event.target.value,
// //                         }))
// //                       }
// //                       className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
// //                     />
// //                   </label>
// //                 </div>
// //                 <label className="block text-xs text-slate-400">
// //                   Why is stock changing?
// //                   <input
// //                     required
// //                     minLength={3}
// //                     value={stockFields.reason}
// //                     onChange={(event) =>
// //                       setStockFields((current) => ({
// //                         ...current,
// //                         reason: event.target.value,
// //                       }))
// //                     }
// //                     placeholder="e.g. Count correction or damaged units"
// //                     className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
// //                   />
// //                 </label>
// //                 <p className="text-[11px] leading-relaxed text-slate-500">
// //                   Use a purchase order to receive supplier deliveries. This form
// //                   is for stock corrections and losses.
// //                 </p>
// //                 {stockFields.mode === "OUT" && (
// //                   <div>
// //                     <ChoiceCards
// //                       label="Reason type"
// //                       value={stockFields.movementType}
// //                       onChange={(movementType) =>
// //                         setStockFields((current) => ({
// //                           ...current,
// //                           movementType: movementType as
// //                             | "ADJUSTMENT"
// //                             | "DAMAGE"
// //                             | "EXPIRED",
// //                         }))
// //                       }
// //                       options={[
// //                         { value: "ADJUSTMENT", label: "Count correction" },
// //                         { value: "DAMAGE", label: "Damaged" },
// //                         { value: "EXPIRED", label: "Expired" },
// //                       ]}
// //                     />
// //                   </div>
// //                 )}
// //               </div>
// //             ) : section === "products" ? (
// //               <div className="px-6 py-5">
// //                 {/* ═══════ STEP 1: Product Info ═══════ */}
// //                 {wizardStep === 1 && (
// //                   <div className="space-y-5 animate-in">
// //                     <div>
// //                       <h3 className="text-sm font-semibold text-white flex items-center gap-2">
// //                         <Package className="h-4 w-4 text-sky-400" />
// //                         Product details
// //                       </h3>
// //                       <p className="mt-1 text-xs text-slate-500">
// //                         Basic information about this product. Pricing comes
// //                         next.
// //                       </p>
// //                     </div>
// //                     <div className="space-y-4">
// //                       <label className="block text-xs font-medium text-slate-400">
// //                         Product name <span className="text-rose-400">*</span>
// //                         <input
// //                           required
// //                           autoFocus
// //                           placeholder="e.g. Classic White T-Shirt"
// //                           value={fields.name}
// //                           onChange={(e) => setField("name", e.target.value)}
// //                           className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 outline-none transition-all"
// //                         />
// //                       </label>
// //                       <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
// //                         <label className="block text-xs font-semibold text-slate-300">
// //                           Product photo{" "}
// //                           <span className="font-normal text-slate-500">
// //                             (JPG, PNG or WebP · up to 5 MB)
// //                           </span>
// //                           <input
// //                             type="file"
// //                             accept="image/jpeg,image/png,image/webp"
// //                             className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
// //                             onChange={async (event) => {
// //                               const input = event.currentTarget;
// //                               const file = event.currentTarget.files?.[0];
// //                               if (!file || !props.storeId) return;
// //                               setBusy(true);
// //                               setError(null);
// //                               try {
// //                                 const imageUrl =
// //                                   await apiService.uploadProductImage(
// //                                     file,
// //                                     props.storeId,
// //                                     editing?.id,
// //                                   );
// //                                 setField("imageUrl", imageUrl);
// //                               } catch (cause) {
// //                                 setError(
// //                                   cause instanceof Error
// //                                     ? cause.message
// //                                     : "Image upload failed.",
// //                                 );
// //                               } finally {
// //                                 setBusy(false);
// //                                 input.value = "";
// //                               }
// //                             }}
// //                           />
// //                         </label>
// //                         {fields.imageUrl && (
// //                           <div className="mt-3 flex items-center gap-3">
// //                             <img
// //                               src={resolveMediaUrl(fields.imageUrl)}
// //                               alt="Product preview"
// //                               className="h-16 w-16 rounded-lg bg-slate-800 object-cover"
// //                             />
// //                             <button
// //                               type="button"
// //                               onClick={() => setField("imageUrl", "")}
// //                               className="text-xs text-rose-300 hover:text-rose-200"
// //                             >
// //                               Remove photo
// //                             </button>
// //                           </div>
// //                         )}
// //                       </div>
// //                       <div className="grid gap-4 sm:grid-cols-2">
// //                         <label className="block text-xs font-medium text-slate-400">
// //                           Category{" "}
// //                           <span className="text-slate-600">(optional)</span>
// //                           <select
// //                             value={fields.categoryId}
// //                             onChange={(e) =>
// //                               setField("categoryId", e.target.value)
// //                             }
// //                             className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-sky-500 outline-none transition-all"
// //                           >
// //                             <option value="">No category</option>
// //                             {props.categories.map((c) => (
// //                               <option key={c.id} value={c.id}>
// //                                 {c.name}
// //                               </option>
// //                             ))}
// //                           </select>
// //                         </label>
// //                         <label className="block text-xs font-medium text-slate-400">
// //                           Brand{" "}
// //                           <span className="text-slate-600">(optional)</span>
// //                           <select
// //                             value={fields.brandId}
// //                             onChange={(e) =>
// //                               setField("brandId", e.target.value)
// //                             }
// //                             className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-sky-500 outline-none transition-all"
// //                           >
// //                             <option value="">No brand</option>
// //                             {props.brands.map((b) => (
// //                               <option key={b.id} value={b.id}>
// //                                 {b.name}
// //                               </option>
// //                             ))}
// //                           </select>
// //                         </label>
// //                       </div>
// //                       <label className="block text-xs font-medium text-slate-400">
// //                         Supplier{" "}
// //                         <span className="text-slate-600">(optional)</span>
// //                         <select
// //                           value={fields.supplierId}
// //                           onChange={(e) =>
// //                             setField("supplierId", e.target.value)
// //                           }
// //                           className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-sky-500 outline-none transition-all"
// //                         >
// //                           <option value="">No supplier</option>
// //                           {props.suppliers.map((s) => (
// //                             <option key={s.id} value={s.id}>
// //                               {s.name}
// //                             </option>
// //                           ))}
// //                         </select>
// //                       </label>
// //                     </div>

// //                     {/* ── Medicine / Pharmacy Details ── */}
// //                     <details className="group rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
// //                       <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold text-emerald-400 select-none hover:bg-emerald-500/10 transition-colors">
// //                         <svg
// //                           className="h-4 w-4 transition-transform group-open:rotate-90"
// //                           fill="none"
// //                           stroke="currentColor"
// //                           viewBox="0 0 24 24"
// //                         >
// //                           <path
// //                             strokeLinecap="round"
// //                             strokeLinejoin="round"
// //                             strokeWidth={2}
// //                             d="M9 5l7 7-7 7"
// //                           />
// //                         </svg>
// //                         Medicine / Pharmacy Details
// //                         <span className="text-[10px] text-slate-500 font-normal ml-1">
// //                           (optional — expand for drug catalog fields)
// //                         </span>
// //                       </summary>
// //                       <div className="space-y-4 px-4 pb-4 pt-2 border-t border-emerald-500/10">
// //                         <div className="grid gap-4 sm:grid-cols-2">
// //                           <label className="block text-xs font-medium text-slate-400">
// //                             Generic Name
// //                             <input
// //                               placeholder="e.g. Paracetamol"
// //                               value={fields.genericName}
// //                               onChange={(e) =>
// //                                 setField("genericName", e.target.value)
// //                               }
// //                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
// //                             />
// //                           </label>
// //                           <label className="block text-xs font-medium text-slate-400">
// //                             Active Ingredient
// //                             <input
// //                               placeholder="e.g. Paracetamol"
// //                               value={fields.activeIngredient}
// //                               onChange={(e) =>
// //                                 setField("activeIngredient", e.target.value)
// //                               }
// //                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
// //                             />
// //                           </label>
// //                         </div>
// //                         <div className="grid gap-4 sm:grid-cols-3">
// //                           <label className="block text-xs font-medium text-slate-400">
// //                             Strength
// //                             <input
// //                               placeholder="e.g. 500mg"
// //                               value={fields.strength}
// //                               onChange={(e) =>
// //                                 setField("strength", e.target.value)
// //                               }
// //                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
// //                             />
// //                           </label>
// //                           <label className="block text-xs font-medium text-slate-400">
// //                             Dosage Form
// //                             <input
// //                               placeholder="e.g. Tablet, Syrup"
// //                               value={fields.dosageForm}
// //                               onChange={(e) =>
// //                                 setField("dosageForm", e.target.value)
// //                               }
// //                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
// //                             />
// //                           </label>
// //                           <label className="block text-xs font-medium text-slate-400">
// //                             Registration No.
// //                             <input
// //                               placeholder="e.g. REG-12345"
// //                               value={fields.registrationNumber}
// //                               onChange={(e) =>
// //                                 setField("registrationNumber", e.target.value)
// //                               }
// //                               className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
// //                             />
// //                           </label>
// //                         </div>
// //                         <label className="block text-xs font-medium text-slate-400">
// //                           Manufacturer
// //                           <input
// //                             placeholder="e.g. BPI, GPO"
// //                             value={fields.manufacturer}
// //                             onChange={(e) =>
// //                               setField("manufacturer", e.target.value)
// //                             }
// //                             className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all"
// //                           />
// //                         </label>
// //                       </div>
// //                     </details>

// //                     {/* Tip card */}
// //                     <div className="flex items-start gap-3 rounded-xl border border-sky-500/15 bg-sky-500/5 px-4 py-3">
// //                       <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-400" />
// //                       <p className="text-xs text-sky-300/80 leading-relaxed">
// //                         In the next step, you'll add sellable options (variants)
// //                         with individual pricing, SKU, and stock quantities.
// //                       </p>
// //                     </div>
// //                   </div>
// //                 )}

// //                 {/* ═══════ STEP 2: Variants & Pricing ═══════ */}
// //                 {wizardStep === 2 && (
// //                   <div className="space-y-4 animate-in">
// //                     <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
// //                       <label className="block text-xs font-semibold text-emerald-200">
// //                         Smallest stock unit{" "}
// //                         <span className="font-normal text-slate-400">
// //                           (optional, for pharmacy / packaged goods)
// //                         </span>
// //                         <input
// //                           value={fields.baseUnitName || ""}
// //                           onChange={(event) => {
// //                             const value = event.target.value;
// //                             setField("baseUnitName", value);
// //                             if (value && variantInputs.length)
// //                               updateVariantInput(0, "name", value);
// //                             if (!value)
// //                               setVariantInputs((current) =>
// //                                 current.map((variant) => ({
// //                                   ...variant,
// //                                   unitFactor: "1",
// //                                 })),
// //                               );
// //                           }}
// //                           placeholder="e.g. Tablet, Capsule, ml"
// //                           className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
// //                         />
// //                         <span className="mt-2 block font-normal leading-relaxed text-slate-400">
// //                           Enter stock in the smallest unit. The first option is
// //                           this unit (×1); set Strip to 10 and Box to 30 to
// //                           convert purchases and POS stock automatically.
// //                         </span>
// //                       </label>
// //                     </section>
// //                     <div className="flex items-center justify-between">
// //                       <div>
// //                         <h3 className="text-sm font-semibold text-white flex items-center gap-2">
// //                           <Layers className="h-4 w-4 text-sky-400" />
// //                           Variants & Pricing
// //                         </h3>
// //                         <p className="mt-1 text-xs text-slate-500">
// //                           Each option has its own barcode and price. With a
// //                           smallest unit set, all options share one converted
// //                           stock balance.
// //                         </p>
// //                       </div>
// //                       <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-400">
// //                         {variantInputs.length}{" "}
// //                         {variantInputs.length === 1 ? "variant" : "variants"}
// //                       </span>
// //                     </div>
// //                     <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
// //                       {variantInputs.map((v, i) => (
// //                         <article
// //                           key={i}
// //                           className="group rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-950 to-slate-900 transition-all hover:border-slate-600"
// //                         >
// //                           {/* Variant header */}
// //                           <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-2.5">
// //                             <div className="flex items-center gap-2.5">
// //                               <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/10 text-[10px] font-bold text-sky-400">
// //                                 {i + 1}
// //                               </span>
// //                               <span className="text-xs font-semibold text-slate-200">
// //                                 {v.name || `Variant ${i + 1}`}
// //                               </span>
// //                               {v.sku && (
// //                                 <span className="hidden sm:inline rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
// //                                   {v.sku}
// //                                 </span>
// //                               )}
// //                             </div>
// //                             {variantInputs.length > 1 &&
// //                               !(fields.baseUnitName?.trim() && i === 0) && (
// //                                 <button
// //                                   type="button"
// //                                   aria-label={`Remove option ${i + 1}`}
// //                                   onClick={() => removeVariantInput(i)}
// //                                   className="rounded-md p-1.5 text-slate-600 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 transition-all"
// //                                 >
// //                                   <X className="h-3.5 w-3.5" />
// //                                 </button>
// //                               )}
// //                           </div>
// //                           {/* Variant body */}
// //                           <div className="p-4">
// //                             <div className="grid gap-3 sm:grid-cols-2">
// //                               {fields.baseUnitName?.trim() && (
// //                                 <label className="text-xs font-medium text-slate-400">
// //                                   Base units in this option
// //                                   <input
// //                                     type="number"
// //                                     min="1"
// //                                     step="1"
// //                                     disabled={i === 0}
// //                                     value={
// //                                       i === 0 ? "1" : (v.unitFactor ?? "1")
// //                                     }
// //                                     onChange={(e) =>
// //                                       updateVariantInput(
// //                                         i,
// //                                         "unitFactor",
// //                                         e.target.value,
// //                                       )
// //                                     }
// //                                     className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white disabled:opacity-60 focus:border-emerald-500 outline-none"
// //                                   />
// //                                   <span className="mt-1 block text-[10px] text-slate-500">
// //                                     {i === 0
// //                                       ? `1 ${v.name || fields.baseUnitName}`
// //                                       : `1 ${v.name || "option"} = ${v.unitFactor || 1} ${fields.baseUnitName}`}
// //                                   </span>
// //                                 </label>
// //                               )}
// //                               <label className="text-xs font-medium text-slate-400">
// //                                 Option name{" "}
// //                                 <span className="text-rose-400">*</span>
// //                                 <input
// //                                   required
// //                                   placeholder="e.g. Red / M, 500ml, Each"
// //                                   value={v.name}
// //                                   onChange={(e) =>
// //                                     updateVariantInput(
// //                                       i,
// //                                       "name",
// //                                       e.target.value,
// //                                     )
// //                                   }
// //                                   className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 outline-none transition-all"
// //                                 />
// //                               </label>
// //                               <label className="text-xs font-medium text-slate-400">
// //                                 Selling price (MMK){" "}
// //                                 <span className="text-rose-400">*</span>
// //                                 <input
// //                                   required
// //                                   type="number"
// //                                   min="0"
// //                                   step="0.01"
// //                                   placeholder="0"
// //                                   value={v.price}
// //                                   onChange={(e) =>
// //                                     updateVariantInput(
// //                                       i,
// //                                       "price",
// //                                       e.target.value,
// //                                     )
// //                                   }
// //                                   className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 outline-none transition-all"
// //                                 />
// //                               </label>
// //                               <label className="text-xs font-medium text-slate-400">
// //                                 SKU{" "}
// //                                 <span className="text-slate-600">
// //                                   (auto-generated)
// //                                 </span>
// //                                 <input
// //                                   placeholder="Auto-generated"
// //                                   value={v.sku ?? ""}
// //                                   onChange={(e) =>
// //                                     updateVariantInput(i, "sku", e.target.value)
// //                                   }
// //                                   className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:border-sky-500 outline-none transition-all"
// //                                 />
// //                               </label>
// //                               <label className="text-xs font-medium text-slate-400">
// //                                 Barcode{" "}
// //                                 <span className="text-slate-600">
// //                                   (auto-generated)
// //                                 </span>
// //                                 <input
// //                                   placeholder="Auto-generated"
// //                                   value={v.barcode ?? ""}
// //                                   onChange={(e) =>
// //                                     updateVariantInput(
// //                                       i,
// //                                       "barcode",
// //                                       e.target.value,
// //                                     )
// //                                   }
// //                                   className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:border-sky-500 outline-none transition-all"
// //                                 />
// //                               </label>
// //                               <label className="text-xs font-medium text-slate-400">
// //                                 Cost price{" "}
// //                                 <span className="text-slate-600">
// //                                   (optional)
// //                                 </span>
// //                                 <input
// //                                   type="number"
// //                                   min="0"
// //                                   step="0.01"
// //                                   placeholder="0"
// //                                   value={v.costPrice ?? ""}
// //                                   onChange={(e) =>
// //                                     updateVariantInput(
// //                                       i,
// //                                       "costPrice",
// //                                       e.target.value,
// //                                     )
// //                                   }
// //                                   className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 outline-none transition-all"
// //                                 />
// //                               </label>
// //                               {dialog === "create" && (
// //                                 <label className="text-xs font-medium text-slate-400">
// //                                   Starting stock (
// //                                   {fields.baseUnitName?.trim()
// //                                     ? v.name || "option"
// //                                     : "option quantity"}
// //                                   )
// //                                   <input
// //                                     type="number"
// //                                     min="0"
// //                                     step="1"
// //                                     placeholder="0"
// //                                     value={v.initialStock ?? "0"}
// //                                     onChange={(e) =>
// //                                       updateVariantInput(
// //                                         i,
// //                                         "initialStock",
// //                                         e.target.value,
// //                                       )
// //                                     }
// //                                     className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 outline-none transition-all"
// //                                   />
// //                                 </label>
// //                               )}
// //                             </div>
// //                             {/* Expandable advanced fields */}
// //                             <details className="mt-3 border-t border-slate-800/50 pt-3">
// //                               <summary className="cursor-pointer select-none text-xs font-medium text-sky-300/70 hover:text-sky-300 transition-colors">
// //                                 Advanced details{" "}
// //                                 <span className="font-normal text-slate-600">
// //                                   (wholesale, color, size, dates)
// //                                 </span>
// //                               </summary>
// //                               <div className="mt-3 grid gap-3 sm:grid-cols-2">
// //                                 {[
// //                                   {
// //                                     key: "wholesalePrice",
// //                                     label: "Wholesale price",
// //                                     type: "number",
// //                                   },
// //                                   {
// //                                     key: "wholesaleMinQuantity",
// //                                     label: "Min. wholesale qty",
// //                                     type: "number",
// //                                   },
// //                                   {
// //                                     key: "color",
// //                                     label: "Color",
// //                                     type: "text",
// //                                   },
// //                                   { key: "size", label: "Size", type: "text" },
// //                                   {
// //                                     key: "manufacturingDate",
// //                                     label: "Mfg date",
// //                                     type: "date",
// //                                   },
// //                                   {
// //                                     key: "expiryDate",
// //                                     label: "Expiry date",
// //                                     type: "date",
// //                                   },
// //                                   {
// //                                     key: "bestBeforeDate",
// //                                     label: "Best before",
// //                                     type: "date",
// //                                   },
// //                                 ].map((field) => (
// //                                   <label
// //                                     key={field.key}
// //                                     className="text-xs font-medium text-slate-400"
// //                                   >
// //                                     {field.label}
// //                                     <input
// //                                       type={field.type}
// //                                       min={
// //                                         field.type === "number"
// //                                           ? "0"
// //                                           : undefined
// //                                       }
// //                                       step={
// //                                         field.key
// //                                           .toLowerCase()
// //                                           .includes("price")
// //                                           ? "0.01"
// //                                           : undefined
// //                                       }
// //                                       value={(v as any)[field.key] ?? ""}
// //                                       onChange={(e) =>
// //                                         updateVariantInput(
// //                                           i,
// //                                           field.key,
// //                                           e.target.value,
// //                                         )
// //                                       }
// //                                       className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-white focus:border-sky-500 outline-none transition-all"
// //                                     />
// //                                   </label>
// //                                 ))}
// //                               </div>
// //                             </details>
// //                           </div>
// //                         </article>
// //                       ))}
// //                     </div>
// //                     <button
// //                       type="button"
// //                       onClick={addVariantInput}
// //                       className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600/80 px-4 py-3 text-sm font-semibold text-sky-300/80 hover:border-sky-500 hover:bg-sky-500/5 hover:text-sky-300 transition-all"
// //                     >
// //                       <Plus className="h-4 w-4" />
// //                       Add another variant
// //                     </button>
// //                   </div>
// //                 )}

// //                 {/* ═══════ STEP 3: Review & Confirm ═══════ */}
// //                 {wizardStep === 3 && (
// //                   <div className="space-y-5 animate-in">
// //                     <div>
// //                       <h3 className="text-sm font-semibold text-white flex items-center gap-2">
// //                         <Eye className="h-4 w-4 text-sky-400" />
// //                         Review before{" "}
// //                         {dialog === "edit" ? "saving" : "creating"}
// //                       </h3>
// //                       <p className="mt-1 text-xs text-slate-500">
// //                         Double-check everything looks correct.
// //                       </p>
// //                     </div>

// //                     {/* Product summary card */}
// //                     <div className="rounded-xl border border-slate-700/60 bg-slate-950/60 overflow-hidden">
// //                       <div className="border-b border-slate-800/60 bg-slate-800/20 px-4 py-2.5">
// //                         <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
// //                           Product
// //                         </h4>
// //                       </div>
// //                       <div className="px-4 py-3 space-y-2">
// //                         <div className="flex items-center justify-between">
// //                           <span className="text-xs text-slate-500">Name</span>
// //                           <span className="text-sm font-semibold text-white">
// //                             {fields.name || "—"}
// //                           </span>
// //                         </div>
// //                         <div className="flex items-center justify-between">
// //                           <span className="text-xs text-slate-500">
// //                             Category
// //                           </span>
// //                           <span className="text-sm text-slate-300">
// //                             {props.categories.find(
// //                               (c) => c.id === fields.categoryId,
// //                             )?.name || "None"}
// //                           </span>
// //                         </div>
// //                         <div className="flex items-center justify-between">
// //                           <span className="text-xs text-slate-500">Brand</span>
// //                           <span className="text-sm text-slate-300">
// //                             {props.brands.find((b) => b.id === fields.brandId)
// //                               ?.name || "None"}
// //                           </span>
// //                         </div>
// //                         <div className="flex items-center justify-between">
// //                           <span className="text-xs text-slate-500">
// //                             Supplier
// //                           </span>
// //                           <span className="text-sm text-slate-300">
// //                             {props.suppliers.find(
// //                               (s) => s.id === fields.supplierId,
// //                             )?.name || "None"}
// //                           </span>
// //                         </div>
// //                       </div>
// //                     </div>

// //                     {/* Variants summary table */}
// //                     <div className="rounded-xl border border-slate-700/60 bg-slate-950/60 overflow-hidden">
// //                       <div className="border-b border-slate-800/60 bg-slate-800/20 px-4 py-2.5 flex items-center justify-between">
// //                         <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
// //                           Variants ({variantInputs.length})
// //                         </h4>
// //                         <span className="text-xs text-slate-500">
// //                           {fields.baseUnitName?.trim()
// //                             ? `Opening quantities convert to ${fields.baseUnitName}`
// //                             : "Starting stock is set per option"}
// //                         </span>
// //                       </div>
// //                       <div className="divide-y divide-slate-800/40">
// //                         {variantInputs.map((v, i) => (
// //                           <div
// //                             key={i}
// //                             className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5"
// //                           >
// //                             <div>
// //                               <p className="text-sm font-medium text-slate-200">
// //                                 {v.name || `Variant ${i + 1}`}
// //                               </p>
// //                               <p className="mt-0.5 font-mono text-[10px] text-slate-500">
// //                                 {v.sku}
// //                               </p>
// //                             </div>
// //                             <div className="text-right">
// //                               <p className="text-sm font-semibold text-emerald-400">
// //                                 {Number(v.price || 0).toLocaleString()} MMK
// //                               </p>
// //                               {v.costPrice && (
// //                                 <p className="text-[10px] text-slate-500">
// //                                   Cost: {Number(v.costPrice).toLocaleString()}
// //                                 </p>
// //                               )}
// //                             </div>
// //                             <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400">
// //                               {v.initialStock || 0} qty
// //                             </span>
// //                           </div>
// //                         ))}
// //                       </div>
// //                     </div>

// //                     {/* Confirmation notice */}
// //                     <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
// //                       <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
// //                       <p className="text-xs text-emerald-300/80 leading-relaxed">
// //                         {dialog === "edit"
// //                           ? "Saving will update the product and all listed variants on the server."
// //                           : "This will create the product with all listed variants and assign them to your active store."}
// //                       </p>
// //                     </div>
// //                   </div>
// //                 )}
// //               </div>
// //             ) : (
// //               <div className="grid gap-3 sm:grid-cols-2 px-6 py-5">
// //                 {formFields[section as EntitySection].map((field) => (
// //                   <label key={field.name} className="text-xs text-slate-400">
// //                     {field.label}
// //                     {field.type?.startsWith("select:") ? (
// //                       <select
// //                         required={dialog === "create" && field.required}
// //                         value={
// //                           fields[field.name] ||
// //                           (field.type.includes("BRONZE") ? "BRONZE" : "CASHIER")
// //                         }
// //                         onChange={(event) => {
// //                           const value = event.target.value;
// //                           setField(field.name, value);
// //                           if (section === "staff" && field.name === "role") {
// //                             const defaults: Record<string, string[]> = {
// //                               ADMIN: [
// //                                 "MANAGE_STAFF",
// //                                 "MANAGE_INVENTORY",
// //                                 "EDIT_PRICES",
// //                                 "VOID_ORDERS",
// //                                 "REFUND_ORDERS",
// //                                 "VIEW_REPORTS",
// //                                 "VIEW_ANALYTICS",
// //                                 "MANAGE_PROMOTIONS",
// //                                 "VIEW_AUDIT_LOGS",
// //                                 "MANAGE_API_KEYS",
// //                                 "MANAGE_WEBHOOKS",
// //                               ],
// //                               MANAGER: [
// //                                 "VIEW_REPORTS",
// //                                 "EDIT_PRICES",
// //                                 "VOID_ORDERS",
// //                                 "MANAGE_STAFF",
// //                                 "MANAGE_INVENTORY",
// //                                 "REFUND_ORDERS",
// //                                 "MANAGE_PROMOTIONS",
// //                                 "VIEW_ANALYTICS",
// //                               ],
// //                               CASHIER: ["VIEW_REPORTS"],
// //                               ACCOUNTANT: ["VIEW_REPORTS", "VIEW_ANALYTICS"],
// //                             };
// //                             setStaffPermissions(defaults[value] ?? []);
// //                           }
// //                         }}
// //                         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
// //                       >
// //                         {field.type
// //                           .split(":")[1]
// //                           .split(",")
// //                           .filter(
// //                             (option) =>
// //                               props.userRole !== "MANAGER" ||
// //                               option === "CASHIER",
// //                           )
// //                           .map((option) => (
// //                             <option key={option}>{option}</option>
// //                           ))}
// //                       </select>
// //                     ) : (
// //                       <input
// //                         required={dialog === "create" && field.required}
// //                         type={field.type || "text"}
// //                         minLength={
// //                           field.name === "password" && dialog === "create"
// //                             ? 6
// //                             : undefined
// //                         }
// //                         value={fields[field.name] || ""}
// //                         onChange={(event) =>
// //                           setField(field.name, event.target.value)
// //                         }
// //                         className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
// //                       />
// //                     )}
// //                   </label>
// //                 ))}
// //                 {section === "staff" && (
// //                   <div className="sm:col-span-2 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs leading-5 text-sky-100">
// //                     {props.userRole === "MANAGER"
// //                       ? `This cashier account will be assigned to ${props.stores.find((store) => store.id === props.storeId)?.name ?? "your active store"}. You can manage cashiers in stores assigned to your account.`
// //                       : `New staff will be assigned to ${props.stores.find((store) => store.id === props.storeId)?.name ?? "the active store"}.`}
// //                   </div>
// //                 )}
// //                 {section === "staff" && (
// //                   <fieldset className="sm:col-span-2">
// //                     <legend className="mb-2 text-xs font-semibold text-slate-400">
// //                       Additional permissions (server validates what you can
// //                       delegate)
// //                     </legend>
// //                     <div className="grid grid-cols-2 gap-2">
// //                       {[
// //                         "MANAGE_STAFF",
// //                         "MANAGE_INVENTORY",
// //                         "EDIT_PRICES",
// //                         "VOID_ORDERS",
// //                         "REFUND_ORDERS",
// //                         "VIEW_REPORTS",
// //                         "VIEW_ANALYTICS",
// //                         "MANAGE_PROMOTIONS",
// //                         "VIEW_AUDIT_LOGS",
// //                         "MANAGE_API_KEYS",
// //                         "MANAGE_WEBHOOKS",
// //                       ].map((permission) => (
// //                         <label
// //                           key={permission}
// //                           className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300"
// //                         >
// //                           <input
// //                             type="checkbox"
// //                             checked={staffPermissions.includes(permission)}
// //                             onChange={(event) =>
// //                               setStaffPermissions((current) =>
// //                                 event.target.checked
// //                                   ? [...current, permission]
// //                                   : current.filter(
// //                                       (value) => value !== permission,
// //                                     ),
// //                               )
// //                             }
// //                           />
// //                           {permission.split("_").join(" ").toLowerCase()}
// //                         </label>
// //                       ))}
// //                     </div>
// //                   </fieldset>
// //                 )}
// //               </div>
// //             )}

// //             {error && (
// //               <p
// //                 role="alert"
// //                 className="mx-6 mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-300"
// //               >
// //                 {error}
// //               </p>
// //             )}
// //             {/* ——— Footer / navigation ——— */}
// //             <div className="sticky bottom-0 rounded-b-2xl border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
// //               {(dialog === "create" || dialog === "edit") &&
// //               section === "products" ? (
// //                 <>
// //                   {wizardStep > 1 ? (
// //                     <button
// //                       type="button"
// //                       onClick={() => {
// //                         setWizardStep((s) => s - 1);
// //                         setError(null);
// //                       }}
// //                       className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
// //                     >
// //                       <ChevronLeft className="h-4 w-4" />
// //                       Back
// //                     </button>
// //                   ) : (
// //                     <button
// //                       type="button"
// //                       onClick={() => setDialog(null)}
// //                       className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
// //                     >
// //                       Cancel
// //                     </button>
// //                   )}
// //                   {wizardStep < 3 ? (
// //                     <button
// //                       type="button"
// //                       onClick={() => {
// //                         setError(null);
// //                         if (wizardStep === 1 && !fields.name.trim()) {
// //                           setError("Product name is required.");
// //                           return;
// //                         }
// //                         if (wizardStep === 2) {
// //                           const namedVariants = variantInputs.filter((v) =>
// //                             v.name.trim(),
// //                           );
// //                           if (!namedVariants.length) {
// //                             setError("Add at least one named variant.");
// //                             return;
// //                           }
// //                           const missingPrice = namedVariants.some(
// //                             (v) => !v.price || Number(v.price) <= 0,
// //                           );
// //                           if (missingPrice) {
// //                             setError(
// //                               "Every variant needs a selling price greater than 0.",
// //                             );
// //                             return;
// //                           }
// //                         }
// //                         setWizardStep((s) => s + 1);
// //                       }}
// //                       className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-400 shadow-md shadow-sky-500/20 transition-all"
// //                     >
// //                       Next
// //                       <ChevronRight className="h-4 w-4" />
// //                     </button>
// //                   ) : (
// //                     <button
// //                       disabled={busy}
// //                       className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all"
// //                     >
// //                       {busy ? (
// //                         "Saving…"
// //                       ) : (
// //                         <>
// //                           <Check className="h-4 w-4" />
// //                           {dialog === "edit"
// //                             ? "Save changes"
// //                             : "Create product"}
// //                         </>
// //                       )}
// //                     </button>
// //                   )}
// //                 </>
// //               ) : (
// //                 <>
// //                   <button
// //                     type="button"
// //                     onClick={() => setDialog(null)}
// //                     className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-all"
// //                   >
// //                     Cancel
// //                   </button>
// //                   <button
// //                     disabled={busy}
// //                     className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-sky-400 transition-all"
// //                   >
// //                     {busy
// //                       ? "Saving…"
// //                       : dialog === "stock"
// //                         ? "Save adjustment"
// //                         : dialog === "edit"
// //                           ? "Save changes"
// //                           : `Create ${labels[section as EntitySection]}`}
// //                   </button>
// //                 </>
// //               )}
// //             </div>
// //           </form>
// //         </div>
// //       )}
// //     </main>
// //   );
// // }
