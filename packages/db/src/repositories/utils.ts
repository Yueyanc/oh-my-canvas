export function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}
