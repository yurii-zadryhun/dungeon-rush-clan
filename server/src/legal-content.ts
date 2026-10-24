export type Locale = 'uk' | 'en';
export type LegalPage = 'about' | 'privacy' | 'terms';

interface Section {
  heading: string;
  paragraphs: string[];
}
interface Document {
  title: string;
  description: string;
  sections: Section[];
}

export const legalContent: Record<Locale, Record<LegalPage, Document>> = {
  en: {
    about: {
      title: 'About',
      description: 'A community-made clan war archive for Ukrainians in Dungeon Rush.',
      sections: [
        {
          heading: 'The project',
          paragraphs: [
            'We built this site to preserve clan war results and help members track their progress. Guests see our clan, wins, losses and recent war outcomes. Player scores, private notes, guides and the AI assistant are for members only.',
            'This is an independent fan project. It is not affiliated with, operated by or endorsed by Dungeon Rush or its developers.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'Use Get in touch on the public clan page to reach the administrator. The Privacy and Terms pages explain personal-data requests and the rules for using the archive.',
          ],
        },
      ],
    },
    privacy: {
      title: 'Privacy',
      description: 'How the Ukrainians clan archive handles account and gameplay-history data.',
      sections: [
        {
          heading: 'Operator and contact',
          paragraphs: [
            'This independent website is run by the Ukrainians clan administrator, not the game developer. Use the contact link below to reach the operator, including for personal-data requests. Further identifying contact details of the responsible operator can be requested directly.',
            'This notice applies to this clan website, not to Dungeon Rush, Discord, Telegram or other third-party websites.',
          ],
        },
        {
          heading: 'What we process',
          paragraphs: [
            'Accounts: username, password hash (not plaintext password), preferred language, role, registration date and sessions. The login session uses a secure HTTP-only SameSite cookie valid for up to seven days, renewed during active use. A language preference may also be kept in your browser.',
            'War records: in-game names, rankings, scores, opponents, MVP and final results. Staff import some records from screenshots, including records from before a player registered here.',
            'Management-only information: optional contact handles and flags, notes about members, exceptions and tags. This information is restricted to authorized clan staff.',
            'Technical data: hosting and proxy logs may contain IP addresses, request timestamps and user-agent information for operations and security.',
          ],
        },
        {
          heading: 'Third parties',
          paragraphs: [
            'The service is hosted on third-party infrastructure. Screenshots uploaded by staff are processed through Google Cloud Vision; extracted OCR text is cached on the server. The member-only AI assistant sends questions and selected game-guide text to a Google AI API. Service-provider terms and their handling of request data apply.',
            'Telegram or Discord links open those services independently. We do not embed third-party advertising trackers on the public pages. Processing locations and possible cross-border transfers depend on the hosting and provider configuration; you may request details.',
          ],
        },
        {
          heading: 'Purposes and retention',
          paragraphs: [
            'Account and session data enable authentication and security. Member coordination and the maintenance of accurate historic clan records are legitimate operational purposes.',
            'Account data is normally retained until account deletion. Sessions expire after up to seven days. War history may be kept for the duration of the archive. Security logs, OCR caches and backups may have separate retention periods; ask the operator for the applicable details.',
          ],
        },
        {
          heading: 'Deletion and your rights',
          paragraphs: [
            'In Profile you can delete your site account after entering its password. This removes login credentials, active sessions, account links, and staff-only contact labels and notes about the associated player. It preserves the distinct historic war records and in-game nicknames.',
            'A game nickname and historic result can still be personal data. Requests to correct, anonymize or erase them can be sent to the operator and will be reviewed individually; retention is not automatically justified simply because a record is historical.',
            'Depending on applicable law, you may request access, correction, deletion, restriction or portability of personal data, object to processing or complain to the relevant data-protection authority. We may ask you to confirm your identity before responding.',
          ],
        },
      ],
    },
    terms: {
      title: 'Terms & disclaimer',
      description: 'Simple rules for this independent Dungeon Rush clan archive.',
      sections: [
        {
          heading: 'Independent fan site',
          paragraphs: [
            'This unofficial community project is not associated with or approved by the developers of Dungeon Rush. Game names and artwork belong to their respective owners.',
            'Guests can view clan history; internal tools are available only to invited members. Management may correct records or change access.',
          ],
        },
        {
          heading: 'Safe use',
          paragraphs: [
            'Use a unique password for this website. Never enter your Dungeon Rush game password here: it is not needed.',
            'Do not misuse accounts, upload material without permission, deliberately falsify records, interfere with the service or expose private information about other players.',
          ],
        },
        {
          heading: 'Accuracy',
          paragraphs: [
            'Screenshots, rankings and game guides may include transcription errors or estimates. This is a volunteer tool, provided without a promise of continuous availability or complete accuracy.',
          ],
        },
        {
          heading: 'Note for community moderators',
          paragraphs: [
            'This website records clan history; it does not modify the game client or automate gameplay. Our assistant and internal tools are member-only. If a particular page or feature raises a question, please contact the administrator so we can clarify it.',
          ],
        },
      ],
    },
  },
  uk: {
    about: {
      title: 'Про сайт',
      description: 'Незалежний архів воєн клану Ukrainians у Dungeon Rush.',
      sections: [
        {
          heading: 'Наш проєкт',
          paragraphs: [
            'Ми створили цей сайт, щоб зберігати історію воєн і допомагати сокланівцям бачити прогрес. Гості бачать клан і підсумки боїв; особисті рейтинги, нотатки, гайди й ШІ-помічник доступні тільки учасникам.',
            'Це незалежний фанатський проєкт, не пов’язаний із розробниками Dungeon Rush та не схвалений ними.',
          ],
        },
        {
          heading: 'Зв’язок',
          paragraphs: [
            'Напишіть адміністратору через кнопку зв’язку на публічній сторінці. У розділах «Конфіденційність» та «Умови» описані запити щодо даних і правила сайту.',
          ],
        },
      ],
    },
    privacy: {
      title: 'Конфіденційність',
      description: 'Як архів клану Ukrainians обробляє дані акаунтів та історії гри.',
      sections: [
        {
          heading: 'Хто відповідає за сайт',
          paragraphs: [
            'Цей незалежний сайт підтримує адміністратор клану Ukrainians, а не розробники гри. Для звернень щодо особистих даних скористайтеся контактним посиланням нижче. Додаткові реквізити відповідальної особи можна запросити особисто.',
            'Ця політика стосується лише архіву клану, а не Dungeon Rush, Discord, Telegram та інших сторонніх сервісів.',
          ],
        },
        {
          heading: 'Які дані ми обробляємо',
          paragraphs: [
            'Акаунт: нік, хеш пароля (не сам пароль), мова, роль, дата створення та сесії. Для входу використовується захищене HTTP-only SameSite cookie до семи днів із поновленням під час активності. Мова може зберігатися локально у браузері.',
            'Історія воєн: ігрові імена, рейтинги, очки, суперники, MVP і підсумки битв. Керівництво імпортує частину даних зі скриншотів; ці записи можуть передувати реєстрації гравця на сайті.',
            'Дані для керівництва: необов’язкові контакти та прапорці Telegram/Discord, теги, винятки й датовані нотатки. Вони доступні лише уповноваженим керівникам.',
            'Технічні дані: хостинг і проксі можуть зберігати IP-адреси, час запитів і дані браузера для безпеки та діагностики.',
          ],
        },
        {
          heading: 'Сторонні сервіси',
          paragraphs: [
            'Сайт працює на сторонньому хостингу. Скриншоти, завантажені керівництвом, надсилаються до Google Cloud Vision для розпізнавання; розпізнаний текст кешується на сервері. ШІ-помічник для учасників передає запитання й вибрані уривки гайдів до Google AI API. Для постачальників діють їхні умови обробки.',
            'Посилання Telegram і Discord відкривають окремі сервіси. На публічних сторінках немає вбудованих рекламних трекерів. Розташування серверів і міжнародне передавання даних залежать від конфігурації постачальників; деталі можна запитати.',
          ],
        },
        {
          heading: 'Навіщо й на який строк',
          paragraphs: [
            'Акаунт і сесії потрібні для входу та захисту сервісу. Координація команди й точність історії клану — інші важливі цілі обробки.',
            'Акаунт зберігається до видалення. Сесії діють до семи днів. Історія воєн може зберігатися протягом існування архіву. Для логів безпеки, OCR-кешу та резервних копій можуть діяти інші строки; їх можна уточнити в адміністратора.',
          ],
        },
        {
          heading: 'Видалення та ваші права',
          paragraphs: [
            'У профілі можна видалити акаунт, підтвердивши пароль. При цьому стираються облікові дані, сесії, зв’язок із гравцем, приватні контакти та нотатки про нього. Історичні результати воєн та ігрові ніки автоматично не стираються.',
            'Ігровий нік та історичний результат теж можуть бути персональними даними. Зверніться для виправлення, знеособлення чи видалення: такі запити розглядаються індивідуально, а не відхиляються автоматично через історичний характер запису.',
            'Залежно від застосовного права можна вимагати доступ, виправлення, видалення, обмеження чи перенесення даних, заперечити обробку або звернутися до органу захисту даних. Для відповіді може знадобитися підтвердження особи.',
          ],
        },
      ],
    },
    terms: {
      title: 'Умови та застереження',
      description: 'Правила користування незалежним архівом клану Ukrainians.',
      sections: [
        {
          heading: 'Незалежний сайт',
          paragraphs: [
            'Це неофіційний проєкт спільноти, не пов’язаний із розробниками Dungeon Rush і не схвалений ними. Назви та матеріали гри належать відповідним власникам.',
            'Гості можуть переглядати історію клану, внутрішні інструменти — лише запрошені учасники. Керівництво може виправляти записи й змінювати доступ.',
          ],
        },
        {
          heading: 'Безпечне користування',
          paragraphs: [
            'Використовуйте окремий пароль для цього сайту. Ніколи не вводьте тут пароль від Dungeon Rush: він нам не потрібний.',
            'Не намагайтеся потрапити в чужий акаунт, підробляти записи, заважати роботі сайту або поширювати приватні дані інших гравців.',
          ],
        },
        {
          heading: 'Точність',
          paragraphs: [
            'У скриншотах, рейтингах і гайдах можуть бути помилки розпізнавання чи приблизні оцінки. Це добровільний проєкт без гарантії безперебійної роботи або абсолютної точності.',
          ],
        },
        {
          heading: 'Для модераторів спільноти',
          paragraphs: [
            'Сайт зберігає історію клану: він не змінює гру й не автоматизує ігровий процес. ШІ-помічник та внутрішні інструменти доступні лише сокланівцям. Якщо певна сторінка чи функція викликає запитання, зв’яжіться з адміністратором — ми все пояснимо.',
          ],
        },
      ],
    },
  },
};
