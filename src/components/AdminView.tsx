import { FormEvent, useState } from "react";
import { Bell, BellOff, Building2, Check, ChevronLeft, ChevronRight, ClipboardCopy, CreditCard, Eye, EyeOff, Key, Plus, RefreshCw, Settings2, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { useGetTenantProfileQuery, useUpdateTenantProfileMutation, useGetStoreSettingsQuery, useUpsertStoreSettingMutation, useDeleteStoreSettingMutation, useGetApiKeysQuery, useCreateApiKeyMutation, useRevokeApiKeyMutation, useGetSubscriptionQuery, useGetNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation, useDeleteNotificationMutation, useGetStaffQuery } from "../store/apiSlice";

type Module = "profile" | "users" | "store-settings" | "api-keys" | "subscription" | "notifications";
const modules: { id: Module; label: string; caption: string; icon: typeof Settings2 }[] = [
  { id: "profile", label: "Business profile", caption: "Org name, email, phone", icon: Building2 },
  { id: "users", label: "Staff & users", caption: "User roles & access", icon: Users },
  { id: "store-settings", label: "Store settings", caption: "Per-store config keys", icon: Settings2 },
  { id: "api-keys", label: "API keys", caption: "Integrations & tokens", icon: Key },
  { id: "subscription", label: "Subscription", caption: "Plan & billing history", icon: CreditCard },
  { id: "notifications", label: "Notifications", caption: "Inbox & alerts", icon: Bell },
];
const inputCls = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-400";
const btnPrimary = "inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-300 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-sky-500 hover:text-white";
const errMsg = (e: unknown) => { const v = e as { data?: { message?: string }; message?: string }; return v?.data?.message || v?.message || "Operation failed."; };

function ProfilePanel() {
  const { data: profile, isFetching, refetch } = useGetTenantProfileQuery();
  const [update, { isLoading }] = useUpdateTenantProfileMutation();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const startEdit = () => { setFields({ name: profile?.name ?? "", email: profile?.email ?? "", phone: profile?.phone ?? "" }); setEditing(true); setErr(""); setOk(""); };
  const save = async (e: FormEvent) => { e.preventDefault(); try { await update({ name: fields.name, email: fields.email, phone: fields.phone }).unwrap(); setOk("Profile updated."); setEditing(false); } catch (cause) { setErr(errMsg(cause)); } };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Business profile</h2>
        <div className="flex gap-2"><button onClick={() => void refetch()} className={btnGhost}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></button>{!editing && <button onClick={startEdit} className={btnPrimary}>Edit profile</button>}</div>
      </div>
      {ok && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{ok}</p>}
      {editing ? (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          {err && <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{err}</p>}
          <label className="block text-xs text-slate-400">Organization name<input required className={`${inputCls} mt-1.5`} value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} /></label>
          <label className="block text-xs text-slate-400">Email<input type="email" className={`${inputCls} mt-1.5`} value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} /></label>
          <label className="block text-xs text-slate-400">Phone<input className={`${inputCls} mt-1.5`} value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} /></label>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setEditing(false)} className={btnGhost}>Cancel</button><button disabled={isLoading} className={btnPrimary}>{isLoading ? "Saving…" : "Save changes"}</button></div>
        </form>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[{ label: "Organization name", value: profile?.name }, { label: "Tenant code", value: profile?.code }, { label: "Email", value: profile?.email }, { label: "Phone", value: profile?.phone || "—" }, { label: "Status", value: profile?.isActive ? "Active" : "Inactive" }, { label: "Created", value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—" }].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-100">{value ?? "—"}</p></div>
          ))}
        </div>
      )}
      {profile?.subscription && (<div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-300">Current plan</p><p className="mt-1 text-sm font-semibold text-white">{profile.subscription.plan?.name ?? "—"}</p><p className="mt-0.5 text-xs text-slate-400">Expires: {profile.subscription.expiresAt ? new Date(profile.subscription.expiresAt).toLocaleDateString() : "Ongoing"}</p></div>)}
    </div>
  );
}

