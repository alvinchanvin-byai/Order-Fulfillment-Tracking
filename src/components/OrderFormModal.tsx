/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { X, Package, Info, QrCode, Clipboard, Camera, AlertCircle, Sparkles, Check } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CustomerMaster, formatAccounting } from '../types';
import { safeStorage } from '../lib/storage';

const DEFAULT_CUSTOMER_MASTER: CustomerMaster[] = [
  { customerName: 'Pracheachun Pharmacy (SHV)', defaultKhan: 'Preah Sihanouk Municipali', defaultProvince: 'Preah Sihanouk' },
  { customerName: 'Ponleu Pich Cabinet', defaultKhan: 'Dangkao', defaultProvince: 'Phnom Penh' },
  { customerName: 'Cambodian Healthcare Instrument Co., Ltd', defaultKhan: 'Chamkar Mon', defaultProvince: 'Phnom Penh' },
  { customerName: 'Pharmacie Chan Penh Raksmey', defaultKhan: 'Chamkar Mon', defaultProvince: 'Phnom Penh' },
  { customerName: 'Arun Reasmey Thmey Pharmacy', defaultKhan: 'Boeung Keng Kang', defaultProvince: 'Phnom Penh' },
  { customerName: 'Tep Nimith Pharmacy (Dr. Chhorn Mony (TBK)', defaultKhan: 'Suong Municipality', defaultProvince: 'Tboung Khmum' },
  { customerName: 'MED PALACE PHARMACY', defaultKhan: 'Chbar Ampov', defaultProvince: 'Phnom Penh' }
];

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    orderId: string,
    items: string,
    customerName?: string,
    packingListNo?: string,
    totalPackage?: string,
    invoiceNumber?: string,
    khanDistrict?: string,
    cityProvince?: string,
    assignedTo?: string,
    bu?: string,
    invoiceAmount?: string
  ) => Promise<void>;
}

// Predefined option lists for Cambodia ScanFlow CRM
const CUSTOMER_OPTIONS = [
  'Alvin Chan',
  'Khan Malik',
  'Rithy Logistics',
  'Sina Distribution',
  'Phnom Penh Supermarket',
  'Angkor Retail Partners',
  'Express Cambodia'
];

const KHAN_OPTIONS = [
  'Boeng Keng Kang',
  'Chamkar Mon',
  'Chbar Ampov',
  'Chroy Changvar',
  'Dangkao',
  'Daun Penh',
  'Kamboul',
  'Meanchey',
  'Prampi Makara',
  'Prek Pnov',
  'Pou Senchey',
  'Russei Keo',
  'Sen Sok',
  'Tuol Kouk'
];

const PROVINCE_OPTIONS = [
  'Phnom Penh',
  'Siem Reap',
  'Preah Sihanouk',
  'Battambang',
  'Kampong Cham',
  'Kampong Chhnang',
  'Kampong Speu',
  'Kampong Thom',
  'Kampot',
  'Kandal',
  'Kep',
  'Koh Kong',
  'Kratie',
  'Mondulkiri',
  'Oddar Meanchey',
  'Pailin',
  'Preah Vihear',
  'Prey Veng',
  'Pursat',
  'Ratanakiri',
  'Stung Treng',
  'Svay Rieng',
  'Takeo',
  'Tboung Khmum'
];

const ASSIGNED_OPTIONS = [
  'Operator A (Lead Pick)',
  'Operator B (Lead Checker)',
  'Rider Team 1 (Express)',
  'Rider Team 2 (Bulk)',
  'Unassigned'
];

const BU_OPTIONS = [
  'BU-Sales',
  'BU-Wholesale',
  'BU-Ecommerce',
  'BU-Retail',
  'BU-InterCompany'
];

