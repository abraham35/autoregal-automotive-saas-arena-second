import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar, { type ViewKey } from "./components/sidebar";
import Topbar from "./components/Topbar";
import AssetModal from "./components/AssetModal";
import VehicleDrawer from "./components/VehicleDrawer";
import Dashboard from "./views/Dashboard";
import Fleet from "./views/Fleet";
import BaysView from "./views/Bays";
import Reservations from "./views/Reservations";
import Analytics from "./views/Analytics";
import WorkOrders from "./views/WorkOrders";
import CustomersView from "./views/Customers";
import Inventory from "./views/Inventory";
import Scheduler from "./views/Scheduler";
import Automations from "./views/Automations";
import AIStudio from "./views/AIStudio";
import { Toast } from "./components/ui";
import { useShop } from "./hooks/useShop";
import { TECHS, money, uid, woTotal, type LineItem, type WorkOrder } from "./lib/shop";
import {
  BAYS,
  REQUESTS,
  VEHICLES,
  type Bay,
  type ConciergeRequest,
  type Vehicle,
} from "./lib/data";

const META: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Facility Overview",
    subtitle: "Real-time shop operations · Mayfair Works",
  },
  workorders: {
    title: "Repair Orders",
    subtitle: "Estimates, labour, parts and invoicing in one ledger",
  },
  appointments: {
    title: "Scheduler",
    subtitle: "Bay reservations, technician rota and automated reminders",
  },
  bays: {
    title: "Service Bays",
    subtitle: "Live floor positions, climate envelopes and technician assignment",
  },
  customers: {
    title: "Clients",
    subtitle: "Contact records, vehicles owned and complete service history",
  },
  inventory: {
    title: "Parts Inventory",
    subtitle: "Stock levels, supplier terms and predictive replenishment",
  },
  ai: {
    title: "AI Copilot",
    subtitle: "Diagnostics, intake triage, correspondence and inspection translation",
  },
  automations: {
    title: "Automations",
    subtitle: "No-code rules that handle the repetitive work unattended",
  },
  fleet: {
    title: "Fleet Register",
    subtitle: "Complete custody register across bays, studios and vaults",
  },
  reservations: {
    title: "Concierge",
    subtitle: "Client pipeline, service windows and escalation control",
  },
  analytics: {
    title: "Analytics",
    subtitle: "Yield, utilisation and custody performance intelligence",
  },
};

