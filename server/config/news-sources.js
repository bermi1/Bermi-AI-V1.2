// Curated news/opportunities sources — 10 Tanzania, 10 pan-African, 10 global,
// each tagged with its primary focus so the feed can be filtered by what a
// young person actually wants: youth-oriented scholarships/opportunities,
// general national news, or events/programs to apply to or attend.
//
// IMPORTANT: this list was assembled from general knowledge, not verified
// live against each site (this development environment has no general
// internet access to test with). Once deployed, /api/news/status shows
// which sources are actually returning items and which are failing to
// fetch — treat any source that never succeeds as needing its feedUrl
// (or existence) rechecked, the same way the AI provider model ids needed
// fixing once real failures surfaced.
//
// focus: 'youth_opportunities' | 'national_news' | 'opportunities_events'
// region: 'tanzania' | 'africa' | 'global'

export const NEWS_SOURCES = [
  // ---------- Tanzania (10) ----------
  { id: 'tz-citizen', name: 'The Citizen', region: 'tanzania', focus: 'national_news', homepage: 'https://www.thecitizen.co.tz', feedUrl: 'https://www.thecitizen.co.tz/tanzania/rss' },
  { id: 'tz-dailynews', name: 'Daily News Tanzania', region: 'tanzania', focus: 'national_news', homepage: 'https://dailynews.co.tz', feedUrl: 'https://dailynews.co.tz/feed/' },
  { id: 'tz-mwananchi', name: 'Mwananchi', region: 'tanzania', focus: 'national_news', homepage: 'https://www.mwananchi.co.tz', feedUrl: 'https://www.mwananchi.co.tz/mw/rss' },
  { id: 'tz-ippmedia', name: 'IPPmedia / The Guardian Tanzania', region: 'tanzania', focus: 'national_news', homepage: 'https://www.ippmedia.com', feedUrl: 'https://www.ippmedia.com/en/rss.xml' },
  { id: 'tz-habarileo', name: 'Habari Leo', region: 'tanzania', focus: 'national_news', homepage: 'https://habarileo.co.tz', feedUrl: 'https://habarileo.co.tz/feed/' },
  { id: 'tz-millardayo', name: 'Millard Ayo', region: 'tanzania', focus: 'opportunities_events', homepage: 'https://millardayo.com', feedUrl: 'https://millardayo.com/feed/' },
  { id: 'tz-jamiiforums', name: 'JamiiForums', region: 'tanzania', focus: 'opportunities_events', homepage: 'https://www.jamiiforums.com', feedUrl: 'https://www.jamiiforums.com/whats-new/posts.rss' },
  { id: 'tz-ajira', name: 'Ajira Portal (Tanzania Public Service Recruitment)', region: 'tanzania', focus: 'youth_opportunities', homepage: 'https://ajira.go.tz', feedUrl: null },
  { id: 'tz-heslb', name: 'HESLB (Higher Education Students\' Loans Board)', region: 'tanzania', focus: 'youth_opportunities', homepage: 'https://www.heslb.go.tz', feedUrl: null },
  { id: 'tz-tcu', name: 'Tanzania Commission for Universities', region: 'tanzania', focus: 'youth_opportunities', homepage: 'https://www.tcu.go.tz', feedUrl: null },

  // ---------- Africa (10) ----------
  { id: 'af-allafrica', name: 'AllAfrica', region: 'africa', focus: 'national_news', homepage: 'https://allafrica.com', feedUrl: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf' },
  { id: 'af-africanews', name: 'Africanews', region: 'africa', focus: 'national_news', homepage: 'https://www.africanews.com', feedUrl: 'https://www.africanews.com/feed/rss' },
  { id: 'af-theafricareport', name: 'The Africa Report', region: 'africa', focus: 'national_news', homepage: 'https://www.theafricareport.com', feedUrl: 'https://www.theafricareport.com/feed/' },
  { id: 'af-au', name: 'African Union', region: 'africa', focus: 'opportunities_events', homepage: 'https://au.int', feedUrl: null },
  { id: 'af-opportunitydesk', name: 'Opportunity Desk', region: 'africa', focus: 'youth_opportunities', homepage: 'https://opportunitydesk.org', feedUrl: 'https://opportunitydesk.org/feed/' },
  { id: 'af-yali', name: 'YALI (Young African Leaders Initiative)', region: 'africa', focus: 'youth_opportunities', homepage: 'https://yali.state.gov', feedUrl: null },
  { id: 'af-techcabal', name: 'TechCabal', region: 'africa', focus: 'national_news', homepage: 'https://techcabal.com', feedUrl: 'https://techcabal.com/feed/' },
  { id: 'af-howwemadeit', name: 'How We Made It In Africa', region: 'africa', focus: 'opportunities_events', homepage: 'https://www.howwemadeitinafrica.com', feedUrl: 'https://www.howwemadeitinafrica.com/feed/' },
  { id: 'af-afdb', name: 'African Development Bank', region: 'africa', focus: 'opportunities_events', homepage: 'https://www.afdb.org', feedUrl: null },
  { id: 'af-moibrahim', name: 'Mo Ibrahim Foundation', region: 'africa', focus: 'youth_opportunities', homepage: 'https://mo.ibrahim.foundation', feedUrl: null },

  // ---------- Global (10) ----------
  { id: 'gl-bbc', name: 'BBC News', region: 'global', focus: 'national_news', homepage: 'https://www.bbc.com/news', feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'gl-aljazeera', name: 'Al Jazeera', region: 'global', focus: 'national_news', homepage: 'https://www.aljazeera.com', feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'gl-reliefweb', name: 'ReliefWeb', region: 'global', focus: 'opportunities_events', homepage: 'https://reliefweb.int', feedUrl: 'https://reliefweb.int/updates/rss.xml' },
  { id: 'gl-devex', name: 'Devex', region: 'global', focus: 'opportunities_events', homepage: 'https://www.devex.com', feedUrl: 'https://www.devex.com/news.rss' },
  { id: 'gl-unnews', name: 'UN News', region: 'global', focus: 'national_news', homepage: 'https://news.un.org', feedUrl: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml' },
  { id: 'gl-scholarshipportal', name: 'ScholarshipPortal', region: 'global', focus: 'youth_opportunities', homepage: 'https://www.scholarshipportal.com', feedUrl: null },
  { id: 'gl-daad', name: 'DAAD Scholarships', region: 'global', focus: 'youth_opportunities', homepage: 'https://www.daad.de/en', feedUrl: null },
  { id: 'gl-chevening', name: 'Chevening Scholarships', region: 'global', focus: 'youth_opportunities', homepage: 'https://www.chevening.org', feedUrl: null },
  { id: 'gl-wef', name: 'World Economic Forum', region: 'global', focus: 'opportunities_events', homepage: 'https://www.weforum.org', feedUrl: 'https://www.weforum.org/agenda/feed' },
  { id: 'gl-unesco', name: 'UNESCO', region: 'global', focus: 'youth_opportunities', homepage: 'https://www.unesco.org', feedUrl: null },
]
