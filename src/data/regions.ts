// Регионы, этапы карты, события, магазин.

export type StageKind = 'town' | 'battle' | 'elite' | 'event' | 'camp' | 'boss';

export interface Stage {
  kind: StageKind;
  name: string;
  enemies?: string[];
  event?: string;
  /** Кто присоединяется после прохождения этапа (или при входе в город). */
  join?: string;
  /** Реплика при присоединении. */
  joinText?: string;
}

export interface Region {
  id: number; name: string; work: string; color: string; bg: string | null;
  intro: string; outro: string;
  pool: string[];
  bounty: { enemy: string; count: number };
  stages: Stage[];
}

const S = (kind: StageKind, name: string, extra: Partial<Stage> = {}): Stage => ({ kind, name, ...extra });

export const START_HEROES = ['aqua', 'darkness', 'megumin'];

export const REGIONS: Region[] = [
  {
    id: 1, name: 'Аксель', work: 'Коносуба', color: '#5f8f4a', bg: 'world/forest_path',
    intro: 'Город новичков-искателей. В гильдии висит задание на гигантских жаб, а у старого замка поселился генерал Короля демонов.',
    outro: 'Бельдия повержен. Гильдия выплатила награду — и тут же вычла за разрушенную стену.',
    pool: ['toad', 'cabbage', 'goblin', 'goblin_shaman', 'undead_knight'],
    bounty: { enemy: 'toad', count: 5 },
    stages: [
      S('town', 'Аксель'),
      S('battle', 'Жабы на равнине', { enemies: ['toad', 'toad'] }),
      S('battle', 'Капустный урожай', { enemies: ['cabbage', 'cabbage', 'cabbage', 'cabbage'] }),
      S('battle', 'Гоблинья пещера', { enemies: ['goblin', 'goblin', 'goblin_shaman', 'goblin'], join: 'gs', joinText: 'У входа — гора гоблинских трупов. Из темноты выходит рыцарь в помятом шлеме: «Гоблины? Я с вами».' }),
      S('camp', 'Привал у реки'),
      S('event', 'Храм Аксис', { event: 'axis' }),
      S('battle', 'Тропа к замку', { enemies: ['undead_knight', 'undead_knight', 'goblin'] }),
      S('elite', 'Ворота замка', { enemies: ['undead_knight', 'undead_knight', 'undead_knight'] }),
      S('boss', 'Бельдия', { enemies: ['undead_knight', 'beldia'] }),
    ],
  },
  {
    id: 2, name: 'Подземелье', work: 'Подземелье вкусностей', color: '#6a5a4a', bg: 'world/dungeon',
    intro: 'Подземелье под островом. Где-то на нижних этажах — Красный дракон. Деньги на еду кончились, так что есть придётся монстров.',
    outro: 'Красный дракон повержен. Сэнши уже точит нож: из дракона выйдет много блюд.',
    pool: ['walking_mushroom', 'mandrake', 'slime', 'living_armor', 'basilisk'],
    bounty: { enemy: 'slime', count: 5 },
    stages: [
      S('town', 'Деревня у входа', { join: 'marcille', joinText: 'Эльфийка с посохом: «Я Марсиль. Только, чур, монстров я есть не буду!»' }),
      S('battle', 'Грибной зал', { enemies: ['walking_mushroom', 'walking_mushroom', 'mandrake'] }),
      S('event', 'Котёл у костра', { event: 'senshi', join: 'senshi', joinText: 'Бородатый гном помешивает суп: «Сэнши. Готовлю монстров уже десять лет. Садитесь есть».' }),
      S('battle', 'Затопленный коридор', { enemies: ['slime', 'slime', 'walking_mushroom'] }),
      S('battle', 'Зал доспехов', { enemies: ['living_armor', 'living_armor'] }),
      S('camp', 'Тихая ниша'),
      S('battle', 'Гнездо василиска', { enemies: ['basilisk', 'mandrake', 'mandrake'] }),
      S('elite', 'Стража нижних этажей', { enemies: ['living_armor', 'basilisk', 'living_armor'] }),
      S('boss', 'Красный дракон', { enemies: ['red_dragon'] }),
    ],
  },
  {
    id: 3, name: 'Королевство Клевер', work: 'Чёрный клевер', color: '#3f5f3f', bg: 'world/clover',
    intro: 'Культ Полуночного солнца нападает на королевство, а за ним стоят демоны и Тёмная триада.',
    outro: 'Данте отступил. Чёрные быки, как всегда, устроили праздник и разнесли базу.',
    pool: ['midnight_mage', 'elf', 'low_demon'],
    bounty: { enemy: 'midnight_mage', count: 6 },
    stages: [
      S('town', 'База Чёрных быков', { join: 'asta', joinText: 'Парень с огромным чёрным мечом: «Я Аста! Я стану Королём магов!»' }),
      S('battle', 'Засада культа', { enemies: ['midnight_mage', 'midnight_mage'] }),
      S('battle', 'Призыв', { enemies: ['midnight_mage', 'low_demon', 'midnight_mage'] }),
      S('event', 'Курилка капитана', { event: 'yami', join: 'yami', joinText: 'Ями закуривает: «Превзойди свои пределы. Прямо здесь и сейчас».' }),
      S('battle', 'Эльфы', { enemies: ['elf', 'elf', 'midnight_mage'] }),
      S('camp', 'Лес'),
      S('elite', 'Демонические врата', { enemies: ['low_demon', 'elf', 'low_demon'] }),
      S('boss', 'Данте Зогратис', { enemies: ['midnight_mage', 'dante'] }),
    ],
  },
  {
    id: 4, name: 'Северные земли', work: 'Провожающая в последний путь Фрирен', color: '#6f7f8f', bg: 'world/north',
    intro: 'Северные земли полны демонов. В замке у реки Аура Гильотина держит армию безголовых.',
    outro: 'Аура взвесила свою ману — и проиграла. «Сама себе голову отрубай».',
    pool: ['demon_mage', 'mimic', 'headless'],
    bounty: { enemy: 'demon_mage', count: 6 },
    stages: [
      S('town', 'Северная деревня', { join: 'fern', joinText: 'Девушка в фиолетовом молча кланяется: «Ферн. Фрирен-сама проспала, так что я пойду с вами».' }),
      S('battle', 'Говорящие демоны', { enemies: ['demon_mage', 'demon_mage'] }),
      S('event', 'Сундук в руинах', { event: 'mimic' }),
      S('battle', 'Деревня под ударом', { enemies: ['headless', 'headless', 'demon_mage'], join: 'stark', joinText: 'Парень с топором дрожит, но не отходит от раненых: «Я Старк. Я… не убегу».' }),
      S('camp', 'Мельница'),
      S('battle', 'Дорога к замку', { enemies: ['mimic', 'demon_mage', 'headless'] }),
      S('elite', 'Три ученика', { enemies: ['demon_mage', 'demon_mage', 'demon_mage'] }),
      S('boss', 'Аура Гильотина', { enemies: ['headless', 'aura', 'headless'] }),
    ],
  },
  {
    id: 5, name: 'Британия', work: 'Семь смертных грехов', color: '#7f6a4a', bg: 'world/britannia',
    intro: 'Королевство захвачено. Десять заповедей вернулись, а Семь грехов собираются снова.',
    outro: 'Эстаросса отброшен. В «Кабаньей шляпе» снова наливают.',
    pool: ['holy_knight', 'red_demon', 'grey_demon'],
    bounty: { enemy: 'holy_knight', count: 6 },
    stages: [
      S('town', 'Таверна «Кабанья шляпа»', { join: 'meliodas', joinText: 'Хозяин таверны: «Мелиодас. Эль не пейте — он ужасный. А вот драться я умею».' }),
      S('battle', 'Патруль', { enemies: ['holy_knight', 'holy_knight'] }),
      S('battle', 'Тюрьма Баастон', { enemies: ['red_demon', 'holy_knight'], join: 'ban', joinText: 'Из камеры, зевая, выходит седой бессмертный: «Бан. Капитан, долго же ты»' }),
      S('event', 'Ярмарка', { event: 'fair' }),
      S('battle', 'Демоны у стен', { enemies: ['grey_demon', 'red_demon'] }),
      S('camp', 'Полдень у костра', { join: 'escanor', joinText: 'В полдень в лагерь входит огромный силач: «Кто решил, что я присоединяюсь? Я, Эсканор!»' }),
      S('elite', 'Демонический лагерь', { enemies: ['red_demon', 'grey_demon', 'red_demon'] }),
      S('boss', 'Эстаросса', { enemies: ['estarossa'] }),
    ],
  },
  {
    id: 6, name: 'Шангри-Ла', work: 'Шангри-Ла Фронтир', color: '#4a7f7f', bg: 'world/shangrila',
    intro: 'Виртуальный мир «Шангри-Ла Фронтир». В древней гробнице спит уникальный монстр.',
    outro: 'Везермон пал. Уникальный сценарий пройден — Санраку орёт в маску от счастья.',
    pool: ['skeleton', 'tomb_spirit', 'night_wolf'],
    bounty: { enemy: 'night_wolf', count: 6 },
    stages: [
      S('town', 'Третья Ремия', { join: 'sunraku', joinText: 'Полуголый парень в птичьей маске: «Санраку. Я тут за уникальным сценарием, пошли».' }),
      S('battle', 'Ночная охота', { enemies: ['night_wolf', 'night_wolf'] }),
      S('battle', 'Склеп', { enemies: ['skeleton', 'skeleton', 'tomb_spirit'] }),
      S('event', 'Случайное событие', { event: 'glitch' }),
      S('battle', 'Зал духов', { enemies: ['tomb_spirit', 'tomb_spirit', 'skeleton'] }),
      S('camp', 'Точка сохранения'),
      S('elite', 'Стая и стража', { enemies: ['night_wolf', 'skeleton', 'night_wolf', 'tomb_spirit'] }),
      S('boss', 'Везермон', { enemies: ['weathermon'] }),
    ],
  },
  {
    id: 7, name: 'Демонический континент', work: 'Реинкарнация безработного', color: '#7f4a4a', bg: 'world/demon_continent',
    intro: 'Опасный континент, где всё хочет тебя съесть. Где-то бродит Бог-Дракон Орстед.',
    outro: 'Орстед отступил — впервые за много петель. «Интересно…»',
    pool: ['acid_wolf', 'great_tortoise', 'demon_snake'],
    bounty: { enemy: 'acid_wolf', count: 6 },
    stages: [
      S('town', 'Деревня мигурдов', { join: 'roxy', joinText: 'Маленькая синеволосая волшебница: «Рокси Мигурдия. Я учу магии… и иногда сама учусь».' }),
      S('battle', 'Стая', { enemies: ['acid_wolf', 'acid_wolf', 'acid_wolf'], join: 'rudeus', joinText: 'Молодой маг кланяется Рокси до земли: «Учитель! Рудеус Грейрат, к вашим услугам».' }),
      S('battle', 'Болото', { enemies: ['great_tortoise', 'demon_snake'] }),
      S('event', 'Лагерь искателей', { event: 'sylphy', join: 'sylphy', joinText: 'Девушка с белыми волосами: «Рудеус? Это я, Сильфи! Я тоже пойду».' }),
      S('battle', 'Змеиный овраг', { enemies: ['demon_snake', 'demon_snake', 'acid_wolf'] }),
      S('camp', 'Скальный навес'),
      S('elite', 'Тропа зверей', { enemies: ['great_tortoise', 'acid_wolf', 'acid_wolf', 'demon_snake'] }),
      S('boss', 'Орстед', { enemies: ['orsted'] }),
    ],
  },
  {
    id: 8, name: 'Гранд Лайн', work: 'Ван-Пис', color: '#3f6f9f', bg: 'world/grand_line',
    intro: 'Опаснейшее море мира. В пустынной Алабасте хозяйничает Крокодайл.',
    outro: 'Над Алабастой пошёл дождь. Крокодайл повержен.',
    pool: ['pirate', 'marine', 'sea_king'],
    bounty: { enemy: 'pirate', count: 6 },
    stages: [
      S('town', 'Логтаун', { join: 'luffy', joinText: 'Парень в соломенной шляпе: «Я Луффи! Я стану Королём пиратов! Будешь в моей команде?»' }),
      S('battle', 'Пираты Багги', { enemies: ['pirate', 'pirate', 'pirate'] }),
      S('battle', 'База дозора', { enemies: ['marine', 'marine', 'pirate'], join: 'zoro', joinText: 'Мечник с тремя мечами отвязывается от столба: «Зоро. Ладно, пойду с тобой, капитан».' }),
      S('event', 'Барати', { event: 'baratie', join: 'sanji', joinText: 'Повар в чёрном костюме: «Санджи. Леди, позвольте вас угостить… а вы, мужики, сами себе готовьте».' }),
      S('battle', 'Облава', { enemies: ['marine', 'marine', 'marine'] }),
      S('camp', 'Палуба'),
      S('elite', 'Морской король', { enemies: ['sea_king'] }),
      S('boss', 'Крокодайл', { enemies: ['crocodile'] }),
    ],
  },
  {
    id: 9, name: 'Аместрис', work: 'Стальной алхимик', color: '#8f6f3f', bg: 'world/amestris',
    intro: 'Страна алхимии. Гомункулы плетут заговор, а химеры бродят по окраинам.',
    outro: 'Похоть рассыпалась. Остались лишь красные камни.',
    pool: ['chimera', 'mannequin', 'gluttony'],
    bounty: { enemy: 'chimera', count: 5 },
    stages: [
      S('town', 'Ризенбург', { join: 'edward', joinText: 'Невысокий парень в красном плаще хлопает ладонями: «Эдвард Элрик. И не называй меня мелким!»' }),
      S('battle', 'Химеры Такера', { enemies: ['chimera', 'chimera'] }),
      S('battle', 'Подземный город', { enemies: ['mannequin', 'mannequin', 'mannequin'] }),
      S('event', 'Библиотека', { event: 'library' }),
      S('elite', 'Обжорство', { enemies: ['gluttony'] }),
      S('camp', 'Вагон поезда'),
      S('battle', 'Лаборатория 5', { enemies: ['chimera', 'mannequin', 'mannequin', 'chimera'] }),
      S('boss', 'Похоть', { enemies: ['lust'] }),
    ],
  },
  {
    id: 10, name: 'Лондон', work: 'Хеллсинг', color: '#5f3f4f', bg: 'world/london',
    intro: 'Ночной Лондон. «Миллениум» начал войну, улицы полны гулей.',
    outro: 'Рип ван Винкль больше не поёт. Алукард смеётся в темноте.',
    pool: ['ghoul', 'vamp_soldier'],
    bounty: { enemy: 'ghoul', count: 8 },
    stages: [
      S('town', 'Особняк Хеллсинг', { join: 'alucard', joinText: 'Вампир в красном шляпой касается полей: «Алукард. Приказ — уничтожить. С удовольствием».' }),
      S('battle', 'Улица гулей', { enemies: ['ghoul', 'ghoul', 'ghoul'] }),
      S('battle', 'Десант', { enemies: ['vamp_soldier', 'ghoul', 'ghoul'] }),
      S('event', 'Ватикан', { event: 'vatican' }),
      S('battle', 'Площадь', { enemies: ['vamp_soldier', 'vamp_soldier'] }),
      S('camp', 'Подвал'),
      S('elite', 'Батальон', { enemies: ['vamp_soldier', 'vamp_soldier', 'ghoul', 'ghoul'] }),
      S('boss', 'Рип ван Винкль', { enemies: ['ghoul', 'rip', 'ghoul'] }),
    ],
  },
  {
    id: 11, name: 'Мидланд', work: 'Берсерк', color: '#4f3f3f', bg: 'world/midland',
    intro: 'Мрачный Мидланд. По ночам приходят духи, а апостолы правят городами.',
    outro: 'Зодд улетел, хохоча: «Ещё встретимся, мечник».',
    pool: ['evil_spirit', 'troll', 'apostle'],
    bounty: { enemy: 'troll', count: 5 },
    stages: [
      S('town', 'Деревня Годо', { join: 'guts', joinText: 'Огромный мечник с железной рукой: «Гатс. Не стойте рядом ночью».' }),
      S('battle', 'Ночь духов', { enemies: ['evil_spirit', 'evil_spirit', 'evil_spirit'] }),
      S('battle', 'Тролли', { enemies: ['troll', 'troll'] }),
      S('event', 'Ведьма', { event: 'witch' }),
      S('battle', 'Апостол', { enemies: ['apostle', 'evil_spirit'] }),
      S('camp', 'Пещера'),
      S('elite', 'Город апостолов', { enemies: ['apostle', 'troll', 'apostle'] }),
      S('boss', 'Бессмертный Зодд', { enemies: ['zodd'] }),
    ],
  },
  {
    id: 12, name: 'Поверхность', work: 'Гуррен-Лаганн', color: '#6f5f3f', bg: 'world/surface',
    intro: 'Люди наконец выбрались из-под земли. Наверху — зверолюди и их ганмэны.',
    outro: 'Дай-Гандзан захвачен. Небо пробито. Кто, по-твоему, мы такие?!',
    pool: ['beastman', 'gunmen'],
    bounty: { enemy: 'gunmen', count: 5 },
    stages: [
      S('town', 'Деревня Джиха', { join: 'kamina', joinText: 'Парень в очках-звёздах: «Кто, по-твоему, я такой?! Камина!»' }),
      S('battle', 'Зверолюди', { enemies: ['beastman', 'beastman', 'beastman'] }),
      S('battle', 'Первый ганмэн', { enemies: ['gunmen', 'beastman'] }),
      S('event', 'Трофейный ганмэн', { event: 'gunmen' }),
      S('battle', 'Два ганмэна', { enemies: ['gunmen', 'gunmen'] }),
      S('camp', 'Бивак'),
      S('elite', 'Отряд Тимильфа', { enemies: ['gunmen', 'beastman', 'gunmen', 'beastman'] }),
      S('boss', 'Тимильф', { enemies: ['gunmen', 'thymilph'] }),
    ],
  },
];

