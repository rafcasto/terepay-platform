'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '../_components/Spinner';
import { obPrimaryBtn, obError } from '../_components/onboarding-styles';

type Stage = 'phone' | 'otp';

export default function VerifyMobilePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [bypassMode, setBypassMode] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Skip this step if phone is already verified
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.phoneVerified) {
          router.replace('/applicant/onboarding/profile');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  // ── Send OTP ────────────────────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    setError('');
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/kyc/send-sms-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to send code. Please try again.');
        return;
      }
      if (data.bypassMode) setBypassMode(true);
      setStage('otp');
      startCooldown();
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  // ── Verify OTP ──────────────────────────────────────────────────────────
  const handleVerifyOtp = useCallback(async () => {
    setError('');
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/kyc/verify-sms-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Invalid or expired code.');
        return;
      }
      router.push('/applicant/onboarding/profile');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [otp, phone, router]);

  // ── OTP digit input handling ─────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // only digits
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      e.preventDefault();
      setOtp(text.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ── 60s resend cooldown ──────────────────────────────────────────────
  const startCooldown = () => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="flex items-center justify-center min-h-full py-10 px-4">
      <div className="w-full max-w-md screen-in">
        {checking ? (
          <div className="flex justify-center">
            <Spinner size={24} className="text-brand-text" />
          </div>
        ) : stage === 'phone' ? (
          <PhoneStage
            phone={phone}
            setPhone={setPhone}
            onSubmit={handleSendOtp}
            loading={loading}
            error={error}
          />
        ) : (
          <OtpStage
            phone={phone}
            otp={otp}
            otpRefs={otpRefs}
            onOtpChange={handleOtpChange}
            onOtpKeyDown={handleOtpKeyDown}
            onOtpPaste={handleOtpPaste}
            onVerify={handleVerifyOtp}
            onResend={handleSendOtp}
            loading={loading}
            error={error}
            cooldown={cooldown}
            bypassMode={bypassMode}
          />
        )}
      </div>
    </div>
  );
}

// ── Phone stage ────────────────────────────────────────────────────────────

function PhoneStage({
  phone,
  setPhone,
  onSubmit,
  loading,
  error,
}: {
  phone: string;
  setPhone: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-ink-strong">Verify your mobile</h2>
        <p className="text-[var(--text-muted)] mt-1 text-sm">
          We&apos;ll send a 6-digit code to your New Zealand mobile number.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-ink-strong mb-1.5">
          Mobile number <span className="text-danger-text">*</span>
        </label>
        <div className="flex rounded-md border border-border-default bg-surface-card focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:border-brand overflow-hidden transition-shadow">
          {/* NZ prefix (no emoji per DS product-UI rule) */}
          <span className="flex items-center px-3.5 bg-surface-sunken border-r border-border-default text-sm font-medium text-ink-strong shrink-0 select-none font-tabular">
            NZ +64
          </span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="21 123 4567"
            className="flex-1 px-3.5 h-11 text-sm outline-none bg-surface-card text-[var(--text-body)] placeholder:text-[var(--text-disabled)]"
            autoFocus
          />
        </div>
      </div>

      {error && <p className={`${obError} mb-4`}>{error}</p>}

      <button onClick={onSubmit} disabled={loading} className={obPrimaryBtn}>
        {loading ? 'Sending…' : 'Send code'}
      </button>
    </>
  );
}

// ── OTP stage ─────────────────────────────────────────────────────────────

function OtpStage({
  phone,
  otp,
  otpRefs,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  onVerify,
  onResend,
  loading,
  error,
  cooldown,
  bypassMode,
}: {
  phone: string;
  otp: string[];
  otpRefs: React.RefObject<(HTMLInputElement | null)[]>;
  onOtpChange: (i: number, v: string) => void;
  onOtpKeyDown: (i: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOtpPaste: (e: React.ClipboardEvent) => void;
  onVerify: () => void;
  onResend: () => void;
  loading: boolean;
  error: string;
  cooldown: number;
  bypassMode: boolean;
}) {
  return (
    <>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-ink-strong">Enter the code</h2>
        {bypassMode ? (
          <p className="text-warning-text mt-1 text-sm font-medium">
            SMS verification is currently disabled. Enter <strong>000000</strong> to continue.
          </p>
        ) : (
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            We sent a 6-digit code to <span className="font-medium text-ink-strong font-tabular">+64 {phone}</span>
          </p>
        )}
      </div>

      {/* 6-digit OTP boxes */}
      <div className="flex gap-2 sm:gap-3 mb-4 justify-between" onPaste={onOtpPaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              if (otpRefs.current) otpRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => onOtpChange(i, e.target.value)}
            onKeyDown={(e) => onOtpKeyDown(i, e)}
            className="w-full max-w-[52px] h-14 text-center text-xl font-bold font-tabular border border-border-default rounded-md bg-surface-card text-ink-strong focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand outline-none transition-shadow"
            autoFocus={i === 0}
          />
        ))}
      </div>

      {error && <p className={`${obError} mb-4`}>{error}</p>}

      <button onClick={onVerify} disabled={loading} className={`${obPrimaryBtn} mb-4`}>
        {loading ? 'Verifying…' : 'Verify code'}
      </button>

      <p className="text-center text-sm text-[var(--text-muted)]">
        Didn&apos;t receive a code?{' '}
        {cooldown > 0 ? (
          <span className="text-[var(--text-disabled)]">Resend in {cooldown}s</span>
        ) : (
          <button
            onClick={onResend}
            disabled={loading}
            className="text-brand-text font-semibold underline-offset-2 hover:underline disabled:opacity-50"
          >
            Resend
          </button>
        )}
      </p>
    </>
  );
}
