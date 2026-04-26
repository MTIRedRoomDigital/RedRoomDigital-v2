/**
 * Population seed: hand-authored fake users, worlds, characters, campaigns,
 * friendships, and world memberships to make the site feel lived-in.
 *
 * Design notes:
 * - Each user has a distinct voice. No "User1", no "Test_account".
 * - Bios are short, written like real people would write them.
 * - Characters reference specific events, places, people — not generic
 *   ("warrior" / "wizard") templates.
 * - Worlds have specific geography, named conflicts, named factions.
 * - All content is SFW so it survives the moderation gate (we skip the AI
 *   scan by inserting directly with is_nsfw=false; saves tokens).
 *
 * Idempotent: deletes any prior seed users by email pattern before re-seeding.
 *
 * Run with:  railway run npx tsx src/db/seed-population.ts
 */
import bcrypt from 'bcryptjs';
import { query } from './pool';

const SEED_EMAIL_DOMAIN = '@seed.redroom.local'; // marker for cleanup

interface UserSeed {
  username: string;
  email: string;
  bio: string;
  subscription?: 'free' | 'premium' | 'ultimate';
  birthYear?: number; // age varies; default is 1995
}

interface WorldSeed {
  creator: string; // username
  name: string;
  description: string;
  setting: string;
  lore: string;
  rules: { magic_system?: string; technology_level?: string; custom_rules?: string[] };
}

interface CharacterSeed {
  creator: string; // username
  name: string;
  description: string;
  background: string;
  traits: string[];
  values: string[];
  flaws: string[];
  speaking_style?: string;
  likes: string[];
  dislikes: string[];
  tags: string[];
  world?: string; // world name; null = vacuum
  chat_count?: number;
  like_count?: number;
}

interface CampaignSeed {
  creator: string; // username (must be world creator)
  world: string;
  name: string;
  description: string;
  premise: string;
  status?: 'draft' | 'active' | 'completed' | 'archived';
}

// ──────────────────────────────────────────────────────────────────────
// USERS
// ──────────────────────────────────────────────────────────────────────
const USERS: UserSeed[] = [
  { username: 'mara_calderon', email: 'mara' + SEED_EMAIL_DOMAIN, bio: 'Tabletop GM since 2014. I write villains and let other people write heroes.', subscription: 'ultimate' },
  { username: 'oliver_quist', email: 'oliver' + SEED_EMAIL_DOMAIN, bio: 'Speculative fiction writer. Currently obsessed with collapse-era settings.', subscription: 'premium' },
  { username: 'rin_takeda', email: 'rin' + SEED_EMAIL_DOMAIN, bio: 'I make characters whose biggest enemy is themselves.', subscription: 'premium' },
  { username: 'theodore_ash', email: 'theo' + SEED_EMAIL_DOMAIN, bio: 'Detectives, drifters, people on the wrong side of the right thing.', subscription: 'free' },
  { username: 'priya_navarro', email: 'priya' + SEED_EMAIL_DOMAIN, bio: 'Worldbuilder. Pixel artist. Tea drinker. In that order.', subscription: 'ultimate' },
  { username: 'cole_winters', email: 'cole' + SEED_EMAIL_DOMAIN, bio: 'Sci-fi mostly. The kind where the tech is broken and so are the people.', subscription: 'free' },
  { username: 'isabela_drake', email: 'isabela' + SEED_EMAIL_DOMAIN, bio: 'Long-form RP only. If you can\'t commit to three paragraphs, we\'re not gonna work.', subscription: 'premium' },
  { username: 'marcus_hale', email: 'marcus' + SEED_EMAIL_DOMAIN, bio: 'Historical fiction. Mostly 1920s and 30s. Sometimes I\'ll do a western.', subscription: 'free' },
  { username: 'nadia_reeve', email: 'nadia' + SEED_EMAIL_DOMAIN, bio: 'Horror, body horror, slow-burn dread. Don\'t @ me about jump scares.', subscription: 'premium' },
  { username: 'samir_okafor', email: 'samir' + SEED_EMAIL_DOMAIN, bio: 'Solarpunk. Optimism is a craft. Open to collabs.', subscription: 'free' },
  { username: 'eliza_voss', email: 'eliza' + SEED_EMAIL_DOMAIN, bio: 'Court intrigue, betrayal, slow poison. Nobles and the people who clean up after them.', subscription: 'premium' },
  { username: 'jp_morales', email: 'jp' + SEED_EMAIL_DOMAIN, bio: 'Just here to play a guy who fixes motorcycles in a fantasy world that doesn\'t have them yet.', subscription: 'free' },
  { username: 'kira_lindqvist', email: 'kira' + SEED_EMAIL_DOMAIN, bio: 'I write women who would absolutely commit crimes for the right reasons.', subscription: 'ultimate' },
  { username: 'desmond_cho', email: 'desmond' + SEED_EMAIL_DOMAIN, bio: 'Heist plots, con artists, and people who lie professionally.', subscription: 'free' },
  { username: 'aaliyah_freeman', email: 'aaliyah' + SEED_EMAIL_DOMAIN, bio: 'I want my characters to feel like real people who happen to live in a world that isn\'t.', subscription: 'premium' },
  { username: 'nikolai_brandt', email: 'nikolai' + SEED_EMAIL_DOMAIN, bio: 'GM. Quiet types. Guys who say one line and mean three things.', subscription: 'free' },
  { username: 'beth_holloway', email: 'beth' + SEED_EMAIL_DOMAIN, bio: 'Slice of life with bite. Will write your retired wizard who runs a bookshop.', subscription: 'free' },
  { username: 'ruben_vasquez', email: 'ruben' + SEED_EMAIL_DOMAIN, bio: 'Cyberpunk. Cops, runners, the people in between.', subscription: 'premium' },
];

