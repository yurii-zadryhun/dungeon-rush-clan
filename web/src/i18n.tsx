import React from 'react';

export type Locale = 'uk' | 'en';

const en = {
  appTitle: 'Clan War Archive',
  mergeComplete: 'Players merged. All war rankings have been recalculated.',
  mergeConfirm:
    'Merge {old} into {correct}? This transfers past wars and removes the incorrect identity.',
  mergeAccountWarning: 'Both identities have accounts. Resolve account ownership before merging.',
  keepIncorrectScores: 'Keep incorrect player’s scores',
  keepCorrectScores: 'Keep correct player’s scores',
  mergeConflictChoice: 'Resolve duplicate war scores',
  mergeOverlap: 'Both players appear in {count} of the same wars. Choose which scores to retain.',
  warsCount: '{count} wars',
  selectPlayer: 'Search players…',
  correctPlayer: 'Correct player',
  incorrectPlayer: 'Incorrect player',
  mergeHelp:
    'Choose the incorrectly recognized player first, then the correct existing identity. The old player’s scores and war history will move to the correct player.',
  mergePlayers: 'Merge duplicate players',
  loading: 'Loading...',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  back: 'Back',
  create: 'Create',
  done: 'Done',
  add: 'Add',
  remove: 'Remove',
  copied: 'Copied!',
  username: 'In-game name',
  password: 'Password',
  setupToken: 'Setup token',
  login: 'Sign in',
  logout: 'Sign out',
  setupTitle: 'Create owner account',
  invitationTitle: 'Join the clan',
  invitationFor: 'Invitation for {name}',
  invitationInvalid: 'This invitation is unavailable.',
  createAccount: 'Create account',
  pleaseWait: 'Please wait...',
  language: 'Language',
  memberRole: 'Member',
  adminRole: 'Admin',
  ownerRole: 'Owner',
  loadingRecords: 'Loading records...',
  clanOverview: 'Clan',
  wins: 'Wins',
  losses: 'Losses',
  weeklyRequirement: 'Weekly requirement',
  allTimeLeaders: 'All-time leaders',
  latestLeaders: 'Latest war leaders',
  averagePerWar: 'Average / war',
  weeklyPoints: 'Weekly points',
  noLeaders: 'No players yet',
  warsSingular: 'war',
  warsPlural: 'wars',
  left: 'LEFT',
  calculatedScore: 'Calculated',
  day: 'Day',
  pts: 'Pts',
  winner: 'Winner',
  opponent: 'Opponent',
  opponentsScore: 'Opponent score',
  clanScore: '{name} score',
  dailyScores: 'Daily scores',
  players: 'Players',
  warHistory: 'War history',
  olderWars: 'Older wars',
  victory: 'VICTORY',
  defeat: 'DEFEAT',
  inProgress: 'IN PROGRESS',
  upcoming: 'UPCOMING',
  partial: 'PARTIAL',
  noData: 'NO DATA',
  unknownOpponent: 'Unknown opponent',
  finalPending: 'Result pending',
  rankingPending: 'Ranking not imported',
  import: 'Import',
  importData: 'Import data',
  importRanking: 'Import ranking',
  importResult: 'Import result',
  settings: 'Settings',
  members: 'Members',
  clanSettings: 'Clan settings',
  clanName: 'Clan name',
  minimumScore: 'Minimum weekly score',
  weights: 'Calculated score weights',
  newestWar: 'Latest war',
  previousWar: 'War −{offset}',
  weightsHelp: 'Weights are ordered from newest to oldest and must total 100%.',
  total: 'Total',
  weightsError: 'Weights must be positive and total 100%.',
  minimumError: 'Enter a valid minimum score.',
  manageAccess: 'Manage access',
  newInvitation: 'New invitation',
  displayName: 'Display name',
  role: 'Role',
  roleMemberDescription: 'Member · view only',
  roleAdminDescription: 'Admin · can import and edit',
  inviteReady: 'Invitation for {name}',
  inviteDescription: 'Share this single-use link. It expires in 7 days.',
  copyInvite: 'Copy invitation link',
  accounts: 'Accounts',
  pendingInvites: 'Pending invitations',
  revoked: 'Revoked',
  expires: 'Expires {date}',
  revokeAccount: 'Revoke account',
  revokeInvite: 'Revoke invitation',
  confirmRevoke: 'Revoke this access?',
  importWar: 'War import',
  editWar: 'Edit war',
  upload: 'Upload',
  review: 'Review',
  confirm: 'Confirm',
  leaderboardImages: 'Weekly leaderboard',
  imageLimit: 'Up to 10 screenshots',
  chooseImages: 'Choose screenshots',
  chosenImages: '{count} selected',
  resultImage: 'War result',
  chooseResult: 'Choose screenshot',
  scan: 'Recognize',
  confirmImport: 'Confirm import',
  ocrNeedsReview: 'Please review',
  addRow: 'Add player',
  rank: 'Rank',
  name: 'Name',
  points: 'Points',
  returning: 'RETURNING',
  new: 'NEW',
  newPlayer: 'New player',
  possibleMatch: 'Possible match: {name}',
  markedLeft: 'Leaving ({count})',
  newPlayersHelp: 'Check names marked NEW before confirming.',
  allDaysRequired: 'Complete all six days with a winner and MVP.',
  playersRequired: 'Add at least one player.',
  screenshotsRequired: 'Choose at least one screenshot.',
  screenshotsLimit: 'Maximum 10 leaderboard screenshots.',
  selectWinner: 'Select winner',
  finalResult: 'Final result',
  calculatedFromDays: 'Day totals',
  ocrPermission:
    'Google Cloud Vision rejected the request (403). Check API activation, billing and API key restrictions.',
  ocrNoKey: 'Google Cloud Vision API key is not configured.',
  invalidCredentials: 'Invalid username or password.',
  invalidSetupToken: 'Invalid setup token.',
  ownerExists: 'Owner account already exists.',
  accountExists: 'This username is already taken.',
  invitationExpired: 'Invitation expired or revoked.',
  invitationUsed: 'Invitation already used.',
  forbidden: 'You do not have permission for this action.',
  unauthorized: 'Please sign in.',
  serverError: 'An error occurred. Please try again.',
  tooltipCurrent: 'Current war',
  daySuffix: 'pts',
  rankingFromSunday: 'Rankings can be imported on Sunday.',
  resultFromMonday: 'Final result can be imported on Monday.',
  removeRow: 'Remove row',
  pickExisting: 'Existing player',
  languageSaveFailed: 'Could not save language preference.',
  wrongPassword: 'Current password is incorrect',
  nicknameTaken: 'This in-game name is already used',
  sharedInviteDisabled: 'No active group invitation',
  sharedInviteActive: 'Group invitation active',
  sharedInviteInfo:
    'Anyone with this link can create a Member account. Regenerating disables the previous link.',
  revokeSharedInvite: 'Disable link',
  reissueSharedInvite: 'Regenerate link',
  createSharedInvite: 'Generate group link',
  sharedInviteTitle: 'Group invitation · Member',
  alreadyHaveAccount: 'Already have an account? Sign in',
  passwordMismatch: 'Passwords do not match',
  confirmPassword: 'Confirm new password',
  newPassword: 'New password (optional)',
  currentPassword: 'Current password',
  profileSaved: 'Profile updated',
  profile: 'Profile',
  changePassword: 'Change password',
  newPasswordRequired: 'New password',
  navigation: 'Navigation',
  historyTab: 'History',
  wikiTab: 'Wiki',
  userManagement: 'Users',
  inviteAsOwner: 'Owner · full access',
  inviteAsAdmin: 'Admin · manages wars',
  noPendingInvites: 'No pending invitations',
  noActiveGroupInvite: 'Group link is disabled',
  groupInvite: 'Group link',
  newUserInvite: 'Invite a user',
  manageAccount: 'Account',
  pullOlder: 'Older wars',
  menu: 'Menu',
  editUser: 'Edit account',
  deleteUser: 'Delete account',
  confirmDeleteUser: 'Delete this account? War history and player scores will be kept.',
  loadMore: 'Load more',
  showLess: 'Show less',
  showAll: 'Show all',
  ocrRowCheck: 'Check rank {position}: {details}',
  ocrMissingRows: 'Could not find ranking rows. Enter players manually.',
  ocrMissingScore: 'Final score not recognized.',
  ocrOpponentCheck: 'Check opponent name.',
  ocrChooseWinner: 'Day {day}: select winner.',
  ocrMissingMvp: 'Day {day}: MVP not recognized.',
  ocrMissingDays: 'Detected {count} of 6 days. Complete the rest manually.',
  ocrDuplicateRank: 'Duplicate rank #{position}. Check the entries.',
  ocrDuplicateName: 'Duplicate name: {name}.',
} as const;

