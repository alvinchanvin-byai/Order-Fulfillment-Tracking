import { useState, useMemo } from 'react';
import { 
  Download, 
  Search, 
  Calendar,
  Layers,
  Clock,
  User,
  MapPin,
  ClipboardList,
  Building,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import type { Order } from '../types';
import * as XLSX from 'xlsx';

interface ReportModuleProps {
  orders: Order[];
}

type ReportType = 'picking' | 'checking' | 'picking_checking' | 'waiting_delivery' | 'master';

export function ReportModule({ orders }: ReportModuleProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('picking');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // Helper to format ISO strings cleanly
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return '-';
    }
  };

  const formatDateOnly = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  // Helper to compute duration between two timestamps in a human friendly format
  const computeDurationStr = (startIso?: string, endIso?: string): string => {
    if (!startIso || !endIso) return '-';
    try {
      const start = new Date(startIso).getTime();
      const end = new Date(endIso).getTime();
      if (isNaN(start) || isNaN(end) || end < start) return '-';
      
      const diffMs = end - start;
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      let parts: string[] = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      return parts.join(' ');
    } catch {
      return '-';
    }
  };

  const renderStatusBadge = (status: string) => {
    let config = {
      label: status,
      bgColor: 'bg-slate-50',
      textColor: 'text-slate-700',
      borderColor: 'border-slate-200',
      dotColor: 'bg-slate-400',
      animateDot: false,
    };

    switch (status) {
      case 'REGISTERED':
        config = {
          label: 'Order Registered',
          bgColor: 'bg-sky-50',
          textColor: 'text-sky-800',
          borderColor: 'border-sky-200',
          dotColor: 'bg-sky-500',
          animateDot: false,
        };
        break;
      case 'PENDING_PICKING':
        config = {
          label: 'Awaiting Picking',
          bgColor: 'bg-slate-50',
          textColor: 'text-slate-600',
          borderColor: 'border-slate-200',
          dotColor: 'bg-slate-400',
          animateDot: false,
        };
        break;
      case 'PICKING_STARTED':
        config = {
          label: 'Picking Started',
          bgColor: 'bg-amber-50',
          textColor: 'text-amber-800',
          borderColor: 'border-amber-200',
          dotColor: 'bg-amber-500',
          animateDot: true,
        };
        break;
      case 'READY_CHECKING':
        config = {
          label: 'Ready to Check',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          dotColor: 'bg-blue-500',
          animateDot: false,
        };
        break;
      case 'CHECKING_STARTED':
        config = {
          label: 'Checking Started',
          bgColor: 'bg-purple-50',
          textColor: 'text-purple-800',
          borderColor: 'border-purple-200',
          dotColor: 'bg-purple-500',
          animateDot: true,
        };
        break;
      case 'READY_DELIVERY':
        config = {
          label: 'Ready to Deliver',
          bgColor: 'bg-indigo-50',
          textColor: 'text-indigo-800',
          borderColor: 'border-indigo-200',
          dotColor: 'bg-indigo-500',
          animateDot: false,
        };
        break;
      case 'DELIVERY_STARTED':
        config = {
          label: 'In Delivery',
          bgColor: 'bg-teal-50',
          textColor: 'text-teal-800',
          borderColor: 'border-teal-200',
          dotColor: 'bg-teal-500',
          animateDot: true,
        };
        break;
      case 'DELIVERED_SUCCESS':
        config = {
          label: 'Delivered - Success',
          bgColor: 'bg-emerald-50',
          textColor: 'text-emerald-850',
          borderColor: 'border-emerald-250',
          dotColor: 'bg-emerald-500',
          animateDot: false,
        };
        break;
      case 'DELIVERED_INCOMPLETE':
        config = {
          label: 'Delivered - Incomplete',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-850',
          borderColor: 'border-yellow-250',
          dotColor: 'bg-yellow-500',
          animateDot: false,
        };
        break;
      case 'DELIVERED_RETURN':
        config = {
          label: 'Delivered - Return',
          bgColor: 'bg-rose-50',
          textColor: 'text-rose-850',
          borderColor: 'border-rose-250',
          dotColor: 'bg-rose-500',
          animateDot: false,
        };
        break;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-extrabold border-2 rounded-lg shadow-sm transition-all duration-150 tracking-wider ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${config.animateDot ? 'animate-pulse' : ''}`} />
        <span className="uppercase font-sans">{config.label}</span>
      </span>
    );
  };

  // Compute stats and records
  const processedData = useMemo(() => {
    // Phase 1: Filter orders by query and dates
    return orders.filter(order => {
      // General searchable logic
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = 
          order.id.toLowerCase().includes(q) ||
          (order.customerName || '').toLowerCase().includes(q) ||
          (order.khanDistrict || '').toLowerCase().includes(q) ||
          (order.cityProvince || '').toLowerCase().includes(q) ||
          (order.bu || '').toLowerCase().includes(q) ||
          (order.packingListNo || '').toLowerCase().includes(q) ||
          (order.assignedTo || '').toLowerCase().includes(q);
        
        if (!matchesQuery) return false;
      }

      // Date Range Filter (based on lastUpdated list)
      const dateToCompareVal = order.lastUpdated ? new Date(order.lastUpdated).getTime() : 0;
      if (startDateStr) {
        const startLimit = new Date(`${startDateStr}T00:00:00`).getTime();
        if (dateToCompareVal < startLimit) return false;
      }
      if (endDateStr) {
        const endLimit = new Date(`${endDateStr}T23:59:59`).getTime();
        if (dateToCompareVal > endLimit) return false;
      }

      return true;
    });
  }, [orders, searchQuery, startDateStr, endDateStr]);

  // Generate Picking performance report rows
  const pickingRows = useMemo(() => {
    return processedData.map(order => {
      const date = formatDateOnly(order.pickStart || order.lastUpdated);
      const startPick = formatDateTime(order.pickStart);
      const endPick = formatDateTime(order.pickEnd);
      const timeUse = computeDurationStr(order.pickStart, order.pickEnd);
      return {
        date,
        orderId: order.id,
        customerName: order.customerName || 'None',
        khan: order.khanDistrict || 'None',
        cityProvince: order.cityProvince || 'None',
        packingListNo: order.packingListNo || 'None',
        totalPackage: order.totalPackage || 'None',
        startedBy: order.assignedTo || 'Unassigned',
        bu: order.bu || 'None',
        startPick,
        endPick,
        timeUse
      };
    });
  }, [processedData]);

  // Generate Checking performance report rows
  const checkingRows = useMemo(() => {
    return processedData.map(order => {
      const date = formatDateOnly(order.checkStart || order.lastUpdated);
      const startCheck = formatDateTime(order.checkStart);
      const endCheck = formatDateTime(order.checkEnd);
      const timeUse = computeDurationStr(order.checkStart, order.checkEnd);
      return {
        date,
        orderId: order.id,
        customerName: order.customerName || 'None',
        khan: order.khanDistrict || 'None',
        cityProvince: order.cityProvince || 'None',
        packingListNo: order.packingListNo || 'None',
        totalPackage: order.totalPackage || 'None',
        startedBy: order.assignedTo || 'Unassigned',
        bu: order.bu || 'None',
        startCheck,
        endCheck,
        timeUse
      };
    });
  }, [processedData]);

  // Generate Picking & Checking report rows
  const pickingCheckingRows = useMemo(() => {
    return processedData.map(order => {
      const date = formatDateOnly(order.pickStart || order.lastUpdated);
      const startPick = formatDateTime(order.pickStart);
      const endCheck = formatDateTime(order.checkEnd);
      const timeUse = computeDurationStr(order.pickStart, order.checkEnd);
      return {
        date,
        orderId: order.id,
        customerName: order.customerName || 'None',
        khan: order.khanDistrict || 'None',
        cityProvince: order.cityProvince || 'None',
        packingListNo: order.packingListNo || 'None',
        totalPackage: order.totalPackage || 'None',
        startedBy: order.assignedTo || 'Unassigned',
        bu: order.bu || 'None',
        startPick,
        endCheck,
        timeUse
      };
    });
  }, [processedData]);

  // Generate Waiting Delivery report rows
  const waitingDeliveryRows = useMemo(() => {
    return processedData
      .filter(order => order.status === 'READY_DELIVERY')
      .map(order => {
        const date = formatDateOnly(order.lastUpdated);
        const pickStart = formatDateTime(order.pickStart);
        const pickEnd = formatDateTime(order.pickEnd);
        const checkStart = formatDateTime(order.checkStart);
        const checkEnd = formatDateTime(order.checkEnd);
        
        return {
          status: order.status,
          date,
          orderId: order.id,
          customerName: order.customerName || 'None',
          khan: order.khanDistrict || 'None',
          cityProvince: order.cityProvince || 'None',
          packingListNo: order.packingListNo || 'None',
          invoiceNo: order.invoiceNumber || 'None',
          totalPackage: order.totalPackage || 'None',
          pickStart,
          pickEnd,
          pickerBy: order.assignedTo || 'Unassigned',
          checkStart,
          checkEnd,
          checkerBy: order.assignedTo || 'Unassigned'
        };
      });
  }, [processedData]);

  // Generate Master report rows
  const masterRows = useMemo(() => {
    return processedData.map(order => {
      const date = formatDateOnly(order.lastUpdated);
      const pickStart = formatDateTime(order.pickStart);
      const pickEnd = formatDateTime(order.pickEnd);
      const checkStart = formatDateTime(order.checkStart);
      const checkEnd = formatDateTime(order.checkEnd);
      const deliveryStart = formatDateTime(order.deliveryStart);
      const deliveryEnd = formatDateTime(order.deliveryEnd);
      
      return {
        status: order.status,
        date,
        orderId: order.id,
        customerName: order.customerName || 'None',
        khan: order.khanDistrict || 'None',
        cityProvince: order.cityProvince || 'None',
        packingListNo: order.packingListNo || 'None',
        invoiceNo: order.invoiceNumber || 'None',
        totalPackage: order.totalPackage || 'None',
        pickStart,
        pickEnd,
        pickerBy: order.assignedTo || 'Unassigned',
        checkStart,
        checkEnd,
        checkerBy: order.assignedTo || 'Unassigned',
        deliveryStart,
        deliveryEnd,
        deliveryBy: order.assignedTo || 'Unassigned'
      };
    });
  }, [processedData]);

  // Excel / CSV Export Trigger
  const handleExportToExcel = () => {
    let sheetData: any[] = [];
    let fileName = '';

    if (activeReport === 'picking') {
      fileName = 'Picking_Performance_Report';
      sheetData = pickingRows.map(row => ({
        'Date': row.date,
        'SO #': row.orderId,
        'Customer Name': row.customerName,
        'Khan': row.khan,
        'City/Province': row.cityProvince,
        'Packing List #': row.packingListNo,
        'Total Package': row.totalPackage,
        'Started By': row.startedBy,
        'BU': row.bu,
        'Start Picking Date/Time': row.startPick,
        'End Picking Date/Time': row.endPick,
        'Time Used': row.timeUse
      }));
    } else if (activeReport === 'checking') {
      fileName = 'Checking_Performance_Report';
      sheetData = checkingRows.map(row => ({
        'Date': row.date,
        'SO #': row.orderId,
        'Customer Name': row.customerName,
        'Khan': row.khan,
        'City/Province': row.cityProvince,
        'Packing List #': row.packingListNo,
        'Total Package': row.totalPackage,
        'Started By': row.startedBy,
        'BU': row.bu,
        'Start Checking Date/Time': row.startCheck,
        'End Checking Date/Time': row.endCheck,
        'Time Used': row.timeUse
      }));
    } else if (activeReport === 'picking_checking') {
      fileName = 'Picking_And_Checking_Performance_Report';
      sheetData = pickingCheckingRows.map(row => ({
        'Date': row.date,
        'SO #': row.orderId,
        'Customer Name': row.customerName,
        'Khan': row.khan,
        'City/Province': row.cityProvince,
        'Packing List #': row.packingListNo,
        'Total Package': row.totalPackage,
        'Started By': row.startedBy,
        'BU': row.bu,
        'Start Picking Date/Time': row.startPick,
        'End Checking Date/Time': row.endCheck,
        'Time Used': row.timeUse
      }));
    } else if (activeReport === 'waiting_delivery') {
      fileName = 'Waiting_Delivery_Report';
      sheetData = waitingDeliveryRows.map(row => ({
        'Status': row.status,
        'Date': row.date,
        'SO #': row.orderId,
        'Customer Name': row.customerName,
        'Khan': row.khan,
        'City/Province': row.cityProvince,
        'Packing List #': row.packingListNo,
        'Invoice #': row.invoiceNo,
        'Total Package': row.totalPackage,
        'Pick Start Date/Time': row.pickStart,
        'Pick End Date/Time': row.pickEnd,
        'Picker By': row.pickerBy,
        'Check Start Date/Time': row.checkStart,
        'Check End Date/Time': row.checkEnd,
        'Checker By': row.checkerBy
      }));
    } else if (activeReport === 'master') {
      fileName = 'Master_Fulfillment_Report';
      sheetData = masterRows.map(row => ({
        'Status': row.status,
        'Date': row.date,
        'SO #': row.orderId,
        'Customer Name': row.customerName,
        'Khan': row.khan,
        'City/Province': row.cityProvince,
        'Packing List #': row.packingListNo,
        'Invoice #': row.invoiceNo,
        'Total Package': row.totalPackage,
        'Pick Start Date/Time': row.pickStart,
        'Pick End Date/Time': row.pickEnd,
        'Picker By': row.pickerBy,
        'Check Start Date/Time': row.checkStart,
        'Check End Date/Time': row.checkEnd,
        'Checker By': row.checkerBy,
        'Delivery Start Date/Time': row.deliveryStart,
        'Delivery End Date/Time': row.deliveryEnd,
        'Delivery By': row.deliveryBy
      }));
    }

    if (sheetData.length === 0) {
      alert('No data available to export.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report_Data');
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-5">
      
      {/* Tab controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-lg font-black font-display uppercase tracking-tight text-slate-900">
            Fulfillment Performance Reports
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Analyze picker outputs, checking intervals, delivery statuses, and timestamps.
          </p>
        </div>

        <button
          onClick={handleExportToExcel}
          className="bg-indigo-600 hover:bg-indigo-700 active:translate-y-0.5 text-white py-2 px-4 rounded-xl font-bold uppercase tracking-wider text-xs border-2 border-slate-900 flex items-center justify-center gap-1.5 transition-transform cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Report selector grid controls */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <button
          onClick={() => setActiveReport('picking')}
          className={`px-3 py-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
            activeReport === 'picking'
              ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-slate-50 text-slate-755 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          1. Picking Performance
        </button>
        <button
          onClick={() => setActiveReport('checking')}
          className={`px-3 py-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
            activeReport === 'checking'
              ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-slate-50 text-slate-755 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          2. Checking Performance
        </button>
        <button
          onClick={() => setActiveReport('picking_checking')}
          className={`px-3 py-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
            activeReport === 'picking_checking'
              ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-slate-50 text-slate-755 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          3. Picking & Checking
        </button>
        <button
          onClick={() => setActiveReport('waiting_delivery')}
          className={`px-3 py-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
            activeReport === 'waiting_delivery'
              ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-slate-50 text-slate-755 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          4. Waiting Delivery
        </button>
        <button
          onClick={() => setActiveReport('master')}
          className={`px-3 py-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
            activeReport === 'master'
              ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
              : 'bg-slate-50 text-slate-755 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          5. Master Report
        </button>
      </div>

      {/* Advanced Filters Row */}
      <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">
            Search Parameters
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="SO#, customer, location, BU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Start date */}
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">
            Start Date Range
          </label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold outline-none font-mono"
            />
          </div>
        </div>

        {/* End date */}
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">
            End Date Range
          </label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="w-full bg-white border-2 border-slate-900 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Main interactive data container */}
      <div className="border-2 border-slate-900 rounded-2xl overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
        <div className="overflow-x-auto max-w-full">
          {activeReport === 'picking' && (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Date</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans font-mono text-indigo-200">SO #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Customer Name</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-stone-200">Khan</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-stone-200">City/Province</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Packing List #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Total Package</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Started By</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">BU</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-sky-200">Start Picking</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-sky-200">End Picking</th>
                  <th className="px-3.5 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider font-sans text-emerald-300">Time Use</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs">
                {pickingRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center italic text-slate-400 font-medium">
                      No records match the applied report filter.
                    </td>
                  </tr>
                ) : (
                  pickingRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-700 whitespace-nowrap">{row.date}</td>
                      <td className="px-3.5 py-2.5 font-black text-slate-900 font-mono select-all whitespace-nowrap bg-indigo-50/40 text-[13px]">{row.orderId}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 break-words max-w-[150px]">{row.customerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.khan}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.cityProvince}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 whitespace-nowrap font-medium">{row.packingListNo}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-indigo-700">{row.totalPackage}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{row.startedBy}</td>
                      <td className="px-3.5 py-2.5 font-mono whitespace-nowrap font-bold text-slate-500">{row.bu}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">{row.startPick}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">{row.endPick}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                          row.timeUse === '-' 
                            ? 'bg-slate-100 text-slate-400' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {row.timeUse}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeReport === 'checking' && (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Date</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans font-mono text-indigo-200">SO #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Customer Name</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-stone-200">Khan</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-stone-200">City/Province</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Packing List #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Total Package</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Started By</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">BU</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-pink-200">Start Checking</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-pink-200">End Checking</th>
                  <th className="px-3.5 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider font-sans text-emerald-300">Time Use</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs">
                {checkingRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center italic text-slate-400 font-medium">
                      No records match the applied report filter.
                    </td>
                  </tr>
                ) : (
                  checkingRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-700 whitespace-nowrap">{row.date}</td>
                      <td className="px-3.5 py-2.5 font-black text-slate-900 font-mono select-all whitespace-nowrap bg-indigo-50/40 text-[13px]">{row.orderId}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 break-words max-w-[150px]">{row.customerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.khan}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.cityProvince}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 whitespace-nowrap font-medium">{row.packingListNo}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-indigo-700">{row.totalPackage}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{row.startedBy}</td>
                      <td className="px-3.5 py-2.5 font-mono whitespace-nowrap font-bold text-slate-500">{row.bu}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">{row.startCheck}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">{row.endCheck}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                          row.timeUse === '-' 
                            ? 'bg-slate-100 text-slate-400' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {row.timeUse}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeReport === 'picking_checking' && (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Date</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans font-mono text-indigo-200">SO #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Customer Name</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-stone-200">Khan</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-stone-200">City/Province</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Packing List #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Total Package</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Started By</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">BU</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-sky-200">Start Picking</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-pink-200">End Checking</th>
                  <th className="px-3.5 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider font-sans text-emerald-300">Time Use</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs">
                {pickingCheckingRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center italic text-slate-400 font-medium">
                      No records match the applied report filter.
                    </td>
                  </tr>
                ) : (
                  pickingCheckingRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-700 whitespace-nowrap">{row.date}</td>
                      <td className="px-3.5 py-2.5 font-black text-slate-900 font-mono select-all whitespace-nowrap bg-indigo-50/40 text-[13px]">{row.orderId}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 break-words max-w-[150px]">{row.customerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.khan}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.cityProvince}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 whitespace-nowrap font-medium">{row.packingListNo}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-indigo-700">{row.totalPackage}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{row.startedBy}</td>
                      <td className="px-3.5 py-2.5 font-mono whitespace-nowrap font-bold text-slate-500">{row.bu}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">{row.startPick}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">{row.endCheck}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                          row.timeUse === '-' 
                            ? 'bg-slate-100 text-slate-400' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {row.timeUse}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeReport === 'waiting_delivery' && (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-rose-300">Status</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Date</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans font-mono text-indigo-200">SO #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Customer Name</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Khan</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">City/Province</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Packing List #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Invoice #</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Total Package</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-sky-200">Pick Start Date/Time</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-sky-200">Pick End Date/Time</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Picker By</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-pink-200">Check Start Date/Time</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-pink-200">Check End Date/Time</th>
                  <th className="px-3.5 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Checker By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs">
                {waitingDeliveryRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center italic text-slate-400 font-medium">
                      No records match the applied report filter.
                    </td>
                  </tr>
                ) : (
                  waitingDeliveryRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {renderStatusBadge(row.status)}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-700 whitespace-nowrap">{row.date}</td>
                      <td className="px-3.5 py-2.5 font-black text-slate-900 font-mono bg-indigo-50/40 select-all whitespace-nowrap text-[13px]">{row.orderId}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 break-words max-w-[150px]">{row.customerName}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.khan}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap font-medium">{row.cityProvince}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 whitespace-nowrap font-medium">{row.packingListNo}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-700 whitespace-nowrap font-medium">{row.invoiceNo}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-indigo-700">{row.totalPackage}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.pickStart}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.pickEnd}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{row.pickerBy}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.checkStart}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.checkEnd}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{row.checkerBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeReport === 'master' && (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-rose-300">Status</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Date</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans font-mono text-indigo-200">SO #</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Customer Name</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Khan</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">City/Province</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Packing List #</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Invoice #</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Total Package</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-sky-200">Pick Start</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-sky-200">Pick End</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Picker By</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-pink-200">Check Start</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-pink-200">Check End</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Checker By</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-teal-200">Delivery Start</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans text-teal-200">Delivery End</th>
                  <th className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider font-sans">Delivery By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs">
                {masterRows.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-8 text-center italic text-slate-400 font-medium">
                      No records match the applied report filter.
                    </td>
                  </tr>
                ) : (
                  masterRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {renderStatusBadge(row.status)}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-700 whitespace-nowrap">{row.date}</td>
                      <td className="px-3 py-2 font-black text-slate-900 font-mono bg-indigo-50/40 select-all whitespace-nowrap text-[13px]">{row.orderId}</td>
                      <td className="px-3 py-2 font-bold text-slate-800 break-words max-w-[150px]">{row.customerName}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-medium">{row.khan}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-medium">{row.cityProvince}</td>
                      <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap font-medium">{row.packingListNo}</td>
                      <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap font-medium">{row.invoiceNo}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-indigo-700">{row.totalPackage}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.pickStart}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.pickEnd}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{row.pickerBy}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.checkStart}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.checkEnd}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{row.checkerBy}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.deliveryStart}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap text-[10px]">{row.deliveryEnd}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{row.deliveryBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
