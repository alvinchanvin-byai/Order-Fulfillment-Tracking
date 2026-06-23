/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, Trash2, Info } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border-2 border-slate-900 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Border header warning accent if destructive */}
        <div className={`h-1.5 ${isDestructive ? 'bg-red-500' : 'bg-slate-900'}`} />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
              {isDestructive ? <Trash2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>

            <div>
              <h3 className="font-display font-bold text-slate-900 text-lg leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 mt-2 whitespace-pre-line font-medium leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 text-amber-900 text-xs p-3.5 rounded-xl border-2 border-slate-900 flex items-start gap-2 mt-4 font-semibold">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 font-bold" />
            <span>This change will update the remote connected Google Sheet file instantly. This user modification must be explicitly confirmed.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t-2 border-slate-900 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
              isDestructive
                ? 'bg-red-650 hover:bg-red-700 text-white'
                : 'bg-slate-900 hover:bg-black text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
