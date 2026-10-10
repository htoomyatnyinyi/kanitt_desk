import React, { useState, useEffect, useMemo } from "react";
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
  Plus,
  Building2,
  FileText,
  ShoppingBag,
  ChevronRight,
  ShieldAlert,
  Search,
  DollarSign,
  Printer,
  X,
  Zap,
  Sparkles,
  Trash2,
  Sliders,
  Check,
} from "lucide-react";

// Master Inventory Database with Packaging Hierarchy (Box, Strip, Tablet/Capsule)
const INITIAL_PRODUCTS = [
  {
    id: "p1",
    name: "Biogesic 500mg",
    genericName: "Paracetamol",
    category: "Analgesic / Antipyretic",
    baseUnit: "Tablet",
    units: [
      { unitName: "Box (100s)", conversionFactor: 100, price: 12000 },
      { unitName: "Strip (10s)", conversionFactor: 10, price: 1300 },
      { unitName: "Tablet", conversionFactor: 1, price: 150 },
    ],
    mainStoreStock: 2500, // in Base Units (Tablets)
    counterStock: 180, // in Base Units
    reorderLevelCounter: 50,
    batchNo: "BAT-2026-08",
    expiryDate: "2027-11-30",
  },
  {
    id: "p2",
    name: "Amoxil 500mg",
    genericName: "Amoxicillin Trihydrate",
    category: "Antibiotic",
    baseUnit: "Capsule",
    units: [
      { unitName: "Box (100s)", conversionFactor: 100, price: 32000 },
      { unitName: "Strip (10s)", conversionFactor: 10, price: 3500 },
      { unitName: "Capsule", conversionFactor: 1, price: 400 },
    ],
    mainStoreStock: 1500,
    counterStock: 35,
    reorderLevelCounter: 60,
    batchNo: "BAT-2026-02",
    expiryDate: "2026-12-15", // Near expiry warning
  },
  {
    id: "p3",
    name: "Cravit Ophthalmic 0.5%",
    genericName: "Levofloxacin Drops",
    category: "Ophthalmic",
    baseUnit: "Bottle",
    units: [
      { unitName: "Box (10s)", conversionFactor: 10, price: 42000 },
      { unitName: "Bottle", conversionFactor: 1, price: 4500 },
    ],
    mainStoreStock: 80,
    counterStock: 12,
    reorderLevelCounter: 10,
    batchNo: "BAT-2025-11",
    expiryDate: "2028-01-20",
  },
  {
    id: "p4",
    name: "Omeprazole 20mg",
    genericName: "Omeprazole Gastro-resistant",
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
    batchNo: "BAT-2026-05",
    expiryDate: "2027-08-10",
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
    counterStock: 28,
    reorderLevelCounter: 40,
    batchNo: "BAT-2026-01",
    expiryDate: "2027-05-30",
  },
];

const INITIAL_PATIENTS = [
  {
    id: "PAT-101",
    name: "U Mya (ဦးမြ)",
    age: 52,
    gender: "Male",
    symptoms: "Fever & Joint Pain",
    doctorFee: 5000,
    status: "WAITING_DOCTOR",
    doctorNotes: "",
    prescription: [],
    vitals: { bp: "120/80", hr: "76", temp: "38.2°C", bmi: "24.1" },
  },
  {
    id: "PAT-102",
    name: "Daw Nu (ဒေါ်နု)",
    age: 38,
    gender: "Female",
    symptoms: "Gastritis & Cold",
    doctorFee: 5000,
    status: "WAITING_DOCTOR",
    doctorNotes: "",
    prescription: [],
    vitals: { bp: "115/75", hr: "82", temp: "36.8°C", bmi: "22.0" },
  },
  {
    id: "PAT-103",
    name: "Ko Tun (ကိုထွန်း)",
    age: 29,
    gender: "Male",
    symptoms: "Bacterial Throat Cough",
    doctorFee: 6000,
    status: "WAITING_DOCTOR",
    doctorNotes: "",
    prescription: [],
    vitals: { bp: "130/85", hr: "88", temp: "37.5°C", bmi: "26.4" },
  },
];

