// Focus & mood audio, streamed from YouTube. Bermi does not host, copy or
// re-encode any of it: each entry plays in YouTube's own embedded player under
// the uploader's terms, and can be removed or replaced in Bermi Control.
//
// Candidates were found by search and are NOT individually verified here —
// videos can be removed or made non-embeddable at any time, so the player
// reports an unplayable one and offers the YouTube link instead.
//
// [youtubeId, category, title, minutes?, creator?]
const ROWS = [
  // Emotional & love
  ['xe3Ux61pO3E', 'emotional', 'Most Beautiful & Emotional Background Music', 60, 'Fearless Motivation Instrumentals'],
  ['H6n7SlwHAKM', 'emotional', 'Romantic Piano Music — 1 hour', 60, 'Marc Jungermann'],
  ['xsIKncVYkxc', 'emotional', 'Piano Music Instrumental — Emotional', 60],
  ['UQeI5M5AU_E', 'emotional', 'Romantic Piano Music for Relax', 60],
  ['TavH-C1kkhI', 'emotional', 'Romantic Piano Love Songs Collection'],
  ['0bhDDFk2usw', 'emotional', 'Cinematic Piano Meets Melodic Techno', 60],
  ['6Xro30qKazY', 'emotional', 'Emotional Love Beat Instrumental', null, 'Heartfelt Vibes'],
  ['b7FXXxBuSQM', 'emotional', 'Beat Instrumental — Love'],
  ['0eY_-656dT0', 'emotional', 'Emotional Rap Beat — “Just Love”'],
  ['HhHPw7AYSXM', 'emotional', '“Love” — Emotional Rap Beat'],
  ['3IHtR-6M5wU', 'emotional', 'Sad Rap Beat — “Emotion”'],
  ['Vo9bJYllf-w', 'emotional', 'Epic Emotional Beat'],
  // Motivation
  ['flPetIVuLTo', 'motivation', '1 Hour Workout Instrumental — Hip Hop & R&B Trap (No Vocals)', 60],
  ['oXccU2F0js0', 'motivation', 'Upbeat Study Beats — Deep Focus & High Energy', 147],
  ['XGlZKyELWU0', 'motivation', 'Focus Beats, Study, Workout — Instrumental', null, 'Trance Dance House'],
  ['Zt3bH2hyFcw', 'motivation', '2 Hours of High-Energy Workout Music', 120],
  ['K8lBAXiNKCs', 'motivation', 'Ultimate 2-Hour Workout Music Mix', 120],
  ['W9PY3y7nbi0', 'motivation', '2 Hours of Hard Trap Beats & Hip-Hop Instrumentals', 120],
  ['4ZMErc10emQ', 'motivation', '1 Hour Workout Music — Intense Gym Motivation Mix', 60],
  ['P-EdbKP8Kac', 'motivation', 'Best Gym Workout Music', 60],
  ['a9AO3AyKbAQ', 'motivation', 'Gym Workout Music — Stay Focused, Finish Strong'],
  ['aU12E4aEN2s', 'motivation', 'Instrumental Music for Fitness'],
  ['U7ioyaHGu1Y', 'motivation', 'Uplifting Motivational Rap Instrumental — “Victory”'],
  ['WBtNKFNQ888', 'motivation', '“Keep Going” — Motivational Beat', null, 'YoungGotti'],
  // Never give up
  ['LmIPdvu7F44', 'never-give-up', 'Motivational Epic Music Mix (includes “Never Give Up”)', 60, 'DensoMusic'],
  ['yprlLDkABlQ', 'never-give-up', 'Epic Motivational Music — Powerful Cinematic Orchestral Mix', 60],
  ['VX0D47-KJTc', 'never-give-up', 'Epic Songs for Intense Motivation', 60],
  ['yxx-1pZWj-s', 'never-give-up', 'Stand for Them — Epic Rock', 60],
  ['oxQe7mS7L8g', 'never-give-up', 'Hardcore Epic Motivational Songs — Gym Mix', 60],
  ['O8YZHdQkkxc', 'never-give-up', 'Never Give Up Revival (Epic Music Mix)', null, 'Fearless Motivation Instrumentals'],
  ['8u_Vhr0h8WE', 'never-give-up', 'Never Give Up (Epic Instrumental)'],
  ['AUFMaIOB-i4', 'never-give-up', '“Never Give Up” — Inspiring Rap Beat', null, 'YoungGotti'],
  ['hjo9JJx5khU', 'never-give-up', 'Inspiring Hip Hop Beat — “Never Give Up”', null, 'Ihaksi'],
  ['TqUZJfdkoPE', 'never-give-up', 'Never Give Up — Motivational Hip-Hop', null, 'J-Yo Productions'],
  ['UdRjIryBqRA', 'never-give-up', 'Never Give Up — Hip Hop Beat with Piano & Strings'],
  ['r8YufOH77Cc', 'never-give-up', 'Never Give Up — Epic Background Music', null, 'Sounds Of Power'],
  // Study beats
  ['FB6E8NcRfxY', 'study', '2 Hours of Lo-Fi Hip Hop Beats to Study & Relax', 120],
  ['wawafGZX4Hk', 'study', '2 Hour Lofi Beats', 120],
  ['-8srUl8-l8Y', 'study', 'Listen and Get Things Done (2 hours)', 120],
  ['Xf3-4A-uEc8', 'study', 'Deep Focus Lofi Mix — Study/Work Concentration'],
  ['2U9Wkh7jkto', 'study', 'Deep Focus Lofi Beats — Work/Study Concentration'],
  ['kJkPo-fjfpw', 'study', 'Deep Focus — Lofi Work/Study Concentration'],
  ['FkfEMReEl5g', 'study', 'Work Lofi — Deep Focus Study Concentration'],
  ['wAPCSnAhhC8', 'study', '2 A.M Study Session [lofi hip hop]'],
  ['p-a1x6-rStI', 'study', 'Lofi Hip Hop Mix — Relax & Study Beats'],
  // Deep focus
  ['19sqp3Uymr0', 'deep-focus', 'Deep Concentration Music for Studying — 3 Hours', 180],
  ['OeA53JYJ5Ww', 'deep-focus', 'Deep Focus Music for Study — 3 Hours', 180],
  ['73ZvsHMLkbU', 'deep-focus', '3 Hour Deep Focus Music — “Silent Hours”', 180],
  ['0ecBc_2mzcE', 'deep-focus', '3 Hour Deep Focus Music — “Deep Night Work”', 180],
  ['MFRqgk4CDYU', 'deep-focus', '3 Hours of Deep Focus Music', 180],
  ['GOItppAAuGA', 'deep-focus', 'Deep Focus Music for Studying — 3 Hours Ambient', 180],
  ['jrsxFEpwSlk', 'deep-focus', '3 Hours of Deep Focus Music for Studying', 180],
  ['tR-V2mpu8-I', 'deep-focus', 'Hyperfocus Music — 50/10 work blocks', 180],
  ['ctXQxPO3bbg', 'deep-focus', '3 Hour Study Focus Music — Alpha Waves style', 180],
  ['uC6_ItiED3U', 'deep-focus', 'Focus Music for Work and Studying'],
]

