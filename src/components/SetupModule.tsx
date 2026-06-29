/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, SVGProps, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { safeStorage } from '../lib/storage';
import { 
  Users, 
  MapPin, 
  Map, 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Search, 
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Download,
  Upload,
  Package
} from 'lucide-react';
import { CustomerMaster } from '../types';

const DEFAULT_CUSTOMER_MASTER: CustomerMaster[] = [
  { customerName: 'Pracheachun Pharmacy (SHV)', defaultKhan: 'Preah Sihanouk Municipali', defaultProvince: 'Preah Sihanouk' },
  { customerName: 'Ponleu Pich Cabinet', defaultKhan: 'Dangkao', defaultProvince: 'Phnom Penh' },
  { customerName: 'Cambodian Healthcare Instrument Co., Ltd', defaultKhan: 'Chamkar Mon', defaultProvince: 'Phnom Penh' },
  { customerName: 'Pharmacie Chan Penh Raksmey', defaultKhan: 'Chamkar Mon', defaultProvince: 'Phnom Penh' },
  { customerName: 'Arun Reasmey Thmey Pharmacy', defaultKhan: 'Boeung Keng Kang', defaultProvince: 'Phnom Penh' },
  { customerName: 'Tep Nimith Pharmacy (Dr. Chhorn Mony (TBK)', defaultKhan: 'Suong Municipality', defaultProvince: 'Tboung Khmum' },
  { customerName: 'MED PALACE PHARMACY', defaultKhan: 'Chbar Ampov', defaultProvince: 'Phnom Penh' }
];

const DEFAULT_CUSTOMERS = [
  'Pracheachun Pharmacy (SHV)',
  'Ponleu Pich Cabinet',
  'Cambodian Healthcare Instrument Co., Ltd',
  'Pharmacie Chan Penh Raksmey',
  'Arun Reasmey Thmey Pharmacy',
  'Tep Nimith Pharmacy (Dr. Chhorn Mony (TBK)',
  'MED PALACE PHARMACY',
  'Alvin Chan',
  'Khan Malik',
  'Rithy Logistics',
  'Sina Distribution',
  'Phnom Penh Supermarket',
  'Angkor Retail Partners',
  'Express Cambodia'
];