type MessageKey = keyof typeof en;
const uk: Record<MessageKey, string> = {
  appTitle: 'Історія війн клану',
  mergeComplete: 'Гравців об’єднано. Рейтинги війн перераховано.',
  mergeConfirm:
    'Об’єднати {old} з {correct}? Історія перейде до правильного гравця, а помилковий запис буде видалено.',
  mergeAccountWarning: 'Обидва гравці мають акаунти. Спершу виріши, кому належать акаунти.',
  keepIncorrectScores: 'Залишити очки помилкового',
  keepCorrectScores: 'Залишити очки правильного',
  mergeConflictChoice: 'Вибір очок для однакових війн',
  mergeOverlap: 'Обидва гравці є у {count} однакових війнах. Обери, чиї очки залишити.',
  warsCount: 'Війн: {count}',
  selectPlayer: 'Пошук гравця…',
  correctPlayer: 'Правильний гравець',
  incorrectPlayer: 'Помилковий гравець',
  mergeHelp:
    'Спочатку обери помилково розпізнаного гравця, потім правильного. Його очки та історія перейдуть до правильного гравця.',
  mergePlayers: 'Об’єднати дублікати гравців',
  loading: 'Завантаження...',
  save: 'Зберегти',
  cancel: 'Скасувати',
  close: 'Закрити',
  back: 'Назад',
  create: 'Створити',
  done: 'Готово',
  add: 'Додати',
  remove: 'Видалити',
  copied: 'Скопійовано!',
  username: 'Ігровий нік',
  password: 'Пароль',
  setupToken: 'Код налаштування',
  login: 'Увійти',
  logout: 'Вийти',
  setupTitle: 'Створення власника',
  invitationTitle: 'Приєднатися до клану',
  invitationFor: 'Запрошення для {name}',
  invitationInvalid: 'Запрошення недоступне.',
  createAccount: 'Створити акаунт',
  pleaseWait: 'Зачекайте...',
  language: 'Мова',
  memberRole: 'Учасник',
  adminRole: 'Адмін',
  ownerRole: 'Власник',
  loadingRecords: 'Завантаження даних...',
  clanOverview: 'Клан',
  wins: 'Перемоги',
  losses: 'Поразки',
  weeklyRequirement: 'Мінімум за тиждень',
  allTimeLeaders: 'Найкращі за весь час',
  latestLeaders: 'Найкращі за останню війну',
  averagePerWar: 'Середнє за війну',
  weeklyPoints: 'Очки за тиждень',
  noLeaders: 'Поки немає гравців',
  warsSingular: 'війна',
  warsPlural: 'війн',
  left: 'ВИБУВ',
  calculatedScore: 'Розрахунковий рейтинг',
  day: 'День',
  pts: 'Очки',
  winner: 'Переможець',
  opponent: 'Суперник',
  opponentsScore: 'Рахунок суперника',
  clanScore: 'Рахунок {name}',
  dailyScores: 'Результати по днях',
  players: 'Гравці',
  warHistory: 'Історія війн',
  olderWars: 'Попередні війни',
  victory: 'ПЕРЕМОГА',
  defeat: 'ПОРАЗКА',
  inProgress: 'ТРИВАЄ',
  upcoming: 'ПОПЕРЕДУ',
  partial: 'НЕПОВНІ ДАНІ',
  noData: 'НЕМАЄ ДАНИХ',
  unknownOpponent: 'Невідомий суперник',
  finalPending: 'Очікуємо на результат',
  rankingPending: 'Рейтинг ще не імпортовано',
  import: 'Імпорт',
  importData: 'Імпорт даних',
  importRanking: 'Імпорт рейтингу',
  importResult: 'Імпорт результату',
  settings: 'Налаштування',
  members: 'Учасники',
  clanSettings: 'Налаштування клану',
  clanName: 'Назва клану',
  minimumScore: 'Мінімальний рейтинг за тиждень',
  weights: 'Вагові коефіцієнти рейтингу',
  newestWar: 'Остання війна',
  previousWar: 'Війна −{offset}',
  weightsHelp: 'Ваги йдуть від останньої війни до найстарішої та мають складати 100%.',
  total: 'Разом',
  weightsError: 'Ваги мають бути додатними й складати 100%.',
  minimumError: 'Укажіть коректне мінімальне значення.',
  manageAccess: 'Керування доступом',
  newInvitation: 'Нове запрошення',
  displayName: "Ім'я учасника",
  role: 'Роль',
  roleMemberDescription: 'Учасник · лише перегляд',
  roleAdminDescription: 'Адмін · імпорт і редагування',
  inviteReady: 'Запрошення для {name}',
  inviteDescription: 'Надішліть це одноразове посилання. Діє 7 днів.',
  copyInvite: 'Копіювати посилання',
  accounts: 'Акаунти',
  pendingInvites: 'Очікують на вступ',
  revoked: 'Доступ відкликано',
  expires: 'Діє до {date}',
  revokeAccount: 'Відкликати доступ',
  revokeInvite: 'Скасувати запрошення',
  confirmRevoke: 'Відкликати доступ?',
  importWar: 'Імпорт війни',
  editWar: 'Редагувати війну',
  upload: 'Завантаження',
  review: 'Перевірка',
  confirm: 'Підтвердження',
  leaderboardImages: 'Тижневий рейтинг',
  imageLimit: 'До 10 скриншотів',
  chooseImages: 'Вибрати скриншоти',
  chosenImages: 'Вибрано: {count}',
  resultImage: 'Результат війни',
  chooseResult: 'Вибрати скриншот',
  scan: 'Розпізнати',
  confirmImport: 'Підтвердити імпорт',
  ocrNeedsReview: 'Перевірте дані',
  addRow: 'Додати гравця',
  rank: 'Місце',
  name: "Ім'я",
  points: 'Очки',
  returning: 'ПОСТІЙНИЙ',
  new: 'НОВИЙ',
  newPlayer: 'Новий гравець',
  possibleMatch: 'Можливий збіг: {name}',
  markedLeft: 'Вибули ({count})',
  newPlayersHelp: 'Перевірте імена з позначкою «НОВИЙ».',
  allDaysRequired: 'Укажіть переможця та MVP для всіх шести днів.',
  playersRequired: 'Додайте принаймні одного гравця.',
  screenshotsRequired: 'Виберіть хоча б один скриншот.',
  screenshotsLimit: 'Максимум 10 скриншотів рейтингу.',
  selectWinner: 'Виберіть переможця',
  finalResult: 'Підсумок війни',
  calculatedFromDays: 'За днями',
  ocrPermission:
    'Google Cloud Vision відхилив запит (403). Перевірте активацію API, білінг і обмеження API-ключа.',
  ocrNoKey: 'Не налаштовано API-ключ Google Cloud Vision.',
  invalidCredentials: "Неправильне ім'я користувача або пароль.",
  invalidSetupToken: 'Невірний код налаштування.',
  ownerExists: 'Власника вже створено.',
  accountExists: "Це ім'я користувача вже зайнято.",
  invitationExpired: 'Запрошення протерміноване або скасоване.',
  invitationUsed: 'Запрошення вже використано.',
  forbidden: 'Недостатньо прав для цієї дії.',
  unauthorized: 'Увійдіть до акаунта.',
  serverError: 'Виникла помилка. Спробуйте ще раз.',
  tooltipCurrent: 'Поточна війна',
  daySuffix: 'оч.',
  rankingFromSunday: 'Рейтинг можна імпортувати з неділі.',
  resultFromMonday: 'Підсумок можна імпортувати з понеділка.',
  removeRow: 'Видалити рядок',
  pickExisting: 'Наявний гравець',
  languageSaveFailed: 'Не вдалося зберегти мову.',
  wrongPassword: 'Невірний поточний пароль',
  nicknameTaken: 'Цей ігровий нік уже зайнятий',
  sharedInviteDisabled: 'Немає активного групового посилання',
  sharedInviteActive: 'Групове посилання активне',
  sharedInviteInfo:
    'Кожен за цим посиланням може створити акаунт учасника. Перевипуск вимикає попереднє посилання.',
  revokeSharedInvite: 'Вимкнути посилання',
  reissueSharedInvite: 'Перевипустити посилання',
  createSharedInvite: 'Створити групове посилання',
  sharedInviteTitle: 'Групове запрошення · Учасник',
  alreadyHaveAccount: 'Вже маєте акаунт? Увійти',
  passwordMismatch: 'Паролі не збігаються',
  confirmPassword: 'Підтвердіть новий пароль',
  newPassword: 'Новий пароль (за бажанням)',
  currentPassword: 'Поточний пароль',
  profileSaved: 'Профіль оновлено',
  profile: 'Профіль',
  changePassword: 'Змінити пароль',
  newPasswordRequired: 'Новий пароль',
  navigation: 'Навігація',
  historyTab: 'Історія',
  wikiTab: 'База знань',
  userManagement: 'Користувачі',
  inviteAsOwner: 'Власник · повний доступ',
  inviteAsAdmin: 'Адмін · керує війнами',
  noPendingInvites: 'Немає запрошень',
  noActiveGroupInvite: 'Групове посилання вимкнено',
  groupInvite: 'Групове посилання',
  newUserInvite: 'Запросити учасника',
  manageAccount: 'Акаунт',
  pullOlder: 'Попередні війни',
  menu: 'Меню',
  editUser: 'Редагувати акаунт',
  deleteUser: 'Видалити акаунт',
  confirmDeleteUser: 'Видалити акаунт? Історія війн та очки гравця збережуться.',
  loadMore: 'Завантажити ще',
  showLess: 'Згорнути',
  showAll: 'Показати всіх',
  ocrRowCheck: 'Перевірте місце {position}: {details}',
  ocrMissingRows: 'Не вдалося знайти рядки рейтингу. Додайте гравців вручну.',
  ocrMissingScore: 'Не розпізнано підсумковий рахунок.',
  ocrOpponentCheck: 'Перевірте назву суперника.',
  ocrChooseWinner: 'День {day}: виберіть переможця.',
  ocrMissingMvp: 'День {day}: не розпізнано MVP.',
  ocrMissingDays: 'Розпізнано {count} із 6 днів. Заповніть решту.',
  ocrDuplicateRank: 'Повторне місце #{position}. Перевірте записи.',
  ocrDuplicateName: "Повторне ім'я: {name}.",
};

