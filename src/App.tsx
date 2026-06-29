/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef, FormEvent, useMemo } from 'react';
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
  Settings,
  Users,
  Truck,
  Layers,
  ClipboardList,
  ClipboardCheck,
  User,
  Calendar,
  Receipt,
  Clipboard
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
  setCachedToken,
  fetchUsersFromSheet,
  saveUsersToSheet
} from './lib/sheets';
import { safeStorage } from './lib/storage';

import { CameraScanner } from './components/CameraScanner';
import { OrderFormModal } from './components/OrderFormModal';
import { EditOrderModal } from './components/EditOrderModal';
import { DeliveryStatusModal, DeliveryOutcome } from './components/DeliveryStatusModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { SetupModule } from './components/SetupModule';
import { ReportModule } from './components/ReportModule';
import { UsersModule } from './components/UsersModule';
import { LoginScreen } from './components/LoginScreen';
import { UserCredentials } from './types';

export default function App() {
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // System credentials session state
  const [activeSystemUser, setActiveSystemUser] = useState<UserCredentials | null>(() => {
    try {
      const cached = safeStorage.getItem('scanflow_active_system_user');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('Error fetching cached system user session:', e);
    }
    return null;
  });

  // Spreadsheet config state
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  const [spreadsheetName, setSpreadsheetName] = useState<string>('');
  const [isConfiguringSheet, setIsConfiguringSheet] = useState(false);
  const [sheetIdInput, setSheetIdInput] = useState('');

  // Orders state
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const cached = safeStorage.getItem('offline_orders_snapshot');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.orders)) {
          return parsed.orders;
        }
      }
    } catch (e) {
      console.error('Failed to restore offline orders snapshot', e);
    }
    return [];
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Registered' | 'Picking' | 'Checking' | 'Waiting Delivery' | 'Delivery' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // QR & Tracking state
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('track') || urlParams.get('so') || null;
  });
  const [localSearch, setLocalSearch] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('track') || urlParams.get('so') || '';
  });
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  const [currentTab, setCurrentTab] = useState<'registry' | 'scanner' | 'setup' | 'reports' | 'users'>('scanner');

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
    const savedConfig = safeStorage.getItem('order_tracker_sheet_config');
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

  // Listen to storage/custom events to sync the logged-in active user session in real-time
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const cached = safeStorage.getItem('scanflow_active_system_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          setActiveSystemUser(parsed);
        } else {
          setActiveSystemUser(null);
        }
      } catch (e) {
        console.error('Failed to sync user session from storage event', e);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Sync / Fetch Orders when Spreadsheet ID or Token changes
  useEffect(() => {
    if (token && spreadsheetId) {
      handleRefreshOrders();
    }
  }, [token, spreadsheetId]);

  // Sync orders to offline snapshot cache whenever orders updates
  useEffect(() => {
    if (orders && orders.length > 0) {
      try {
        safeStorage.setItem('offline_orders_snapshot', JSON.stringify({
          lastSync: new Date().toISOString(),
          orders: orders
        }));
      } catch (e) {
        console.error('Error caching offline snapshot', e);
      }
    }
  }, [orders]);

  // Auto-scroll the active filter tab button into view when activeFilter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeTabEl = document.getElementById(`filter-tab-${activeFilter.replace(/\s+/g, '-')}`);
      if (activeTabEl) {
        activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeFilter]);

  // Helper to determine if a filter/tab is allowed for the active user
  const isFilterTabAllowed = (tab: 'All' | 'Registered' | 'Picking' | 'Checking' | 'Waiting Delivery' | 'Delivery' | 'Completed'): boolean => {
    if (!activeSystemUser) return true;
    if (activeSystemUser.role === 'admin') return true;

    const allowed = activeSystemUser.allowedProcesses || ['picking', 'checking', 'delivery'];

    if (tab === 'Registered' && !allowed.includes('picking')) return false;
    if (tab === 'Picking' && !allowed.includes('picking')) return false;
    if (tab === 'Checking' && !allowed.includes('checking')) return false;
    if (tab === 'Waiting Delivery' && !allowed.includes('delivery')) return false;
    if (tab === 'Delivery' && !allowed.includes('delivery')) return false;
    if (tab === 'Completed' && !allowed.includes('delivery')) return false;

    return true;
  };

  // Reset active filter if the current one becomes restricted
  useEffect(() => {
    if (activeSystemUser && activeSystemUser.role !== 'admin') {
      const allowed = activeSystemUser.allowedProcesses || ['picking', 'checking', 'delivery'];
      
      const isAllowed = (tab: string) => {
        if (tab === 'All') return true;
        if (tab === 'Registered' && !allowed.includes('picking')) return false;
        if (tab === 'Picking' && !allowed.includes('picking')) return false;
        if (tab === 'Checking' && !allowed.includes('checking')) return false;
        if (tab === 'Waiting Delivery' && !allowed.includes('delivery')) return false;
        if (tab === 'Delivery' && !allowed.includes('delivery')) return false;
        if (tab === 'Completed' && !allowed.includes('delivery')) return false;
        return true;
      };

      if (!isAllowed(activeFilter)) {
        const tabs: ('All' | 'Registered' | 'Picking' | 'Checking' | 'Waiting Delivery' | 'Delivery' | 'Completed')[] = [
          'All', 'Registered', 'Picking', 'Checking', 'Waiting Delivery', 'Delivery', 'Completed'
        ];
        const firstAllowed = tabs.find(t => isAllowed(t));
        if (firstAllowed) {
          setActiveFilter(firstAllowed);
        }
      }
    }
  }, [activeSystemUser, activeFilter]);

  // Ensure non-admins are redirected if they are on a restricted tab
  useEffect(() => {
    if (activeSystemUser && activeSystemUser.role !== 'admin') {
      if (currentTab === 'setup' || currentTab === 'users') {
        setCurrentTab('scanner');
      }
    }
  }, [activeSystemUser, currentTab]);

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
      safeStorage.setItem('order_tracker_sheet_config', JSON.stringify(config));
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
      safeStorage.setItem('order_tracker_sheet_config', JSON.stringify(config));
      setIsConfiguringSheet(false);
      setSheetIdInput('');
    } catch (err: any) {
      alert('Error connecting sheet: ' + (err.message || 'Make sure the Spreadsheet ID is correct and you have permission to access it.') + '\n\n💡 Troubleshoot Permissions:\n1. Ensure that you checked the permissions boxes for "Google Sheets" and "Google Drive" during screen authorization.\n2. Try to Sign Out using the power icon, then Sign In again to authorize. \n3. Ensure your Google account has access to read and write to this specific Spreadsheet ID.');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const isAuthError = (err: any): boolean => {
    if (!err || !err.message) return false;
    const msg = err.message.toLowerCase();
    return (
      msg.includes('401') ||
      msg.includes('authenticated') ||
      msg.includes('authentication') ||
      msg.includes('credential') ||
      msg.includes('oauth') ||
      msg.includes('unauthorized') ||
      msg.includes('invalid_grant') ||
      msg.includes('token')
    );
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

      // Try to fetch users from Google Sheet to ensure all created users are restored
      try {
        const sheetUsers = await fetchUsersFromSheet(token, spreadsheetId);
        if (sheetUsers && sheetUsers.length > 0) {
          // If the sheet has users, it's the source of truth! Store in localStorage
          safeStorage.setItem('scanflow_users_credentials', JSON.stringify(sheetUsers));
          
          // Trigger custom storage event so other components (e.g. login screen or users module) reload
          window.dispatchEvent(new Event('storage'));
        } else {
          // If the sheet has no user records, populate the sheet with current local storage users to bootstrap it
          const localCached = safeStorage.getItem('scanflow_users_credentials');
          if (localCached) {
            const parsed = JSON.parse(localCached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await saveUsersToSheet(token, spreadsheetId, parsed);
            }
          }
        }
      } catch (userErr) {
        console.error('Failed to sync users with spreadsheet', userErr);
      }
    } catch (err: any) {
      console.error('Fetch orders failed', err);
      if (isAuthError(err)) {
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
    if (activeSystemUser?.role === 'view') {
      alert("Permission Denied: Viewer accounts are restricted from registering new orders.");
      return;
    }

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

    const order = orders.find(o => {
      if (!o || !o.id) return false;
      const matchId = String(o.id).trim().toUpperCase() === cleaned;
      const matchPL = o.packingListNo ? String(o.packingListNo).trim().toUpperCase() === cleaned : false;
      const matchInv = o.invoiceNumber ? String(o.invoiceNumber).trim().toUpperCase() === cleaned : false;
      return matchId || matchPL || matchInv;
    });

    if (!order) {
      const errMsg = `Scan Failed: Code "${cleaned}" did not match any Barcode/SO#, Packing List#, or Invoice#.`;
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

    // Process access check
    let requiredProcess: 'picking' | 'checking' | 'delivery' | null = null;
    if (['REGISTERED', 'PENDING_PICKING', 'PICKING_STARTED'].includes(order.status)) {
      requiredProcess = 'picking';
    } else if (['READY_CHECKING', 'CHECKING_STARTED'].includes(order.status)) {
      requiredProcess = 'checking';
    } else if (['READY_DELIVERY', 'DELIVERY_STARTED'].includes(order.status)) {
      requiredProcess = 'delivery';
    }

    if (requiredProcess && activeSystemUser && activeSystemUser.role !== 'admin') {
      const allowed = activeSystemUser.allowedProcesses || [];
      if (!allowed.includes(requiredProcess)) {
        const errMsg = `Scan Blocked: "${activeSystemUser.username}" is not authorized for the ${requiredProcess} process.`;
        setManualScanMessage({ text: errMsg, isError: true });
        addScanReceipt({
          orderId: order.id,
          previousStage: order.status,
          newStage: order.status,
          timestamp: new Date().toLocaleTimeString(),
          message: errMsg,
          success: false
        });
        triggerBeep(false);
        return;
      }
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
        if (activeSystemUser?.username) {
          updatedOrder.assignedTo = activeSystemUser.username;
        }
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
        if (activeSystemUser?.username) {
          updatedOrder.assignedTo = activeSystemUser.username;
        }
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
        if (activeSystemUser?.username) {
          updatedOrder.assignedTo = activeSystemUser.username;
        }
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
        const completedMsg = `Scan Warning: "${cleaned}" (SO#: ${order.id}) is already completed and reached final destination status.`;
        setManualScanMessage({ text: completedMsg, isError: true });
        addScanReceipt({
          orderId: order.id,
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
      setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(updatedOrder);
      }

      setManualScanMessage({ text: `Approved: Match found (${cleaned}). ${order.id} moved to ${getStageLabel(nextStage)}`, isError: false });
      addScanReceipt({
        orderId: order.id,
        previousStage: prevStage,
        newStage: nextStage,
        timestamp: new Date().toLocaleTimeString(),
        message: `${actionDescr} (Scanned: ${cleaned})`,
        success: true
      });
      triggerBeep(true);
    } catch (err: any) {
      console.error(err);
      setManualScanMessage({ text: `Save error: ${err.message || 'Connection failed'}`, isError: true });
      triggerBeep(false);
      if (isAuthError(err)) {
        setNeedsAuth(true);
      }
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
      if (isAuthError(err)) {
        setNeedsAuth(true);
      }
    } finally {
      setIsLoadingOrders(false);
      setPendingDeliveryOrderId(null);
    }
  };

  const getQuickActionConfig = (status: OrderStage) => {
    switch (status) {
      case 'REGISTERED':
      case 'PENDING_PICKING':
        return { 
          label: 'Start Picking', 
          color: 'bg-emerald-400 hover:bg-emerald-500 text-slate-900 border-slate-900',
          icon: Play 
        };
      case 'PICKING_STARTED':
        return { 
          label: 'Finish Picking', 
          color: 'bg-amber-400 hover:bg-amber-500 text-slate-900 border-slate-900',
          icon: ClipboardCheck 
        };
      case 'READY_CHECKING':
        return { 
          label: 'Start Check', 
          color: 'bg-purple-400 hover:bg-purple-500 text-slate-900 border-slate-900',
          icon: Play 
        };
      case 'CHECKING_STARTED':
        return { 
          label: 'Finish Check', 
          color: 'bg-indigo-500 hover:bg-indigo-600 text-white border-slate-900',
          icon: ClipboardCheck 
        };
      case 'READY_DELIVERY':
        return { 
          label: 'Start Delivery', 
          color: 'bg-teal-400 hover:bg-teal-500 text-slate-900 border-slate-900',
          icon: Truck 
        };
      case 'DELIVERY_STARTED':
        return { 
          label: 'Fulfill Order', 
          color: 'bg-rose-500 hover:bg-rose-600 text-white border-slate-900',
          icon: CheckCircle2 
        };
      default:
        return null;
    }
  };

  const handleAdvanceStageClick = async (order: Order, nextStageOverride?: OrderStage) => {
    if (activeSystemUser?.role === 'view') {
      alert("Permission Denied: Viewer accounts are restricted from scanning, or advancing tracking stages.");
      return;
    }

    // Process authorization check
    let requiredProcess: 'picking' | 'checking' | 'delivery' | null = null;
    if (nextStageOverride) {
      if (['PICKING_STARTED', 'READY_CHECKING'].includes(nextStageOverride)) {
        requiredProcess = 'picking';
      } else if (['CHECKING_STARTED', 'READY_DELIVERY'].includes(nextStageOverride)) {
        requiredProcess = 'checking';
      } else if (['DELIVERY_STARTED', 'DELIVERED_SUCCESS', 'DELIVERED_INCOMPLETE', 'DELIVERED_RETURN'].includes(nextStageOverride)) {
        requiredProcess = 'delivery';
      }
    } else {
      if (['REGISTERED', 'PENDING_PICKING', 'PICKING_STARTED'].includes(order.status)) {
        requiredProcess = 'picking';
      } else if (['READY_CHECKING', 'CHECKING_STARTED'].includes(order.status)) {
        requiredProcess = 'checking';
      } else if (['READY_DELIVERY', 'DELIVERY_STARTED'].includes(order.status)) {
        requiredProcess = 'delivery';
      }
    }

    if (requiredProcess && activeSystemUser && activeSystemUser.role !== 'admin') {
      const allowed = activeSystemUser.allowedProcesses || [];
      if (!allowed.includes(requiredProcess)) {
        alert(`Permission Denied: "${activeSystemUser.username}" is not authorized for the ${requiredProcess} process.`);
        return;
      }
    }

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
      if (['PICKING_STARTED', 'CHECKING_STARTED', 'DELIVERY_STARTED'].includes(nextStage) && activeSystemUser?.username) {
        updatedOrder.assignedTo = activeSystemUser.username;
      }
      actionDescr = `Manual progression override to ${getStageLabel(nextStage)}`;
    } else {
      switch (order.status) {
        case 'REGISTERED':
        case 'PENDING_PICKING':
          nextStage = 'PICKING_STARTED';
          updatedOrder.status = nextStage;
          updatedOrder.pickStart = timestamp;
          if (activeSystemUser?.username) {
            updatedOrder.assignedTo = activeSystemUser.username;
          }
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
          if (activeSystemUser?.username) {
            updatedOrder.assignedTo = activeSystemUser.username;
          }
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
          if (activeSystemUser?.username) {
            updatedOrder.assignedTo = activeSystemUser.username;
          }
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
      if (isAuthError(err)) {
        setNeedsAuth(true);
      }
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

        if (['PICKING_STARTED', 'CHECKING_STARTED', 'DELIVERY_STARTED'].includes(stage) && activeSystemUser?.username) {
          updatedOrder.assignedTo = activeSystemUser.username;
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
          if (isAuthError(err)) {
            setNeedsAuth(true);
          }
        } finally {
          setIsLoadingOrders(false);
        }
      }
    });
  };

  // Update order fields inside Google Sheets and local state
  const handleUpdateOrder = async (originalId: string, updatedOrder: Order) => {
    if (activeSystemUser?.role === 'view') {
      alert("Permission Denied: Viewer accounts are restricted from modifying order details.");
      return;
    }

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
    } catch (err: any) {
      console.error(err);
      if (isAuthError(err)) {
        setNeedsAuth(true);
      }
      throw err;
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Remove / delete order row from sheets
  const triggerRemoveOrder = () => {
    if (!selectedOrder) return;

    if (activeSystemUser?.role !== 'admin') {
      alert("Permission Denied: Your account role does not support deleting tracking records.");
      return;
    }

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
          if (isAuthError(err)) {
            setNeedsAuth(true);
          }
        } finally {
          setIsLoadingOrders(false);
        }
      }
    });
  };

  // Manual key-in scan submit
  const handleKeyInScanSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeSystemUser?.role === 'view') {
      alert("Permission Denied: Viewer accounts are restricted from scanning, or advancing tracking stages.");
      setBarcodeInput('');
      return;
    }
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

  // Filter raw orders down to only those matching allowed processes for non-admins
  const visibleOrders = useMemo(() => {
    if (!activeSystemUser || activeSystemUser.role === 'admin') {
      return orders;
    }
    const allowed = activeSystemUser.allowedProcesses || ['picking', 'checking', 'delivery'];
    return orders.filter(o => {
      let orderProcess: 'picking' | 'checking' | 'delivery' | null = null;
      if (['REGISTERED', 'PENDING_PICKING', 'PICKING_STARTED'].includes(o.status)) {
        orderProcess = 'picking';
      } else if (['READY_CHECKING', 'CHECKING_STARTED'].includes(o.status)) {
        orderProcess = 'checking';
      } else if (['READY_DELIVERY', 'DELIVERY_STARTED', 'DELIVERED_SUCCESS', 'DELIVERED_INCOMPLETE', 'DELIVERED_RETURN'].includes(o.status)) {
        orderProcess = 'delivery';
      }
      return !orderProcess || allowed.includes(orderProcess);
    });
  }, [orders, activeSystemUser]);

  // Calculations for KPI numbers
  const totalCount = visibleOrders.length;
  const inRegisteredCount = visibleOrders.filter(o => o.status === 'REGISTERED').length;
  const inPickingCount = visibleOrders.filter(o => o.status === 'PENDING_PICKING' || o.status === 'PICKING_STARTED').length;
  const inCheckingCount = visibleOrders.filter(o => o.status === 'READY_CHECKING' || o.status === 'CHECKING_STARTED').length;
  const inWaitingDeliveryCount = visibleOrders.filter(o => o.status === 'READY_DELIVERY').length;
  const inDeliveryCount = visibleOrders.filter(o => o.status === 'DELIVERY_STARTED').length;
  
  const successDeliveries = visibleOrders.filter(o => o.status === 'DELIVERED_SUCCESS').length;
  const incompleteDeliveries = visibleOrders.filter(o => o.status === 'DELIVERED_INCOMPLETE').length;
  const returnedDeliveries = visibleOrders.filter(o => o.status === 'DELIVERED_RETURN').length;
  const totalCompleted = successDeliveries + incompleteDeliveries + returnedDeliveries;

  // Render stage icon
  const getStageStatusIcon = (stage: OrderStage) => {
    if (stage.startsWith('DELIVERED')) return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    return <Clock className="w-5 h-5 text-indigo-500 animate-pulse" />;
  };

  // Filter & Search computation
  const filteredOrders = visibleOrders.filter(o => {
    // Stage Filter
    if (activeFilter === 'Registered' && o.status !== 'REGISTERED') return false;
    if (activeFilter === 'Picking' && !(o.status === 'PENDING_PICKING' || o.status === 'PICKING_STARTED')) return false;
    if (activeFilter === 'Checking' && !(o.status === 'READY_CHECKING' || o.status === 'CHECKING_STARTED')) return false;
    if (activeFilter === 'Waiting Delivery' && o.status !== 'READY_DELIVERY') return false;
    if (activeFilter === 'Delivery' && o.status !== 'DELIVERY_STARTED') return false;
    if (activeFilter === 'Completed' && !o.status.startsWith('DELIVERED')) return false;

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return String(o.id || '').toLowerCase().includes(query) || String(o.items || '').toLowerCase().includes(query);
    }
    return true;
  });

  const renderKpiSection = () => {
    const handleKpiClick = (filter: 'All' | 'Registered' | 'Picking' | 'Checking' | 'Waiting Delivery' | 'Delivery' | 'Completed') => {
      setActiveFilter(filter);
      setCurrentTab('registry');
      setScannerActive(false);
    };

    const kpiItems = [
      {
        id: 'All' as const,
        label: 'Total Active',
        count: totalCount,
        icon: Layers,
        activeBg: 'bg-slate-900 border-slate-950 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[1px]',
        inactiveBg: 'bg-slate-50 border-slate-200 hover:border-slate-900 hover:bg-white text-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,0.15)]',
        iconBgActive: 'bg-slate-800 border border-slate-700',
        iconBgInactive: 'bg-slate-100 border border-slate-200',
        iconColorActive: 'text-white',
        iconColorInactive: 'text-slate-500',
        countColorActive: 'text-white',
        countColorInactive: 'text-slate-900',
        labelColorActive: 'text-slate-300',
        labelColorInactive: 'text-slate-400'
      },
      {
        id: 'Registered' as const,
        label: 'Registered',
        count: inRegisteredCount,
        icon: ClipboardList,
        activeBg: 'bg-sky-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[1px]',
        inactiveBg: 'bg-slate-50 border-slate-200 hover:border-sky-500 hover:bg-sky-50/40 text-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(14,165,233,0.15)]',
        iconBgActive: 'bg-sky-700 border border-sky-500',
        iconBgInactive: 'bg-sky-100 border border-sky-200',
        iconColorActive: 'text-white',
        iconColorInactive: 'text-sky-600',
        countColorActive: 'text-white',
        countColorInactive: 'text-sky-700',
        labelColorActive: 'text-sky-100',
        labelColorInactive: 'text-slate-400'
      },
      {
        id: 'Picking' as const,
        label: 'In Picking',
        count: inPickingCount,
        icon: Package,
        activeBg: 'bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[1px]',
        inactiveBg: 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(37,99,235,0.15)]',
        iconBgActive: 'bg-blue-700 border border-blue-500',
        iconBgInactive: 'bg-blue-50 border border-blue-100',
        iconColorActive: 'text-white',
        iconColorInactive: 'text-blue-600',
        countColorActive: 'text-white',
        countColorInactive: 'text-blue-700',
        labelColorActive: 'text-blue-100',
        labelColorInactive: 'text-slate-400'
      },
      {
        id: 'Checking' as const,
        label: 'In Checking',
        count: inCheckingCount,
        icon: ClipboardCheck,
        activeBg: 'bg-amber-500 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[1px]',
        inactiveBg: 'bg-slate-50 border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(245,158,11,0.15)]',
        iconBgActive: 'bg-amber-600 border border-amber-400',
        iconBgInactive: 'bg-amber-50 border border-amber-100',
        iconColorActive: 'text-white',
        iconColorInactive: 'text-amber-600',
        countColorActive: 'text-white',
        countColorInactive: 'text-amber-600',
        labelColorActive: 'text-amber-100',
        labelColorInactive: 'text-slate-400'
      },
      {
        id: 'Waiting Delivery' as const,
        label: 'Waiting Delivery',
        count: inWaitingDeliveryCount,
        icon: Clock,
        activeBg: 'bg-indigo-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[1px]',
        inactiveBg: 'bg-slate-50 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(99,102,241,0.15)]',
        iconBgActive: 'bg-indigo-700 border border-indigo-500',
        iconBgInactive: 'bg-indigo-50 border border-indigo-100',
        iconColorActive: 'text-white',
        iconColorInactive: 'text-indigo-600',
        countColorActive: 'text-white',
        countColorInactive: 'text-indigo-700',
        labelColorActive: 'text-indigo-100',
        labelColorInactive: 'text-slate-400'
      },
      {
        id: 'Delivery' as const,
        label: 'Delivering',
        count: inDeliveryCount,
        icon: Truck,
        activeBg: 'bg-teal-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[1px]',
        inactiveBg: 'bg-slate-50 border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(20,184,166,0.15)]',
        iconBgActive: 'bg-teal-700 border border-teal-500',
        iconBgInactive: 'bg-teal-50 border border-teal-100',
        iconColorActive: 'text-white',
        iconColorInactive: 'text-teal-600',
        countColorActive: 'text-white',
        countColorInactive: 'text-teal-700',
        labelColorActive: 'text-teal-100',
        labelColorInactive: 'text-slate-400'
      },
      {
        id: 'Completed' as const,
        label: 'Completed',
        count: totalCompleted,
        icon: CheckCircle2,
        activeBg: 'bg-emerald-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[1px]',
        inactiveBg: 'bg-slate-50 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-slate-800 hover:shadow-[3px_3px_0px_0px_rgba(16,185,129,0.15)]',
        iconBgActive: 'bg-emerald-700 border border-emerald-500',
        iconBgInactive: 'bg-emerald-50 border border-emerald-100',
        iconColorActive: 'text-white',
        iconColorInactive: 'text-emerald-600',
        countColorActive: 'text-white',
        countColorInactive: 'text-emerald-700',
        labelColorActive: 'text-emerald-100',
        labelColorInactive: 'text-slate-400'
      }
    ];

    return (
      <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 flex flex-col justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-500" /> System KPI Indicators
          </h4>
          <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-150 px-2 py-0.5 rounded-full">Click card to view process</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3.5 py-1">
          {kpiItems.filter(item => isFilterTabAllowed(item.id)).map((item) => {
            const isActive = activeFilter === item.id && currentTab === 'registry';
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleKpiClick(item.id)}
                className={`flex flex-col justify-between p-3 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.98] w-full text-left relative overflow-hidden group ${
                  isActive ? item.activeBg : item.inactiveBg
                }`}
              >
                {/* Upper line: Icon & Count */}
                <div className="flex items-center justify-between w-full gap-2 mb-2">
                  <div className={`p-1.5 rounded-xl transition-colors shrink-0 ${
                    isActive ? item.iconBgActive : item.iconBgInactive
                  }`}>
                    <IconComponent className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 duration-200 ${
                      isActive ? item.iconColorActive : item.iconColorInactive
                    }`} />
                  </div>
                  <span className={`text-2xl sm:text-3xl font-black font-display tracking-tight leading-none ${
                    isActive ? item.countColorActive : item.countColorInactive
                  }`}>
                    {item.count}
                  </span>
                </div>

                {/* Label text */}
                <span className={`text-[10px] font-black uppercase tracking-wider block truncate mt-0.5 ${
                  isActive ? item.labelColorActive : item.labelColorInactive
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
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
  };

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

  const renderOrderTrackerView = () => {
    const cleanSearch = trackingOrderId ? String(trackingOrderId).trim().toUpperCase() : '';
    const matched = orders.find(o => {
      if (!o || !o.id) return false;
      const matchId = String(o.id).trim().toUpperCase() === cleanSearch;
      const matchPL = o.packingListNo ? String(o.packingListNo).trim().toUpperCase() === cleanSearch : false;
      const matchInv = o.invoiceNumber ? String(o.invoiceNumber).trim().toUpperCase() === cleanSearch : false;
      return matchId || matchPL || matchInv;
    });
    
    // Support typing a search in the tracker if nothing found or search input is focused

    const handleLocalSearchSubmit = (e: FormEvent) => {
      e.preventDefault();
      if (localSearch.trim()) {
        setTrackingOrderId(localSearch.trim());
        // update URL parameter so user can bookmark / share it
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('track', localSearch.trim());
        window.history.pushState(null, '', newUrl.toString());
      }
    };

    const handleClearTracking = () => {
      setTrackingOrderId(null);
      setLocalSearch('');
      // clean url query params
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('track');
      newUrl.searchParams.delete('so');
      window.history.pushState(null, '', newUrl.pathname);
    };

    // Tracking URL to display / copy / embed in QR code
    const trackingUrl = matched ? `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(matched.id)}` : '';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Simple tracker header */}
        <header className="bg-white border-b-2 border-slate-900 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-2 rounded-xl border border-slate-950 shrink-0">
              <Barcode className="w-5.5 h-5.5 sm:w-6 sm:h-6 stroke-[1.75]" />
            </div>
            <div>
              <h1 className="font-display font-black text-slate-900 text-lg uppercase tracking-tight leading-none flex items-center gap-1.5 flex-wrap">
                ScanFlow <span className="font-normal text-[9px] text-emerald-600 font-extrabold uppercase shrink-0 py-0.5 px-2 bg-emerald-50 border border-emerald-250 rounded">Live Tracker</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1">
                Fulfillment Logistics Terminal
              </p>
            </div>
          </div>
          <button
            onClick={handleClearTracking}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-950 text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-[3px_3px_0px_0px_rgba(30,41,59,0.3)] transition-all hover:translate-y-[-1px] active:translate-y-[1px] cursor-pointer"
          >
            Go to Operator Dashboard
          </button>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* Tracking Search Input */}
          <div className="bg-white rounded-2xl border-2 border-slate-900 p-4 sm:p-5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-black uppercase text-slate-900 text-base sm:text-md">Track Another Sales Order</h3>
              <p className="text-xs text-slate-400">Scan code label or input your Sales Order reference identifier below.</p>
            </div>
            <form onSubmit={handleLocalSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="e.g. ORD-1001"
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                className="font-mono font-bold text-sm text-slate-900 px-4 py-2 border-2 border-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/10 flex-1 sm:w-48 placeholder:text-slate-300 bg-slate-50 focus:bg-white transition-all"
              />
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[1px] cursor-pointer"
              >
                Track
              </button>
            </form>
          </div>

          {!matched ? (
            <div className="bg-amber-50 border-2 border-amber-900 rounded-3xl p-8 text-center space-y-4 shadow-[4px_4px_0px_0px_rgba(217,119,6,0.1)]">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto" />
              <div>
                <h4 className="font-display font-black text-amber-955 text-lg uppercase tracking-wider">Order Reference "{trackingOrderId}" Not Available offline</h4>
                <p className="text-xs text-amber-800 max-w-md mx-auto mt-2">
                  This order isn't synchronized yet on this device. The operators must connect to the live active sheet and fetch references to populate the live tracking registry snapshots.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={handleClearTracking}
                  className="bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-950 font-bold text-xs uppercase px-5 py-2.5 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  Access Terminal Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* The Combined Order Tracking & Specifications Card */}
              <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-6">
                {/* Masthead Header / Badge Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6 border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-sans font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                      Live Tracking Status
                    </span>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider font-sans bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                      ID: {matched.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                      Current Stage:
                    </span>
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${getStageBadgeColor(matched.status)}`}>
                      {getStageLabel(matched.status)}
                    </span>
                  </div>
                </div>

                {/* Main Content: Specs Left, QR Code Right */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Order details & specifications */}
                  <div className="lg:col-span-2 space-y-6">
                    <div>
                      <h2 className="font-sans font-black text-slate-900 text-2xl sm:text-3xl tracking-tight">
                        Tracking Order: <span className="text-indigo-600 font-mono select-all font-black">{matched.id}</span>
                      </h2>
                      <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Last update timestamp: </span>
                        <span className="text-slate-850 font-mono">{(() => {
                          try {
                            const d = new Date(matched.lastUpdated);
                            return isNaN(d.getTime()) ? matched.lastUpdated : d.toLocaleString();
                          } catch (e) {
                            return matched.lastUpdated;
                          }
                        })()}</span>
                      </div>
                    </div>

                    {/* Grid representing all Order specifications */}
                    <div className="space-y-4">
                      <h4 className="font-sans font-black text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-slate-500" />
                        Order Specifications Details
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {matched.customerName && (
                          <div className="col-span-1 sm:col-span-2 bg-slate-50 border-2 border-slate-900/10 p-4 rounded-2xl">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Customer Name</span>
                            <p className="font-black text-slate-900 text-lg mt-1">{matched.customerName}</p>
                          </div>
                        )}

                        {matched.packingListNo && (
                          <div className="bg-slate-50/50 border border-slate-200 p-3.5 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-slate-450" /> Packing List # (PL)
                            </span>
                            <p className="font-mono font-bold text-slate-800 text-sm mt-1">{matched.packingListNo}</p>
                          </div>
                        )}

                        {matched.invoiceNumber && (
                          <div className="bg-slate-50/50 border border-slate-200 p-3.5 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-slate-450" /> Invoice Number
                            </span>
                            <p className="font-mono font-bold text-slate-800 text-sm mt-1">{matched.invoiceNumber}</p>
                          </div>
                        )}

                        {matched.totalPackage ? (
                          <div className="bg-slate-50/50 border border-slate-200 p-3.5 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-slate-450" /> Total Package Count
                            </span>
                            <p className="font-sans font-bold text-slate-900 text-sm mt-1">{matched.totalPackage} Package(s)</p>
                          </div>
                        ) : null}

                        {matched.bu && (
                          <div className="bg-slate-50/50 border border-slate-200 p-3.5 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Business Unit (BU)</span>
                            <p className="font-sans font-bold text-slate-900 text-sm mt-1">{matched.bu}</p>
                          </div>
                        )}

                        {matched.khanDistrict && (
                          <div className="bg-slate-50/50 border border-slate-200 p-3.5 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-450" /> Khan / District
                            </span>
                            <p className="font-sans font-bold text-slate-900 text-sm mt-1">{matched.khanDistrict}</p>
                          </div>
                        )}

                        {matched.cityProvince && (
                          <div className="bg-slate-50/50 border border-slate-200 p-3.5 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-450" /> City / Province
                            </span>
                            <p className="font-sans font-bold text-slate-900 text-sm mt-1">{matched.cityProvince}</p>
                          </div>
                        )}

                        {matched.assignedTo && (
                          <div className="col-span-1 sm:col-span-2 bg-indigo-50/30 border border-indigo-100 p-3.5 rounded-xl flex items-center justify-between gap-4">
                            <div>
                              <span className="text-[10px] uppercase font-black text-indigo-500 tracking-wider flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> Assigned Operator
                              </span>
                              <p className="font-black text-indigo-950 text-sm mt-1">{matched.assignedTo}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200 shrink-0">
                              <UserCheck className="w-4 h-4 text-indigo-700" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: QR Code, share Link, print actions */}
                  <div className="flex flex-col justify-center">
                    <div className="bg-slate-50 border-2 border-slate-900 p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center space-y-4">
                      <div className="bg-white border-2 border-slate-200 p-3.5 rounded-2xl shadow-sm">
                        <QRCodeSVG value={trackingUrl} size={110} level="M" />
                      </div>
                      
                      <div className="w-full space-y-1">
                        <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Scan to Load Tracker</p>
                        <p className="font-mono text-[9.5px] text-slate-600 select-all font-semibold break-all px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg max-w-full truncate">{trackingUrl}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 w-full">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(trackingUrl);
                            setCopiedId(matched.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 py-2.5 px-3 rounded-xl text-[10px] uppercase font-black tracking-wide shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)] transition-all cursor-pointer active:translate-y-[1px]"
                        >
                          {copiedId === matched.id ? 'Copied Link!' : 'Copy Link'}
                        </button>
                        <button
                          onClick={() => {
                            setQrModalOrder(matched);
                            setTimeout(() => window.print(), 200);
                          }}
                          className="bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 py-2.5 px-3 rounded-xl text-[10px] uppercase font-black tracking-wide shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer active:translate-y-[1px]"
                        >
                          Print Tag
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Scope Terminal Timeline */}
              <div className="bg-white rounded-3xl border-2 border-slate-900 p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-6">
                <div className="flex items-center gap-2.5 border-b pb-4 border-slate-100">
                  <div className="bg-indigo-50 text-indigo-700 p-2 rounded-xl border border-indigo-250">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-slate-900 text-sm sm:text-md uppercase tracking-wider">
                      Recorded Terminal Event Scope
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      Full Custody Log & Progression Timestamps
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                  {/* Step 1: Registered */}
                  <div className="relative border-l-2 md:border-l-0 md:border-t-2 border-slate-200 pl-6 md:pl-0 pt-0 md:pt-6 space-y-2">
                    {/* Circle Node indicator */}
                    <div className="absolute -left-[9px] md:left-0 -top-1 md:-top-[9px] w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_0_4px_rgba(16,185,129,0.15)] flex items-center justify-center animate-pulse" />
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Completed
                      </span>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 font-sans">Step 1</span>
                    </div>
                    <h4 className="font-sans font-black text-slate-900 text-sm uppercase tracking-tight">1. Order Created</h4>
                    <p className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-lg inline-block">
                      {matched.lastUpdated ? new Date(matched.lastUpdated).toLocaleString() : 'Registered'}
                    </p>
                  </div>

                  {/* Step 2: Picking */}
                  <div className="relative border-l-2 md:border-l-0 md:border-t-2 border-slate-200 pl-6 md:pl-0 pt-0 md:pt-6 space-y-2">
                    {/* Circle Node indicator */}
                    <div className={`absolute -left-[9px] md:left-0 -top-1 md:-top-[9px] w-4 h-4 rounded-full border-2 border-white ${
                      matched.pickEnd 
                        ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]' 
                        : matched.pickStart 
                          ? 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.15)] animate-pulse' 
                          : 'bg-slate-250 shadow-none'
                    }`} />
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border ${
                        matched.pickEnd 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : matched.pickStart 
                            ? 'bg-amber-50 text-amber-700 border-amber-250' 
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        {matched.pickEnd ? 'Completed' : matched.pickStart ? 'In Progress' : 'Awaiting'}
                      </span>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 font-sans">Step 2</span>
                    </div>
                    <h4 className="font-sans font-black text-slate-900 text-sm uppercase tracking-tight">2. Picking Actions</h4>
                    {matched.pickStart ? (
                      <div className="space-y-1 bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-[10px] font-mono text-slate-650">
                        {matched.pickEnd ? (
                          <p>End: <span className="text-emerald-700 font-bold">{new Date(matched.pickEnd).toLocaleString()}</span></p>
                        ) : (
                          <p className="text-amber-600 italic font-sans font-bold animate-pulse">Picking active...</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No picking records available</p>
                    )}
                  </div>

                  {/* Step 3: Checking */}
                  <div className="relative border-l-2 md:border-l-0 md:border-t-2 border-slate-200 pl-6 md:pl-0 pt-0 md:pt-6 space-y-2">
                    {/* Circle Node indicator */}
                    <div className={`absolute -left-[9px] md:left-0 -top-1 md:-top-[9px] w-4 h-4 rounded-full border-2 border-white ${
                      matched.checkEnd 
                        ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]' 
                        : matched.checkStart 
                          ? 'bg-purple-500 shadow-[0_0_0_4px_rgba(168,85,247,0.15)] animate-pulse' 
                          : 'bg-slate-250 shadow-none'
                    }`} />
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border ${
                        matched.checkEnd 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : matched.checkStart 
                            ? 'bg-purple-50 text-purple-700 border-purple-250' 
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        {matched.checkEnd ? 'Completed' : matched.checkStart ? 'In Progress' : 'Awaiting'}
                      </span>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 font-sans">Step 3</span>
                    </div>
                    <h4 className="font-sans font-black text-slate-900 text-sm uppercase tracking-tight">3. Checking Actions</h4>
                    {matched.checkStart ? (
                      <div className="space-y-1 bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-[10px] font-mono text-slate-650">
                        {matched.checkEnd ? (
                          <p>End: <span className="text-emerald-700 font-bold">{new Date(matched.checkEnd).toLocaleString()}</span></p>
                        ) : (
                          <p className="text-purple-600 italic font-sans font-bold animate-pulse">Checking active...</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No checking records available</p>
                    )}
                  </div>

                  {/* Step 4: Delivery */}
                  <div className="relative border-l-2 md:border-l-0 md:border-t-2 border-slate-200 pl-6 md:pl-0 pt-0 md:pt-6 space-y-2">
                    {/* Circle Node indicator */}
                    <div className={`absolute -left-[9px] md:left-0 -top-1 md:-top-[9px] w-4 h-4 rounded-full border-2 border-white ${
                      matched.deliveryEnd 
                        ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]' 
                        : matched.deliveryStart 
                          ? 'bg-indigo-500 shadow-[0_0_0_4px_rgba(99,102,241,0.15)] animate-pulse' 
                          : 'bg-slate-250 shadow-none'
                    }`} />
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border ${
                        matched.deliveryEnd 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : matched.deliveryStart 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-250' 
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        {matched.deliveryEnd ? 'Delivered' : matched.deliveryStart ? 'Dispatched' : 'Awaiting'}
                      </span>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 font-sans">Step 4</span>
                    </div>
                    <h4 className="font-sans font-black text-slate-900 text-sm uppercase tracking-tight">4. Dispatch & Delivery</h4>
                    {matched.deliveryStart ? (
                      <div className="space-y-1 bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-[10px] font-mono text-slate-650">
                        {matched.deliveryEnd ? (
                          <p>Finished: <span className="text-emerald-700 font-bold">{new Date(matched.deliveryEnd).toLocaleString()}</span></p>
                        ) : (
                          <p className="text-indigo-600 italic font-sans font-bold animate-pulse">Out for delivery...</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No delivery records available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  const handleSystemLoginSuccess = (usr: UserCredentials) => {
    setActiveSystemUser(usr);
    safeStorage.setItem('scanflow_active_system_user', JSON.stringify(usr));
  };

  const handleSystemLogout = () => {
    setActiveSystemUser(null);
    safeStorage.removeItem('scanflow_active_system_user');
    setCurrentTab('registry');
  };

  if (trackingOrderId) {
    return renderOrderTrackerView();
  }

  if (!activeSystemUser) {
    return <LoginScreen onLoginSuccess={handleSystemLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] relative selection:bg-slate-900/10 text-slate-900 font-sans">
      
      {/* Top Bento Professional App Header */}
      <header className="sticky top-0 bg-white border-b-2 border-slate-900 px-4 py-3 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 z-40 shadow-sm">
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 text-white p-2 rounded-xl border border-slate-950 shrink-0">
              <Barcode className="w-5.5 h-5.5 sm:w-6 sm:h-6 stroke-[1.75]" />
            </div>
            <div>
              <h1 className="font-display font-black text-slate-900 text-xl sm:text-2xl uppercase tracking-tight leading-none">
                ScanFlow <span className="font-normal text-slate-400 text-xs sm:text-base">v2.4</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1">
                Fulfillment Terminal
              </p>
            </div>
          </div>
          
          <div className="flex md:hidden items-center gap-1.5">
            {!needsAuth && user && (
              <span className="text-[10px] text-emerald-600 font-black flex items-center gap-1 uppercase tracking-wider bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
              </span>
            )}
          </div>
        </div>

        {/* User state / Google Sheets connection state controls */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-center md:justify-end w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-2.5 md:pt-0">
          
          {/* Active System Account Badge */}
          {activeSystemUser && (
            <div id="active-system-user-badge" className="flex items-center gap-1.5 border-2 border-slate-900 bg-slate-50 px-2.5 py-1.5 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[11px] sm:text-xs shrink-0 select-none">
              <div className="flex flex-col text-left">
                <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider leading-none">Session Profile</span>
                <span className="text-xs font-black text-slate-900 font-mono flex items-center gap-1.5 mt-0.5">
                  {activeSystemUser.username}
                  <span className={`text-[7px] px-1 py-0.2 uppercase font-mono rounded font-black border border-slate-950 text-center select-none leading-none ${
                    activeSystemUser.role === 'admin' 
                      ? 'bg-red-500 text-white' 
                      : activeSystemUser.role === 'limited' 
                      ? 'bg-amber-400 text-slate-950' 
                      : 'bg-blue-500 text-white'
                  }`}>
                    {activeSystemUser.role}
                  </span>
                </span>
              </div>
              <div className="h-6 w-[1px] bg-slate-300 mx-1 shrink-0"></div>
              <button
                type="button"
                onClick={handleSystemLogout}
                className="text-[9px] font-black uppercase tracking-wider text-rose-600 hover:text-white hover:bg-rose-500 border border-transparent hover:border-slate-900 px-2 py-1 rounded-lg transition-all cursor-pointer"
                title="Disconnect system username session"
              >
                Signout
              </button>
            </div>
          )}

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
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
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
                <div className="flex items-center gap-1.5 bg-slate-50 border-2 border-slate-900 py-1.5 px-2.5 sm:px-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] max-w-full">
                  <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[70px] sm:max-w-[150px]">
                    {spreadsheetName}
                  </span>
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-slate-950 transition-colors p-0.5 ml-0.5"
                    title="Open sheet in new window"
                  >
                    <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-900" />
                  </a>
                  <button
                    onClick={() => setIsConfiguringSheet(true)}
                    className="text-[9px] sm:text-[10px] font-bold text-slate-900 hover:text-slate-500 ml-1 underline-offset-2 hover:underline uppercase tracking-wider shrink-0"
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
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed leading-normal bg-amber-50 p-2 rounded border border-amber-200">
                      💡 <strong>Permissions Hint:</strong> If you get a "permission" / "caller does not have permission" error, it means the Google Sheets checkbox wasn't enabled. To fix, click the Power icon (top-right) to Sign Out, and sign back in while <strong>checking the permission boxes</strong>.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* Tab Selection Row */}
        {token && spreadsheetId && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex border-2 border-slate-900 rounded-2xl p-1 bg-slate-100 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] select-none gap-1 sm:gap-1.5 flex-wrap">
            {/* 1. Barcode Scanner */}
            <button
              type="button"
              onClick={() => {
                setCurrentTab('scanner');
              }}
              className={`w-full md:w-auto md:flex-1 py-2.5 px-2 md:py-3 md:px-4 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 relative ${
                currentTab === 'scanner'
                  ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="truncate">Barcode Scanner</span>
              {scannerActive && (
                <span className="absolute top-1.5 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>

            {/* 2. Registry & Catalog */}
            <button
              type="button"
              onClick={() => {
                setCurrentTab('registry');
                setScannerActive(false); // disable camera scanner when leaving scanner tab to save power/battery
              }}
              className={`w-full md:w-auto md:flex-1 py-2.5 px-2 md:py-3 md:px-4 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
                currentTab === 'registry'
                  ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span className="truncate">Registry & Catalog</span>
            </button>

            {/* 3. Reports & Stats */}
            <button
              type="button"
              onClick={() => {
                setCurrentTab('reports');
                setScannerActive(false);
              }}
              className={`w-full md:w-auto md:flex-1 py-2.5 px-2 md:py-3 md:px-4 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
                currentTab === 'reports'
                  ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-pink-500 shrink-0" />
              <span className="truncate">Reports & Stats</span>
            </button>

            {/* 4. Manage Users */}
            {activeSystemUser?.role === 'admin' ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('users');
                  setScannerActive(false);
                }}
                className={`w-full md:w-auto md:flex-1 py-2.5 px-2 md:py-3 md:px-4 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
                  currentTab === 'users'
                    ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Users className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="truncate">Manage Users</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  alert("Access Denied: Only administrators have permission to access the user control directory.");
                }}
                className="w-full md:w-auto md:flex-1 py-2.5 px-2 md:py-3 md:px-4 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-not-allowed opacity-50 flex items-center justify-center gap-1.5 sm:gap-2 text-slate-400"
                title="Requires administrator privileges"
              >
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Manage Users</span>
              </button>
            )}

            {/* 5. Setup & Config */}
            {activeSystemUser?.role === 'admin' ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('setup');
                  setScannerActive(false); // disable camera scanner when leaving scanner tab to save power/battery
                }}
                className={`w-full md:w-auto md:flex-1 py-2.5 px-2 md:py-3 md:px-4 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
                  currentTab === 'setup'
                    ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Settings className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate">Setup & Config</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  alert("Access Denied: Only administrators have permission to access the setup & configuration panel.");
                }}
                className="w-full md:w-auto md:flex-1 py-2.5 px-2 md:py-3 md:px-4 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-not-allowed opacity-50 flex items-center justify-center gap-1.5 sm:gap-2 text-slate-400"
                title="Requires administrator privileges"
              >
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Setup & Config</span>
              </button>
            )}
          </div>
        )}

        {currentTab === 'setup' ? (
          <SetupModule />
        ) : currentTab === 'reports' ? (
          <ReportModule orders={orders} />
        ) : currentTab === 'users' ? (
          <UsersModule token={token} spreadsheetId={spreadsheetId} />
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
                      Position Barcode or Type (SO#, PL#, or Invoice#)
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

            {/* Filter tab row - horizontally scrollable list on mobile, grid on large displays */}
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-2xl p-1.5 mb-5 text-xs font-bold border-2 border-slate-900 overflow-x-auto scrollbar-none snap-x whitespace-nowrap">
              {(['All', 'Registered', 'Picking', 'Checking', 'Waiting Delivery', 'Delivery', 'Completed'] as const).filter(isFilterTabAllowed).map(tab => {
                const count = tab === 'All' ? totalCount
                            : tab === 'Registered' ? inRegisteredCount
                            : tab === 'Picking' ? inPickingCount
                            : tab === 'Checking' ? inCheckingCount
                            : tab === 'Waiting Delivery' ? inWaitingDeliveryCount
                            : tab === 'Delivery' ? inDeliveryCount
                            : tab === 'Completed' ? totalCompleted : 0;
                
                // Get corresponding icon and color
                let IconComponent = Layers;
                let activeClass = 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]';
                if (tab === 'Registered') {
                  IconComponent = ClipboardList;
                  activeClass = 'bg-sky-600 text-white shadow-[2px_2px_0px_0px_rgba(14,165,233,0.3)]';
                } else if (tab === 'Picking') {
                  IconComponent = Package;
                  activeClass = 'bg-blue-600 text-white shadow-[2px_2px_0px_0px_rgba(37,99,235,0.3)]';
                } else if (tab === 'Checking') {
                  IconComponent = ClipboardCheck;
                  activeClass = 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(245,158,11,0.3)]';
                } else if (tab === 'Waiting Delivery') {
                  IconComponent = Clock;
                  activeClass = 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(99,102,241,0.3)]';
                } else if (tab === 'Delivery') {
                  IconComponent = Truck;
                  activeClass = 'bg-teal-600 text-white shadow-[2px_2px_0px_0px_rgba(20,184,166,0.3)]';
                } else if (tab === 'Completed') {
                  IconComponent = CheckCircle2;
                  activeClass = 'bg-emerald-600 text-white shadow-[2px_2px_0px_0px_rgba(16,185,129,0.3)]';
                }

                const isActive = activeFilter === tab;

                return (
                  <button
                    key={tab}
                    id={`filter-tab-${tab.replace(/\s+/g, '-')}`}
                    type="button"
                    onClick={() => setActiveFilter(tab)}
                    className={`shrink-0 min-w-max py-2 px-3.5 flex items-center justify-center gap-1.5 rounded-xl transition-all cursor-pointer snap-start border-2 border-transparent active:scale-95 ${
                      isActive
                        ? `${activeClass} border-slate-900`
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="tracking-tight">{tab}</span>
                    <span className={`inline-flex items-center justify-center text-[9px] px-1.5 py-0.5 rounded-full font-extrabold transition-all min-w-[18px] ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Query Search */}
            <div className="relative mb-5 focus-within:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus-within:translate-y-[-1px] rounded-xl transition-all">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders in list by ID, customer, PL# or description..."
                className="bg-slate-50 border-2 border-slate-900 rounded-xl pl-11 pr-10 py-3 w-full text-xs font-semibold outline-none focus:bg-white transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
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
                  {filteredOrders.map(order => {
                    const isSelected = selectedOrder?.id === order.id;
                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(isSelected ? null : order)}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-4 relative group hover:bg-slate-50/40 ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50/50 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] translate-y-[-2px]'
                            : 'border-slate-200 bg-white hover:border-slate-950 hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,0.08)]'
                        }`}
                      >
                        {/* Responsive Top Identifier Row */}
                        <div className="flex items-center justify-between gap-2.5 border-b border-dashed border-slate-200 pb-3 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap text-slate-700 min-w-0">
                            {order.lastUpdated && (
                              <span className="font-mono font-bold text-[9px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg tracking-wide shrink-0 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
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
                            <span className="bg-slate-900 border-2 border-slate-900 font-mono font-black text-[9px] text-white px-2 py-0.5 rounded-lg tracking-wider uppercase shrink-0">
                              SO#
                            </span>
                            <span className="font-mono font-black text-sm text-slate-900 group-hover:text-black transition-colors truncate min-w-0 tracking-tight">
                              {order.id}
                            </span>
                            <a
                              href={`${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(order.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-sans font-extrabold px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors shrink-0 ml-1"
                              title="Open tracking page in a new tab"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>Track Link</span>
                            </a>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[9px] sm:text-[10px] px-2.5 py-1 border-2 font-black rounded-xl uppercase tracking-wider shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${getStageBadgeColor(order.status)}`}>
                              {getStageLabel(order.status)}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors hidden sm:block" />
                          </div>
                        </div>

                        {/* Info Metadata section */}
                        {(order.customerName || order.packingListNo || order.invoiceNumber || order.totalPackage || order.assignedTo || order.khanDistrict || order.cityProvince) && (
                          <div className="flex flex-col gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-[11px] font-sans relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400" />
                            
                            {/* 1st line: Customer Name & Location */}
                            {(order.customerName || order.khanDistrict || order.cityProvince) && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pl-1.5">
                                {order.customerName && (
                                  <div className="flex items-start gap-2 min-w-0">
                                    <div className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0 mt-0.5">
                                      <User className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[8px] uppercase font-extrabold text-slate-400 tracking-wider leading-none mb-0.5">Customer Name</span>
                                      <span className="font-extrabold text-slate-800 text-[13px] break-words leading-tight">{order.customerName}</span>
                                    </div>
                                  </div>
                                )}
                                {(order.khanDistrict || order.cityProvince) && (
                                  <div className="flex items-start gap-2 shrink-0">
                                    <div className="p-1 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0 mt-0.5">
                                      <MapPin className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] uppercase font-extrabold text-slate-400 tracking-wider leading-none mb-0.5">Fulfillment Destination</span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {order.khanDistrict && (
                                          <span className="bg-indigo-100 text-indigo-850 font-extrabold px-2 py-0.5 rounded-md border border-indigo-200 text-[10px]">
                                            {order.khanDistrict}
                                          </span>
                                        )}
                                        {order.cityProvince && (
                                          <span className="bg-slate-200 text-slate-705 font-extrabold px-2 py-0.5 rounded-md border border-slate-300 text-[10px]">
                                            {order.cityProvince}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Grid row for parameters */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pl-1.5 pt-1.5 border-t border-dashed border-slate-200">
                              {/* PL# */}
                              <div className="bg-white border border-slate-250 rounded-xl p-2.5 flex flex-col justify-between hover:border-slate-400 transition-colors">
                                <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-slate-450 tracking-wider mb-1 flex items-center gap-1 shrink-0">
                                  <Clipboard className="w-2.5 h-2.5 text-slate-400" />
                                  PL#
                                </span>
                                <span className={`font-mono font-bold text-xs select-all break-all leading-none ${order.packingListNo ? 'text-slate-850' : 'text-slate-400 italic'}`}>
                                  {order.packingListNo || 'None'}
                                </span>
                              </div>
                              {/* INV# */}
                              <div className="bg-white border border-slate-250 rounded-xl p-2.5 flex flex-col justify-between hover:border-slate-400 transition-colors">
                                <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-slate-455 tracking-wider mb-1 flex items-center gap-1 shrink-0">
                                  <Receipt className="w-2.5 h-2.5 text-slate-400" />
                                  Invoice
                                </span>
                                <span className={`font-mono font-bold text-xs select-all break-all leading-none ${order.invoiceNumber ? 'text-slate-850' : 'text-slate-400 italic'}`}>
                                  {order.invoiceNumber || 'None'}
                                </span>
                              </div>
                              {/* Pkg */}
                              <div className="bg-white border border-slate-250 rounded-xl p-2.5 flex flex-col justify-between hover:border-slate-400 transition-colors">
                                <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-slate-450 tracking-wider mb-1 flex items-center gap-1 shrink-0">
                                  <Package className="w-2.5 h-2.5 text-slate-400" />
                                  Package(s)
                                </span>
                                <span className={`font-sans font-black text-xs leading-none ${order.totalPackage ? 'text-slate-850' : 'text-slate-400 italic'}`}>
                                  {order.totalPackage || '—'}
                                </span>
                              </div>
                              {/* Assigned */}
                              <div className="bg-white border border-slate-250 rounded-xl p-2.5 flex flex-col justify-between hover:border-slate-400 transition-colors">
                                <span className="text-[8px] sm:text-[9px] uppercase font-extrabold text-slate-450 tracking-wider mb-1 flex items-center gap-1 shrink-0">
                                  <Users className="w-2.5 h-2.5 text-slate-400" />
                                  Started by
                                </span>
                                <span className={`font-sans font-bold text-xs truncate leading-none ${order.assignedTo ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                                  {order.assignedTo || 'Unassigned'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Items description preview */}
                        {order.items ? (
                          <div className="p-3 bg-indigo-50/50 hover:bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl text-xs text-indigo-950 font-sans font-bold transition-colors group/note flex items-start gap-2.5">
                            <MessageSquare className="w-4 h-4 text-indigo-500 group-hover/note:scale-110 transition-transform shrink-0 mt-0.5" />
                            <span className="leading-relaxed whitespace-pre-line tracking-wide">
                              {order.items}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-450 break-words italic font-sans font-bold flex items-center gap-2 pl-1.5">
                            <FileText className="w-3.5 h-3.5 opacity-50 shrink-0" />
                            <span>No items listed or special instructions provided.</span>
                          </p>
                        )}

                        {/* Dedicated Smart Action Tray Section */}
                        <div 
                          className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100 justify-end w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const trackingUrl = `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(order.id)}`;
                              navigator.clipboard.writeText(trackingUrl);
                              setCopiedId(order.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="bg-slate-50 hover:bg-slate-150 text-slate-900 border-2 border-slate-900 font-sans font-black text-[10px] uppercase px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] select-none"
                            title="Copy public tracking page URL to clipboard"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-900" />
                            <span>{copiedId === order.id ? 'Copied Link!' : 'Copy Link'}</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsEditModalOpen(true);
                            }}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-slate-900 font-sans font-black text-[10px] uppercase px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] select-none"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-800" />
                            <span>Edit</span>
                          </button>

                          {(() => {
                            const qa = getQuickActionConfig(order.status);
                            if (!qa) return null;
                            const ActionIcon = qa.icon || CheckCircle2;
                            return (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStageClick(order)}
                                className={`font-sans font-black text-[10px] uppercase px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] select-none ${qa.color}`}
                              >
                                <ActionIcon className="w-3.5 h-3.5" />
                                <span>{qa.label}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
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
                  {/* Share/Print QR manual action button */}
                  <button
                    onClick={() => setQrModalOrder(selectedOrder)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-950 p-2.5 rounded-xl transition-all border-2 border-slate-900 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px]"
                    title="Generate and print tracking QR Code"
                  >
                    <QrCode className="w-4 h-4 text-indigo-650" />
                  </button>
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
                      <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-0.5 font-sans">Started by</span>
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

      {/* QR Code sharing and printing modal */}
      {qrModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-slate-900 rounded-3xl p-6 max-w-md w-full relative space-y-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-2.5 border-slate-100">
              <h3 className="font-display font-black text-slate-900 text-sm sm:text-base uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" /> Share & Print QR Tracker
              </h3>
              <button
                onClick={() => setQrModalOrder(null)}
                className="text-slate-400 hover:text-slate-900 transition-colors font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Print wrapper - styles conform with media tag */}
            <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] print-only-wrapper relative">
              <div className="flex items-center gap-1.5 border-b border-dashed border-slate-200 w-full pb-2 shrink-0">
                <Barcode className="w-4 h-4 text-slate-900" />
                <span className="font-display font-black text-slate-900 text-xs tracking-tight">ScanFlow Logistics</span>
                <span className="ml-auto text-[8px] font-mono font-extrabold text-slate-500 uppercase tracking-widest bg-slate-100 px-1 py-0.5 rounded">LIVE TRACKER</span>
              </div>

              <div className="bg-white border-2 border-slate-900 p-3 rounded-2xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
                <QRCodeSVG
                  id={`qr-svg-${qrModalOrder.id}`}
                  value={`${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(qrModalOrder.id)}`}
                  size={140}
                  level="M"
                />
              </div>

              <div className="w-full text-left space-y-1 bg-white border border-slate-150 rounded-xl p-3 shrink-0 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold text-slate-400">Order ID (SO#)</span>
                  <span className="font-mono font-black text-slate-950 text-xs bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">{qrModalOrder.id}</span>
                </div>
                {qrModalOrder.customerName && (
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Customer</span>
                    <span className="font-sans font-bold text-slate-800 text-[11px] truncate max-w-[160px] text-right">{qrModalOrder.customerName}</span>
                  </div>
                )}
                {qrModalOrder.packingListNo && (
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold text-slate-400">PL No</span>
                    <span className="font-mono text-slate-700 text-[10px] bg-slate-50 border px-1 py-0.5 rounded">{qrModalOrder.packingListNo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                  <span className="text-[9px] uppercase font-bold text-slate-405">Current Progress</span>
                  <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded bg-slate-100 border uppercase shrink-0`}>
                    {getStageLabel(qrModalOrder.status)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              This QR code maps secure offline-first tracking identifiers. Scanning with any mobile smartphone displays the live interactive logs instantly.
            </p>

            <div className="flex items-center gap-3 w-full pt-1">
              <button
                onClick={() => {
                  const link = `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(qrModalOrder.id)}`;
                  navigator.clipboard.writeText(link);
                  setCopiedId(qrModalOrder.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }}
                className="flex-1 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 font-bold text-xs uppercase py-2.5 rounded-xl transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] cursor-pointer text-center"
              >
                {copiedId === qrModalOrder.id ? 'Copied Link!' : 'Copy Link'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 font-black text-xs uppercase py-2.5 rounded-xl transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.25)] active:translate-y-[1px] cursor-pointer text-center"
              >
                Print tag
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
