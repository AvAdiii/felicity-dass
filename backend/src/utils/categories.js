export const organizer_category_options = [
  'Technical',
  'Cultural',
  'Sports',
  'Literary',
  'Debate',
  'Photography',
  'Gaming',
  'Design',
  'Music',
  'Community',
  'Fest',
  'Other'
];

export const participant_interest_options = [...organizer_category_options];

export function normalize_organizer_category(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const normalized = organizer_category_options.find((item) => item.toLowerCase() === input.toLowerCase());
  return normalized || null;
}

export function sanitize_participant_interests(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const allowed = new Map(participant_interest_options.map((item) => [item.toLowerCase(), item]));
  const unique = new Set();
  const output = [];

  for (const raw of values) {
    const key = String(raw || '').trim().toLowerCase();
    if (!key || !allowed.has(key) || unique.has(key)) {
      continue;
    }
    unique.add(key);
    output.push(allowed.get(key));
  }

  return output;
}
