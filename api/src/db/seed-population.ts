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
// Internet-style anonymous handles. Mix of nature compounds, regional handles,
// number suffixes, aesthetic words — never first/last name patterns.
const USERS: UserSeed[] = [
  { username: 'hexpriestess', email: 'hexpriestess' + SEED_EMAIL_DOMAIN, bio: 'Tabletop GM since 2014. I write villains and let other people write heroes.', subscription: 'ultimate' },
  { username: 'collapseera', email: 'collapseera' + SEED_EMAIL_DOMAIN, bio: 'Speculative fiction writer. Currently obsessed with collapse-era settings.', subscription: 'premium' },
  { username: 'glassbones', email: 'glassbones' + SEED_EMAIL_DOMAIN, bio: 'I make characters whose biggest enemy is themselves.', subscription: 'premium' },
  { username: 'wrongsideoftheright', email: 'wrongside' + SEED_EMAIL_DOMAIN, bio: 'Detectives, drifters, people on the wrong side of the right thing.', subscription: 'free' },
  { username: 'pixeltea', email: 'pixeltea' + SEED_EMAIL_DOMAIN, bio: 'Worldbuilder. Pixel artist. Tea drinker. In that order.', subscription: 'ultimate' },
  { username: 'brokentech_22', email: 'brokentech' + SEED_EMAIL_DOMAIN, bio: 'Sci-fi mostly. The kind where the tech is broken and so are the people.', subscription: 'free' },
  { username: 'threeparagraphsmin', email: 'threepara' + SEED_EMAIL_DOMAIN, bio: 'Long-form RP only. If you can\'t commit to three paragraphs, we\'re not gonna work.', subscription: 'premium' },
  { username: 'twentiesnoir', email: 'twentiesnoir' + SEED_EMAIL_DOMAIN, bio: 'Historical fiction. Mostly 1920s and 30s. Sometimes I\'ll do a western.', subscription: 'free' },
  { username: 'slowburn_dread', email: 'slowburn' + SEED_EMAIL_DOMAIN, bio: 'Horror, body horror, slow-burn dread. Don\'t @ me about jump scares.', subscription: 'premium' },
  { username: 'solarpunk_atx', email: 'solarpunk' + SEED_EMAIL_DOMAIN, bio: 'Solarpunk. Optimism is a craft. Open to collabs.', subscription: 'free' },
  { username: 'slowpoisongirl', email: 'slowpoison' + SEED_EMAIL_DOMAIN, bio: 'Court intrigue, betrayal, slow poison. Nobles and the people who clean up after them.', subscription: 'premium' },
  { username: 'wrenchgoblin', email: 'wrenchgoblin' + SEED_EMAIL_DOMAIN, bio: 'Just here to play a guy who fixes motorcycles in a fantasy world that doesn\'t have them yet.', subscription: 'free' },
  { username: 'felonyforlove', email: 'felonyforlove' + SEED_EMAIL_DOMAIN, bio: 'I write women who would absolutely commit crimes for the right reasons.', subscription: 'ultimate' },
  { username: 'conartistprep', email: 'conartistprep' + SEED_EMAIL_DOMAIN, bio: 'Heist plots, con artists, and people who lie professionally.', subscription: 'free' },
  { username: 'mothbrain', email: 'mothbrain' + SEED_EMAIL_DOMAIN, bio: 'I want my characters to feel like real people who happen to live in a world that isn\'t.', subscription: 'premium' },
  { username: 'onelinerguy', email: 'onelinerguy' + SEED_EMAIL_DOMAIN, bio: 'GM. Quiet types. Guys who say one line and mean three things.', subscription: 'free' },
  { username: 'retiredwizard', email: 'retiredwizard' + SEED_EMAIL_DOMAIN, bio: 'Slice of life with bite. Will write your retired wizard who runs a bookshop.', subscription: 'free' },
  { username: 'rainbeats', email: 'rainbeats' + SEED_EMAIL_DOMAIN, bio: 'Cyberpunk. Cops, runners, the people in between.', subscription: 'premium' },
];

