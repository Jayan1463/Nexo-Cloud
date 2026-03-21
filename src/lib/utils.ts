import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatMetricValue = (value: number, type: string) => {
  if (type === 'cpu') return `${value.toFixed(1)}%`;
  if (type === 'memory') return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (type === 'network') return `${(value / (1024 * 1024)).toFixed(2)} MB/s`;
  return value.toString();
};
