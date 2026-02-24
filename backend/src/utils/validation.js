export function is_valid_phone_number(phone) {
  const value = String(phone || '').trim();
  return /^\d{10}$/.test(value);
}

export function normalize_phone_number(phone) {
  return String(phone || '').trim();
}