// Map old → new username for the WORLDS / CHARACTERS / CAMPAIGNS / FRIENDSHIPS /
// WORLD_MEMBERS arrays below. This lets me change handles without rewriting
// every reference. (All the reference arrays use the OLD names; we translate.)
const HANDLE_MAP: Record<string, string> = {
  mara_calderon: 'hexpriestess',
  oliver_quist: 'collapseera',
  rin_takeda: 'glassbones',
  theodore_ash: 'wrongsideoftheright',
  priya_navarro: 'pixeltea',
  cole_winters: 'brokentech_22',
  isabela_drake: 'threeparagraphsmin',
  marcus_hale: 'twentiesnoir',
  nadia_reeve: 'slowburn_dread',
  samir_okafor: 'solarpunk_atx',
  eliza_voss: 'slowpoisongirl',
  jp_morales: 'wrenchgoblin',
  kira_lindqvist: 'felonyforlove',
  desmond_cho: 'conartistprep',
  aaliyah_freeman: 'mothbrain',
  nikolai_brandt: 'onelinerguy',
  beth_holloway: 'retiredwizard',
  ruben_vasquez: 'rainbeats',
};
const h = (oldName: string) => HANDLE_MAP[oldName] || oldName;

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
// CHARACTER CANON (history events)
// Each event reads as a snapshot — short, dated relative-feel, with an
// `impact` line that explains how it changed the character. These get
// rolled into character.history JSONB and feed the contradiction analyzer
// + chat AI prompts.
// ──────────────────────────────────────────────────────────────────────
interface CanonEvent {
  event: string;
  impact: string;
  date?: string; // ISO; optional
}
const CANON: Record<string, CanonEvent[]> = {
  'Cardinal Iohanna Vell': [
    { event: 'Lost her right arm in the casting at Saatren Bridge.', impact: 'Wears a silver replacement. Refuses to discuss the day.' },
    { event: 'Walked from the mountain seminary back to the Vale on foot, alone, over forty days.', impact: 'Returned thinner, harder, and unwilling to wear vestments again.' },
    { event: 'Refused the Aurelisi inquisitor\'s request for an audience.', impact: 'The seminary stopped sending her letters that month.' },
  ],
  'Brenn Two-Coat': [
    { event: 'Pulled a child alive from the burning river — third recorded survival in the order\'s history.', impact: 'Has not spoken about the child since. The child was four. Brenn was twenty-two.' },
    { event: 'Found her brother\'s coat folded on the riverbank a week after he drowned.', impact: 'Started wearing both coats. Has worn both ever since.' },
  ],
  'Fenrik of No House': [
    { event: 'Refused the order to burn the granary at Hael\'s Crossing.', impact: 'Walked away from his lance the next morning. Has not used his given name since.' },
    { event: 'Killed a Khelmri tracker sent to recover him, in the woods south of the river.', impact: 'Buried him under a cairn. Visits the cairn once a year.' },
  ],
  'Old Auntie Thessa': [
    { event: 'Resigned from the Aurelisi court mid-ceremony, walked out, and never returned.', impact: 'The reason was never recorded. The court does not speak of her.' },
    { event: 'Bought the bookshop above the stable in Greyburn for nine silver pieces.', impact: 'Has lived above it for forty-one years.' },
    { event: 'Turned a debtor named Marl into a cat for the duration of his unpaid balance.', impact: 'Marl, the cat, has lived in the shop for nineteen years and is showing no sign of changing back.' },
  ],
  'Archivist Wen Tobari': [
    { event: 'Tested into the Archivist track at thirty after a decade in hydroponics.', impact: 'The senior Archivists have not let it go. They sit Tobari at the end of the meeting table.' },
    { event: 'Identified the second of seven Section Four lower-deck door inscriptions.', impact: 'Earned third-rank. Was given a converted maintenance closet for an office.' },
    { event: 'Privately decoded one verb in the Section Four airlock inscription.', impact: 'Has not filed the paper. The verb is "to wake."' },
  ],
  'Reesha Ndovu': [
    { event: 'Spliced a failing reclaimer junction in twelve minutes during a 2087 outage.', impact: 'The Council noted it. She did not put in for the citation.' },
    { event: 'Refused a transfer to the upper-deck team three years running.', impact: 'Chief Engineer stopped offering. Reesha kept her shift.' },
  ],
  'Voice-Counselor Ade Okorie': [
    { event: 'Won the Section Twelve seat in his first run, three months ago.', impact: 'Inherited a backlog of 412 unread petitions. Has answered 308.' },
    { event: 'Refused a Helix Health lobbyist\'s lunch invitation.', impact: 'The lobbyist sent flowers anyway. Ade gave them to his neighbor.' },
  ],
  'Sheriff Maeve Doolan': [
    { event: 'Found her brother Tom alone at the edge of the state forest in October 1973.', impact: 'Tom never remembered what happened. Maeve never went into the forest after dark again.' },
    { event: 'Buried Tom in 1981 after his stroke at twenty-four.', impact: 'Took the deputy job that same year.' },
    { event: 'Closed the 1996 Halloween disappearance case as "inconclusive."', impact: 'Three of the missing came back. Two did not. She still drives past the woods on October 31.' },
  ],
  'Reverend Dale Marston': [
    { event: 'Came home from his second tour in 1971 and joined the seminary instead of finishing his degree.', impact: 'Has not spoken about either tour since.' },
    { event: 'Buried Mrs. Halverson in 1993; she came back to the church the following Sunday.', impact: 'Dale let her sit in the back pew. She left after the doxology.' },
    { event: 'Found a small wooden carving on the church steps three nights in a row.', impact: 'Has not told Maeve. He is going to. Soon.' },
  ],
  'Janelle Reyes': [
    { event: 'Started working Tuesdays and Fridays at the all-night diner.', impact: 'Pays her mother\'s rent in cash on Saturdays.' },
    { event: 'Saw the man at booth four for the first time at 3:14 a.m. on October 7, 1998.', impact: 'He left no money and there was no record on the camera. She watched the tape twice.' },
  ],
  'Donna Cellaria di March': [
    { event: 'First husband died in his sleep in 1864 — natural causes.', impact: 'The Court whispered. She did not respond.' },
    { event: 'Second husband, also a March, died in his sleep in 1871 — natural causes.', impact: 'The whispers stopped being whispers. She still did not respond.' },
    { event: 'Has hosted the same Thursday salon every week for nine years.', impact: 'Attendance is now considered a political signal.' },
  ],
  'Renzo of Five Names': [
    { event: 'Forged his first commercial bill of lading at twenty-two for a House Velli clerk.', impact: 'Clerk got the promotion. Renzo got a year of contracts.' },
    { event: 'Passed off a forged Vasilisi cardinal\'s seal for two months in 1907.', impact: 'No one realized. He realized he could keep going. He has been keeping going since.' },
  ],
  'Brother Vass': [
    { event: 'Joined the mendicant order at sixteen after a fire he refuses to discuss.', impact: 'The fire took something from him he has not named, even in confession.' },
    { event: 'Heard the confession of the woman who is now Duchess of South Vermilio.', impact: 'Has the letters she wrote him afterward. Has not read them. Keeps them in his bowl.' },
  ],
  'Detective Mei "Mai" Cheng': [
    { event: 'Brother killed in a wrong-address Helix Defense raid in 2084.', impact: 'Department closed the case in eleven days. Mei reopened her own copy and has worked it on her own time since.' },
    { event: 'Highest homicide clearance rate in district 18 for three consecutive years.', impact: 'Has not been promoted once.' },
  ],
  'Booker Tan': [
    { event: 'Bought out his Aozora subcontractor agreement after his shift partner died of "respiratory complications."', impact: 'Has not worked under contract since. Will not.' },
    { event: 'Took on the level-22 mechanic\'s twelve-year-old daughter when Helix raided the shop.', impact: 'She sleeps in the back office. He has not asked Cheng yet what to do with her.' },
  ],
  'Vex': [
    { event: 'First clean datalift from a Helix Defense black-net node, age 19.', impact: 'Made her name. The reputation has been earning her work since.' },
    { event: 'Sixth dive of the year left her left hand tremoring.', impact: 'Has not told her broker. Her broker has noticed.' },
  ],
  'Dr. Ines Albright': [
    { event: 'Defended her dissertation on pre-classical Etruscan loss-patterns.', impact: 'Won the department prize and three job offers. Took the worst-paying one.' },
    { event: 'Identified what may be a single verb in the 2019 pottery inscription.', impact: 'Has told no one. Keeps the notebook on her at all times now.' },
  ],
  'Walt Brennan': [
    { event: 'Closed his last Pinkerton case in November 1925.', impact: 'Will not describe the case to anyone, including the agency.' },
    { event: 'Took two private cases in 1927.', impact: 'Both ended quietly. Walt does not say how.' },
  ],
  'Yuki Hara': [
    { event: 'Released their first record at 19. Released their last record at 27.', impact: 'The label dropped them. They moved to Sapporo.' },
    { event: 'Three years and one month sober as of this morning.', impact: 'Has started writing again. The new songs are good. They are afraid of them.' },
  ],
};

// ──────────────────────────────────────────────────────────────────────
// CHARACTER RELATIONSHIPS
// Stored bidirectionally so each character page shows the link.
// ──────────────────────────────────────────────────────────────────────
interface RelSeed {
  a: string; // character name
  b: string;
  type: string; // 'ally', 'rival', 'mentor', etc.
  description?: string;
  strength?: number;
}
const RELATIONSHIPS: RelSeed[] = [
  // Sundered Vale
  { a: 'Cardinal Iohanna Vell', b: 'Old Auntie Thessa', type: 'rival', description: 'Old colleagues from the Aurelisi court. Each thinks the other should have left sooner.', strength: 70 },
  { a: 'Cardinal Iohanna Vell', b: 'Brenn Two-Coat', type: 'mentor', description: 'Iohanna has read futures in the river the way the keepers do. Brenn does not entirely trust this.', strength: 60 },
  { a: 'Brenn Two-Coat', b: 'Fenrik of No House', type: 'ally', description: 'They\'ve drunk together more than they\'ve talked. Both prefer it that way.', strength: 55 },
  { a: 'Old Auntie Thessa', b: 'Brenn Two-Coat', type: 'mentor', description: 'Thessa lets Brenn read at the shop on rainy days. Pretends not to notice when Brenn cries.', strength: 65 },

  // Helio-9
  { a: 'Archivist Wen Tobari', b: 'Reesha Ndovu', type: 'ally', description: 'Started talking when Tobari needed maintenance access to a sealed corridor. Now they meet for tea on Thursdays.', strength: 75 },
  { a: 'Voice-Counselor Ade Okorie', b: 'Reesha Ndovu', type: 'ally', description: 'Reesha\'s aunt was Ade\'s middle-school teacher. He still calls her ma\'am by accident.', strength: 60 },

  // Drowsing County
  { a: 'Sheriff Maeve Doolan', b: 'Reverend Dale Marston', type: 'ally', description: 'Two of the three people in the county who remember 1973 clearly. Each knows the other knows.', strength: 80 },
  { a: 'Sheriff Maeve Doolan', b: 'Janelle Reyes', type: 'ally', description: 'Maeve\'s late brother taught at Drowsing High. Maeve has known Janelle\'s mother for twenty years.', strength: 50 },
  { a: 'Reverend Dale Marston', b: 'Janelle Reyes', type: 'mentor', description: 'She comes by the church on Sunday afternoons. She doesn\'t pray. They don\'t talk about it.', strength: 55 },

  // Vermillion Court
  { a: 'Donna Cellaria di March', b: 'Renzo of Five Names', type: 'ally', description: 'Eight years of contracts, no betrayal yet. Both consider this an achievement.', strength: 70 },
  { a: 'Brother Vass', b: 'Donna Cellaria di March', type: 'rival', description: 'She has tried to recruit him three times. He has refused three times. Politely.', strength: 60 },
  { a: 'Renzo of Five Names', b: 'Brother Vass', type: 'ally', description: 'Renzo confesses to Vass once a month. Always honestly. Vass thinks this is its own kind of cleverness.', strength: 65 },

  // Neo-Taipei
  { a: 'Detective Mei "Mai" Cheng', b: 'Booker Tan', type: 'ally', description: 'They first met when Cheng questioned Booker about the dead mechanic. Both walked away thinking the other was straight.', strength: 70 },
  { a: 'Vex', b: 'Booker Tan', type: 'ally', description: 'Booker\'s broker is Vex\'s broker. They\'ve never worked a job together. Each thinks the other might say no.', strength: 50 },

  // Cross-world (vacuum char to a vacuum char)
  { a: 'Dr. Ines Albright', b: 'Walt Brennan', type: 'ally', description: 'Hired him after the office was disturbed. Already trusts him more than her supervisor.', strength: 60 },
];

