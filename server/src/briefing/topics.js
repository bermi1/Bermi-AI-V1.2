// The interest taxonomy. Anything a person types — an interest, a goal, a
// field of study, an ambition sentence — is mapped onto these topics by
// keyword (English + Swahili). Whatever does NOT map becomes a "custom"
// interest that is searched for directly, so no interest is ever ignored.
//
//   kw     terms that make an item/interest match this topic (whole words)
//   sw     Swahili terms
//   q      the search phrase used for live news lanes
//   books  Open Library subject slugs for the books lane
//   pubmed / arxiv   research lanes (only where they make sense)
//   jobs   remote-jobs lane tag

const T = (id, label, group, o) => ({ id, label, group, kw: [], sw: [], books: [], ...o })

export const TOPICS = [
  // ---- money & markets
  T('investing', 'Investing', 'Money', { kw: ['invest', 'investing', 'investor', 'investment', 'portfolio', 'dividend', 'wealth', 'asset', 'etf', 'mutual fund', 'unit trust'], sw: ['uwekezaji', 'wekeza', 'mwekezaji', 'mali'], q: 'investing', books: ['investments', 'finance'] }),
  T('stocks', 'Stocks & markets', 'Money', { kw: ['stock', 'stocks', 'shares', 'equities', 'stock market', 'securities exchange', 'trading', 'trader', 'dse', 'nse', 'nasdaq', 'sensex', 'bull market', 'bear market'], sw: ['hisa', 'soko la hisa'], q: 'stock market shares', books: ['stock-market', 'trading'] }),
  T('bonds', 'Bonds & treasuries', 'Money', { kw: ['bond', 'bonds', 'treasury', 'treasuries', 'treasury bill', 'fixed income', 'yield', 'government securities', 'coupon'], sw: ['hatifungani', 'dhamana'], q: 'treasury bonds yields government securities', books: ['bonds'] }),
  T('crypto', 'Crypto & digital assets', 'Money', { kw: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'stablecoin', 'web3'], sw: ['sarafu za kidijitali'], q: 'crypto bitcoin regulation', books: ['cryptocurrency', 'blockchain'] }),
  T('personal-finance', 'Personal finance', 'Money', { kw: ['budget', 'budgeting', 'saving', 'savings', 'debt', 'loan', 'credit', 'insurance', 'retirement', 'pension', 'mortgage', 'money', 'frugal', 'financial freedom'], sw: ['akiba', 'bajeti', 'mkopo', 'pesa', 'bima'], q: 'personal finance savings', books: ['personal-finance', 'money'] }),
  T('economy', 'Economy & policy', 'Money', { kw: ['economy', 'economic', 'inflation', 'gdp', 'central bank', 'interest rate', 'exchange rate', 'fiscal', 'budget speech', 'imf', 'world bank', 'currency', 'trade'], sw: ['uchumi', 'mfumuko wa bei', 'benki kuu', 'bajeti ya serikali'], q: 'economy inflation interest rates', books: ['economics'] }),
  T('real-estate', 'Real estate', 'Money', { kw: ['real estate', 'property', 'properties', 'housing', 'realtor', 'landlord', 'rental', 'mortgage', 'land', 'construction', 'developer'], sw: ['mali isiyohamishika', 'nyumba', 'ardhi', 'viwanja', 'upangishaji'], q: 'real estate property market', books: ['real-estate'] }),

  // ---- building
  T('entrepreneurship', 'Business & entrepreneurship', 'Build', { kw: ['business', 'entrepreneur', 'entrepreneurship', 'startup founder', 'small business', 'sme', 'smes', 'side hustle', 'market', 'sales', 'customers', 'franchise', 'e-commerce', 'retail'], sw: ['biashara', 'mjasiriamali', 'ujasiriamali'], q: 'entrepreneurship small business', books: ['entrepreneurship', 'business'] }),
  T('startups', 'Startups & funding', 'Build', { kw: ['startup', 'startups', 'venture capital', 'seed round', 'funding round', 'accelerator', 'incubator', 'pitch', 'series a', 'angel investor', 'fintech', 'unicorn'], sw: ['kampuni changa', 'ufadhili'], q: 'startups funding venture capital', books: ['startups'] }),
  T('agriculture', 'Agriculture & agribusiness', 'Build', { kw: ['farming', 'farmer', 'agriculture', 'agribusiness', 'crops', 'livestock', 'irrigation', 'harvest', 'agritech', 'horticulture', 'fertilizer', 'coffee', 'cashew', 'maize'], sw: ['kilimo', 'mkulima', 'mazao', 'ufugaji', 'mbolea'], q: 'agriculture farming agribusiness', books: ['agriculture'] }),
  T('climate-energy', 'Climate & energy', 'Build', { kw: ['climate', 'renewable', 'solar', 'energy', 'carbon', 'sustainability', 'wind power', 'electric vehicle', 'green hydrogen', 'conservation', 'wildlife'], sw: ['nishati', 'hali ya hewa', 'mazingira', 'jua'], q: 'climate energy renewable', books: ['climate-change', 'renewable-energy'] }),

  // ---- tech
  T('software', 'Software & development', 'Tech', { kw: ['software', 'developer', 'programming', 'programmer', 'coding', 'code', 'javascript', 'typescript', 'python', 'react', 'node', 'api', 'devops', 'backend', 'frontend', 'full stack', 'github', 'open source', 'mobile app', 'android', 'ios', 'rust', 'golang', 'java'], sw: ['programu', 'msanidi programu', 'uandishi wa programu'], q: 'software development programming', books: ['computer-programming', 'software-engineering'], jobs: 'dev' }),
  T('ai', 'AI & machine learning', 'Tech', { kw: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'deep learning', 'neural network', 'chatgpt', 'generative', 'data science', 'nlp'], sw: ['akili bandia', 'akili mnemba'], q: 'artificial intelligence machine learning', arxiv: 'cs.AI', books: ['artificial-intelligence', 'machine-learning'] }),
  T('cyber', 'Cybersecurity', 'Tech', { kw: ['cybersecurity', 'security', 'hacking', 'malware', 'ransomware', 'privacy', 'infosec', 'encryption', 'phishing', 'breach'], sw: ['usalama wa mtandao'], q: 'cybersecurity data breach', arxiv: 'cs.CR', books: ['computer-security'] }),
  T('design', 'Design & creativity', 'Tech', { kw: ['design', 'designer', 'ux', 'ui', 'graphic', 'illustration', 'branding', 'typography', 'figma', 'photography', 'film', 'animation', 'video editing', 'art', 'artist', 'creative'], sw: ['usanifu', 'sanaa', 'ubunifu', 'upigaji picha'], q: 'design creativity', books: ['design', 'art'] }),
  T('telecom-mobile', 'Mobile money & telecom', 'Tech', { kw: ['mobile money', 'm-pesa', 'mpesa', 'tigo pesa', 'airtel money', 'telecom', 'vodacom', 'airtel', 'halotel', 'payments'], sw: ['fedha za simu', 'simu'], q: 'mobile money telecom payments' }),

  // ---- health & mind
  T('medicine', 'Medicine & clinical', 'Health', { kw: ['medicine', 'medical', 'doctor', 'physician', 'surgeon', 'surgery', 'clinical', 'anatomy', 'pathology', 'pharmacology', 'physiology', 'nursing', 'nurse', 'mbbs', 'patient', 'hospital', 'diagnosis', 'residency', 'medical student', 'pharmacy', 'dentistry', 'cardiology', 'oncology', 'paediatrics', 'pediatrics', 'radiology'], sw: ['udaktari', 'daktari', 'tiba', 'matibabu', 'hospitali', 'uuguzi', 'muuguzi', 'dawa'], q: 'medicine clinical medical research', pubmed: 'medicine', books: ['medicine', 'surgery'] }),
  T('public-health', 'Public health', 'Health', { kw: ['public health', 'epidemic', 'outbreak', 'vaccine', 'vaccination', 'malaria', 'hiv', 'tuberculosis', 'cholera', 'ebola', 'who', 'epidemiology', 'maternal health', 'sanitation'], sw: ['afya ya jamii', 'chanjo', 'ukimwi', 'mlipuko'], q: 'public health outbreak vaccine', pubmed: 'public health', books: ['public-health'] }),
  T('fitness', 'Fitness & nutrition', 'Health', { kw: ['fitness', 'workout', 'exercise', 'gym', 'nutrition', 'diet', 'running', 'weight loss', 'muscle', 'yoga', 'sports science', 'healthy eating'], sw: ['mazoezi', 'lishe', 'afya'], q: 'fitness nutrition health', books: ['physical-fitness', 'nutrition'] }),
  T('mental-health', 'Mind & mental health', 'Health', { kw: ['mental health', 'anxiety', 'depression', 'stress', 'burnout', 'therapy', 'mindfulness', 'meditation', 'psychology', 'wellbeing', 'wellness', 'resilience', 'self-care', 'sleep', 'trauma'], sw: ['afya ya akili', 'msongo wa mawazo', 'utulivu'], q: 'mental health psychology wellbeing', pubmed: 'mental health', books: ['psychology', 'mental-health'] }),
  T('science', 'Science & discovery', 'Learn', { kw: ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'space', 'nasa', 'genetics', 'research', 'laboratory', 'scientist', 'engineering', 'mathematics', 'maths', 'math', 'quantum', 'geology'], sw: ['sayansi', 'fizikia', 'kemia', 'baiolojia', 'hisabati', 'uhandisi'], q: 'science discovery research', books: ['science', 'mathematics'] }),

  // ---- learning & career
  T('education', 'Education & study', 'Learn', { kw: ['university', 'college', 'student', 'exam', 'exams', 'study', 'studying', 'curriculum', 'teacher', 'teaching', 'school', 'lecturer', 'thesis', 'degree', 'campus', 'learning', 'edtech', 'a-level', 'form six', 'necta', 'heslb', 'tcu'], sw: ['elimu', 'chuo kikuu', 'mwanafunzi', 'mtihani', 'shule', 'mwalimu', 'masomo'], q: 'education universities students', books: ['education', 'study-skills'] }),
  T('scholarships', 'Scholarships & grants', 'Learn', { kw: ['scholarship', 'scholarships', 'fellowship', 'fellowships', 'bursary', 'grant', 'grants', 'chevening', 'fulbright', 'mastercard foundation', 'erasmus', 'commonwealth', 'study abroad', 'masters', 'phd'], sw: ['udhamini', 'ufadhili wa masomo', 'masomo nje'], q: 'scholarship fellowship application deadline' }),
  T('careers', 'Careers & jobs', 'Learn', { kw: ['job', 'jobs', 'career', 'careers', 'internship', 'graduate', 'vacancy', 'vacancies', 'hiring', 'recruitment', 'cv', 'resume', 'interview', 'employment', 'freelance', 'remote work', 'promotion', 'salary'], sw: ['ajira', 'kazi', 'nafasi za kazi', 'mafunzo kwa vitendo', 'usaili'], q: 'jobs careers hiring', books: ['career-development'], jobs: 'all' }),
  T('productivity', 'Focus & productivity', 'Learn', { kw: ['productivity', 'focus', 'habit', 'habits', 'deep work', 'time management', 'discipline', 'procrastination', 'routine', 'concentration', 'study technique', 'note taking', 'pomodoro', 'attention'], sw: ['umakini', 'nidhamu', 'tabia', 'muda'], q: 'productivity focus habits deep work', books: ['productivity', 'time-management'] }),
  T('mindset', 'Motivation & mindset', 'Learn', { kw: ['motivation', 'motivated', 'mindset', 'inspiration', 'inspire', 'success', 'ambition', 'purpose', 'confidence', 'courage', 'never give up', 'perseverance', 'growth', 'reflection', 'gratitude', 'self-improvement', 'self improvement', 'personal development', 'stoic', 'stoicism', 'wisdom'], sw: ['motisha', 'mafanikio', 'ndoto', 'kujiamini', 'hekima'], q: 'motivation mindset personal growth', books: ['self-help', 'motivation', 'success'] }),
  T('leadership', 'Leadership & management', 'Learn', { kw: ['leadership', 'leader', 'management', 'manager', 'team', 'strategy', 'negotiation', 'public speaking', 'communication', 'ceo', 'executive'], sw: ['uongozi', 'usimamizi'], q: 'leadership management', books: ['leadership', 'management'] }),

  // ---- society
  T('politics', 'Politics & governance', 'World', { kw: ['politics', 'political', 'election', 'elections', 'parliament', 'government', 'policy', 'governance', 'president', 'minister', 'democracy', 'law', 'legal', 'court', 'constitution', 'diplomacy', 'rights'], sw: ['siasa', 'uchaguzi', 'bunge', 'serikali', 'sheria', 'mahakama', 'rais', 'waziri', 'katiba'], q: 'politics government policy', books: ['political-science', 'law'] }),
  T('world', 'World & Africa', 'World', { kw: ['world', 'global', 'international', 'africa', 'african', 'east africa', 'eac', 'sadc', 'african union', 'united nations', 'geopolitics', 'war', 'conflict', 'migration'], sw: ['dunia', 'afrika', 'afrika mashariki', 'kimataifa'], q: 'world africa international', books: ['africa'] }),
  T('sports', 'Sports', 'World', { kw: ['football', 'soccer', 'sports', 'sport', 'basketball', 'athletics', 'premier league', 'simba', 'yanga', 'taifa stars', 'olympics', 'cricket', 'tennis', 'f1', 'formula 1', 'afcon'], sw: ['michezo', 'mpira', 'mpira wa miguu'], q: 'sports football', books: ['sports'] }),
  T('culture', 'Culture, music & lifestyle', 'World', { kw: ['music', 'musician', 'movie', 'movies', 'culture', 'lifestyle', 'fashion', 'travel', 'tourism', 'food', 'cooking', 'entertainment', 'bongo flava', 'celebrity', 'festival', 'literature', 'poetry', 'writer', 'writing'], sw: ['muziki', 'burudani', 'utalii', 'mitindo', 'chakula', 'fasihi', 'ushairi'], q: 'culture music lifestyle', books: ['literature', 'music'] }),
  // Faith is strictly opt-in: only matched when someone names it themselves.
  T('faith', 'Faith & spirituality', 'World', { kw: ['faith', 'bible', 'christian', 'christianity', 'church', 'prayer', 'islam', 'muslim', 'quran', 'ramadan', 'spiritual', 'spirituality', 'devotional', 'sermon'], sw: ['imani', 'kanisa', 'sala', 'maombi', 'biblia', 'kurani', 'dini'], q: 'faith spirituality', books: ['religion', 'spirituality'] }),
]

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]))

