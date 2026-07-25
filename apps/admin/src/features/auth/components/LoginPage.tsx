import { useEffect, type FC, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { loginAdmin } from '../api/loginAdmin';
import { clearAuthError } from '../stores/authSlice';
import Icon from '@/components/icons/Icon';
import logo from '@/assets/logo.png';

// WHY zod + react-hook-form (per skill): declarative schema validation + minimal re-renders.
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

/**
 * LoginPage — email/password admin sign-in (spec §1.1; design system: centered white card on the warm
 * canvas, brand logo lockup, evergreen primary CTA, soft warm shadow).
 */
const LoginPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((s) => s.auth.loading);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  const onSubmit = async (data: LoginForm) => {
    const result = await dispatch(loginAdmin(data));
    if (loginAdmin.fulfilled.match(result)) {
      toast.success(`Welcome back, ${result.payload.fullName.split(' ')[0]}`);
      navigate('/', { replace: true });
    } else {
      toast.error((result.payload as string) ?? 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-8 shadow-lg">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="Barakath" className="h-16 w-auto object-contain" />
          <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-foreground">
            Admin panel
          </h1>
          <p className="mt-1 text-[14px] text-muted">Sign in to manage your store</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="admin@barakath.com"
            icon={<Icon name="MailLine" size={18} />}
            disabled={loading}
            error={errors.email?.message}
            register={register('email')}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<Icon name="LockPasswordLine" size={18} />}
            disabled={loading}
            error={errors.password?.message}
            register={register('password')}
          />

          {/* Submit — button-loading rule: disabled + spinner while in flight. */}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
};

// Local labelled input with a leading icon — shared shape for the two auth fields.
const Field: FC<{
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  icon: ReactNode;
  disabled: boolean;
  error?: string;
  register: UseFormRegisterReturn;
}> = ({ id, label, type, autoComplete, placeholder, icon, disabled, error, register }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-foreground">
      {label}
    </label>
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
        {icon}
      </span>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        {...register}
        className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-10 pr-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      />
    </div>
    {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
  </div>
);

export default LoginPage;
