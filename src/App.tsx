/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef, FormEvent } from 'react';
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  Camera,
  Keyboard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  ArrowRight,
  UserCheck,
  Power,
  Database,
  ExternalLink,
  Trash2,
  MapPin,
  ChevronRight,
  Sparkles,
  Barcode,
  History,
  FileCheck,
  Edit3,
  QrCode,
  MessageSquare,
  FileText,
  Settings
} from 'lucide-react';

import type { Order, OrderStage, ScanResult, SpreadsheetConfig } from './types';
import {
  initAuth,
  googleSignIn,
  logout,
  fetchOrdersFromSheet,
  addOrderToSheet,
  updateOrderInSheet,
  createOrderSpreadsheet,
  ensureOrdersSheetExists,
  setCachedToken
} from './lib/sheets';

import { CameraScanner } from './components/CameraScanner';
import { OrderFormModal } from './components/OrderFormModal';
import { EditOrderModal } from './components/EditOrderModal';
import { DeliveryStatusModal, DeliveryOutcome } from './components/DeliveryStatusModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { SetupModule } from './components/SetupModule';

export default function App() {
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Spreadsheet config state
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  const [spreadsheetName, setSpreadsheetName] = useState<string>('');
  const [isConfiguringSheet, setIsConfiguringSheet] = useState(false);
  const [sheetIdInput, setSheetIdInput] = useState('');

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Registered' | 'Picking' | 'Checking' | 'Delivery' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modals / Dialogs State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeliveryOutcomeOpen, setIsDeliveryOutcomeOpen] = useState(false);
  const [pendingDeliveryOrderId, setPendingDeliveryOrderId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {}
  });

  // Scanner Terminal State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanLogs, setScanLogs] = useState<ScanResult[]>([]);
  const [manualScanMessage, setManualScanMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [currentTab, setCurrentTab] = useState<'registry' | 'scanner' | 'setup'>('registry');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Initialize auth
  useEffect(() => {
    initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setCachedToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );

    // Retrieve saved spreadsheet from localStorage
    const savedConfig = localStorage.getItem('order_tracker_sheet_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as SpreadsheetConfig;
        setSpreadsheetId(config.spreadsheetId);
        setSpreadsheetUrl(config.spreadsheetUrl);
        setSpreadsheetName(config.sheetName || 'Order Fulfillment & Barcode Tracker');
      } catch (e) {
        console.error('Failed to parse saved spreadsheet config', e);
      }
    }
  }, []);

  // Sync / Fetch Orders when Spreadsheet ID or Token changes
  useEffect(() => {
    if (token && spreadsheetId) {
      handleRefreshOrders();
    }
  }, [token, spreadsheetId]);

  // Handle Google OAuth Sign-In
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setCachedToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Oauth login failed', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Log Out
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setCachedToken(null);
    setNeedsAuth(true);
    setOrders([]);
    setSelectedOrder(null);
  };

  // Create or Connect Google Sheets
  const handleCreateNewSheet = async () => {
    if (!token) return;
    setIsLoadingOrders(true);
    try {
      const newSheet = await createOrderSpreadsheet(token);
      setSpreadsheetId(newSheet.id);
      setSpreadsheetUrl(newSheet.url);
      setSpreadsheetName('Order Fulfillment & Barcode Tracker');

      const config: SpreadsheetConfig = {
        spreadsheetId: newSheet.id,
        spreadsheetUrl: newSheet.url,
        sheetName: 'Order Fulfillment & Barcode Tracker'
      };
      localStorage.setItem('order_tracker_sheet_config', JSON.stringify(config));
      setIsConfiguringSheet(false);
    } catch (err: any) {
      alert(err.message || 'Could not create spreadsheet in Drive.');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleConnectExistingSheet = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !sheetIdInput.trim()) return;

    setIsLoadingOrders(true);
    try {
      // Validate spreadsheet access & set tab "Orders"
      await ensureOrdersSheetExists(token, sheetIdInput.trim());
      
      const constructedUrl = `https://docs.google.com/spreadsheets/d/${sheetIdInput.trim()}/edit`;
      setSpreadsheetId(sheetIdInput.trim());
      setSpreadsheetUrl(constructedUrl);
      setSpreadsheetName('Connected Custom Spreadsheet');

      const config: SpreadsheetConfig = {
        spreadsheetId: sheetIdInput.trim(),
        spreadsheetUrl: constructedUrl,
        sheetName: 'Connected Custom Spreadsheet'
      };
      localStorage.setItem('order_tracker_sheet_config', JSON.stringify(config));
      setIsConfiguringSheet(false);
      setSheetIdInput('');
    } catch (err: any) {
      alert('Error connecting sheet: ' + (err.message || 'Make sure the Spreadsheet ID is correct and you have permission to access it.'));
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Pull orders from sheets
  const handleRefreshOrders = async () => {
    if (!token || !spreadsheetId) return;
    setIsLoadingOrders(true);
    try {
      const fetched = await fetchOrdersFromSheet(token, spreadsheetId);
      setOrders(fetched);
      
      // Update selected order details reference if it is active
      if (selectedOrder) {
        const updatedSelected = fetched.find(o => o.id === selectedOrder.id);
        if (updatedSelected) {
          setSelectedOrder(updatedSelected);
        }
      }
    } catch (err: any) {
      console.error('Fetch orders failed', err);
      if (err.message?.includes('401') || err.message?.includes('authenticated')) {
        // Token might have expired, trigger re-authentication
        setNeedsAuth(true);
      }
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Quick Seed Sample Demo Orders
  const handleSeedMockData = async () => {
    if (!token || !spreadsheetId) return;
    setIsLoadingOrders(true);
    try {
      const sampleOrders: Order[] = [
        {
          id: 'ORD-1001',
          status: 'PENDING_PICKING',
          pickStart: '',
          pickEnd: '',
          checkStart: '',
          checkEnd: '',
          deliveryStart: '',
          deliveryEnd: '',
          items: '3x Active Smartwatch Series X, 1x Charging Cradle',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'ORD-1002',
          status: 'READY_CHECKING',
          pickStart: new Date(Date.now() - 3600000).toISOString(),
          pickEnd: new Date(Date.now() - 3000000).toISOString(),
          checkStart: '',
          checkEnd: '',
          deliveryStart: '',
          deliveryEnd: '',
          items: '2x Wireless Noise-Cancelling Earphones Pro',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'ORD-1003',
          status: 'READY_DELIVERY',
          pickStart: new Date(Date.now() - 7200000).toISOString(),
          pickEnd: new Date(Date.now() - 6700000).toISOString(),
          checkStart: new Date(Date.now() - 6500000).toISOString(),
          checkEnd: new Date(Date.now() - 6000000).toISOString(),
          deliveryStart: '',
          deliveryEnd: '',
          items: '1x Ergonomic Lumbar Mesh Office Chair (Black)',
          lastUpdated: new Date().toISOString()
        }
      ];

      let seedRowNum = 2;
      for (const order of sampleOrders) {
        await addOrderToSheet(token, spreadsheetId, order, seedRowNum++);
      }
      await handleRefreshOrders();
    } catch (err: any) {
      alert('Error seeding demo orders: ' + err.message);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Add highly robust Order creation
  const handleAddOrderSubmit = async (
    orderId: string,
    items: string,
    customerName?: string,
    packingListNo?: string,
    totalPackage?: string,
    invoiceNumber?: string,
    khanDistrict?: string,
    cityProvince?: string,
    assignedTo?: string,
    bu?: string
  ) => {
    if (!token || !spreadsheetId) return;

    // Reject duplicates client side
    if (orders.some(o => o.id === orderId)) {
      throw new Error(`Order with ID ${orderId} already exists in the system.`);
    }

    const newOrder: Order = {
      id: orderId,
      status: 'REGISTERED',
      pickStart: '',
      pickEnd: '',
      checkStart: '',
      checkEnd: '',
      deliveryStart: '',
      deliveryEnd: '',
      items: items,
      lastUpdated: new Date().toISOString(),
      customerName: customerName || '',
      packingListNo: packingListNo || '',
      totalPackage: totalPackage || '',
      invoiceNumber: invoiceNumber || '',
      khanDistrict: khanDistrict || '',
      cityProvince: cityProvince || '',
      assignedTo: assignedTo || '',
      bu: bu || ''
    };

    const nextRow = orders.length + 2;
    await addOrderToSheet(token, spreadsheetId, newOrder, nextRow);
    await handleRefreshOrders();
    
    // Auto insert an audit/scan log for creation
    addScanReceipt({
      orderId: orderId,
      previousStage: 'REGISTERED',
      newStage: 'REGISTERED',
      timestamp: new Date().toLocaleTimeString(),
      message: `System: Registered new order with items.`,
      success: true
    });
  };

  // Manage logs
  const addScanReceipt = (log: ScanResult) => {
    setScanLogs(prev => [log, ...prev].slice(0, 30)); // Keep last 30 scans
  };

  // Scan progress Advance Logic (Auto scan state transition)
  const processBarcodeScan = async (barcode: string) => {
    const cleaned = barcode.trim().toUpperCase();
    if (!cleaned) return;

    // Reset indicator messages
    setManualScanMessage(null);

    const order = orders.find(o => o.id === cleaned);

    if (!order) {
      const errMsg = `Scan Failed: Order ID "${cleaned}" not found. Verify ID or register first.`;
      setManualScanMessage({ text: errMsg, isError: true });
      addScanReceipt({
        orderId: cleaned,
        previousStage: 'PENDING_PICKING',
        newStage: 'PENDING_PICKING',
        timestamp: new Date().toLocaleTimeString(),
        message: errMsg,
        success: false
      });
      triggerBeep(false);
      return;
    }

    const timestamp = new Date().toISOString();
    let updatedOrder = { ...order, lastUpdated: timestamp };
    let prevStage = order.status;
    let nextStage = order.status;
    let actionDescr = '';

    switch (order.status) {
      case 'REGISTERED':
      case 'PENDING_PICKING':
        nextStage = 'PICKING_STARTED';
        updatedOrder.status = nextStage;
        updatedOrder.pickStart = timestamp;
        actionDescr = 'Picked Start (1st scan logged)';
        break;

      case 'PICKING_STARTED':
        nextStage = 'READY_CHECKING';
        updatedOrder.status = nextStage;
        updatedOrder.pickEnd = timestamp;
        actionDescr = 'Picked Complete (2nd scan logged). Automatically transitioned to checking Queue.';
        break;

      case 'READY_CHECKING':
        nextStage = 'CHECKING_STARTED';
        updatedOrder.status = nextStage;
        updatedOrder.checkStart = timestamp;
        actionDescr = 'Check Start (1st scan logged)';
        break;

      case 'CHECKING_STARTED':
        nextStage = 'READY_DELIVERY';
        updatedOrder.status = nextStage;
        updatedOrder.checkEnd = timestamp;
        actionDescr = 'Check Complete (2nd scan logged). Transferred to delivery tracking.';
        break;

      case 'READY_DELIVERY':
        nextStage = 'DELIVERY_STARTED';
        updatedOrder.status = nextStage;
        updatedOrder.deliveryStart = timestamp;
        actionDescr = 'Delivery Dispatch Started (1st scan logged)';
        break;

      case 'DELIVERY_STARTED':
        // Second delivery scan requires outcome prompt modal
        setPendingDeliveryOrderId(order.id);
        setIsDeliveryOutcomeOpen(true);
        triggerBeep(true);
        return; // Halt process here, resumed in outcome prompt

      case 'DELIVERED_SUCCESS':
      case 'DELIVERED_INCOMPLETE':
      case 'DELIVERED_RETURN':
        const completedMsg = `Scan Warning: "${cleaned}" is already completed and reached final destination status.`;
        setManualScanMessage({ text: completedMsg, isError: true });
        addScanReceipt({
          orderId: cleaned,
          previousStage: order.status,
          newStage: order.status,
          timestamp: new Date().toLocaleTimeString(),
          message: completedMsg,
          success: false
        });
        triggerBeep(false);
        return;

      default:
        return;
    }

    // Write change back to Spreadsheet
    setIsLoadingOrders(true);
    try {
      await updateOrderInSheet(token!, spreadsheetId, orders, updatedOrder);
      
      // Update local state to reflect instantly
      setOrders(prev => prev.map(o => o.id === cleaned ? updatedOrder : o));
      if (selectedOrder?.id === cleaned) {
        setSelectedOrder(updatedOrder);
      }

      setManualScanMessage({ text: `Approved: ${cleaned} moved to ${getStageLabel(nextStage)}`, isError: false });
      addScanReceipt({
        orderId: cleaned,
        previousStage: prevStage,
        newStage: nextStage,
        timestamp: new Date().toLocaleTimeString(),
        message: actionDescr,
        success: true
      });
      triggerBeep(true);
    } catch (err: any) {
      console.error(err);
      setManualScanMessage({ text: `Save error: ${err.message || 'Connection failed'}`, isError: true });
      triggerBeep(false);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Audio system beep for satisfying scan outcomes
  const triggerBeep = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio fallback silent
    }
  };

  // Submit delivery outcome selection (Success, Incomplete, Return)
  const handleDeliveryOutcomeSubmit = async (outcome: DeliveryOutcome) => {
    if (!token || !spreadsheetId || !pendingDeliveryOrderId) return;
    setIsDeliveryOutcomeOpen(false);

    const order = orders.find(o => o.id === pendingDeliveryOrderId);
    if (!order) return;

    setIsLoadingOrders(true);
    const timestamp = new Date().toISOString();
    
    let nextStage: OrderStage = 'DELIVERED_SUCCESS';
    if (outcome === 'Incomplete') nextStage = 'DELIVERED_INCOMPLETE';
    if (outcome === 'Return') nextStage = 'DELIVERED_RETURN';

    const updatedOrder: Order = {
      ...order,
      status: nextStage,
      deliveryEnd: timestamp,
      lastUpdated: timestamp
    };

    try {
      await updateOrderInSheet(token, spreadsheetId, orders, updatedOrder);
      
      setOrders(prev => prev.map(o => o.id === pendingDeliveryOrderId ? updatedOrder : o));
      if (selectedOrder?.id === pendingDeliveryOrderId) {
        setSelectedOrder(updatedOrder);
      }

      setManualScanMessage({
        text: `Success: Order ${pendingDeliveryOrderId} delivery complete. Status logged as: [${outcome}]`,
        isError: false
      });

      addScanReceipt({
        orderId: pendingDeliveryOrderId,
        previousStage: 'DELIVERY_STARTED',
        newStage: nextStage,
        timestamp: new Date().toLocaleTimeString(),
        message: `Delivery finalized as ${outcome} (2nd scan complete).`,
        success: true
      });
      triggerBeep(true);
    } catch (err: any) {
      alert('Failed to save to Google Sheets: ' + (err.message || 'Connection lost'));
    } finally {
      setIsLoadingOrders(false);
      setPendingDeliveryOrderId(null);
    }
  };

  const getQuickActionConfig = (status: OrderStage) => {
    switch (status) {
      case 'REGISTERED':
      case 'PENDING_PICKING':
        return { label: 'Start Picking', color: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-300' };
      case 'PICKING_STARTED':
        return { label: 'Finish Picking', color: 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300' };
      case 'READY_CHECKING':
        return { label: 'Start Check', color: 'bg-purple-100 hover:bg-purple-200 text-purple-950 border-purple-300' };
      case 'CHECKING_STARTED':
        return { label: 'Finish Check', color: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border-indigo-300' };
      case 'READY_DELIVERY':
        return { label: 'Start Delivery', color: 'bg-teal-100 hover:bg-teal-200 text-teal-950 border-teal-300' };
      case 'DELIVERY_STARTED':
        return { label: 'Fulfill', color: 'bg-rose-100 hover:bg-rose-200 text-rose-950 border-rose-300' };
      default:
        return null;
    }
  };

  const handleAdvanceStageClick = async (order: Order, nextStageOverride?: OrderStage) => {
    if (!token || !spreadsheetId) return;

    setIsLoadingOrders(true);
    const timestamp = new Date().toISOString();
    let updatedOrder = { ...order, lastUpdated: timestamp };
    let prevStage = order.status;
    let nextStage = order.status;
    let actionDescr = '';

    if (nextStageOverride) {
      nextStage = nextStageOverride;
      updatedOrder.status = nextStage;
      if (nextStage === 'PICKING_STARTED' && !updatedOrder.pickStart) updatedOrder.pickStart = timestamp;
      if (nextStage === 'READY_CHECKING' && !updatedOrder.pickEnd) updatedOrder.pickEnd = timestamp;
      if (nextStage === 'CHECKING_STARTED' && !updatedOrder.checkStart) updatedOrder.checkStart = timestamp;
      if (nextStage === 'READY_DELIVERY' && !updatedOrder.checkEnd) updatedOrder.checkEnd = timestamp;
      if (nextStage === 'DELIVERY_STARTED' && !updatedOrder.deliveryStart) updatedOrder.deliveryStart = timestamp;
      if (['DELIVERED_SUCCESS', 'DELIVERED_INCOMPLETE', 'DELIVERED_RETURN'].includes(nextStage)) {
        updatedOrder.deliveryEnd = timestamp;
      }
      actionDescr = `Manual progression override to ${getStageLabel(nextStage)}`;
    } else {
      switch (order.status) {
        case 'REGISTERED':
        case 'PENDING_PICKING':
          nextStage = 'PICKING_STARTED';
          updatedOrder.status = nextStage;
          updatedOrder.pickStart = timestamp;
          actionDescr = 'Picked Start (process begun)';
          break;

        case 'PICKING_STARTED':
          nextStage = 'READY_CHECKING';
          updatedOrder.status = nextStage;
          updatedOrder.pickEnd = timestamp;
          actionDescr = 'Picked Complete. Automatically transitioned to checking Queue.';
          break;

        case 'READY_CHECKING':
          nextStage = 'CHECKING_STARTED';
          updatedOrder.status = nextStage;
          updatedOrder.checkStart = timestamp;
          actionDescr = 'Check Start (verification begun)';
          break;

        case 'CHECKING_STARTED':
          nextStage = 'READY_DELIVERY';
          updatedOrder.status = nextStage;
          updatedOrder.checkEnd = timestamp;
          actionDescr = 'Check Complete. Transferred to delivery tracking.';
          break;

        case 'READY_DELIVERY':
          nextStage = 'DELIVERY_STARTED';
          updatedOrder.status = nextStage;
          updatedOrder.deliveryStart = timestamp;
          actionDescr = 'Delivery Dispatch Started';
          break;

        case 'DELIVERY_STARTED':
          // Delivery complete requires choosing outcome
          setPendingDeliveryOrderId(order.id);
          setIsDeliveryOutcomeOpen(true);
          setIsLoadingOrders(false);
          return;

        default:
          setIsLoadingOrders(false);
          return;
      }
    }

    try {
      await updateOrderInSheet(token, spreadsheetId, orders, updatedOrder);
      setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(updatedOrder);
      }

      addScanReceipt({
        orderId: order.id,
        previousStage: prevStage,
        newStage: nextStage,
        timestamp: new Date().toLocaleTimeString(),
        message: `Status advanced: ${actionDescr}`,
        success: true
      });
      triggerBeep(true);
    } catch (err: any) {
      alert('Failed to advance order stage: ' + (err.message || 'Error occurred'));
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Manual action handler (e.g. override state or delete)
  const triggerManualOverride = (stage: OrderStage) => {
    if (!selectedOrder) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Explicit Stage Override',
      message: `You are manually overriding the stage of Order ${selectedOrder.id} to "${getStageLabel(stage)}". This action will alter timestamps and state inside Google Sheets.`,
      confirmText: 'Yes, Override Row',
      onConfirm: async () => {
        setConfirmDialog(p => ({ ...p, isOpen: false }));
        if (!token || !spreadsheetId) return;

        setIsLoadingOrders(true);
        const timestamp = new Date().toISOString();
        const updatedOrder: Order = {
          ...selectedOrder,
          status: stage,
          lastUpdated: timestamp
        };

        // Initialize state timestamps if forced forwards cleanly
        if (stage === 'PICKING_STARTED' && !updatedOrder.pickStart) updatedOrder.pickStart = timestamp;
        if (stage === 'READY_CHECKING' && !updatedOrder.pickEnd) updatedOrder.pickEnd = timestamp;
        if (stage === 'CHECKING_STARTED' && !updatedOrder.checkStart) updatedOrder.checkStart = timestamp;
        if (stage === 'READY_DELIVERY' && !updatedOrder.checkEnd) updatedOrder.checkEnd = timestamp;
        if (stage === 'DELIVERY_STARTED' && !updatedOrder.deliveryStart) updatedOrder.deliveryStart = timestamp;
        if (stage.startsWith('DELIVERED-') || stage.startsWith('DELIVERED')) {
          if (!updatedOrder.deliveryEnd) updatedOrder.deliveryEnd = timestamp;
        }

        try {
          await updateOrderInSheet(token, spreadsheetId, orders, updatedOrder);
          setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
          setSelectedOrder(updatedOrder);
          
          addScanReceipt({
            orderId: selectedOrder.id,
            previousStage: selectedOrder.status,
            newStage: stage,
            timestamp: new Date().toLocaleTimeString(),
            message: `Operator: Manual stage override applied to ${getStageLabel(stage)}.`,
            success: true
          });
        } catch (err: any) {
          alert('Failed to override stage in Google Sheets: ' + err.message);
        } finally {
          setIsLoadingOrders(false);
        }
      }
    });
  };

  // Update order fields inside Google Sheets and local state
  const handleUpdateOrder = async (originalId: string, updatedOrder: Order) => {
    if (!token || !spreadsheetId) {
      throw new Error("Authentication or Google Sheets configuration is missing.");
    }

    setIsLoadingOrders(true);
    try {
      // Call update API with the sheet update function supporting original lookup ID
      await updateOrderInSheet(token, spreadsheetId, orders, updatedOrder, originalId);

      // Swap the order inside the local collection
      setOrders(prev => prev.map(o => o.id === originalId ? updatedOrder : o));

      // Synchronize active selected order details
      if (selectedOrder?.id === originalId) {
        setSelectedOrder(updatedOrder);
      }

      // Add audit scanning receipt logs
      addScanReceipt({
        orderId: updatedOrder.id,
        previousStage: selectedOrder?.status || updatedOrder.status,
        newStage: updatedOrder.status,
        timestamp: new Date().toLocaleTimeString(),
        message: `System: Order master fields (SO#, Customer, PL#, Invoice) edited & synced successfully.`,
        success: true
      });
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Remove / delete order row from sheets
  const triggerRemoveOrder = () => {
    if (!selectedOrder) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Remove Order Tracking Row',
      message: `This will erase tracking record for Order ID ${selectedOrder.id}.\nThe row inside the "Orders" sheet will be cleared. Do you want to proceed?`,
      confirmText: 'Yes, Erase Record',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog(p => ({ ...p, isOpen: false }));
        if (!token || !spreadsheetId) return;

        setIsLoadingOrders(true);
        
        // Find row index
        const index = orders.findIndex(o => o.id === selectedOrder.id);
        if (index === -1) return;

        try {
          // Clear the data of this row in Google Sheets
          const rowNum = index + 2;
          const range = `Orders!A${rowNum}:J${rowNum}`;
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
          
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!res.ok) throw new Error('Could not clear row from sheet.');

          addScanReceipt({
            orderId: selectedOrder.id,
            previousStage: selectedOrder.status,
            newStage: 'PENDING_PICKING',
            timestamp: new Date().toLocaleTimeString(),
            message: `Operator: Removed tracking row completely from Sheets.`,
            success: true
          });

          setSelectedOrder(null);
          await handleRefreshOrders();
        } catch (err: any) {
          alert('Failed to delete order from Google Sheets: ' + err.message);
        } finally {
          setIsLoadingOrders(false);
        }
      }
    });
  };

  // Manual key-in scan submit
  const handleKeyInScanSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processBarcodeScan(barcodeInput.trim());
    setBarcodeInput('');
    
    // Maintain input focus
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  };

  // Helper Labels & badges
  const getStageLabel = (stage: OrderStage): string => {
    switch (stage) {
      case 'REGISTERED': return 'Order Registered';
      case 'PENDING_PICKING': return 'Awaiting Picking';
      case 'PICKING_STARTED': return 'Picking Started';
      case 'READY_CHECKING': return 'Picking Done (Ready Check)';
      case 'CHECKING_STARTED': return 'Checking Started';
      case 'READY_DELIVERY': return 'Checked Done (Ready Delivery)';
      case 'DELIVERY_STARTED': return 'In Delivery';
      case 'DELIVERED_SUCCESS': return 'Delivered - Success';
      case 'DELIVERED_INCOMPLETE': return 'Delivered - Incomplete';
      case 'DELIVERED_RETURN': return 'Delivered - Return';
      default: return stage;
    }
  };

  const getStageBadgeColor = (stage: OrderStage): string => {
    switch (stage) {
      case 'REGISTERED':
        return 'bg-sky-50 text-sky-950 border-2 border-slate-900';
      case 'PENDING_PICKING':
        return 'bg-slate-100 text-slate-900 border-2 border-slate-900';
      case 'PICKING_STARTED':
        return 'bg-amber-100 text-amber-950 border-2 border-slate-900';
      case 'READY_CHECKING':
        return 'bg-blue-100 text-blue-950 border-2 border-slate-900';
      case 'CHECKING_STARTED':
        return 'bg-purple-100 text-purple-950 border-2 border-slate-900';
      case 'READY_DELIVERY':
        return 'bg-indigo-100 text-indigo-950 border-2 border-slate-900';
      case 'DELIVERY_STARTED':
        return 'bg-teal-100 text-teal-950 border-2 border-slate-900';
      case 'DELIVERED_SUCCESS':
        return 'bg-emerald-100 text-emerald-950 border-2 border-slate-900';
      case 'DELIVERED_INCOMPLETE':
        return 'bg-yellow-100 text-yellow-950 border-2 border-slate-900';
      case 'DELIVERED_RETURN':
        return 'bg-rose-100 text-rose-950 border-2 border-slate-900';
      default:
        return 'bg-slate-100 text-slate-700 border-2 border-slate-900';
    }
  };

  // Calculations for KPI numbers
  const totalCount = orders.length;
  const inRegisteredCount = orders.filter(o => o.status === 'REGISTERED').length;
  const inPickingCount = orders.filter(o => o.status === 'PENDING_PICKING' || o.status === 'PICKING_STARTED').length;
  const inCheckingCount = orders.filter(o => o.status === 'READY_CHECKING' || o.status === 'CHECKING_STARTED').length;
  const inDeliveryCount = orders.filter(o => o.status === 'READY_DELIVERY' || o.status === 'DELIVERY_STARTED').length;
  
  const successDeliveries = orders.filter(o => o.status === 'DELIVERED_SUCCESS').length;
  const incompleteDeliveries = orders.filter(o => o.status === 'DELIVERED_INCOMPLETE').length;
  const returnedDeliveries = orders.filter(o => o.status === 'DELIVERED_RETURN').length;
  const totalCompleted = successDeliveries + incompleteDeliveries + returnedDeliveries;

  // Render stage icon
  const getStageStatusIcon = (stage: OrderStage) => {
    if (stage.startsWith('DELIVERED')) return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    return <Clock className="w-5 h-5 text-indigo-500 animate-pulse" />;
  };

  // Filter & Search computation
  const filteredOrders = orders.filter(o => {
    // Stage Filter
    if (activeFilter === 'Registered' && o.status !== 'REGISTERED') return false;
    if (activeFilter === 'Picking' && !(o.status === 'PENDING_PICKING' || o.status === 'PICKING_STARTED')) return false;
    if (activeFilter === 'Checking' && !(o.status === 'READY_CHECKING' || o.status === 'CHECKING_STARTED')) return false;
    if (activeFilter === 'Delivery' && !(o.status === 'READY_DELIVERY' || o.status === 'DELIVERY_STARTED')) return false;
    if (activeFilter === 'Completed' && !o.status.startsWith('DELIVERED')) return false;

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return o.id.toLowerCase().includes(query) || o.items.toLowerCase().includes(query);
    }
    return true;
  });

  const renderKpiSection = () => (
    <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 flex flex-col justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
      <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1.5">
        <History className="w-4 h-4 text-slate-500" /> System KPI Indicators
      </h4>
      
      <div className="flex justify-around items-center flex-wrap gap-4 py-2">
        <div className="text-center px-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Active</p>
          <p className="text-3xl font-black font-display text-slate-900">{totalCount}</p>
        </div>
        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
        <div className="text-center px-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registered</p>
          <p className="text-3xl font-black font-display text-sky-600">{inRegisteredCount}</p>
        </div>
        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
        <div className="text-center px-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">In Picking</p>
          <p className="text-3xl font-black font-display text-blue-600">{inPickingCount}</p>
        </div>
        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
        <div className="text-center px-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">In Checking</p>
          <p className="text-3xl font-black font-display text-amber-500">{inCheckingCount}</p>
        </div>
        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
        <div className="text-center px-2 text-emerald-600">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completed</p>
          <p className="text-3xl font-black font-display text-emerald-600">{totalCompleted}</p>
        </div>
      </div>

      {totalCompleted > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between font-mono p-2.5 bg-slate-50 rounded-xl border-2 border-slate-900 text-[10px] gap-2">
            <span className="text-emerald-600 font-bold flex items-center gap-1">✔ Success: {successDeliveries}</span>
            <span className="text-amber-600 font-bold flex items-center gap-1">⚠ Incomplete: {incompleteDeliveries}</span>
            <span className="text-rose-600 font-bold flex items-center gap-1">↺ Return: {returnedDeliveries}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderLiveLogsSection = () => (
    <div className="bg-slate-50 border-2 border-slate-900 rounded-3xl p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] min-h-[300px]">
      <div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tracking-wider flex items-center gap-1.5 mb-4">
          <FileCheck className="w-4 h-4 text-slate-500" /> Live Activity Log
        </h4>
        <div className="space-y-4 max-h-[220px] overflow-y-auto font-sans pr-1 scrollbar-thin">
          {scanLogs.length === 0 ? (
            <div className="text-slate-400 py-10 text-center italic text-xs font-semibold">Waiting for terminal scanning events...</div>
          ) : (
            scanLogs.map((log, lIdx) => (
              <div key={lIdx} className="flex gap-3 items-start border-l-2 border-emerald-500 pl-4 py-1 animate-in fade-in slide-in-from-left-2 duration-150">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 font-bold">[{log.timestamp}]</p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    <strong className="text-slate-950 font-bold font-mono">{log.orderId}</strong>:{' '}
                    <span className={log.success ? 'text-slate-650 font-medium' : 'text-rose-600 font-bold'}>{log.message}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {spreadsheetUrl && (
        <a
          href={spreadsheetUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full mt-4 py-3 bg-white border-2 border-slate-900 text-center font-bold tracking-widest text-[10px] uppercase text-slate-700 hover:bg-slate-50 rounded-xl transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] inline-block"
        >
          View Connected Sheet
        </a>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] relative selection:bg-slate-900/10 text-slate-900 font-sans">
      
      {/* Top Bento Professional App Header */}
      <header className="sticky top-0 bg-white border-b-2 border-slate-900 px-6 py-4 flex items-center justify-between z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-950">
            <Barcode className="w-6 h-6 stroke-[1.75]" />
          </div>
          <div>
            <h1 className="font-display font-black text-slate-900 text-2xl uppercase tracking-tight leading-none">
              ScanFlow <span className="font-normal text-slate-400">v2.4</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Fulfillment Terminal
            </p>
          </div>
        </div>

        {/* User state / Google Sheets connection state controls */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Status</p>
              <p className="text-xs font-semibold text-emerald-600">● Script Connected</p>
            </div>
            <div className="h-8 w-[1px] bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Station ID</p>
              <p className="text-xs font-semibold text-slate-700 font-mono">Terminal-Node-04</p>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-slate-200 hidden lg:block"></div>

          {needsAuth ? (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button text-xs select-none shadow-sm hover:shadow-md transition-shadow active:scale-95 duration-150 border-2 border-slate-900 rounded-xl"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents pr-2">Sign in to sync Google Sheets</span>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {/* Sheets connection status widget */}
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800 max-w-[200px] truncate">
                  {user.displayName || user.email}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 justify-end uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Google Active
                </span>
              </div>

              {spreadsheetId ? (
                <div className="flex items-center gap-1.5 bg-slate-50 border-2 border-slate-900 py-1.5 px-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Database className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
                    {spreadsheetName}
                  </span>
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-slate-950 transition-colors p-0.5 ml-1"
                    title="Open sheet in new window"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-900" />
                  </a>
                  <button
                    onClick={() => setIsConfiguringSheet(true)}
                    className="text-[10px] font-bold text-slate-900 hover:text-slate-500 ml-1.5 underline-offset-2 hover:underline uppercase tracking-wider"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsConfiguringSheet(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl border-2 border-slate-900 transition-colors flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Database className="w-3.5 h-3.5" /> Setup Spreadsheet
                </button>
              )}

              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                title="Disconnect from Google"
              >
                <Power className="w-4 h-4 text-slate-900" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Sheets Integration Configure Modal/Bar if logged in and not configured */}
      {isConfiguringSheet && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden transform animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-display font-semibold text-slate-800 text-lg">Set up Order Storage Spreadsheet</h3>
              <button
                onClick={() => setIsConfiguringSheet(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                Cancel
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="text-slate-600 text-sm space-y-2">
                <p>
                  To track scan stages dynamically, please configure where you want data to be stored. We store records securely in high-contrast columns on Google Sheets.
                </p>
                <p className="font-semibold text-slate-800">Choose one option below:</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create Sheets */}
                <button
                  onClick={handleCreateNewSheet}
                  className="flex flex-col items-center justify-center p-5 text-center bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-all group"
                >
                  <Plus className="w-8 h-8 text-brand-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-slate-800 text-sm">Create New Spreadsheet</span>
                  <span className="text-xs text-slate-500 mt-1">Create a formatted template directly in your Google Drive</span>
                </button>

                {/* Connect spreadsheet ID */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block mb-2">Connect Existing File</span>
                    <span className="text-xs text-slate-500 block mb-2">Paste your existing Google Sheet ID below:</span>
                  </div>
                  <form onSubmit={handleConnectExistingSheet} className="space-y-2">
                    <input
                      type="text"
                      value={sheetIdInput}
                      onChange={(e) => setSheetIdInput(e.target.value)}
                      placeholder="e.g. 1aBCDeFGhIJKlMnOpQ..."
                      className="bg-white border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 w-full font-mono outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                    <button
                      type="submit"
                      className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-3 py-1.5 rounded-lg w-full transition-colors"
                    >
                      Connect File
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {/* Tab Selection Row */}
        {token && spreadsheetId && (
          <div className="flex border-2 border-slate-900 rounded-2xl p-1 bg-slate-100 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] select-none">
            <button
              type="button"
              onClick={() => {
                setCurrentTab('registry');
                setScannerActive(false); // disable camera scanner when leaving scanner tab to save power/battery
              }}
              className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                currentTab === 'registry'
                  ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Order Registry & Catalog</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentTab('scanner');
              }}
              className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
                currentTab === 'scanner'
                  ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4 text-emerald-500" />
              <span>Barcode Scanner Terminal</span>
              {scannerActive && (
                <span className="absolute top-2 right-4 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentTab('setup');
                setScannerActive(false); // disable camera scanner when leaving scanner tab to save power/battery
              }}
              className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                currentTab === 'setup'
                  ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Settings className="w-4 h-4 text-indigo-500" />
              <span>Setup & Configurations</span>
            </button>
          </div>
        )}

        {currentTab === 'setup' ? (
          <SetupModule />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN */}
          <section className={`space-y-6 flex flex-col ${
            currentTab === 'registry' ? 'lg:col-span-4' : 'lg:col-span-6'
          }`}>
            
            {/* Scanner Terminal Card */}
            {currentTab === 'scanner' && (
              <div className="bg-slate-900 rounded-3xl border-2 border-slate-900 p-6 relative overflow-hidden flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-white">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-display font-black text-slate-150 uppercase tracking-widest text-xs">
                        Ready to Scan
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Register Order Button */}
                      <button
                        type="button"
                        disabled={!spreadsheetId}
                        onClick={() => setIsAddModalOpen(true)}
                        className="text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl border-2 border-slate-950 flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!spreadsheetId ? 'Requires connecting to Google Sheets' : ''}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register Order</span>
                      </button>

                      {/* Scanner Interface Toggle */}
                      <button
                        type="button"
                        onClick={() => setScannerActive(!scannerActive)}
                        className={`text-xs font-bold px-4 py-2 rounded-xl border-2 flex items-center gap-1.5 transition-all outline-none ${
                          scannerActive
                            ? 'bg-amber-500 text-white border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{scannerActive ? 'Disable Camera' : 'Enable Camera'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Real-time Web Video QR/Barcode Scanner portal */}
                  <div className="mb-4">
                    <CameraScanner onScanSuccess={processBarcodeScan} active={scannerActive} />
                  </div>

                  {/* Barcode Manual Keyin / Barcode gun listener Input */}
                  <form onSubmit={handleKeyInScanSubmit} className="space-y-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Position Barcode or Type Code
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Wait for input..."
                          className="bg-slate-800 border-2 border-slate-700 rounded-xl pl-11 pr-4 py-3 w-full text-emerald-400 text-sm font-mono font-bold outline-none focus:bg-slate-800 focus:border-emerald-500 transition-all placeholder:text-slate-600 uppercase"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-5 rounded-xl border-2 border-slate-950 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                      >
                        Send Scan
                      </button>
                    </div>
                  </form>

                  {/* Scan Toast Outcome Screen */}
                  {manualScanMessage && (
                    <div
                      className={`mt-4 p-3.5 rounded-xl border-2 flex items-start gap-2.5 text-xs animate-in slide-in-from-top-2 duration-150 font-semibold ${
                        manualScanMessage.isError
                          ? 'bg-red-950/55 text-red-200 border-red-900'
                          : 'bg-emerald-950/55 text-emerald-200 border-emerald-900'
                      }`}
                    >
                      {manualScanMessage.isError ? (
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <span>{manualScanMessage.text}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 mt-5 pt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
                  💡 <span className="text-slate-400">Scan Workflow rule:</span> Standard scanning cycles through stages sequentially from Picking ➔ Checking ➔ Delivery ➔ Outcome.
                </div>
              </div>
            )}

            {currentTab === 'registry' && (
              <>
                {renderKpiSection()}
                {renderLiveLogsSection()}
              </>
            )}

          </section>

        {/* RIGHT COLUMN */}
        <section className={`space-y-6 flex flex-col ${
          currentTab === 'registry' ? 'lg:col-span-8' : 'lg:col-span-6'
        }`}>
          
          {/* Main List Management Panel */}
          {currentTab === 'registry' ? (
            <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 flex flex-col flex-1 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b-2 border-slate-900 pb-5">
              
              <div>
                <h2 className="font-display font-black text-slate-900 text-lg flex items-center gap-2 uppercase tracking-tight">
                  <Package className="w-5 h-5 text-slate-900" /> Order Registry
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                  Connect & track live fulfillment logs in real-time
                </p>
              </div>

              {/* Interactive Registry Trigger button */}
              <button
                disabled={!spreadsheetId}
                onClick={() => setIsAddModalOpen(true)}
                className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!spreadsheetId ? 'Requires connecting to Google Sheets' : ''}
              >
                <Plus className="w-4 h-4 text-emerald-400" /> Register Order
              </button>

            </div>

            {/* Filter tab row */}
            <div className="flex items-center flex-wrap gap-1 bg-slate-100 rounded-xl p-1 mb-4 text-xs font-bold border-2 border-slate-900">
              {(['All', 'Registered', 'Picking', 'Checking', 'Delivery', 'Completed'] as const).map(tab => {
                const count = tab === 'All' ? totalCount
                            : tab === 'Registered' ? inRegisteredCount
                            : tab === 'Picking' ? inPickingCount
                            : tab === 'Checking' ? inCheckingCount
                            : tab === 'Delivery' ? inDeliveryCount
                            : tab === 'Completed' ? totalCompleted : 0;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`flex-1 min-w-[80px] py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-lg transition-all cursor-pointer ${
                      activeFilter === tab
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>{tab}</span>
                    <span className={`inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-full font-extrabold transition-all min-w-[18px] ${
                      activeFilter === tab
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Query Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders in list by ID or description items..."
                className="bg-slate-50 border-2 border-slate-900 rounded-xl pl-11 pr-4 py-3 w-full text-xs font-semibold outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Table or Card list container */}
            <div className="flex-1 overflow-y-auto max-h-[360px] min-h-[220px] scrollbar-thin">
              {isLoadingOrders && orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <RefreshCw className="w-7 h-7 animate-spin text-brand-600 mb-2" />
                  <span className="text-xs font-semibold">Loading orders from Google Sheets...</span>
                </div>
              ) : !spreadsheetId ? (
                <div className="border border-amber-100 bg-amber-50/50 p-6 rounded-2xl text-center text-sm text-amber-800 max-w-md mx-auto my-10 space-y-3">
                  <Database className="w-8 h-8 text-amber-500 mx-auto" />
                  <h4 className="font-bold">Persistent Google Sheet storage required</h4>
                  <p className="text-xs text-amber-700/90 leading-relaxed">
                    Please log in with Google and setup a spreadsheet destination first to begin writing and reading order records in real-time.
                  </p>
                  <button
                    onClick={() => {
                      if (needsAuth) {
                        handleLogin();
                      } else {
                        setIsConfiguringSheet(true);
                      }
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl border border-amber-600/10 transition-colors inline-block"
                  >
                    Set up now
                  </button>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                  <Package className="w-9 h-9 opacity-40 mb-2" />
                  <span className="text-xs font-semibold">No orders found in catalog.</span>
                  
                  {orders.length === 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        Your connected sheet is empty! Seed mock sample orders to experiment with the terminal scanners.
                      </p>
                      <button
                        onClick={handleSeedMockData}
                        className="bg-slate-100 hover:bg-slate-250 hover:text-slate-800 text-slate-700 border border-slate-200 text-xs font-semibold px-4 py-1.5 rounded-xl transition-all inline-block"
                      >
                        Seed Demo Orders
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map(order => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-3.5 relative group hover:bg-slate-50/50 ${
                        selectedOrder?.id === order.id
                          ? 'border-slate-900 bg-slate-50/50 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] translate-y-[-1px]'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      {/* Top order summary */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {order.lastUpdated && (
                            <span className="font-sans font-bold text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded tracking-wide shrink-0">
                              {(() => {
                                try {
                                  const d = new Date(order.lastUpdated);
                                  return isNaN(d.getTime()) 
                                    ? order.lastUpdated 
                                    : d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                } catch (err) {
                                  return order.lastUpdated;
                                }
                              })()}
                            </span>
                          )}
                          <span className="bg-slate-100 border border-slate-300 font-mono font-bold text-[10px] text-slate-700 px-1.5 py-0.5 rounded tracking-wide uppercase shrink-0">
                            SO#
                          </span>
                          <span className="font-mono font-black text-sm text-slate-800 group-hover:text-slate-950 transition-colors">
                            {order.id}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 md:opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsEditModalOpen(true);
                            }}
                            className="bg-amber-100/80 hover:bg-amber-100 text-amber-950 font-sans font-bold text-[10px] uppercase px-2  py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-amber-200"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>
                          {(() => {
                            const qa = getQuickActionConfig(order.status);
                            if (!qa) return null;
                            return (
                              <button
                                onClick={() => handleAdvanceStageClick(order)}
                                className={`font-sans font-bold text-[10px] uppercase px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer border shadow-[1px_1px_0px_0px_rgba(0,0,0,0.15)] active:translate-y-[1px] select-none ${qa.color}`}
                              >
                                <span>{qa.label}</span>
                              </button>
                            );
                          })()}
                          <span className={`text-[10px] px-2.5 py-1 border font-bold rounded-full uppercase shrink-0 ${getStageBadgeColor(order.status)}`}>
                            {getStageLabel(order.status)}
                          </span>
                        </div>
                      </div>

                      {/* Info Metadata section */}
                      {(order.customerName || order.packingListNo || order.invoiceNumber || order.totalPackage || order.assignedTo || order.khanDistrict || order.cityProvince) && (
                        <div className="flex flex-col gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-150 text-[11px] font-sans">
                          {/* 1st line: Customer Name & Location */}
                          {(order.customerName || order.khanDistrict || order.cityProvince) && (
                            <div className="flex items-center gap-1.5 flex-wrap text-slate-850">
                              {order.customerName && (
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider shrink-0">Cust:</span>
                                  <span className="font-bold text-slate-800 text-[13px] break-words">{order.customerName}</span>
                                </div>
                              )}
                              {(order.khanDistrict || order.cityProvince) && (
                                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                  <span className="text-slate-300 select-none text-[11px] font-medium font-sans">|</span>
                                  {order.khanDistrict && (
                                    <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-100 text-[10px] select-all">
                                      {order.khanDistrict}
                                    </span>
                                  )}
                                  {order.cityProvince && (
                                    <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md border border-slate-250 text-[10px] select-all">
                                      {order.cityProvince}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2nd line: PL#, INV# */}
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">PL#:</span>
                              <span className={`font-mono font-bold bg-white border rounded px-1.5 py-0.5 select-all ${order.packingListNo ? 'text-slate-800 border-slate-200' : 'text-slate-400 border-slate-200'}`}>
                                {order.packingListNo || 'NA'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">INV#:</span>
                              <span className={`font-mono font-bold bg-white border rounded px-1.5 py-0.5 select-all ${order.invoiceNumber ? 'text-slate-800 border-slate-200' : 'text-slate-400 border-slate-200'}`}>
                                {order.invoiceNumber || 'NA'}
                              </span>
                            </div>
                          </div>

                          {/* 3rd line: Total Package, Assigned To */}
                          {(order.totalPackage || order.assignedTo) && (
                            <div className="flex items-center gap-4 flex-wrap">
                              {order.totalPackage && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Pkg:</span>
                                  <span className="font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5">{order.totalPackage}</span>
                                </div>
                              )}
                              {order.assignedTo && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Assigned:</span>
                                  <span className="font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5">{order.assignedTo}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Items description preview */}
                      {order.items ? (
                        <div className="mt-3.5 p-3.5 bg-indigo-50/75 hover:bg-indigo-50 border-l-4 border-indigo-600 rounded-xl rounded-l-none text-xs text-indigo-950 font-sans font-semibold shadow-xs flex items-center gap-2.5 transition-colors group/note">
                          <MessageSquare className="w-4 h-4 text-indigo-500 group-hover/note:scale-110 transition-transform shrink-0" />
                          <span className="leading-relaxed whitespace-pre-line tracking-wide">
                            {order.items}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400/90 break-words italic font-sans font-medium mt-3 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 opacity-40 shrink-0" />
                          <span>No item or special documentation notes specified.</span>
                        </p>
                      )}



                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sync control bottom button bar */}
            {spreadsheetId && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-slate-900 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 font-sans">
                  <Database className="w-3.5 h-3.5 text-slate-900 shrink-0" /> Loaded {orders.length} order entries from spreadsheet.
                </span>
                <button
                  onClick={handleRefreshOrders}
                  className="hover:text-slate-900 hover:bg-slate-100 p-2 border-2 border-slate-900 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-0.5px]"
                  disabled={isLoadingOrders}
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-900 ${isLoadingOrders ? 'animate-spin' : ''}`} /> Sync Sheet
                </button>
              </div>
            )}

          </div>
          ) : (
            <>
              {renderKpiSection()}
              {renderLiveLogsSection()}
            </>
          )}

          {/* Expanded Selected Order Details panel */}
          {selectedOrder && (
            <div className="bg-slate-50 border-2 border-slate-900 rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom-3 duration-200 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
              
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest font-extrabold text-slate-400 font-sans">Order Information Card</span>
                    <span className={`text-[9px] px-2.5 py-0.5 border font-bold rounded-full uppercase ${getStageBadgeColor(selectedOrder.status)}`}>
                      {getStageLabel(selectedOrder.status)}
                    </span>
                  </div>
                  <h4 className="font-mono font-black text-slate-900 text-xl mt-1">
                    {selectedOrder.id}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  {/* Edit Record manual action button */}
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-950 p-2.5 rounded-xl transition-all border-2 border-slate-900 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px]"
                    title="Edit Order master information"
                  >
                    <Edit3 className="w-4 h-4 text-amber-600" />
                  </button>
                  {/* Remove Record manual action button */}
                  <button
                    onClick={triggerRemoveOrder}
                    className="bg-red-50 hover:bg-red-100 text-red-650 p-2.5 rounded-xl transition-all border-2 border-slate-900 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px]"
                    title="Remove record from Sheet completely"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="bg-white hover:bg-slate-100 text-slate-950 border-2 border-slate-900 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Metadata Details Grid */}
              {(selectedOrder.customerName || selectedOrder.packingListNo || selectedOrder.totalPackage || selectedOrder.invoiceNumber || selectedOrder.khanDistrict || selectedOrder.cityProvince || selectedOrder.assignedTo || selectedOrder.bu) && (
                <div className="bg-white rounded-2xl p-4 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-xs grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {selectedOrder.customerName && (
                    <div className="col-span-2 lg:col-span-2">
                      <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">Customer</span>
                      <span className="font-sans font-bold text-slate-900 text-sm">{selectedOrder.customerName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">Packing List #</span>
                    <span className={`font-mono font-bold border bg-slate-50 px-1.5 py-0.5 rounded text-xs ${selectedOrder.packingListNo ? 'text-slate-900 border-slate-200' : 'text-slate-400 border-slate-200'}`}>
                      {selectedOrder.packingListNo || 'NA'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">Invoice Number</span>
                    <span className={`font-mono font-bold border bg-slate-50 px-1.5 py-0.5 rounded text-xs ${selectedOrder.invoiceNumber ? 'text-slate-900 border-slate-200' : 'text-slate-400 border-slate-200'}`}>
                      {selectedOrder.invoiceNumber || 'NA'}
                    </span>
                  </div>
                  {selectedOrder.totalPackage && (
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">Total Package</span>
                      <span className="font-sans font-bold text-slate-900">{selectedOrder.totalPackage}</span>
                    </div>
                  )}
                  {selectedOrder.cityProvince && (
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">City / Province</span>
                      <span className="font-sans font-bold text-slate-900">{selectedOrder.cityProvince}</span>
                    </div>
                  )}
                  {selectedOrder.khanDistrict && (
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">Khan / District</span>
                      <span className="font-sans font-bold text-slate-900">{selectedOrder.khanDistrict}</span>
                    </div>
                  )}
                  {selectedOrder.assignedTo && (
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">Assigned To</span>
                      <span className="font-sans font-bold text-slate-900">{selectedOrder.assignedTo}</span>
                    </div>
                  )}
                  {selectedOrder.bu && (
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">BU</span>
                      <span className="font-sans font-bold text-slate-900 text-xs border border-slate-200 px-2 py-0.5 bg-slate-50 rounded">{selectedOrder.bu}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Active Process Interactive Controller */}
              <div className="bg-white rounded-2xl p-5 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-4">
                <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse" />
                    <span className="text-[10px] uppercase font-bold text-slate-900 tracking-wider font-sans">Active Process Controller</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-400">Real-time Sheet Sync Active</span>
                </div>

                {/* Progress Visual Stepper */}
                <div className="hidden sm:grid grid-cols-4 gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 relative">
                  {/* Step 1: Registered */}
                  <div className={`p-2 rounded-xl border flex flex-col justify-center gap-1 ${
                    selectedOrder.status === 'REGISTERED' 
                      ? 'bg-sky-50 text-sky-950 border-sky-300 ring-2 ring-sky-300/25' 
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span>1. Registered</span>
                  </div>

                  {/* Step 2: Picking */}
                  <div className={`p-2 rounded-xl border flex flex-col justify-center gap-1 ${
                    ['PICKING_STARTED', 'READY_CHECKING'].includes(selectedOrder.status)
                      ? 'bg-amber-50 text-amber-950 border-amber-300 ring-2 ring-amber-300/25'
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span>2. Picking</span>
                    <span className="text-[8px] font-mono text-slate-500 lowercase leading-none">
                      {selectedOrder.status === 'PICKING_STARTED' ? 'started' : selectedOrder.pickEnd ? 'ended' : 'awaiting'}
                    </span>
                  </div>

                  {/* Step 3: Checking */}
                  <div className={`p-2 rounded-xl border flex flex-col justify-center gap-1 ${
                    ['CHECKING_STARTED', 'READY_DELIVERY'].includes(selectedOrder.status)
                      ? 'bg-purple-50 text-purple-950 border-purple-300 ring-2 ring-purple-300/25'
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span>3. Checking</span>
                    <span className="text-[8px] font-mono text-slate-500 lowercase leading-none">
                      {selectedOrder.status === 'CHECKING_STARTED' ? 'started' : selectedOrder.checkEnd ? 'ended' : 'awaiting'}
                    </span>
                  </div>

                  {/* Step 4: Delivery */}
                  <div className={`p-2 rounded-xl border flex flex-col justify-center gap-1 ${
                    ['DELIVERY_STARTED', 'DELIVERED_SUCCESS', 'DELIVERED_INCOMPLETE', 'DELIVERED_RETURN'].includes(selectedOrder.status)
                      ? 'bg-indigo-50 text-indigo-950 border-indigo-300 ring-2 ring-indigo-300/25'
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span>4. Delivery</span>
                    <span className="text-[8px] font-mono text-slate-500 lowercase leading-none">
                      {selectedOrder.status === 'DELIVERY_STARTED' ? 'delivering' : selectedOrder.deliveryEnd ? 'finished' : 'awaiting'}
                    </span>
                  </div>
                </div>

                {/* Main Process Button / Interaction Area */}
                <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {(() => {
                    switch (selectedOrder.status) {
                      case 'REGISTERED':
                      case 'PENDING_PICKING':
                        return (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500 font-semibold font-sans">
                              The order is newly registered. Click below to begin the picking process.
                            </p>
                            <button
                              onClick={() => handleAdvanceStageClick(selectedOrder)}
                              disabled={isLoadingOrders}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>👉 Start Picking Process</span>
                            </button>
                          </div>
                        );

                      case 'PICKING_STARTED':
                        return (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500 font-semibold font-sans flex items-center justify-between">
                              <span>Picking in progress:</span>
                              <span className="font-mono text-slate-400">Started at {selectedOrder.pickStart ? new Date(selectedOrder.pickStart).toLocaleTimeString() : ''}</span>
                            </p>
                            <button
                              onClick={() => handleAdvanceStageClick(selectedOrder)}
                              disabled={isLoadingOrders}
                              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-sans font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>📦 Finish Picking Process</span>
                            </button>
                          </div>
                        );

                      case 'READY_CHECKING':
                        return (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500 font-semibold font-sans">
                              Picking completed. Ready to transition to Checking stage.
                            </p>
                            <button
                              onClick={() => handleAdvanceStageClick(selectedOrder)}
                              disabled={isLoadingOrders}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-sans font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>🔍 Start Checking Process</span>
                            </button>
                          </div>
                        );

                      case 'CHECKING_STARTED':
                        return (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500 font-semibold font-sans flex items-center justify-between">
                              <span>Checking and verification in progress:</span>
                              <span className="font-mono text-slate-400">Started at {selectedOrder.checkStart ? new Date(selectedOrder.checkStart).toLocaleTimeString() : ''}</span>
                            </p>
                            <button
                              onClick={() => handleAdvanceStageClick(selectedOrder)}
                              disabled={isLoadingOrders}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>✅ Finish Checking Process</span>
                            </button>
                          </div>
                        );

                      case 'READY_DELIVERY':
                        return (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-550 font-semibold font-sans">
                              Verification succeeded! Order is ready to dispatch out for delivery.
                            </p>
                            <button
                              onClick={() => handleAdvanceStageClick(selectedOrder)}
                              disabled={isLoadingOrders}
                              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-sans font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>🚚 Start Delivery Dispatch</span>
                            </button>
                          </div>
                        );

                      case 'DELIVERY_STARTED':
                        return (
                          <div className="space-y-3">
                            <p className="text-[11px] text-slate-500 font-semibold font-sans flex items-center justify-between">
                              <span>Sailed/Dispatched for active Delivery:</span>
                              <span className="font-mono text-slate-400">Departed at {selectedOrder.deliveryStart ? new Date(selectedOrder.deliveryStart).toLocaleTimeString() : ''}</span>
                            </p>
                            <div className="space-y-2">
                              <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">Record Final Fulfillment Outcome:</span>
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  onClick={() => handleDeliveryOutcomeSubmit('Success')}
                                  disabled={isLoadingOrders}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase py-2 rounded-xl transition-all border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] disabled:opacity-50 cursor-pointer text-center"
                                >
                                  Success
                                </button>
                                <button
                                  onClick={() => handleDeliveryOutcomeSubmit('Incomplete')}
                                  disabled={isLoadingOrders}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-slate-955 text-[10px] font-bold uppercase py-2 rounded-xl transition-all border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] disabled:opacity-50 cursor-pointer text-center"
                                >
                                  Incomplete
                                </button>
                                <button
                                  onClick={() => handleDeliveryOutcomeSubmit('Return')}
                                  disabled={isLoadingOrders}
                                  className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold uppercase py-2 rounded-xl transition-all border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] disabled:opacity-50 cursor-pointer text-center"
                                >
                                  Return
                                </button>
                              </div>
                            </div>
                          </div>
                        );

                      default:
                        // DELIVERED_SUCCESS, DELIVERED_INCOMPLETE, DELIVERED_RETURN
                        return (
                          <div className="flex flex-col items-center justify-center text-center p-3 space-y-2">
                            <span className="text-xl">🏆</span>
                            <div>
                              <p className="font-black text-slate-900 text-sm uppercase">Fulfillment Completed</p>
                              <div className="text-[11px] text-slate-500 mt-1 leading-relaxed font-semibold flex flex-wrap items-center justify-center gap-1.5 font-sans">
                                <span>This order reached its final outcome:</span>
                                <span className={`px-2 py-0.5 border font-bold text-[10px] rounded-full uppercase ${getStageBadgeColor(selectedOrder.status)}`}>
                                  {getStageLabel(selectedOrder.status)}
                                </span>
                              </div>
                              {selectedOrder.deliveryEnd && (
                                <p className="text-[9px] font-mono text-slate-400 mt-1">Logged: {new Date(selectedOrder.deliveryEnd).toLocaleString()}</p>
                              )}
                            </div>
                            <button
                              onClick={() => triggerManualOverride('REGISTERED')}
                              className="text-[10px] text-slate-500 hover:text-slate-900 underline mt-1 font-bold cursor-pointer bg-transparent border-0 font-sans"
                            >
                              Reset or Re-register Order
                            </button>
                          </div>
                        );
                    }
                  })()}
                </div>
              </div>

              {/* Items Detail */}
              <div className={`rounded-2xl p-4 border-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-xs transition-colors ${
                selectedOrder.items 
                  ? 'bg-indigo-50/75 border-indigo-600 text-indigo-950' 
                  : 'bg-white border-slate-900 text-slate-500'
              }`}>
                <span className={`text-[9px] uppercase font-bold tracking-wider block mb-1.5 font-sans flex items-center gap-1 ${
                  selectedOrder.items ? 'text-indigo-800' : 'text-slate-400'
                }`}>
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>Documented Items & Notes</span>
                </span>
                <p className={`whitespace-pre-wrap leading-relaxed font-sans ${
                  selectedOrder.items ? 'text-indigo-950 font-bold' : 'text-slate-500 italic'
                }`}>
                  {selectedOrder.items || 'No customized text information logged.'}
                </p>
              </div>

              {/* Advanced Scanning stage timeline steps */}
              <div className="space-y-3 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block font-sans">Scan Milestones Audit Logs</span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* Step A: Picking Block */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-900 block mb-2 border-b-2 border-slate-100 pb-1 font-display">1. Picking</span>
                      <div className="space-y-1.5 mt-1">
                        <div className="text-[10px] flex items-center justify-between text-slate-550 font-semibold font-sans">
                          <span>Pick Start:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedOrder.pickStart ? new Date(selectedOrder.pickStart).toLocaleTimeString() : 'Awaiting'}</span>
                        </div>
                        <div className="text-[10px] flex items-center justify-between text-slate-550 font-semibold font-sans">
                          <span>Pick End:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedOrder.pickEnd ? new Date(selectedOrder.pickEnd).toLocaleTimeString() : 'Awaiting'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step B: Checking Block */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-900 block mb-2 border-b-2 border-slate-100 pb-1 font-display">2. Checking</span>
                      <div className="space-y-1.5 mt-1">
                        <div className="text-[10px] flex items-center justify-between text-slate-550 font-semibold font-sans">
                          <span>Check Start:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedOrder.checkStart ? new Date(selectedOrder.checkStart).toLocaleTimeString() : 'Awaiting'}</span>
                        </div>
                        <div className="text-[10px] flex items-center justify-between text-slate-550 font-semibold font-sans">
                          <span>Check End:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedOrder.checkEnd ? new Date(selectedOrder.checkEnd).toLocaleTimeString() : 'Awaiting'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step C: Delivery Block */}
                  <div className="bg-white rounded-2xl p-4 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-900 block mb-2 border-b-2 border-slate-100 pb-1 font-display">3. Delivery Logistics</span>
                      <div className="space-y-1.5 mt-1">
                        <div className="text-[10px] flex items-center justify-between text-slate-550 font-semibold font-sans">
                          <span>Deliv Start:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedOrder.deliveryStart ? new Date(selectedOrder.deliveryStart).toLocaleTimeString() : 'Awaiting'}</span>
                        </div>
                        <div className="text-[10px] flex items-center justify-between text-slate-550 font-semibold font-sans">
                          <span>Deliv End:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedOrder.deliveryEnd ? new Date(selectedOrder.deliveryEnd).toLocaleTimeString() : 'Awaiting'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Operator Overrides Selector row */}
              <div className="pt-3 border-t-2 border-slate-900">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2 font-sans">Manual Transition Override</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['REGISTERED', 'PENDING_PICKING', 'PICKING_STARTED', 'READY_CHECKING', 'CHECKING_STARTED', 'READY_DELIVERY', 'DELIVERY_STARTED'] as OrderStage[]).map(stageOption => (
                    <button
                      key={stageOption}
                      onClick={() => triggerManualOverride(stageOption)}
                      className={`text-[9px] px-2.5 py-1.5 rounded-lg font-bold border-2 transition-all cursor-pointer ${
                        selectedOrder.status === stageOption
                          ? 'bg-slate-900 text-white border-slate-900 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {getStageLabel(stageOption)}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

        </section>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t-2 border-slate-900 py-6 px-6 text-center text-slate-400 text-xs mt-10">
        <div className="max-w-4xl mx-auto font-medium">ScanFlow Logistics • Google Sheets Multi-Stage Scanner Terminal. Built with high fidelity Bento layouts.</div>
      </footer>

      {/* --- MODAL PLACEMENTS --- */}
      <OrderFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddOrderSubmit}
      />

      <EditOrderModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        order={selectedOrder}
        onUpdate={handleUpdateOrder}
      />

      <DeliveryStatusModal
        isOpen={isDeliveryOutcomeOpen}
        orderId={pendingDeliveryOrderId || ''}
        onSubmit={handleDeliveryOutcomeSubmit}
        onCancel={() => {
          setIsDeliveryOutcomeOpen(false);
          setPendingDeliveryOrderId(null);
        }}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
      />

    </div>
  );
}
