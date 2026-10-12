import { useEffect, useState } from "react";
import { Printer, Server, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import {
  useGetStoreSettingsQuery,
  useUpsertStoreSettingMutation,
} from "../store/apiSlice";

type PrinterProfile = { paperWidth: "58" | "80"; autoPrintReceipt: boolean };
const defaultProfile: PrinterProfile = { paperWidth: "80", autoPrintReceipt: false };
const profileKey = (storeId?: string) => "kanitt:printer-profile:" + (storeId || "unassigned");

export function SettingsView({
  connected,
  storeName,
  storeId,
  canEditStoreSettings,
}: {
  connected: boolean;
  storeName?: string;
  storeId?: string;
  canEditStoreSettings: boolean;
}) {
  const configuredApi = import.meta.env.VITE_API_URL || "https://pos.oasislab.de5.net";
  const [profile, setProfile] = useState<PrinterProfile>(defaultProfile);
  const [testPrint, setTestPrint] = useState(false);
  const [receiptHeader, setReceiptHeader] = useState(storeName || "");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for shopping with us!");
  const [storeSaveMessage, setStoreSaveMessage] = useState("");
  const { data: storeSettings = [] } = useGetStoreSettingsQuery(
    { storeId },
    { skip: !storeId },
  );
  const [upsertStoreSetting, { isLoading: savingStoreSettings }] =
    useUpsertStoreSettingMutation();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(profileKey(storeId));
      const parsed = saved ? JSON.parse(saved) : {};
      setProfile({
        paperWidth: parsed.paperWidth === "58" ? "58" : "80",
        autoPrintReceipt: parsed.autoPrintReceipt === true,
      });
    } catch {
      setProfile(defaultProfile);
    }
  }, [storeId]);

  useEffect(() => {
    setReceiptHeader(
      String(storeSettings.find((item: any) => item.settingKey === "receipt_header")?.settingValue || storeName || ""),
    );
    setReceiptFooter(
      String(storeSettings.find((item: any) => item.settingKey === "receipt_footer")?.settingValue || "Thank you for shopping with us!"),
    );
  }, [storeSettings, storeName]);

  useEffect(() => {
    if (!testPrint) return;
    const handleAfterPrint = () => setTestPrint(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [testPrint]);

  const saveProfile = (next: PrinterProfile) => {
    setProfile(next);
    localStorage.setItem(profileKey(storeId), JSON.stringify(next));
  };

  const runTestPrint = () => {
    setTestPrint(true);
    window.setTimeout(() => window.print(), 150);
  };

  const saveStoreReceiptSettings = async () => {
    if (!storeId || !canEditStoreSettings) return;
    try {
      await upsertStoreSetting({
        storeId,
        settingKey: "receipt_header",
        settingValue: receiptHeader.trim(),
        description: "Store receipt header",
      }).unwrap();
      await upsertStoreSetting({
        storeId,
        settingKey: "receipt_footer",
        settingValue: receiptFooter.trim(),
        description: "Store receipt footer",
      }).unwrap();
      setStoreSaveMessage("Receipt details saved for this store.");
    } catch (error: any) {
      setStoreSaveMessage(error?.data?.message || error?.message || "Could not save store receipt details.");
    }
  };

  return (
    <main className="relative flex-1 overflow-y-auto p-6">
      {testPrint && (
        <>
          <style>{"@page { size: auto; margin: 2mm; } @media print { body * { visibility: hidden !important; } #kanitt-printer-test, #kanitt-printer-test * { visibility: visible !important; } #kanitt-printer-test { display: block !important; position: fixed; left: 0; top: 0; width: " + profile.paperWidth + "mm; padding: 4mm; color: #000; background: #fff; font: 12px monospace; } }"}</style>
          <div id="kanitt-printer-test" className="hidden print:block">
            <h2>{storeName || "KANITT POS"}</h2>
            <p>PRINTER TEST</p>
            <hr />
            <p>Paper width: {profile.paperWidth} mm</p>
            <p>{new Date().toLocaleString()}</p>
            <p>Printer connection is handled by the system print dialog.</p>
          </div>
        </>
      )}
      <div className="mb-6">
        <h2 className="text-2xl font-black text-white">Register &amp; Printer Settings</h2>
        <p className="mt-1 text-xs text-slate-400">Printer preferences are stored on this device for the selected store.</p>
      </div>

      <div className="grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Active Workspace</h3>
          <div className="flex items-center gap-3 rounded-xl bg-slate-950 p-4"><ShieldCheck className="h-5 w-5 text-sky-400" /><div><p className="text-xs text-slate-500">Selected store</p><p className="text-sm font-semibold text-white">{storeName || "No store selected"}</p></div></div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Receipt content and tax belong to store settings. The physical printer is configured separately on each register device.</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Store Receipt Details</h3>
          <label className="mb-3 block text-xs font-semibold text-slate-300">Receipt header
            <input value={receiptHeader} onChange={(event) => setReceiptHeader(event.target.value)} disabled={!canEditStoreSettings} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white disabled:opacity-60" placeholder={storeName || "Store name"} />
          </label>
          <label className="block text-xs font-semibold text-slate-300">Receipt footer
            <input value={receiptFooter} onChange={(event) => setReceiptFooter(event.target.value)} disabled={!canEditStoreSettings} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white disabled:opacity-60" placeholder="Thank you for shopping with us!" />
          </label>
          {storeSaveMessage && <p role="status" className="mt-3 text-xs text-slate-300">{storeSaveMessage}</p>}
          {canEditStoreSettings ? (
            <button onClick={saveStoreReceiptSettings} disabled={!storeId || savingStoreSettings} className="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">{savingStoreSettings ? "Saving store settings…" : "Save receipt details for store"}</button>
          ) : (
            <p className="mt-3 text-[10px] text-slate-500">Ask a manager or administrator to change these store-wide receipt details.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Printer className="h-4 w-4" />This Register Printer</h3>
          <p className="mb-4 text-xs leading-5 text-slate-500">Tauri uses the operating system printer dialog. Select the printer there, then save its paper layout below.</p>
          <label className="block text-xs font-semibold text-slate-300">Receipt paper width
            <select value={profile.paperWidth} onChange={(event) => saveProfile({ ...profile, paperWidth: event.target.value as "58" | "80" })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
              <option value="58">58 mm thermal</option>
              <option value="80">80 mm thermal</option>
            </select>
          </label>
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-slate-950 p-3">
            <span><span className="block text-xs font-semibold text-white">Auto-print receipt after sale</span><span className="mt-1 block text-[10px] text-slate-500">Opens the system print dialog after checkout.</span></span>
            <input type="checkbox" checked={profile.autoPrintReceipt} onChange={(event) => saveProfile({ ...profile, autoPrintReceipt: event.target.checked })} className="h-4 w-4 accent-sky-400" />
          </label>
          <button onClick={runTestPrint} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-xs font-bold text-slate-950 hover:bg-sky-300"><Printer className="h-4 w-4" />Test print</button>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">Test print opens the OS print dialog so the cashier can choose an installed printer. Direct Bluetooth/LAN selection is not available in this Tauri build.</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Server Connection</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs text-slate-300"><Server className="h-4 w-4" /> kanitt_server</span><span className={"flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold " + (connected ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-300")}>{connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{connected ? "Connected" : "Unavailable"}</span></div>
            <div className="rounded-xl bg-slate-950 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">API origin</p><p className="mt-1 break-all font-mono text-xs text-slate-300">{configuredApi}</p></div>
            <p className="text-[11px] leading-5 text-slate-500">Change this with VITE_API_URL in kanitt_win/.env. The app adds /api automatically.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
