import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  PackageCheck,
  Truck,
  XCircle,
} from "lucide-react";
import {
  Store as ApiStore,
  useCompleteStockTransferMutation,
  useCreateStockTransferMutation,
  useGetStockRequestsQuery,
  useUpdateStockRequestMutation,
} from "../store/apiSlice";
import { useSystemBack } from "../hooks/SystemBackProvider";

interface Props {
  storeId?: string;
  stores: ApiStore[];
  userRole: string;
  userPermissions: string[];
  allowedTransferStoreIds: string[];
}

const openStatuses = ["PENDING", "ACKNOWLEDGED"];

export function StockRequestsView({
  storeId,
  stores,
  userRole,
  userPermissions,
  allowedTransferStoreIds,
}: Props) {
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
  const canManage =
    isAdmin ||
    (userRole === "MANAGER" && userPermissions.includes("MANAGE_INVENTORY"));
  const queryStoreId = isAdmin ? undefined : storeId;

  const { data: requests = [], isFetching } = useGetStockRequestsQuery(
    { storeId: queryStoreId },
    {
      pollingInterval: 15000,
      skip: !storeId && !isAdmin,
    },
  );
  const [updateRequest, { isLoading: isUpdating }] =
    useUpdateStockRequestMutation();
  const [createTransfer, { isLoading: isCreatingTransfer }] =
    useCreateStockTransferMutation();
  const [completeTransfer, { isLoading: isReceiving }] =
    useCompleteStockTransferMutation();

  const [transferRequest, setTransferRequest] = useState<any>(null);
  useSystemBack(!!transferRequest, () => setTransferRequest(null), 40);
  const [sourceStoreId, setSourceStoreId] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");

  const sourceStores = isAdmin
    ? stores
    : stores.filter((store) => allowedTransferStoreIds.includes(store.id));

  const eligibleSourceStores = transferRequest
    ? sourceStores.filter((store) => store.id !== transferRequest.storeId)
    : [];

  const visibleRequests = requests.filter((request: any) =>
    showHistory
      ? !openStatuses.includes(request.status)
      : openStatuses.includes(request.status),
  );

  const submitTransfer = async (event: FormEvent) => {
    event.preventDefault();
    if (!transferRequest || !sourceStoreId) return;
    try {
      await createTransfer({
        fromStoreId: sourceStoreId,
        toStoreId: transferRequest.storeId,
        stockRequestId: transferRequest.id,
        notes: `Stock request for ${transferRequest.store?.name || "receiving store"}`,
        items: [
          {
            productId: transferRequest.productId,
            variantId: transferRequest.variantId,
            quantity: transferRequest.quantity,
          },
        ],
      }).unwrap();
      setTransferRequest(null);
      setSourceStoreId("");
      setError("");
    } catch (cause: any) {
      setError(
        cause?.data?.message ||
          "Could not create transfer. Check source stock and your store access.",
      );
    }
  };

  const receiveTransfer = async (request: any) => {
    const transferId = request.reviewNote?.match(
      /stock-transfer:([^\s]+)/,
    )?.[1];
    if (
      !transferId ||
      !window.confirm(
        "Confirm the full shipment arrived? This adds the sent quantity to the receiving store and closes the request. Record shortages or damage as a stock adjustment afterward.",
      )
    )
      return;
    try {
      await completeTransfer(transferId).unwrap();
      setError("");
    } catch (cause: any) {
      setError(cause?.data?.message || "Could not receive transfer.");
    }
  };

  const rejectRequest = async (request: any) => {
    try {
      await updateRequest({
        id: request.id,
        patch: {
          status: "REJECTED",
          reviewNote: "Request rejected by store manager.",
        },
      }).unwrap();
      setError("");
    } catch (cause: any) {
      setError(cause?.data?.message || "Could not update request.");
    }
  };

  /* ---------- Source store preview (for the modal) ---------- */

  const sourceStore = stores.find((store) => store.id === sourceStoreId);
  const destinationStore = transferRequest
    ? stores.find((store) => store.id === transferRequest.storeId)
    : undefined;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-slate-950 p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* ---------- Header ---------- */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-violet-300">
              Inventory workflow
            </p>
            <h1 className="mt-1 text-2xl font-black text-white">
              Stock requests
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Send stock from the source store, then confirm delivery at the
              receiving store.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-bold text-violet-200">
              {
                requests.filter((r: any) => openStatuses.includes(r.status))
                  .length
              }{" "}
              open
            </span>
            <button
              onClick={() => setShowHistory(false)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                !showHistory
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                showHistory
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              History
            </button>
          </div>
        </header>

        {/* ---------- Error banner ---------- */}
        {error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
        {isFetching && (
          <p className="text-xs text-slate-500">Refreshing request status…</p>
        )}

        {/* ---------- Request cards ---------- */}
        <section className="space-y-3">
          {visibleRequests.map((request: any) => {
            const transferId = request.reviewNote?.match(
              /stock-transfer:([^\s]+)/,
            )?.[1];
            return (
              <article
                key={request.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-white">
                        {request.product?.name} · {request.variant?.name}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        {request.quantity} requested · {request.store?.name} ·
                        by {request.requestedBy?.name}
                      </p>
                      {request.reason && (
                        <p className="mt-2 text-xs text-slate-500">
                          Reason: {request.reason}
                        </p>
                      )}
                      {request.reviewNote && (
                        <p className="mt-2 text-xs text-sky-200">
                          Update:{" "}
                          {request.reviewNote.replace(
                            /\s*stock-transfer:[^\s]+/g,
                            "",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                      request.status === "PENDING"
                        ? "bg-amber-400/10 text-amber-200"
                        : request.status === "ACKNOWLEDGED"
                          ? "bg-sky-400/10 text-sky-200"
                          : request.status === "FULFILLED"
                            ? "bg-emerald-400/10 text-emerald-200"
                            : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {request.status.toLowerCase()}
                  </span>
                </div>

                {canManage && openStatuses.includes(request.status) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                    {transferId ? (
                      <button
                        disabled={isReceiving}
                        onClick={() => void receiveTransfer(request)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {isReceiving ? "Posting stock…" : "Confirm received"}
                      </button>
                    ) : sourceStores.some(
                        (store) => store.id !== request.storeId,
                      ) ? (
                      <button
                        disabled={isUpdating}
                        onClick={() => {
                          setTransferRequest(request);
                          setSourceStoreId("");
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                      >
                        <Truck className="h-4 w-4" />
                        Send stock
                      </button>
                    ) : (
                      <p className="text-xs text-amber-200">
                        Ask an administrator to arrange a transfer from another
                        store.
                      </p>
                    )}
                    {!transferId && (
                      <button
                        disabled={isUpdating}
                        onClick={() => void rejectRequest(request)}
                        className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    {request.status === "PENDING" && (
                      <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        Waiting for review
                      </span>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {!visibleRequests.length && (
            <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
              <PackageCheck className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 font-bold text-slate-300">
                {showHistory
                  ? "No completed requests yet"
                  : "No open stock requests"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                New requests and status updates will appear here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ============================================================ */}
      {/*  SEND STOCK MODAL — two-panel layout                          */}
      {/* ============================================================ */}
      {transferRequest && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTransferRequest(null);
          }}
        >
          <form
            onSubmit={submitTransfer}
            className="w-full max-w-4xl rounded-t-3xl border border-slate-700 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6"
          >
            <h2 className="text-xl font-bold text-white">Send stock</h2>
            <p className="mt-1 text-xs text-slate-400">
              This action is recorded on the server and may update inventory or
              balances.
            </p>

            {/* Info strip */}
            <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] leading-5 text-sky-200">
              Sending deducts source stock; the destination adds it after
              confirming delivery.
            </div>

            {/* ---------- Two-panel layout ---------- */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_56px_1fr]">
              {/* -------- Left: Source store -------- */}
              <div className="flex max-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <div className="border-b border-slate-800 bg-slate-900 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-white">
                      Source: {sourceStore?.name || "Select a store below"}
                    </h3>
                    <span className="shrink-0 rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                      List & stock
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Choose the branch that will send stock
                  </p>
                </div>

                {/* Source store picker */}
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {eligibleSourceStores.length === 0 ? (
                    <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
                      You don't have access to another source store for this
                      transfer.
                    </p>
                  ) : (
                    eligibleSourceStores.map((store) => {
                      const selected = sourceStoreId === store.id;
                      return (
                        <button
                          key={store.id}
                          type="button"
                          onClick={() => setSourceStoreId(store.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                            selected
                              ? "border-sky-400/60 bg-sky-500/10 text-white"
                              : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold">{store.name}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              Stock will be deducted from this branch when sent.
                            </p>
                          </div>
                          {selected && (
                            <Check className="h-4 w-4 shrink-0 text-sky-300" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* -------- Middle: arrows -------- */}
              <div className="hidden flex-col items-center justify-center gap-2 py-8 md:flex">
                <ArrowRight className="h-6 w-6 text-violet-400" />
                <span className="text-center text-[10px] font-bold uppercase tracking-wider text-violet-400">
                  to
                  <br />
                  transfer
                </span>
                <ArrowLeft className="mt-4 h-6 w-6 text-slate-600" />
              </div>

              {/* -------- Right: Destination (the request) -------- */}
              <div className="flex max-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <div className="border-b border-slate-800 bg-slate-900 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-white">
                      Destination: {destinationStore?.name || "Receiving store"}
                    </h3>
                    <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                      List
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Items in this shipment
                  </p>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          {transferRequest.product?.name}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          {transferRequest.variant?.name}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-violet-500/15 px-2 py-1 text-[11px] font-bold text-violet-200">
                        × {transferRequest.quantity}
                      </span>
                    </div>

                    {transferRequest.reason && (
                      <p className="mt-2 border-t border-slate-800 pt-2 text-[10px] italic text-slate-500">
                        Reason: {transferRequest.reason}
                      </p>
                    )}
                    {transferRequest.requestedBy?.name && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Requested by {transferRequest.requestedBy.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Total options:</span>
                    <span className="font-bold text-white">1</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total units:</span>
                    <span className="font-bold text-white">
                      {transferRequest.quantity}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes / info */}
            <p className="mt-4 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] leading-5 text-slate-400">
              Sending reduces source stock and marks the shipment in transit.
              The receiving store adds it to stock after confirming arrival.
            </p>

            {/* Footer */}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setTransferRequest(null)}
                className="w-full rounded-xl px-4 py-3 text-sm font-bold text-slate-400 hover:bg-slate-900 sm:w-auto sm:py-2.5"
              >
                Cancel
              </button>
              <button
                disabled={!sourceStoreId || isCreatingTransfer}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-black text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
              >
                {isCreatingTransfer && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {isCreatingTransfer ? "Sending…" : "Send stock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

// import { useState, type FormEvent } from "react";
// import { Check, Clock3, PackageCheck, Truck, XCircle } from "lucide-react";
// import { ChoiceCards } from "./ChoiceCards";
// import {
//   Store as ApiStore,
//   useCompleteStockTransferMutation,
//   useCreateStockTransferMutation,
//   useGetStockRequestsQuery,
//   useUpdateStockRequestMutation,
// } from "../store/apiSlice";

// interface Props {
//   storeId?: string;
//   stores: ApiStore[];
//   userRole: string;
//   userPermissions: string[];
//   allowedTransferStoreIds: string[];
// }

// const openStatuses = ["PENDING", "ACKNOWLEDGED"];

// export function StockRequestsView({
//   storeId,
//   stores,
//   userRole,
//   userPermissions,
//   allowedTransferStoreIds,
// }: Props) {
//   const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
//   const canManage =
//     isAdmin ||
//     (userRole === "MANAGER" && userPermissions.includes("MANAGE_INVENTORY"));
//   const queryStoreId = isAdmin ? undefined : storeId;
//   const { data: requests = [], isFetching } = useGetStockRequestsQuery(
//     { storeId: queryStoreId },
//     {
//       pollingInterval: 15000,
//       skip: !storeId && !isAdmin,
//     },
//   );
//   const [updateRequest, { isLoading: isUpdating }] =
//     useUpdateStockRequestMutation();
//   const [createTransfer, { isLoading: isCreatingTransfer }] =
//     useCreateStockTransferMutation();
//   const [completeTransfer, { isLoading: isReceiving }] =
//     useCompleteStockTransferMutation();
//   const [transferRequest, setTransferRequest] = useState<any>(null);
//   const [sourceStoreId, setSourceStoreId] = useState("");
//   const [showHistory, setShowHistory] = useState(false);
//   const [error, setError] = useState("");
//   const sourceStores = isAdmin
//     ? stores
//     : stores.filter((store) => allowedTransferStoreIds.includes(store.id));
//   const eligibleSourceStores = transferRequest
//     ? sourceStores.filter((store) => store.id !== transferRequest.storeId)
//     : [];
//   const visibleRequests = requests.filter((request: any) =>
//     showHistory
//       ? !openStatuses.includes(request.status)
//       : openStatuses.includes(request.status),
//   );

//   const submitTransfer = async (event: FormEvent) => {
//     event.preventDefault();
//     if (!transferRequest || !sourceStoreId) return;
//     try {
//       await createTransfer({
//         fromStoreId: sourceStoreId,
//         toStoreId: transferRequest.storeId,
//         stockRequestId: transferRequest.id,
//         notes: `Stock request for ${transferRequest.store?.name || "receiving store"}`,
//         items: [
//           {
//             productId: transferRequest.productId,
//             variantId: transferRequest.variantId,
//             quantity: transferRequest.quantity,
//           },
//         ],
//       }).unwrap();
//       setTransferRequest(null);
//       setSourceStoreId("");
//       setError("");
//     } catch (cause: any) {
//       setError(
//         cause?.data?.message ||
//           "Could not create transfer. Check source stock and your store access.",
//       );
//     }
//   };

//   const receiveTransfer = async (request: any) => {
//     const transferId = request.reviewNote?.match(
//       /stock-transfer:([^\s]+)/,
//     )?.[1];
//     if (
//       !transferId ||
//       !window.confirm(
//         "Confirm the full shipment arrived? This adds the sent quantity to the receiving store and closes the request. Record shortages or damage as a stock adjustment afterward.",
//       )
//     )
//       return;
//     try {
//       await completeTransfer(transferId).unwrap();
//       setError("");
//     } catch (cause: any) {
//       setError(cause?.data?.message || "Could not receive transfer.");
//     }
//   };

//   const rejectRequest = async (request: any) => {
//     try {
//       await updateRequest({
//         id: request.id,
//         patch: {
//           status: "REJECTED",
//           reviewNote: "Request rejected by store manager.",
//         },
//       }).unwrap();
//       setError("");
//     } catch (cause: any) {
//       setError(cause?.data?.message || "Could not update request.");
//     }
//   };

//   return (
//     <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b1220] p-4 text-slate-100 sm:p-6 lg:p-8">
//       <div className="mx-auto max-w-5xl space-y-5">
//         <header className="flex flex-wrap items-end justify-between gap-3">
//           <div>
//             <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-300">
//               Inventory workflow
//             </p>
//             <h1 className="mt-1 text-2xl font-black text-white">
//               Stock requests
//             </h1>
//             <p className="mt-1 text-sm text-slate-400">
//               Send stock from the source store, then confirm delivery at the
//               receiving store.
//             </p>
//           </div>
//           <div className="flex items-center gap-2">
//             <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
//               {
//                 requests.filter((r: any) => openStatuses.includes(r.status))
//                   .length
//               }{" "}
//               open
//             </span>
//             <button
//               onClick={() => setShowHistory(false)}
//               className={`rounded-lg px-3 py-2 text-xs font-bold ${!showHistory ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}
//             >
//               Open
//             </button>
//             <button
//               onClick={() => setShowHistory(true)}
//               className={`rounded-lg px-3 py-2 text-xs font-bold ${showHistory ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"}`}
//             >
//               History
//             </button>
//           </div>
//         </header>

//         {error && (
//           <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
//             <span>{error}</span>
//             <button onClick={() => setError("")} aria-label="Dismiss error">
//               <XCircle className="h-4 w-4" />
//             </button>
//           </div>
//         )}
//         {isFetching && (
//           <p className="text-xs text-slate-500">Refreshing request status…</p>
//         )}
//         <section className="space-y-3">
//           {visibleRequests.map((request: any) => {
//             const transferId = request.reviewNote?.match(
//               /stock-transfer:([^\s]+)/,
//             )?.[1];
//             return (
//               <article
//                 key={request.id}
//                 className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
//               >
//                 <div className="flex flex-wrap items-start justify-between gap-3">
//                   <div className="flex min-w-0 gap-3">
//                     <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-200">
//                       <PackageCheck className="h-5 w-5" />
//                     </div>
//                     <div className="min-w-0">
//                       <h2 className="font-bold text-white">
//                         {request.product?.name} · {request.variant?.name}
//                       </h2>
//                       <p className="mt-1 text-xs text-slate-400">
//                         {request.quantity} requested · {request.store?.name} ·
//                         by {request.requestedBy?.name}
//                       </p>
//                       {request.reason && (
//                         <p className="mt-2 text-xs text-slate-500">
//                           Reason: {request.reason}
//                         </p>
//                       )}
//                       {request.reviewNote && (
//                         <p className="mt-2 text-xs text-sky-200">
//                           Update:{" "}
//                           {request.reviewNote.replace(
//                             /\s*stock-transfer:[^\s]+/g,
//                             "",
//                           )}
//                         </p>
//                       )}
//                     </div>
//                   </div>
//                   <span
//                     className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${request.status === "PENDING" ? "bg-amber-400/10 text-amber-200" : request.status === "ACKNOWLEDGED" ? "bg-sky-400/10 text-sky-200" : request.status === "FULFILLED" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-700 text-slate-300"}`}
//                   >
//                     {request.status.toLowerCase()}
//                   </span>
//                 </div>
//                 {canManage && openStatuses.includes(request.status) && (
//                   <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
//                     {transferId ? (
//                       <button
//                         disabled={isReceiving}
//                         onClick={() => void receiveTransfer(request)}
//                         className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
//                       >
//                         <Check className="h-4 w-4" />
//                         {isReceiving ? "Posting stock…" : "Confirm received"}
//                       </button>
//                     ) : sourceStores.some(
//                         (store) => store.id !== request.storeId,
//                       ) ? (
//                       <button
//                         disabled={isUpdating}
//                         onClick={() => {
//                           setTransferRequest(request);
//                           setSourceStoreId("");
//                         }}
//                         className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
//                       >
//                         <Truck className="h-4 w-4" />
//                         Send stock
//                       </button>
//                     ) : (
//                       <p className="text-xs text-amber-200">
//                         Ask an administrator to arrange a transfer from another
//                         store.
//                       </p>
//                     )}
//                     {!transferId && (
//                       <button
//                         disabled={isUpdating}
//                         onClick={() => void rejectRequest(request)}
//                         className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
//                       >
//                         Reject
//                       </button>
//                     )}
//                     {request.status === "PENDING" && (
//                       <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-slate-500">
//                         <Clock3 className="h-3.5 w-3.5" />
//                         Waiting for review
//                       </span>
//                     )}
//                   </div>
//                 )}
//               </article>
//             );
//           })}
//           {!visibleRequests.length && (
//             <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
//               <PackageCheck className="mx-auto h-8 w-8 text-slate-600" />
//               <p className="mt-3 font-bold text-slate-300">
//                 {showHistory
//                   ? "No completed requests yet"
//                   : "No open stock requests"}
//               </p>
//               <p className="mt-1 text-xs text-slate-500">
//                 New requests and status updates will appear here.
//               </p>
//             </div>
//           )}
//         </section>
//       </div>

//       {transferRequest && (
//         <div
//           className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
//           onMouseDown={(event) => {
//             if (event.target === event.currentTarget) setTransferRequest(null);
//           }}
//         >
//           <form
//             onSubmit={submitTransfer}
//             className="w-full max-w-2xl rounded-t-3xl border border-slate-700 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6"
//           >
//             <h2 className="text-xl font-bold text-white">
//               Send stock to store
//             </h2>
//             <p className="mt-1 text-sm text-slate-400">
//               {transferRequest.quantity} × {transferRequest.product?.name} ·{" "}
//               {transferRequest.variant?.name}
//             </p>
//             <div className="mt-5">
//               {eligibleSourceStores.length ? (
//                 <ChoiceCards
//                   label="Choose a source store"
//                   value={sourceStoreId}
//                   onChange={setSourceStoreId}
//                   columns={2}
//                   options={eligibleSourceStores.map((store) => ({
//                     value: store.id,
//                     label: store.name,
//                     description:
//                       "Stock will be deducted from this branch when sent.",
//                   }))}
//                 />
//               ) : (
//                 <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">
//                   You don’t have access to another source store for this
//                   transfer.
//                 </p>
//               )}
//             </div>
//             <p className="mt-3 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] leading-5 text-slate-400">
//               Sending reduces source stock and marks the shipment in transit.
//               The receiving store adds it to stock after confirming arrival.
//             </p>
//             <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
//               <button
//                 type="button"
//                 onClick={() => setTransferRequest(null)}
//                 className="w-full rounded-xl px-4 py-3 text-sm font-bold text-slate-400 hover:bg-slate-900 sm:w-auto sm:py-2.5"
//               >
//                 Cancel
//               </button>
//               <button
//                 disabled={!sourceStoreId || isCreatingTransfer}
//                 className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50 sm:w-auto sm:py-2.5"
//               >
//                 {isCreatingTransfer ? "Sending…" : "Send stock"}
//               </button>
//             </div>
//           </form>
//         </div>
//       )}
//     </main>
//   );
// }
