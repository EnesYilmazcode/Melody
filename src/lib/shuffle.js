// Uniform Fisher–Yates shuffle. Returns a new array; does not mutate the input.
// `[...a].sort(() => Math.random() - 0.5)` is NOT uniform — the comparator is
// inconsistent between calls, so some orderings are far more likely than others.
export function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
