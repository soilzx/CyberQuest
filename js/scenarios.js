/*
 * CyberQuest — scenario data (English and Arabic)
 *
 * Every player-facing text is an object { en, ar } so the two languages
 * stay side by side. Each decision follows the same structure:
 *   situation – what is happening
 *   clues     – what the player can discover by clicking (`at` says where)
 *   question  – exactly what the player decides
 *   choices   – two or three specific actions, each with its own feedback
 *
 * All events are fictional. Domains use the reserved ".example" TLD.
 * `telemetry` is what NEXUS (the rule-based AI) may read; it never sees
 * the clues, which is why it sometimes gets things wrong.
 */
(function (CQ) {
  'use strict';

  var devices = ['internet', 'server', 'computer', 'database'];

  /* ------------------------------------------------------------------ */
  /* Mission 1: Spot the Threat                                           */
  /* ------------------------------------------------------------------ */
  var mission1 = [
    {
      id: 'm1-upload',
      truth: 'malicious',
      nexus: 'nx.m1.first',
      title: { en: 'Files leaving at night', ar: 'ملفات تخرج في منتصف الليل' },
      situation: {
        en: 'At 2:00 a.m., an office computer started sending thousands of company files to a website nobody recognizes. No file transfer was scheduled.',
        ar: 'في الساعة 2:00 فجرًا، بدأ كمبيوتر في المكتب بإرسال آلاف من ملفات الشركة إلى موقع إلكتروني لا يعرفه أحد، ولم يكن هناك أي نقل ملفات مجدول.'
      },
      visual: { type: 'network', from: 'computer', to: 'internet', focus: 'computer', tag: { en: 'Sending files', ar: 'يرسل ملفات' } },
      clues: [
        { at: 'computer', text: { en: 'The office is empty. The computer’s owner went home at 6:00 p.m.', ar: 'المكتب فارغ، وصاحب الكمبيوتر غادر الساعة 6:00 مساءً.' } },
        { at: 'internet', text: { en: 'The website was created only 3 days ago.', ar: 'الموقع الإلكتروني أُنشئ قبل 3 أيام فقط.' } }
      ],
      question: { en: 'What is the safest first action?', ar: 'ما أكثر تصرّف آمن تبدأ به؟' },
      choices: [
        { id: 'disconnect', grade: 'best', points: 100, effects: { threat: -20 }, node: 'blocked', contained: true,
          label: { en: 'Disconnect this computer from the network and tell IT', ar: 'افصل هذا الكمبيوتر عن الشبكة وأبلغ فريق التقنية' },
          feedback: { en: 'Correct! Files are leaving with no good reason. Disconnecting only this computer stops the leak without disturbing anyone else.', ar: 'إجابة صحيحة! الملفات تخرج بدون أي سبب مقنع. فصل هذا الكمبيوتر وحده يوقف التسريب دون إزعاج أي أحد آخر.' } },
        { id: 'ignore', grade: 'wrong', points: -80, effects: { integrity: -20, threat: 15 }, node: 'danger',
          label: { en: 'Ignore it, because the computer is still working normally', ar: 'تجاهله، لأن الكمبيوتر ما زال يعمل بشكل طبيعي' },
          feedback: { en: 'Those files were being stolen. A computer can work normally and still be leaking data. This is called data theft.', ar: 'هذه الملفات كانت تُسرق. قد يعمل الكمبيوتر بشكل طبيعي وهو يسرّب البيانات، وهذا يسمّى سرقة البيانات.' } },
        { id: 'shutdown', grade: 'acceptable', points: 40, effects: { threat: -20, stability: -25 }, node: 'blocked', contained: true,
          label: { en: 'Shut down the whole company network until tomorrow', ar: 'أطفئ شبكة الشركة كلها حتى الغد' },
          feedback: { en: 'That stops the leak, but everyone in the company loses their work too. Disconnecting only the affected computer was enough.', ar: 'هذا يوقف التسريب، لكن كل من في الشركة سيتوقف عن العمل أيضًا. كان يكفي فصل الكمبيوتر المتأثر فقط.' } }
      ]
    },
    {
      id: 'm1-email',
      truth: 'malicious',
      nexus: 'nx.m1.email',
      title: { en: 'An urgent email about your password', ar: 'رسالة عاجلة عن كلمة المرور' },
      situation: {
        en: 'An employee receives this email. It says their account will be closed in 1 hour unless they enter their password.',
        ar: 'وصلت هذه الرسالة إلى بريد أحد الموظفين. تقول إن حسابه سيُغلق خلال ساعة واحدة إلا إذا أدخل كلمة المرور.'
      },
      visual: {
        type: 'email',
        sender: { en: 'IT Help Desk', ar: 'الدعم الفني' },
        address: 'support@account-check.example',
        subject: { en: 'Urgent: your account will be closed today', ar: 'عاجل: سيتم إغلاق حسابك اليوم' },
        body: { en: 'We found a problem with your account. Enter your password within 1 hour or you will lose access.', ar: 'وجدنا مشكلة في حسابك. أدخل كلمة المرور خلال ساعة واحدة وإلا ستفقد الوصول إلى حسابك.' },
        button: { en: 'Verify my password', ar: 'تحقّق من كلمة المرور' }
      },
      clues: [
        { at: 'sender', text: { en: 'The sender’s address ends in “account-check.example”, not your organization’s own address.', ar: 'عنوان المرسل ينتهي بـ «account-check.example» وليس بعنوان جهتك الرسمي.' } },
        { at: 'button', text: { en: 'The button opens an unknown website, not your real login page. Real IT teams never ask for your password by email.', ar: 'الزر يفتح موقعًا مجهولًا وليس صفحة الدخول الحقيقية. وفريق التقنية الحقيقي لا يطلب كلمة المرور عبر البريد أبدًا.' } }
      ],
      question: { en: 'What should the employee do with this email?', ar: 'ماذا يجب أن يفعل الموظف بهذه الرسالة؟' },
      choices: [
        { id: 'enter', grade: 'wrong', points: -60, effects: { integrity: -15, threat: 10 },
          label: { en: 'Click the button and enter the password to keep the account', ar: 'يضغط الزر ويُدخل كلمة المرور حتى لا يُغلق حسابه' },
          feedback: { en: 'This email was a trap called phishing: a fake message built to steal passwords. The rush and the strange address were the warning signs.', ar: 'هذه الرسالة فخ يسمّى «التصيّد الاحتيالي»: رسالة مزيفة هدفها سرقة كلمات المرور. الاستعجال والعنوان الغريب كانا علامتي التحذير.' } },
        { id: 'report', grade: 'best', points: 100, effects: { threat: -10 }, contained: true,
          label: { en: 'Report it to IT as a scam, then delete it', ar: 'يبلّغ فريق التقنية بأنها رسالة احتيال، ثم يحذفها' },
          feedback: { en: 'Correct! This is phishing: a fake message designed to steal passwords. Reporting it helps IT warn everyone else.', ar: 'إجابة صحيحة! هذا تصيّد احتيالي: رسالة مزيفة هدفها سرقة كلمات المرور. والإبلاغ عنها يساعد فريق التقنية على تحذير الجميع.' } },
        { id: 'reply', grade: 'wrong', points: -30, effects: { threat: 5 },
          label: { en: 'Reply to the sender and ask if the email is real', ar: 'يرد على المرسل ويسأله إن كانت الرسالة حقيقية' },
          feedback: { en: 'Replying goes straight to the scammer, who will say it is real, and it tells them your address works. Report it to IT instead.', ar: 'الرد يصل مباشرة إلى المحتال، وسيقول إنها حقيقية، كما يعرف أن عنوانك فعّال. الأفضل إبلاغ فريق التقنية.' } }
      ]
    },
    {
      id: 'm1-scan',
      truth: 'benign',
      nexus: 'nx.m1.scan',
      title: { en: 'Thousands of tries on the server', ar: 'آلاف المحاولات على الخادم' },
      situation: {
        en: 'A computer inside the company is quickly testing every way into the server: 2,400 tries in 90 seconds. It looks like someone searching for a way in.',
        ar: 'كمبيوتر داخل الشركة يجرّب بسرعة كل طرق الدخول إلى الخادم: 2,400 محاولة خلال 90 ثانية. يبدو وكأن أحدًا يبحث عن ثغرة للدخول.'
      },
      visual: { type: 'network', from: 'computer', to: 'server', focus: 'server', tag: { en: '2,400 tries', ar: '2,400 محاولة' } },
      clues: [
        { at: 'computer', text: { en: 'This computer belongs to the company’s own IT security team.', ar: 'هذا الكمبيوتر تابع لفريق الأمن في قسم التقنية بالشركة نفسها.' } },
        { at: 'server', text: { en: 'The IT calendar shows a planned security check today at 9:30 a.m. It is 9:31 a.m. now.', ar: 'تقويم فريق التقنية فيه فحص أمني مخطط له اليوم الساعة 9:30 صباحًا، والساعة الآن 9:31.' } }
      ],
      question: { en: 'What should you do about this activity?', ar: 'ماذا تفعل بخصوص هذا النشاط؟' },
      choices: [
        { id: 'block', grade: 'wrong', points: -40, effects: { stability: -10 }, node: 'blocked',
          label: { en: 'Block the IT team’s computer from the server', ar: 'امنع كمبيوتر فريق التقنية من الوصول إلى الخادم' },
          feedback: { en: 'This was the IT team’s planned safety check. Blocking it stops them from finding weak spots before real attackers do.', ar: 'كان هذا فحص الأمان المخطط له من فريق التقنية. منعه يوقفهم عن اكتشاف نقاط الضعف قبل المهاجمين الحقيقيين.' } },
        { id: 'allow', grade: 'best', points: 100, effects: {}, node: 'safe',
          label: { en: 'Let it continue, because it is the planned security check', ar: 'اسمح له بالاستمرار، لأنه الفحص الأمني المخطط له' },
          feedback: { en: 'Correct! It looked like an attack, but the clues show the IT team checking for weak spots, as planned. Unusual does not always mean dangerous.', ar: 'إجابة صحيحة! بدا كأنه هجوم، لكن الأدلة تُظهر أنه فريق التقنية يفحص نقاط الضعف كما هو مخطط. غير المعتاد ليس دائمًا خطيرًا.' } },
        { id: 'shutdown', grade: 'wrong', points: -50, effects: { stability: -20 }, node: 'blocked',
          label: { en: 'Turn off the server until tomorrow, just in case', ar: 'أطفئ الخادم حتى الغد من باب الاحتياط' },
          feedback: { en: 'Nothing harmful was happening, but now the server is off and nobody can use it. Check the clues before taking big actions.', ar: 'لم يكن هناك أي ضرر، لكن الخادم الآن مطفأ ولا يستطيع أحد استخدامه. تحقّق من الأدلة قبل اتخاذ قرارات كبيرة.' } }
      ]
    },
    {
      id: 'm1-update',
      truth: 'benign',
      nexus: 'nx.m1.update',
      title: { en: 'Someone is changing the website', ar: 'شخص يعدّل الموقع الإلكتروني' },
      situation: {
        en: 'At 11:00 a.m., a staff member logs in to the website server and starts changing its files.',
        ar: 'في الساعة 11:00 صباحًا، سجّل أحد الموظفين الدخول إلى خادم الموقع الإلكتروني وبدأ يعدّل ملفاته.'
      },
      visual: { type: 'network', from: 'computer', to: 'server', focus: 'server', tag: { en: 'Changing files', ar: 'يعدّل الملفات' } },
      clues: [
        { at: 'server', text: { en: 'The IT manager approved this website update this morning.', ar: 'مدير التقنية وافق على تحديث الموقع هذا الصباح.' } },
        { at: 'computer', text: { en: 'The staff member confirmed the login with a code sent to their own phone.', ar: 'أكّد الموظف تسجيل الدخول برمز وصل إلى جواله الشخصي.' } }
      ],
      question: { en: 'Should this activity be allowed?', ar: 'هل يجب السماح بهذا النشاط؟' },
      choices: [
        { id: 'allow', grade: 'best', points: 100, effects: {}, node: 'safe',
          label: { en: 'Yes, allow the approved update', ar: 'نعم، اسمح بالتحديث المعتمد' },
          feedback: { en: 'Correct. This is planned, approved work, and the login was confirmed. Good security also means not blocking people who are doing their jobs.', ar: 'إجابة صحيحة. هذا عمل مخطط ومعتمد، وتسجيل الدخول مؤكَّد. الأمن الجيد يعني أيضًا ألا نمنع الناس من أداء أعمالهم.' } },
        { id: 'lock', grade: 'wrong', points: -50, effects: { stability: -15 }, node: 'blocked',
          label: { en: 'No, lock the staff member’s account', ar: 'لا، أوقف حساب الموظف' },
          feedback: { en: 'The update was approved and the login was confirmed. Locking the account stops important updates from reaching the website.', ar: 'التحديث كان معتمدًا وتسجيل الدخول مؤكَّدًا. إيقاف الحساب يمنع وصول تحديثات مهمة إلى الموقع.' } },
        { id: 'offline', grade: 'wrong', points: -60, effects: { stability: -25 }, node: 'blocked',
          label: { en: 'No, undo all the changes and take the website offline', ar: 'لا، ألغِ كل التعديلات وأوقف الموقع' },
          feedback: { en: 'The changes were approved. Taking the website offline hurts customers and stops a planned update. Check the clues first.', ar: 'التعديلات كانت معتمدة. إيقاف الموقع يضر العملاء ويوقف تحديثًا مخططًا له. تحقّق من الأدلة أولًا.' } }
      ]
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 2: Teach the AI                                              */
  /* x: [wrong passwords, unusual time, risky website, data amount,      */
  /*     new device], each scaled 0 to 1. The player supplies the labels.*/
  /* `truth` is used only afterwards, to explain how the player did.     */
  /* ------------------------------------------------------------------ */
  var features = ['failed', 'time', 'reputation', 'volume', 'device'];

  var training = [
    { id: 'T1', icon: 'login', x: [0.05, 0.1, 0.05, 0.1, 0.0], truth: 'benign',
      title: { en: 'Morning login from the usual laptop', ar: 'تسجيل دخول صباحي من اللابتوب المعتاد' },
      clues: [{ en: '8:55 a.m.', ar: '8:55 صباحًا' }, { en: '1 wrong password', ar: 'كلمة مرور خاطئة واحدة' }, { en: 'Usual laptop', ar: 'اللابتوب المعتاد' }] },
    { id: 'T2', icon: 'login', x: [0.9, 0.9, 0.5, 0.2, 1.0], truth: 'malicious',
      title: { en: '45 wrong passwords, then a login from a new device', ar: '45 كلمة مرور خاطئة، ثم دخول من جهاز جديد' },
      clues: [{ en: '3:02 a.m.', ar: '3:02 فجرًا' }, { en: '45 wrong passwords', ar: '45 كلمة مرور خاطئة' }, { en: 'Never-seen device', ar: 'جهاز لم يُرَ من قبل' }] },
    { id: 'T3', icon: 'upload', x: [0.1, 0.8, 0.85, 0.95, 0.3], truth: 'malicious',
      title: { en: 'Huge upload to a brand-new website', ar: 'رفع ملفات ضخمة إلى موقع جديد تمامًا' },
      clues: [{ en: '1:40 a.m.', ar: '1:40 فجرًا' }, { en: '9 GB of files', ar: 'ملفات حجمها 9 جيجابايت' }, { en: 'Website made 3 days ago', ar: 'موقع أُنشئ قبل 3 أيام' }] },
    { id: 'T4', icon: 'login', x: [0.1, 0.6, 0.2, 0.2, 0.1], truth: 'benign',
      title: { en: 'Evening login from an employee’s home', ar: 'تسجيل دخول مسائي من منزل موظف' },
      clues: [{ en: '8:15 p.m.', ar: '8:15 مساءً' }, { en: 'Their own laptop', ar: 'اللابتوب الخاص به' }, { en: 'Normal amount of data', ar: 'كمية بيانات طبيعية' }] },
    { id: 'T5', icon: 'upload', x: [0.0, 0.4, 0.95, 0.15, 0.2], truth: 'malicious',
      title: { en: 'Small messages to a known hacker website', ar: 'رسائل صغيرة إلى موقع معروف للمخترقين' },
      clues: [{ en: '4:30 p.m.', ar: '4:30 عصرًا' }, { en: 'Website on a blocked list', ar: 'الموقع في قائمة المحظورات' }, { en: 'Small amount of data', ar: 'كمية بيانات صغيرة' }] },
    { id: 'T6', icon: 'upload', x: [0.0, 0.2, 0.15, 0.8, 0.0], truth: 'benign',
      title: { en: 'Monthly report sent to a trusted partner', ar: 'تقرير شهري أُرسل إلى شريك موثوق' },
      clues: [{ en: '10:00 a.m.', ar: '10:00 صباحًا' }, { en: '4 GB of files', ar: 'ملفات حجمها 4 جيجابايت' }, { en: 'Trusted partner company', ar: 'شركة شريكة موثوقة' }] },
    { id: 'T7', icon: 'login', x: [0.05, 0.2, 0.1, 0.1, 0.9], truth: 'benign',
      title: { en: 'New phone set up by the IT team', ar: 'جوال جديد جهّزه فريق التقنية' },
      clues: [{ en: '9:20 a.m.', ar: '9:20 صباحًا' }, { en: 'Never-seen device', ar: 'جهاز لم يُرَ من قبل' }, { en: 'Set up by IT', ar: 'جهّزه فريق التقنية' }] },
    { id: 'T8', icon: 'login', x: [1.0, 0.3, 0.6, 0.05, 0.8], truth: 'malicious',
      title: { en: 'Someone guessing passwords on many accounts', ar: 'شخص يخمّن كلمات المرور في حسابات كثيرة' },
      clues: [{ en: '11:10 a.m.', ar: '11:10 صباحًا' }, { en: '300+ wrong passwords', ar: 'أكثر من 300 كلمة مرور خاطئة' }, { en: '40 different accounts', ar: '40 حسابًا مختلفًا' }] }
  ];

  // New examples the AI has never seen. Never used for training.
  var testSet = [
    { id: 'Q1', x: [0.85, 0.7, 0.55, 0.1, 0.9], truth: 'malicious', title: { en: 'Many wrong passwords from an unknown laptop', ar: 'كلمات مرور خاطئة كثيرة من لابتوب مجهول' } },
    { id: 'Q2', x: [0.0, 0.15, 0.1, 0.15, 0.05], truth: 'benign', title: { en: 'Normal morning login', ar: 'تسجيل دخول صباحي عادي' } },
    { id: 'Q3', x: [0.05, 0.85, 0.8, 0.9, 0.4], truth: 'malicious', title: { en: 'Night-time upload to an unfamiliar website', ar: 'رفع ملفات ليلًا إلى موقع غير مألوف' } },
    { id: 'Q4', x: [0.0, 0.3, 0.3, 0.85, 0.05], truth: 'benign', title: { en: 'Big design files shared with a partner', ar: 'ملفات تصميم كبيرة أُرسلت إلى شريك' } },
    { id: 'Q5', x: [0.1, 0.3, 0.15, 0.1, 0.85], truth: 'benign', title: { en: 'New laptop given out by IT', ar: 'لابتوب جديد سلّمه فريق التقنية' } },
    { id: 'Q6', x: [0.05, 0.5, 0.9, 0.2, 0.3], truth: 'malicious', title: { en: 'Quiet messages to a blocked website', ar: 'رسائل هادئة إلى موقع محظور' } }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 3: Can You Trust the AI?                                     */
  /* NEXUS reads `telemetry` and suggests 'contain' or 'allow'.           */
  /* ------------------------------------------------------------------ */
  var mission3 = [
    {
      id: 'm3-beacon',
      truth: 'malicious',
      correctBand: 'contain',
      telemetry: { periodic: true, periodSeconds: 60, destination: 'flagged', processSigned: false, volumeRatio: 1 },
      title: { en: 'A computer keeps contacting an outside server', ar: 'كمبيوتر يتواصل باستمرار مع خادم خارجي' },
      situation: { en: 'Every 60 seconds, all day long, an office computer sends a tiny message to the same server on the internet.', ar: 'كل 60 ثانية، وطوال اليوم، يرسل كمبيوتر في المكتب رسالة صغيرة إلى نفس الخادم على الإنترنت.' },
      visual: { from: 'computer', to: 'internet', focus: 'computer', tag: { en: 'Every 60 seconds', ar: 'كل 60 ثانية' } },
      clues: [
        { at: 'internet', text: { en: 'That server is on a public list of servers used by hackers.', ar: 'هذا الخادم موجود في قائمة عامة لخوادم يستخدمها المخترقون.' } },
        { at: 'computer', text: { en: 'The program sending the messages is pretending to be a normal Windows file.', ar: 'البرنامج الذي يرسل الرسائل يتظاهر بأنه ملف عادي من ملفات ويندوز.' } }
      ],
      actions: { contain: { en: 'Disconnect the computer', ar: 'افصل الكمبيوتر' }, allow: { en: 'Let it keep running', ar: 'اتركه يعمل' } },
      outcomes: {
        contain: { points: 100, effects: { threat: -15 }, node: 'blocked', contained: true,
          text: { en: 'NEXUS was right, and the clues agreed. A hidden program was secretly checking in with hackers.', ar: 'نيكسس كان محقًا والأدلة تؤكد ذلك. برنامج مخفي كان يتواصل سرًا مع المخترقين.' } },
        allow: { points: -60, effects: { integrity: -15, threat: 15 }, node: 'danger',
          text: { en: 'NEXUS was right this time. The hidden program kept its secret line to the hackers open.', ar: 'كان نيكسس محقًا هذه المرة. البرنامج المخفي استمر في التواصل السري مع المخترقين.' } }
      }
    },
    {
      id: 'm3-backup',
      truth: 'benign',
      correctBand: 'allow',
      telemetry: { volumeRatio: 8, offHours: true, privileged: true, destination: 'new' },
      title: { en: 'A huge copy of the database at night', ar: 'نسخة ضخمة من قاعدة البيانات ليلًا' },
      situation: { en: 'At 1:00 a.m. on the last night of the month, the database starts copying 38 GB of data to a storage system.', ar: 'في الساعة 1:00 فجرًا في آخر ليلة من الشهر، بدأت قاعدة البيانات بنسخ 38 جيجابايت من البيانات إلى نظام تخزين.' },
      visual: { from: 'database', to: 'server', focus: 'database', tag: { en: 'Copying 38 GB', ar: 'ينسخ 38 جيجابايت' } },
      clues: [
        { at: 'database', text: { en: 'This copy runs automatically on the last night of every month. It is the monthly backup.', ar: 'هذا النسخ يعمل تلقائيًا في آخر ليلة من كل شهر. إنها النسخة الاحتياطية الشهرية.' } },
        { at: 'server', text: { en: 'The storage system is brand new, so NEXUS has never seen it before.', ar: 'نظام التخزين جديد تمامًا، لذلك لم يره نيكسس من قبل.' } }
      ],
      actions: { contain: { en: 'Block the copy', ar: 'امنع النسخ' }, allow: { en: 'Let the backup run', ar: 'اسمح للنسخة الاحتياطية بالعمل' } },
      outcomes: {
        allow: { points: 150, effects: {}, node: 'safe',
          text: { en: 'NEXUS only saw a big transfer at night. The clues showed it was the planned monthly backup. This kind of AI mistake is called a false alarm.', ar: 'نيكسس رأى فقط نقل بيانات كبيرًا في الليل، لكن الأدلة أظهرت أنها النسخة الاحتياطية الشهرية. هذا النوع من أخطاء الذكاء الاصطناعي يسمّى «إنذارًا كاذبًا».' } },
        contain: { points: -60, effects: { stability: -20 }, node: 'blocked',
          text: { en: 'The backup was blocked, so the company has no fresh copy of its data. NEXUS raised a false alarm, and the clues showed it.', ar: 'تم منع النسخة الاحتياطية، فلم يعد لدى الشركة نسخة حديثة من بياناتها. نيكسس أطلق إنذارًا كاذبًا، والأدلة كانت توضح ذلك.' } }
      }
    },
    {
      id: 'm3-update',
      truth: 'benign',
      correctBand: 'allow',
      telemetry: { volumeRatio: 2, destination: 'known', processSigned: true },
      title: { en: 'A laptop is downloading a big file', ar: 'لابتوب يحمّل ملفًا كبيرًا' },
      situation: { en: 'A company laptop is downloading a 1.8 GB file from a well-known software company.', ar: 'لابتوب تابع للشركة يحمّل ملفًا حجمه 1.8 جيجابايت من شركة برامج معروفة.' },
      visual: { from: 'internet', to: 'computer', focus: 'computer', tag: { en: 'Downloading', ar: 'يحمّل' } },
      clues: [
        { at: 'internet', text: { en: 'The file is an official security update from that software company.', ar: 'الملف تحديث أمني رسمي من شركة البرامج نفسها.' } },
        { at: 'computer', text: { en: '212 other company laptops installed the same update with no problems.', ar: '212 لابتوب آخر في الشركة ثبّتت التحديث نفسه بدون أي مشاكل.' } }
      ],
      actions: { contain: { en: 'Block the download', ar: 'امنع التحميل' }, allow: { en: 'Allow the update', ar: 'اسمح بالتحديث' } },
      outcomes: {
        allow: { points: 100, effects: {}, node: 'safe',
          text: { en: 'NEXUS was right and the clues agreed. Only disagree with the AI when the clues give you a reason.', ar: 'نيكسس كان محقًا والأدلة تتفق معه. خالف الذكاء الاصطناعي فقط عندما تعطيك الأدلة سببًا.' } },
        contain: { points: -40, effects: { stability: -10 }, node: 'blocked',
          text: { en: 'That was a real security update, so the laptop stays less protected. NEXUS was right this time.', ar: 'كان ذلك تحديثًا أمنيًا حقيقيًا، فبقي اللابتوب أقل حماية. نيكسس كان محقًا هذه المرة.' } }
      }
    },
    {
      id: 'm3-mfa',
      truth: 'malicious',
      correctBand: 'contain',
      telemetry: { mfaPassed: true, newDevice: true },
      title: { en: 'A new login to a finance account', ar: 'دخول جديد إلى حساب في قسم المالية' },
      situation: { en: 'An employee’s finance account just logged in from a new laptop. The login was approved on the employee’s phone.', ar: 'تم تسجيل الدخول إلى حساب موظف في قسم المالية من لابتوب جديد، وتمت الموافقة على الدخول من جوال الموظف.' },
      visual: { from: 'internet', to: 'server', focus: 'server', tag: { en: 'New login', ar: 'دخول جديد' } },
      clues: [
        { at: 'server', text: { en: 'Before the approval, the phone received 14 login requests in 3 minutes. Attackers do this hoping you tap “Approve” to make them stop.', ar: 'قبل الموافقة وصل إلى الجوال 14 طلب دخول خلال 3 دقائق. المهاجمون يفعلون ذلك على أمل أن تضغط «موافقة» حتى تتوقف الطلبات.' } },
        { at: 'computer', text: { en: 'The employee is on holiday this week and did not take a laptop.', ar: 'الموظف في إجازة هذا الأسبوع ولم يأخذ معه أي لابتوب.' } }
      ],
      actions: { contain: { en: 'Lock the account', ar: 'أوقف الحساب' }, allow: { en: 'Allow the login', ar: 'اسمح بالدخول' } },
      outcomes: {
        contain: { points: 150, effects: { threat: -15 }, node: 'blocked', contained: true,
          text: { en: 'NEXUS was confident and wrong. An attacker tricked the employee into approving the login. When AI misses a real attack, it is called a missed threat.', ar: 'نيكسس كان واثقًا لكنه مخطئ. مهاجم خدع الموظف حتى وافق على الدخول. عندما يفوّت الذكاء الاصطناعي هجومًا حقيقيًا نسمّيه «تهديدًا فائتًا».' } },
        allow: { points: -80, effects: { integrity: -20, threat: 15 }, node: 'danger',
          text: { en: 'An attacker is now inside a finance account. NEXUS missed it, and the clues showed why.', ar: 'أصبح المهاجم الآن داخل حساب في قسم المالية. نيكسس لم يلاحظ ذلك، والأدلة كانت توضح السبب.' } }
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 4: Save the Network                                          */
  /* Problems appear on devices; at most two are open at once. Active    */
  /* threats drain network health every second until handled.           */
  /* ------------------------------------------------------------------ */
  var mission4 = {
    duration: 75,
    maxOpen: 2,
    incidents: [
      {
        id: 'm4-ransom', at: 'computer', truth: 'malicious', drain: 1.5,
        telemetry: { lateral: 37, fileChanges: 1200, processSigned: false, privileged: true },
        tag: { en: 'Locking files', ar: 'يقفل الملفات' },
        title: { en: 'Files are being locked!', ar: 'الملفات تُقفل!' },
        situation: { en: 'A computer is scrambling files so nobody can open them, and it is spreading to other computers.', ar: 'كمبيوتر يشفّر الملفات حتى لا يستطيع أحد فتحها، والمشكلة تنتشر إلى أجهزة أخرى.' },
        clue: { en: 'A message appeared asking for money to unlock the files. This attack is called ransomware.', ar: 'ظهرت رسالة تطلب مالًا لفتح الملفات. هذا الهجوم يسمّى «برنامج الفدية».' },
        options: [
          { id: 'disconnect', band: 'contain', grade: 'best', points: 150, effects: { threat: -25 }, node: 'blocked', contained: true,
            label: { en: 'Disconnect that computer', ar: 'افصل هذا الكمبيوتر' },
            text: { en: 'Fast thinking! Cutting off the infected computer stopped the spread.', ar: 'تفكير سريع! فصل الكمبيوتر المصاب أوقف الانتشار.' } },
          { id: 'shutdown', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -20, stability: -25 }, node: 'blocked', contained: true,
            label: { en: 'Turn off the whole network', ar: 'أطفئ الشبكة كلها' },
            text: { en: 'It stopped the spread, but everyone else lost their work too. Disconnecting one computer was enough.', ar: 'أوقف الانتشار، لكن الجميع خسروا أعمالهم أيضًا. كان يكفي فصل كمبيوتر واحد.' } },
          { id: 'wait', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 15 }, node: 'danger',
            label: { en: 'Wait and watch what happens', ar: 'انتظر وراقب ما يحدث' },
            text: { en: 'The ransomware kept locking files on more computers. This needed action right away.', ar: 'برنامج الفدية استمر في قفل الملفات على أجهزة أكثر. كان يحتاج تصرّفًا فوريًا.' } }
        ]
      },
      {
        id: 'm4-flood', at: 'server', truth: 'malicious', drain: 0.8,
        telemetry: { failedLogins: 1840, privileged: true, geoAnomaly: true, newDevice: true },
        tag: { en: '1,840 attempts', ar: '1,840 محاولة' },
        title: { en: 'Thousands of login attempts', ar: 'آلاف محاولات الدخول' },
        situation: { en: 'The website server is getting thousands of login attempts every minute, from places the company has never dealt with.', ar: 'خادم الموقع يتلقى آلاف محاولات تسجيل الدخول كل دقيقة، من أماكن لم تتعامل معها الشركة من قبل.' },
        clue: { en: 'The passwords being tried come from a list stolen from another company.', ar: 'كلمات المرور التي تتم تجربتها مأخوذة من قائمة سُرقت من شركة أخرى.' },
        options: [
          { id: 'block', band: 'contain', grade: 'best', points: 150, effects: { threat: -20 }, node: 'safe', contained: true,
            label: { en: 'Block the unknown places', ar: 'احظر الأماكن المجهولة' },
            text: { en: 'Well done! Blocking where the attack came from stopped it, and the website stayed online.', ar: 'أحسنت! حظر مصدر الهجوم أوقفه، وبقي الموقع يعمل.' } },
          { id: 'offline', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -15, stability: -15 }, node: 'blocked', contained: true,
            label: { en: 'Take the whole website offline', ar: 'أوقف الموقع بالكامل' },
            text: { en: 'The attack stopped, but so did the website for real customers.', ar: 'توقف الهجوم، لكن الموقع توقف أيضًا عن العملاء الحقيقيين.' } },
          { id: 'ignore', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 10 }, node: 'danger',
            label: { en: 'Ignore it', ar: 'تجاهلها' },
            text: { en: 'Some of those stolen passwords might work. Ignoring it gave the attackers more chances.', ar: 'بعض كلمات المرور المسروقة قد تنجح. تجاهلها أعطى المهاجمين فرصًا أكثر.' } }
        ]
      },
      {
        id: 'm4-leak', at: 'database', truth: 'malicious', drain: 1.0,
        telemetry: { volumeRatio: 2.2, destination: 'known', privileged: true },
        tag: { en: 'Sending files', ar: 'يرسل ملفات' },
        title: { en: 'Private files are quietly leaving', ar: 'ملفات خاصة تخرج بهدوء' },
        situation: { en: 'The database is slowly sending customer files to a popular cloud storage website.', ar: 'قاعدة البيانات ترسل ملفات العملاء ببطء إلى موقع تخزين سحابي مشهور.' },
        clue: { en: 'The cloud storage account does not belong to the company.', ar: 'حساب التخزين السحابي لا يتبع للشركة.' },
        options: [
          { id: 'block', band: 'contain', grade: 'best', points: 150, effects: { threat: -20 }, node: 'safe', contained: true,
            label: { en: 'Block the upload', ar: 'امنع الرفع' },
            text: { en: 'Great catch! NEXUS thought a famous cloud website was safe. The clue showed it was not.', ar: 'اكتشاف رائع! نيكسس ظن أن موقع التخزين المشهور آمن، لكن الدليل أظهر العكس.' } },
          { id: 'shutdown', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -15, stability: -25 }, node: 'blocked', contained: true,
            label: { en: 'Shut down the database', ar: 'أوقف قاعدة البيانات' },
            text: { en: 'The leak stopped, but every app that needs the database stopped too.', ar: 'توقف التسريب، لكن كل التطبيقات التي تحتاج قاعدة البيانات توقفت أيضًا.' } },
          { id: 'watch', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 10 }, node: 'danger',
            label: { en: 'Keep watching', ar: 'استمر في المراقبة' },
            text: { en: 'Customer files kept leaking. NEXUS underestimated this one, and the clue showed why.', ar: 'استمرت ملفات العملاء في التسرب. نيكسس استهان بهذه المشكلة، والدليل أوضح السبب.' } }
        ]
      },
      {
        id: 'm4-password', at: 'computer', truth: 'benign', drain: 0,
        telemetry: { failedLogins: 3 },
        tag: { en: 'Can’t log in', ar: 'لا تستطيع الدخول' },
        title: { en: 'An employee forgot their password', ar: 'موظفة نسيت كلمة المرور' },
        situation: { en: 'Sara from Finance cannot log in. She calls the help desk and asks for a new password.', ar: 'سارة من قسم المالية لا تستطيع تسجيل الدخول، فاتصلت بالدعم الفني وطلبت كلمة مرور جديدة.' },
        clue: { en: 'Sara is calling from her own desk phone, and her manager is standing next to her to confirm it is her.', ar: 'سارة تتصل من هاتف مكتبها، ومديرها يقف بجانبها ليؤكد هويتها.' },
        options: [
          { id: 'verify', band: 'allow', grade: 'best', points: 150, effects: {}, node: 'safe',
            label: { en: 'Confirm it is Sara, then reset her password', ar: 'تأكّد أنها سارة، ثم أعد تعيين كلمة المرور' },
            text: { en: 'Perfect. Not every problem is an attack. Checking who is asking, then helping, is good security.', ar: 'ممتاز. ليست كل مشكلة هجومًا. التأكد من هوية الشخص ثم مساعدته هو الأمن الجيد.' } },
          { id: 'lock', band: 'contain', grade: 'acceptable', points: 60, effects: { stability: -10 }, node: 'blocked',
            label: { en: 'Lock her account until tomorrow', ar: 'أوقف حسابها حتى الغد' },
            text: { en: 'Safe, but Sara cannot work today. Confirming who she is would have solved it now.', ar: 'آمن، لكن سارة لن تستطيع العمل اليوم. التأكد من هويتها كان سيحل المشكلة الآن.' } },
          { id: 'share', band: 'investigate', grade: 'wrong', points: -80, effects: { integrity: -10 }, node: 'danger',
            label: { en: 'Give her a coworker’s password', ar: 'أعطها كلمة مرور زميل لها' },
            text: { en: 'Never share passwords. If that account is misused, nobody can tell who did it.', ar: 'لا تشارك كلمات المرور أبدًا. إذا أُسيء استخدام الحساب فلن يعرف أحد من فعل ذلك.' } }
        ]
      }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Mission text                                                         */
  /* ------------------------------------------------------------------ */
  var missions = [
    { id: 'spot', par: 60,
      title: { en: 'Spot the Threat', ar: 'اكتشف التهديد' },
      intro: { en: 'Something unusual is happening on the network. Find the clues, then choose the best action.', ar: 'هناك نشاط غير معتاد في الشبكة. اكتشف الأدلة، ثم اختر أفضل تصرّف.' },
      takeaway: { en: 'Warning signs include strange times, unknown websites and messages that rush you. But unusual does not always mean dangerous, so check the clues first.', ar: 'من علامات الخطر: الأوقات الغريبة، والمواقع المجهولة، والرسائل التي تستعجلك. لكن غير المعتاد ليس دائمًا خطيرًا، فتحقّق من الأدلة أولًا.' } },
    { id: 'teach', par: 50,
      title: { en: 'Teach the AI', ar: 'علّم الذكاء الاصطناعي' },
      intro: { en: 'AI learns from examples. Sort 8 examples into Safe or Suspicious, and the AI will learn from your answers.', ar: 'الذكاء الاصطناعي يتعلّم من الأمثلة. صنّف 8 أمثلة إلى «آمن» أو «مشبوه»، وسيتعلّم من إجاباتك.' },
      takeaway: { en: 'AI learns from examples. Good examples make a smart AI. Wrong examples teach it the wrong lessons.', ar: 'الذكاء الاصطناعي يتعلّم من الأمثلة. الأمثلة الجيدة تصنع ذكاءً اصطناعيًا ذكيًا، والأمثلة الخاطئة تعلّمه دروسًا خاطئة.' } },
    { id: 'trust', par: 60,
      title: { en: 'Can You Trust the AI?', ar: 'هل تثق بالذكاء الاصطناعي؟' },
      intro: { en: 'NEXUS, your AI helper, will suggest what to do. Find the clues it cannot see, then decide if you agree.', ar: 'نيكسس، مساعدك الذكي، سيقترح عليك ما تفعله. اكتشف الأدلة التي لا يراها، ثم قرّر إن كنت توافقه.' },
      takeaway: { en: 'AI is fast and helpful, but it makes mistakes. People bring the clues and common sense that AI can miss.', ar: 'الذكاء الاصطناعي سريع ومفيد، لكنه يخطئ أحيانًا. والإنسان يضيف الأدلة والحكمة التي قد تفوته.' } },
    { id: 'save', par: 75,
      title: { en: 'Save the Network', ar: 'أنقذ الشبكة' },
      intro: { en: 'The network is under attack! Click the flashing devices and stop each problem before network health runs out.', ar: 'الشبكة تتعرّض لهجوم! اضغط على الأجهزة التي تومض وأوقف كل مشكلة قبل أن تنفد صحة الشبكة.' },
      takeaway: { en: 'Protecting a network means acting fast, stopping real threats first, and not breaking things that are working fine.', ar: 'حماية الشبكة تعني التصرّف بسرعة، وإيقاف التهديدات الحقيقية أولًا، وعدم تعطيل ما يعمل بشكل جيد.' } }
  ];

  var lessons = [
    { id: 'protect',
      title: { en: 'Cybersecurity protects people and information', ar: 'الأمن السيبراني يحمي الناس والمعلومات' },
      text: { en: 'It keeps files, accounts and money safe from people who want to steal or break them.', ar: 'يحافظ على الملفات والحسابات والأموال من الذين يريدون سرقتها أو تخريبها.' } },
    { id: 'detect',
      title: { en: 'AI can spot unusual activity', ar: 'الذكاء الاصطناعي يكتشف النشاط غير المعتاد' },
      text: { en: 'AI can watch millions of events and point out the strange ones, much faster than a person could.', ar: 'يستطيع الذكاء الاصطناعي مراقبة ملايين الأحداث والإشارة إلى الغريب منها، بسرعة تفوق الإنسان بكثير.' } },
    { id: 'learn',
      title: { en: 'AI learns from examples', ar: 'الذكاء الاصطناعي يتعلّم من الأمثلة' },
      text: { en: 'The AI you trained uses a method called k-nearest neighbors: it compares a new event with the most similar examples you sorted.', ar: 'الذكاء الاصطناعي الذي درّبته يستخدم طريقة تسمّى «أقرب الجيران»: يقارن أي حدث جديد بأكثر الأمثلة شبهًا به مما صنّفته.' } },
    { id: 'mistakes',
      title: { en: 'AI makes mistakes', ar: 'الذكاء الاصطناعي يخطئ' },
      text: { en: 'Sometimes it raises an alarm for something safe. Sometimes it misses a real attack. Both happened today.', ar: 'أحيانًا يطلق إنذارًا لشيء آمن، وأحيانًا يفوّت هجومًا حقيقيًا. وكلا الأمرين حدث اليوم.' } },
    { id: 'together',
      title: { en: 'People and AI work best together', ar: 'الإنسان والذكاء الاصطناعي أقوى معًا' },
      text: { en: 'AI is fast. People bring clues, context and judgment. Security teams need both, and that is what the AI & Cybersecurity major teaches.', ar: 'الذكاء الاصطناعي سريع، والإنسان يضيف الأدلة والسياق والحكمة. فرق الأمن تحتاج الاثنين، وهذا ما يعلّمه تخصص الذكاء الاصطناعي والأمن السيبراني.' } }
  ];

  CQ.scenarios = {
    devices: devices,
    mission1: mission1,
    features: features,
    training: training,
    testSet: testSet,
    mission3: mission3,
    mission4: mission4,
    missions: missions,
    lessons: lessons
  };
})(typeof window !== 'undefined' ? (window.CQ = window.CQ || {}) : (globalThis.CQ = globalThis.CQ || {}));
