import { useState, type FormEvent } from "react";
import { Check, Clock3, PackageCheck, Truck, XCircle } from "lucide-react";
import {
  Store as ApiStore,
  useCompleteStockTransferMutation,
  useCreateStockTransferMutation,
  useGetStockRequestsQuery,
  useUpdateStockRequestMutation,
} from "../store/apiSlice";

interface Props {
  storeId?: string;
  stores: ApiStore[];
  userRole: string;
  userPermissions: string[];
  allowedTransferStoreIds: string[];
}

const openStatuses = ["PENDING", "ACKNOWLEDGED"];

export function StockRequestsView({ storeId, stores, userRole, userPermissions, allowedTransferStoreIds }: Props) {
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
  const canManage = isAdmin || (userRole === "MANAGER" && userPermissions.includes("MANAGE_INVENTORY"));
  const queryStoreId = isAdmin ? undefined : storeId;
  const { data: requests = [], isFetching } = useGetStockRequestsQuery({ storeId: queryStoreId }, {
    pollingInterval: 15000,
    skip: !storeId && !isAdmin,
  });
  const [updateRequest, { isLoading: isUpdating }] = useUpdateStockRequestMutation();
  const [createTransfer, { isLoading: isCreatingTransfer }] = useCreateStockTransferMutation();
  const [completeTransfer, { isLoading: isReceiving }] = useCompleteStockTransferMutation();
  const [transferRequest, setTransferRequest] = useState<any>(null);
  const [sourceStoreId, setSourceStoreId] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");
  const sourceStores = isAdmin ? stores : stores.filter((store) => allowedTransferStoreIds.includes(store.id));
  const visibleRequests = requests.filter((request: any) => showHistory ? !openStatuses.includes(request.status) : openStatuses.includes(request.status));

  const submitTransfer = async (event: FormEvent) => {
    event.preventDefault();
    if (!transferRequest || !sourceStoreId) return;
    try {
      await createTransfer({
        fromStoreId: sourceStoreId,
        toStoreId: transferRequest.storeId,
        stockRequestId: transferRequest.id,
        notes: `Stock request for ${transferRequest.store?.name || "receiving store"}`,
        items: [{ productId: transferRequest.productId, variantId: transferRequest.variantId, quantity: transferRequest.quantity }],
      }).unwrap();
      setTransferRequest(null);
      setSourceStoreId("");
      setError("");
    } catch (cause: any) {
      setError(cause?.data?.message || "Could not create transfer. Check source stock and your store access.");
    }
  };

  const receiveTransfer = async (request: any) => {
    const transferId = request.reviewNote?.match(/stock-transfer:([^\s]+)/)?.[1];
    if (!transferId || !window.confirm("Confirm these goods physically arrived? Stock will be moved and the request closed.")) return;
    try {
      await completeTransfer(transferId).unwrap();
      setError("");
    } catch (cause: any) {
      setError(cause?.data?.message || "Could not receive transfer.");
    }
  };

  const rejectRequest = async (request: any) => {
    try {
      await updateRequest({ id: request.id, patch: { status: "REJECTED", reviewNote: "Request rejected by store manager." } }).unwrap();
      setError("");
    } catch (cause: any) {
      setError(cause?.data?.message || "Could not update request.");
    }
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b1220] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-300">Inventory workflow</p>
            <h1 className="mt-1 text-2xl font-black text-white">Stock requests</h1>
            <p className="mt-1 text-sm text-slate-400">Track requests here. Stock changes only after a transfer is received.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">{requests.filter((r: any) => openStatuses.includes(r.status)).length} open</span>
            <button onClick={() => setShowHistory(false)} className={`rounded-lg px-3 py-2 text-xs font-bold ${!showHistory ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}>Open</button>
            <button onClick={() => setShowHistory(true)} className={`rounded-lg px-3 py-2 text-xs font-bold ${showHistory ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}>History</button>
          </div>
        </header>

        {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><XCircle className="h-4 w-4" /></button></div>}
        {isFetching && <p className="text-xs text-slate-500">Refreshing request status…</p>}
        <section className="space-y-3">
          {visibleRequests.map((request: any) => {
            const transferId = request.reviewNote?.match(/stock-transfer:([^\s]+)/)?.[1];
            return (
              <article key={request.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-200"><PackageCheck className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-white">{request.product?.name} · {request.variant?.name}</h2>
                      <p className="mt-1 text-xs text-slate-400">{request.quantity} requested · {request.store?.name} · by {request.requestedBy?.name}</p>
                      {request.reason && <p className="mt-2 text-xs text-slate-500">Reason: {request.reason}</p>}
                      {request.reviewNote && <p className="mt-2 text-xs text-sky-200">Update: {request.reviewNote.replace(/\s*stock-transfer:[^\s]+/g, "")}</p>}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${request.status === "PENDING" ? "bg-amber-400/10 text-amber-200" : request.status === "ACKNOWLEDGED" ? "bg-sky-400/10 text-sky-200" : request.status === "FULFILLED" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-700 text-slate-300"}`}>{request.status.toLowerCase()}</span>
                </div>
                {canManage && openStatuses.includes(request.status) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                    {transferId ? (
                      <button disabled={isReceiving} onClick={() => void receiveTransfer(request)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"><Check className="h-4 w-4" />{isReceiving ? "Posting stock…" : "Confirm received"}</button>
                    ) : sourceStores.some((store) => store.id !== request.storeId) ? (
                      <button disabled={isUpdating} onClick={() => { setTransferRequest(request); setSourceStoreId(""); }} className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"><Truck className="h-4 w-4" />Create transfer</button>
                    ) : <p className="text-xs text-amber-200">Ask an administrator to arrange a transfer from another store.</p>}
                    {!transferId && <button disabled={isUpdating} onClick={() => void rejectRequest(request)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50">Reject</button>}
                    {request.status === "PENDING" && <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-slate-500"><Clock3 className="h-3.5 w-3.5" />Waiting for review</span>}
                  </div>
                )}
              </article>
            );
          })}
          {!visibleRequests.length && <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center"><PackageCheck className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-bold text-slate-300">{showHistory ? "No completed requests yet" : "No open stock requests"}</p><p className="mt-1 text-xs text-slate-500">New requests and status updates will appear here.</p></div>}
        </section>
      </div>

      {transferRequest && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setTransferRequest(null); }}>
        <form onSubmit={submitTransfer} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
          <h2 className="text-lg font-bold text-white">Create stock transfer</h2>
          <p className="mt-1 text-sm text-slate-400">{transferRequest.quantity} × {transferRequest.product?.name} · {transferRequest.variant?.name}</p>
          <label className="mt-4 block text-xs font-semibold text-slate-300">Send from
            <select required autoFocus value={sourceStoreId} onChange={(event) => setSourceStoreId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white">
              <option value="">Choose source store</option>
              {sourceStores.filter((store) => store.id !== transferRequest.storeId).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
          </label>
          <p className="mt-3 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] leading-5 text-slate-400">The transfer stays in progress until the receiving store confirms delivery. Inventory is updated at receipt.</p>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setTransferRequest(null)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-400">Cancel</button><button disabled={!sourceStoreId || isCreatingTransfer} className="rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50">{isCreatingTransfer ? "Creating…" : "Create transfer"}</button></div>
        </form>
      </div>}
    </main>
  );
}