// ──────────────────────────────────────────────────────────────────────
// FORUM POSTS + REPLIES
// Categories already exist on prod (General Discussion, Introductions,
// Character Workshop, World Building, Quest Board, Lore & Stories,
// Feature Requests, Bug Reports). We post into a few of them. Replies
// quote-feel like a real thread, not a brainstorm.
// ──────────────────────────────────────────────────────────────────────
interface ForumPostSeed {
  category: string; // exact category name
  author: string; // username (we'll map via h() if needed; pre-mapped here)
  title: string;
  content: string;
  daysAgo?: number;
  replies?: { author: string; content: string }[];
}
const FORUM_POSTS: ForumPostSeed[] = [
  {
    category: 'Introductions',
    author: 'mothbrain',
    title: 'New here, just trying to figure out where to put a character',
    content: 'Hey everyone. I\'ve been writing on smaller forums for a few years and just signed up. I\'ve got a 17-year-old waitress in a 90s horror setting and I\'m not sure if she belongs in a world that exists or if I should leave her in vacuum until I find one. What do most people do here?',
    daysAgo: 11,
    replies: [
      { author: 'slowburn_dread', content: 'Drowsing County (it\'s mine) might fit her. 90s horror, small-town, late-night diner energy. No pressure — but she sounds like she\'d work there. There\'s an active campaign too.' },
      { author: 'retiredwizard', content: 'I\'d say leave her in vacuum for the first couple of chats just so you get a sense of her voice. Easier to drop her into a world later than yank her out of the wrong one.' },
      { author: 'mothbrain', content: 'Both helpful, thanks. I\'ll try a couple of vacuum chats first and then look at Drowsing.' },
    ],
  },
  {
    category: 'World Building',
    author: 'pixeltea',
    title: 'How much lore is too much lore',
    content: 'I built Helio-9 over about three months and I keep going back and adding to the lore field. I\'m at 4,200 characters and I\'m worried I\'m overdoing it. The problem is the lore matters — characters in the world reference it. But I don\'t want anyone reading my world page and bouncing because it\'s a wall of text.\n\nDoes anyone split lore into tabs / collapsibles? Is there a length where new players just close the tab?',
    daysAgo: 8,
    replies: [
      { author: 'hexpriestess', content: 'I\'ve been GMing for ten years and the answer I\'ve landed on is: write everything you want for yourself, but only put the first 600-800 chars on the world page. The rest goes into a separate "World History" doc you link from the description. Players who want it find it. Players who don\'t aren\'t scared off.' },
      { author: 'collapseera', content: 'Hard agree with hex. I went the other way once — full 6000-char lore dump on the world page — and the world had like one new join in two months. Cut it down to a paragraph and four bullet points and joins doubled.' },
      { author: 'pixeltea', content: 'Okay this is helpful. I\'ll try cutting to 800 and moving the rest to a doc. Will report back.' },
      { author: 'onelinerguy', content: 'Bullet points are doing god\'s work in worldbuilding. Tells you the texture without reading like a wikipedia article.' },
    ],
  },
  {
    category: 'Character Workshop',
    author: 'glassbones',
    title: 'How do you write a character whose biggest enemy is themselves without making them a wet blanket',
    content: 'Title is the problem. Every time I write self-destructive characters they end up being the kind of person nobody at the table wants to chat with. I want them to be the difficult one without being miserable to interact with.\n\nWhat\'s working for people?',
    daysAgo: 6,
    replies: [
      { author: 'felonyforlove', content: 'Give them a thing they\'re actively trying for, even if they\'re sabotaging it. The drive matters more than the doom. Otherwise they\'re just sad at people.' },
      { author: 'twentiesnoir', content: 'Humor. Self-aware humor specifically. The character can know they\'re a wreck and still make jokes about it. Walt does this constantly and I think it\'s why people chat with him.' },
      { author: 'glassbones', content: 'Both of these are good. The drive thing especially — Yuki has the writing-again arc but I haven\'t been making it active enough in chats. They\'re too "in the past" and not "trying to make something now."' },
      { author: 'hexpriestess', content: 'Self-aware humor + active goal + at least one person they\'d actually pick up the phone for. If you can\'t answer that last one, they\'re too isolated.' },
    ],
  },
  {
    category: 'Quest Board',
    author: 'slowpoisongirl',
    title: 'Looking for one more character for The Six-Year Election',
    content: 'Vermillion Court campaign, draft status, four players in. Looking for one more — ideally a character with reason to be at court but not aligned with any of the Twelve Houses. Spies, scribes, foreign envoys, mendicants who hear too much, that kind of role.\n\nThe campaign premise is set; we\'re running it as a slow-burn intrigue piece. Long-form preferred. DM me if interested.',
    daysAgo: 4,
    replies: [
      { author: 'glassbones', content: 'Dropped you a friend request. I have a Sapporo musician who does not at all fit the brief but I have a foreign envoy concept that might.' },
      { author: 'conartistprep', content: 'Renzo is in this one. Looking forward to it.' },
      { author: 'slowpoisongirl', content: 'Hexpriestess is in too. Two slots left actually now that I count.' },
    ],
  },
  {
    category: 'Lore & Stories',
    author: 'rainbeats',
    title: '[Excerpt] What happens when you let a corp own your filtration contract',
    content: 'Pulled from a chat between Booker and a level-9 walkup that I want to share — the corp dialogue specifically. Not the whole chat, just the bit about what Aozora did to the air on level 7. Curious if it lands the same out of context.\n\n---\n\n"You know how Aozora sells the contract. They tell you every apartment gets the same filter spec. That\'s true. The spec is the same. The maintenance schedule isn\'t. Level 22 gets a swap every six months. Level 7 gets one every fourteen. By the end of fourteen months that filter is doing nothing. You\'re breathing through a piece of cardboard. Ask me how I know."\n\n---\n\nWriting Booker\'s anger has been a project. Most of the time he hides it. This one moment I let him not hide it. Still figuring out the rhythm.',
    daysAgo: 3,
    replies: [
      { author: 'collapseera', content: 'Lands. The "ask me how I know" closer is doing real work. You don\'t need the rest of the chat for that to hit.' },
      { author: 'wrenchgoblin', content: 'Booker is one of my favorite characters on the platform, full stop. The way you write trade-talk anger is so good.' },
      { author: 'mothbrain', content: 'The maintenance-schedule detail is what sells it. Specific enough that you trust the world.' },
    ],
  },
  {
    category: 'Feature Requests',
    author: 'threeparagraphsmin',
    title: 'Per-chat speaking-style override',
    content: 'Loving the speaking-style picker but I want to override it per chat sometimes. Vex talks differently to Booker than she talks to a mark. Right now I have to go change her style in the editor before each chat which is a lot of clicks.\n\nWould a "for this chat only" override field work?',
    daysAgo: 2,
    replies: [
      { author: 'pixeltea', content: 'Tobari does this too. Speaks differently around Reesha than around the senior Archivists. I\'d use this.' },
      { author: 'hexpriestess', content: 'Seconding. Although: in my experience, if a character\'s speaking style genuinely changes around a specific person, that\'s worth capturing as a relationship note rather than a per-chat override. The relationship description can include "speaks more openly with X."' },
      { author: 'threeparagraphsmin', content: 'That\'s a fair point. Would still want both.' },
    ],
  },
  {
    category: 'General Discussion',
    author: 'wrongsideoftheright',
    title: 'When does a chat actually deserve to be canon',
    content: 'I keep almost-requesting canon and then not. The chat felt good when we wrote it but in the morning I look back and it\'s just two people having a conversation. Nothing changed. No vow, no fight, no decision.\n\nAm I being too strict about what counts? What\'s the bar for the rest of you?',
    daysAgo: 1,
    replies: [
      { author: 'hexpriestess', content: 'My rule is: if removing this chat from canon would make any future chat not make sense, it\'s canon. If both characters could keep going as if it never happened, leave it out.' },
      { author: 'glassbones', content: 'Agree with hex. Conversations can be great without being canon. It\'s a preservation thing, not a quality bar.' },
      { author: 'slowburn_dread', content: 'I\'ll add: the snapshot feature is good for the "almost canon" stuff. Lets you mark a moment without committing the whole conversation. I\'ve been using it more lately.' },
    ],
  },
];
// ──────────────────────────────────────────────────────────────────────
// WORLD BIBLES
// Each world gets a hand-authored Bible (sections of deep lore). World
// creators can edit / add / reorder these in /worlds/:id/bible/edit.
// Sections are stored as JSONB on worlds.bible.
// ──────────────────────────────────────────────────────────────────────
interface BibleSection {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  body: string;
}

