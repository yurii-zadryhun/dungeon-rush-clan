import type { WikiArticle } from '../model';

export const researchGuides: WikiArticle[] = [
  {
    "id": "research",
    "category": "research",
    "level": "advanced",
    "evidence": "theory",
    "title": {
      "en": "Simulator & build experiments",
      "uk": "Симулятор і експерименти з білдами"
    },
    "summary": {
      "en": "Turn interesting theories into repeatable comparisons.",
      "uk": "Перетворюємо цікаві гіпотези на повторювані порівняння."
    },
    "body": {
      "en": "## A better approach to gear decisions\nA single duel is noisy. Critical hits, Mega Crit, hit timing, enemy defenses and companions introduce randomness. To compare gear effectively, simulate or measure **multiple fights** against representative opponents.\n\n## The clan simulator\nAn open-source Dungeon Rush simulator can help investigate mechanics and test hypothetical builds. Its accuracy depends on which parts of the game's actual combat logic have been verified.\n\n## How to run a useful experiment\n1. State the hypothesis precisely, such as “200% Ranged Defense is better than 100% for this opponent.”\n2. Freeze the opponent's stats and companions.\n3. Change **one variable** at a time.\n4. Record win rate, damage dealt, damage received and time-to-kill over many trials.\n5. Repeat with several opponents: pure ranged, melee, high CDT, high Mega Crit, bosses.\n6. Publish the input conditions, sample size and result alongside the conclusion.\n\n## Questions worth testing\n- Does CDT -100% suppress Mega Crit's full damage or only its ordinary crit component?\n- How does Triple Hit interact with Double Hit at the cap?\n- Is there a practical Attack Speed cap?\n- When does extra Block outperform Lifesteal?\n- What is the optimal PvP/PvE yellow-affix allocation given the fixed slot budget?\n- Does the defense mitigation formula hold across all damage types?\n\n## Scientific honesty\nA plausible formula is not a fact. Label it **hypothesis** until reproducible tests support it; keep the previous conclusion visible if new data changes the answer.",
      "uk": "## Кращий підхід до вибору спорядження\nОдна дуель — шумний результат. Крити, Mega Crit, порядок ударів, захист ворога та компаньйони додають випадковості. Для порівняння речей потрібно змоделювати або виміряти **багато боїв** проти типових суперників.\n\n## Симулятор клану\nВідкритий симулятор Dungeon Rush допомагає досліджувати механіки та тестувати гіпотетичні білди. Його точність залежить від того, які частини реальної бойової логіки вдалося підтвердити.\n\n## Як проводити корисний експеримент\n1. Сформулюй гіпотезу точно: наприклад, «200% Ranged Defense кращі за 100% проти цього ворога».\n2. Зафіксуй характеристики й компаньйонів суперника.\n3. Змінюй **одну змінну** за раз.\n4. Записуй відсоток перемог, завдану/отриману шкоду й час убивства за багатьма спробами.\n5. Повтори для різних ворогів: дальніх, ближніх, із високим CDT, Mega Crit, босів.\n6. Публікуй умови, кількість тестів і результат разом із висновком.\n\n## Що варто перевірити\n- CDT -100% прибирає весь Mega Crit чи лише звичайну критичну складову?\n- Як Triple Hit взаємодіє з Double Hit на межі?\n- Чи є практична межа Attack Speed?\n- Коли додатковий Block вигідніший за Lifesteal?\n- Який найкращий розподіл жовтих слотів для PvP і PvE?\n- Чи працює формула захисту для всіх типів шкоди?\n\n## Чесність досліджень\nПравдоподібна формула — ще не факт. Позначай її **гіпотезою**, доки повторювані тести не підтвердять. Якщо нові дані змінюють висновок, залишай історію уточнення."
    },
    "related": [
      "combat-formulas",
      "pvp-builds",
      "pve-builds",
      "hybrid-builds"
    ],
    "links": [
      {
        "label": {
          "en": "Dungeon Rush simulator · GitHub",
          "uk": "Симулятор Dungeon Rush · GitHub"
        },
        "url": "https://github.com/yurii-zadryhun/dungeon-rush-simulator"
      }
    ]
  },
  {
    "id": "ads-privacy",
    "category": "research",
    "level": "intermediate",
    "evidence": "observed",
    "title": {
      "en": "Ads, rewards & privacy settings",
      "uk": "Реклама, нагороди й приватність"
    },
    "summary": {
      "en": "Manage ad preferences without promises about shorter ads.",
      "uk": "Налаштуй рекламні вподобання без обіцянок коротких роликів."
    },
    "body": {
      "en": "## Why ad experiences differ\nClan members reported ads ranging from five seconds to more than a minute. Providers, device settings, region, inventory and personalization can all affect which advertisements appear.\n\n## Privacy controls you can explore\n- On Android, find your device's **Ads** or **Advertising ID** settings. Names vary by manufacturer and Android version.\n- In **Google My Ad Center**, review or disable ad personalization according to your preferences.\n- Where an ad shows an information icon, consult the advertising provider's privacy options and opt-out choices.\n- An app restart can change a loaded ad, but does not guarantee a different ad campaign.\n\n## What the clan observed\nSome players reported more short ads after changing their privacy preferences. Others continued receiving long game ads. These are personal observations; **there is no proven method that guarantees shorter ads**.\n\n## Respect your time\nFree ads can add up to substantial clan points, but nobody is expected to watch them endlessly. Only engage with ads and offers in ways you are comfortable with.\n\n## Important distinction\nAn ad linking to Google Play is **not necessarily served by Google**. The actual ad network may be different.\n\n> These steps are about user choice and privacy, not a promise to manipulate how long advertisements run.",
      "uk": "## Чому реклама в усіх різна\nУчасники бачили рекламу від п'яти секунд до понад хвилини. На показ можуть впливати мережа, налаштування пристрою, регіон, доступні кампанії та персоналізація.\n\n## Налаштування приватності\n- На Android знайди налаштування **Реклама** або **Рекламний ідентифікатор**. Назви залежать від виробника й версії.\n- У **Google My Ad Center** переглянь або вимкни персоналізацію відповідно до власних вподобань.\n- Якщо на рекламі є значок інформації, переглянь умови та можливості відмови від персоналізації в її постачальника.\n- Перезапуск гри може змінити вже завантажену рекламу, але не гарантує іншу кампанію.\n\n## Що помітили в клані\nДеякі гравці після зміни налаштувань приватності частіше отримували коротку рекламу. Інші й далі бачили довгі реклами ігор. Це особисті спостереження; **способу гарантовано зробити рекламу короткою не доведено**.\n\n## Поважай свій час\nБезкоштовні нагороди за рекламу можуть додати клану багато очок, але ніхто не зобов'язаний дивитися її безперервно. Взаємодій лише з тим, із чим тобі комфортно.\n\n## Важлива відмінність\nПосилання з реклами до Google Play **не означає**, що її показує саме Google. Рекламна мережа може бути іншою.\n\n> Це поради щодо приватності та власного вибору, а не обіцянка змінити тривалість реклами."
    },
    "related": [
      "f2p",
      "war-boxes",
      "war-mining"
    ],
    "links": [
      {
        "label": {
          "en": "Google My Ad Center",
          "uk": "Центр реклами Google"
        },
        "url": "https://myadcenter.google.com/home"
      }
    ]
  },
  {
    "id": "known-unknowns",
    "category": "research",
    "level": "advanced",
    "evidence": "theory",
    "title": {
      "en": "Known mechanics & open questions",
      "uk": "Відомі механіки й відкриті питання"
    },
    "summary": {
      "en": "What the clan believes, what it has observed and what needs proof.",
      "uk": "Що ми знаємо, що спостерігали, а що ще треба довести."
    },
    "body": {
      "en": "## Practical information\nThe six-day clan-war calendar and relative daily war point weights are reflected in the Archive's own score model. Basic UI and event schedule details should still be reviewed after major game updates.\n\n## Strong observations, not verified formulas\n- CDT -100% appears to remove ordinary critical-hit bonus damage.\n- Triple Hit at 100% appears to supersede Double Hit.\n- Lower-rarity equipment with great affixes can beat higher-rarity equipment.\n- Divine item-level progress can improve later loot opportunities.\n- Ranged/Melee Defense looks very powerful but its exact mathematical function needs verification.\n\n## Hypotheses needing controlled tests\n- Exact interaction between CDT and Mega Crit.\n- Attack Speed maximum or practical animation limits.\n- Optimal defense split by common opponent builds.\n- Co-op Elo gains based on party ratings.\n- Exact yellow-affix drop probabilities by level.\n- Special Divine item-level generation ranges.\n- Probability weights of flying chest rewards.\n- Best stat allocation on wings and cloaks after reroll costs.\n\n## How to contribute\nShare a screenshot, the build, enemy stats and repeated outcomes where possible. Tell us which game version you used. A specific reproducible observation is much more useful than one lucky or unlucky duel.\n\n## Editorial rule\nAvoid labeling a theory as **confirmed** merely because several clan members agree with it. Guides should be corrected as better evidence appears.\n\n> A living wiki is allowed to change its mind — that's a feature, not a failure.",
      "uk": "## Практична інформація\nШестиденний розклад війни та відносні бали днів відображено й у власній моделі рахунку Clan Archive. Після великих оновлень гри навіть базові правила варто звіряти повторно.\n\n## Сильні спостереження, але не доведені формули\n- CDT -100% схоже прибирає бонусну шкоду звичайних критів.\n- Triple Hit на 100% схоже замінює Double Hit.\n- Річ меншої рідкісності з чудовими афіксами може бути сильнішою за рідкіснішу.\n- Розвиток Divine-рівнів може покращувати майбутній лут.\n- Ranged/Melee Defense дуже корисні, але точна математична формула ще потребує перевірки.\n\n## Гіпотези для контрольованих тестів\n- Точна взаємодія CDT і Mega Crit.\n- Максимум Attack Speed або обмеження анімації.\n- Оптимальний розподіл захисту проти типових ворогів.\n- Формула приросту Co-op Elo залежно від рейтингу групи.\n- Точні шанси жовтих афіксів за рівнями.\n- Діапазони рівнів особливих Divine-речей.\n- Ймовірності нагород із літаючих скринь.\n- Найкращі афікси крил і плащів з урахуванням ціни перекручувань.\n\n## Як допомогти\nНадсилай скриншот, білд, характеристики ворога й кілька результатів, якщо можливо. Вказуй версію гри. Конкретне повторюване спостереження корисніше за одну випадкову дуель.\n\n## Редакторський принцип\nНе позначай теорію як **доведену** лише тому, що з нею погодилися кілька людей. Гайди мають виправлятися, коли з'являються кращі дані.\n\n> Жива wiki може змінювати висновки — це перевага, а не помилка."
    },
    "related": [
      "research",
      "combat-formulas",
      "gear-130"
    ]
  }
];