function UsersPanel() {
  const { data: staffList = [], isFetching, refetch } = useGetStaffQuery({});
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Tenant users & staff</h2>
          <p className="text-xs text-slate-400">View team members and role access across branches.</p>
        </div>
        <button onClick={() => void refetch()} className={btnGhost}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        {staffList.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 font-semibold text-slate-200">No staff members listed</p>
            <p className="mt-1 text-xs text-slate-500">Staff and managers assigned to your workspace will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {staffList.map((user: any) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/30">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-100">{user.name || user.email}</p>
                    <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                      {user.role || "CASHIER"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{user.email || user.phone || "—"}</p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <p>Store: {user.store?.name || "All stores"}</p>
                  <p>Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StoreSettingsPanel({ stores }: { stores: { id: string; name: string }[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const { data: settings = [], isFetching, refetch } = useGetStoreSettingsQuery({ storeId });
  const [upsert, { isLoading: upserting }] = useUpsertStoreSettingMutation();
  const [del] = useDeleteStoreSettingMutation();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ settingKey: "", settingValue: "", description: "" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const save = async (e: FormEvent) => { e.preventDefault(); setErr(""); try { await upsert({ storeId, settingKey: form.settingKey.trim(), settingValue: form.settingValue.trim(), description: form.description || undefined }).unwrap(); setOk("Setting saved."); setDialog(false); } catch (cause) { setErr(errMsg(cause)); } };
  const remove = async (id: string) => { if (!confirm("Delete this configuration key?")) return; try { await del(id).unwrap(); setOk("Setting removed."); } catch (cause) { setErr(errMsg(cause)); } };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Store settings</h2>
        <div className="flex gap-2">
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button onClick={() => void refetch()} className={btnGhost}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></button>
          <button onClick={() => { setForm({ settingKey: "", settingValue: "", description: "" }); setDialog(true); setErr(""); }} className={btnPrimary}><Plus className="h-4 w-4" />Add key</button>
        </div>
      </div>
      {ok && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{ok}</p>}
      {err && <p className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">{err}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        {settings.length === 0 ? (<div className="p-12 text-center"><Settings2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-semibold text-slate-200">No settings configured</p><p className="mt-1 text-xs text-slate-500">Add custom configuration keys for this store.</p></div>) : (
          <div className="divide-y divide-slate-800">{settings.map((s: any) => (<div key={s.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/30"><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-bold text-sky-300">{s.settingKey}</p><p className="mt-0.5 truncate text-sm text-slate-200">{String(s.settingValue ?? "")}</p>{s.description && <p className="mt-0.5 truncate text-xs text-slate-500">{s.description}</p>}</div><div className="text-right text-[10px] text-slate-500"><p>{s.store?.name}</p><p>{s.updatedBy?.name}</p></div><button onClick={() => void remove(s.id)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>))}</div>
        )}
      </div>
      {dialog && (<div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={save} className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#101a2b] p-6 shadow-2xl space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">Add / update setting</h3><button type="button" onClick={() => setDialog(false)} className="rounded-lg px-2 py-1 text-slate-500 hover:text-white">✕</button></div>{err && <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{err}</p>}<label className="block text-xs text-slate-400">Setting key<input required className={`${inputCls} mt-1.5 font-mono`} value={form.settingKey} onChange={(e) => setForm({ ...form, settingKey: e.target.value })} placeholder="e.g. receipt_footer" /></label><label className="block text-xs text-slate-400">Value<input required className={`${inputCls} mt-1.5`} value={form.settingValue} onChange={(e) => setForm({ ...form, settingValue: e.target.value })} /></label><label className="block text-xs text-slate-400">Description (optional)<input className={`${inputCls} mt-1.5`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setDialog(false)} className={btnGhost}>Cancel</button><button disabled={upserting} className={btnPrimary}>{upserting ? "Saving…" : "Save"}</button></div></form></div>)}
    </div>
  );
}

function ApiKeysPanel({ currentUserId }: { currentUserId?: string }) {
  const { data: keys = [], isFetching, refetch } = useGetApiKeysQuery();
  const [create, { isLoading: creating }] = useCreateApiKeyMutation();
  const [revoke] = useRevokeApiKeyMutation();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ name: "", expiresAt: "" });
  const [permissions, setPermissions] = useState<string[]>(["READ"]);
  const [newSecret, setNewSecret] = useState<{ key: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const permList = ["READ", "WRITE", "DELETE", "ADMIN"];
  const togglePerm = (p: string) => setPermissions((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!currentUserId) { setErr("Could not determine current user. Re-login and try again."); return; }
    try { const result = await create({ userId: currentUserId, name: form.name.trim(), permissions, expiresAt: form.expiresAt || undefined }).unwrap(); const apiKey = result?.apiKey ?? result; setNewSecret({ key: apiKey.key, secret: apiKey.secret }); setDialog(false); setOk("API key created. Copy your secret now — it will not be shown again."); }
    catch (cause) { setErr(errMsg(cause)); }
  };
  const copy = (text: string, label: string) => { void navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(""), 2000); };
  const doRevoke = async (id: string, name: string) => { if (!confirm(`Revoke API key "${name}"? This cannot be undone.`)) return; try { await revoke(id).unwrap(); setOk("API key revoked."); } catch (cause) { setErr(errMsg(cause)); } };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">API keys</h2>
        <div className="flex gap-2"><button onClick={() => void refetch()} className={btnGhost}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></button><button onClick={() => { setForm({ name: "", expiresAt: "" }); setPermissions(["READ"]); setErr(""); setDialog(true); }} className={btnPrimary}><Plus className="h-4 w-4" />New key</button></div>
      </div>
      {ok && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{ok}</p>}
      {err && <p className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">{err}</p>}
      {newSecret && (<div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 space-y-3"><p className="text-xs font-bold uppercase tracking-wider text-amber-300">⚠ Copy your secret — shown once only</p>{[{ label: "Public key", value: newSecret.key }, { label: "Secret", value: newSecret.secret }].map(({ label, value }) => (<div key={label}><p className="text-[10px] text-slate-500 mb-1">{label}</p><div className="flex items-center gap-2"><code className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 break-all">{showSecret || label === "Public key" ? value : "•".repeat(24)}</code>{label === "Secret" && <button onClick={() => setShowSecret((v) => !v)} className="rounded-lg p-2 text-slate-400 hover:text-white">{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}<button onClick={() => copy(value, label)} className="rounded-lg p-2 text-slate-400 hover:text-sky-300">{copied === label ? <Check className="h-4 w-4 text-emerald-400" /> : <ClipboardCopy className="h-4 w-4" />}</button></div></div>))}<button onClick={() => setNewSecret(null)} className="text-xs text-slate-500 hover:text-white">Dismiss</button></div>)}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        {keys.length === 0 ? (<div className="p-12 text-center"><Key className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-semibold text-slate-200">No API keys yet</p><p className="mt-1 text-xs text-slate-500">Create an API key to connect external integrations.</p></div>) : (
          <div className="divide-y divide-slate-800">{keys.map((k: any) => (<div key={k.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/30"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-100">{k.name}</p><p className="mt-0.5 font-mono text-xs text-slate-400">{k.key}</p><div className="mt-1.5 flex flex-wrap gap-1">{(k.permissions ?? []).map((p: string) => <span key={p} className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">{p}</span>)}</div></div><div className="text-right text-[10px] text-slate-500">{k.lastUsedAt && <p>Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</p>}{k.expiresAt && <p>Expires: {new Date(k.expiresAt).toLocaleDateString()}</p>}<p>{k.user?.name}</p></div><button onClick={() => void doRevoke(k.id, k.name)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><X className="h-4 w-4" /></button></div>))}</div>
        )}
      </div>
      {dialog && (<div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={save} className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#101a2b] p-6 shadow-2xl space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">Create API key</h3><button type="button" onClick={() => setDialog(false)} className="rounded-lg px-2 py-1 text-slate-500 hover:text-white">✕</button></div>{err && <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{err}</p>}<label className="block text-xs text-slate-400">Key name<input required className={`${inputCls} mt-1.5`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shopify integration" /></label><label className="block text-xs text-slate-400">Expires (optional)<input type="date" className={`${inputCls} mt-1.5`} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label><div><p className="mb-2 text-xs text-slate-400">Permissions</p><div className="flex flex-wrap gap-2">{permList.map((p) => <button key={p} type="button" onClick={() => togglePerm(p)} className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${permissions.includes(p) ? "bg-sky-400/20 text-sky-200 ring-1 ring-sky-300/30" : "bg-slate-800 text-slate-400 hover:text-white"}`}>{p}</button>)}</div></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setDialog(false)} className={btnGhost}>Cancel</button><button disabled={creating} className={btnPrimary}>{creating ? "Creating…" : "Create key"}</button></div></form></div>)}
    </div>
  );
}

function SubscriptionPanel() {
  const { data, isFetching, refetch } = useGetSubscriptionQuery();
  const [reqDialog, setReqDialog] = useState(false);
  const [form, setForm] = useState({ planId: "", billingCycle: "MONTHLY", paymentMethod: "KBZ_PAY", paymentReference: "" });
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const subscription = data?.subscription; const plans: any[] = data?.plans ?? []; const payments: any[] = data?.payments ?? []; const requests: any[] = data?.requests ?? [];
  const statusColor: Record<string, string> = { ACTIVE: "bg-emerald-400/10 text-emerald-300", EXPIRED: "bg-rose-400/10 text-rose-300", TRIAL: "bg-amber-400/10 text-amber-300", INACTIVE: "bg-slate-700 text-slate-400" };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Subscription & billing</h2>
        <div className="flex gap-2"><button onClick={() => void refetch()} className={btnGhost}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></button><button onClick={() => { setForm({ planId: plans[0]?.id ?? "", billingCycle: "MONTHLY", paymentMethod: "KBZ_PAY", paymentReference: "" }); setErr(""); setReqDialog(true); }} className={btnPrimary}><CreditCard className="h-4 w-4" />Request upgrade</button></div>
      </div>
      {ok && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{ok}</p>}
      {err && <p className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">{err}</p>}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current plan</p><div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-2xl font-black text-white">{subscription?.plan?.name ?? "Free"}</p>{subscription?.status && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusColor[subscription.status] ?? "bg-slate-700 text-slate-400"}`}>{subscription.status}</span>}</div>{subscription?.expiresAt && <p className="mt-2 text-xs text-slate-400">Expires: {new Date(subscription.expiresAt).toLocaleDateString()}</p>}</div>
      {plans.length > 0 && (<div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Available plans</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{plans.map((plan: any) => (<div key={plan.id} className={`rounded-2xl border p-4 ${subscription?.planId === plan.id ? "border-sky-300/40 bg-sky-300/5" : "border-slate-800 bg-slate-900/50"}`}><p className="font-bold text-white">{plan.name}</p><p className="mt-1 text-xs text-slate-400">{plan.description}</p><p className="mt-3 text-lg font-black text-sky-300">{Number(plan.priceMonthly).toLocaleString()} <span className="text-xs font-normal text-slate-500">{plan.currencyCode}/mo</span></p></div>))}</div></div>)}
      {requests.length > 0 && (<div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Pending requests</p><div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">{requests.map((r: any) => (<div key={r.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-sm font-semibold text-slate-100">{r.plan?.name}</p><p className="text-xs text-slate-500">{r.billingCycle} · {r.paymentMethod} · Ref: {r.paymentReference}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${r.status === "PENDING" ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"}`}>{r.status}</span></div>))}</div></div>)}
      {payments.length > 0 && (<div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Payment history</p><div className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">{payments.map((p: any) => (<div key={p.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-sm font-semibold text-slate-100">{Number(p.amount).toLocaleString()} {p.currencyCode}</p><p className="text-xs text-slate-500">{p.paymentMethod} · {new Date(p.paidAt).toLocaleDateString()}</p></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">{p.status}</span></div>))}</div></div>)}
      {data?.paymentInstructions && <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300 whitespace-pre-wrap">{data.paymentInstructions}</div>}
      {reqDialog && (<div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#101a2b] p-6 shadow-2xl space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">Request subscription</h3><button onClick={() => setReqDialog(false)} className="rounded-lg px-2 py-1 text-slate-500 hover:text-white">✕</button></div>{err && <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{err}</p>}<label className="block text-xs text-slate-400">Plan<select className={`${inputCls} mt-1.5`} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>{plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="block text-xs text-slate-400">Billing cycle<select className={`${inputCls} mt-1.5`} value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label><label className="block text-xs text-slate-400">Payment method<select className={`${inputCls} mt-1.5`} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{["KBZ_PAY", "WAVE_PAY", "CB_PAY", "BANK_TRANSFER"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</select></label><label className="block text-xs text-slate-400">Payment reference<input required className={`${inputCls} mt-1.5`} value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} placeholder="e.g. TXN-123456" /></label><div className="flex justify-end gap-2 pt-2"><button onClick={() => setReqDialog(false)} className={btnGhost}>Cancel</button><button className={btnPrimary} onClick={async () => { setErr(""); if (!form.planId) { setErr("Select a plan."); return; } if (!form.paymentReference.trim()) { setErr("Enter a payment reference."); return; } try { const base = (import.meta.env.VITE_API_URL || "https://pos.oasislab.de5.net").replace(/\/api$/, ""); const resp = await fetch(`${base}/api/tenant/subscription/requests`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("kanitt_token")}` }, body: JSON.stringify({ planId: form.planId, billingCycle: form.billingCycle, paymentMethod: form.paymentMethod, paymentReference: form.paymentReference.trim() }) }); if (!resp.ok) { const j = await resp.json().catch(() => ({})); throw new Error((j as any)?.message ?? "Request failed."); } setOk("Subscription request submitted."); setReqDialog(false); } catch (cause) { setErr(errMsg(cause)); } }}>Submit request</button></div></div></div>)}
    </div>
  );
}

function NotificationsPanel() {
  const [page, setPage] = useState(1);
  const [filterRead, setFilterRead] = useState<string | undefined>(undefined);
  const { data, isFetching, refetch } = useGetNotificationsQuery({ page, isRead: filterRead });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();
  const [del] = useDeleteNotificationMutation();
  const [err, setErr] = useState("");
  const notifications = data?.notifications ?? []; const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };
  const typeColor: Record<string, string> = { INFO: "bg-sky-400/10 text-sky-300", WARNING: "bg-amber-400/10 text-amber-300", ERROR: "bg-rose-400/10 text-rose-300", SUCCESS: "bg-emerald-400/10 text-emerald-300" };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Notifications</h2>
        <div className="flex flex-wrap gap-2">
          <select value={filterRead ?? ""} onChange={(e) => { setFilterRead(e.target.value || undefined); setPage(1); }} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="">All</option><option value="false">Unread</option><option value="true">Read</option></select>
          <button onClick={() => void refetch()} className={btnGhost}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></button>
          <button onClick={async () => { try { await markAll().unwrap(); void refetch(); } catch (e) { setErr(errMsg(e)); } }} className={btnGhost}><BellOff className="h-4 w-4" />Mark all read</button>
        </div>
      </div>
      {err && <p className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">{err}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        {notifications.length === 0 ? (<div className="p-12 text-center"><Bell className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-semibold text-slate-200">No notifications</p><p className="mt-1 text-xs text-slate-500">System and manager notifications appear here.</p></div>) : (
          <div className="divide-y divide-slate-800">{notifications.map((n: any) => (<div key={n.id} className={`flex items-start gap-4 px-5 py-4 transition hover:bg-slate-800/30 ${!n.isRead ? "bg-sky-400/[0.03]" : ""}`}><div className="mt-0.5 shrink-0"><span className={`inline-block h-2 w-2 rounded-full ${!n.isRead ? "bg-sky-400" : "bg-slate-700"}`} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-100">{n.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeColor[n.type] ?? "bg-slate-700 text-slate-400"}`}>{n.type}</span></div><p className="mt-1 text-sm text-slate-400">{n.message}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleString()}</p></div><div className="flex shrink-0 gap-1">{!n.isRead && <button onClick={async () => { try { await markRead(n.id).unwrap(); } catch (e) { setErr(errMsg(e)); } }} className="rounded-lg p-2 text-slate-500 hover:text-emerald-300" title="Mark read"><Check className="h-4 w-4" /></button>}<button onClick={async () => { try { await del(n.id).unwrap(); } catch (e) { setErr(errMsg(e)); } }} className="rounded-lg p-2 text-slate-500 hover:text-rose-300" title="Delete"><Trash2 className="h-4 w-4" /></button></div></div>))}</div>
        )}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3"><p className="text-xs text-slate-500">{meta.total} total · page {meta.page} of {Math.max(1, meta.totalPages)}</p><div className="flex gap-2"><button disabled={page <= 1 || isFetching} onClick={() => setPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button disabled={page >= (meta.totalPages ?? 1) || isFetching} onClick={() => setPage((v) => v + 1)} className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
      </div>
    </div>
  );
}

interface AdminViewProps { stores: { id: string; name: string }[]; currentUserId?: string; }
export function AdminView({ stores, currentUserId }: AdminViewProps) {
  const [module, setModule] = useState<Module>("profile");
  return (
    <main className="flex-1 overflow-y-auto bg-[#0b1220] p-5 text-slate-100 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-violet-300">System administration</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Admin workspace</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Manage your business profile, store configuration, API integrations, subscription plan, and notification inbox.</p>
        </header>
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {modules.map(({ id, label, caption, icon: Icon }) => (
            <button key={id} onClick={() => setModule(id)} className={`rounded-2xl border p-3.5 text-left transition ${module === id ? "border-violet-300/40 bg-violet-300/10 shadow-lg shadow-violet-950/30" : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"}`}>
              <div className="flex items-center justify-between"><Icon className={`h-4 w-4 ${module === id ? "text-violet-200" : "text-slate-500"}`} />{module === id && <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />}</div>
              <p className="mt-3 text-xs font-bold text-slate-100">{label}</p>
              <p className="mt-1 text-[10px] text-slate-500">{caption}</p>
            </button>
          ))}
        </nav>
        <div className="flex items-start gap-3 rounded-2xl border border-violet-400/10 bg-violet-400/[0.03] px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <p className="text-xs leading-5 text-slate-400">Admin actions are audit-logged server-side. Restricted operations require ADMIN or MANAGER role. API key secrets are shown once and stored hashed.</p>
        </div>
        <section>
          {module === "profile" && <ProfilePanel />}
          {module === "users" && <UsersPanel />}
          {module === "store-settings" && <StoreSettingsPanel stores={stores} />}
          {module === "api-keys" && <ApiKeysPanel currentUserId={currentUserId} />}
          {module === "subscription" && <SubscriptionPanel />}
          {module === "notifications" && <NotificationsPanel />}
        </section>
      </div>
    </main>
  );
}
