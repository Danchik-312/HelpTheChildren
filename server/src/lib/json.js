export function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}
