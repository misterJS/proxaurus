'use client';
import React from 'react';
import Portal from './Portal';

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; 
  zIndexClass?: string; 
};

export default function ModalShell({
  title, onClose, children, footer,
  maxWidth = 'max-w-md',
  zIndexClass = 'z-[70]',
}: ModalShellProps) {
  return (
    <Portal>
      <div
        role="dialog" aria-modal="true"
        className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm`}
      >
        <div className={`w-full ${maxWidth} rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-[#0f172a]`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
          <div className="px-6 py-6">{children}</div>
          {footer ? <div className="px-6 pb-6">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  );
}