const BIBLES: Record<string, BibleSection[]> = {
  'The Sundered Vale': [
    {
      id: 'overview', icon: '🌍', title: 'Overview',
      blurb: 'A borderland nobody owns and the river that won\'t stop burning.',
      body: `The Sundered Vale is a stretch of contested borderland between two dying empires — Aurelis to the north and the Khelmri Princes to the south. Sixty years ago a magical attempt to unmake a god failed at the Vale's central river, and the river caught fire. The flame doesn't consume, doesn't warm; it simply burns, day and night, summer and winter.

The Vale's towns answer to the river-keepers, a loose mendicant order that pulls the dead from the burning water. Both empires claim the Vale. Neither can collect taxes there. Most adventurers in the Vale are deserters, debt-runaways, or sons no one will inherit.`,
    },
    {
      id: 'history', icon: '📜', title: 'History',
      blurb: 'The fire and what came before.',
      body: `Before the Sundering, the Vale was an Aurelisi tributary state, a quiet stretch of farmland and forge-villages along the Vass river. The Khelmri raided it for grain. The Aurelisi held it for the same reason. It changed hands a dozen times in two centuries.

In the year 743 by the Aurelisi count, Mage-Cardinal Olvar attempted a working at Saatren Bridge meant to bind a hostile war-god out of mortal reach forever. The working failed. The river caught fire that night. Olvar died standing. His apprentice survived with the loss of her right arm — Cardinal Iohanna Vell, then twenty-three years old.

Both empires withdrew their administrators within a year. Tax collectors stopped coming. The river-keepers, who had been a small almsgiving order, took up the burden of pulling the dead from the burning water and have done so ever since. They do not call themselves priests. They do not accept donations larger than a meal.`,
    },
    {
      id: 'geography', icon: '🗺️', title: 'Geography',
      blurb: 'Towns, the river, the things between them.',
      body: `The Vale runs roughly seventy miles east-to-west along the Vass river. North bank: Aurelisi farmland giving way to forest. South bank: Khelmri grasslands giving way to badlands. Neither bank is safe after dark in the lower Vale.

GREYBURN-ON-VALE — the largest town, perhaps four hundred souls. Mixed Aurelisi-Khelmri population, the only place in the Vale that holds a market. Auntie Thessa's bookshop sits above the stable on the north end of the high street.

THE BURNING RIVER — the Vass itself, lit end to end. Cold to the touch despite the flame. Fish still live in it, swim through the fire as if it isn't there. The river-keepers' main station sits at the old Saatren Bridge, mid-vale.

THE EAST WOODS — uncut forest above the upper Vale. Khelmri deserters favor it. So does at least one thing the deserters won't talk about.

HAEL'S CROSSING — a fortified granary three days east of Greyburn, abandoned after the orders that broke Fenrik. Now used by smugglers and the occasional river-keeper.`,
    },
    {
      id: 'factions', icon: '⚔️', title: 'Factions',
      blurb: 'Who runs what, where they meet.',
      body: `THE RIVER-KEEPERS — the closest thing the Vale has to authority. Pull bodies from the river. Read futures in the way they float. Take in orphans. Carry no titles. Brenn Two-Coat is one.

THE AURELISI INQUEST — when the crown wants something done in the Vale they send an inquisitor with two clerks and a writ. Inquests rarely find what they came for. They sometimes don't return.

THE KHELMRI PRINCES — three brothers ruling the southern grasslands. Officially they claim the Vale. Practically, they raid the lower Vale once a year and pretend the rest doesn't exist.

THE BURNED — what people call those who have spent too long near the river. Quieter than they were before. Thinner. They don't all stay sane. River-keepers watch them. Sometimes they take them in.`,
    },
    {
      id: 'magic', icon: '✨', title: 'Magic',
      blurb: 'Pact-based, borrowed, with interest.',
      body: `All magic in the Vale is pact-based. The caster borrows power from a source — a god, a place, an older mage's residue, the river itself — and must return what they took, sometimes with interest. Wizards age oddly: some run backwards a few years; some go grey in a season; one, the river-keepers say, never aged at all and now lives in a cottage past Greyburn that no road reaches.

DECLARED PACTS are required of any character claiming magical ability. Most caster-deserters in the Vale carry an unpaid debt; this is part of what makes them dangerous and part of what makes them useful.

UNDECLARED MAGIC — using a borrowed source without a pact — is rare and considered suicidal. The source eventually notices. There is no recorded case of an undeclared mage living past forty.`,
    },
    {
      id: 'glossary', icon: '📖', title: 'Glossary',
      blurb: 'Names, terms, titles.',
      body: `AURELIS — the northern empire. Capital: Aurelisis. Currently ruled by a regency council; the heir is fourteen.

BURNED, THE — those marked by long exposure to the river's flame.

CARDINAL — high-rank priest-mage of the Aurelisi Church. Iohanna was one. She is not technically defrocked; the Church has simply stopped writing.

HOUSE — Khelmri nobility. There are nine Houses, of which three are royal.

KEEPER — short for river-keeper.

LANCE — Khelmri military unit, ~200 mounted soldiers under a sergeant. Fenrik was sergeant of the Third Lance.

PACT — magical agreement to borrow power from a source.

VALE, THE — the Sundered Vale. Always "the Vale," never just "Vale."

VASS — the burning river, named after a forgotten god.`,
    },
  ],

  'Helio-9': [
    {
      id: 'overview', icon: '🌍', title: 'Overview',
      blurb: 'A station nobody built that nobody can leave.',
      body: `Helio-9 is a hollowed asteroid in solar orbit. Nobody knows who hollowed it. The first human colonists arrived in 2287 to find air, water reclamation, and a working hydroponics deck — running on systems they could not read, in a language they could not translate.

Two hundred years later, eleven generations deep, the city is home to roughly forty thousand people. The original alien systems still hum behind every wall. There are still locked doors. The Concord — three rotating councils — governs what the people of Helio-9 do. It does not govern what Helio-9 itself is doing.`,
    },
    {
      id: 'history', icon: '📜', title: 'History',
      blurb: 'From discovery to now.',
      body: `2287 — First Concord expedition arrives at the asteroid designated Helio-9 (the ninth in a series of solar-orbital surveys). Expected to spend six months mapping a dead rock. Finds, instead, a hollow-cored station with operational life support, gravity, and an unmistakable artificial atmosphere. Reports back to Earth and is told to stay.

2294 — Hydroponics Deck declared self-sustaining. Population: 612.

2317 — First Section Four readings. The lower deck airlock that does not open begins emitting heat signatures on a sixty-year cycle. The Archivists log it and move on.

2410 — Last confirmed communication with Earth. After this date, no transmissions either way are received. The Concord declares "communications quiet" rather than "communications lost." The distinction is debated.

2461 — The Doorless Year. Section Four heat signatures spike for six months and stop. Engineering finds a previously unmapped corridor. The Concord seals it. The seal holds.

2087 — present (current Concord year): population ~40,000. Three rotating councils — Engineers, Archivists, Voice. Section Four is making sound for the first time in twenty-six years.`,
    },
    {
      id: 'sections', icon: '🗺️', title: 'The Decks',
      blurb: 'How the station is laid out.',
      body: `Helio-9 is laid out in vertical "decks" running along the asteroid's hollow core. There are 22 deck levels, numbered from the inner core outward.

DECKS 1–4 (THE CORE) — life support, hydroponics, water reclamation. Reesha Ndovu's grandmother helped build the splice that connected human plumbing to the original systems. Most maintenance lives here. Outsiders rarely visit.

DECKS 5–10 (LOWER) — residential, artisan workshops, the Voice's outer offices. Section Twelve, where Ade Okorie was elected, is on Deck 7.

DECKS 11–17 (UPPER) — government, the main Archive, Concord council chambers. Tobari's converted closet office is on Deck 13.

DECKS 18–22 (RIM) — observation bays, traffic control, hangar. The view of empty sky.

SECTION FOUR — not a deck. A region of original alien construction sealed behind one of seven inscribed doors. The longest-standing mystery on the station. The inscription over its airlock has resisted translation for two hundred years.`,
    },
    {
      id: 'councils', icon: '⚖️', title: 'The Three Councils',
      blurb: 'How Helio-9 governs itself.',
      body: `THE ENGINEERS — keep the lights on. Elected from the maintenance and construction trades. Six-year terms. Power to override Voice decisions on matters of station integrity. The most respected and least liked of the three councils.

THE ARCHIVISTS — try to read the bones. Selected, not elected, through a competitive testing track. Lifetime appointment unless they choose to step down. They control which alien systems are studied, which are flagged dangerous, which are sealed. Tobari is third-rank.

THE VOICE — everyone else. Elected from each of the 22 sections, two representatives per section. Two-year terms. Handles civilian disputes, petitions, contracts, the small business of living. Its junior counselors get the section nobody else wants. Ade Okorie has Section Twelve.

The three councils meet jointly twice a year. Decisions require majority within each council, not majority overall. This means any one council can stall the station's politics indefinitely. They have. Twice.`,
    },
    {
      id: 'glossary', icon: '📖', title: 'Glossary',
      blurb: 'Common terms aboard the station.',
      body: `THE BONES — what Archivists call the original alien construction.

CONCORD — the unified government of Helio-9. Often used to mean "the three councils together."

HUM — the constant background sound of the station's reclaimers. Locals tune it out. Visitors find it unsettling.

INSCRIBED DOOR — one of seven sealed entrances to original alien construction. Each bears writing in a different unreadable language.

OUTSIDE — Earth, theoretically. Used skeptically. "Did you hear from Outside?" is a joke.

RUNNER — unofficial courier moving small things between decks. Not illegal but not regulated.

SCRAP-HANDED — slang for an Engineer. Affectionate or dismissive depending on tone.

SECTION — a residential subdivision. Each Deck holds two to three sections.

WAKER — slang term that has, in the last week, started circulating in the maintenance corridors. Origin unclear.`,
    },
  ],

  'Drowsing County': [
    {
      id: 'overview', icon: '🌍', title: 'Overview',
      blurb: 'A small Massachusetts county that used to make paper.',
      body: `Drowsing County, Massachusetts. Four towns — Drowsing, First Drowsing (the older one), Halverton, and Greenmill — wrapped around the dying remains of the Halverton Paper Company. The mill closed in 1994 and the population has been slipping ever since. There's a community college, a hospital with one wing locked since 1981, three high schools, and a state forest that locals don't enter after dark.

The official population is 14,200. The Sheriff's office estimates the unofficial number is closer to 13,400 and falling.`,
    },
    {
      id: 'history', icon: '📜', title: 'History',
      blurb: 'What happened, what people will and won\'t say.',
      body: `The county was settled in 1722 by Halverton mill workers fleeing Boston. The mill ran for two hundred and seventy-two years. It closed in 1994, three decades after pulp prices made New England paper noncompetitive.

1973 — Something happened in the state forest. Eleven people went in over the course of October. Three came back. Of those three, one was Tom Doolan, who survived but never remembered what happened to the friends he went in with. The official report calls it a "search-and-rescue training failure" and seals further details. No one outside the Sheriff's office accepts this.

1981 — Tom Doolan dies of stroke at twenty-four. His sister Maeve, then twenty, becomes a deputy that summer.

1988 — Maeve elected Sheriff. She has been Sheriff continuously since.

1996 — Three Drowsing High students miss the Halloween dance. Two are eventually found. One is not. The case is closed "inconclusive."

1998 — Three more Drowsing High students go missing in October. Devin Walsh and two others. The state police give up after eight days.`,
    },
    {
      id: 'geography', icon: '🗺️', title: 'Geography',
      blurb: 'The four towns and the woods between them.',
      body: `DROWSING (the main town) — population 6,200. The diner is here. So is the Sheriff's office, the high school, the supermarket. Reverend Marston's First Methodist sits on the south end of Main Street.

FIRST DROWSING — population 1,800. Older, smaller, weirder. Most of the houses are pre-1900. The community college campus sits at its edge.

HALVERTON — population 4,400. The mill town. Now mostly empty mill buildings and the people who refuse to leave them.

GREENMILL — population 1,800. Farmland. Quietest of the four. Locals say the woods press closer here.

THE STATE FOREST — 18,000 acres of mixed hardwood, threading through all four towns. Maintained by the state but practically abandoned. Camping is permitted. Camping is rare. The trailheads have signs that have been there since 1974, and the signs still say what they said in 1974.`,
    },
    {
      id: 'rules', icon: '🌑', title: 'How Things Work Here',
      blurb: 'The unwritten rules.',
      body: `Drowsing horror is ambiguous, slow, and observational. Characters don't cast spells. They notice things. They feel cold rooms. They see someone who shouldn't be there.

THE FOREST — don't go in after dark. Locals know this. Visitors are told once and then not told again.

THE DEAD — sometimes come back. They don't always know. They are not zombies; they are confused. The Reverend has a quiet practice of letting them sit in the back pew.

THE CAMERAS — sometimes don't record what you saw. The diner's camera is the most reliable in town. The hospital's are the least.

THE OCTOBER PEOPLE — what locals call the men who appear in the diner, the post office, the road shoulder, in October. They never speak. They never cause trouble. Maeve has seen the same one four times in twenty years.

NEW PEOPLE — outsiders. Treated kindly. Watched.`,
    },
    {
      id: 'glossary', icon: '📖', title: 'Glossary',
      blurb: 'Drowsing-specific terms.',
      body: `THE DINER — Hank's All-Night Diner, on Route 38 just outside Drowsing. The only place in the county open from 11 PM to 5 AM. Janelle works the late shift here.

THE FOREST — always "the forest" or "the state forest," never just "the woods" outside Drowsing. The distinction matters to locals.

GREYS — what locals occasionally call the October People. Not a slur; just a name. Origin unclear.

OCTOBER — capitalized when locals talk about it. Not a season — a phenomenon.

THE PEW — the back-left pew of First Methodist. Reverend Marston leaves it open. Newcomers who sit in it are quietly redirected.

QUEUE TIMES — the diner's slang for the hours between 3 and 4 AM, when "queue" means the line of October People at the counter, on the rare occasions they form one.`,
    },
  ],

  'The Vermillion Court': [
    {
      id: 'overview', icon: '🌍', title: 'Overview',
      blurb: 'A small principality with very long memories.',
      body: `Vermilio is a Renaissance-coded city-state on the southern Mediterranean coast, large enough to mint its own coin, small enough to be run by twelve noble Houses and one elected ruler. The Doge serves a six-year term. No Doge in the last eighty years has finished theirs alive of natural causes.

The Court runs on patronage. Poets, painters, spies, and assassins move from House to House every season. The common people of Vermilio — bakers, dockworkers, scribes — pretend not to notice. They live longer that way.`,
    },
    {
      id: 'history', icon: '📜', title: 'History',
      blurb: 'The founding, the Doges, the long quiet.',
      body: `Vermilio was founded in 1238 as a trade station between Aragon and the Sublime Porte. By 1311 it had its first elected Doge and twelve recognized Houses. The early Doges ruled for life and were, by all accounts, mostly competent.

The first poisoning happened in 1408. The Doge of the day, Albertus the Younger, died at table during the Feast of Lanterns. The widow, Donna Estelle of House Velli, became the first regent-Doge — the only woman to hold the office in the Court's history. She ruled six years and three days, then declined a second term and retired to a country estate where she lived to 91. The poisoning was never officially solved. The Court treated it, afterward, as an accident.

Between 1408 and now, of forty-six elected Doges, only nine have died of natural causes. The poisoning rate accelerated dramatically after 1822 and has held steady since. The Court considers this normal. The common people of Vermilio do not discuss it.`,
    },
    {
      id: 'houses', icon: '👑', title: 'The Twelve Houses',
      blurb: 'Who they are, who they hate.',
      body: `HOUSE MARCH — one of the four founding Houses. Currently led by Donna Cellaria di March. Strong in shipping, banking, and the grain trade. Two recent Doges have come from this House. Both died.

HOUSE VELLI — also founding. Older blood than March, less money. Specialty: legal practice, court records. Velli scribes copy every legal document in Vermilio. They know everything. They never say.

HOUSE DELACROIX — French-blooded, Aragonese-bound. Holds the Court's printing license. Quiet, polite, capable of anything.

HOUSE CARRARA — controls quarrying and most of the city's stone. Builders. Stoneworkers. The least poison-inclined of the Houses, which is sometimes its own problem.

HOUSE TANNEHILL — northern blood. Theologians, occasionally heretics. The current Bishop of Vermilio is a Tannehill cousin.

(Seven more Houses exist; details vary by year.)

ALL HOUSES are sworn to the Doge. None of them mean it.`,
    },
    {
      id: 'court_etiquette', icon: '🎭', title: 'Court Etiquette',
      blurb: 'The unwritten rules everyone is expected to know.',
      body: `THE THURSDAY SALONS — every major House holds one. Attendance is a political signal. Donna Cellaria's is currently the most attended.

THE FAN — used in court. A closed fan held against the chin means "I have nothing to add." A fan opened slowly during another speaker means "I disagree." A snapped-shut fan means "and I will say so later." This is taken seriously.

THE WINE — never drink wine you did not see poured. Polite hosts, when serving a guest from a sealed bottle, will drink first. Less polite hosts have less polite reasons.

THE DUEL — formally illegal. Practically conducted in the southern villas, where the Doge's Watch does not patrol. Most Court duels are over poetry, not blood.

POISON — considered an art. Crude poisoning is scorned. Subtle poisoning is admired. There is a respected guild of physicians, half of whom were trained as poisoners.`,
    },
    {
      id: 'glossary', icon: '📖', title: 'Glossary',
      blurb: 'Common Court terms.',
      body: `THE COURT — when capitalized, refers to the political body of the Twelve Houses + the Doge's office. When lowercased, refers to the physical Doge's Court building.

DOGE — elected ruler of Vermilio. Six-year term. Address as "Most Serene."

HOUSE — one of the Twelve noble families. Capitalized in formal use.

LANTERN FEAST — annual midsummer feast hosted by the sitting Doge. Largest social event of the year. Highest historical poisoning rate of any night.

PATRON — head of a House. Female: Donna. Male: Don.

SALON — a House's regular gathering. Thursday by tradition.

THE WATCH — the Doge's personal guard. Distinct from the city watch. Smaller. More feared.

THE WHEEL — the political phrase for an entire six-year Doge term. "We're a year into the wheel" means a year into the current Doge.`,
    },
  ],

  'Neo-Taipei 2089': [
    {
      id: 'overview', icon: '🌍', title: 'Overview',
      blurb: 'A drowned city that grew up instead of out.',
      body: `Taipei drowned in 2061. The new city was rebuilt as forty-six vertical districts stacked along the original mountain spine, with the lower levels permanently flooded and the upper levels permanently above the rain. The four big keiretsu — Shenzhou-Kobe, Aozora Health, the Jade Cooperative, and Helix Defense — hold most of the patents that keep people alive. Citizenship is a subscription.

It rains nine months of the year. By the time the rain reaches level twelve, it has fallen through three floors of plumbing.`,
    },
    {
      id: 'history', icon: '📜', title: 'History',
      blurb: 'How we got vertical.',
      body: `2034 — First seawall completed. Holds for twenty-six years.
2058 — Seawall begins to fail.
2061 — Storm Yuhua. Seawall collapses overnight. Lower Taipei floods to a depth of forty meters. Forty-one thousand confirmed dead. The "Yuhua Refugees" — survivors who refused to evacuate — establish the first permanent floating settlements over the drowned city.
2063 — Reconstruction Authority forms. Vertical-build code adopted.
2071 — First fully vertical district complete (now: District 1).
2089 (present) — Forty-six districts. The four keiretsu effectively replace the previous government for purposes of utilities, healthcare, transit, and security.

The Reconstruction Authority still technically exists. It meets quarterly. Nothing is decided.`,
    },
    {
      id: 'levels', icon: '🗺️', title: 'The Levels',
      blurb: 'How the city is layered.',
      body: `LEVELS 1–6 (UNDERSTACK) — the drowned old city. Mostly flooded. Pumps, salvage operations, smugglers, and the people who don't show up in registries. Police don't patrol below level 4. They claim it's "logistically impossible." The actual reason is more pragmatic.

LEVELS 7–12 (LOWER) — the working levels. Mechanics, fab shops, runners, late-night noodle stands. Booker's shop is on level 22 but he came up from 7 — like most level-22 mechanics did. The air filters here are notoriously corp-grade.

LEVELS 13–22 (MID) — middle-class. Apartments. Schools. The kind of office most office workers see. Rain is a feature here, not an emergency.

LEVELS 23–35 (UPPER) — keiretsu offices. Doctors. Lawyers. The kind of restaurants you don't find by walking past them.

LEVELS 36–46 (CANOPY) — corporate executive housing. The clouds that the lower levels see are the canopy levels' weather. People who live here don't take the elevators down without a reason.`,
    },
    {
      id: 'corps', icon: '🏛️', title: 'The Four Keiretsu',
      blurb: 'Who actually runs the city.',
      body: `SHENZHOU-KOBE — broad industrial conglomerate. Builds most of the city's infrastructure. Controls the elevators. Famously slow about repairs in lower districts.

AOZORA HEALTH — medical patents and pharmaceuticals. Holds the licenses on most of the cybernetic surgical procedures used outside the black clinics. Their air-filter division killed Booker's shift partner, although you cannot prove this in a Vermilio — sorry, in a Neo-Taipei court.

THE JADE COOPERATIVE — financial and information services. Owns most of the city's data infrastructure. Net-runners like Vex specialize in pulling things out of Jade systems without Jade noticing.

HELIX DEFENSE — security, both private and contracted-to-state. The closest thing to a police force above level 4. Their no-knock raids are legally protected. Detective Cheng has lost two case overturns to Helix corporate counsel.

The four keiretsu cooperate at an executive level and compete viciously at every level below. This is not an accident.`,
    },
    {
      id: 'glossary', icon: '📖', title: 'Glossary',
      blurb: 'Neo-Taipei street terms.',
      body: `BLACK-NET — restricted corporate networks. Helix Defense black-net is the most secure.

CANOPY — the upper-most levels (36+). Slang.

CHROME — slang for cybernetic enhancements. "He's all chrome" means heavily augmented.

DIVE — a net-running session. Causes neurological strain at depth. "Six dives this year" is a lot.

ELEVATOR LIFE — slang for someone who works on a level above where they live. Common.

HANDLER — the registered human responsible for an AI assistant. Required for any class-3 AI in city limits.

KEIRETSU — Japanese loanword. Refers to the four big corp groups.

NO-KNOCK — Helix Defense's signature entry style. Currently legal.

RUNNER — anyone who moves things (data, drugs, bodies) between levels. Subscription model varies.

UNDERSTACK — levels 1–6, the flooded levels. Slang.

YUHUA — the storm of 2061. Used as a date marker. "Pre-Yuhua" / "post-Yuhua."`,
    },
  ],
};
// ──────────────────────────────────────────────────────────────────────
// PUBLIC CHATS
// Short hand-authored exchanges between two characters. Each one stays in
// character voice — Sheriff Doolan sounds like Doolan, Vex sounds like Vex.
// Kept short (8-12 messages) so they read as a slice rather than a saga.
// ──────────────────────────────────────────────────────────────────────
interface PublicChat {
  title: string;
  characters: [string, string]; // character names from CHARACTERS above
  world?: string;
  messages: { from: 'A' | 'B'; text: string }[];
}

