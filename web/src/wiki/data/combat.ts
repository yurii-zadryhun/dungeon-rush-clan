import type { WikiArticle } from '../model';

export const combatGuides: WikiArticle[] = [
  {
    "id": "affixes",
    "category": "combat",
    "level": "beginner",
    "evidence": "observed",
    "featured": true,
    "title": {
      "en": "Affixes: which stats matter?",
      "uk": "Афікси: які характеристики важливі?"
    },
    "summary": {
      "en": "Understand white and yellow stats, rolls and priorities for different builds.",
      "uk": "Розбираємо білі й жовті характеристики та пріоритети для різних білдів."
    },
    "body": {
      "en": "## Two groups of affixes\n**Normal (white) affixes** provide stats such as Attack Speed, Critical Damage, Critical Chance, Lifesteal, Damage, Ranged/Melee Damage, Health and Block. **Special (yellow) affixes** can change combat drastically: Triple Hit, Mega Crit, Critical Damage Taken and Ranged/Melee Defense.\n\n## Good general-purpose white stats\n- **Attack Speed** — usually a leading offensive priority.\n- **Critical Damage** — strong in PvE, but an enemy's CDT can reduce its PvP value.\n- **Critical Chance** — helps activate critical damage; less useful against CDT -100%.\n- **Damage or weapon-specific Damage** — reliable additive offense when your weapon uses it.\n- **Lifesteal and Block Chance** — improve survival, especially when incoming one-shots are under control.\n\n## Yellow-affix priorities depend on the goal\n**PvP:** CDT toward -100%, relevant defense, enough Triple Hit for offense, potentially Mega Crit.\n\n**Boss Rush / PvE:** Triple Hit and Mega Crit generally look attractive; defense may be less important than sustained damage.\n\n**Hybrid:** balance partial defense with attack. Avoid filling every slot with redundant stats.\n\n## Typical observed maximum white rolls\n| Stat | Approximate roll cap |\n| --- | --- |\n| Attack Speed | 40% |\n| Critical Damage | 100% |\n| Critical Chance | 12% |\n| Lifesteal | 20% |\n| Melee Damage | 50% |\n| Block Chance | 5% |\n\nThese were discussed by clan members, **not independently audited** for every slot and rarity.\n\n## Key rule: evaluate the full set\nIf you're already at CDT -100% or Triple Hit 100%, another piece with those same affixes may have no useful contribution. A seemingly weaker item could balance your complete build better.\n\n> One great yellow stat does not automatically beat two excellent white stats; the value changes with the entire equipment set.",
      "uk": "## Дві групи афіксів\n**Звичайні (білі) афікси** дають Attack Speed, Critical Damage, Critical Chance, Lifesteal, Damage, Ranged/Melee Damage, Health, Block тощо. **Особливі (жовті) афікси** можуть кардинально змінити бій: Triple Hit, Mega Crit, Critical Damage Taken і Ranged/Melee Defense.\n\n## Корисні білі характеристики\n- **Attack Speed** — зазвичай один з головних пріоритетів для атаки.\n- **Critical Damage** — сильний у PvE, але CDT ворога може зменшити користь у PvP.\n- **Critical Chance** — активує критичну шкоду; менш корисний проти CDT -100%.\n- **Damage або бонус до свого типу зброї** — стабільний приріст шкоди.\n- **Lifesteal і Block Chance** — допомагають виживати, особливо після захисту від ваншотів.\n\n## Жовті афікси залежать від мети\n**PvP:** CDT до -100%, захист потрібного типу, Triple Hit для атаки, можливо Mega Crit.\n\n**Boss Rush / PvE:** Triple Hit і Mega Crit виглядають привабливо; захист може поступатися стабільному урону.\n\n**Гібрид:** баланс часткового захисту та атаки. Не забивай слоти зайвими повтореннями.\n\n## Типові максимальні значення білих ролів\n| Характеристика | Орієнтовна межа |\n| --- | --- |\n| Attack Speed | 40% |\n| Critical Damage | 100% |\n| Critical Chance | 12% |\n| Lifesteal | 20% |\n| Melee Damage | 50% |\n| Block Chance | 5% |\n\nЦі значення обговорювалися в клані, але **ще не перевірені незалежно** для всіх слотів і рідкісностей.\n\n## Головне: оцінюй увесь набір\nЯкщо вже маєш CDT -100% або Triple Hit 100%, додаткова річ із тим самим афіксом може нічого корисного не додати. На вигляд слабша річ іноді краще балансує весь білд.\n\n> Один чудовий жовтий афікс не обов'язково кращий за два сильні білі; усе залежить від спорядження загалом."
    },
    "related": [
      "combat-formulas",
      "pvp-builds",
      "pve-builds",
      "wings"
    ]
  },
  {
    "id": "combat-formulas",
    "category": "combat",
    "level": "advanced",
    "evidence": "theory",
    "title": {
      "en": "Damage, defense & attack speed",
      "uk": "Шкода, захист і швидкість атаки"
    },
    "summary": {
      "en": "Useful models of mitigation and hit frequency, with their limits.",
      "uk": "Корисні моделі зменшення шкоди й частоти ударів та їхні обмеження."
    },
    "body": {
      "en": "## Defensive mitigation model\nThe clan has discussed the model:\n\n**Damage received = Base damage / (1 + Defense / 100)**\n\nIf the game follows it, the examples are:\n\n| Defense | Damage received | Reduction |\n| --- | --- | --- |\n| 50% | 66.7% | 33.3% |\n| 100% | 50% | 50% |\n| 200% | 33.3% | 66.7% |\n| 300% | 25% | 75% |\n| 400% | 20% | 80% |\n\nThis demonstrates **diminishing marginal reduction** relative to additional defense. It is a useful model but needs controlled in-game testing.\n\n## Attack speed model\nIf +100% Attack Speed doubles attacks per second, then +200% triples the baseline frequency. Expressed as relative intervals:\n\n**Attack interval = Base interval / (1 + Attack Speed / 100)**\n\nThe chat also mentioned a possible speed cap. **Do not assume unlimited scaling** without testing at high bonuses.\n\n## Critical Damage Taken\nA target with **CDT -100%** was observed to negate the bonus part of ordinary critical hits, making Crit Chance and Crit Damage much weaker against it. Mega Crit interactions may differ and need dedicated tests.\n\n## Multi-hit mechanics\nThe working understanding is that **Triple Hit 100% supersedes Double Hit** rather than combining with it. More than 100% Triple Hit is likely wasted; validate the exact cap before replacing an otherwise excellent item.\n\n## Effective damage beats Power\nSmall changes in attack frequency, crit defense and hit multipliers can swing a fight more than displayed character Power.\n\n> These formulas are models from clan research, not an official specification.",
      "uk": "## Модель захисту\nУ клані обговорювали формулу:\n\n**Отримана шкода = Базова шкода / (1 + Defense / 100)**\n\nЯкщо гра працює саме так, маємо:\n\n| Захист | Отримана шкода | Зменшення |\n| --- | --- | --- |\n| 50% | 66,7% | 33,3% |\n| 100% | 50% | 50% |\n| 200% | 33,3% | 66,7% |\n| 300% | 25% | 75% |\n| 400% | 20% | 80% |\n\nЦе показує **спадну додаткову користь** кожного наступного приросту захисту. Модель корисна, але потребує контрольованих тестів у грі.\n\n## Модель швидкості атаки\nЯкщо +100% Attack Speed подвоює кількість атак за секунду, то +200% потроює початкову частоту. Для інтервалу між ударами:\n\n**Інтервал = Базовий інтервал / (1 + Attack Speed / 100)**\n\nУ чаті також згадувалася можлива межа швидкості. **Не вважай зростання необмеженим** без перевірки на великих значеннях.\n\n## Critical Damage Taken\nЗа спостереженнями **CDT -100%** прибирає бонусну частину звичайного крита, через що Crit Chance і Crit Damage стають набагато слабшими проти такого суперника. Взаємодію з Mega Crit треба тестувати окремо.\n\n## Багаторазові удари\nПоточне розуміння: **Triple Hit 100% замінює Double Hit**, а не складається з ним. Понад 100% Triple Hit, схоже, марно; перевір точну межу, перш ніж міняти в іншому чудову річ.\n\n## Реальна шкода важливіша за Power\nЧастота ударів, критозахист і множники влучань можуть впливати на бій значно сильніше за загальну цифру Power.\n\n> Це моделі з досліджень клану, а не офіційна специфікація гри."
    },
    "related": [
      "affixes",
      "pvp-builds",
      "power",
      "research"
    ]
  },
  {
    "id": "pvp-builds",
    "category": "combat",
    "level": "advanced",
    "evidence": "theory",
    "featured": true,
    "title": {
      "en": "PvP builds: ranged & melee",
      "uk": "PvP-білди: дальній і ближній бій"
    },
    "summary": {
      "en": "Defensive affixes, crit resistance and the tradeoffs of each weapon.",
      "uk": "Захисні афікси, стійкість до критів і компроміси двох типів зброї."
    },
    "body": {
      "en": "## Your main goal: survive, then deal damage\nFor difficult PvP matches, the first problem is often dying to a huge critical hit before you can retaliate. Defensive yellow affixes can be more valuable than stacking visible Power.\n\n## Defensive targets worth testing\n- **Critical Damage Taken -100%** — often achievable with two strong yellow rolls. Our theory: it removes the bonus from ordinary enemy critical hits.\n- **Ranged Defense around 200%** — under the working formula, cuts ranged damage by about two thirds.\n- **Melee Defense around 200%** — protects against melee opponents.\n- **Triple Hit Chance up to 100%** — preserves offense; beyond the cap adds no value.\n- **Mega Crit** — useful when spare yellow-affix slots remain.\n\nThese are **targets for experimentation**, not a solved best-in-slot list. A ranged attacker may want different offensive white stats from a melee tank.\n\n## White affixes for a melee-oriented PvP build\nAttack Speed, Lifesteal and Melee Damage are attractive. Critical Damage, Block Chance, Health and generic Damage can be useful depending on opponents. Crit Chance loses value against full CDT defense.\n\n## Ranged PvP\nRanged builds still need high Attack Speed and damage output. Defense against enemy ranged attacks often matters most, but strong melee opponents exist. Don't blindly copy the melee white-affix priority list.\n\n## Gear rarity is secondary\nAn Immortal/red item with outstanding affixes can beat Divine gear with poor ones. But upgrading the right Divine slots to level 130 is valuable for long-term loot progression.\n\n## How to improve the build\nEvaluate your **entire** equipment set. Replacing one piece may mean temporarily losing CDT coverage. Test fights against several opponents rather than judging by one lucky Mega Crit.\n\n> The perfect distribution of Melee/Ranged Defense, Block, Lifesteal and Mega Crit remains an open research question.",
      "uk": "## Головна мета: вижити, а потім завдати шкоди\nУ важких PvP-боях проблема часто в тому, що персонаж гине від величезного крита ще до відповіді. Захисні жовті афікси можуть бути кориснішими за нарощування Power.\n\n## Захисні орієнтири для тестів\n- **Critical Damage Taken -100%** — часто можна отримати двома сильними жовтими ролами. Наша гіпотеза: прибирає бонус звичайних критів ворога.\n- **Ranged Defense близько 200%** — за робочою формулою зменшує дальню шкоду приблизно на дві третини.\n- **Melee Defense близько 200%** — захищає від ближніх суперників.\n- **Triple Hit Chance до 100%** — зберігає атаку; усе понад межу марне.\n- **Mega Crit** — корисний, якщо залишаються вільні слоти жовтих афіксів.\n\nЦе **орієнтири для експериментів**, а не доведений ідеальний набір. Для стрільця й ближнього танка можуть бути різні пріоритети білих характеристик.\n\n## Білі афікси для ближнього PvP\nПривабливі Attack Speed, Lifesteal та Melee Damage. Critical Damage, Block Chance, Health і звичайний Damage теж можуть допомагати залежно від ворогів. Crit Chance втрачає цінність проти повного CDT-захисту.\n\n## Дальній PvP\nСтрільцеві потрібні високий Attack Speed і шкода. Захист від інших стрільців часто дуже важливий, але існують і сильні ближні бійці. Не копіюй бездумно пріоритети білих афіксів ближнього білда.\n\n## Рідкісність — другорядна\nЧервона Immortal-річ із чудовими афіксами може перемогти Divine з поганими. Водночас прокачати потрібні Divine-слоти до 130 корисно для майбутнього луту.\n\n## Як вдосконалювати білд\nОцінюй **увесь** набір спорядження. Заміна однієї речі може тимчасово знизити CDT. Тестуй проти кількох супротивників, а не за одним випадковим Mega Crit.\n\n> Ідеальний розподіл Melee/Ranged Defense, Block, Lifesteal та Mega Crit — відкрите питання."
    },
    "related": [
      "combat-formulas",
      "affixes",
      "hybrid-builds",
      "war-pvp"
    ]
  },
  {
    "id": "pve-builds",
    "category": "combat",
    "level": "intermediate",
    "evidence": "observed",
    "title": {
      "en": "PvE & Boss Rush damage builds",
      "uk": "PvE та Boss Rush: білд на шкоду"
    },
    "summary": {
      "en": "Prioritize sustained damage to bosses and dungeon enemies.",
      "uk": "Як підвищувати постійну шкоду по босах і мобах."
    },
    "body": {
      "en": "## PvE asks different questions\nIn Boss Rush, the ability to survive may be less important than how much damage you deal before the fight ends. In dungeon pushing, survivability and enemy resistances can still matter.\n\n## Offensive priorities\n- **Attack Speed** — more frequent attacks.\n- **Triple Hit Chance** — extra hits; work toward full coverage if the value justifies the slots.\n- **Mega Crit** — opportunities for much larger hits.\n- **Critical Damage + Critical Chance** — particularly useful when mobs or bosses lack full crit defense.\n- **Damage / Ranged Damage / Melee Damage** — match the type of weapon you're using.\n\n## What to sacrifice?\nCDT, Ranged Defense and Melee Defense consume yellow-affix slots that could otherwise boost damage. For pure Boss Rush, this tradeoff can be poor. But if the boss kills you immediately, some survival is necessary.\n\n## Test against real targets\nRun several fights and compare damage over time. A single lucky Mega Crit is not a representative measurement. Also account for companion effects, attack range and the time you spend moving.\n\n## Beware universal builds\nA set spread equally between defense and offense can feel mediocre everywhere. If your priority is Boss Rush rank, optimize specifically for boss damage; if it's clan-war PvP, follow the [PvP guide](wiki:pvp-builds).\n\n> No mathematically proven optimal PvE affix distribution has been established yet.",
      "uk": "## PvE потребує іншого підходу\nУ Boss Rush виживання може бути менш важливим за кількість шкоди до завершення бою. Під час проходження підземелля захист і резисти ворогів усе ще можуть вирішувати результат.\n\n## Атакувальні пріоритети\n- **Attack Speed** — частіші удари.\n- **Triple Hit Chance** — додаткові удари; прагни повного покриття, якщо воно варте слотів.\n- **Mega Crit** — можливість значно потужніших влучань.\n- **Critical Damage + Critical Chance** — особливо корисні, коли боси й моби не мають повного захисту від критів.\n- **Damage / Ranged Damage / Melee Damage** — відповідно до твоєї зброї.\n\n## Чим пожертвувати?\nCDT, Ranged Defense та Melee Defense займають жовті слоти, які могли б збільшувати шкоду. Для чистого Boss Rush це може бути невигідно. Але якщо бос убиває одразу, частка захисту необхідна.\n\n## Перевіряй на реальних цілях\nПроведи кілька боїв і порівняй шкоду за час. Один випадковий Mega Crit — не показове вимірювання. Також враховуй компаньйонів, дальність атаки та час на пересування.\n\n## Обережно з універсальним білдом\nНабір, рівномірно розмазаний між захистом і атакою, може бути посереднім скрізь. Якщо головна мета — місце в Boss Rush, збирай білд на боса; якщо PvP війни — дивись [PvP-гайд](wiki:pvp-builds).\n\n> Математично доведеного оптимального розподілу PvE-афіксів поки немає."
    },
    "related": [
      "affixes",
      "combat-formulas",
      "hybrid-builds",
      "events"
    ]
  },
  {
    "id": "hybrid-builds",
    "category": "combat",
    "level": "intermediate",
    "evidence": "theory",
    "title": {
      "en": "Hybrid build: PvE + PvP",
      "uk": "Гібридний білд: PvE + PvP"
    },
    "summary": {
      "en": "A practical compromise when you don't want two full gear sets.",
      "uk": "Компроміс, якщо не хочеш збирати два повноцінні набори."
    },
    "body": {
      "en": "## The compromise\nA hybrid build aims to stay competitive on bosses while remaining hard to one-shot in PvP. It is a compromise, not the mathematically best possible solution for either mode.\n\n## Example target from clan discussions\n- **CDT -100%** for crit protection.\n- **Ranged Defense ~100%**.\n- **Melee Defense ~100%**.\n- **Triple Hit ~100%**.\n- **Mega Crit ~30%** if the yellow slot budget allows it.\n\nFor normal affixes, prioritize **Attack Speed, Critical Damage, Critical Chance**, and then damage/survival according to the specific gear roll. These are illustrative targets from discussion, not guaranteed attainable values for every set.\n\n## Why not max everything?\nThe number of yellow-affix slots is finite. Any overcap on CDT or Triple Hit wastes space, while stacking excessive defense reduces offensive options. Similarly, too much emphasis on crit chance can be inefficient in PvP against CDT-equipped opponents.\n\n## Who should use it?\nPlayers who want to play Boss Rush, dungeon and clan war PvP without changing every item before each activity.\n\n## When to specialize\nIf your boss ranking collapses or you routinely lose PvP fights to defensively optimized opponents, consider keeping a second set and switching for that mode.\n\n> Before committing tens of thousands of boxes to a build, compare it with realistic opponents and bosses in controlled tests.",
      "uk": "## У чому компроміс\nГібридний білд дозволяє непогано бити босів і не ловити ваншоти в PvP. Це компроміс, а не математично найкраще рішення для кожного режиму окремо.\n\n## Приклад орієнтирів із кланових обговорень\n- **CDT -100%** проти критів.\n- **Ranged Defense ~100%**.\n- **Melee Defense ~100%**.\n- **Triple Hit ~100%**.\n- **Mega Crit ~30%**, якщо вистачає жовтих слотів.\n\nСеред звичайних афіксів пріоритет — **Attack Speed, Critical Damage, Critical Chance**, далі шкода та виживання залежно від конкретної речі. Це приклад із розмов, а не гарантовано доступні значення для кожного набору.\n\n## Чому не можна підняти все?\nКількість жовтих слотів обмежена. CDT чи Triple Hit понад межу марнують місце, а надмірний захист забирає слоти у шкоди. Так само надто великий акцент на Crit Chance може бути невигідним у PvP проти CDT.\n\n## Для кого?\nДля тих, хто хоче грати Boss Rush, підземелля і PvP війни без повної заміни спорядження перед кожним режимом.\n\n## Коли спеціалізуватися\nЯкщо сильно впав рейтинг босів або регулярно програєш суперникам із захисними білдами, варто подумати про другий набір речей.\n\n> Перед витратою десятків тисяч ящиків на білд краще порівняти його з реалістичними суперниками й босами в тестах."
    },
    "related": [
      "pvp-builds",
      "pve-builds",
      "affixes",
      "research"
    ]
  },
  {
    "id": "power",
    "category": "combat",
    "level": "beginner",
    "evidence": "observed",
    "title": {
      "en": "Why Power can be misleading",
      "uk": "Чому Power може обманювати"
    },
    "summary": {
      "en": "A bigger number doesn't always mean a stronger fighter.",
      "uk": "Більша цифра не завжди означає сильнішого бійця."
    },
    "body": {
      "en": "## Visible Power isn't battle performance\nPower is a convenient summary of character stats, but it does not necessarily capture the value of every affix interaction. In clan tests, lower-Power fighters sometimes beat players several times stronger on paper.\n\n## What Power can hide\n- Enemy **CDT -100%** reducing ordinary crit damage.\n- **Ranged or Melee Defense** countering your weapon type.\n- **Triple Hit and Mega Crit** changing offensive output.\n- **Attack Speed** influencing how many hits land before you die.\n- **Lifesteal, Block and companions** changing survival.\n- Whether you act before your opponent.\n\n## Evaluate gear in context\nA Divine piece with high base Health and Damage might raise Power but leave you vulnerable to crits. A lower-rarity piece with excellent CDT or defense may win more PvP fights.\n\n## Test process\n1. Record your current affix totals, not only Power.\n2. Make one controlled equipment change.\n3. Test the same dungeon stage or a similar set of opponents several times.\n4. Compare wins, survival and damage.\n5. Consider whether the new item enables a better future set even if it temporarily weakens the current one.\n\n> Power is a clue. Actual fights are the evidence.",
      "uk": "## Power — не бойова ефективність\nPower — зручна загальна цифра характеристик, але вона не обов'язково враховує цінність взаємодії афіксів. У кланових тестах бійці з меншим Power іноді перемагали тих, хто на папері сильніший у кілька разів.\n\n## Чого цифра Power не показує\n- **CDT -100%** ворога, який послаблює звичайні крити.\n- **Ranged або Melee Defense** проти твого типу зброї.\n- **Triple Hit і Mega Crit**, що змінюють атаку.\n- **Attack Speed**, який визначає кількість ударів до твоєї смерті.\n- **Lifesteal, Block і компаньйонів**, що покращують виживання.\n- Хто встигає атакувати першим.\n\n## Оцінюй речі в контексті\nDivine-річ із великими базовими Health і Damage може підняти Power, але залишити вразливість до критів. Річ нижчої рідкісності з чудовими CDT чи захистом іноді виграє більше PvP.\n\n## Як перевіряти\n1. Запиши сумарні афікси, а не лише Power.\n2. Зроби одну контрольовану заміну.\n3. Кілька разів протестуй той самий етап підземелля або подібних суперників.\n4. Порівняй перемоги, виживання та шкоду.\n5. Врахуй, чи допоможе нова річ зібрати кращий набір згодом, навіть якщо зараз слабша.\n\n> Power — підказка. Реальні бої — доказ."
    },
    "related": [
      "affixes",
      "pvp-builds",
      "gear-130"
    ]
  },
  {
    "id": "wings",
    "category": "combat",
    "level": "intermediate",
    "evidence": "observed",
    "title": {
      "en": "Wings, cloaks & rerolls",
      "uk": "Крила, плащі та перекручування"
    },
    "summary": {
      "en": "Choose permanent upgrades and avoid costly reroll mistakes.",
      "uk": "Обирай постійні покращення й не марнуй золото на рероли."
    },
    "body": {
      "en": "## Choose the stats for your build\nWings and cloaks can carry useful offensive and defensive bonuses. Attack Speed is a common high-priority roll. For ranged PvE, Critical Damage, Critical Chance and Ranged Damage may be attractive; for melee PvP, Lifesteal, Melee Damage and Block can matter more.\n\n## Locking good affixes\nSome reroll systems let you lock existing good stats while rerolling the rest. The more affixes you lock, the more expensive the remaining rolls can become. High-level players have reported substantial gold costs.\n\n## A practical process\n1. Decide whether you are building for PvP, PvE or both.\n2. Find a good Attack Speed roll if your setup benefits from it.\n3. Keep a strong secondary stat rather than endlessly rerolling toward perfect percentages.\n4. Save gold before locking many affixes.\n5. Revisit the item later after your main gear and masteries have progressed.\n\n## Don't copy blindly\nFor a ranged attacker, Melee Damage contributes little. For melee PvP, Ranged Damage is similarly poor. Normal Crit Chance is useful in PvE but may lose value against full CDT in PvP.\n\n> The best wings are the ones that solve a real weakness in your current build, not the ones with the prettiest isolated percentages.",
      "uk": "## Обирай характеристики під свій білд\nКрила й плащі можуть мати корисні атакувальні та захисні бонуси. Attack Speed часто є одним із найкращих ролів. Для дальнього PvE привабливі Critical Damage, Critical Chance та Ranged Damage; для ближнього PvP можуть бути важливіші Lifesteal, Melee Damage і Block.\n\n## Блокування хороших афіксів\nУ системах перекручування можна закріплювати вдалі характеристики й міняти решту. Що більше афіксів заблоковано, то дорожче можуть обходитися наступні спроби. Гравці високих рівнів повідомляли про значні витрати золота.\n\n## Практичний підхід\n1. Визнач, чи збираєш PvP, PvE чи гібрид.\n2. Спробуй отримати хороший Attack Speed, якщо він корисний твоєму білду.\n3. Залишай сильну другу характеристику замість нескінченної гонитви за ідеальним відсотком.\n4. Накопич золото до блокування багатьох афіксів.\n5. Повертайся до крил пізніше, коли основне спорядження й майстерність підростуть.\n\n## Не копіюй чужі поради бездумно\nСтрільцеві майже не потрібен Melee Damage. Для ближнього PvP так само поганий Ranged Damage. Звичайний Crit Chance корисний у PvE, але може втрачати цінність проти повного CDT в PvP.\n\n> Найкращі крила — ті, що закривають реальну слабкість твого поточного білда, а не просто мають найкрасивіші відсотки."
    },
    "related": [
      "affixes",
      "masteries",
      "mining",
      "pvp-builds"
    ]
  }
];