// "I am a …" — one tap seeds a sensible set of topics with weights, so a
// new person gets a good feed before typing anything. Weights are 0–1.
export const PERSONAS = [
  { id: 'student', label: 'Student', topics: { education: 1, scholarships: 0.8, careers: 0.6, productivity: 0.7, mindset: 0.5, science: 0.4 } },
  { id: 'medical', label: 'Medical / health student', topics: { medicine: 1, 'public-health': 0.7, education: 0.6, scholarships: 0.5, 'mental-health': 0.5, mindset: 0.5, science: 0.4 } },
  { id: 'investor', label: 'Investor', topics: { investing: 1, stocks: 0.9, bonds: 0.9, economy: 0.8, 'personal-finance': 0.6, 'real-estate': 0.4, crypto: 0.3 } },
  { id: 'entrepreneur', label: 'Entrepreneur', topics: { entrepreneurship: 1, startups: 0.8, economy: 0.6, leadership: 0.6, 'personal-finance': 0.5, mindset: 0.5, 'telecom-mobile': 0.4 } },
  { id: 'developer', label: 'Developer / tech', topics: { software: 1, ai: 0.9, cyber: 0.5, startups: 0.5, careers: 0.5, design: 0.3 } },
  { id: 'jobseeker', label: 'Job seeker', topics: { careers: 1, scholarships: 0.5, education: 0.5, productivity: 0.5, mindset: 0.5, economy: 0.3 } },
  { id: 'creator', label: 'Creative', topics: { design: 1, culture: 0.8, entrepreneurship: 0.5, mindset: 0.5, ai: 0.4 } },
  { id: 'farmer', label: 'Farmer / agribusiness', topics: { agriculture: 1, 'climate-energy': 0.6, economy: 0.6, entrepreneurship: 0.5, 'telecom-mobile': 0.3 } },
  { id: 'realtor', label: 'Real estate', topics: { 'real-estate': 1, investing: 0.7, economy: 0.7, entrepreneurship: 0.5, 'personal-finance': 0.4 } },
  { id: 'wellbeing', label: 'Wellbeing seeker', topics: { 'mental-health': 1, fitness: 0.8, mindset: 0.8, productivity: 0.5 } },
]

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordRe = (terms) =>
  terms.length ? new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${terms.map(esc).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu') : null

for (const t of TOPICS) {
  t._re = wordRe([...t.kw, ...t.sw])
  t._terms = [...t.kw, ...t.sw].map((x) => ({ x, re: wordRe([x]) }))
}

/** Count of DISTINCT topic terms found in a text (0 = no match). */
export function topicHits(topic, text) {
  if (!text || !topic._re || !topic._re.test(text)) return 0
  let n = 0
  for (const { re } of topic._terms) if (re.test(text)) n++
  return n
}

/**
 * Map free text (interests, goals, field of study, ambition) onto topics.
 * Returns { matched: Map<topicId, weight>, unmatched: string[] } — each
 * phrase that matches nothing is reported so it can become a custom search
 * rather than being dropped.
 */
export function mapPhrases(phrases, baseWeight = 1) {
  const matched = new Map()
  const unmatched = []
  for (const raw of phrases) {
    const phrase = String(raw || '').trim()
    if (!phrase) continue
    let any = false
    for (const t of TOPICS) {
      const hits = topicHits(t, phrase)
      const exact = phrase.toLowerCase() === t.label.toLowerCase() || phrase.toLowerCase() === t.id
      if (hits || exact) {
        any = true
        const w = exact ? baseWeight : Math.min(baseWeight, baseWeight * (0.7 + 0.15 * hits))
        matched.set(t.id, Math.max(matched.get(t.id) ?? 0, w))
      }
    }
    if (!any) unmatched.push(phrase)
  }
  return { matched, unmatched }
}