const PUBLIC_CHATS: PublicChat[] = [
  {
    title: 'The Diner, 4 AM',
    characters: ['Sheriff Maeve Doolan', 'Reverend Dale Marston'],
    world: 'Drowsing County',
    messages: [
      { from: 'A', text: 'Coffee\'s burnt again. Janelle\'s shift?' },
      { from: 'B', text: 'She\'s in the back. I think she\'s been crying.' },
      { from: 'A', text: 'You ask her?' },
      { from: 'B', text: 'No. She doesn\'t want me to. I respect that.' },
      { from: 'A', text: 'You see anyone come in tonight?' },
      { from: 'B', text: 'A man in booth four. Black coffee. He didn\'t drink it. He didn\'t leave money.' },
      { from: 'A', text: 'Did he look at you?' },
      { from: 'B', text: 'He looked at the door. Like he was waiting on someone.' },
      { from: 'A', text: 'Yeah. I know that one. He was there when Tom went in.' },
      { from: 'B', text: 'Maeve.' },
      { from: 'A', text: 'I know, Dale. I know.' },
    ],
  },
  {
    title: 'Below the Hydroponics Deck',
    characters: ['Archivist Wen Tobari', 'Reesha Ndovu'],
    world: 'Helio-9',
    messages: [
      { from: 'A', text: 'You said the temperature went up four degrees. In a week?' },
      { from: 'B', text: 'Four point one. The sensors haven\'t flagged because the trend is gradual.' },
      { from: 'A', text: 'Has it ever changed before?' },
      { from: 'B', text: 'Not in my grandmother\'s logs. Not in mine.' },
      { from: 'A', text: 'I think the inscription is a warning, not a name.' },
      { from: 'B', text: 'A warning about what.' },
      { from: 'A', text: 'I have one verb so far. The verb is "to wake."' },
      { from: 'B', text: '...' },
      { from: 'B', text: 'Tobari, do not file that paper. Not yet.' },
      { from: 'A', text: 'I was going to ask you the same thing.' },
    ],
  },
  {
    title: 'The Rain at the Cart',
    characters: ['Detective Mei "Mai" Cheng', 'Booker Tan'],
    world: 'Neo-Taipei 2089',
    messages: [
      { from: 'A', text: 'You knew him twelve years.' },
      { from: 'B', text: 'Yeah.' },
      { from: 'A', text: 'And you\'re telling me he wasn\'t doing unlicensed work.' },
      { from: 'B', text: 'I\'m telling you he wouldn\'t. He had a daughter. He paid his license fees. I helped him with the paperwork in February.' },
      { from: 'A', text: 'Helix says the raid was clean.' },
      { from: 'B', text: 'Helix says a lot of things.' },
      { from: 'A', text: 'The girl. Where is she now.' },
      { from: 'B', text: 'In the back of my shop. She brought his ledger.' },
      { from: 'A', text: 'Show me the ledger, Booker.' },
      { from: 'B', text: 'You sure?' },
      { from: 'A', text: 'My brother\'s case is the reason I\'m sure.' },
    ],
  },
  {
    title: 'The Bookshop Above the Stable',
    characters: ['Cardinal Iohanna Vell', 'Old Auntie Thessa'],
    world: 'The Sundered Vale',
    messages: [
      { from: 'B', text: 'You walk like the Cardinal you used to be.' },
      { from: 'A', text: 'I\'m not the Cardinal I used to be.' },
      { from: 'B', text: 'I know. I\'m saying it shows.' },
      { from: 'A', text: 'I came for the almanac. Not commentary.' },
      { from: 'B', text: 'The almanac is on the third shelf. The commentary is free.' },
      { from: 'A', text: 'Thessa.' },
      { from: 'B', text: 'Iohanna. The river is up two feet this month.' },
      { from: 'A', text: 'I noticed.' },
      { from: 'B', text: 'You came down to the bridge last night. I watched.' },
      { from: 'A', text: 'I was looking for someone.' },
      { from: 'B', text: 'Did you find him.' },
      { from: 'A', text: 'I never do.' },
    ],
  },
  {
    title: 'Salon, Late Thursday',
    characters: ['Donna Cellaria di March', 'Renzo of Five Names'],
    world: 'The Vermillion Court',
    messages: [
      { from: 'A', text: 'You\'re late, Renzo.' },
      { from: 'B', text: 'I was at three salons before this one, Donna.' },
      { from: 'A', text: 'And whose work were you doing at the others?' },
      { from: 'B', text: 'Yours, mostly. The Velli think they hired me but the handwriting is yours.' },
      { from: 'A', text: 'Good. And the third client?' },
      { from: 'B', text: 'I don\'t know yet. The pay is in old coin. The handwriting on the contract is something I haven\'t seen before.' },
      { from: 'A', text: 'Bring me the contract.' },
      { from: 'B', text: 'I can\'t. It was retrieved this afternoon.' },
      { from: 'A', text: 'By whom.' },
      { from: 'B', text: 'A boy. Twelve, maybe thirteen. He took it back and left.' },
      { from: 'A', text: 'That\'s how it starts. Stay close, Renzo.' },
    ],
  },
  {
    title: 'The Translation, Late',
    characters: ['Dr. Ines Albright', 'Walt Brennan'],
    messages: [
      { from: 'A', text: 'I\'m sorry to write so late. Your name was given to me by a colleague.' },
      { from: 'B', text: 'Don\'t apologize. What\'s the matter, Doctor?' },
      { from: 'A', text: 'Someone\'s been in my office. Nothing was taken. The notebook was moved.' },
      { from: 'B', text: 'Which notebook.' },
      { from: 'A', text: 'The one with the translation work. The pottery inscription.' },
      { from: 'B', text: 'You sure it was moved? Not just shifted?' },
      { from: 'A', text: 'I keep it under a paperweight. The paperweight was set down on the desk afterward, not put back.' },
      { from: 'B', text: 'Anyone else have a key.' },
      { from: 'A', text: 'My supervisor. Two grad students. The night cleaner.' },
      { from: 'B', text: 'I\'ll come by Wednesday morning. Don\'t move anything else. And keep the notebook on you.' },
      { from: 'A', text: 'Thank you. Really.' },
      { from: 'B', text: 'Don\'t thank me yet.' },
    ],
  },
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
    await query(`DELETE FROM users WHERE id = $1`, [u.id]); // CASCADE handles characters/worlds/messages
  }
  console.log(`  removed ${oldUsers.rows.length} prior seed users`);

  // CASCADE on the user delete leaves orphaned conversations (no FK to users
  // on the conversations table, only via participants). Clean any conversation
  // that no longer has any participants — safe and bounded.
  const orphanCleanup = await query(
    `DELETE FROM conversations
      WHERE NOT EXISTS (
        SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = conversations.id
      )
      RETURNING id`
  );
  if (orphanCleanup.rows.length > 0) {
    console.log(`  removed ${orphanCleanup.rows.length} orphaned conversations`);
  }

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

  // Insert worlds (with Bible if we have one for the world)
  const worldIds: Record<string, string> = {};
  let bibleSectionsAdded = 0;
  for (const w of WORLDS) {
    const bible = BIBLES[w.name] || [];
    const r = await query(
      `INSERT INTO worlds (creator_id, name, description, lore, rules, setting, is_public, is_nsfw, member_count, bible)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, 1, $7)
       RETURNING id`,
      [userIds[h(w.creator)], w.name, w.description, w.lore, JSON.stringify(w.rules), w.setting, JSON.stringify(bible)]
    );
    worldIds[w.name] = r.rows[0].id;
    bibleSectionsAdded += bible.length;
    // Creator becomes WorldMaster
    await query(
      `INSERT INTO world_members (world_id, user_id, is_worldmaster) VALUES ($1, $2, true)`,
      [r.rows[0].id, userIds[h(w.creator)]]
    );
  }
  console.log(`✓ ${WORLDS.length} worlds (${bibleSectionsAdded} bible sections)`);

  // Insert characters and remember their IDs by name (for public chats below).
  const characterIds: Record<string, string> = {};
  const characterCreators: Record<string, string> = {}; // name → user id (for conv_participants)
  for (const c of CHARACTERS) {
    const personality = {
      traits: c.traits,
      values: c.values,
      flaws: c.flaws,
      speaking_style: c.speaking_style,
    };
    const r = await query(
      `INSERT INTO characters
        (creator_id, name, description, personality, background,
         likes, dislikes, world_id, is_public, is_nsfw, is_ai_enabled, tags,
         chat_count, like_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false, true, $9, $10, $11)
       RETURNING id`,
      [
        userIds[h(c.creator)], c.name, c.description,
        JSON.stringify(personality), c.background,
        JSON.stringify(c.likes), JSON.stringify(c.dislikes),
        c.world ? worldIds[c.world] : null,
        c.tags, c.chat_count || 0, c.like_count || 0,
      ]
    );
    characterIds[c.name] = r.rows[0].id;
    characterCreators[c.name] = userIds[h(c.creator)];
  }
  console.log(`✓ ${CHARACTERS.length} characters`);

  // World memberships (extras beyond creator)
  for (const m of WORLD_MEMBERS) {
    try {
      await query(
        `INSERT INTO world_members (world_id, user_id, is_worldmaster) VALUES ($1, $2, false)
         ON CONFLICT DO NOTHING`,
        [worldIds[m.world], userIds[h(m.user)]]
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
        worldIds[camp.world], userIds[h(camp.creator)],
        camp.name, camp.description, camp.premise,
        camp.status || 'draft',
      ]
    );
  }
  console.log(`✓ ${CAMPAIGNS.length} campaigns`);

  // Friendships (accepted)
  let friendshipsAdded = 0;
  for (const [a, b] of FRIENDSHIPS) {
    const ua = userIds[h(a)];
    const ub = userIds[h(b)];
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

  // Public chats — short hand-authored conversations between seed characters.
  // Each is_public=true with mutual consent already granted. Goes into
  // /explore/public-chats so first-time visitors have something to read.
  let chatsAdded = 0;
  let messagesAdded = 0;
  for (const chat of PUBLIC_CHATS) {
    const charA = characterIds[chat.characters[0]];
    const charB = characterIds[chat.characters[1]];
    if (!charA || !charB) {
      console.warn(`  skipped public chat (missing character): ${chat.title}`);
      continue;
    }
    const userA = characterCreators[chat.characters[0]];
    const userB = characterCreators[chat.characters[1]];
    const worldId = chat.world ? worldIds[chat.world] : null;
    const context = chat.world ? 'within_world' : 'vacuum';

    const conv = await query(
      `INSERT INTO conversations
        (context, world_id, title, is_active, chat_mode, is_public)
       VALUES ($1, $2, $3, false, 'live', true)
       RETURNING id`,
      [context, worldId, chat.title]
    );
    const convId = conv.rows[0].id;

    await query(
      `INSERT INTO conversation_participants (conversation_id, character_id, user_id) VALUES ($1, $2, $3)`,
      [convId, charA, userA]
    );
    await query(
      `INSERT INTO conversation_participants (conversation_id, character_id, user_id) VALUES ($1, $2, $3)`,
      [convId, charB, userB]
    );

    // Stagger message timestamps two minutes apart so they read like a real
    // conversation instead of all-at-once.
    let baseTime = Date.now() - chat.messages.length * 2 * 60 * 1000;
    for (const m of chat.messages) {
      const charId = m.from === 'A' ? charA : charB;
      const userId = m.from === 'A' ? userA : userB;
      await query(
        `INSERT INTO messages
          (conversation_id, sender_character_id, sender_user_id, sender_type, content, created_at)
         VALUES ($1, $2, $3, 'user', $4, $5)`,
        [convId, charId, userId, m.text, new Date(baseTime).toISOString()]
      );
      baseTime += 2 * 60 * 1000;
      messagesAdded++;
    }

    // Update conversation timestamp + chat_count on each character
    await query(`UPDATE conversations SET updated_at = $1 WHERE id = $2`, [new Date(baseTime).toISOString(), convId]);
    await query(`UPDATE characters SET chat_count = chat_count + 1 WHERE id = $1 OR id = $2`, [charA, charB]);
    chatsAdded++;
  }
  console.log(`✓ ${chatsAdded} public chats (${messagesAdded} messages)`);

  // Character canon (history) — write events as a JSONB array on each row.
  // The contradiction analyzer reads this; chat AI prompts read this too.
  let canonAdded = 0;
  for (const [name, events] of Object.entries(CANON)) {
    const charId = characterIds[name];
    if (!charId) continue;
    // Stamp each event with a relative date if missing — backwards from now,
    // 30 days apart, so they read as a real timeline rather than all-today.
    const stamped = events.map((e, i) => ({
      ...e,
      date: e.date || new Date(Date.now() - (events.length - i) * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    await query(
      `UPDATE characters SET history = $1 WHERE id = $2`,
      [JSON.stringify(stamped), charId]
    );
    canonAdded += events.length;
  }
  console.log(`✓ ${canonAdded} canon events across ${Object.keys(CANON).length} characters`);

  // Character relationships — bidirectional. We insert both (A→B) and (B→A)
  // so each character page renders the link.
  let relsAdded = 0;
  for (const r of RELATIONSHIPS) {
    const idA = characterIds[r.a];
    const idB = characterIds[r.b];
    if (!idA || !idB) continue;
    try {
      await query(
        `INSERT INTO character_relationships (character_id, related_character_id, relationship_type, description, strength)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [idA, idB, r.type, r.description || null, r.strength ?? 50]
      );
      await query(
        `INSERT INTO character_relationships (character_id, related_character_id, relationship_type, description, strength)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [idB, idA, r.type, r.description || null, r.strength ?? 50]
      );
      relsAdded += 2;
    } catch (e: any) {
      console.warn(`  skipped relationship ${r.a} ↔ ${r.b}: ${e?.message}`);
    }
  }
  console.log(`✓ ${relsAdded} relationship rows`);

  // Forum posts + replies. Categories already exist on prod (preseeded).
  // We look them up by name and skip any post whose category isn't found.
  const catRows = await query(`SELECT id, name FROM forum_categories`);
  const catIds: Record<string, string> = {};
  for (const c of catRows.rows) catIds[c.name] = c.id;

  let postsAdded = 0;
  let repliesAdded = 0;
  for (const p of FORUM_POSTS) {
    const catId = catIds[p.category];
    const authorId = userIds[p.author];
    if (!catId || !authorId) {
      console.warn(`  skipped forum post "${p.title}" (missing category/author)`);
      continue;
    }
    const createdAt = new Date(Date.now() - (p.daysAgo || 1) * 24 * 60 * 60 * 1000).toISOString();
    const post = await query(
      `INSERT INTO forum_posts (category_id, author_id, title, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id`,
      [catId, authorId, p.title, p.content, createdAt]
    );
    const postId = post.rows[0].id;
    postsAdded++;

    // Replies — stagger 4–8 hours apart starting from the post timestamp.
    let replyTime = new Date(createdAt).getTime() + 4 * 60 * 60 * 1000;
    for (const r of p.replies || []) {
      const replyAuthorId = userIds[r.author];
      if (!replyAuthorId) continue;
      await query(
        `INSERT INTO forum_replies (post_id, author_id, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [postId, replyAuthorId, r.content, new Date(replyTime).toISOString()]
      );
      replyTime += (4 + Math.random() * 4) * 60 * 60 * 1000;
      repliesAdded++;
    }
    // Update post.reply_count
    await query(
      `UPDATE forum_posts SET reply_count = $1 WHERE id = $2`,
      [p.replies?.length || 0, postId]
    );
    // Bump post updated_at to the latest reply for sensible sort order
    if (p.replies && p.replies.length > 0) {
      await query(
        `UPDATE forum_posts SET updated_at = $1 WHERE id = $2`,
        [new Date(replyTime - (4 + Math.random() * 4) * 60 * 60 * 1000).toISOString(), postId]
      );
    }
  }
  console.log(`✓ ${postsAdded} forum posts (${repliesAdded} replies)`);

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
