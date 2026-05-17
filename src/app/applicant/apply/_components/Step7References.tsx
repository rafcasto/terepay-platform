'use client';

import { useFormContext, type UseFormRegister } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 h-11 border border-border rounded-xl text-sm focus:ring-2 focus:ring-accent focus:border-accent focus:outline-none transition-colors bg-surface text-text placeholder:text-muted/70';
const labelCls = 'block text-sm font-semibold text-text mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger font-medium';

function ReferenceCard({
  index,
  register,
  errors,
}: {
  index: 1 | 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  errors: ReturnType<typeof useFormContext>['formState']['errors'];
}) {
  const key = `reference${index}` as 'reference1' | 'reference2';
  const e = (errors.references as Record<string, unknown> | undefined)?.[key] as
    | { name?: { message?: string }; email?: { message?: string } }
    | undefined;

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Reference {index}</h3>
      <div>
        <label className={labelCls}>Name</label>
        <input
          {...register(`references.${key}.name` as Parameters<typeof register>[0])}
          className={inputCls}
          placeholder="Full name"
        />
        {e?.name && <p className={errorCls}>{e.name.message}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            {...register(`references.${key}.email` as Parameters<typeof register>[0])}
            className={inputCls}
            placeholder="email@example.com"
          />
          {e?.email && <p className={errorCls}>{e.email.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input
            type="tel"
            {...register(`references.${key}.phone` as Parameters<typeof register>[0])}
            className={inputCls}
            placeholder="+64 21 000 0000"
          />
        </div>
      </div>
    </div>
  );
}

export default function Step7References() {
  const {
    register,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">References</h2>
        <p className="text-xs text-muted mt-1">
          Optional — provide up to two references (not family members).
        </p>
      </div>

      <div className="flex items-start gap-3 bg-accent-soft border border-accent/40 rounded-xl p-4">
        <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-accent-2">
          References must not be family members. They may be colleagues, employers, or friends.
          Providing references is optional but may support your application.
        </p>
      </div>

      <ReferenceCard index={1} register={register} errors={errors} />
      <ReferenceCard index={2} register={register} errors={errors} />
    </div>
  );
}