const DEFAULT_KHANS = [
  'Preah Sihanouk Municipali',
  'Suong Municipality',
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

const DEFAULT_PROVINCES = [
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

const DEFAULT_BUs = [
  'BU-Sales',
  'BU-Wholesale',
  'BU-Ecommerce',
  'BU-Retail',
  'BU-InterCompany'
];

const DEFAULT_PACKAGE_UNITS = [
  'ctn',
  'Boxes',
  'drum',
  'pcs',
  'bags',
  'pallets',
  'cases',
  'rolls',
  'vials',
  'bottles',
  'pails'
];

export function SetupModule() {
  // Option lists states
  const [customers, setCustomers] = useState<string[]>([]);
  const [khans, setKhans] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [bus, setBus] = useState<string[]>([]);
  const [packageUnits, setPackageUnits] = useState<string[]>([]);
  const [customerMasters, setCustomerMasters] = useState<CustomerMaster[]>([]);

  // Confirmation state for deletes/resets to bypass iframe window.confirm block
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [importChoiceModal, setImportChoiceModal] = useState<{
    isOpen: boolean;
    fileName: string;
    records: CustomerMaster[];
  } | null>(null);

  const requestConfirm = (config: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      ...config,
      isOpen: true
    });
  };

  // Search filter inputs
  const [customerSearch, setCustomerSearch] = useState('');
  const [khanSearch, setKhanSearch] = useState('');
  const [provinceSearch, setProvinceSearch] = useState('');
  const [buSearch, setBuSearch] = useState('');
  const [packageUnitSearch, setPackageUnitSearch] = useState('');
  const [customerMasterSearch, setCustomerMasterSearch] = useState('');

  // Creation text fields
  const [newCustomer, setNewCustomer] = useState('');
  const [newKhan, setNewKhan] = useState('');
  const [newProvince, setNewProvince] = useState('');
  const [newBu, setNewBu] = useState('');
  const [newPackageUnit, setNewPackageUnit] = useState('');

  // New Customer Master Form State
  const [mCustName, setMCustName] = useState('');
  const [mCustKhan, setMCustKhan] = useState('');
  const [mCustProvince, setMCustProvince] = useState('');

  // Editing indices
  const [editingCustomerIndex, setEditingCustomerIndex] = useState<number | null>(null);
  const [editingCustomerText, setEditingCustomerText] = useState('');

  const [editingKhanIndex, setEditingKhanIndex] = useState<number | null>(null);
  const [editingKhanText, setEditingKhanText] = useState('');

  const [editingProvinceIndex, setEditingProvinceIndex] = useState<number | null>(null);
  const [editingProvinceText, setEditingProvinceText] = useState('');

  const [editingBuIndex, setEditingBuIndex] = useState<number | null>(null);
  const [editingBuText, setEditingBuText] = useState('');

  const [editingPackageUnitIndex, setEditingPackageUnitIndex] = useState<number | null>(null);
  const [editingPackageUnitText, setEditingPackageUnitText] = useState('');

  // Customer Master Editing state
  const [editingMasterIndex, setEditingMasterIndex] = useState<number | null>(null);
  const [editingMCustName, setEditingMCustName] = useState('');
  const [editingMCustKhan, setEditingMCustKhan] = useState('');
  const [editingMCustProvince, setEditingMCustProvince] = useState('');

  // Notification system
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const savedCusts = safeStorage.getItem('scanflow_customers');
    setCustomers(savedCusts ? JSON.parse(savedCusts) : DEFAULT_CUSTOMERS);

    const savedKhans = safeStorage.getItem('scanflow_khans');
    setKhans(savedKhans ? JSON.parse(savedKhans) : DEFAULT_KHANS);

    const savedProvs = safeStorage.getItem('scanflow_provinces');
    setProvinces(savedProvs ? JSON.parse(savedProvs) : DEFAULT_PROVINCES);

    const savedBus = safeStorage.getItem('scanflow_bus');
    setBus(savedBus ? JSON.parse(savedBus) : DEFAULT_BUs);

    const savedPackageUnits = safeStorage.getItem('scanflow_package_units');
    setPackageUnits(savedPackageUnits ? JSON.parse(savedPackageUnits) : DEFAULT_PACKAGE_UNITS);

    const savedMasters = safeStorage.getItem('scanflow_customer_master');
    setCustomerMasters(savedMasters ? JSON.parse(savedMasters) : DEFAULT_CUSTOMER_MASTER);
  }, []);

  // Save actions
  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const updateStorage = (key: string, data: string[], message: string) => {
    safeStorage.setItem(key, JSON.stringify(data));
    showToast(message, 'success');
  };

  // Export list as standard Excel format
  const handleExportList = (list: string[], name: string, columnHeader: string = 'Item Name') => {
    if (list.length === 0) {
      showToast('Cannot export an empty list!', 'info');
      return;
    }
    try {
      // Build a simple grid representation
      const data = [
        [columnHeader], // Top row header
        ...list.map(item => [item]) // Data rows containing exactly the text items
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Registry');

      // Download file natively via SheetJS helper
      XLSX.writeFile(workbook, `${name}.xlsx`);
      showToast(`Successfully exported ${list.length} items to ${name}.xlsx`, 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message || err}`, 'info');
    }
  };

  // Import list from Excel files (.xlsx or .xls)
  const handleImportList = (
    e: ChangeEvent<HTMLInputElement>,
    targetType: 'customers' | 'khans' | 'provinces' | 'bus' | 'package_units'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          showToast('The file appears to be empty or corrupted.', 'info');
          return;
        }

        let parsedItems: string[] = [];

        // Check file extension to handle Excel or fallback plain text formats
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawSheet: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          rawSheet.forEach((row) => {
            if (!row || !Array.isArray(row)) return;
            row.forEach((cell) => {
              if (cell !== undefined && cell !== null) {
                const cellVal = String(cell).trim();
                const lowerVal = cellVal.toLowerCase();
                
                // Exclude common header names so user does not accidentally import the structural headers
                const isHeaderName = 
                  lowerVal === 'item name' ||
                  lowerVal === 'customer' ||
                  lowerVal === 'customers' ||
                  lowerVal === 'customer name' ||
                  lowerVal === 'district' ||
                  lowerVal === 'khan' ||
                  lowerVal === 'khans' ||
                  lowerVal === 'khan/district' ||
                  lowerVal === 'city' ||
                  lowerVal === 'province' ||
                  lowerVal === 'provinces' ||
                  lowerVal === 'city/province' ||
                  lowerVal === 'bu' ||
                  lowerVal === 'bus' ||
                  lowerVal === 'business unit' ||
                  lowerVal === 'business units' ||
                  lowerVal === 'unit' ||
                  lowerVal === 'units' ||
                  lowerVal === 'package unit' ||
                  lowerVal === 'package units' ||
                  lowerVal === 'package type' ||
                  lowerVal === 'pkg unit' ||
                  lowerVal === 'item' ||
                  lowerVal === 'name' ||
                  lowerVal === 'value' ||
                  lowerVal === 'registry';

                if (cellVal && !isHeaderName) {
                  parsedItems.push(cellVal);
                }
              }
            });
          });
        } else {
          // Standard plain text or csv parsed fallback
          const text = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer));
          let lines: string[] = [];
          if (file.name.endsWith('.csv')) {
            const rawLines = text.split(/\r?\n/);
            rawLines.forEach(line => {
              if (line.trim()) {
                const fields = line.split(/[,;]/);
                fields.forEach(f => {
                  const cleaned = f.replace(/^["']|["']$/g, '').trim();
                  if (cleaned) {
                    lines.push(cleaned);
                  }
                });
              }
            });
          } else {
            lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          }
          parsedItems = lines;
        }

        // Keep item lists unique
        const newItems = Array.from(new Set(parsedItems));

        if (newItems.length === 0) {
          showToast('No valid elements found in the workbook.', 'info');
          return;
        }

        const append = window.confirm(
          `Found ${newItems.length} candidate items in "${file.name}".\n\nDo you want to APPEND these to your existing list?\n\n- Click "OK" to APPEND.\n- Click "Cancel" to OVERWRITE (Replace list entirely).`
        );

        let currentList: string[] = [];
        let storageKey = '';
        let label = '';

        if (targetType === 'customers') {
          currentList = customers;
          storageKey = 'scanflow_customers';
          label = 'Customer Registry';
        } else if (targetType === 'khans') {
          currentList = khans;
          storageKey = 'scanflow_khans';
          label = 'Districts (Khan) Registry';
        } else if (targetType === 'provinces') {
          currentList = provinces;
          storageKey = 'scanflow_provinces';
          label = 'Cities / Provinces Registry';
        } else if (targetType === 'bus') {
          currentList = bus;
          storageKey = 'scanflow_bus';
          label = 'Business Units (BU) Registry';
        } else if (targetType === 'package_units') {
          currentList = packageUnits;
          storageKey = 'scanflow_package_units';
          label = 'Package Units Registry';
        }

        let updatedList: string[];
        if (append) {
          updatedList = Array.from(new Set([...currentList, ...newItems]));
        } else {
          updatedList = newItems;
        }

        // Update active hook state
        if (targetType === 'customers') {
          setCustomers(updatedList);
        } else if (targetType === 'khans') {
          setKhans(updatedList);
        } else if (targetType === 'provinces') {
          setProvinces(updatedList);
        } else if (targetType === 'bus') {
          setBus(updatedList);
        } else if (targetType === 'package_units') {
          setPackageUnits(updatedList);
        }

        // Save immediately to localStorage
        safeStorage.setItem(storageKey, JSON.stringify(updatedList));
        showToast(`Successfully registered ${updatedList.length} items to ${label}!`, 'success');
      } catch (err: any) {
        showToast(`Error processing book: ${err.message || err}`, 'info');
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // --- CRUD Functions for CUSTOMERS ---
  const handleAddCustomer = (e: FormEvent) => {
    e.preventDefault();
    const val = newCustomer.trim();
    if (!val) return;
    if (customers.some(c => c.toLowerCase() === val.toLowerCase())) {
      showToast(`customer "${val}" already exists!`, 'info');
      return;
    }
    const updated = [...customers, val];
    setCustomers(updated);
    setNewCustomer('');
    updateStorage('scanflow_customers', updated, `Added customer: ${val}`);
  };

  const handleStartEditCustomer = (index: number) => {
    setEditingCustomerIndex(index);
    setEditingCustomerText(customers[index]);
  };

  const handleSaveCustomer = (index: number) => {
    const val = editingCustomerText.trim();
    if (!val) return;
    const updated = [...customers];
    const oldVal = updated[index];
    updated[index] = val;
    setCustomers(updated);
    setEditingCustomerIndex(null);
    updateStorage('scanflow_customers', updated, `Updated customer "${oldVal}" to "${val}"`);
  };

  const handleDeleteCustomer = (index: number) => {
    const oldVal = customers[index];
    requestConfirm({
      title: 'Delete Customer',
      message: `Are you sure you want to delete customer "${oldVal}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const updated = customers.filter((_, i) => i !== index);
        setCustomers(updated);
        updateStorage('scanflow_customers', updated, `Deleted customer: ${oldVal}`);
        setConfirmModal(null);
      }
    });
  };

  // --- CRUD Functions for KHANS ---
  const handleAddKhan = (e: FormEvent) => {
    e.preventDefault();
    const val = newKhan.trim();
    if (!val) return;
    if (khans.some(k => k.toLowerCase() === val.toLowerCase())) {
      showToast(`Khan/District "${val}" already exists!`, 'info');
      return;
    }
    const updated = [...khans, val];
    setKhans(updated);
    setNewKhan('');
    updateStorage('scanflow_khans', updated, `Added Khan/District: ${val}`);
  };

  const handleStartEditKhan = (index: number) => {
    setEditingKhanIndex(index);
    setEditingKhanText(khans[index]);
  };

  const handleSaveKhan = (index: number) => {
    const val = editingKhanText.trim();
    if (!val) return;
    const updated = [...khans];
    const oldVal = updated[index];
    updated[index] = val;
    setKhans(updated);
    setEditingKhanIndex(null);
    updateStorage('scanflow_khans', updated, `Updated Khan "${oldVal}" to "${val}"`);
  };

  const handleDeleteKhan = (index: number) => {
    const oldVal = khans[index];
    requestConfirm({
      title: 'Delete Khan/District',
      message: `Are you sure you want to delete Khan/District "${oldVal}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const updated = khans.filter((_, i) => i !== index);
        setKhans(updated);
        updateStorage('scanflow_khans', updated, `Deleted Khan/District: ${oldVal}`);
        setConfirmModal(null);
      }
    });
  };

  // --- CRUD Functions for CITY/PROVINCES ---
  const handleAddProvince = (e: FormEvent) => {
    e.preventDefault();
    const val = newProvince.trim();
    if (!val) return;
    if (provinces.some(p => p.toLowerCase() === val.toLowerCase())) {
      showToast(`City/Province "${val}" already exists!`, 'info');
      return;
    }
    const updated = [...provinces, val];
    setProvinces(updated);
    setNewProvince('');
    updateStorage('scanflow_provinces', updated, `Added City/Province: ${val}`);
  };

  const handleStartEditProvince = (index: number) => {
    setEditingProvinceIndex(index);
    setEditingProvinceText(provinces[index]);
  };

  const handleSaveProvince = (index: number) => {
    const val = editingProvinceText.trim();
    if (!val) return;
    const updated = [...provinces];
    const oldVal = updated[index];
    updated[index] = val;
    setProvinces(updated);
    setEditingProvinceIndex(null);
    updateStorage('scanflow_provinces', updated, `Updated City/Province "${oldVal}" to "${val}"`);
  };

  const handleDeleteProvince = (index: number) => {
    const oldVal = provinces[index];
    requestConfirm({
      title: 'Delete City/Province',
      message: `Are you sure you want to delete City/Province "${oldVal}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const updated = provinces.filter((_, i) => i !== index);
        setProvinces(updated);
        updateStorage('scanflow_provinces', updated, `Deleted City/Province: ${oldVal}`);
        setConfirmModal(null);
      }
    });
  };

  // --- CRUD Functions for BUs ---
  const handleAddBu = (e: FormEvent) => {
    e.preventDefault();
    const val = newBu.trim();
    if (!val) return;
    if (bus.some(b => b.toLowerCase() === val.toLowerCase())) {
      showToast(`Business Unit "${val}" already exists!`, 'info');
      return;
    }
    const updated = [...bus, val];
    setBus(updated);
    setNewBu('');
    updateStorage('scanflow_bus', updated, `Added Business Unit: ${val}`);
  };

  const handleStartEditBu = (index: number) => {
    setEditingBuIndex(index);
    setEditingBuText(bus[index]);
  };

  const handleSaveBu = (index: number) => {
    const val = editingBuText.trim();
    if (!val) return;
    const updated = [...bus];
    const oldVal = updated[index];
    updated[index] = val;
    setBus(updated);
    setEditingBuIndex(null);
    updateStorage('scanflow_bus', updated, `Updated Business Unit "${oldVal}" to "${val}"`);
  };

  const handleDeleteBu = (index: number) => {
    const oldVal = bus[index];
    requestConfirm({
      title: 'Delete Business Unit',
      message: `Are you sure you want to delete Business Unit "${oldVal}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const updated = bus.filter((_, i) => i !== index);
        setBus(updated);
        updateStorage('scanflow_bus', updated, `Deleted Business Unit: ${oldVal}`);
        setConfirmModal(null);
      }
    });
  };

  // --- CRUD Functions for PACKAGE UNITS ---
  const handleAddPackageUnit = (e: FormEvent) => {
    e.preventDefault();
    const val = newPackageUnit.trim();
    if (!val) return;
    if (packageUnits.some(p => p.toLowerCase() === val.toLowerCase())) {
      showToast(`Package Unit "${val}" already exists!`, 'info');
      return;
    }
    const updated = [...packageUnits, val];
    setPackageUnits(updated);
    setNewPackageUnit('');
    updateStorage('scanflow_package_units', updated, `Added Package Unit: ${val}`);
  };

  const handleStartEditPackageUnit = (index: number) => {
    setEditingPackageUnitIndex(index);
    setEditingPackageUnitText(packageUnits[index]);
  };

  const handleSavePackageUnit = (index: number) => {
    const val = editingPackageUnitText.trim();
    if (!val) return;
    const updated = [...packageUnits];
    const oldVal = updated[index];
    updated[index] = val;
    setPackageUnits(updated);
    setEditingPackageUnitIndex(null);
    updateStorage('scanflow_package_units', updated, `Updated Package Unit "${oldVal}" to "${val}"`);
  };

  const handleDeletePackageUnit = (index: number) => {
    const oldVal = packageUnits[index];
    requestConfirm({
      title: 'Delete Package Unit',
      message: `Are you sure you want to delete Package Unit "${oldVal}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const updated = packageUnits.filter((_, i) => i !== index);
        setPackageUnits(updated);
        updateStorage('scanflow_package_units', updated, `Deleted Package Unit: ${oldVal}`);
        setConfirmModal(null);
      }
    });
  };

  // --- CRUD Functions for CUSTOMER MASTER ---
  const handleAddCustomerMaster = (e: FormEvent) => {
    e.preventDefault();
    const name = mCustName.trim();
    if (!name) return;
    if (customerMasters.some(m => m.customerName.toLowerCase() === name.toLowerCase())) {
      showToast(`Master record for "${name}" already exists!`, 'info');
      return;
    }
    const newMaster: CustomerMaster = {
      customerName: name,
      defaultKhan: mCustKhan.trim(),
      defaultProvince: mCustProvince.trim()
    };
    const updated = [...customerMasters, newMaster];
    setCustomerMasters(updated);
    setMCustName('');
    setMCustKhan('');
    setMCustProvince('');
    safeStorage.setItem('scanflow_customer_master', JSON.stringify(updated));
    showToast(`Added Customer Master: ${name}`);
  };

  const handleStartEditCustomerMaster = (index: number) => {
    setEditingMasterIndex(index);
    const m = customerMasters[index];
    setEditingMCustName(m.customerName);
    setEditingMCustKhan(m.defaultKhan);
    setEditingMCustProvince(m.defaultProvince);
  };

  const handleSaveCustomerMaster = (index: number) => {
    const name = editingMCustName.trim();
    if (!name) return;
    const updated = [...customerMasters];
    const oldName = updated[index].customerName;
    updated[index] = {
      customerName: name,
      defaultKhan: editingMCustKhan.trim(),
      defaultProvince: editingMCustProvince.trim()
    };
    setCustomerMasters(updated);
    setEditingMasterIndex(null);
    safeStorage.setItem('scanflow_customer_master', JSON.stringify(updated));
    showToast(`Updated Customer Master "${oldName}" to "${name}"`);
  };

  const handleDeleteCustomerMaster = (index: number) => {
    const oldName = customerMasters[index].customerName;
    requestConfirm({
      title: 'Delete Customer Master Rule',
      message: `Are you sure you want to delete the Customer Master routing rules for "${oldName}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const updated = customerMasters.filter((_, i) => i !== index);
        setCustomerMasters(updated);
        safeStorage.setItem('scanflow_customer_master', JSON.stringify(updated));
        showToast(`Deleted Customer Master: ${oldName}`);
        setConfirmModal(null);
      }
    });
  };

  const handleExportMasterList = () => {
    if (customerMasters.length === 0) {
      showToast('Cannot export an empty list!', 'info');
      return;
    }
    try {
      const data = [
        ['Customer Name', 'Default Khan/District', 'Default City/Province'],
        ...customerMasters.map(m => [m.customerName, m.defaultKhan, m.defaultProvince])
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CustomerMaster');

      XLSX.writeFile(workbook, `Customer_Master_List.xlsx`);
      showToast(`Successfully exported ${customerMasters.length} master records.`, 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message || err}`, 'info');
    }
  };

  const handleImportMasterList = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          showToast('The file appears to be empty or corrupted.', 'info');
          return;
        }

        let parsedMasters: CustomerMaster[] = [];

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawSheet: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          rawSheet.forEach((row, idx) => {
            if (!row || !Array.isArray(row) || idx === 0) return;
            const custName = row[0] ? String(row[0]).trim() : '';
            const defKhan = row[1] ? String(row[1]).trim() : '';
            const defProv = row[2] ? String(row[2]).trim() : '';

            if (custName) {
              parsedMasters.push({
                customerName: custName,
                defaultKhan: defKhan,
                defaultProvince: defProv
              });
            }
          });
        } else {
          const text = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer));
          let lines: string[] = [];
          if (file.name.endsWith('.csv')) {
            const rawLines = text.split(/\r?\n/);
            rawLines.forEach((line, idx) => {
              if (idx === 0) return; // skip header
              if (line.trim()) {
                const fields = line.split(/[,;]/).map(f => f.replace(/^["']|["']$/g, '').trim());
                if (fields[0]) {
                  parsedMasters.push({
                    customerName: fields[0],
                    defaultKhan: fields[1] || '',
                    defaultProvince: fields[2] || ''
                  });
                }
              }
            });
          } else {
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            lines.forEach((line, idx) => {
              if (idx === 0) return; // skip header
              const fields = line.split('\t');
              if (fields[0]) {
                parsedMasters.push({
                  customerName: fields[0],
                  defaultKhan: fields[1] || '',
                  defaultProvince: fields[2] || ''
                });
              }
            });
          }
        }

        if (parsedMasters.length === 0) {
          showToast('No valid elements found in the workbook.', 'info');
          return;
        }

        setImportChoiceModal({
          isOpen: true,
          fileName: file.name,
          records: parsedMasters
        });
      } catch (err: any) {
        showToast(`Error processing book: ${err.message || err}`, 'info');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExecuteImport = (append: boolean) => {
    if (!importChoiceModal) return;
    const { records } = importChoiceModal;
    let updated: CustomerMaster[];

    if (append) {
      const existingMap = new Map<string, CustomerMaster>();
      customerMasters.forEach(m => existingMap.set(m.customerName.toLowerCase(), m));
      records.forEach(m => existingMap.set(m.customerName.toLowerCase(), m));
      updated = Array.from(existingMap.values());
    } else {
      updated = records;
    }

    setCustomerMasters(updated);
    safeStorage.setItem('scanflow_customer_master', JSON.stringify(updated));
    showToast(`Successfully imported ${updated.length} customer master records!`, 'success');
    setImportChoiceModal(null);
  };

  // Reset to presets helper
  const handleResetToPresets = () => {
    requestConfirm({
      title: 'Restore Custom Parameters',
      message: 'Are you sure you want to restore ALL settings to original ScanFlow parameters? Any custom entries you registered (custom customers, khans, cities, business units, package units, or customer master rules) will be lost.',
      confirmLabel: 'Restore Presets',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        setCustomers(DEFAULT_CUSTOMERS);
        setKhans(DEFAULT_KHANS);
        setProvinces(DEFAULT_PROVINCES);
        setBus(DEFAULT_BUs);
        setPackageUnits(DEFAULT_PACKAGE_UNITS);
        setCustomerMasters(DEFAULT_CUSTOMER_MASTER);
        safeStorage.setItem('scanflow_customers', JSON.stringify(DEFAULT_CUSTOMERS));
        safeStorage.setItem('scanflow_khans', JSON.stringify(DEFAULT_KHANS));
        safeStorage.setItem('scanflow_provinces', JSON.stringify(DEFAULT_PROVINCES));
        safeStorage.setItem('scanflow_bus', JSON.stringify(DEFAULT_BUs));
        safeStorage.setItem('scanflow_package_units', JSON.stringify(DEFAULT_PACKAGE_UNITS));
        safeStorage.setItem('scanflow_customer_master', JSON.stringify(DEFAULT_CUSTOMER_MASTER));
        showToast('Successfully restored default registry values.', 'success');
        setConfirmModal(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Small top header with Restore button, without the large banner */}
      <div className="flex justify-end items-center">
        <button
          type="button"
          onClick={handleResetToPresets}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl border-2 border-slate-900 text-xs font-extrabold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
          <span>Restore Setup Presets</span>
        </button>
      </div>

      {/* Embedded toast notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white border-2 border-indigo-400 rounded-2xl flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] max-w-sm animate-fade-in animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="text-xs font-bold font-sans tracking-wide">{notification.text}</span>
        </div>
      )}

      {/* Complete Parameter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">

        {/* 1. CUSTOMER LIST */}
        <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col h-[565px]">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                <Users className="w-4 h-4" />
              </span>
              <span className="font-black text-slate-900 font-display text-sm uppercase tracking-wide">
                1. Customer Registry
              </span>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono font-bold text-slate-500">
              {customers.length} Items
            </span>
          </div>

          {/* Import / Export Tools Row */}
          <div className="flex gap-2 mb-3 shrink-0">
            <button
              type="button"
              onClick={() => handleExportList(customers, 'scanflow_customers', 'Customer Name')}
              className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-none"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <label className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              <span>Import Excel/CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => handleImportList(e, 'customers')}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Create Form */}
          <form onSubmit={handleAddCustomer} className="flex gap-2 mb-3 shrink-0">
            <input
              type="text"
              placeholder="Add new customer name..."
              value={newCustomer}
              onChange={(e) => setNewCustomer(e.target.value)}
              className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold focus:bg-white outline-none"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 active:translate-y-[1px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Filter search */}
          <div className="relative mb-3 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-400"
            />
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto border-2 border-slate-200 rounded-2xl bg-slate-50/20 divide-y divide-slate-100">
            {customers
              .map((val, idx) => ({ val, idx }))
              .filter(item => item.val.toLowerCase().includes(customerSearch.toLowerCase()))
              .map(({ val, idx }) => {
                const isEditing = editingCustomerIndex === idx;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editingCustomerText}
                          onChange={(e) => setEditingCustomerText(e.target.value)}
                          className="bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-black flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCustomer(idx)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded-lg border border-slate-900"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCustomerIndex(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1 rounded-lg border border-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-800 font-sans tracking-wide truncate pr-2">
                          {val}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditCustomer(idx)}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(idx)}
                            className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            {customers.filter(item => item.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                No matching customers found.
              </div>
            )}
          </div>
        </div>

        {/* 2. KHAN / DISTRICT LIST */}
        <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col h-[565px]">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                <MapPin className="w-4 h-4" />
              </span>
              <span className="font-black text-slate-900 font-display text-sm uppercase tracking-wide">
                2. Districts (Khan) Registry
              </span>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono font-bold text-slate-500">
              {khans.length} Items
            </span>
          </div>

          {/* Import / Export Tools Row */}
          <div className="flex gap-2 mb-3 shrink-0">
            <button
              type="button"
              onClick={() => handleExportList(khans, 'scanflow_khans', 'District (Khan)')}
              className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-none"
            >
              <Download className="w-3.5 h-3.5 text-orange-500" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <label className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5 text-orange-500" />
              <span>Import Excel/CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => handleImportList(e, 'khans')}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Create Form */}
          <form onSubmit={handleAddKhan} className="flex gap-2 mb-3 shrink-0">
            <input
              type="text"
              placeholder="Add new Khan/District..."
              value={newKhan}
              onChange={(e) => setNewKhan(e.target.value)}
              className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold focus:bg-white outline-none"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 active:translate-y-[1px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Filter search */}
          <div className="relative mb-3 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search districts..."
              value={khanSearch}
              onChange={(e) => setKhanSearch(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-400"
            />
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto border-2 border-slate-200 rounded-2xl bg-slate-50/20 divide-y divide-slate-100">
            {khans
              .map((val, idx) => ({ val, idx }))
              .filter(item => item.val.toLowerCase().includes(khanSearch.toLowerCase()))
              .map(({ val, idx }) => {
                const isEditing = editingKhanIndex === idx;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editingKhanText}
                          onChange={(e) => setEditingKhanText(e.target.value)}
                          className="bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-black flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveKhan(idx)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded-lg border border-slate-900"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingKhanIndex(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1 rounded-lg border border-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-800 font-sans tracking-wide truncate pr-2">
                          {val}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditKhan(idx)}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKhan(idx)}
                            className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            {khans.filter(item => item.toLowerCase().includes(khanSearch.toLowerCase())).length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                No matching districts found.
              </div>
            )}
          </div>
        </div>

        {/* 3. CITY / PROVINCE LIST */}
        <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col h-[565px]">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                <Map className="w-4 h-4" />
              </span>
              <span className="font-black text-slate-900 font-display text-sm uppercase tracking-wide">
                3. Cities / Provinces Registry
              </span>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono font-bold text-slate-500">
              {provinces.length} Items
            </span>
          </div>

          {/* Import / Export Tools Row */}
          <div className="flex gap-2 mb-3 shrink-0">
            <button
              type="button"
              onClick={() => handleExportList(provinces, 'scanflow_provinces', 'City or Province')}
              className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-none"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <label className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Excel/CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => handleImportList(e, 'provinces')}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Create Form */}
          <form onSubmit={handleAddProvince} className="flex gap-2 mb-3 shrink-0">
            <input
              type="text"
              placeholder="Add new City/Province..."
              value={newProvince}
              onChange={(e) => setNewProvince(e.target.value)}
              className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold focus:bg-white outline-none"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 active:translate-y-[1px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Filter search */}
          <div className="relative mb-3 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search cities/provinces..."
              value={provinceSearch}
              onChange={(e) => setProvinceSearch(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-400"
            />
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto border-2 border-slate-200 rounded-2xl bg-slate-50/20 divide-y divide-slate-100">
            {provinces
              .map((val, idx) => ({ val, idx }))
              .filter(item => item.val.toLowerCase().includes(provinceSearch.toLowerCase()))
              .map(({ val, idx }) => {
                const isEditing = editingProvinceIndex === idx;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editingProvinceText}
                          onChange={(e) => setEditingProvinceText(e.target.value)}
                          className="bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-black flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveProvince(idx)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded-lg border border-slate-900"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProvinceIndex(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1 rounded-lg border border-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-800 font-sans tracking-wide truncate pr-2">
                          {val}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditProvince(idx)}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProvince(idx)}
                            className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            {provinces.filter(item => item.toLowerCase().includes(provinceSearch.toLowerCase())).length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                No matching cities/provinces found.
              </div>
            )}
          </div>
        </div>

        {/* 4. BUSINESS UNIT (BU) LIST */}
        <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col h-[565px]">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                <Briefcase className="w-4 h-4" />
              </span>
              <span className="font-black text-slate-900 font-display text-sm uppercase tracking-wide">
                4. Business Units (BU) Registry
              </span>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono font-bold text-slate-500">
              {bus.length} Items
            </span>
          </div>

          {/* Import / Export Tools Row */}
          <div className="flex gap-2 mb-3 shrink-0">
            <button
              type="button"
              onClick={() => handleExportList(bus, 'scanflow_bus', 'Business Unit')}
              className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-none"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <label className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5 text-blue-500" />
              <span>Import Excel/CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => handleImportList(e, 'bus')}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Create Form */}
          <form onSubmit={handleAddBu} className="flex gap-2 mb-3 shrink-0">
            <input
              type="text"
              placeholder="Add new Business Unit..."
              value={newBu}
              onChange={(e) => setNewBu(e.target.value)}
              className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold focus:bg-white outline-none"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 active:translate-y-[1px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Filter search */}
          <div className="relative mb-3 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Business Units..."
              value={buSearch}
              onChange={(e) => setBuSearch(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-400"
            />
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto border-2 border-slate-200 rounded-2xl bg-slate-50/20 divide-y divide-slate-100">
            {bus
              .map((val, idx) => ({ val, idx }))
              .filter(item => item.val.toLowerCase().includes(buSearch.toLowerCase()))
              .map(({ val, idx }) => {
                const isEditing = editingBuIndex === idx;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editingBuText}
                          onChange={(e) => setEditingBuText(e.target.value)}
                          className="bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-black flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveBu(idx)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded-lg border border-slate-900"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBuIndex(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1 rounded-lg border border-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-800 font-sans tracking-wide truncate pr-2">
                          {val}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditBu(idx)}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBu(idx)}
                            className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            {bus.filter(item => item.toLowerCase().includes(buSearch.toLowerCase())).length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                No matching Business Units found.
              </div>
            )}
          </div>
        </div>

        {/* 5. PACKAGE UNITS REGISTRY */}
        <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col h-[565px]">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                <Package className="w-4 h-4" />
              </span>
              <span className="font-black text-slate-900 font-display text-sm uppercase tracking-wide">
                5. Package Units Registry
              </span>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono font-bold text-slate-500">
              {packageUnits.length} Items
            </span>
          </div>

          {/* Import / Export Tools Row */}
          <div className="flex gap-2 mb-3 shrink-0">
            <button
              type="button"
              onClick={() => handleExportList(packageUnits, 'scanflow_package_units', 'Package Unit')}
              className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-none"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <label className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              <span>Import Excel/CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => handleImportList(e, 'package_units')}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Create Form */}
          <form onSubmit={handleAddPackageUnit} className="flex gap-2 mb-3 shrink-0">
            <input
              type="text"
              placeholder="Add new Package Unit..."
              value={newPackageUnit}
              onChange={(e) => setNewPackageUnit(e.target.value)}
              className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold focus:bg-white outline-none"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 active:translate-y-[1px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Filter search */}
          <div className="relative mb-3 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Package Units..."
              value={packageUnitSearch}
              onChange={(e) => setPackageUnitSearch(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-400"
            />
          </div>

          {/* List display */}
          <div className="flex-1 overflow-y-auto border-2 border-slate-200 rounded-2xl bg-slate-50/20 divide-y divide-slate-100">
            {packageUnits
              .map((val, idx) => ({ val, idx }))
              .filter(item => item.val.toLowerCase().includes(packageUnitSearch.toLowerCase()))
              .map(({ val, idx }) => {
                const isEditing = editingPackageUnitIndex === idx;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editingPackageUnitText}
                          onChange={(e) => setEditingPackageUnitText(e.target.value)}
                          className="bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-black flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePackageUnit(idx)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded-lg border border-slate-900"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPackageUnitIndex(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1 rounded-lg border border-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-800 font-sans tracking-wide truncate pr-2">
                          {val}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditPackageUnit(idx)}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePackageUnit(idx)}
                            className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            {packageUnits.filter(item => item.toLowerCase().includes(packageUnitSearch.toLowerCase())).length === 0 && (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                No matching Package Units found.
              </div>
            )}
          </div>
        </div>

        {/* 6. CUSTOMER MASTER LIST */}
        <div id="customer-master-section" className="col-span-1 md:col-span-2 lg:col-span-2 bg-white rounded-3xl border-2 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col min-h-[500px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-100 pb-3 mb-4 gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="font-black text-slate-900 font-display text-sm uppercase tracking-wide">
                6. Customer Master List (Default Routing)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono font-bold text-slate-500 shrink-0">
                {customerMasters.length} Entries
              </span>
            </div>
          </div>

          {/* Import / Export Tools Row */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4 shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportMasterList}
                className="py-1.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-500" />
                <span>Export Excel (.xlsx)</span>
              </button>
              <label className="py-1.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center">
                <Upload className="w-3.5 h-3.5 text-indigo-500" />
                <span>Import Excel/CSV</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleImportMasterList}
                  className="hidden"
                />
              </label>
            </div>
            <div className="hidden sm:block flex-1"></div>
            
            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search master list..."
                value={customerMasterSearch}
                onChange={(e) => setCustomerMasterSearch(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold focus:bg-white outline-none"
              />
            </div>
          </div>

          {/* Quick Create Fields */}
          <form onSubmit={handleAddCustomerMaster} className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-900 mb-4 shrink-0">
            <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-3">Add Customer Routing Rules</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pracheachun Pharmacy (SHV)"
                  value={mCustName}
                  onChange={(e) => setMCustName(e.target.value)}
                  className="w-full bg-white border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Default Khan / District</label>
                <select
                  value={mCustKhan}
                  onChange={(e) => setMCustKhan(e.target.value)}
                  className="w-full bg-white border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
                  required
                >
                  <option value="">Select Khan...</option>
                  {khans.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase">Default City / Province</label>
                <select
                  value={mCustProvince}
                  onChange={(e) => setMCustProvince(e.target.value)}
                  className="w-full bg-white border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
                  required
                >
                  <option value="">Select Province...</option>
                  {provinces.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 active:translate-y-[1px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Rule</span>
              </button>
            </div>
          </form>

          {/* Master List Records Table */}
          <div className="flex-1 overflow-y-auto max-h-[350px] border-2 border-slate-900 rounded-2xl bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-900">
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">Customer Name</th>
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">Default Khan</th>
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">Default Province</th>
                  <th className="px-4 py-2.5 text-[10px] font-extrabold uppercase text-slate-700 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {customerMasters
                  .map((m, idx) => ({ m, idx }))
                  .filter(({ m }) => m.customerName.toLowerCase().includes(customerMasterSearch.toLowerCase()))
                  .map(({ m, idx }) => {
                    const isEditing = editingMasterIndex === idx;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        {isEditing ? (
                          <>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={editingMCustName}
                                onChange={(e) => setEditingMCustName(e.target.value)}
                                className="w-full bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-bold"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={editingMCustKhan}
                                onChange={(e) => setEditingMCustKhan(e.target.value)}
                                className="w-full bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-bold"
                              >
                                {khans.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={editingMCustProvince}
                                onChange={(e) => setEditingMCustProvince(e.target.value)}
                                className="w-full bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-xs font-bold"
                              >
                                {provinces.map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomerMaster(idx)}
                                  className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-lg"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMasterIndex(null)}
                                  className="p-1 hover:bg-slate-150 text-slate-400 rounded-lg"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-xs font-bold text-slate-900">{m.customerName}</td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-600">
                              <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg border border-indigo-100 text-[10px]">
                                {m.defaultKhan || 'Not Set'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-500">{m.defaultProvince || 'Not Set'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCustomerMaster(idx)}
                                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomerMaster(idx)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                {customerMasters.filter((m) => m.customerName.toLowerCase().includes(customerMasterSearch.toLowerCase())).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400 text-xs italic">
                      No customer master rules found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ⚠️ STATE DRIVEN CUSTOM CONFIRMATION MODAL TO BYPASS IFRAME window.confirm BLOCKS */}
      {confirmModal && confirmModal.isOpen && (
        <div id="setup-confirm-modal" className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-150">
            {/* Header highlight */}
            <div className={`h-1.5 ${confirmModal.isDestructive ? 'bg-rose-500' : 'bg-slate-900'}`} />
            
            <div className="p-6">
              <h3 className="font-display font-black text-slate-900 text-sm uppercase tracking-wider mb-2">
                {confirmModal.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t-2 border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-1.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-150 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {confirmModal.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`py-1.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900 ${
                  confirmModal.isDestructive
                    ? 'bg-rose-500 hover:bg-rose-600'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📥 DEDICATED CUSTOM IMPORT SELECTION MODAL */}
      {importChoiceModal && importChoiceModal.isOpen && (
        <div id="setup-import-choice-modal" className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-155">
            <div className="h-1.5 bg-indigo-500" />
            
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="p-1 px-2 bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black uppercase font-mono">
                  Excel / CSV
                </span>
                <span className="text-[10px] text-slate-500 font-bold max-w-full truncate">
                  {importChoiceModal.fileName}
                </span>
              </div>
              <h3 className="font-display font-black text-slate-900 text-sm uppercase tracking-wider mb-2">
                Import Customer Master Rules
              </h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                Found <span className="text-indigo-600 font-black">{importChoiceModal.records.length}</span> records in your file. How do you want to integrate these into your existing registry?
              </p>
              
              <div className="grid grid-cols-1 gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => handleExecuteImport(true)}
                  className="w-full text-left p-3 border-2 border-slate-900 rounded-2xl hover:bg-indigo-50/50 transition-all flex items-start gap-3 group cursor-pointer"
                >
                  <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg font-black shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Plus className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase">Append to Existing Records</h4>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Keep existing rules and append new records. Duplicates will be ignored.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteImport(false)}
                  className="w-full text-left p-3 border-2 border-slate-900 rounded-2xl hover:bg-rose-50/50 transition-all flex items-start gap-3 group cursor-pointer"
                >
                  <span className="p-1.5 bg-rose-100 text-rose-600 rounded-lg font-black shrink-0 mt-0.5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase">Overwrite Entire List</h4>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5 bg-rose-50 text-rose-705 font-mono inline-block px-1 rounded">WARNING</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">This will completely erase all current customer master rules and replace them with the file.</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t-2 border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setImportChoiceModal(null)}
                className="py-1.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-150 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel / Abort
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Temporary internal fallback in case icon was not explicitly passed
function SlidersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </svg>
  );
}
