'use client';
import ModalShell from '../primitive/ModalShell';
import IconDownload from '@/components/icon/icon-download';

type Props = {
    onClose: () => void;
    onConfirm: () => void;
};

export default function ExportConfirmationModal({ onClose, onConfirm }: Props) {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <ModalShell title="Konfirmasi Export" onClose={onClose} maxWidth="max-w-md" zIndexClass="z-[80]">
            <div className="grid gap-6">
                <div className="space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Apakah Anda yakin ingin mengunduh timesheet dalam format Excel?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        File akan berisi semua data task, assignees, dan waktu yang telah dilacak untuk project ini.
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 hover:bg-primary/90"
                    >
                        <IconDownload className="h-4 w-4" />
                        Download
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}
