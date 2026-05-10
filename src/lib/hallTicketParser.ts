// OCR parsing removed — exam centres are now entered manually.
// This file is kept only for the centre-name normalisation utility.

export function normaliseCentreName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