// ──────────────────────────────────────────────────────────────────────
// WORLDS
// ──────────────────────────────────────────────────────────────────────
const WORLDS: WorldSeed[] = [
  {
    creator: 'mara_calderon',
    name: 'The Sundered Vale',
    description: 'A high-fantasy borderland where two dying empires meet at a river that\'s been on fire for sixty years.',
    setting: 'Late-medieval fantasy. Border kingdom with no clear sovereign.',
    lore: 'Sixty years ago, the Mage-Cardinal of Aurelis tried to unmake a god in the Vale. He failed, and the river caught fire. The flame has not gone out. It does not consume. It does not warm. It only burns. Both the Aurelisi crown and the Khelmri Princes claim the Vale as theirs but neither can collect taxes there — the towns answer to the river-keepers, a loose order of mendicants who pull the dead from the burning water and read futures in the way they float. Most adventurers in the Vale are deserters, debt-runaways, or sons no one will inherit. The land remembers gods the way a scar remembers the knife.',
    rules: {
      magic_system: 'Pact-based. All magic is borrowed and must be returned, sometimes with interest. Wizards age oddly.',
      technology_level: 'Late medieval. Crossbows exist. Black powder is a rumor from the south.',
      custom_rules: ['No characters who claim direct lineage from gods', 'Magic users must declare their pact source in the character background', 'Death in canon is permanent unless three players agree'],
    },
  },
  {
    creator: 'priya_navarro',
    name: 'Helio-9',
    description: 'A solar-orbital city built into the back of an asteroid that someone, a long time ago, hollowed out. Nobody knows who.',
    setting: 'Far-future habitat. Post-Earth, but the records of why are missing.',
    lore: 'Helio-9 was found, not built. The first colonists arrived in 2287 to a station that already had air, water reclamation, and a working hydroponics deck — running on something nobody could read. The city grew on top of the bones of whatever was there before. There are still locked doors. The Concord governs through three rotating councils: the Engineers (who keep the lights on), the Archivists (who try to read the bones), and the Voice (the rest of us). Nobody has been to Earth in eleven generations. Nobody can prove Earth still exists.',
    rules: {
      technology_level: 'Soft sci-fi. AI assistants are common but constrained. FTL is theoretical, not deployed.',
      custom_rules: ['No FTL-capable characters', 'AI characters need a registered handler', 'Earth-origin claims are treated as cosplay until proven'],
    },
  },
  {
    creator: 'nadia_reeve',
    name: 'Drowsing County',
    description: 'A New England county in the late 1990s where the dead don\'t always know they\'re dead, and the living are getting tired of pretending.',
    setting: 'Modern horror. Small-town Americana with a thin layer of rot.',
    lore: 'Drowsing County, Massachusetts. Four towns, one dying mill, a state forest that locals don\'t enter after dark. Something happened here in 1973 that the older residents won\'t talk about, and the younger ones have stopped asking. Three or four people go missing every year. Sometimes they come back. Sometimes the people who come back aren\'t exactly the people who left. The diner stays open all night. Nobody asks why.',
    rules: {
      technology_level: 'Late 1990s. Pagers, no smartphones. Cars from the 70s and 80s held together with cigarette ash and prayer.',
      custom_rules: ['Supernatural elements should be ambiguous', 'No characters with explicit magic abilities — only intuitions, dreams, and the cold feeling something is behind you'],
    },
  },
  {
    creator: 'eliza_voss',
    name: 'The Vermillion Court',
    description: 'A Renaissance-coded principality where the nobility has been quietly poisoning each other for so long it\'s become a courtesy.',
    setting: 'Court-intrigue fantasy. Mediterranean-coded city-state.',
    lore: 'The principality of Vermilio sits between three competing trade powers and survives by being too useful to invade. Its ruler is the Doge, elected from among the Twelve Houses for a six-year term. No Doge in the last eighty years has died of natural causes. The Court runs on patronage: poets, painters, spies, and assassins (who are sometimes the same people) move from House to House every season like migrating birds. The common people of Vermilio — bakers, dockworkers, scribes — pretend not to notice. They live longer that way.',
    rules: {
      magic_system: 'Subtle. No fireballs. Magic is ritual, hereditary, and almost always illegal at court.',
      technology_level: 'Early Renaissance. Printing presses exist. Firearms are rare and considered uncouth.',
      custom_rules: ['Every noble character must be sworn to one of the Twelve Houses', 'Poison is an art, not a weapon — characters who use it crudely are scorned'],
    },
  },
  {
    creator: 'ruben_vasquez',
    name: 'Neo-Taipei 2089',
    description: 'A city that ate its own coastline. Corporate-feudal. Rains nine months of the year. Everyone owes someone.',
    setting: 'Cyberpunk. Late-stage corporate sprawl with monsoon weather.',
    lore: 'Taipei drowned in 2061 and rebuilt upward. The new city is forty-six vertical districts, each one a little more privatized than the one above it. The four big keiretsu (Shenzhou-Kobe, Aozora Health, the Jade Cooperative, and Helix Defense) hold most of the patents that keep people alive. Citizenship is a subscription. Below district twelve, the rain comes down through three floors of plumbing before it hits you. Runners move data and bodies and small lies between layers. Nobody asks where the cops go when they aren\'t in uniform.',
    rules: {
      technology_level: 'Hard cyberpunk. Cybernetics are common but expensive. Net-running causes brain damage at high enough dives.',
      custom_rules: ['All cybernetic upgrades require a maintenance contract — pick a corp', 'No "chosen one" backgrounds. Everyone here is for sale'],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────
// CHARACTERS
// ──────────────────────────────────────────────────────────────────────
const CHARACTERS: CharacterSeed[] = [
  // Sundered Vale
  {
    creator: 'mara_calderon',
    name: 'Cardinal Iohanna Vell',
    description: 'A defrocked Aurelisi mage-cardinal who was there the day the river caught fire.',
    background: 'Iohanna was twenty-three when she stood at the side of her mentor and watched him try to kill a god. She lost her right arm in the casting. The Church gave her a silver replacement and a quiet posting in a mountain seminary. She left the Church on her fortieth birthday and walked back to the Vale on foot. She has been there for nineteen years. She knows what the river is. She has not told anyone.',
    traits: ['guarded', 'patient', 'devout in private, scornful in public'],
    values: ['penance', 'truth told once, slowly'],
    flaws: ['cannot forgive herself', 'distrusts anyone who needs her'],
    speaking_style: 'Speaks in short, declarative sentences. Quotes scripture sparingly and only to wound.',
    likes: ['cold weather', 'children\'s questions', 'silence after rain'],
    dislikes: ['young priests', 'wine before sundown', 'being thanked'],
    tags: ['fantasy', 'mage', 'priest', 'antihero'],
    world: 'The Sundered Vale',
    chat_count: 47,
    like_count: 31,
  },
  {
    creator: 'kira_lindqvist',
    name: 'Brenn Two-Coat',
    description: 'A river-keeper of the Vale. Not a priest. Pulls bodies out of the burning river for a living.',
    background: 'Brenn was born in the Vale. Her mother was a deserter from Khelmri, her father a Vale charcoal-burner. She does not remember either of them. The river-keepers raised her along with eight other orphans. She wears two coats because the inner one belonged to her brother, who drowned four years ago and is, technically, still in the river. The keepers don\'t pull their own. It\'s considered vain.',
    traits: ['steady', 'quietly funny', 'unsentimental'],
    values: ['the work', 'leaving people alone when they need it'],
    flaws: ['cannot ask for help', 'drinks more than she lets on'],
    speaking_style: 'Plain. Dry. Will answer a serious question with a joke if she\'s not ready to answer it.',
    likes: ['hot bread', 'her brother\'s old coat', 'the way the river sounds at dawn'],
    dislikes: ['ceremonies', 'people who romanticize the keepers', 'crying in front of strangers'],
    tags: ['fantasy', 'commoner', 'grief', 'water'],
    world: 'The Sundered Vale',
    chat_count: 22,
    like_count: 18,
  },
  {
    creator: 'nikolai_brandt',
    name: 'Fenrik of No House',
    description: 'A Khelmri deserter turned Vale freebooter. Doesn\'t talk much. Talks well when he does.',
    background: 'Fenrik was a sergeant in the Khelmri Third Lances when his prince ordered the village of Saatren razed. He carried out three orders. He refused the fourth. He has been south of the river ever since. He sleeps with one eye on the door. He has not used his given name in eleven years.',
    traits: ['watchful', 'slow to anger, hard to stop'],
    values: ['the line you don\'t cross'],
    flaws: ['cannot trust hierarchies', 'will not protect himself first'],
    speaking_style: 'Few words. Pauses where most people would fill silence.',
    likes: ['horses he\'s broken in himself', 'good leather', 'cold mornings'],
    dislikes: ['officers', 'prayer he didn\'t ask for', 'sweet wine'],
    tags: ['fantasy', 'deserter', 'soldier', 'quiet'],
    world: 'The Sundered Vale',
    chat_count: 19,
    like_count: 14,
  },
  {
    creator: 'beth_holloway',
    name: 'Old Auntie Thessa',
    description: 'Runs the only bookshop in Greyburn-on-Vale. Used to be a court mage. Now she sells almanacs and tea.',
    background: 'Thessa retired from the Aurelisi court forty years ago after an "incident" she will not discuss. She moved to Greyburn, opened a bookshop above a stable, and has been there ever since. She knows everyone\'s business and minds her own. The shop\'s cat is named after a man she once turned into a cat. She insists this is a coincidence.',
    traits: ['warm', 'sharp', 'absolutely capable of ruining your life'],
    values: ['hospitality', 'restraint'],
    flaws: ['enjoys being underestimated more than is wise', 'keeps grudges in alphabetical order'],
    speaking_style: 'Grandmotherly. Full of compliments that double as warnings.',
    likes: ['fennel tea', 'first editions', 'rude customers'],
    dislikes: ['the current archmage', 'tourists', 'people who don\'t take their boots off'],
    tags: ['fantasy', 'retired', 'shopkeeper', 'mage'],
    world: 'The Sundered Vale',
    chat_count: 35,
    like_count: 28,
  },

  // Helio-9
  {
    creator: 'priya_navarro',
    name: 'Archivist Wen Tobari',
    description: 'Third-rank Archivist on Helio-9. Can read four of the seven dead languages on the lower deck doors.',
    background: 'Tobari was a hydroponics tech until they were thirty. They tested into the Archivist track late and have never quite been forgiven for it by the older Archivists. They live in a converted maintenance closet because they like the way the recyclers hum. They are working, on their own time and against regulation, on a translation of a single phrase carved over the airlock to Section Four. They have been at it for six years.',
    traits: ['obsessive', 'quietly proud', 'kind to people they have decided are not boring'],
    values: ['reading the original text, not the summary'],
    flaws: ['ranks scholarship above kindness', 'holds grudges'],
    speaking_style: 'Precise. Will correct you. Apologetic about correcting you only after the third time.',
    likes: ['etymology', 'recycler hum', 'unlabeled coffee'],
    dislikes: ['committee meetings', 'the word "intuitive"', 'people who say "lost civilization"'],
    tags: ['scifi', 'scholar', 'archivist'],
    world: 'Helio-9',
    chat_count: 28,
    like_count: 21,
  },
  {
    creator: 'cole_winters',
    name: 'Reesha Ndovu',
    description: 'Engineer, third generation. Fixes the things on Helio-9 that the Concord pretends aren\'t broken.',
    background: 'Reesha\'s grandmother was on the team that figured out how to splice human plumbing into whatever the original Helio-9 designers used for theirs. Reesha grew up underneath the city, in the maintenance levels. She has never been to the upper deck. She does not particularly want to go. She is thirty-four and the Council just put her name on a promotion list. She is trying to figure out how to refuse without losing the assignments she actually wants.',
    traits: ['practical', 'bone-tired', 'fond of people who don\'t bullshit her'],
    values: ['the lights staying on'],
    flaws: ['too proud to ask for help', 'undervalues her own work'],
    speaking_style: 'Quick, low-volume. Drops the ends of sentences when she\'s tired.',
    likes: ['solid welds', 'silence between alarms', 'her cat, Plumb'],
    dislikes: ['Archivists who lecture', 'Council politics', 'the way the upper-deck people walk'],
    tags: ['scifi', 'engineer', 'working class'],
    world: 'Helio-9',
    chat_count: 41,
    like_count: 25,
  },
  {
    creator: 'samir_okafor',
    name: 'Voice-Counselor Ade Okorie',
    description: 'A junior Voice-Counselor on Helio-9. Got the job because nobody senior wanted Section Twelve.',
    background: 'Ade is twenty-eight and grew up in Section Twelve, the rim district where the air tastes of solder. He was elected to the Voice three months ago on a platform of "I will actually answer my office hours." So far he has. The petitions are about leaks, neighbors, contracts with Helix Health that nobody can read. He is trying very hard not to be cynical. It is going about as well as you\'d expect.',
    traits: ['earnest', 'overworked', 'still hopeful'],
    values: ['showing up', 'reading the petition before answering it'],
    flaws: ['takes everything personally', 'will not say no to anyone'],
    speaking_style: 'Warm. Slightly formal in public. Drops it among friends.',
    likes: ['his neighbors\' kids', 'tea brewed too long', 'public radio'],
    dislikes: ['lobbyists', 'meetings that should have been memos', 'his own handwriting'],
    tags: ['scifi', 'politician', 'idealist'],
    world: 'Helio-9',
    chat_count: 16,
    like_count: 12,
  },

  // Drowsing County
  {
    creator: 'nadia_reeve',
    name: 'Sheriff Maeve Doolan',
    description: 'Sheriff of Drowsing County since 1988. Knows where the bodies aren\'t.',
    background: 'Maeve was twelve in 1973. Her older brother Tom was sixteen. Tom went into the state forest with three friends and came back alone, three days later, with no memory of where the others went. Tom died of a stroke in 1981 at twenty-four. Maeve became a deputy that year. She has been sheriff since 1988. She has never gone into the state forest after dark. She has never told anyone why.',
    traits: ['watchful', 'patient', 'tired in a way coffee won\'t fix'],
    values: ['protecting the people who don\'t know what they\'re asking'],
    flaws: ['avoids the woods', 'lies to herself about her brother'],
    speaking_style: 'Slow. Friendly. Lets the silence do the asking when she can.',
    likes: ['the diner\'s pie', 'her dog, Hank', 'the radio on a long drive'],
    dislikes: ['state troopers', 'town meetings about the woods', 'October'],
    tags: ['horror', 'cop', 'small-town', 'dread'],
    world: 'Drowsing County',
    chat_count: 33,
    like_count: 26,
  },
  {
    creator: 'theodore_ash',
    name: 'Reverend Dale Marston',
    description: 'Methodist minister of First Drowsing. Served two tours. Sees ghosts. Doesn\'t mention it.',
    background: 'Dale came home from his second tour in 1971 and joined the seminary instead of finishing his engineering degree. He has been the minister of First Drowsing for thirty years. He has buried a hundred and forty-one people in this county. Six of them came back to the church after their funerals. He let them sit in the back pew. He didn\'t ask questions. They left when they were ready.',
    traits: ['gentle', 'quietly haunted', 'patient'],
    values: ['the right of the dead to be themselves'],
    flaws: ['doesn\'t take care of his own grief', 'drinks alone'],
    speaking_style: 'Soft. Pastoral. Will quote scripture only if he means it.',
    likes: ['old hymns', 'the church organ on Wednesday nights', 'Maeve\'s coffee'],
    dislikes: ['evangelists from out of town', 'the bishop', 'Easter sunrise services'],
    tags: ['horror', 'priest', 'veteran', 'haunted'],
    world: 'Drowsing County',
    chat_count: 24,
    like_count: 20,
  },
  {
    creator: 'aaliyah_freeman',
    name: 'Janelle Reyes',
    description: 'Drowsing High senior. Works the late shift at the diner. Has started seeing things.',
    background: 'Janelle is seventeen. She works Tuesdays and Fridays at the all-night diner because her mom needs the money and her uncle owns the place. Three weeks ago a man sat in her section at 3:14 a.m., ordered black coffee, drank half of it, and walked out without paying. He left no money on the table. There was no record of him on the camera. Her uncle laughed it off. She has seen him twice more since.',
    traits: ['observant', 'stubborn', 'scared but not stopping'],
    values: ['her mom', 'finishing what she starts'],
    flaws: ['won\'t tell adults what\'s happening', 'overestimates how much sleep she can skip'],
    speaking_style: 'Direct. Smart. Cuts off her own sentences when she\'s thinking.',
    likes: ['diner pancakes', 'her old Walkman', 'her uncle\'s dog'],
    dislikes: ['the regular at booth four', 'fluorescent lights at 4am', 'people calling her "kid"'],
    tags: ['horror', 'teen', 'mystery'],
    world: 'Drowsing County',
    chat_count: 19,
    like_count: 16,
  },

  // Vermillion Court
  {
    creator: 'eliza_voss',
    name: 'Donna Cellaria di March',
    description: 'Patron of House March. Widowed twice. Suspected of three things, guilty of two.',
    background: 'Cellaria was married into House March at nineteen. Her first husband died in his sleep at thirty-four. Her second husband — also a March, by arrangement — died in his sleep at forty-one. The Court has been waiting nine years for her third marriage to be announced. She has not announced one. She runs the House from a salon that meets every Thursday and is, as far as anyone can prove, just a salon.',
    traits: ['gracious', 'patient', 'has the longest memory at court'],
    values: ['the House', 'the long game'],
    flaws: ['cannot let an insult go', 'underestimates outsiders'],
    speaking_style: 'Elegant. Compliments that land like bills coming due.',
    likes: ['Tuesday operas', 'her late husband\'s dogs', 'fresh figs'],
    dislikes: ['the Doge\'s nephew', 'untrained spies', 'the new Bishop'],
    tags: ['fantasy', 'noble', 'intrigue', 'matriarch'],
    world: 'The Vermillion Court',
    chat_count: 38,
    like_count: 30,
  },
  {
    creator: 'desmond_cho',
    name: 'Renzo of Five Names',
    description: 'A forger and occasional spy. Currently under contract to House Velli, House March, and the Doge\'s clerk.',
    background: 'Renzo was born Renzo. He has been Marcello, Tolen, Bric, and once for two months a Vasilisi cardinal named Auro. He is forty-one. He has not paid rent in nine years; his various contracts include lodging. He is the only forger in Vermilio whose work has fooled the Treasury, and the Treasury does not know this, because they fooled themselves into thinking they couldn\'t be fooled.',
    traits: ['charming', 'never quite present', 'fastidious about handwriting'],
    values: ['his own continuity'],
    flaws: ['too clever to retire', 'sentimental about old jobs'],
    speaking_style: 'Smooth. Switches register depending on company. Tells the truth in jokes.',
    likes: ['linen paper', 'silver ink', 'a good con run by someone else'],
    dislikes: ['printing presses', 'his original handwriting', 'the man who taught him'],
    tags: ['fantasy', 'rogue', 'forger', 'spy'],
    world: 'The Vermillion Court',
    chat_count: 31,
    like_count: 24,
  },
  {
    creator: 'rin_takeda',
    name: 'Brother Vass',
    description: 'A Vermillion mendicant. Hears confessions. Charges nothing. Forgets nothing.',
    background: 'Vass joined the mendicant order at sixteen after a fire he will not discuss. He has been hearing confessions in the streets of Vermilio for nineteen years. He is poor, deliberately. He owns one robe, one bowl, and a set of letters from a woman who is now a duchess. He has never read the letters. He keeps them in case he needs them.',
    traits: ['attentive', 'incorruptible in public', 'capable of cruelty in defense of others'],
    values: ['the seal of confession'],
    flaws: ['holds onto the letters', 'pride disguised as humility'],
    speaking_style: 'Quiet. Asks one question more than expected.',
    likes: ['rain on tile roofs', 'cheap red wine', 'children\'s confessions, which are usually about other children'],
    dislikes: ['the Bishop', 'patrons who tip', 'his own past'],
    tags: ['fantasy', 'priest', 'mendicant', 'morally complex'],
    world: 'The Vermillion Court',
    chat_count: 22,
    like_count: 19,
  },

  // Neo-Taipei
  {
    creator: 'ruben_vasquez',
    name: 'Detective Mei "Mai" Cheng',
    description: 'NTPD homicide, district 18. Honest, which is unusual. Tired, which isn\'t.',
    background: 'Mei joined the force at twenty-three because her brother was in it and she thought she could fix things from inside. Her brother died in 2084 in a no-knock raid that turned out to be at the wrong address. The department closed the case. Mei did not. She has been working homicide for eleven years now. Her clearance rate is the highest in district 18. Three of her arrests have been overturned by corporate counsel. She does not get promoted.',
    traits: ['stubborn', 'observant', 'careful with her own anger'],
    values: ['the case'],
    flaws: ['cannot let her brother\'s case go', 'sleeps four hours a night'],
    speaking_style: 'Plain. Asks questions twice in different ways.',
    likes: ['street noodles from the cart on level 14', 'her partner\'s playlists', 'rainy days, professionally'],
    dislikes: ['Helix Defense liaison officers', 'the chief', 'corporate court orders'],
    tags: ['cyberpunk', 'cop', 'detective'],
    world: 'Neo-Taipei 2089',
    chat_count: 44,
    like_count: 33,
  },
  {
    creator: 'jp_morales',
    name: 'Booker Tan',
    description: 'Mechanic on level 22. Will fix anything. Will explain nothing. Asks for cash.',
    background: 'Booker came up from level 7 working for an Aozora subcontractor. He left when his shift partner died of "respiratory complications" that were really the company-grade air filters failing. He bought out his contract with money he won\'t talk about and now runs a shop on level 22 where he fixes vehicles, prosthetics, drones, anything that has parts that move and parts that shouldn\'t. He is forty-six. He is funny when nobody is looking.',
    traits: ['gruff', 'loyal in unspoken ways', 'reads three languages but pretends not to'],
    values: ['fair work for fair pay'],
    flaws: ['terrible at saying what he feels', 'still angry at Aozora'],
    speaking_style: 'Short. Sarcastic. Pretends not to remember things he remembers exactly.',
    likes: ['black coffee from the cart out front', 'cats', 'old vehicles with combustion engines'],
    dislikes: ['Aozora reps', 'people who haggle', 'corporate uniforms'],
    tags: ['cyberpunk', 'mechanic', 'working class'],
    world: 'Neo-Taipei 2089',
    chat_count: 27,
    like_count: 22,
  },
  {
    creator: 'isabela_drake',
    name: 'Vex',
    description: 'A net-runner. Six dives in the last year, one too many, and she knows it.',
    background: 'Vex won\'t give her real name. She is twenty-nine, ran her first dive at nineteen, and is one of maybe four people on Helio-9 — sorry, in Neo-Taipei — who can pull a clean datalift from a Helix Defense black-net node. She lives in a capsule on level 19 and has not slept more than five hours in a row in two years. The neural feedback from her last dive left her left hand tremoring. She has not told her broker. Her broker has noticed.',
    traits: ['sharp', 'wired', 'soft to people who are softer'],
    values: ['the people she runs with'],
    flaws: ['ignoring her own decline', 'one more job, always one more'],
    speaking_style: 'Quick, clipped, full of slang. Slows down when something matters.',
    likes: ['stolen good coffee', 'her broker\'s daughter, who makes her dinner sometimes', 'pre-collapse music'],
    dislikes: ['Helix Defense', 'her own reflection lately', 'doctors'],
    tags: ['cyberpunk', 'hacker', 'runner'],
    world: 'Neo-Taipei 2089',
    chat_count: 36,
    like_count: 29,
  },

  // Vacuum (no world)
  {
    creator: 'oliver_quist',
    name: 'Dr. Ines Albright',
    description: 'Postdoctoral linguist. Currently translating a language nobody can prove existed.',
    background: 'Ines finished her doctorate two years ago on the loss-pattern in pre-classical Etruscan inscriptions. She is now on a fellowship she chose over three better-paying ones because of a single inscription discovered on a piece of broken pottery in 2019. The inscription is in a language that has no other surviving examples. She has been working on it for fourteen months. She thinks she has a verb. She has told nobody.',
    traits: ['focused', 'self-deprecating', 'kind in a weird, distracted way'],
    values: ['the actual evidence'],
    flaws: ['skips meals', 'avoids phone calls'],
    speaking_style: 'Academic but friendly. Pauses when she\'s working something out.',
    likes: ['cold offices', 'unread books', 'late-night gas station coffee'],
    dislikes: ['conferences', 'her supervisor\'s emails', 'people who say "exciting"'],
    tags: ['modern', 'academic', 'mystery'],
    chat_count: 18,
    like_count: 14,
  },
  {
    creator: 'marcus_hale',
    name: 'Walt Brennan',
    description: 'Pinkerton, retired. Chicago, 1928. Took on private cases until he stopped taking on cases at all.',
    background: 'Walt put in nineteen years with the agency before retiring after a job that he won\'t describe to anyone. He lives above a tailor on Halsted, drinks coffee at the same diner every morning, and reads four newspapers a day. He took two private cases in 1927. He has not taken any in 1928. People still come to his door. He still answers it.',
    traits: ['observant', 'old-school polite', 'capable of being dangerous'],
    values: ['his word, when he gives it'],
    flaws: ['hard on himself', 'drinks more in October'],
    speaking_style: 'Spare. Midwestern. "Ma\'am" comes out without him thinking about it.',
    likes: ['a good cigar', 'the morning paper before the news gets out', 'the diner\'s dog'],
    dislikes: ['the new commissioner', 'speakeasies', 'his own birthday'],
    tags: ['historical', '1920s', 'detective'],
    chat_count: 21,
    like_count: 17,
  },
  {
    creator: 'rin_takeda',
    name: 'Yuki Hara',
    description: 'A musician. A liar. Three years sober. One bad week away from un-sober.',
    background: 'Yuki was nineteen when their first record came out. They were twenty-seven when their last record didn\'t. They are thirty-four now. They live in a one-bedroom in Sapporo with a piano they can\'t afford and a cat who doesn\'t like them. They have been sober for three years and one month. They are writing again. The new songs are good and they are afraid of them.',
    traits: ['wry', 'self-aware', 'bad at small talk'],
    values: ['the work, eventually'],
    flaws: ['catastrophizes', 'pushes people away'],
    speaking_style: 'Quiet. Funny when comfortable. Defensive when not.',
    likes: ['the smell of new strings', 'their cat (despite)', 'cold mornings'],
    dislikes: ['their old label', 'audiences who shout requests', 'birthdays'],
    tags: ['modern', 'slice of life', 'musician'],
    chat_count: 14,
    like_count: 11,
  },
];

// ──────────────────────────────────────────────────────────────────────
// CAMPAIGNS
// ──────────────────────────────────────────────────────────────────────
const CAMPAIGNS: CampaignSeed[] = [
  {
    creator: 'mara_calderon',
    world: 'The Sundered Vale',
    name: 'The Greyburn Inquest',
    description: 'A traveling inquest from the Aurelisi crown arrives in Greyburn. Half the town wants them gone. The other half wants them to stay long enough to find what\'s in the cellar of the old mill.',
    premise: 'The crown has sent an inquisitor to investigate "irregular reports" out of the Vale. She and her two clerks ride into Greyburn on a Tuesday. By Friday someone is dead. The town meets at the bookshop above the stable to decide who tells her what — and who doesn\'t. The inquisitor is too polite to be safe.',
    status: 'draft',
  },
  {
    creator: 'priya_navarro',
    world: 'Helio-9',
    name: 'The Section Four Translation',
    description: 'After six years, an Archivist is two days from publishing a translation of the carving over Section Four\'s airlock. Engineering is nervous. The Voice is nervous. Section Four is making a sound it has not made before.',
    premise: 'Wen Tobari has filed a paper claiming a partial translation of the Section Four inscription. They want a council vote to authorize a supervised opening of the airlock. Engineering is not convinced the door is, technically, a door. Voice-Counselor Okorie has constituents who want to know. Reesha has the maintenance records that show the airlock\'s temperature has gone up four degrees in the last week. Vote is in three days.',
    status: 'active',
  },
  {
    creator: 'nadia_reeve',
    world: 'Drowsing County',
    name: 'The Halloween That Wasn\'t',
    description: 'Halloween 1998. Three teenagers are missing. The state forest has stopped making sound. The sheriff is not sleeping. Someone has started leaving things on the church steps.',
    premise: 'It is October 28, 1998. Janelle\'s classmate Devin Walsh has been missing for nine days, along with two of his friends. The state police have already left. The sheriff has not. Reverend Marston found a small wooden carving on the church steps three nights ago, and another one last night. He has not told anyone. The diner is short-staffed. Something in the woods has stopped making sound, and the older residents have noticed, and they are scared in a way they don\'t know how to talk about.',
    status: 'draft',
  },
  {
    creator: 'eliza_voss',
    world: 'The Vermillion Court',
    name: 'The Six-Year Election',
    description: 'The Doge\'s six-year term ends in three months. House March is moving. House Velli is moving back. Renzo has been hired by both, and a third client whose handwriting he can\'t place.',
    premise: 'The Twelve Houses gather at the start of every Doge cycle in the Salon of Mirrors. There are old rules. There are newer ones, made up after each previous Doge died. Donna Cellaria is hosting a Thursday salon that is, this week, suspiciously well-attended. The Bishop has not been seen in eight days. Brother Vass has heard four confessions in the last three days that all describe the same dream. Renzo has accepted three contracts that contradict each other. Someone has noticed.',
    status: 'draft',
  },
  {
    creator: 'ruben_vasquez',
    world: 'Neo-Taipei 2089',
    name: 'Wrongful Death Case 11-44',
    description: 'A Helix Defense raid kills a level-22 mechanic. The corp closes the case in eighteen hours. Detective Cheng opens it again. So does the mechanic\'s daughter, who is twelve.',
    premise: 'On a Tuesday at 3:42am, Helix Defense executes a no-knock entry on a workshop on level 22. The shop owner, a registered mechanic, is killed. Helix\'s filing says he was running an unlicensed cybernetics operation. Booker Tan, who knew the mechanic for twelve years, says Helix is wrong. Detective Cheng has the case file on her desk by Wednesday morning. The mechanic\'s twelve-year-old daughter has shown up at Booker\'s shop with her father\'s ledger. The ledger has names in it. One of them is the chief of police.',
    status: 'draft',
  },
];

// ──────────────────────────────────────────────────────────────────────
// FRIENDSHIPS — accepted only, sparse but plausible
// ──────────────────────────────────────────────────────────────────────
const FRIENDSHIPS: [string, string][] = [
  ['mara_calderon', 'kira_lindqvist'],
  ['mara_calderon', 'eliza_voss'],
  ['priya_navarro', 'cole_winters'],
  ['priya_navarro', 'samir_okafor'],
  ['nadia_reeve', 'theodore_ash'],
  ['nadia_reeve', 'aaliyah_freeman'],
  ['eliza_voss', 'desmond_cho'],
  ['eliza_voss', 'rin_takeda'],
  ['ruben_vasquez', 'jp_morales'],
  ['ruben_vasquez', 'isabela_drake'],
  ['oliver_quist', 'marcus_hale'],
  ['rin_takeda', 'beth_holloway'],
  ['nikolai_brandt', 'mara_calderon'],
];

// ──────────────────────────────────────────────────────────────────────
// World memberships beyond creators (worldmaster=false)
// ──────────────────────────────────────────────────────────────────────
const WORLD_MEMBERS: { world: string; user: string }[] = [
  { world: 'The Sundered Vale', user: 'kira_lindqvist' },
  { world: 'The Sundered Vale', user: 'nikolai_brandt' },
  { world: 'The Sundered Vale', user: 'beth_holloway' },
  { world: 'Helio-9', user: 'cole_winters' },
  { world: 'Helio-9', user: 'samir_okafor' },
  { world: 'Drowsing County', user: 'theodore_ash' },
  { world: 'Drowsing County', user: 'aaliyah_freeman' },
  { world: 'The Vermillion Court', user: 'desmond_cho' },
  { world: 'The Vermillion Court', user: 'rin_takeda' },
  { world: 'Neo-Taipei 2089', user: 'jp_morales' },
  { world: 'Neo-Taipei 2089', user: 'isabela_drake' },
];

// ──────────────────────────────────────────────────────────────────────
// Run
// ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Population seed — starting…');

  // Cleanup any prior run by email pattern
  console.log('Cleaning up any previous seed data…');
  const oldUsers = await query(
    `SELECT id FROM users WHERE email LIKE $1`,
    ['%' + SEED_EMAIL_DOMAIN]
  );
  for (const u of oldUsers.rows) {
    await query(`DELETE FROM users WHERE id = $1`, [u.id]); // CASCADE handles the rest
  }
  console.log(`  removed ${oldUsers.rows.length} prior seed users`);

  // Hash one shared password — these are seed accounts, not real users.
  const sharedHash = await bcrypt.hash('seed-account-do-not-use', 10);

  // Insert users
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const birthYear = u.birthYear || 1995;
    const r = await query(
      `INSERT INTO users (username, email, password_hash, bio, subscription, birthdate, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [u.username, u.email, sharedHash, u.bio, u.subscription || 'free', `${birthYear}-06-15`]
    );
    userIds[u.username] = r.rows[0].id;
  }
  console.log(`✓ ${USERS.length} users`);

  // Insert worlds
  const worldIds: Record<string, string> = {};
  for (const w of WORLDS) {
    const r = await query(
      `INSERT INTO worlds (creator_id, name, description, lore, rules, setting, is_public, is_nsfw, member_count)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, 1)
       RETURNING id`,
      [userIds[w.creator], w.name, w.description, w.lore, JSON.stringify(w.rules), w.setting]
    );
    worldIds[w.name] = r.rows[0].id;
    // Creator becomes WorldMaster
    await query(
      `INSERT INTO world_members (world_id, user_id, is_worldmaster) VALUES ($1, $2, true)`,
      [r.rows[0].id, userIds[w.creator]]
    );
  }
  console.log(`✓ ${WORLDS.length} worlds`);

  // Insert characters
  for (const c of CHARACTERS) {
    const personality = {
      traits: c.traits,
      values: c.values,
      flaws: c.flaws,
      speaking_style: c.speaking_style,
    };
    await query(
      `INSERT INTO characters
        (creator_id, name, description, personality, background,
         likes, dislikes, world_id, is_public, is_nsfw, is_ai_enabled, tags,
         chat_count, like_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false, true, $9, $10, $11)`,
      [
        userIds[c.creator], c.name, c.description,
        JSON.stringify(personality), c.background,
        JSON.stringify(c.likes), JSON.stringify(c.dislikes),
        c.world ? worldIds[c.world] : null,
        c.tags, c.chat_count || 0, c.like_count || 0,
      ]
    );
  }
  console.log(`✓ ${CHARACTERS.length} characters`);

  // World memberships (extras beyond creator)
  for (const m of WORLD_MEMBERS) {
    try {
      await query(
        `INSERT INTO world_members (world_id, user_id, is_worldmaster) VALUES ($1, $2, false)
         ON CONFLICT DO NOTHING`,
        [worldIds[m.world], userIds[m.user]]
      );
      await query(
        `UPDATE worlds SET member_count = member_count + 1 WHERE id = $1`,
        [worldIds[m.world]]
      );
    } catch (e: any) {
      console.warn(`  skipped membership ${m.user} → ${m.world}: ${e?.message}`);
    }
  }
  console.log(`✓ ${WORLD_MEMBERS.length} world memberships`);

  // Insert campaigns
  for (const camp of CAMPAIGNS) {
    await query(
      `INSERT INTO campaigns
        (world_id, creator_id, name, description, premise, status,
         max_participants, min_participants, sort_order, is_nsfw)
       VALUES ($1, $2, $3, $4, $5, $6, 6, 2, 0, false)`,
      [
        worldIds[camp.world], userIds[camp.creator],
        camp.name, camp.description, camp.premise,
        camp.status || 'draft',
      ]
    );
  }
  console.log(`✓ ${CAMPAIGNS.length} campaigns`);

  // Friendships (status accepted)
  // Try the canonical schema (requester_id / addressee_id) first; fall back
  // to user_id / friend_id for older deployments.
  let friendshipsAdded = 0;
  for (const [a, b] of FRIENDSHIPS) {
    const ua = userIds[a];
    const ub = userIds[b];
    if (!ua || !ub) continue;
    try {
      await query(
        `INSERT INTO friendships (requester_id, addressee_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT DO NOTHING`,
        [ua, ub]
      );
      friendshipsAdded++;
    } catch {
      try {
        await query(
          `INSERT INTO friendships (user_id, friend_id, status)
           VALUES ($1, $2, 'accepted')
           ON CONFLICT DO NOTHING`,
          [ua, ub]
        );
        friendshipsAdded++;
      } catch (e: any) {
        console.warn(`  skipped friendship ${a} ↔ ${b}: ${e?.message}`);
      }
    }
  }
  console.log(`✓ ${friendshipsAdded} friendships`);

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
