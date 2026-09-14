// Canonical book names + chapter counts (Protestant 66). Used by the offline
// scripture-reference linter — no network, no model needed.
window.BIBLE_BOOKS = {
  'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
  'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  'Ezra': 10, 'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150,
  'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66,
  'Jeremiah': 52, 'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12, 'Hosea': 14,
  'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4, 'Micah': 7, 'Nahum': 3,
  'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,
  'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28, 'Romans': 16,
  '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6, 'Ephesians': 6,
  'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
  '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1, 'Hebrews': 13,
  'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1,
  'Jude': 1, 'Revelation': 22,
};

// Common abbreviations / misspellings -> canonical name.
window.BIBLE_ALIASES = {
  'gen': 'Genesis', 'ge': 'Genesis', 'exo': 'Exodus', 'ex': 'Exodus', 'lev': 'Leviticus', 'lv': 'Leviticus',
  'num': 'Numbers', 'nm': 'Numbers', 'deut': 'Deuteronomy', 'dt': 'Deuteronomy', 'deu': 'Deuteronomy',
  'josh': 'Joshua', 'jos': 'Joshua', 'judg': 'Judges', 'jdg': 'Judges', 'rut': 'Ruth', 'rth': 'Ruth',
  '1 sam': '1 Samuel', '1sam': '1 Samuel', '1 sa': '1 Samuel', '2 sam': '2 Samuel', '2sam': '2 Samuel', '2 sa': '2 Samuel',
  '1 kgs': '1 Kings', '1 ki': '1 Kings', '1kings': '1 Kings', '2 kgs': '2 Kings', '2 ki': '2 Kings', '2kings': '2 Kings',
  '1 chr': '1 Chronicles', '1 ch': '1 Chronicles', '2 chr': '2 Chronicles', '2 ch': '2 Chronicles',
  'neh': 'Nehemiah', 'est': 'Esther', 'ps': 'Psalms', 'psa': 'Psalms', 'psalm': 'Psalms', 'pss': 'Psalms',
  'prov': 'Proverbs', 'prv': 'Proverbs', 'pro': 'Proverbs', 'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'qoh': 'Ecclesiastes',
  'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'canticles': 'Song of Solomon', 'song of songs': 'Song of Solomon',
  'isa': 'Isaiah', 'is': 'Isaiah', 'jer': 'Jeremiah', 'lam': 'Lamentations', 'ezek': 'Ezekiel', 'ezk': 'Ezekiel', 'eze': 'Ezekiel',
  'dan': 'Daniel', 'dn': 'Daniel', 'hos': 'Hosea', 'obad': 'Obadiah', 'oba': 'Obadiah', 'jon': 'Jonah', 'mic': 'Micah',
  'nah': 'Nahum', 'hab': 'Habakkuk', 'zeph': 'Zephaniah', 'zep': 'Zephaniah', 'hag': 'Haggai', 'zech': 'Zechariah', 'zec': 'Zechariah', 'mal': 'Malachi',
  'matt': 'Matthew', 'mt': 'Matthew', 'mk': 'Mark', 'mrk': 'Mark', 'lk': 'Luke', 'luk': 'Luke', 'jn': 'John', 'joh': 'John',
  'rom': 'Romans', 'ro': 'Romans', '1 cor': '1 Corinthians', '1cor': '1 Corinthians', '1 co': '1 Corinthians',
  '2 cor': '2 Corinthians', '2cor': '2 Corinthians', '2 co': '2 Corinthians',
  'gal': 'Galatians', 'ga': 'Galatians', 'eph': 'Ephesians', 'phil': 'Philippians', 'php': 'Philippians', 'philip': 'Philippians',
  'phillipians': 'Philippians', 'philipians': 'Philippians', 'col': 'Colossians',
  '1 thess': '1 Thessalonians', '1thess': '1 Thessalonians', '1 th': '1 Thessalonians',
  '2 thess': '2 Thessalonians', '2thess': '2 Thessalonians', '2 th': '2 Thessalonians',
  '1 tim': '1 Timothy', '1tim': '1 Timothy', '1 ti': '1 Timothy', '2 tim': '2 Timothy', '2tim': '2 Timothy', '2 ti': '2 Timothy',
  'tit': 'Titus', 'phlm': 'Philemon', 'phm': 'Philemon', 'heb': 'Hebrews', 'hebr': 'Hebrews',
  'jas': 'James', 'jam': 'James', 'jms': 'James',
  '1 pet': '1 Peter', '1pet': '1 Peter', '1 pe': '1 Peter', '2 pet': '2 Peter', '2pet': '2 Peter', '2 pe': '2 Peter',
  '1 jn': '1 John', '1jn': '1 John', '1 jhn': '1 John', '2 jn': '2 John', '2jn': '2 John', '3 jn': '3 John', '3jn': '3 John',
  'jud': 'Jude', 'jde': 'Jude', 'rev': 'Revelation', 'rv': 'Revelation', 'apoc': 'Revelation', 'revelations': 'Revelation',
};

// Frequent misspellings -> the correct spelling (flagged, not silently accepted).
window.BIBLE_MISSPELLINGS = {
  'philipians': 'Philippians', 'phillipians': 'Philippians', 'phillippians': 'Philippians',
  'ecclesiasties': 'Ecclesiastes', 'ecclesiates': 'Ecclesiastes', 'deuteronmy': 'Deuteronomy',
  'corinthans': 'Corinthians', 'thessalonions': 'Thessalonians', 'thesalonians': 'Thessalonians',
  'revelations': 'Revelation', 'psalms': 'Psalms', 'proverb': 'Proverbs', 'gallatians': 'Galatians',
  'galations': 'Galatians', 'colosians': 'Colossians', 'hebrewz': 'Hebrews', 'mathew': 'Matthew',
  'matthews': 'Matthew', 'genisis': 'Genesis', 'exodous': 'Exodus', 'levaticus': 'Leviticus',
  'nehimiah': 'Nehemiah', 'isiah': 'Isaiah', 'jeramiah': 'Jeremiah', 'ezekial': 'Ezekiel',
};