export default function AppNew() {
  const [activeTab, setActiveTab] = useState("pipeline"); // 'pipeline' | 'inventory' | 'pos' | 'history'
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [completedSales, setCompletedSales] = useState([]);
  const [logs, setLogs] = useState([]);

  // Auto Simulation Settings
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(3000); // ms per cycle

  // Doctor Consultation Modal state
  const [selectedPatientForDoctor, setSelectedPatientForDoctor] =
    useState(null);
  const [rxDraft, setRxDraft] = useState([]);
  const [doctorDiagnosisNote, setDoctorDiagnosisNote] = useState("");

  // OTC Pharmacy Cart State
  const [otcCart, setOtcCart] = useState([]);
  const [otcSearch, setOtcSearch] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");

  // Receipt Modal State
  const [activeReceiptModal, setActiveReceiptModal] = useState(null);

  // Transfer Widget State
  const [transferState, setTransferState] = useState({
    productId: "",
    qtyBoxes: 1,
  });
  const [registrationForm, setRegistrationForm] = useState({
    name: "",
    age: 30,
    gender: "Male",
    symptoms: "",
  });

  // System Logging Helper
  const addLog = (message, type = "info") => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) =>
      [{ id: Date.now() + Math.random(), time, message, type }, ...prev].slice(
        0,
        40,
      ),
    );
  };

  useEffect(() => {
    addLog(
      "Clinic Information & Pharmacy System Online. Hybrid offline-sync active.",
      "success",
    );
  }, []);

  useEffect(() => {
    let interval;
    if (isSimulating) {
      interval = setInterval(() => {
        const waitingDoc = patients.find((p) => p.status === "WAITING_DOCTOR");
        const waitingPharma = patients.find(
          (p) => p.status === "WAITING_PHARMACY",
        );

        if (waitingDoc) {
          autoDoctorConsult(waitingDoc.id);
        } else if (waitingPharma) {
          handlePharmacyFulfill(waitingPharma.id);
        } else {
          autoRegisterPatient();
        }
      }, simSpeed);
    }
    return () => clearInterval(interval);
  }, [isSimulating, patients, products, simSpeed]);

  // Automated Patient Generator for Simulation
  const autoRegisterPatient = () => {
    const names = [
      "Ma Thida",
      "U Than Win",
      "Daw Khin Khin",
      "Mg Aung",
      "Aung Kyaw",
      "Ko Phyo",
      "Daw San",
    ];
    const symptomsList = [
      "High Fever & Chills",
      "Stomachache & Acidity",
      "Eye Redness",
      "Flu & Cough",
      "Body Aches & Fatigue",
    ];

    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomSymptom =
      symptomsList[Math.floor(Math.random() * symptomsList.length)];

    const newPat = {
      id: `PAT-${Math.floor(100 + Math.random() * 900)}`,
      name: randomName,
      age: Math.floor(18 + Math.random() * 55),
      gender: Math.random() > 0.5 ? "Male" : "Female",
      symptoms: randomSymptom,
      doctorFee: 5000,
      status: "WAITING_DOCTOR",
      doctorNotes: "",
      prescription: [],
      vitals: {
        bp: `${110 + Math.floor(Math.random() * 30)}/${70 + Math.floor(Math.random() * 20)}`,
        hr: `${70 + Math.floor(Math.random() * 25)}`,
        temp: `${(36.5 + Math.random() * 2).toFixed(1)}°C`,
        bmi: `${(19 + Math.random() * 8).toFixed(1)}`,
      },
    };

    setPatients((prev) => [...prev, newPat]);
    addLog(
      `Reception: New Patient ${newPat.name} checked in (${newPat.symptoms}).`,
      "info",
    );
  };

  const handleManualRegister = (e) => {
    e.preventDefault();
    if (!registrationForm.name || !registrationForm.symptoms) return;

    const newPat = {
      id: `PAT-${Math.floor(100 + Math.random() * 900)}`,
      name: registrationForm.name,
      age: Number(registrationForm.age) || 30,
      gender: registrationForm.gender,
      symptoms: registrationForm.symptoms,
      doctorFee: 5000,
      status: "WAITING_DOCTOR",
      doctorNotes: "",
      prescription: [],
      vitals: { bp: "120/80", hr: "78", temp: "37.0°C", bmi: "23.5" },
    };

    setPatients((prev) => [...prev, newPat]);
    addLog(
      `Reception: Registered ${newPat.name} -> Queue #${newPat.id}`,
      "info",
    );
    setRegistrationForm({ name: "", age: 30, gender: "Male", symptoms: "" });
  };

  // Open Doctor Consultation Modal
  const openDoctorModal = (patient) => {
    setSelectedPatientForDoctor(patient);
    setDoctorDiagnosisNote(
      `Patient presents with ${patient.symptoms}. Vitals stable.`,
    );
    // Default draft with 1 recommended product
    const sampleProd = products[0];
    setRxDraft([
      {
        productId: sampleProd.id,
        productName: sampleProd.name,
        selectedUnitName: sampleProd.units[1].unitName, // Strip
        conversionFactor: sampleProd.units[1].conversionFactor,
        price: sampleProd.units[1].price,
        quantity: 2,
        dosageInstruction: "1 Tab - TDS (3x daily) - After Meals - 5 Days",
      },
    ]);
  };

  const addRxDraftRow = () => {
    const prod = products[0];
    setRxDraft((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        selectedUnitName: prod.units[0].unitName,
        conversionFactor: prod.units[0].conversionFactor,
        price: prod.units[0].price,
        quantity: 1,
        dosageInstruction: "1 Tab - BD (2x daily) - After Meals",
      },
    ]);
  };

  const submitDoctorConsultation = () => {
    if (!selectedPatientForDoctor) return;

    const formattedPrescription = rxDraft.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const unit =
        prod.units.find((u) => u.unitName === item.selectedUnitName) ||
        prod.units[0];
      return {
        product: prod,
        unit: unit,
        quantity: item.quantity,
        dosageInstruction: item.dosageInstruction,
        subtotal: item.quantity * unit.price,
      };
    });

    setPatients((prev) =>
      prev.map((p) =>
        p.id === selectedPatientForDoctor.id
          ? {
              ...p,
              status: "WAITING_PHARMACY",
              doctorNotes: doctorDiagnosisNote,
              prescription: formattedPrescription,
            }
          : p,
      ),
    );

    addLog(
      `Dr. Consulted ${selectedPatientForDoctor.name}: Prescribed ${formattedPrescription.length} items. Sent to Pharmacy POS.`,
      "doctor",
    );
    setSelectedPatientForDoctor(null);
  };

  const autoDoctorConsult = (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;

    // Pick 2 random medications
    const item1 = products[Math.floor(Math.random() * products.length)];
    const item2 = products[Math.floor(Math.random() * products.length)];
    const selectedProds = item1.id === item2.id ? [item1] : [item1, item2];

    const rxList = selectedProds.map((prod) => {
      const selectedUnit =
        prod.units[Math.floor(Math.random() * (prod.units.length - 1)) + 1] ||
        prod.units[0];
      const qty = Math.floor(1 + Math.random() * 2);
      return {
        product: prod,
        unit: selectedUnit,
        quantity: qty,
        dosageInstruction: "1 Tab - TDS (3x daily) - After Meals",
        subtotal: selectedUnit.price * qty,
      };
    });

    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
              ...p,
              status: "WAITING_PHARMACY",
              doctorNotes: `Auto Diagnosis for ${patient.symptoms}. Clinical advice given.`,
              prescription: rxList,
            }
          : p,
      ),
    );

    addLog(
      `Dr. Consulted ${patient.name} -> Prescribed ${rxList.length} items.`,
      "doctor",
    );
  };

  const handlePharmacyFulfill = (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient || patient.prescription.length === 0) return;

    // Verify stock availability
    let canFulfill = true;
    let failedItemMsg = "";

    patient.prescription.forEach((rx) => {
      const currentProd = products.find((prod) => prod.id === rx.product.id);
      const neededBaseQty = rx.quantity * rx.unit.conversionFactor;

      if (!currentProd || currentProd.counterStock < neededBaseQty) {
        canFulfill = false;
        failedItemMsg = `${rx.product.name} (Requires ${neededBaseQty} ${rx.product.baseUnit}s, Counter Has ${currentProd ? currentProd.counterStock : 0})`;
      }
    });

    if (!canFulfill) {
      addLog(
        `❌ Stock Out Alert for ${patient.name}! Insufficient Counter Stock: [${failedItemMsg}]`,
        "error",
      );
      setIsSimulating(false);
      return;
    }

    // Atomic stock deduction in Base Units
    let totalMedsAmount = 0;
    const updatedProducts = products.map((prod) => {
      const rxItem = patient.prescription.find(
        (rx) => rx.product.id === prod.id,
      );
      if (rxItem) {
        const baseQtyToDeduct = rxItem.quantity * rxItem.unit.conversionFactor;
        totalMedsAmount += rxItem.subtotal;
        return {
          ...prod,
          counterStock: prod.counterStock - baseQtyToDeduct,
        };
      }
      return prod;
    });

    setProducts(updatedProducts);

    const totalBill = totalMedsAmount + (patient.doctorFee || 0);

    const saleRecord = {
      saleId: `INV-${Date.now().toString().slice(-6)}`,
      patientName: patient.name,
      patientId: patient.id,
      doctorFee: patient.doctorFee || 0,
      items: patient.prescription,
      medsAmount: totalMedsAmount,
      totalAmount: totalBill,
      paymentMethod: selectedPaymentMethod,
      timestamp: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    };

    setCompletedSales((prev) => [saleRecord, ...prev]);

    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, status: "COMPLETED" } : p)),
    );

    addLog(
      `✅ Pharmacy Dispensed for ${patient.name}. Revenue: ${totalBill.toLocaleString()} Ks (Counter Stock Deducted).`,
      "success",
    );
  };

  // Over-the-counter (OTC) Direct Sale
  const handleOtcAddToCart = (product, unit) => {
    const existingIndex = otcCart.findIndex(
      (item) =>
        item.product.id === product.id && item.unit.unitName === unit.unitName,
    );

    if (existingIndex > -1) {
      const updated = [...otcCart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].subtotal =
        updated[existingIndex].quantity * unit.price;
      setOtcCart(updated);
    } else {
      setOtcCart([
        ...otcCart,
        { product, unit, quantity: 1, subtotal: unit.price },
      ]);
    }
  };

  const handleOtcCheckout = () => {
    if (otcCart.length === 0) return;

    // Check stock
    for (const item of otcCart) {
      const currentProd = products.find((p) => p.id === item.product.id);
      const neededBaseQty = item.quantity * item.unit.conversionFactor;
      if (!currentProd || currentProd.counterStock < neededBaseQty) {
        addLog(
          `❌ Cannot complete OTC Sale: Insufficient stock for ${item.product.name}`,
          "error",
        );
        return;
      }
    }

    // Deduct stock
    let totalMeds = 0;
    const updatedProds = products.map((prod) => {
      const cartItems = otcCart.filter((ci) => ci.product.id === prod.id);
      if (cartItems.length > 0) {
        const totalBaseDeduct = cartItems.reduce(
          (s, ci) => s + ci.quantity * ci.unit.conversionFactor,
          0,
        );
        return { ...prod, counterStock: prod.counterStock - totalBaseDeduct };
      }
      return prod;
    });

    totalMeds = otcCart.reduce((s, ci) => s + ci.subtotal, 0);
    setProducts(updatedProds);

    const saleRecord = {
      saleId: `OTC-${Date.now().toString().slice(-6)}`,
      patientName: "Walk-in Customer (OTC)",
      patientId: "OTC-GUEST",
      doctorFee: 0,
      items: otcCart,
      medsAmount: totalMeds,
      totalAmount: totalMeds,
      paymentMethod: selectedPaymentMethod,
      timestamp: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    };

    setCompletedSales((prev) => [saleRecord, ...prev]);
    setOtcCart([]);
    addLog(
      `✅ Walk-in OTC Sale Completed: ${totalMeds.toLocaleString()} Ks`,
      "success",
    );
  };

  const handleStockTransfer = (productId, boxesToTransfer) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const boxUnit =
      prod.units.find((u) => u.unitName.includes("Box")) || prod.units[0];
    const totalBaseQtyToTransfer = boxesToTransfer * boxUnit.conversionFactor;

    if (prod.mainStoreStock < totalBaseQtyToTransfer) {
      addLog(
        `⚠️ Stock Requisition Denied: Main Store only has ${prod.mainStoreStock} ${prod.baseUnit}s of ${prod.name}`,
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
      `📦 Inter-Store Transfer: ${boxesToTransfer} Box(es) [${totalBaseQtyToTransfer} ${prod.baseUnit}s] of ${prod.name} moved Main Store ➔ Counter POS.`,
      "warning",
    );
  };

  const totalRevenue = useMemo(
    () => completedSales.reduce((sum, s) => sum + s.totalAmount, 0),
    [completedSales],
  );
  const doctorFeeRevenue = useMemo(
    () => completedSales.reduce((sum, s) => sum + s.doctorFee, 0),
    [completedSales],
  );
  const pharmacyRevenue = useMemo(
    () => completedSales.reduce((sum, s) => sum + s.medsAmount, 0),
    [completedSales],
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Application Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-xl shadow-lg shadow-teal-900/30">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold bg-gradient-to-r from-teal-300 via-cyan-200 to-blue-400 bg-clip-text text-transparent">
                MediFlow Clinic & Pharmacy System
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 uppercase tracking-wider">
                v3.2 Hybrid-Cloud
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Integrated PMI, EMR, Multi-Unit Packaging POS & Store Inventory
            </p>
          </div>
        </div>

        {/* Live Simulation Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-1 text-xs">
            <span className="text-slate-400 px-2 text-[11px] font-medium flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Speed:
            </span>
            <button
              onClick={() => setSimSpeed(4000)}
              className={`px-2 py-1 rounded-lg transition ${simSpeed === 4000 ? "bg-teal-600 text-white font-bold" : "text-slate-400 hover:text-white"}`}
            >
              1x
            </button>
            <button
              onClick={() => setSimSpeed(2000)}
              className={`px-2 py-1 rounded-lg transition ${simSpeed === 2000 ? "bg-teal-600 text-white font-bold" : "text-slate-400 hover:text-white"}`}
            >
              2x
            </button>
            <button
              onClick={() => setSimSpeed(800)}
              className={`px-2 py-1 rounded-lg transition ${simSpeed === 800 ? "bg-teal-600 text-white font-bold" : "text-slate-400 hover:text-white"}`}
            >
              Fast
            </button>
          </div>

          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
              isSimulating
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 animate-pulse"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50"
            }`}
          >
            {isSimulating ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isSimulating ? "Pause Auto Workflow" : "Start Auto Simulation"}
          </button>

          <button
            onClick={() => {
              setProducts(INITIAL_PRODUCTS);
              setPatients(INITIAL_PATIENTS);
              setCompletedSales([]);
              setLogs([]);
              addLog("System state reset to baseline defaults.", "info");
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </header>

      {/* KPI Metrics Dashboard Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Reception Queue</div>
            <div className="text-sm font-extrabold text-slate-200">
              {patientsWaitingDoc}{" "}
              <span className="text-xs text-slate-500 font-normal">
                Waiting Doc
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
          <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-lg">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Pharmacy Queue</div>
            <div className="text-sm font-extrabold text-teal-400">
              {patientsWaitingPharma}{" "}
              <span className="text-xs text-slate-500 font-normal">
                Pending Rx
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Completed Visits</div>
            <div className="text-base font-extrabold text-emerald-400">
              {patientsCompleted} Patients
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
          <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Total Revenue</div>
            <div className="text-base font-extrabold text-cyan-300">
              {totalRevenue.toLocaleString()} Ks
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">
              Counter Stock Alert
            </div>
            <div className="text-base font-extrabold text-amber-400">
              {
                products.filter((p) => p.counterStock <= p.reorderLevelCounter)
                  .length
              }{" "}
              Items Low
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 border-b border-slate-800 bg-slate-950 flex gap-2 pt-2">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === "pipeline"
              ? "border-teal-400 text-teal-300 bg-teal-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" /> 1. Live Patient Workflow Queue
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === "inventory"
              ? "border-teal-400 text-teal-300 bg-teal-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Store className="w-4 h-4" /> 2. Dual-Location Store & Counter
          Inventory
        </button>

        <button
          onClick={() => setActiveTab("pos")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === "pos"
              ? "border-teal-400 text-teal-300 bg-teal-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> 3. OTC Pharmacy Counter POS
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === "history"
              ? "border-teal-400 text-teal-300 bg-teal-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Receipt className="w-4 h-4" /> 4. Billing & System Audit Logs
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {}
        {activeTab === "pipeline" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step 1: Reception & PMI Patient Queue */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-extrabold flex items-center justify-center border border-blue-500/30">
                    1
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-400" /> Patient
                      Registration & PMI
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Front-desk queue routing
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold bg-blue-500/10 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/20">
                  {patientsWaitingDoc} In Queue
                </span>
              </div>

              {/* Patient Quick Check-in Form */}
              <form
                onSubmit={handleManualRegister}
                className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5"
              >
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-teal-400" /> New Walk-in
                  Registration
                </div>
                <input
                  type="text"
                  placeholder="Patient Name (e.g. U Ba / Daw Khin)"
                  value={registrationForm.name}
                  onChange={(e) =>
                    setRegistrationForm({
                      ...registrationForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Age"
                    value={registrationForm.age}
                    onChange={(e) =>
                      setRegistrationForm({
                        ...registrationForm,
                        age: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                  <select
                    value={registrationForm.gender}
                    onChange={(e) =>
                      setRegistrationForm({
                        ...registrationForm,
                        gender: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Chief Complaints / Symptoms"
                  value={registrationForm.symptoms}
                  onChange={(e) =>
                    setRegistrationForm({
                      ...registrationForm,
                      symptoms: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  className="w-full mt-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-1 shadow-md shadow-blue-950"
                >
                  <Plus className="w-3.5 h-3.5" /> Check-in Patient
                </button>
              </form>

              {/* Waiting Patients List */}
              <div className="flex-1 flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {patients.filter((p) => p.status === "WAITING_DOCTOR")
                  .length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500 italic">
                    No patients currently waiting at reception.
                  </div>
                ) : (
                  patients
                    .filter((p) => p.status === "WAITING_DOCTOR")
                    .map((patient) => (
                      <div
                        key={patient.id}
                        className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 hover:border-blue-500/40 transition"
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
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {patient.id}
                          </span>
                        </div>
                        <div className="text-xs text-amber-300 mt-1 font-medium">
                          Chief Complaint: {patient.symptoms}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex gap-2">
                          <span>
                            BP:{" "}
                            <strong className="text-slate-300">
                              {patient.vitals.bp}
                            </strong>
                          </span>
                          <span>
                            HR:{" "}
                            <strong className="text-slate-300">
                              {patient.vitals.hr} bpm
                            </strong>
                          </span>
                          <span>
                            Temp:{" "}
                            <strong className="text-slate-300">
                              {patient.vitals.temp}
                            </strong>
                          </span>
                        </div>
                        <button
                          onClick={() => openDoctorModal(patient)}
                          className="mt-2.5 w-full bg-slate-800 hover:bg-teal-600 text-slate-200 hover:text-white border border-slate-700 hover:border-teal-500 text-xs font-semibold py-1.5 rounded-lg transition flex items-center justify-center gap-1"
                        >
                          <Stethoscope className="w-3.5 h-3.5 text-teal-400" />{" "}
                          Start Doctor Consultation
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Step 2: Doctor EMR & Prescribing */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 text-xs font-extrabold flex items-center justify-center border border-teal-500/30">
                    2
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-teal-400" /> Doctor
                      Consultation & EMR
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Electronic prescribing queue
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold bg-teal-500/10 text-teal-300 px-2.5 py-1 rounded-full border border-teal-500/20">
                  {patientsWaitingPharma} Prescribed
                </span>
              </div>

              {/* Doctor Consultation Queue */}
              <div className="flex-1 flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                {patients.filter((p) => p.status === "WAITING_PHARMACY")
                  .length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-500 italic">
                    No active doctor prescriptions pending fulfillment.
                  </div>
                ) : (
                  patients
                    .filter((p) => p.status === "WAITING_PHARMACY")
                    .map((patient) => (
                      <div
                        key={patient.id}
                        className="bg-slate-950 p-4 rounded-xl border border-teal-500/30 flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                          <div>
                            <span className="text-sm font-bold text-teal-300">
                              {patient.name}
                            </span>
                            <p className="text-xs text-slate-400 mt-0.5 italic">
                              {patient.doctorNotes}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Rx Sent
                          </span>
                        </div>

                        {/* Prescribed Regimen Items */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Prescribed Items:
                          </div>
                          {patient.prescription.map((rx, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-900 p-2 rounded-lg flex justify-between items-center text-xs border border-slate-800"
                            >
                              <div>
                                <span className="font-semibold text-slate-200">
                                  {rx.product.name}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  {rx.quantity} {rx.unit.unitName} @{" "}
                                  {rx.unit.price.toLocaleString()} Ks
                                </div>
                                <div className="text-[10px] text-teal-400/90">
                                  {rx.dosageInstruction}
                                </div>
                              </div>
                              <span className="font-bold text-teal-300">
                                {rx.subtotal.toLocaleString()} Ks
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePharmacyFulfill(patient.id)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-lg transition shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5"
                          >
                            <Pill className="w-3.5 h-3.5" /> Dispense & Fulfill
                            POS
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Step 3: Pharmacy Checkout & Receipting */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold flex items-center justify-center border border-emerald-500/30">
                    3
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />{" "}
                      Completed Pharmacy Orders
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Dispatched & Invoiced
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  {patientsCompleted} Dispensed
                </span>
              </div>

              {/* Dispensed Patient Orders */}
              <div className="flex-1 flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                {patients.filter((p) => p.status === "COMPLETED").length ===
                0 ? (
                  <div className="text-center py-12 text-xs text-slate-500 italic">
                    No completed orders yet in this session.
                  </div>
                ) : (
                  patients
                    .filter((p) => p.status === "COMPLETED")
                    .map((patient) => {
                      const totalCost =
                        patient.prescription.reduce(
                          (s, item) => s + item.subtotal,
                          0,
                        ) + (patient.doctorFee || 0);
                      const matchingSale = completedSales.find(
                        (s) => s.patientId === patient.id,
                      );

                      return (
                        <div
                          key={patient.id}
                          className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{" "}
                              {patient.name}
                            </span>
                            <span className="text-xs font-extrabold text-emerald-400">
                              {totalCost.toLocaleString()} Ks
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {patient.prescription
                              .map(
                                (rx) =>
                                  `${rx.product.name} (${rx.quantity} ${rx.unit.unitName})`,
                              )
                              .join(", ")}
                          </div>
                          {matchingSale && (
                            <button
                              onClick={() =>
                                setActiveReceiptModal(matchingSale)
                              }
                              className="mt-1 w-full bg-slate-900 hover:bg-slate-800 text-teal-300 border border-slate-700 text-[11px] font-semibold py-1 rounded-lg transition flex items-center justify-center gap-1"
                            >
                              <Printer className="w-3 h-3" /> View Thermal
                              Invoice
                            </button>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            {/* Inter-Store Requisition & Transfer Widget */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-teal-400" />{" "}
                  Inter-Store Transfer Workflow (Main Store ➔ Counter Store)
                </h3>
                <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                  Auto conversion to{" "}
                  <strong className="text-teal-300">Base Unit Layer</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Select Drug for Restock
                  </label>
                  <select
                    value={transferState.productId}
                    onChange={(e) =>
                      setTransferState({
                        ...transferState,
                        productId: e.target.value,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- Choose Medication --</option>
                    {products.map((p) => {
                      const boxUnit =
                        p.units.find((u) => u.unitName.includes("Box")) ||
                        p.units[0];
                      const mainStoreBoxes = Math.floor(
                        p.mainStoreStock / boxUnit.conversionFactor,
                      );
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({mainStoreBoxes} Boxes in Main Store)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Quantity (Boxes to Transfer)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={transferState.qtyBoxes}
                    onChange={(e) =>
                      setTransferState({
                        ...transferState,
                        qtyBoxes: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  onClick={() => {
                    if (transferState.productId) {
                      handleStockTransfer(
                        transferState.productId,
                        transferState.qtyBoxes,
                      );
                    }
                  }}
                  className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition shadow-md shadow-teal-950 flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Transfer Stock to
                  Pharmacy
                </button>
              </div>
            </div>

            {/* Inventory Master Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <Store className="w-4 h-4 text-teal-400" /> Multi-Unit
                    Packaging Inventory Matrix
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time stock across Main Store warehouse and Pharmacy
                    Counter
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Product & Batch Details</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Packaging Hierarchies & Pricing</th>
                      <th className="p-3.5 text-center">Main Store Stock</th>
                      <th className="p-3.5 text-center">Counter Stock</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
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
                          className="hover:bg-slate-800/40 transition"
                        >
                          <td className="p-3.5 font-semibold text-slate-200">
                            <div className="text-sm font-bold text-teal-300">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {p.genericName}
                            </div>
                            <div className="flex gap-2 mt-1 text-[10px]">
                              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                                {p.batchNo}
                              </span>
                              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">
                                Exp: {p.expiryDate}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-300">{p.category}</td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {p.units.map((u, i) => (
                                <span
                                  key={i}
                                  className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded text-[10px]"
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
                                className={`font-mono font-bold px-2.5 py-1 rounded ${
                                  isLowCounter
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {p.counterStock} {p.baseUnit}s
                              </span>
                            </div>
                            {isLowCounter && (
                              <span className="text-[10px] text-amber-400 font-semibold flex items-center justify-center gap-1 mt-1">
                                <ShieldAlert className="w-3 h-3" /> Reorder
                                Triggered
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleStockTransfer(p.id, 1)}
                              className="bg-slate-800 hover:bg-teal-600 text-slate-200 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-teal-500 transition inline-flex items-center gap-1"
                            >
                              + Transfer 1 Box
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

        {/* OVER-THE-COUNTER (OTC) PHARMACY POS TAB */}
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Medication Catalog Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex justify-between items-center gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search medication by name, generic, or category..."
                    value={otcSearch}
                    onChange={(e) => setOtcSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products
                  .filter(
                    (p) =>
                      p.name.toLowerCase().includes(otcSearch.toLowerCase()) ||
                      p.genericName
                        .toLowerCase()
                        .includes(otcSearch.toLowerCase()),
                  )
                  .map((product) => (
                    <div
                      key={product.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-teal-500/40 transition"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-teal-300 text-sm">
                            {product.name}
                          </h4>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                            Stock: {product.counterStock} {product.baseUnit}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {product.genericName}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <div className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">
                          Select Unit to add to cart:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {product.units.map((unit, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleOtcAddToCart(product, unit)}
                              className="flex-1 bg-slate-950 hover:bg-teal-600 text-slate-200 hover:text-white border border-slate-800 hover:border-teal-500 p-2 rounded-xl text-xs transition flex flex-col items-center justify-center"
                            >
                              <span className="font-semibold">
                                {unit.unitName}
                              </span>
                              <span className="text-teal-400 font-bold">
                                {unit.price.toLocaleString()} Ks
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* OTC Sales Cart */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
              <div>
                <h3 className="font-bold text-slate-200 text-sm pb-3 border-b border-slate-800 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-teal-400" /> Walk-in OTC
                  Sales Cart
                </h3>

                {otcCart.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">
                    Cart is empty. Select medication units from catalog to build
                    order.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 max-h-[380px] overflow-y-auto">
                    {otcCart.map((item, idx) => (
                      <div
                        key={idx}
                        className="py-3 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-200">
                            {item.product.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.unit.unitName} x {item.quantity}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="font-bold text-xs text-teal-400">
                              {item.subtotal.toLocaleString()} Ks
                            </div>
                            <div className="text-[9px] text-slate-500">
                              ({item.quantity * item.unit.conversionFactor}{" "}
                              {item.product.baseUnit}s)
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setOtcCart(otcCart.filter((_, i) => i !== idx))
                            }
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Payment Gateway:</span>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-xs text-teal-300 rounded-lg px-2 py-1"
                  >
                    <option value="Cash">Cash (မြန်မာကျပ်)</option>
                    <option value="KBZPay">KBZPay QR</option>
                    <option value="WavePay">WavePay</option>
                    <option value="Card">Visa / Master Card</option>
                  </select>
                </div>

                <div className="flex justify-between items-center text-sm font-extrabold">
                  <span className="text-slate-200">Subtotal:</span>
                  <span className="text-teal-300">
                    {otcCart
                      .reduce((s, ci) => s + ci.subtotal, 0)
                      .toLocaleString()}{" "}
                    Ks
                  </span>
                </div>

                <button
                  onClick={handleOtcCheckout}
                  disabled={otcCart.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Process Checkout & Deduct Stock
                </button>
              </div>
            </div>
          </div>
        )}

        {}
        {activeTab === "history" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Transactions */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-teal-400" /> Completed
                  Invoices & Cashier Ledger
                </h3>
                <div className="text-xs text-teal-300 font-bold">
                  Total Ledger: {totalRevenue.toLocaleString()} Ks
                </div>
              </div>

              {completedSales.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs italic">
                  No transactions recorded in this session.
                </div>
              ) : (
                <div className="space-y-3">
                  {completedSales.map((sale) => (
                    <div
                      key={sale.saleId}
                      className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-2"
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
                        <div className="text-right">
                          <span className="text-xs text-slate-400">
                            {sale.timestamp}
                          </span>
                          <span className="text-[10px] text-teal-400 font-mono block">
                            {sale.paymentMethod}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 my-1">
                        {sale.doctorFee > 0 && (
                          <div className="flex justify-between text-xs text-slate-400 italic">
                            <span>• Doctor Consultation Fee</span>
                            <span>{sale.doctorFee.toLocaleString()} Ks</span>
                          </div>
                        )}
                        {sale.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-xs text-slate-300"
                          >
                            <span>
                              •{" "}
                              {item.product ? item.product.name : "Medication"}{" "}
                              ({item.quantity}{" "}
                              {item.unit ? item.unit.unitName : "unit"})
                            </span>
                            <span>{item.subtotal.toLocaleString()} Ks</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-800 pt-2">
                        <button
                          onClick={() => setActiveReceiptModal(sale)}
                          className="text-xs text-teal-400 hover:underline flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print Thermal
                          Receipt
                        </button>
                        <span className="text-sm font-extrabold text-emerald-400">
                          Total: {sale.totalAmount.toLocaleString()} Ks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System Audit Log Stream */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" /> Tamper-Proof
                Audit Log Stream
              </h3>

              <div className="flex-1 bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-[11px] space-y-2 max-h-[500px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-slate-600 text-center py-8">
                    Audit log stream empty
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="border-b border-slate-900 pb-1.5 last:border-0 leading-relaxed"
                    >
                      <span className="text-slate-500 mr-2">[{log.time}]</span>
                      <span
                        className={
                          log.type === "error"
                            ? "text-red-400 font-bold"
                            : log.type === "success"
                              ? "text-emerald-400 font-semibold"
                              : log.type === "warning"
                                ? "text-amber-300"
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

      {}
      {selectedPatientForDoctor && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-teal-300 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-teal-400" /> Doctor EMR
                  Consultation Desk
                </h3>
                <p className="text-xs text-slate-400">
                  Patient:{" "}
                  <strong className="text-slate-200">
                    {selectedPatientForDoctor.name}
                  </strong>{" "}
                  ({selectedPatientForDoctor.gender},{" "}
                  {selectedPatientForDoctor.age} yrs)
                </p>
              </div>
              <button
                onClick={() => setSelectedPatientForDoctor(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vitals Summary */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">BP</span>
                <span className="font-bold text-slate-200">
                  {selectedPatientForDoctor.vitals.bp}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">
                  Heart Rate
                </span>
                <span className="font-bold text-slate-200">
                  {selectedPatientForDoctor.vitals.hr} bpm
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Temp</span>
                <span className="font-bold text-amber-300">
                  {selectedPatientForDoctor.vitals.temp}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">BMI</span>
                <span className="font-bold text-slate-200">
                  {selectedPatientForDoctor.vitals.bmi}
                </span>
              </div>
            </div>

            {/* Doctor SOAP / Diagnosis Note */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Doctor Assessment / Diagnosis Notes:
              </label>
              <textarea
                rows={2}
                value={doctorDiagnosisNote}
                onChange={(e) => setDoctorDiagnosisNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Prescription Builder */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  e-Prescription Regimen Builder:
                </label>
                <button
                  onClick={addRxDraftRow}
                  className="text-xs text-teal-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Drug Row
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {rxDraft.map((row, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
                  >
                    <div>
                      <label className="text-[10px] text-slate-500 block">
                        Medication
                      </label>
                      <select
                        value={row.productId}
                        onChange={(e) => {
                          const prod = products.find(
                            (p) => p.id === e.target.value,
                          );
                          const newDraft = [...rxDraft];
                          newDraft[idx].productId = prod.id;
                          newDraft[idx].productName = prod.name;
                          newDraft[idx].selectedUnitName =
                            prod.units[0].unitName;
                          newDraft[idx].price = prod.units[0].price;
                          setRxDraft(newDraft);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded p-1.5"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block">
                        Unit & Qty
                      </label>
                      <div className="flex gap-1">
                        <select
                          value={row.selectedUnitName}
                          onChange={(e) => {
                            const prod = products.find(
                              (p) => p.id === row.productId,
                            );
                            const unit = prod.units.find(
                              (u) => u.unitName === e.target.value,
                            );
                            const newDraft = [...rxDraft];
                            newDraft[idx].selectedUnitName = unit.unitName;
                            newDraft[idx].price = unit.price;
                            setRxDraft(newDraft);
                          }}
                          className="w-2/3 bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded p-1.5"
                        >
                          {products
                            .find((p) => p.id === row.productId)
                            ?.units.map((u, i) => (
                              <option key={i} value={u.unitName}>
                                {u.unitName}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => {
                            const newDraft = [...rxDraft];
                            newDraft[idx].quantity =
                              parseInt(e.target.value) || 1;
                            setRxDraft(newDraft);
                          }}
                          className="w-1/3 bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded p-1.5"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 block">
                          Dosage Instructions
                        </label>
                        <input
                          type="text"
                          value={row.dosageInstruction}
                          onChange={(e) => {
                            const newDraft = [...rxDraft];
                            newDraft[idx].dosageInstruction = e.target.value;
                            setRxDraft(newDraft);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded p-1.5"
                        />
                      </div>
                      <button
                        onClick={() =>
                          setRxDraft(rxDraft.filter((_, i) => i !== idx))
                        }
                        className="text-red-400 hover:text-red-300 p-1 mt-3"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setSelectedPatientForDoctor(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={submitDoctorConsultation}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs rounded-xl font-bold transition shadow-lg shadow-teal-950 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Finalize e-Prescription & Send to
                Pharmacy POS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      {activeReceiptModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl font-mono text-xs space-y-4">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h2 className="font-black text-base uppercase tracking-wider">
                MediFlow Clinic & Pharmacy
              </h2>
              <p className="text-[10px] text-slate-600">
                No. 12, Pyay Road, Yangon
              </p>
              <p className="text-[10px] text-slate-600">Tel: +95 9 12345678</p>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{activeReceiptModal.saleId}</span>
              </div>
              <div className="flex justify-between">
                <span>Date/Time:</span>
                <span>
                  {activeReceiptModal.date} {activeReceiptModal.timestamp}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Patient:</span>
                <span className="font-bold">
                  {activeReceiptModal.patientName}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{activeReceiptModal.paymentMethod}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1.5">
              {activeReceiptModal.doctorFee > 0 && (
                <div className="flex justify-between">
                  <span>Consultation Fee</span>
                  <span>
                    {activeReceiptModal.doctorFee.toLocaleString()} Ks
                  </span>
                </div>
              )}
              {activeReceiptModal.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <div>
                    <div>{item.product ? item.product.name : "Medication"}</div>
                    <div className="text-[9px] text-slate-500">
                      {item.quantity} x{" "}
                      {item.unit ? item.unit.unitName : "unit"}
                    </div>
                  </div>
                  <div className="font-bold">
                    {item.subtotal.toLocaleString()} Ks
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm font-black pt-1">
              <span>TOTAL PAID:</span>
              <span>{activeReceiptModal.totalAmount.toLocaleString()} Ks</span>
            </div>

            <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-slate-200">
              *** Thank you for visiting MediFlow Clinic ***
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setActiveReceiptModal(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