export const PLAYLIST_CATEGORIES = [
  { id: 'emotional', label: 'Emotional & love' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'never-give-up', label: 'Never give up' },
  { id: 'study', label: 'Study beats' },
  { id: 'deep-focus', label: 'Deep focus' },
]

export const SEED_PLAYLIST = ROWS.map(([ytId, category, title, minutes, author]) => ({
  id: `yt-${ytId.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
  title,
  author: author ?? '',
  url: `https://www.youtube.com/watch?v=${ytId}`,
  category,
  ...(minutes ? { minutes } : {}),
  license: 'Streamed from YouTube in its own player, under the uploader’s terms. Not hosted or copied by Bermi.',
  attribution: author ? `${title} — ${author} (YouTube)` : `${title} (YouTube)`,
  status: 'published',
}))

// Audiobooks: human-read LibriVox recordings of public-domain books, streamed
// from the Internet Archive's own player. Blurbs are original summaries, not
// excerpts. [archiveId, category, title, author, year, minutes, narrator, blurb]
export const AUDIOBOOK_CATEGORIES = [
  { id: 'wealth', label: 'Building wealth' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'emotion', label: 'Emotion control' },
  { id: 'laziness', label: 'Art of laziness' },
]

const BOOKS = [
  ['richestman_2604_librivox', 'wealth', 'The Richest Man in Babylon', 'George S. Clason', 1926, 70, 'Gpolum', 'Simple money lessons told as parables set in ancient Babylon: pay yourself first, live on less than you earn, and put your savings to work. This recording covers the original three parables.'],
  ['scienceofgettingrich2_2305_librivox', 'wealth', 'The Science of Getting Rich', 'Wallace D. Wattles', 1910, 143, '', 'A short 1910 classic arguing that wealth follows a clear purpose, steady action and giving more value than you take. It is philosophy and opinion, not a guarantee — read it as motivation, then test ideas yourself.'],
  ['acres_of_diamonds_1507_librivox', 'wealth', 'Acres of Diamonds', 'Russell H. Conwell', 1915, 101, 'Phil Chenevert', 'A famous speech with a simple point: opportunity is often right where you stand. Find a real need around you and serve it better than anyone else.'],
  ['as_a_man_thinketh_mc_librivox', 'motivation', 'As a Man Thinketh', 'James Allen', 1903, 54, 'Mark Cawley', 'A short essay on how your habitual thoughts shape your character and your circumstances. Quick to finish, easy to return to.'],
  ['game_of_life_0911_librivox', 'motivation', 'The Game of Life and How to Play It', 'Florence Scovel Shinn', 1925, 161, 'Amy Conger', 'A 1925 book of affirmation-based positive thinking. Treat it as an optimistic nudge and a source of ideas rather than a method.'],
  ['howtoliveon24hoursaday_1504_librivox', 'motivation', 'How to Live on 24 Hours a Day', 'Arnold Bennett', 1908, 96, 'Phil Chenevert', 'A practical little book about using the hours you already have: carve out small daily time for what matters and build from there.'],
  ['enchiridion_2006_librivox', 'emotion', 'The Enchiridion (Handbook)', 'Epictetus', 125, 51, 'D. E. Wittkower', 'The Stoic handbook on separating what is in your control from what is not — a classic for staying steady under pressure.'],
  ['meditations_0708_librivox', 'emotion', 'Meditations', 'Marcus Aurelius', 180, 420, '', 'A Roman emperor’s private notes on staying clear-headed, patient and kind. Long, so dip in one book at a time.'],
  ['idle_thoughts_librivox', 'laziness', 'Idle Thoughts of an Idle Fellow', 'Jerome K. Jerome', 1886, 301, 'Czechchris', 'Gentle, funny essays on idleness, busyness and the comedy of daily life — a welcome counterweight to hustle culture.'],
  ['essays_robert_louis_stevenson_mg_librivox', 'laziness', 'Essays of Robert Louis Stevenson', 'Robert Louis Stevenson', 1877, 330, 'Martin Geeson', 'Includes “An Apology for Idlers” (the second essay), a witty defence of unhurried time and curiosity. Skip to track two for the idleness essay.'],
]

export const SEED_AUDIOBOOKS = BOOKS.map(([archiveId, category, title, author, year, minutes, narrator, blurb]) => ({
  id: `ab-${archiveId.replace(/_librivox$/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
  archiveId,
  category,
  title,
  author,
  year,
  minutes,
  narrator,
  blurb,
  sourceUrl: `https://archive.org/details/${archiveId}`,
  license: 'LibriVox volunteer recording, public domain in the USA. Streamed from the Internet Archive; not hosted by Bermi.',
  status: 'published',
}))
