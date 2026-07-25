import { type FC, type ReactNode, type FocusEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { SubAdminRole, SubAdminStatus } from '@barakath/shared/config/enums';
import type { SubAdminRole as SubAdminRoleType } from '@barakath/shared/config/enums';
import type { SubAdminProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Constants } from '@/config/constants';
import { createSubAdmin } from '../api/createSubAdmin';
import { updateSubAdmin } from '../api/updateSubAdmin';
import { resetSubAdminPassword } from '../api/resetSubAdminPassword';
import { isSubAdminEmailTaken } from '../api/isSubAdminEmailTaken';
import type { SubAdminInput } from '../types';
import { defaultPermissionsForRole, ALL_MODULES, MODULE_LABELS } from '../utils/permissionModel';

/**
 * Password policy (spec §1.20): min 8 chars, at least one uppercase, one lowercase, one number and one
 * special character — each its own message so the admin sees exactly which requirement is unmet.
 */
const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[0-9]/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a special character');

const baseFields = {
  fullName: z.string().trim().min(2, 'At least 2 characters').max(60, 'At most 60 characters'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit phone number'),
};

const createSchema = z.object({ ...baseFields, password: passwordSchema });
const editSchema = z.object({ ...baseFields });

interface FormValues {
  fullName: string;
  email: string;
  phone: string;
  password?: string;
}

/**
 * SubAdminForm — the shared Create/Edit sub-admin form (spec §1.20 / prototype "Sub Admin › Create"): a
 * two-column layout with a Details card (name, email, password, phone, role dropdown) on the left and a
 * flat Module-permissions toggle list on the right. Create writes a new admin; Edit hydrates the doc, locks
 * the email, hides the password (replaced by "Reset password"), and updates in place.
 *
 * WHY role + permissions live in useState (not react-hook-form): picking a role SEEDS the permission list
 * with role defaults and the admin then overrides individual toggles — imperative state, not per-field
 * validation, so RHF owns only the text fields.
 */
interface SubAdminFormProps {
  mode: 'create' | 'edit';
  subAdmin?: SubAdminProps;
}

const SubAdminForm: FC<SubAdminFormProps> = ({ mode, subAdmin }) => {
  const isEdit = mode === 'edit';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const saving = useAppSelector((s) => (isEdit ? s.subAdmin.updateLoading : s.subAdmin.createLoading));
  const resetPwLoading = useAppSelector((s) => s.subAdmin.resetPwLoading);
  const resettingPw = isEdit && subAdmin ? resetPwLoading === subAdmin.email : false;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as Resolver<FormValues>,
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });

  const [role, setRole] = useState<SubAdminRoleType>(subAdmin?.role ?? SubAdminRole.SUPPORT);
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    subAdmin?.permissions ?? defaultPermissionsForRole(SubAdminRole.SUPPORT),
  );
  const [emailChecking, setEmailChecking] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const hydrated = useRef(false);

  // Hydrate from the loaded sub-admin on Edit (once). Phone is stored with the country code — strip it.
  useEffect(() => {
    if (!isEdit || hydrated.current || !subAdmin) return;
    hydrated.current = true;
    setValue('fullName', subAdmin.fullName);
    setValue('email', subAdmin.email);
    setValue('phone', subAdmin.phone.replace(Constants.DEFAULT_COUNTRY_CODE, '').replace(/\D/g, '').slice(-10));
    setRole(subAdmin.role);
    setPermissions(subAdmin.permissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subAdmin, isEdit]);

  const isSuperAdmin = role === SubAdminRole.SUPER_ADMIN;

  // Picking a role re-seeds the permissions with its defaults; the admin may then override (except Super).
  const onRoleChange = (next: SubAdminRoleType) => {
    setRole(next);
    setPermissions(defaultPermissionsForRole(next));
  };

  const onEmailBlur = async (e: FocusEvent<HTMLInputElement>) => {
    if (isEdit) return;
    const value = e.target.value.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
    setEmailChecking(true);
    try {
      if (await isSubAdminEmailTaken(value)) setError('email', { message: 'Email already in use' });
    } finally {
      setEmailChecking(false);
    }
  };

  const cancel = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    navigate('/sub-admin');
  };

  // Build the input and dispatch. Super admin is forced all-ON regardless of the (locked) toggles.
  const onSubmit = async (values: FormValues) => {
    const perms = isSuperAdmin ? defaultPermissionsForRole(SubAdminRole.SUPER_ADMIN) : permissions;
    const input: SubAdminInput = {
      fullName: values.fullName,
      email: values.email,
      phone: `${Constants.DEFAULT_COUNTRY_CODE}${values.phone}`,
      role,
      permissions: perms,
      status: subAdmin?.status ?? SubAdminStatus.ACTIVE,
      ...(isEdit ? {} : { password: values.password }),
    };

    const res =
      isEdit && subAdmin
        ? await dispatch(updateSubAdmin({ id: subAdmin.id, input, previous: subAdmin }))
        : await dispatch(createSubAdmin({ input }));

    if (createSubAdmin.fulfilled.match(res) || updateSubAdmin.fulfilled.match(res)) {
      toast.success(isEdit ? 'Sub admin updated' : 'Sub admin created');
      navigate('/sub-admin');
    } else {
      const msg = (res.payload as string) ?? 'Could not save sub admin';
      if (msg === 'Email already in use') setError('email', { message: msg });
      toast.error(msg);
    }
  };

  const onConfirmReset = async () => {
    if (!subAdmin) return;
    const res = await dispatch(resetSubAdminPassword(subAdmin.email));
    setConfirmReset(false);
    if (resetSubAdminPassword.fulfilled.match(res)) toast.success(`Reset email sent to ${subAdmin.email}`);
    else toast.error((res.payload as string) ?? 'Could not send reset email');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/sub-admin')}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
          >
            <Icon name="ArrowLeftLine" size={15} /> Sub admin
          </button>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">
            {isEdit ? 'Edit sub admin' : 'Create sub admin'}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {isEdit ? 'Save admin' : 'Create admin'}
          </button>
        </div>
      </div>

      <div className="grid max-w-[900px] gap-5 lg:grid-cols-2">
        {/* Details */}
        <Card title="Details">
          <div className="flex flex-col gap-4">
            <Field label="Full name" error={errors.fullName?.message}>
              <input {...register('fullName')} placeholder="e.g. Fatima N" className={inputCls} />
            </Field>

            <Field label="Email" error={errors.email?.message}>
              <input
                {...register('email')}
                onBlur={onEmailBlur}
                readOnly={isEdit}
                placeholder="name@barakath.com"
                className={`${inputCls} ${isEdit ? 'cursor-not-allowed bg-subtle text-muted' : ''}`}
              />
              {isEdit ? (
                <p className="mt-1 text-[12px] text-faint">Email is locked after creation</p>
              ) : (
                emailChecking && <p className="mt-1 text-[12px] text-faint">Checking availability…</p>
              )}
            </Field>

            {!isEdit ? (
              <Field label="Password" error={errors.password?.message}>
                <input
                  type="password"
                  {...register('password')}
                  placeholder="Min 8 chars, upper, lower, number, special"
                  className={inputCls}
                />
              </Field>
            ) : (
              subAdmin && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    disabled={resettingPw}
                    className="inline-flex w-fit items-center gap-2 rounded-md border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-primary-subtle disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resettingPw ? (
                      <Icon name="Loader4Line" size={15} className="animate-spin" />
                    ) : (
                      <Icon name="LockPasswordLine" size={15} />
                    )}
                    Reset password
                  </button>
                  <p className="text-[12px] text-faint">Sends a secure reset link to {subAdmin.email}</p>
                </div>
              )
            )}

            <Field label="Phone" error={errors.phone?.message}>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-border-strong bg-subtle px-3 text-[14px] font-semibold text-muted">
                  {Constants.DEFAULT_COUNTRY_CODE}
                </span>
                <input
                  {...register('phone')}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit number"
                  className={`${inputCls} rounded-l-none`}
                />
              </div>
            </Field>

            <Field label="Role">
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => onRoleChange(e.target.value as SubAdminRoleType)}
                  className={`${inputCls} appearance-none pr-9`}
                >
                  <option value={SubAdminRole.SUPER_ADMIN}>Super admin</option>
                  <option value={SubAdminRole.MANAGER}>Manager</option>
                  <option value={SubAdminRole.SUPPORT}>Support</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint">
                  <Icon name="ArrowDownLine" size={16} />
                </span>
              </div>
            </Field>
          </div>
        </Card>

        {/* Module permissions */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-[14px] font-bold text-foreground">Module permissions</h2>
          <p className="mb-2 mt-1 text-[12px] text-muted">
            {isSuperAdmin ? 'Super admin has access to every module.' : 'Set individually for this admin'}
          </p>
          <div className="max-h-[360px] overflow-auto">
            {ALL_MODULES.map((m) => (
              <div
                key={m}
                className="flex items-center justify-between border-b border-border py-2.5 last:border-0"
              >
                <span className="text-[13px] font-semibold text-foreground">{MODULE_LABELS[m]}</span>
                <button
                  type="button"
                  onClick={() => setPermissions((prev) => ({ ...prev, [m]: !prev[m] }))}
                  disabled={isSuperAdmin}
                  aria-label={`Toggle ${MODULE_LABELS[m]}`}
                  aria-pressed={!!permissions[m]}
                  className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-60 ${
                    permissions[m] ? 'bg-primary' : 'bg-border-strong'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                      permissions[m] ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmReset}
        title="Send password reset?"
        message={`A secure reset link will be emailed to ${subAdmin?.email ?? ''}.`}
        confirmLabel="Send reset email"
        confirmVariant="primary"
        loading={resettingPw}
        onConfirm={onConfirmReset}
        onCancel={() => setConfirmReset(false)}
      />
    </form>
  );
};

const inputCls =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20';

const Card: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
    <h2 className="mb-4 text-[14px] font-bold text-foreground">{title}</h2>
    {children}
  </div>
);

const Field: FC<{ label: string; error?: string; children: ReactNode }> = ({ label, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[12px] font-bold text-foreground">{label}</label>
    {children}
    {error && <p className="text-[12px] text-error">{error}</p>}
  </div>
);

export default SubAdminForm;
