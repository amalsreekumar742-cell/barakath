import { type FC, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { updateVariables } from '@/features/settings/api/updateSettings';
import type { VariantOption } from '@barakath/shared/types';
import { variantLabel } from '@barakath/shared/utils/variantOptions';
import { selectedUnit, setGroupOption, toggleGroupOption } from '../utils/variantPick';

/**
 * VariantColorPicker / VariantUnitPicker — the product form's variant Color and Variant fields, sourced
 * from Settings → Variables (spec §1.21: the colours + variant-group units defined in Settings feed the
 * product add form, and new ones can be created on the fly). Selecting fills the inline "new variant"
 * row; creating a new colour/unit writes it back to `general/config` via `updateVariables` (so it's then
 * available to every product). The variant stores color/colorCode, plus — from the unit picker — one
 * unit per group as `options` with `name` derived from them (`variantLabel`).
 */

const norm = (s: string) => s.trim().toLowerCase();

/** A portal dropdown anchored under `anchorRef` — avoids being clipped by the table's overflow. */
const Dropdown: FC<{
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
}> = ({ anchorRef, onClose, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 220) });
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      )
        onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  if (!pos) return null;
  return ReactDOM.createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 1000 }}
      className="max-h-72 overflow-y-auto rounded-lg border border-border-strong bg-surface p-1.5 shadow-lg"
    >
      {children}
    </div>,
    document.body,
  );
};

const triggerCls =
  'flex w-full min-w-[120px] items-center justify-between gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1.5 text-left text-[13px] text-foreground';

// ---------------------------------------------------------------------------------------------------

export const VariantColorPicker: FC<{
  value: string;
  colorCode: string;
  onSelect: (name: string, code: string) => void;
}> = ({ value, colorCode, onSelect }) => {
  const dispatch = useAppDispatch();
  const colors = useAppSelector((s) => s.settings.settings?.variables.colors ?? []);
  const groups = useAppSelector((s) => s.settings.settings?.variables.variantGroups ?? []);
  const saveLoading = useAppSelector((s) => s.settings.saveLoading);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('#0f7a5a');

  const create = async () => {
    const name = newName.trim();
    if (!name) return toast.error('Enter a colour name');
    if (colors.some((c) => norm(c.name) === norm(name))) return toast.error('Colour already exists');
    const res = await dispatch(updateVariables({ colors: [...colors, { name, code: newCode }], variantGroups: groups }));
    if (updateVariables.fulfilled.match(res)) {
      onSelect(name, newCode);
      setCreating(false);
      setNewName('');
      setNewCode('#0f7a5a');
      setOpen(false);
      toast.success('Colour added');
    } else toast.error('Could not add colour');
  };

  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen((v) => !v)} className={triggerCls}>
        <span className="flex min-w-0 items-center gap-1.5">
          {value ? (
            <>
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: colorCode }} />
              <span className="truncate">{value}</span>
            </>
          ) : (
            <span className="text-faint">Colour</span>
          )}
        </span>
        <Icon name="ArrowDownLine" size={14} className="shrink-0 text-faint" />
      </button>

      {open && (
        <Dropdown anchorRef={anchorRef} onClose={() => setOpen(false)}>
          {colors.length === 0 && !creating && (
            <p className="px-2 py-2 text-[12px] text-muted">No colours yet. Add one below.</p>
          )}
          {colors.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                onSelect(c.name, c.code);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-subtle"
            >
              <span className="h-3.5 w-3.5 rounded-full border border-border" style={{ backgroundColor: c.code }} />
              {c.name}
            </button>
          ))}

          <div className="my-1 border-t border-border" />
          {creating ? (
            <div className="p-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border-strong p-0.5"
                  aria-label="New colour hex"
                />
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), create())}
                  placeholder="Colour name"
                  className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-primary"
                />
              </div>
              <div className="mt-1.5 flex justify-end gap-1.5">
                <button type="button" onClick={() => setCreating(false)} className="rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-subtle">
                  Cancel
                </button>
                <button type="button" onClick={create} disabled={saveLoading} className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-primary hover:bg-primary-subtle">
              <Icon name="AddLine" size={14} /> New colour
            </button>
          )}
        </Dropdown>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------------------------------

/**
 * The Variant field: ONE unit per Settings group — Size 57 + Layer 2 for a cap — rather than one unit
 * overall, so a product can vary on several axes besides colour. `value` is the row's picks in Settings
 * group order (see `utils/variantPick`); the trigger shows their `variantLabel` ("57 · Layer 2").
 *
 * WHY the dropdown stays open on a pick: a multi-axis variant needs a pick in several groups, and
 * closing after each one would mean reopening it per group. It closes on Done, an outside click or
 * Escape. Clicking a group's selected unit again — or the × beside the group name — clears that group.
 */
