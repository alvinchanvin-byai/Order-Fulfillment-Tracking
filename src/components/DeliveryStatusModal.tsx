/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, AlertTriangle, RefreshCcw, Truck } from 'lucide-react';

export type DeliveryOutcome = 'Success' | 'Incomplete' | 'Return';

interface DeliveryStatusModalProps {
  isOpen: boolean;
  orderId: string;
  onSubmit: (status: DeliveryOutcome) => void;
  onCancel: () => void;
}

export function DeliveryStatusModal({ isOpen, orderId, onSubmit, onCancel }: DeliveryStatusModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border-2 border-slate-900 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b-2 border-slate-900 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-900 border border-indigo-200 p-2.5 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg leading-tight">Finalize Delivery</h3>
            <p className="text-[11px] text-slate-500 font-mono font-bold mt-0.5">Order: {orderId}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Fulfillment checking is complete and this second scan signifies the arrival at destination. Please record the final delivery status outcome below:
          </p>

          <div className="grid grid-cols-1 gap-3 pt-2">
            
            {/* Option Success */}
            <button
              onClick={() => onSubmit('Success')}
              className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-900 hover:bg-emerald-50/20 text-left transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
            >
              <div className="bg-emerald-500 text-white p-2 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Delivered Successfully</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-tight">Order successfully completed and handed to recipient.</p>
              </div>
            </button>

            {/* Option Incomplete */}
            <button
              onClick={() => onSubmit('Incomplete')}
              className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-900 hover:bg-amber-50/20 text-left transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
            >
              <div className="bg-amber-500 text-white p-2 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Delivery Incomplete</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-tight">Could not complete fully (e.g. partial handover or specific item issue).</p>
              </div>
            </button>

            {/* Option Return */}
            <button
              onClick={() => onSubmit('Return')}
              className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-900 hover:bg-rose-50/20 text-left transition-all hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
            >
              <div className="bg-rose-500 text-white p-2 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <RefreshCcw className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Returned to Warehouse</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-tight">Delivery aborted/rejected. Package being routed back to source.</p>
              </div>
            </button>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t-2 border-slate-900 flex justify-end">
          <button
            onClick={onCancel}
            className="text-slate-500 hover:bg-slate-200 hover:text-slate-900 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-colors"
          >
            Cancel Scan
          </button>
        </div>

      </div>
    </div>
  );
}