// ---------- События ----------

export type Effect =
  | { k: 'heal'; v: number }
  | { k: 'hurt'; v: number }
  | { k: 'gold'; v: number }
  | { k: 'item'; id: string; n: number }
  | { k: 'xp'; v: number }
  | { k: 'fight'; enemies: string[] }
  | { k: 'chance'; p: number; ok: Effect[]; fail: Effect[]; okText: string; failText: string };

export interface EventOption { label: string; text: string; fx: Effect[]; cost?: number }
export interface GameEvent { title: string; text: string; options: EventOption[] }

export const EVENTS: Record<string, GameEvent> = {
  axis: {
    title: 'Храм Аксис', text: 'Последователи Аксис раздают листовки и предлагают вступить в культ. Аква сияет от гордости.',
    options: [
      { label: 'Пожертвовать 30 золота', cost: 30, text: 'Аква благословляет отряд. Здоровье восстановлено.', fx: [{ k: 'heal', v: 1 }] },
      { label: 'Взять листовку и уйти', text: 'В листовке завёрнуто зелье. Странные люди.', fx: [{ k: 'item', id: 'potion', n: 1 }] },
    ],
  },
  senshi: {
    title: 'Котёл у костра', text: 'Гном варит что-то из ходячих грибов. Пахнет… неплохо.',
    options: [
      { label: 'Поесть', text: 'Вкусно! Отряд сыт и бодр.', fx: [{ k: 'heal', v: 0.5 }, { k: 'xp', v: 20 }] },
    ],
  },
  yami: {
    title: 'Курилка капитана', text: 'Ями предлагает спарринг «для разогрева».',
    options: [
      { label: 'Сразиться', text: 'Больно, но поучительно.', fx: [{ k: 'hurt', v: 0.3 }, { k: 'xp', v: 40 }] },
      { label: 'Вежливо отказаться', text: 'Ями пожимает плечами и даёт денег на рамен.', fx: [{ k: 'gold', v: 30 }] },
    ],
  },
  mimic: {
    title: 'Сундук в руинах', text: 'Посреди зала стоит сундук. Подозрительно красивый.',
    options: [
      { label: 'Открыть', text: '', fx: [{ k: 'chance', p: 0.5, ok: [{ k: 'gold', v: 60 }, { k: 'item', id: 'ether', n: 1 }], fail: [{ k: 'fight', enemies: ['mimic'] }], okText: 'Внутри золото и эликсир!', failText: 'Это мимик! Он кусается!' }] },
      { label: 'Обойти', text: 'Фрирен бы открыла. Но её здесь нет.', fx: [] },
    ],
  },
  fair: {
    title: 'Ярмарка', text: 'На ярмарке соревнование: вытащить меч из камня.',
    options: [
      { label: 'Попробовать (20 золота)', cost: 20, text: '', fx: [{ k: 'chance', p: 0.4, ok: [{ k: 'gold', v: 100 }], fail: [], okText: 'Меч поддался! Приз — 100 золота.', failText: 'Меч не шелохнулся. Мелиодас смеётся.' }] },
      { label: 'Купить еды', cost: 15, text: 'Отряд подкрепился.', fx: [{ k: 'heal', v: 0.4 }] },
    ],
  },
  glitch: {
    title: 'Случайное событие', text: 'Перед отрядом мерцает баг: монстр застрял в текстурах.',
    options: [
      { label: 'Абузить баг', text: 'Опыт капает сам собой.', fx: [{ k: 'xp', v: 50 }] },
      { label: 'Обыскать', text: 'Под текстурой лежит лут.', fx: [{ k: 'item', id: 'bomb', n: 2 }] },
    ],
  },
  sylphy: {
    title: 'Лагерь искателей', text: 'У костра сидят искатели. Одна из них очень пристально смотрит на Рудеуса.',
    options: [{ label: 'Подсесть', text: 'Старые друзья встретились.', fx: [{ k: 'heal', v: 0.5 }] }],
  },
  baratie: {
    title: 'Плавучий ресторан «Барати»', text: 'Повара тут дерутся не хуже пиратов. И кормят бесплатно голодных.',
    options: [
      { label: 'Пообедать', text: 'Лучший обед на всех морях.', fx: [{ k: 'heal', v: 1 }] },
      { label: 'Помыть посуду за еду', text: 'Шеф Зефф доволен. Держите на дорогу.', fx: [{ k: 'item', id: 'potion', n: 2 }] },
    ],
  },
  library: {
    title: 'Центральная библиотека', text: 'Записи о философском камне спрятаны в кулинарной книге.',
    options: [
      { label: 'Расшифровать', text: 'Ночь без сна, но отряд понял, как устроены гомункулы.', fx: [{ k: 'xp', v: 60 }] },
      { label: 'Продать редкие книги', text: 'Неплохо заплатили.', fx: [{ k: 'gold', v: 80 }] },
    ],
  },
  vatican: {
    title: 'Тринадцатый отдел', text: 'Отец Андерсон преграждает путь, но враг общий — «Миллениум».',
    options: [
      { label: 'Временный союз', text: 'Андерсон отдаёт освящённые клинки — пригодятся.', fx: [{ k: 'item', id: 'bomb', n: 2 }] },
      { label: 'Подраться', text: 'Регенерация у него как у Алукарда. Пришлось отступить.', fx: [{ k: 'hurt', v: 0.3 }, { k: 'xp', v: 80 }] },
    ],
  },
  witch: {
    title: 'Ведьма из леса', text: 'Маленькая ведьма предлагает защитные амулеты.',
    options: [
      { label: 'Взять амулеты', text: 'Свитки защиты пригодятся ночью.', fx: [{ k: 'item', id: 'scroll', n: 2 }] },
      { label: 'Попросить лечение', text: 'Травы ведьмы творят чудеса.', fx: [{ k: 'heal', v: 1 }] },
    ],
  },
  gunmen: {
    title: 'Трофейный ганмэн', text: 'Брошенный ганмэн стоит у скалы. Камина уже залез внутрь.',
    options: [
      { label: 'Разобрать на детали', text: 'Продали детали торговцам.', fx: [{ k: 'gold', v: 120 }] },
      { label: 'Покататься', text: '«Это мой Гуррен!» Опыт за безрассудство.', fx: [{ k: 'xp', v: 80 }] },
    ],
  },
};

// ---------- Магазин и кузница ----------

export const SHOP: { id: string; name: string; price: number; desc: string }[] = [
  { id: 'potion', name: 'Зелье лечения', price: 25, desc: 'Лечит 40% здоровья в бою.' },
  { id: 'ether', name: 'Эликсир маны', price: 30, desc: 'Половина маны или энергии.' },
  { id: 'bomb', name: 'Бомба', price: 45, desc: 'Огонь по всем врагам.' },
  { id: 'scroll', name: 'Свиток защиты', price: 60, desc: 'Щит всему отряду.' },
  { id: 'phoenix', name: 'Перо феникса', price: 90, desc: 'Поднимает павшего с 40%.' },
];
export const ITEM_MAX = 9;
export const FORGE_MAX = 10;
export const priceMul = (region: number) => 1 + 0.3 * (region - 1);
export const forgeCost = (lvl: number) => 40 * (lvl + 1) * (lvl + 1);