export const VariantUnitPicker: FC<{ value: VariantOption[]; onChange: (options: VariantOption[]) => void }> = ({
  value,
  onChange,
}) => {
  const dispatch = useAppDispatch();
  const colors = useAppSelector((s) => s.settings.settings?.variables.colors ?? []);
  const groups = useAppSelector((s) => s.settings.settings?.variables.variantGroups ?? []);
  const saveLoading = useAppSelector((s) => s.settings.saveLoading);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUnit, setNewUnit] = useState('');
  const [groupName, setGroupName] = useState('');

  const groupOrder = groups.map((g) => g.name);
  const label = variantLabel(value);

  const openCreate = () => {
    setGroupName(groups[0]?.name ?? 'Size');
    setCreating(true);
  };

  const create = async () => {
    const unit = newUnit.trim();
    const target = groupName.trim() || 'Size';
    if (!unit) return toast.error('Enter a unit');
    const exists = groups.find((g) => norm(g.name) === norm(target));
    if (exists?.units.some((u) => norm(u) === norm(unit))) return toast.error('Unit already exists');
    const nextGroups = exists
      ? groups.map((g) => (norm(g.name) === norm(target) ? { ...g, units: [...g.units, unit] } : g))
      : [...groups, { name: target, units: [unit] }];
    const res = await dispatch(updateVariables({ colors, variantGroups: nextGroups }));
    if (updateVariables.fulfilled.match(res)) {
      // Fills the new unit's OWN group slot, under the group's Settings spelling (the admin may have
      // typed "size"), and keeps the other groups' picks. Ordered by `nextGroups`, since a brand-new
      // group is not in the store's copy yet. The dropdown stays open for the remaining groups.
      onChange(setGroupOption(value, nextGroups.map((g) => g.name), exists?.name ?? target, unit));
      setCreating(false);
      setNewUnit('');
      toast.success('Unit added');
    } else toast.error('Could not add unit');
  };

  const hasUnits = groups.some((g) => g.units.length > 0);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label || undefined}
        className={triggerCls}
      >
        <span className="truncate">{label || <span className="text-faint">Variant</span>}</span>
        <Icon name="ArrowDownLine" size={14} className="shrink-0 text-faint" />
      </button>

      {open && (
        <Dropdown anchorRef={anchorRef} onClose={() => setOpen(false)}>
          {!hasUnits && !creating && (
            <p className="px-2 py-2 text-[12px] text-muted">No variant units yet. Add one below.</p>
          )}
          {groups.map((g) => {
            if (g.units.length === 0) return null;
            const picked = selectedUnit(value, g.name);
            return (
              <div key={g.name} className="mb-1">
                <div className="flex items-center justify-between gap-1 px-2 py-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-faint">{g.name}</p>
                  {picked !== undefined && (
                    <button
                      type="button"
                      onClick={() => onChange(setGroupOption(value, groupOrder, g.name, null))}
                      className="rounded p-0.5 text-faint hover:bg-subtle hover:text-foreground"
                      aria-label={`Clear ${g.name}`}
                    >
                      <Icon name="CloseLine" size={12} />
                    </button>
                  )}
                </div>
                {g.units.map((u) => {
                  const on = picked !== undefined && norm(picked) === norm(u);
                  return (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onChange(toggleGroupOption(value, groupOrder, g.name, u))}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                        on ? 'bg-primary-subtle font-semibold text-primary' : 'hover:bg-subtle'
                      }`}
                    >
                      {u}
                      {on && <Icon name="CheckLine" size={14} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className="my-1 border-t border-border" />
          {creating ? (
            <div className="space-y-1.5 p-1.5">
              <input
                autoFocus
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), create())}
                placeholder="Unit (e.g. M, 100ml)"
                className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-primary"
              />
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group (e.g. Size)"
                list="variant-group-names"
                className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-primary"
              />
              <datalist id="variant-group-names">
                {groups.map((g) => (
                  <option key={g.name} value={g.name} />
                ))}
              </datalist>
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setCreating(false)} className="rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-subtle">
                  Cancel
                </button>
                <button type="button" onClick={create} disabled={saveLoading} className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                  Add
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={openCreate} className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-primary hover:bg-primary-subtle">
                <Icon name="AddLine" size={14} /> New unit
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-primary-dark">
                Done
              </button>
            </div>
          )}
        </Dropdown>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------------------------------

/**
 * The Image field: which of the product's gallery photos shows this variant (`VariantProps.imageUrl`).
 * Picking a colour on the storefront slides the gallery to it. `value` is the photo's local draft id
 * (see `VariantDraft.imageId`) and `images` is the gallery as drafted, in order — so a photo added in
 * this session can be linked before it is uploaded.
 */
export const VariantImagePicker: FC<{
  value?: string;
  images: { id: string; src: string }[];
  onSelect: (imageId: string | undefined) => void;
}> = ({ value, images, onSelect }) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const index = images.findIndex((img) => img.id === value);
  const picked = index >= 0 ? images[index] : undefined;

  const pick = (id: string | undefined) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen((v) => !v)} className={`${triggerCls} !min-w-[96px]`}>
        <span className="flex min-w-0 items-center gap-1.5">
          {picked ? (
            <>
              <img src={picked.src} alt="" className="h-6 w-6 shrink-0 rounded border border-border object-cover" />
              <span className="truncate">Photo {index + 1}</span>
            </>
          ) : (
            <span className="text-faint">Photo</span>
          )}
        </span>
        <Icon name="ArrowDownLine" size={14} className="shrink-0 text-faint" />
      </button>

      {open && (
        <Dropdown anchorRef={anchorRef} onClose={() => setOpen(false)}>
          {images.length === 0 ? (
            <p className="px-2 py-2 text-[12px] text-muted">Add product images first.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 p-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => pick(img.id)}
                  aria-label={`Photo ${i + 1}`}
                  className={`relative aspect-square overflow-hidden rounded-md border-2 bg-subtle ${
                    img.id === value ? 'border-primary' : 'border-transparent hover:border-border-strong'
                  }`}
                >
                  <img src={img.src} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 rounded-tr bg-ink/60 px-1 text-[9px] font-bold text-white">{i + 1}</span>
                </button>
              ))}
            </div>
          )}
          {picked && (
            <>
              <div className="my-1 border-t border-border" />
              <button type="button" onClick={() => pick(undefined)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-muted hover:bg-subtle">
                <Icon name="CloseLine" size={14} /> No photo
              </button>
            </>
          )}
        </Dropdown>
      )}
    </>
  );
};
