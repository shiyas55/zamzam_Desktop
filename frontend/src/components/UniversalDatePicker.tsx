import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface UniversalDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}

/**
 * UniversalDatePicker
 * Standard HTML5 <input type="date"> delegates display format to the OS locale,
 * causing it to display as MM/DD/YYYY on US-locale machines and DD/MM/YYYY on others.
 * This component guarantees consistent DD/MM/YYYY (Date/Month/Year) display across
 * ALL devices, operating systems, and browsers while preserving the native calendar picker.
 */
export const UniversalDatePicker: React.FC<UniversalDatePickerProps> = ({
  value,
  onChange,
  className = 'form-input',
  style,
  title = 'Select dispatch date (DD/MM/YYYY)',
  min,
  max,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Guaranteed DD/MM/YYYY formatting on all devices
  const formatDisplay = (isoStr: string) => {
    if (!isoStr) return 'DD/MM/YYYY';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  const handleBoxClick = () => {
    if (disabled) return;
    try {
      if (inputRef.current && typeof inputRef.current.showPicker === 'function') {
        inputRef.current.showPicker();
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flex: '0 0 auto',
        ...style,
      }}
      title={title}
    >
      <div
        className={className}
        onClick={handleBoxClick}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '28px',
          padding: '0 0.45rem',
          fontSize: '0.76rem',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.35rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          backgroundColor: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: 'var(--radius-sm, 4px)',
          border: '1px solid var(--border, #cbd5e1)',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700 }}>
          {formatDisplay(value)}
        </span>
        <Calendar size={13} style={{ opacity: 0.75, flexShrink: 0, color: 'var(--text-secondary, #64748b)' }} />
      </div>

      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          zIndex: 2,
        }}
        aria-label={title}
      />
    </div>
  );
};
