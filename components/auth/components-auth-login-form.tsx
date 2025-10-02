'use client';
import IconLockDots from '@/components/icon/icon-lock-dots';
import IconMail from '@/components/icon/icon-mail';
import { signInAction, type AuthFormState } from '@/actions/auth';
import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

const initialState: AuthFormState = {}; // { message?: string; error?: string }

const showMessage = (msg = '', type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
  const toast = Swal.mixin({
    toast: true,
    position: 'top',
    showConfirmButton: false,
    timer: 3000,
    customClass: { container: 'toast' },
  });
  toast.fire({
    icon: type,
    title: msg,
    padding: '10px 20px',
  });
};

const SubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-gradient !mt-6 w-full border-0 uppercase shadow-[0_10px_20px_-10px_rgba(67,97,238,0.44)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? 'Signing in...' : 'Sign in'}
    </button>
  );
};

const ComponentsAuthLoginForm = () => {
  const [state, formAction] = useFormState(signInAction, initialState);

  useEffect(() => {
    if (!state) return;
    if (state.error) showMessage(state.error, 'error');
    else if (state.message) showMessage(state.message, 'success');
  }, [state]);

  return (
    <form className="space-y-5 dark:text-white" action={formAction}>
      <div>
        <label htmlFor="email">Email</label>
        <div className="relative text-white-dark">
          <input id="email" name="email" type="email" placeholder="Enter Email" autoComplete="email" required className="form-input ps-10 placeholder:text-white-dark" />
          <span className="absolute start-4 top-1/2 -translate-y-1/2">
            <IconMail fill />
          </span>
        </div>
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <div className="relative text-white-dark">
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter Password"
            autoComplete="current-password"
            required
            className="form-input ps-10 placeholder:text-white-dark"
          />
          <span className="absolute start-4 top-1/2 -translate-y-1/2">
            <IconLockDots fill />
          </span>
        </div>
      </div>
      <div>
        <label className="flex cursor-pointer items-center">
          <input type="checkbox" className="form-checkbox bg-white dark:bg-black" />
          <span className="text-white-dark">Subscribe to weekly newsletter</span>
        </label>
      </div>

      {/* optional: tetap tampilkan error text di bawah form */}
      {state?.error ? <p className="text-sm font-semibold text-rose-400">{state.error}</p> : null}

      <SubmitButton />
    </form>
  );
};

export default ComponentsAuthLoginForm;
