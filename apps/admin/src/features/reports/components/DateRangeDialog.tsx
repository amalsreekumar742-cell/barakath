import { type FC, useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  format,
} from 'date-fns';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import type { DateRange } from '../types';

/** Quick presets — each returns an inclusive [from, to] window in epoch millis. */
const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'Today', range: () => ({ from: startOfDay(new Date()).getTime(), to: endOfDay(new Date()).getTime() }) },
  {
    label: 'Yesterday',
    range: () => ({ from: startOfDay(subDays(new Date(), 1)).getTime(), to: endOfDay(subDays(new Date(), 1)).getTime() }),
  },
  { label: 'Last 7 days', range: () => ({ from: startOfDay(subDays(new Date(), 6)).getTime(), to: endOfDay(new Date()).getTime() }) },
  { label: 'Last 30 days', range: () => ({ from: startOfDay(subDays(new Date(), 29)).getTime(), to: endOfDay(new Date()).getTime() }) },
  { label: 'This month', range: () => ({ from: startOfMonth(new Date()).getTime(), to: endOfDay(new Date()).getTime() }) },
  {
    label: 'Last month',
    range: () => ({ from: startOfMonth(subMonths(new Date(), 1)).getTime(), to: endOfMonth(subMonths(new Date(), 1)).getTime() }),
  },
  { label: 'This year', range: () => ({ from: startOfYear(new Date()).getTime(), to: endOfDay(new Date()).getTime() }) },
];

/**
 * DateRangeDialog — the shared date-range chooser (spec §1.19). Opened by the "Date range" button (Apply)
 * and by "Export Excel" (which chooses/confirms the window before the export runs). From/To pickers plus
 * quick presets; Confirm returns the normalized [startOfDay(from), endOfDay(to)] range to the parent.
 */
const DateRangeDialog: FC<{
  isOpen: boolean;
  onClose: () => void;
  initialRange: DateRange;
  title: string;
  confirmLabel: string;
  confirmLoading?: boolean;
  onConfirm: (range: DateRange) => void;
}> = ({ isOpen, onClose, initialRange, title, confirmLabel, confirmLoading = false, onConfirm }) => {
  const [from, setFrom] = useState<Date>(new Date(initialRange.from));
  const [to, setTo] = useState<Date>(new Date(initialRange.to));

  // Re-seed from the current range each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setFrom(new Date(initialRange.from));
      setTo(new Date(initialRange.to));
    }
  }, [isOpen, initialRange.from, initialRange.to]);

  const activePreset = PRESETS.find((p) => {
    const r = p.range();
    return r.from === startOfDay(from).getTime() && r.to === endOfDay(to).getTime();
  })?.label;

  const confirm = () => onConfirm({ from: startOfDay(from).getTime(), to: endOfDay(to).getTime() });

  return (
    <Modal isOpen={isOpen} onClose={confirmLoading ? () => {} : onClose} maxWidth="max-w-[460px]">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={confirmLoading}
            className="rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <Icon name="CloseLine" size={18} />
          </button>
        </div>

        {/* From / To */}
        <div className="orders-datepicker flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-1.5 block text-[12px] font-bold text-foreground">From</label>
            <DatePicker
              selected={from}
              onChange={(d) => d && setFrom(d)}
              selectsStart
              startDate={from}
              endDate={to}
              maxDate={to}
              dateFormat="dd MMM yyyy"
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-primary"
              wrapperClassName="w-full"
            />
          </div>
          <span className="mt-6 text-[13px] text-faint">to</span>
          <div className="flex-1">
            <label className="mb-1.5 block text-[12px] font-bold text-foreground">To</label>
            <DatePicker
              selected={to}
              onChange={(d) => d && setTo(d)}
              selectsEnd
              startDate={from}
              endDate={to}
              minDate={from}
              dateFormat="dd MMM yyyy"
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-primary"
              wrapperClassName="w-full"
            />
          </div>
        </div>

        {/* Presets */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = activePreset === p.label;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const r = p.range();
                  setFrom(new Date(r.from));
                  setTo(new Date(r.to));
                }}
                className={`rounded-pill border px-3 py-1 text-[12px] font-semibold transition-colors ${
                  active ? 'border-primary bg-primary-subtle text-primary' : 'border-border-strong text-muted hover:bg-subtle'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] text-muted">
          {format(from, 'd MMM yyyy')} – {format(to, 'd MMM yyyy')}
        </p>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={confirmLoading}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={confirmLoading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLoading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DateRangeDialog;
