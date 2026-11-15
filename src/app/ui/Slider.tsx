import { useId } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  digits?: number;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, unit = '', digits = 1, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="slider">
      <label htmlFor={id}>
        <span>{label}</span>
        <output>
          {value.toFixed(digits)}
          {unit && <small> {unit}</small>}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