type Interpolations = Record<string, string | number>;
const dictionaries: Record<Locale, Record<MessageKey, string>> = { uk, en };
const STORAGE_KEY = 'clan.language';
const LanguageContext = React.createContext<{
  locale: Locale;
  setLocale: (value: Locale) => void;
  t: (key: MessageKey, params?: Interpolations) => string;
} | null>(null);

function preferredLocale(): Locale {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'uk' || value === 'en' ? value : 'uk';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = React.useState<Locale>(preferredLocale);
  const setLocale = React.useCallback((next: Locale) => {
    updateLocale(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const t = React.useCallback(
    (key: MessageKey, params: Interpolations = {}) => {
      return dictionaries[locale][key].replace(/\{(\w+)\}/g, (_, name: string) =>
        String(params[name] ?? '{' + name + '}'),
      );
    },
    [locale],
  );
  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = React.useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is missing');
  return context;
}

export function LanguagePicker({ onSelect }: { onSelect?: (locale: Locale) => void }) {
  const { locale, setLocale, t } = useI18n();
  function toggle() {
    const next = locale === 'uk' ? 'en' : 'uk';
    setLocale(next);
    onSelect?.(next);
  }
  return (
    <button
      className="language-picker language-toggle"
      type="button"
      title={t('language')}
      aria-label={t('language')}
      onClick={toggle}
    >
      <span className={'locale-option' + (locale === 'uk' ? ' active' : '')}>
        <span aria-hidden="true">🇺🇦</span> UA
      </span>
      <span className={'locale-option' + (locale === 'en' ? ' active' : '')}>
        <span aria-hidden="true">🇬🇧</span> EN
      </span>
    </button>
  );
}

const backendErrors: Record<string, string> = {
  'War must start on a Tuesday': 'Війна має починатися у вівторок.',
  'Invalid Tuesday date': 'Неправильна дата початку війни.',
  'Invalid date': 'Неправильна дата.',
  'Anchor must be a Tuesday': 'Дата має припадати на вівторок.',
  'Rankings become available Sunday 00:00 UTC': 'Рейтинг можна імпортувати з неділі.',
  'Final results become available Monday 00:00 UTC': 'Підсумок можна імпортувати з понеділка.',
  'Duplicate player/rank entries': 'Повторюються гравці або місця в рейтингу.',
  'Each day must appear once': 'Кожен із шести днів має бути вказаний один раз.',
  'Daily winners do not match final score': 'Переможці за днями не відповідають підсумковому рахунку.',
  'Player ranking already imported for this war': 'Рейтинг цієї війни вже імпортовано.',
  'Final result already imported for this war': 'Підсумок цієї війни вже імпортовано.',
  'Same player assigned to multiple ranks': 'Один гравець займає кілька місць.',
  'Name or rank is already used': "Ім'я або місце вже використано.",
  'Weights must sum to 1': 'Сума ваг має дорівнювати 100%.',
  'Too many login attempts': 'Забагато спроб входу. Спробуйте пізніше.',
  'Cannot revoke yourself': 'Не можна відкликати власний доступ.',
  'Cannot revoke owner': 'Не можна відкликати доступ власника.',
  'Cloud OCR service unavailable': 'Сервіс розпізнавання тимчасово недоступний.',
  'No text detected in image': 'На зображенні не знайдено тексту.',
  'Unexpected image field': 'Непідтримуваний тип вкладення.',
  'PNG, JPEG or WebP required': 'Підтримуються PNG, JPEG та WebP.',
  'Image exceeds 6 MB': 'Розмір зображення перевищує 6 МБ.',
  'Maximum 10 ranking screenshots and one result':
    'Дозволено до 10 скриншотів рейтингу й один підсумковий.',
  'Invalid image count': 'Невірна кількість зображень.',
  'Player name belongs to another player. Merge duplicates first.':
    'Це ім’я вже належить іншому гравцеві. Спочатку об’єднай дублікати.',
  'Both players have different accounts. Resolve accounts first.':
    'Обидва гравці мають різні акаунти. Спочатку виріши конфлікт акаунтів.',
  'Canonical name belongs to another account': 'Правильне ім’я вже належить іншому акаунту.',
  'Player not found': 'Гравця не знайдено.',
  'Choose two different players': 'Обери двох різних гравців.',
  'Invalid merge request': 'Неправильні дані об’єднання.',
  'War not imported': 'Цю війну ще не імпортовано.',
  'Player ranking not imported for this war': 'Рейтинг цієї війни ще не імпортовано.',
  'Final result not imported for this war': 'Результат цієї війни ще не імпортовано.',
};

const serverMessages: Record<string, MessageKey> = {
  'Invalid username or password': 'invalidCredentials',
  'Invalid setup token': 'invalidSetupToken',
  'Owner already exists': 'ownerExists',
  'Account already exists': 'accountExists',
  'Username already exists': 'nicknameTaken',
  'Player name already exists': 'nicknameTaken',
  'Invitation expired or revoked': 'invitationExpired',
  'Invitation already used': 'invitationUsed',
  Forbidden: 'forbidden',
  Unauthorized: 'unauthorized',
  'GOOGLE_VISION_API_KEY is not configured': 'ocrNoKey',
};
export function localizeError(raw: string, locale: Locale, status?: number): string {
  const key = serverMessages[raw];
  if (key) return dictionaries[locale][key];
  if (raw.startsWith('Google Cloud Vision (HTTP 403)')) {
    return dictionaries[locale].ocrPermission + '\n' + raw;
  }
  if (locale === 'uk' && backendErrors[raw]) return backendErrors[raw];
  const invalidDay = raw.match(/^Invalid day (\d+) points$/);
  if (locale === 'uk' && invalidDay) return 'Невірна кількість очок за день ' + invalidDay[1];
  const unknownPlayer = raw.match(/^Unknown player ID (\d+)$/);
  if (locale === 'uk' && unknownPlayer) return 'Невідомий гравець #' + unknownPlayer[1];
  if (status === 403) return dictionaries[locale].forbidden;
  if (status === 401) return dictionaries[locale].unauthorized;
  return raw;
}

export function localizeOcrWarning(message: string, locale: Locale): string {
  const imagePrefix = message.match(/^Image (\d+): (.*)$/);
  const warning = imagePrefix ? imagePrefix[2] : message;
  const dictionary = dictionaries[locale];
  const template = (key: MessageKey, values: Interpolations = {}) =>
    dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
  let translated = warning;
  const rank = warning.match(/^Rank (\d+): (?:points not recognized|check)\s*(.*)$/);
  const dayWinner = warning.match(/^Day (\d+): choose winner manually\.$/);
  const dayMvp = warning.match(/^Day (\d+): MVP was not recognized\.$/);
  const missingDays = warning.match(/^Found (\d+)\/6 days\./);
  const duplicatedRank = warning.match(/^Conflicting duplicated rank #(\d+)/);
  const duplicatedName = warning.match(/^Duplicate name (.*?) found at multiple ranks\.$/);
  if (rank) translated = template('ocrRowCheck', { position: rank[1], details: rank[2] });
  if (dayWinner) translated = template('ocrChooseWinner', { day: dayWinner[1] });
  if (dayMvp) translated = template('ocrMissingMvp', { day: dayMvp[1] });
  if (missingDays) translated = template('ocrMissingDays', { count: missingDays[1] });
  if (duplicatedRank) translated = template('ocrDuplicateRank', { position: duplicatedRank[1] });
  if (duplicatedName) translated = template('ocrDuplicateName', { name: duplicatedName[1] });
  if (warning.startsWith('Could not confidently find ranking rows'))
    translated = dictionary.ocrMissingRows;
  if (warning === 'Final score not recognized.') translated = dictionary.ocrMissingScore;
  if (warning === 'Verify opponent clan name.') translated = dictionary.ocrOpponentCheck;
  return imagePrefix
    ? (locale === 'uk' ? 'Зображення ' : 'Image ') + imagePrefix[1] + ': ' + translated
    : translated;
}
