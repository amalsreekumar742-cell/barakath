import { type FC, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { ColorUnit, GeneralSettingsProps, VariantGroup } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { updateVariables } from '../api/updateSettings';
import { SaveButton, inputCls } from './ui';

interface Props {
  settings: GeneralSettingsProps;
  onDirtyChange: (dirty: boolean) => void;
}

type Pending =
  | { kind: 'color'; index: number; name: string }
  | { kind: 'group'; index: number; name: string }
  | null;

const norm = (s: string) => s.trim().toLowerCase();

/** A removable chip (design: 7px-radius rectangle, subtle bg, optional leading square swatch). */
const Chip: FC<{ label: string; swatch?: string; onRemove: () => void }> = ({
  label,
  swatch,
  onRemove,
}) => (
  <span className="inline-flex items-center gap-1.5 rounded-[7px] border border-border bg-subtle px-2.5 py-1.5 text-[12px] font-semibold text-foreground">
    {swatch && (
      <span
        className="h-3 w-3 rounded-[4px] border border-border-strong"
        style={{ backgroundColor: swatch }}
      />
    )}
    {label}
    <button
      type="button"
      onClick={onRemove}
      className="flex items-center text-faint hover:text-error"
      aria-label={`Remove ${label}`}
    >
      <Icon name="CloseLine" size={13} />
    </button>
  </span>
);

/** A titled variables card (Color / Variant groups) with a top-right outline action. */
const VarCard: FC<{
  title: string;
  subtitle: string;
  action: { label: string; onClick: () => void };
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1 text-[12px] text-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={action.onClick}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary-subtle"
      >
        <Icon name="AddLine" size={14} /> {action.label}
      </button>
    </div>
    {children}
  </section>
);

/**
 * Tab 1 — Variables (spec §1.21, design: Settings › Variables). Two side-by-side cards: a "Color" card
 * (direct units, each with a swatch) and a "Variant groups" card (named groups holding text units). No
 * rename (delete + re-create); duplicate names blocked; deletes confirmed. Edited locally, persisted
 * atomically on Save.
 */
const VariablesTab: FC<Props> = ({ settings, onDirtyChange }) => {
  const dispatch = useAppDispatch();
  const { saveLoading } = useAppSelector((s) => s.settings);

  const [colors, setColors] = useState<ColorUnit[]>(settings.variables.colors);
  const [groups, setGroups] = useState<VariantGroup[]>(settings.variables.variantGroups);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  // Inline add-row toggles + drafts.
  const [addingColor, setAddingColor] = useState(false);
  const [colorName, setColorName] = useState('');
  const [colorCode, setColorCode] = useState('#1f8a5b');
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [unitOpen, setUnitOpen] = useState<number | null>(null);
  const [unitDrafts, setUnitDrafts] = useState<Record<number, string>>({});

  const dirty = useMemo(
    () =>
      JSON.stringify({ colors, groups }) !==
      JSON.stringify({ colors: settings.variables.colors, groups: settings.variables.variantGroups }),
    [colors, groups, settings.variables.colors, settings.variables.variantGroups],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // --- Colours ---
  const addColor = () => {
    const name = colorName.trim();
    if (!name) return toast.error('Enter a colour name');
    if (colors.some((c) => norm(c.name) === norm(name))) return toast.error('Colour already exists');
    setColors((prev) => [...prev, { name, code: colorCode }]);
    setColorName('');
    setColorCode('#1f8a5b');
    setAddingColor(false);
  };

  // --- Groups ---
  const addGroup = () => {
    const name = groupName.trim();
    if (!name) return toast.error('Enter a group name');
    if (groups.some((g) => norm(g.name) === norm(name))) return toast.error('Group already exists');
    setGroups((prev) => [...prev, { name, units: [] }]);
    setGroupName('');
    setAddingGroup(false);
  };

  const addUnit = (gi: number) => {
    const raw = (unitDrafts[gi] ?? '').trim();
    if (!raw) return toast.error('Enter a unit');
    if (groups[gi]!.units.some((u) => norm(u) === norm(raw))) return toast.error('Unit already exists');
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, units: [...g.units, raw] } : g)));
    setUnitDrafts((d) => ({ ...d, [gi]: '' }));
  };

  const removeUnit = (gi: number, ui: number) =>
    setGroups((prev) =>
      prev.map((g, i) => (i === gi ? { ...g, units: g.units.filter((_, j) => j !== ui) } : g)),
    );

  // --- Deletion confirm (colour / group) ---
  const confirmDelete = () => {
    if (!pending) return;
    if (pending.kind === 'color') setColors((prev) => prev.filter((_, i) => i !== pending.index));
    else setGroups((prev) => prev.filter((_, i) => i !== pending.index));
    setPending(null);
    setConfirmOpen(false);
  };

  // --- Save ---
  const doSave = async () => {
    const res = await dispatch(updateVariables({ colors, variantGroups: groups }));
    setSaveConfirm(false);
    if (updateVariables.fulfilled.match(res)) toast.success('Variables updated');
    else toast.error((res.payload as string) ?? 'Could not save variables');
  };

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2">
        {/* Color card — direct units */}
        <VarCard
          title="Color"
          subtitle="Direct units (no group)"
          action={{ label: 'Add unit', onClick: () => setAddingColor((v) => !v) }}
        >
          <div className="flex flex-wrap gap-2">
            {colors.length === 0 && !addingColor && (
              <p className="text-[13px] text-muted">No colours yet.</p>
            )}
            {colors.map((c, i) => (
              <Chip
                key={`${c.name}-${i}`}
                label={c.name}
                swatch={c.code}
                onRemove={() => {
                  setPending({ kind: 'color', index: i, name: c.name });
                  setConfirmOpen(true);
                }}
              />
            ))}
          </div>

          {addingColor && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface"
                aria-label="Colour hex"
              />
              <input
                autoFocus
                className={`${inputCls} min-w-0 flex-1`}
                placeholder="Colour name (e.g. Emerald)"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
              />
              <button
                type="button"
                onClick={addColor}
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-dark"
              >
                Add
              </button>
            </div>
          )}
        </VarCard>

        {/* Variant groups card */}
        <VarCard
          title="Variant groups"
          subtitle="Units live inside a group"
          action={{ label: 'Add group', onClick: () => setAddingGroup((v) => !v) }}
        >
          {groups.length === 0 && !addingGroup && (
            <p className="text-[13px] text-muted">No variant groups yet.</p>
          )}

          <div className="space-y-4">
            {groups.map((g, gi) => (
              <div key={`${g.name}-${gi}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-bold text-foreground">{g.name}</p>
                  <span className="inline-flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setUnitOpen((v) => (v === gi ? null : gi))}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      + Units
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPending({ kind: 'group', index: gi, name: g.name });
                        setConfirmOpen(true);
                      }}
                      className="flex items-center text-error hover:opacity-80"
                      aria-label={`Delete ${g.name}`}
                    >
                      <Icon name="CloseLine" size={15} />
                    </button>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.units.length === 0 && unitOpen !== gi && (
                    <span className="text-[12px] text-muted">No units.</span>
                  )}
                  {g.units.map((u, ui) => (
                    <Chip key={`${u}-${ui}`} label={u} onRemove={() => removeUnit(gi, ui)} />
                  ))}
                </div>
                {unitOpen === gi && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      autoFocus
                      className={`${inputCls} min-w-0 flex-1`}
                      placeholder="Add unit (e.g. Large)"
                      value={unitDrafts[gi] ?? ''}
                      onChange={(e) => setUnitDrafts((d) => ({ ...d, [gi]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUnit(gi))}
                    />
                    <button
                      type="button"
                      onClick={() => addUnit(gi)}
                      className="shrink-0 rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-dark"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {addingGroup && (
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
              <input
                autoFocus
                className={`${inputCls} min-w-0 flex-1`}
                placeholder="New group name (e.g. Size)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGroup())}
              />
              <button
                type="button"
                onClick={addGroup}
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-dark"
              >
                Add
              </button>
            </div>
          )}
        </VarCard>
      </div>

      <div className="mt-6 flex justify-end">
        <SaveButton onClick={() => setSaveConfirm(true)} loading={saveLoading} disabled={!dirty} />
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={pending?.kind === 'group' ? 'Delete variant group?' : 'Delete colour?'}
        message={pending ? `Remove "${pending.name}"? This takes effect when you save.` : ''}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => {
          setPending(null);
          setConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={saveConfirm}
        title="Save variables?"
        message="Colours and variant groups will be available on the product form."
        confirmLabel="Save"
        loading={saveLoading}
        onConfirm={doSave}
        onCancel={() => setSaveConfirm(false)}
      />
    </div>
  );
};

export default VariablesTab;
