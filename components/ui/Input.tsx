// ═══════════════════════════════════════════════════════════════
// Input, Textarea, Select — form controls
// Design rules:
//   • 6px border radius (rounded-md)
//   • Height: 36px standard, 44px on mobile-priority forms (lg variant)
//   • Border: 1px solid border-DEFAULT, brand on focus
//   • Background: surface-card
//   • 14px text (sm)
// ═══════════════════════════════════════════════════════════════

import { cn } from '@/lib/cn'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

// ─── Shared field wrapper ──────────────────────────────────────────
interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-text-secondary">
          {label}
          {required && <span className="text-danger-solid ml-1">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger-text">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  )
}

// ─── Input ─────────────────────────────────────────────────────────
type Size = 'default' | 'lg'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: Size
  hasError?: boolean
}

const sizeClasses: Record<Size, string> = {
  default: 'h-9 px-3 text-sm',
  lg:      'h-11 px-4 text-base', // 44px for mobile
}

export function Input({ inputSize = 'default', hasError, className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        'w-full bg-surface-card text-text-primary placeholder:text-text-tertiary',
        'border rounded-md transition-colors',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15',
        hasError ? 'border-danger-border' : 'border-border-strong hover:border-text-tertiary',
        sizeClasses[inputSize],
        className
      )}
      {...rest}
    />
  )
}

// ─── Textarea ──────────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

export function Textarea({ hasError, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full bg-surface-card text-text-primary placeholder:text-text-tertiary',
        'border rounded-md transition-colors p-3 text-sm',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15',
        'resize-y',
        hasError ? 'border-danger-border' : 'border-border-strong hover:border-text-tertiary',
        className
      )}
      {...rest}
    />
  )
}

// ─── Select ────────────────────────────────────────────────────────
interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  selectSize?: Size
  hasError?: boolean
  children: ReactNode
}

export function Select({ selectSize = 'default', hasError, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full bg-surface-card text-text-primary',
        'border rounded-md transition-colors appearance-none',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15',
        'bg-no-repeat bg-[length:16px] bg-[right_12px_center]',
        // chevron-down SVG as background image (inline encoded)
        `bg-[url("data:image/svg+xml,%3Csvg%20width='16'%20height='16'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%236b7d6e'%20stroke-width='2'%20xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline%20points='6%209%2012%2015%2018%209'%3E%3C/polyline%3E%3C/svg%3E")]`,
        hasError ? 'border-danger-border' : 'border-border-strong hover:border-text-tertiary',
        sizeClasses[selectSize],
        'pr-9', // room for chevron
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
}