export default function App() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [query, setQuery] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>(VEHICLES);
  const [bays, setBays] = useState<Bay[]>(BAYS);
  const [requests, setRequests] = useState<ConciergeRequest[]>(REQUESTS);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [composeTarget, setComposeTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; on: boolean }>({ msg: "", on: false });
  const toastTimer = useRef<number | null>(null);

  const shop = useShop();

  const notify = useCallback((msg: string) => {
    setToast({ msg, on: true });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast((t) => ({ ...t, on: false })), 2800);
  }, []);

  /* Live floor simulation — nudges active bays forward. */
  useEffect(() => {
    const t = window.setInterval(() => {
      setBays((prev) =>
        prev.map((b) =>
          b.occupant && b.remaining !== "Blocked" && b.progress < 99
            ? { ...b, progress: Math.min(99, b.progress + 1) }
            : b,
        ),
      );
    }, 7000);
    return () => window.clearInterval(t);
  }, []);

  const openVehicle = useCallback((v: Vehicle) => setSelected(v), []);

  const handleQuery = useCallback(
    (q: string) => {
      setQuery(q);
      const searchable: ViewKey[] = [
        "fleet",
        "workorders",
        "customers",
        "inventory",
        "appointments",
        "reservations",
      ];
      if (q.trim() && !searchable.includes(view)) setView("workorders");
    },
    [view],
  );

  /* --------------------------- Fleet actions -------------------------- */

  const advanceVehicle = useCallback(
    (id: string) => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id !== id) return v;
          const progress = Math.min(100, v.progress + 15);
          return {
            ...v,
            progress,
            status: progress >= 100 && v.status !== "Reserved" ? "Ready" : v.status,
            eta: progress >= 100 ? "Ready for collection" : v.eta,
          };
        }),
      );
      setSelected((s) =>
        s && s.id === id
          ? {
              ...s,
              progress: Math.min(100, s.progress + 15),
              status:
                Math.min(100, s.progress + 15) >= 100 && s.status !== "Reserved"
                  ? "Ready"
                  : s.status,
            }
          : s,
      );
      notify(`Work order #${id} advanced to next stage`);
    },
    [notify],
  );

  const advanceBay = useCallback(
    (bayId: string) => {
      let assetId: string | null = null;
      setBays((prev) =>
        prev.map((b) => {
          if (b.id !== bayId) return b;
          assetId = b.assetId;
          const progress = Math.min(100, b.progress + 12);
          return {
            ...b,
            progress,
            remaining: progress >= 100 ? "Complete" : b.remaining,
            phase: progress >= 100 ? "Awaiting collection" : b.phase,
          };
        }),
      );
      if (assetId) {
        setVehicles((prev) =>
          prev.map((v) =>
            v.id === assetId ? { ...v, progress: Math.min(100, v.progress + 12) } : v,
          ),
        );
      }
      notify(`${bays.find((b) => b.id === bayId)?.name ?? "Bay"} progressed`);
    },
    [bays, notify],
  );

  const advanceRequest = useCallback(
    (id: string) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status:
                  r.status === "Scheduled" || r.status === "Escalated"
                    ? "In Progress"
                    : "Complete",
              }
            : r,
        ),
      );
      notify(`Reservation ${id} moved forward`);
    },
    [notify],
  );

  const escalateRequest = useCallback(
    (id: string) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: r.status === "Escalated" ? "In Progress" : "Escalated" }
            : r,
        ),
      );
      notify(`Reservation ${id} priority updated`);
    },
    [notify],
  );

  const createVehicle = useCallback(
    (v: Vehicle) => {
      setVehicles((prev) => [v, ...prev]);
      setModalOpen(false);
      setView("fleet");
      notify(`${v.marque} ${v.model} registered as #${v.id}`);
    },
    [notify],
  );

  /* -------------------------- Copilot bridges ------------------------- */

  const createOrderFromAI = useCallback(
    (customerId: string, concern: string, items: LineItem[]) => {
      const cust = shop.customers.items.find((c) => c.id === customerId);
      const order: WorkOrder = {
        id: uid("WO"),
        customerId,
        vehicle: cust?.vehicle ?? "",
        plate: cust?.plate ?? "",
        concern,
        status: "Awaiting Approval",
        priority: "Priority",
        techId: TECHS[0].id,
        bay: "Bay 03",
        opened: new Date().toISOString().slice(0, 10),
        promised: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
        mileage: 0,
        items,
        notes: "Drafted by AutoRegal Copilot — review before sending to the client.",
        approved: false,
      };
      shop.saveWorkOrder(order, true);
      setView("workorders");
      notify(`${order.id} created · ${money(woTotal(order))} estimate ready to send`);
    },
    [shop, notify],
  );

  const openComposer = useCallback((customerId: string) => {
    setComposeTarget(customerId);
    setView("ai");
    // reset so the same client can be re-selected later
    window.setTimeout(() => setComposeTarget(null), 400);
  }, []);

  const meta = META[view];
  const hoursSaved = shop.minutesSaved / 60;

  const body = useMemo(() => {
    switch (view) {
      case "workorders":
        return (
          <WorkOrders
            orders={shop.workOrders.items}
            customers={shop.customers.items}
            query={query}
            onSave={shop.saveWorkOrder}
            onDelete={shop.workOrders.remove}
            notify={notify}
          />
        );
      case "appointments":
        return (
          <Scheduler
            appointments={shop.appointments.items}
            customers={shop.customers.items}
            query={query}
            onCreate={shop.appointments.create}
            onUpdate={shop.appointments.update}
            onDelete={shop.appointments.remove}
            onRemind={(a) =>
              shop.fireTrigger("appt.tomorrow", {
                first: shop.customers.items.find((c) => c.id === a.customerId)?.name.split(" ")[0] ?? "there",
                vehicle: a.vehicle,
                time: a.time,
              })
            }
            notify={notify}
          />
        );
      case "customers":
        return (
          <CustomersView
            customers={shop.customers.items}
            orders={shop.workOrders.items}
            query={query}
            onCreate={shop.customers.create}
            onUpdate={shop.customers.update}
            onDelete={shop.customers.remove}
            onCompose={openComposer}
            notify={notify}
          />
        );
      case "inventory":
        return (
          <Inventory
            parts={shop.parts.items}
            query={query}
            onCreate={shop.parts.create}
            onUpdate={shop.parts.update}
            onDelete={shop.parts.remove}
            notify={notify}
          />
        );
      case "automations":
        return (
          <Automations
            rules={shop.rules.items}
            logs={shop.logs}
            minutesSaved={shop.minutesSaved}
            automationRuns={shop.automationRuns}
            onCreate={shop.rules.create}
            onUpdate={shop.rules.update}
            onDelete={shop.rules.remove}
            onTest={(r) =>
              shop.fireTrigger(r.trigger, {
                first: "Kemi",
                customer: "Kemi Adeyemi",
                vehicle: "2025 Porsche 911 GT3 RS",
                total: "$4,312.60",
                wo: "WO-2401",
                promised: "19 Mar",
                time: "10:30",
                part: "carbon-ceramic rotor",
                supplier: "Stuttgart Direct",
                qty: "4",
              })
            }
            notify={notify}
          />
        );
      case "ai":
        return (
          <AIStudio
            customers={shop.customers.items}
            orders={shop.workOrders.items}
            inspections={shop.inspections.items}
            composeTarget={composeTarget}
            onCreateOrder={createOrderFromAI}
            notify={notify}
          />
        );
      case "fleet":
        return (
          <Fleet vehicles={vehicles} query={query} onQuery={setQuery} onSelect={openVehicle} />
        );
      case "bays":
        return (
          <BaysView bays={bays} vehicles={vehicles} onAdvance={advanceBay} onSelect={openVehicle} />
        );
      case "reservations":
        return (
          <Reservations
            requests={requests}
            vehicles={vehicles}
            query={query}
            onAdvance={advanceRequest}
            onEscalate={escalateRequest}
            onSelect={openVehicle}
          />
        );
      case "analytics":
        return <Analytics vehicles={vehicles} />;
      default:
        return (
          <Dashboard
            vehicles={vehicles}
            requests={requests}
            bays={bays}
            orders={shop.workOrders.items}
            parts={shop.parts.items}
            appointments={shop.appointments.items}
            logs={shop.logs}
            hoursSaved={hoursSaved}
            onSelect={openVehicle}
            onNavigate={(v) => setView(v)}
          />
        );
    }
  }, [
    view,
    shop,
    query,
    vehicles,
    bays,
    requests,
    composeTarget,
    hoursSaved,
    notify,
    openVehicle,
    advanceBay,
    advanceRequest,
    escalateRequest,
    createOrderFromAI,
    openComposer,
  ]);

  return (
    <div className="relative flex min-h-screen bg-ink text-mist">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/3 h-[420px] w-[520px] rounded-full bg-gold/6 blur-[130px]" />
        <div className="absolute right-0 bottom-0 h-[380px] w-[380px] rounded-full bg-emerald-500/5 blur-[130px]" />
        <div className="grain absolute inset-0 opacity-40" />
      </div>

      <Sidebar
        view={view}
        onSelect={setView}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        hoursSaved={hoursSaved}
        counts={{
          workorders: String(
            shop.workOrders.items.filter((o) => !["Invoiced", "Ready"].includes(o.status)).length,
          ),
          appointments: String(shop.appointments.items.length),
          bays: `${bays.filter((b) => b.occupant).length}/${bays.length}`,
          customers: String(shop.customers.items.length),
          inventory: String(shop.parts.items.filter((p) => p.qty <= p.reorderPoint).length || ""),
          fleet: String(vehicles.length),
          reservations: String(requests.filter((r) => r.status !== "Complete").length),
          automations: String(shop.rules.items.filter((r) => r.enabled).length),
        }}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          query={query}
          onQuery={handleQuery}
          onRegister={() => setModalOpen(true)}
          onMenu={() => setNavOpen(true)}
        />

        <main key={view} className="animate-fade-in flex-1 px-5 py-6 lg:px-9 lg:py-8">
          {body}
        </main>

        <footer className="border-t border-gold/10 px-5 py-5 lg:px-9">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] tracking-[0.14em] text-muted uppercase">
            <span className="text-gold">AutoRegal · Shop OS</span>
            <span>Mayfair Works · London</span>
            <span className="ml-auto">
              {shop.automationRuns.toLocaleString()} tasks automated · v5.0
            </span>
          </div>
        </footer>
      </div>

      <VehicleDrawer
        vehicle={selected}
        onClose={() => setSelected(null)}
        onAdvance={advanceVehicle}
      />
      <AssetModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={createVehicle} />
      <Toast message={toast.msg} visible={toast.on} />
    </div>
  );
}
