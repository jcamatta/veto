const fakeHash = (input: string): string => {
  const folded = Array.from(input).reduce(
    (acc, ch) => Math.imul(acc ^ ch.charCodeAt(0), 16777619) >>> 0,
    2166136261
  )
  return folded.toString(16).padStart(8, '0').repeat(5)
}

export { fakeHash }
