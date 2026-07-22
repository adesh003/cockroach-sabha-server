const ADJECTIVES = [
  'Rusty', 'Silent', 'Golden', 'Night', 'Old', 'Tiny', 'Metro',
  'Library', 'Exam', 'Backbench', 'Cosmic', 'Shadow', 'Underground', 'Stealth',
  'Parliament', 'Desi', 'Voter'
];

const NOUNS = [
  'Cockroach', 'Delegate', 'Crawler', 'Speaker', 'Scribe', 'Scholar', 'Thinker', 'Neta'
];

export function generateAnonymousName(email = '') {
  if (email && email.trim()) {
    let hash = 0;
    const cleanEmail = email.trim().toLowerCase();
    for (let i = 0; i < cleanEmail.length; i++) {
      hash = cleanEmail.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    const adj = ADJECTIVES[absHash % ADJECTIVES.length];
    const noun = NOUNS[(absHash >> 3) % NOUNS.length];
    const num = (absHash % 899) + 100;
    return `${adj} ${noun} #${num}`;
  }

  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj} ${noun} #${num}`;
}

export function generateUsernameSuggestions() {
  const suggestions = [];
  for (let i = 0; i < 3; i++) {
    suggestions.push(generateAnonymousName());
  }
  return suggestions;
}
