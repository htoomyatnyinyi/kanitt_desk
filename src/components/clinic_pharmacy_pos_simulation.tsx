import React, { useState, useEffect } from "react";
import {
  Users,
  Stethoscope,
  Pill,
  Store,
  ArrowRightLeft,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Activity,
  TrendingUp,
  Clock,
  Plus,
  Building2,
  Check,
  FileText,
  ShoppingBag,
  Info,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

// Initial Master Products with Multi-Unit Packaging (Box, Strip, Tablet/Capsule)
const INITIAL_PRODUCTS = [
  {
    id: "p1",
    name: "Biogesic 500mg",
    genericName: "Paracetamol",
    category: "Analgesic",
    baseUnit: "Tablet",
    units: [
      { unitName: "Box (100s)", conversionFactor: 100, price: 12000 },
      { unitName: "Strip (10s)", conversionFactor: 10, price: 1300 },
      { unitName: "Tablet", conversionFactor: 1, price: 150 },
    ],
    mainStoreStock: 2500, // in Base Units (Tablets)
    counterStock: 180, // in Base Units
    reorderLevelCounter: 50,
  },
  {
    id: "p2",
    name: "Amoxil 500mg",
    genericName: "Amoxicillin",
    category: "Antibiotic",
    baseUnit: "Capsule",
    units: [
      { unitName: "Box (100s)", conversionFactor: 100, price: 32000 },
      { unitName: "Strip (10s)", conversionFactor: 10, price: 3500 },
      { unitName: "Capsule", conversionFactor: 1, price: 400 },
    ],
    mainStoreStock: 1500,
    counterStock: 45,
    reorderLevelCounter: 60,
  },
  {
    id: "p3",
    name: "Cravit Ophthalmic 0.5%",
    genericName: "Levofloxacin Drops",
    category: "Eye Drops",
    baseUnit: "Bottle",
    units: [
      { unitName: "Box (10s)", conversionFactor: 10, price: 42000 },
      { unitName: "Bottle", conversionFactor: 1, price: 4500 },
    ],
    mainStoreStock: 80,
    counterStock: 12,
    reorderLevelCounter: 10,
  },
  {
    id: "p4",
    name: "Omeprazole 20mg",
    genericName: "Omeprazole",
    category: "Gastrointestinal",
    baseUnit: "Capsule",
    units: [
      { unitName: "Box (100s)", conversionFactor: 100, price: 18000 },
      { unitName: "Strip (10s)", conversionFactor: 10, price: 2000 },
      { unitName: "Capsule", conversionFactor: 1, price: 220 },
    ],
    mainStoreStock: 3000,
    counterStock: 220,
    reorderLevelCounter: 80,
  },
  {
    id: "p5",
    name: "Decolgen Forte",
    genericName: "Paracetamol + Phenylephrine",
    category: "Cold & Flu",
    baseUnit: "Tablet",
    units: [
      { unitName: "Box (100s)", conversionFactor: 100, price: 14000 },
      { unitName: "Strip (4s)", conversionFactor: 4, price: 650 },
      { unitName: "Tablet", conversionFactor: 1, price: 180 },
    ],
    mainStoreStock: 1200,
    counterStock: 30,
    reorderLevelCounter: 40,
  },
];

const INITIAL_PATIENTS = [
  {
    id: "PAT-101",
    name: "U Mya (ဦးမြ)",
    age: 52,
    gender: "Male",
    symptoms: "Fever & Joint Pain",
    status: "WAITING_DOCTOR",
    doctorNotes: "",
    prescription: [],
  },
  {
    id: "PAT-102",
    name: "Daw Nu (ဒေါ်နု)",
    age: 38,
    gender: "Female",
    symptoms: "Gastritis & Cold",
    status: "WAITING_DOCTOR",
    doctorNotes: "",
    prescription: [],
  },
  {
    id: "PAT-103",
    name: "Ko Tun (ကိုထွန်း)",
    age: 29,
    gender: "Male",
    symptoms: "Bacterial Cough",
    status: "WAITING_DOCTOR",
    doctorNotes: "",
    prescription: [],
  },
];

export default function AppClinic() {
  const [activeTab, setActiveTab] = useState("pipeline"); // 'pipeline' | 'inventory' | 'history'
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [completedSales, setCompletedSales] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [transferAmount, setTransferAmount] = useState({
    productId: "",
    qtyBoxes: 1,
  });
  const [customPatientName, setCustomPatientName] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");

  // Add system audit log entry
  const addLog = (message, type = "info") => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) =>
      [{ id: Date.now() + Math.random(), time, message, type }, ...prev].slice(
        0,
        30,
      ),
    );
  };

  useEffect(() => {
    addLog(
      "System initialized. Ready for Clinic & Pharmacy operations.",
      "success",
    );
  }, []);

  // Auto Simulation step generator
  useEffect(() => {
    let interval;
    if (isSimulating) {
      interval = setInterval(() => {
        // Find next step in workflow
        const waitingDoc = patients.find((p) => p.status === "WAITING_DOCTOR");
        const waitingPharma = patients.find(
          (p) => p.status === "WAITING_PHARMACY",
        );

        if (waitingDoc) {
          // Doctor consults patient
          handleDoctorConsult(waitingDoc.id);
        } else if (waitingPharma) {
          // Pharmacy dispenses medicine
          handlePharmacyFulfill(waitingPharma.id);
        } else {
          // Generate new patient automatically
          handleAddNewPatient();
        }
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isSimulating, patients, products]);

  // 1. Add New Patient at Reception
  const handleAddNewPatient = (e) => {
    if (e) e.preventDefault();
    const names = [
      "Ko Soe",
      "Ma Thida",
      "U Than Win",
      "Daw Khin",
      "Mg Aung",
      "Aung Kyaw",
    ];
    const symptomsList = [
      "High Fever",
      "Stomachache & Acidity",
      "Eye Inflammation",
      "Flu & Cough",
      "Body Pain",
    ];

    const newName =
      customPatientName.trim() ||
      names[Math.floor(Math.random() * names.length)];
    const newSymptom =
      customSymptom.trim() ||
      symptomsList[Math.floor(Math.random() * symptomsList.length)];

    const newPatient = {
      id: `PAT-${Math.floor(100 + Math.random() * 900)}`,
      name: newName,
      age: Math.floor(20 + Math.random() * 50),
      gender: Math.random() > 0.5 ? "Male" : "Female",
      symptoms: newSymptom,
      status: "WAITING_DOCTOR",
      doctorNotes: "",
      prescription: [],
    };

    setPatients((prev) => [...prev, newPatient]);
    addLog(
      `New Patient Registered: ${newPatient.name} (${newPatient.symptoms})`,
      "info",
    );
    setCustomPatientName("");
    setCustomSymptom("");
  };

  // 2. Doctor prescribes medications
  const handleDoctorConsult = (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;

    // Pick 1-2 random medications from product list
    const availableProds = [...products];
    const item1 =
      availableProds[Math.floor(Math.random() * availableProds.length)];
    const item2 =
      availableProds[Math.floor(Math.random() * availableProds.length)];

    const selectedProds = item1.id === item2.id ? [item1] : [item1, item2];

    const rxList = selectedProds.map((prod) => {
      // Pick random unit (e.g., Strip or Tablet)
      const selectedUnit =
        prod.units[Math.floor(Math.random() * (prod.units.length - 1)) + 1] ||
        prod.units[0];
      const qty = Math.floor(1 + Math.random() * 3);
      return {
        product: prod,
        unit: selectedUnit,
        quantity: qty,
        subtotal: selectedUnit.price * qty,
      };
    });

    const docNotes = `Diagnosed for ${patient.symptoms}. Recommended rest & prescribed regimen.`;

    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
              ...p,
              status: "WAITING_PHARMACY",
              doctorNotes: docNotes,
              prescription: rxList,
            }
          : p,
      ),
    );

    addLog(
      `Dr. Consulted ${patient.name} -> Prescribed ${rxList.length} items. Sent to Pharmacy.`,
      "doctor",
    );
  };

  // 3. Pharmacy Counter Fulfill & Auto Stock Deduction
  const handlePharmacyFulfill = (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient || patient.prescription.length === 0) return;

    // Verify stock availability in Counter
    let canFulfill = true;
    let failedItem = "";

    patient.prescription.forEach((rx) => {
      const currentProd = products.find((prod) => prod.id === rx.product.id);
      const neededBaseQty = rx.quantity * rx.unit.conversionFactor;

      if (!currentProd || currentProd.counterStock < neededBaseQty) {
        canFulfill = false;
        failedItem = `${rx.product.name} (Need: ${neededBaseQty} ${currentProd.baseUnit}, Available: ${currentProd ? currentProd.counterStock : 0})`;
      }
    });

    if (!canFulfill) {
      addLog(
        `❌ Stock Alert for ${patient.name}: Insufficient Counter Stock! [${failedItem}]`,
        "error",
      );
      setIsSimulating(false); // Pause simulation to alert user
      return;
    }

    // Deduct stock from Counter & calculate total
    let totalSaleAmount = 0;
    const updatedProducts = products.map((prod) => {
      const rxItem = patient.prescription.find(
        (rx) => rx.product.id === prod.id,
      );
      if (rxItem) {
        const baseQtyToDeduct = rxItem.quantity * rxItem.unit.conversionFactor;
        totalSaleAmount += rxItem.subtotal;
        return {
          ...prod,
          counterStock: prod.counterStock - baseQtyToDeduct,
        };
      }
      return prod;
    });

    setProducts(updatedProducts);

    // Save transaction
    const saleRecord = {
      saleId: `INV-${Date.now().toString().slice(-6)}`,
      patientName: patient.name,
      patientId: patient.id,
      items: patient.prescription,
      totalAmount: totalSaleAmount,
      timestamp: new Date().toLocaleTimeString(),
    };

    setCompletedSales((prev) => [saleRecord, ...prev]);

    // Update patient status to DISPENSED
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, status: "COMPLETED" } : p)),
    );

    addLog(
      `✅ Dispensed meds for ${patient.name}. Total: ${totalSaleAmount.toLocaleString()} Ks (Counter Stock Auto-Deducted).`,
      "success",
    );
  };

  // 4. Stock Transfer (Main Store -> Counter)
  const handleStockTransfer = (productId, boxesToTransfer) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    // 1 Box conversion to Base Unit
    const boxUnit =
      prod.units.find((u) => u.unitName.includes("Box")) || prod.units[0];
    const totalBaseQtyToTransfer = boxesToTransfer * boxUnit.conversionFactor;

    if (prod.mainStoreStock < totalBaseQtyToTransfer) {
      addLog(
        `⚠️ Transfer Failed! Main Store has only ${prod.mainStoreStock} ${prod.baseUnit}s available.`,
        "error",
      );
      return;
    }

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          return {
            ...p,
            mainStoreStock: p.mainStoreStock - totalBaseQtyToTransfer,
            counterStock: p.counterStock + totalBaseQtyToTransfer,
          };
        }
        return p;
      }),
    );

    addLog(
      `📦 Stock Transfer: ${boxesToTransfer} Box(es) [${totalBaseQtyToTransfer} ${prod.baseUnit}s] of ${prod.name} moved from Main Store -> Counter Counter.`,
      "warning",
    );
  };

  const totalRevenue = completedSales.reduce(
    (sum, s) => sum + s.totalAmount,
    0,
  );
  const patientsWaitingDoc = patients.filter(
    (p) => p.status === "WAITING_DOCTOR",
  ).length;
  const patientsWaitingPharma = patients.filter(
    (p) => p.status === "WAITING_PHARMACY",
  ).length;
  const patientsCompleted = patients.filter(
    (p) => p.status === "COMPLETED",
  ).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation / Header Bar */}
      {}
      <header className="bg-slate-800/80 border-b border-slate-700 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              Clinic & Pharmacy Workflow Simulator
            </h1>
            <p className="text-xs text-slate-400">
              Hospital Multi-Unit Stock Management & Real-Time POS Engine
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md ${
              isSimulating
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40"
            }`}
          >
            {isSimulating ? (
              <Pause className="w-4 h-4 animate-pulse" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isSimulating ? "Pause Auto Simulation" : "Run Auto Simulation"}
          </button>

          <button
            onClick={() => {
              setProducts(INITIAL_PRODUCTS);
              setPatients(INITIAL_PATIENTS);
              setCompletedSales([]);
              setLogs([]);
              addLog("Simulation reset to initial state.", "info");
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-sm transition"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
      </header>

      {/* Main KPI Stats Bar */}
      {}
      <div className="bg-slate-800/40 border-b border-slate-800 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Queue Status</div>
            <div className="text-sm font-bold text-slate-200">
              {patientsWaitingDoc}{" "}
              <span className="text-xs text-slate-400 font-normal">Doc</span> |{" "}
              {patientsWaitingPharma}{" "}
              <span className="text-xs text-slate-400 font-normal">Pharma</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Completed Patients</div>
            <div className="text-lg font-bold text-emerald-400">
              {patientsCompleted}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
          <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Pharmacy Sales</div>
            <div className="text-lg font-bold text-teal-300">
              {totalRevenue.toLocaleString()} Ks
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Low Stock Items</div>
            <div className="text-lg font-bold text-amber-400">
              {
                products.filter((p) => p.counterStock <= p.reorderLevelCounter)
                  .length
              }{" "}
              items
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      {}
      <div className="px-6 border-b border-slate-800 bg-slate-900/50 flex gap-2 pt-2">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-all ${
            activeTab === "pipeline"
              ? "border-teal-400 text-teal-300 bg-teal-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" /> Live Patient Workflow
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-all ${
            activeTab === "inventory"
              ? "border-teal-400 text-teal-300 bg-teal-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Store className="w-4 h-4" /> Main Store vs Counter Stock
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-all ${
            activeTab === "history"
              ? "border-teal-400 text-teal-300 bg-teal-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Receipt className="w-4 h-4" /> Sales Audit Logs (
          {completedSales.length})
        </button>
      </div>

      {/* Main Content Area */}
      {}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* TAB 1: LIVE WORKFLOW PIPELINE */}
        {activeTab === "pipeline" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step 1: Reception & Registration */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/40">
                    1
                  </span>
                  <h2 className="font-bold text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" /> Reception Queue
                  </h2>
                </div>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/30">
                  {patientsWaitingDoc} Waiting
                </span>
              </div>

              {/* Quick Register Patient Form */}
              <form
                onSubmit={handleAddNewPatient}
                className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col gap-2"
              >
                <div className="text-xs font-semibold text-slate-400">
                  Register New Patient
                </div>
                <input
                  type="text"
                  placeholder="Patient Name (e.g. Mg Mg)"
                  value={customPatientName}
                  onChange={(e) => setCustomPatientName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
                <input
                  type="text"
                  placeholder="Symptoms / Chief Complaint"
                  value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  className="w-full mt-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Register & Queue Patient
                </button>
              </form>

              {/* Patient List */}
              <div className="flex-1 flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {patients.filter((p) => p.status === "WAITING_DOCTOR")
                  .length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No patients waiting in reception queue.
                  </div>
                ) : (
                  patients
                    .filter((p) => p.status === "WAITING_DOCTOR")
                    .map((patient) => (
                      <div
                        key={patient.id}
                        className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/80 hover:border-blue-500/50 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-slate-200">
                              {patient.name}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              ({patient.gender}, {patient.age} yrs)
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {patient.id}
                          </span>
                        </div>
                        <div className="text-xs text-amber-400/90 mt-1 font-medium">
                          Symptom: {patient.symptoms}
                        </div>
                        <button
                          onClick={() => handleDoctorConsult(patient.id)}
                          className="mt-2.5 w-full bg-slate-800 hover:bg-teal-600 text-slate-300 hover:text-white border border-slate-700 hover:border-teal-500 text-xs py-1.5 rounded-lg transition flex items-center justify-center gap-1"
                        >
                          Send to Consultation{" "}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Step 2: Doctor Consultation & EMR */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center border border-teal-500/40">
                    2
                  </span>
                  <h2 className="font-bold text-slate-200 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-teal-400" /> Doctor
                    Consultation & EMR
                  </h2>
                </div>
                <span className="text-xs bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-full border border-teal-500/30">
                  {patientsWaitingPharma} Ready for Rx
                </span>
              </div>

              {/* Waiting for Pharmacy List */}
              <div className="flex-1 flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                {patients.filter((p) => p.status === "WAITING_PHARMACY")
                  .length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-500">
                    No active prescriptions pending fulfillment.
                  </div>
                ) : (
                  patients
                    .filter((p) => p.status === "WAITING_PHARMACY")
                    .map((patient) => (
                      <div
                        key={patient.id}
                        className="bg-slate-900/90 p-4 rounded-xl border border-teal-500/30 flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                          <div>
                            <span className="text-sm font-bold text-teal-300">
                              {patient.name}
                            </span>
                            <p className="text-xs text-slate-400">
                              {patient.doctorNotes}
                            </p>
                          </div>
                          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Rx Active
                          </span>
                        </div>

                        {/* Prescribed Medications */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Prescribed Regimen:
                          </div>
                          {patient.prescription.map((rx, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-800/70 p-2 rounded-lg flex justify-between items-center text-xs"
                            >
                              <div>
                                <span className="font-semibold text-slate-200">
                                  {rx.product.name}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  {rx.quantity} {rx.unit.unitName} @{" "}
                                  {rx.unit.price.toLocaleString()} Ks
                                </div>
                              </div>
                              <span className="font-bold text-teal-400">
                                {rx.subtotal.toLocaleString()} Ks
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => handlePharmacyFulfill(patient.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 rounded-lg transition shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5"
                        >
                          <Pill className="w-3.5 h-3.5" /> Dispense & Deduct
                          Stock
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Step 3: Pharmacy Counter & Checkout */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center border border-emerald-500/40">
                    3
                  </span>
                  <h2 className="font-bold text-slate-200 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />{" "}
                    Completed Prescriptions
                  </h2>
                </div>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  {patientsCompleted} Dispensed
                </span>
              </div>

              {/* Completed Dispensed List */}
              <div className="flex-1 flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                {patients.filter((p) => p.status === "COMPLETED").length ===
                0 ? (
                  <div className="text-center py-12 text-xs text-slate-500">
                    No completed orders yet in this session.
                  </div>
                ) : (
                  patients
                    .filter((p) => p.status === "COMPLETED")
                    .map((patient) => {
                      const totalCost = patient.prescription.reduce(
                        (s, item) => s + item.subtotal,
                        0,
                      );
                      return (
                        <div
                          key={patient.id}
                          className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex flex-col gap-2 opacity-90"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{" "}
                              {patient.name}
                            </span>
                            <span className="text-xs font-bold text-emerald-400">
                              {totalCost.toLocaleString()} Ks
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Items:{" "}
                            {patient.prescription
                              .map(
                                (rx) =>
                                  `${rx.product.name} (${rx.quantity} ${rx.unit.unitName})`,
                              )
                              .join(", ")}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY MANAGEMENT (MAIN STORE vs COUNTER) */}
        {}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            {/* Direct Stock Transfer Widget */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-teal-400" /> Main Store
                ➔ Counter Stock Transfer (မကြာခဏ Stock ဖြည့်စွက်ခြင်း)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Select Medicine
                  </label>
                  <select
                    value={transferAmount.productId}
                    onChange={(e) =>
                      setTransferAmount({
                        ...transferAmount,
                        productId: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- Choose Medicine --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Main Store Qty:{" "}
                        {Math.floor(
                          p.mainStoreStock / (p.units[0].conversionFactor || 1),
                        )}{" "}
                        Boxes)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Quantity (Boxes to move)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={transferAmount.qtyBoxes}
                    onChange={(e) =>
                      setTransferAmount({
                        ...transferAmount,
                        qtyBoxes: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  onClick={() => {
                    if (transferAmount.productId) {
                      handleStockTransfer(
                        transferAmount.productId,
                        transferAmount.qtyBoxes,
                      );
                    }
                  }}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition shadow-md shadow-teal-950 flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Transfer Stock to
                  Counter
                </button>
              </div>
            </div>

            {/* Inventory Grid Table */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Store className="w-4 h-4 text-teal-400" /> Multi-Unit
                  Packaging Inventory Overview
                </h3>
                <span className="text-xs text-slate-400">
                  Note: All inventory is tracked internally in{" "}
                  <strong className="text-teal-300">Base Units</strong>.
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Product Name</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Packaging Units & Prices</th>
                      <th className="p-3.5 text-center">Main Store Stock</th>
                      <th className="p-3.5 text-center">Counter Stock</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {products.map((p) => {
                      const isLowCounter =
                        p.counterStock <= p.reorderLevelCounter;
                      const boxUnit =
                        p.units.find((u) => u.unitName.includes("Box")) ||
                        p.units[0];
                      const boxFactor = boxUnit.conversionFactor || 1;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-700/30 transition"
                        >
                          <td className="p-3.5 font-semibold text-slate-200">
                            <div>{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {p.genericName}
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-300">{p.category}</td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {p.units.map((u, i) => (
                                <span
                                  key={i}
                                  className="bg-slate-900 border border-slate-700/80 text-slate-300 px-2 py-0.5 rounded text-[10px]"
                                >
                                  {u.unitName}:{" "}
                                  <strong className="text-teal-400">
                                    {u.price.toLocaleString()} Ks
                                  </strong>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="font-mono font-bold text-blue-300">
                              {p.mainStoreStock} {p.baseUnit}s
                            </span>
                            <div className="text-[10px] text-slate-400">
                              (~{Math.floor(p.mainStoreStock / boxFactor)}{" "}
                              Boxes)
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className={`font-mono font-bold px-2 py-0.5 rounded ${
                                  isLowCounter
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}
                              >
                                {p.counterStock} {p.baseUnit}s
                              </span>
                            </div>
                            {isLowCounter && (
                              <span className="text-[10px] text-amber-400 font-medium flex items-center justify-center gap-1 mt-0.5">
                                <ShieldAlert className="w-3 h-3" /> Reorder
                                Needed
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleStockTransfer(p.id, 1)}
                              className="bg-slate-700 hover:bg-teal-600 text-slate-200 hover:text-white text-[11px] font-semibold px-2.5 py-1.5 rounded transition inline-flex items-center gap-1"
                            >
                              +1 Box
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT & SALES HISTORY */}
        {}
        {activeTab === "history" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Invoices */}
            <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-400" /> Prescription Sales
                History
              </h3>

              {completedSales.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No completed pharmacy sales recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {completedSales.map((sale) => (
                    <div
                      key={sale.saleId}
                      className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/80 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <div>
                          <span className="font-mono text-xs text-teal-400 font-bold">
                            {sale.saleId}
                          </span>
                          <span className="text-xs text-slate-300 ml-3">
                            Patient: <strong>{sale.patientName}</strong>
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {sale.timestamp}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {sale.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-xs text-slate-300"
                          >
                            <span>
                              • {item.product.name} ({item.quantity}{" "}
                              {item.unit.unitName})
                            </span>
                            <span>{item.subtotal.toLocaleString()} Ks</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-800 pt-2 mt-1">
                        <span className="text-xs text-slate-400">
                          Paid via Cash/KBZPay
                        </span>
                        <span className="text-sm font-bold text-emerald-400">
                          Total: {sale.totalAmount.toLocaleString()} Ks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit Log Stream */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 flex flex-col gap-3">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" /> Real-Time Audit
                Log
              </h3>

              <div className="flex-1 bg-slate-900/90 rounded-xl p-3 border border-slate-800 font-mono text-[11px] space-y-2 max-h-[500px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-slate-600 text-center py-8">
                    Log activity empty
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="border-b border-slate-800/60 pb-1.5 last:border-0"
                    >
                      <span className="text-slate-500 mr-2">[{log.time}]</span>
                      <span
                        className={
                          log.type === "error"
                            ? "text-red-400"
                            : log.type === "success"
                              ? "text-emerald-400"
                              : log.type === "warning"
                                ? "text-amber-400"
                                : log.type === "doctor"
                                  ? "text-cyan-300"
                                  : "text-slate-300"
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