export function OrderFormModal({ isOpen, onClose, onAdd }: OrderFormModalProps) {
  // Form State
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [packingListNo, setPackingListNo] = useState('');
  const [packageUnitOptions, setPackageUnitOptions] = useState<string[]>([]);
  const [packageQty, setPackageQty] = useState('');
  const [packageUnit, setPackageUnit] = useState('ctn');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [khanDistrict, setKhanDistrict] = useState('');
  const [cityProvince, setCityProvince] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [bu, setBu] = useState('');
  const [items, setItems] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = safeStorage.getItem('scanflow_package_units');
      const list = saved ? JSON.parse(saved) : ['ctn', 'Boxes', 'drum', 'pcs', 'bags', 'pallets', 'cases', 'rolls', 'vials', 'bottles', 'pails'];
      setPackageUnitOptions(list);
      if (list.length > 0) {
        setPackageUnit(list[0]);
      }
    }
  }, [isOpen]);

  // Automatically default Khan and Province based on selected customerName
  const handleCustomerSelection = (name: string) => {
    setCustomerName(name);
    if (!name) return;

    // Load master list from local storage
    const savedMasters = safeStorage.getItem('scanflow_customer_master');
    let masters: CustomerMaster[] = DEFAULT_CUSTOMER_MASTER;
    if (savedMasters) {
      try {
        masters = JSON.parse(savedMasters);
      } catch (e) {
        console.error('Failed to parse saved customer master', e);
      }
    }

    // High fidelity resilient matching:
    // 1. Exact trimmed case-insensitive match
    // 2. Parentheses/brackets cleaned match (e.g., "Yi Kouk Clinic (BTB)" matches "Yi Kouk Clinic")
    // 3. Sub-string partial fuzzy matching as fallback
    const nameLower = name.trim().toLowerCase();
    const cleanName = name.replace(/\s*[([].*?[\])]\s*/g, '').trim().toLowerCase();

    let matched = masters.find(c => c.customerName.trim().toLowerCase() === nameLower);

    if (!matched) {
      matched = masters.find(c => {
        const cleanMasterName = c.customerName.replace(/\s*[([].*?[\])]\s*/g, '').trim().toLowerCase();
        return cleanMasterName && cleanName && cleanMasterName === cleanName;
      });
    }

    if (!matched) {
      matched = masters.find(c => {
        const cleanMasterName = c.customerName.replace(/\s*[([].*?[\])]\s*/g, '').trim().toLowerCase();
        return cleanMasterName && cleanName && (cleanName.includes(cleanMasterName) || cleanMasterName.includes(cleanName));
      });
    }

    if (matched) {
      if (matched.defaultKhan) {
        // Ensure options list supports custom defaultKhan dynamic values so that selection doesn't fail
        setKhansList(prev => {
          if (!prev.includes(matched!.defaultKhan)) {
            return [...prev, matched!.defaultKhan];
          }
          return prev;
        });
        setKhanDistrict(matched.defaultKhan);
      }
      if (matched.defaultProvince) {
        // Ensure options list supports custom defaultProvince dynamic values so that selection doesn't fail
        setProvincesList(prev => {
          if (!prev.includes(matched!.defaultProvince)) {
            return [...prev, matched!.defaultProvince];
          }
          return prev;
        });
        setCityProvince(matched.defaultProvince);
      }
    }
  };

  // Dynamic Options States synced with Setup module
  const [customersList, setCustomersList] = useState<string[]>(CUSTOMER_OPTIONS);
  const [khansList, setKhansList] = useState<string[]>(KHAN_OPTIONS);
  const [provincesList, setProvincesList] = useState<string[]>(PROVINCE_OPTIONS);
  const [busList, setBusList] = useState<string[]>(BU_OPTIONS);

  useEffect(() => {
    if (isOpen) {
      let combinedCustomers = [...CUSTOMER_OPTIONS];
      const savedCusts = safeStorage.getItem('scanflow_customers');
      if (savedCusts) {
        combinedCustomers = JSON.parse(savedCusts);
      }
      
      const savedMasters = safeStorage.getItem('scanflow_customer_master');
      if (savedMasters) {
        try {
          const parsed = JSON.parse(savedMasters) as CustomerMaster[];
          const masterNames = parsed.map(m => m.customerName);
          combinedCustomers = Array.from(new Set([...combinedCustomers, ...masterNames]));
        } catch (e) {
          console.error(e);
        }
      } else {
        const masterNames = DEFAULT_CUSTOMER_MASTER.map(m => m.customerName);
        combinedCustomers = Array.from(new Set([...combinedCustomers, ...masterNames]));
      }
      setCustomersList(combinedCustomers);
      
      const savedKhans = safeStorage.getItem('scanflow_khans');
      if (savedKhans) setKhansList(JSON.parse(savedKhans));
      
      const savedProvs = safeStorage.getItem('scanflow_provinces');
      if (savedProvs) setProvincesList(JSON.parse(savedProvs));
      
      const savedBus = safeStorage.getItem('scanflow_bus');
      if (savedBus) setBusList(JSON.parse(savedBus));

      // Retrieve currently logged-in system user and pre-fill assignedTo
      try {
        const cachedUser = safeStorage.getItem('scanflow_active_system_user');
        if (cachedUser) {
          const user = JSON.parse(cachedUser);
          if (user && user.username) {
            setAssignedTo(user.username);
          }
        }
      } catch (e) {
        console.error('Failed to pre-fill active user in assignedTo', e);
      }
    }
  }, [isOpen]);

  // Scanning Modal States
  const [activeScanField, setActiveScanField] = useState<'id' | 'packingList' | 'invoice' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

  // Initialize camera scanner inside modal if scanning is active
  useEffect(() => {
    if (!activeScanField) {
      setCameraError(null);
      setIsCameraLoading(false);
      return;
    }

    setIsCameraLoading(true);
    setCameraError(null);

    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;
    const readerElementId = 'modal-qr-reader';

    const initTimeout = setTimeout(() => {
      try {
        const modalReaderElement = document.getElementById(readerElementId);
        if (!modalReaderElement) return;

        html5QrCode = new Html5Qrcode(readerElementId);

        const formats = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF
        ];

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.floor(viewfinderWidth * 0.85);
            const height = Math.floor(viewfinderHeight * 0.65);
            return {
              width: Math.max(Math.min(width, 480), 240),
              height: Math.max(Math.min(height, 280), 140)
            };
          },
          formatsToSupport: formats,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };

        html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted && decodedText) {
              handleScanInputFill(decodedText);
            }
          },
          () => {}
        )
        .then(() => {
          if (isMounted) {
            setIsCameraLoading(false);
          }
        })
        .catch((err: any) => {
          console.error('Modal Camera start failed:', err);
          if (isMounted) {
            setCameraError(
              err?.message || 
              'Permission denied or camera in use. Please check browser permissions by tapping the lock icon in your address bar.'
            );
            setIsCameraLoading(false);
          }
        });
      } catch (err: any) {
        console.error('Modal Camera Error:', err);
        if (isMounted) {
          setCameraError('Unable to open web camera. Check browser permissions.');
          setIsCameraLoading(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch((e) => {
            console.warn('Silent modal camera tear-down:', e);
          });
        }
      }
    };
  }, [activeScanField]);

  if (!isOpen) return null;

  const handleScanInputFill = (value: string) => {
    const formatted = value.trim().toUpperCase();
    if (activeScanField === 'id') {
      setOrderId(formatted);
    } else if (activeScanField === 'packingList') {
      setPackingListNo(formatted);
    } else if (activeScanField === 'invoice') {
      setInvoiceNumber(formatted);
    }
    setActiveScanField(null);
    setCameraError(null);
  };

  const handleSelfSimulate = () => {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    if (activeScanField === 'id') {
      handleScanInputFill(`ORD-${randomSuffix}`);
    } else if (activeScanField === 'packingList') {
      handleScanInputFill(`PL-${randomSuffix}`);
    } else if (activeScanField === 'invoice') {
      handleScanInputFill(`INV-${randomSuffix}`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedId = orderId.trim().toUpperCase();
    if (!trimmedId) {
      setError('Please provide a valid Order ID/Barcode.');
      return;
    }

    // Standard alphanumeric checking
    if (!/^[A-Z0-9\-]+$/.test(trimmedId)) {
      setError('Order ID must contain only letters, numbers, and hyphens (e.g., ORD-2045).');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalTotalPackage = packageQty.trim() ? `${packageQty.trim()} ${packageUnit}`.trim() : '';

      await onAdd(
        trimmedId,
        items.trim(),
        customerName,
        packingListNo.trim(),
        finalTotalPackage,
        invoiceNumber.trim(),
        khanDistrict,
        cityProvince,
        assignedTo,
        bu,
        formatAccounting(invoiceAmount)
      );

      // Reset Form state
      setOrderId('');
      setCustomerName('');
      setPackingListNo('');
      setPackageQty('');
      setInvoiceNumber('');
      setInvoiceAmount('');
      setKhanDistrict('');
      setCityProvince('');
      setAssignedTo('');
      setBu('');
      setItems('');

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateId = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    setOrderId(`ORD-${randomNum}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-start sm:items-center justify-center sm:p-4 p-0 z-50 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-[32px] w-full max-w-4xl min-h-screen sm:min-h-0 shadow-none sm:shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] border-0 sm:border-4 border-slate-900 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 sm:my-8 my-0 flex flex-col">
        {/* Modal Header */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 bg-slate-900 text-white border-b-4 border-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-display font-black text-white text-base sm:text-xl tracking-wide uppercase">Register Sale Order</h3>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Google Sheets Operations Entry Station</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition-all border border-transparent hover:border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Scan Interface Overlay - Opens inside the modal box */}
        {activeScanField && (
          <div className="bg-slate-950 text-white p-8 space-y-6 animate-in slide-in-from-top duration-300 border-b-4 border-slate-900 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span className="font-bold text-sm tracking-widest uppercase">
                  Terminal Scan Mode: {activeScanField === 'id' ? 'Order ID' : activeScanField === 'packingList' ? 'Packing List' : 'Invoice Number'}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveScanField(null);
                  setCameraError(null);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors border border-slate-700 cursor-pointer"
              >
                Cancel Scan
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Camera view column */}
              <div className="space-y-2">
                {cameraError ? (
                  <div className="bg-red-950/30 text-rose-300 border-2 border-rose-900/60 p-4 rounded-2xl flex items-start gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-400 uppercase tracking-wide">Webcam Access Blocked</p>
                      <p className="opacity-90 mt-1 leading-normal font-medium">{cameraError}</p>
                      <p className="text-[10px] text-slate-300 mt-2 font-medium">
                        💡 Tap the lock/settings icon next to your URL address bar, allow Camera permission, and try again!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border-2 border-slate-800 shadow-inner bg-slate-900 relative min-h-[200px] flex items-center justify-center">
                    <div id="modal-qr-reader" className="w-full text-slate-100" style={{ border: 'none' }} />
                    
                    {isCameraLoading && (
                      <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-slate-350 gap-2.5">
                        <svg className="animate-spin h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-450 animate-pulse">Starting Live Feed...</span>
                      </div>
                    )}

                    {!isCameraLoading && (
                      <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full z-10 animate-pulse flex items-center gap-1">
                        <Camera className="w-3 h-3" /> Live Camera Port
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Simulation Helper Column */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest">Sandbox Simulation Panel</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans font-medium">
                  If you are working from a sandbox container or do not have a physical barcode sheet to scan, you can immediately simulate a highly realistic scanned ID with the trigger below:
                </p>
                <button
                  type="button"
                  onClick={handleSelfSimulate}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-3 border-2 border-slate-950 rounded-xl transition-all shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[-1px] cursor-pointer"
                >
                  Simulate Satisfying Scan Beep
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Registration Form Wrapper */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-4 sm:space-y-6 flex-1 flex flex-col justify-between">
          {error && (
            <div className="bg-red-50 text-red-700 text-xs p-3.5 rounded-2xl border-2 border-red-200 flex items-start gap-2.5 font-sans font-semibold">
              <Info className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* MAIN GRID FORM FIELDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Field 1: Scan or Enter ID */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Scan or Enter ID
              </label>
              <div className="flex rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900 focus-within:ring-2 focus-within:ring-slate-900">
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="ID / Barcode..."
                  className="w-full bg-slate-50 px-3 py-2 text-sm focus:bg-white outline-none uppercase font-mono font-bold"
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setActiveScanField('id')}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-950 px-3 py-2 border-l-2 border-slate-900 text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                  disabled={isSubmitting}
                  title="Scan with Camera"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            {/* Field 2: Select Customer */}
            <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Select Customer
              </label>
              <div className="rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                <select
                  value={customerName}
                  onChange={(e) => handleCustomerSelection(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2.5 text-sm focus:bg-white outline-none font-bold"
                  disabled={isSubmitting}
                >
                  <option value="">Select Customer</option>
                  {customersList.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Field 3: Packing List # */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Packing List #
              </label>
              <div className="flex rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900 focus-within:ring-2 focus-within:ring-slate-900">
                <input
                  type="text"
                  value={packingListNo}
                  onChange={(e) => setPackingListNo(e.target.value)}
                  placeholder="PL-..."
                  className="w-full bg-slate-50 px-3 py-2 text-sm focus:bg-white outline-none uppercase font-mono font-bold"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setActiveScanField('packingList')}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-950 px-3 py-2 border-l-2 border-slate-900 text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                  disabled={isSubmitting}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            {/* Row 2 - Field 5: Invoice Number */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Invoice Number
              </label>
              <div className="flex rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900 focus-within:ring-2 focus-within:ring-slate-900">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-..."
                  className="w-full bg-slate-50 px-3 py-2 text-sm focus:bg-white outline-none uppercase font-mono font-bold"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setActiveScanField('invoice')}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-950 px-3 py-2 border-l-2 border-slate-900 text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                  disabled={isSubmitting}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan</span>
                </button>
              </div>
            </div>

            {/* Row 2 - Field 5.5: Invoice Amount */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Invoice Amount
              </label>
              <div className="flex rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900 focus-within:ring-2 focus-within:ring-slate-900">
                <input
                  type="text"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  onBlur={() => setInvoiceAmount(formatAccounting(invoiceAmount))}
                  placeholder="Amount e.g. 10,000.00"
                  className="w-full bg-slate-50 px-3 py-2 text-sm focus:bg-white outline-none font-bold placeholder:text-slate-400"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Field 4: Total Package */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Total Package
              </label>
              <div className="flex gap-2">
                {/* Quantity Input */}
                <div className="flex-1 rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty e.g. 10"
                    value={packageQty}
                    onChange={(e) => setPackageQty(e.target.value)}
                    className="w-full bg-slate-50 px-3 py-2.5 text-sm focus:bg-white outline-none font-bold placeholder:text-slate-400"
                    disabled={isSubmitting}
                  />
                </div>
                {/* Unit Dropdown */}
                <div className="w-[110px] rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                  <select
                    value={packageUnit}
                    onChange={(e) => setPackageUnit(e.target.value)}
                    className="w-full bg-slate-50 px-3 py-2.5 text-sm focus:bg-white outline-none font-bold"
                    disabled={isSubmitting}
                  >
                    {packageUnitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2 - Field 6: Select Khan/District */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Select Khan / District
              </label>
              <div className="rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                <select
                  value={khanDistrict}
                  onChange={(e) => setKhanDistrict(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2.5 text-sm focus:bg-white outline-none font-bold"
                  disabled={isSubmitting}
                >
                  <option value="">Select Khan/District</option>
                  {khansList.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 - Field 7: Select City/Province */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Select City / Province
              </label>
              <div className="rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                <select
                  value={cityProvince}
                  onChange={(e) => setCityProvince(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2.5 text-sm focus:bg-white outline-none font-bold"
                  disabled={isSubmitting}
                >
                  <option value="">Select City/Province</option>
                  {provincesList.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3 - Field 9: Select BU */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Select BU
              </label>
              <div className="rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                <select
                  value={bu}
                  onChange={(e) => setBu(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2.5 text-sm focus:bg-white outline-none font-bold"
                  disabled={isSubmitting}
                >
                  <option value="">Select BU</option>
                  {busList.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 - Field 8: Select Assigned To */}
            <div className="space-y-2 col-span-1">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Started by
              </label>
              <div className="rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-slate-50 px-3 py-2.5 text-sm focus:bg-white outline-none font-bold"
                  disabled={isSubmitting}
                >
                  <option value="">Started by</option>
                  {assignedTo && !ASSIGNED_OPTIONS.includes(assignedTo) && (
                    <option value={assignedTo}>{assignedTo}</option>
                  )}
                  {ASSIGNED_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description/Special notes back-compat textbox */}
            <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-2">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                Order Items or Special Notes
              </label>
              <div className="rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900">
                <textarea
                  value={items}
                  onChange={(e) => setItems(e.target.value)}
                  placeholder="List items, descriptions, quantities, or fulfillment notes..."
                  rows={2}
                  className="w-full bg-slate-50 px-3 py-2 text-sm focus:bg-white outline-none resize-none font-medium"
                  disabled={isSubmitting}
                />
              </div>
            </div>

          </div>

          {/* Form Actions Footer */}
          <div className="pt-4 sm:pt-6 pb-6 sm:pb-0 flex flex-col md:flex-row items-center justify-between gap-4 border-t-2 border-slate-900 shrink-0">
            {/* Auto ID generating helper */}
            <button
              type="button"
              onClick={handleGenerateId}
              className="w-full md:w-auto text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 font-bold px-4 py-3 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-0.5px]"
              disabled={isSubmitting}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-bounce" />
              <span>Auto Gener ID</span>
            </button>

            <div className="w-full md:w-auto flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-3.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto text-slate-500 hover:bg-slate-100 hover:text-slate-950 font-extrabold px-5 py-3 rounded-xl text-sm transition-colors uppercase tracking-wider text-center"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              
              <button
                type="submit"
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 py-4 sm:py-3.5 border-3 border-slate-950 rounded-2xl text-sm uppercase tracking-widest transition-all shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Register Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
