import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { navGroups } from '@/config/navigation';
import { useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import logo from '@/assets/logo.png';

/**
 * Sidebar — fixed 236px navigation rail (spec §1.2, §1.22; design: white rail, warm hairline border,
 * pale-green active pill, tiny tracked group eyebrows).
 *
 * WHY permission-filtered: each item carries a `module` key; we show it only when
 *   `currentAdmin.permissions[module]` is granted (spec §1.20). A group with no visible items is
 *   hidden entirely (no empty heading).
 * WHY NavLink: react-router marks the active route; `end` on Dashboard stops "/" matching every path.
 * Per §1.22 there is intentionally no global search, no notification bell, no quick actions and no
 * drag-to-reorder here.
 */
const Sidebar: FC = () => {
  const permissions: Record<string, boolean> =
    useAppSelector((s) => s.currentAdmin.admin?.permissions) ?? {};

  return (
    <aside className="flex h-screen w-[236px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-border px-5">
        <img src={logo} alt="Barakath" className="h-8 w-auto object-contain" />
        <span className="rounded-sm bg-primary-subtle px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
          Admin
        </span>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, gi) => {
          const items = group.items.filter((item) => permissions[item.module] === true);
          if (items.length === 0) return null;

          return (
            <div key={group.label ?? `group-${gi}`} className="mb-5">
              {group.label && (
                <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors duration-150',
                          isActive
                            ? 'bg-primary-subtle font-semibold text-primary'
                            : 'font-medium text-muted hover:bg-subtle hover:text-foreground',
                        ].join(' ')
                      }
                    >
                      <Icon name={item.icon} size={18} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
