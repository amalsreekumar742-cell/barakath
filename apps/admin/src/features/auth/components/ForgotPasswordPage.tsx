import { useEffect, useRef, type FC } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { forgotPassword } from '../api/forgotPassword';
import { resetForgotPassword } from '../stores/authSlice';
import Icon from '@/components/icons/Icon';
import logo from '@/assets/logo.png';

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});
type ForgotForm = z.infer<typeof forgotSchema>;

/**
 * ForgotPasswordPage — request a Firebase password-reset email (spec §1.1; design: same centered card
 * language as login).
 *
 * WHY redirect after 3s on success: the spec flow is "email reset link → back to login with success
 * toast". The delay lets the admin read the toast; the timer is cleared on unmount.
 */
const ForgotPasswordPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((s) => s.auth.loading);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  useEffect(() => {
    dispatch(resetForgotPassword());
    return () => {
      dispatch(resetForgotPassword());
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [dispatch]);

  const onSubmit = async (data: ForgotForm) => {
    const result = await dispatch(forgotPassword(data));
    if (forgotPassword.fulfilled.match(result)) {
      toast.success('Reset link sent to your email');
      redirectTimer.current = setTimeout(() => navigate('/login', { replace: true }), 3000);
    } else {
      toast.error((result.payload as string) ?? 'Could not send reset link');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="Barakath" className="h-16 w-auto object-contain" />
          <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-foreground">
            Forgot password
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-foreground">
              Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
                <Icon name="MailLine" size={18} />
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@barakath.com"
                disabled={loading}
                {...register('email')}
                className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-10 pr-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>
            {errors.email && <p className="mt-1 text-[12px] text-error">{errors.email.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            <Icon name="ArrowLeftLine" size={16} /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
