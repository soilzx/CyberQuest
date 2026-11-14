/*
 * CyberQuest — languages (English and Arabic)
 *
 * t(key, vars)  translates an interface string and fills {placeholders}.
 * pick(value)   chooses the current language from a scenario text object
 *               like { en: '...', ar: '...' } (plain strings pass through).
 * set(lang)     switches language, updates <html lang/dir>, saves the
 *               choice and notifies listeners so screens can redraw in place.
 *
 * English is the default. Numbers use Western digits in both languages so
 * scores and timers line up the same way.
 */
(function (CQ) {
  'use strict';

  var KEY = 'cyberquest.lang';
  var SUPPORTED = ['en', 'ar'];
  var listeners = [];

  function arPoints(n) {
    var a = Math.abs(n);
    if (a === 1) return 'نقطة واحدة';
    if (a === 2) return 'نقطتان';
    if (a >= 3 && a <= 10) return a + ' نقاط';
    return a + ' نقطة';
  }

  var STRINGS = {
    en: {
      'brand': 'CyberQuest',
      'nexus': 'NEXUS',
      'lang.label': 'Language',
      'lang.switchTo': 'Switch to Arabic',

      'intro.kicker': 'An AI and cybersecurity game',
      'intro.title': 'You’re protecting a network with the help of AI.',
      'intro.sub': 'Spot threats, teach your AI, and save the system!',
      'intro.start': 'Start Game',
      'intro.meta': '4 short missions. About 4 minutes. No sign-up.',
      'intro.board': 'See the leaderboard',
      'intro.hello': 'Hi, I’m NEXUS, your AI helper.',
      'intro.hello2': 'Let’s protect this network together!',
      'intro.tag': 'Something unusual',
      'intro.foot': 'A learning game made for the Artificial Intelligence & Cybersecurity major at KFUPM. Every event in it is made up.',
      'partners.club1': 'Computer Club logo',
      'partners.club2': 'Data Science and Engineering Club logo',

      'header.mission': 'Mission {n} of 4: {title}',
      'header.score': 'Score',
      'header.soundOn': 'Sound on',
      'header.soundOff': 'Sound off',
      'header.soundOnAria': 'Sound is on. Turn sound off',
      'header.soundOffAria': 'Sound is off. Turn sound on',
      'header.restart': 'Restart',
      'header.restartAria': 'Restart the game',
      'header.progress': 'Game progress',
      'stage.label': 'Current challenge',

      'device.internet': 'Internet',
      'device.server': 'Server',
      'device.computer': 'Computer',
      'device.database': 'Database',
      'state.alert': 'Unusual',
      'state.danger': 'In danger',
      'state.blocked': 'Disconnected',
      'state.safe': 'Safe',
      'state.stopped': 'Stopped!',
      'scene.aria': 'Network picture: {list}.',
      'scene.investigate': 'Look for a clue on the {device}',
      'scene.open': 'Deal with the problem on the {device}',

      'card.mission': 'Mission {n} of 4',
      'card.start': 'Start mission',
      'card.complete': 'Mission {n} complete!',
      'card.final': 'Final mission',
      'card.learned': 'What you learned',
      'card.next': 'Next: {title}',
      'card.results': 'See your results',
      'card.breach': 'The network went down',
      'card.timeout': 'Time’s up!',
      'card.saved': 'You saved the network!',

      'q.situation': 'Situation {n} of {total}',
      'q.case': 'Case {n} of {total}',
      'q.problem': 'Problem {n} of {total}',
      'q.example': 'Example {n} of {total}',
      'clues.title': 'Clues found: {n} of {total}',
      'clues.hintDevices': 'Click the glowing devices to find clues.',
      'clues.hintEmail': 'Click the glowing parts of the email to find clues.',
      'clues.more': 'Show a clue',
      'clues.aiCantSee': 'Clues NEXUS can’t see: {n} of {total} found',
      'clue': 'Clue',
      'email.blocked': 'Reported as a scam',
      'email.delivered': 'The trap worked',

      'fb.good': 'Correct!',
      'fb.okay': 'Good, but not the best choice',
      'fb.bad': 'Not quite',
      'points': function (v) { return (v.n === 1 || v.n === -1) ? v.n + ' point' : v.n + ' points'; },
      'pointsSigned': function (v) { return (v.n > 0 ? '+' : v.n < 0 ? '−' : '') + Math.abs(v.n) + ' points'; },
      'btn.nextSituation': 'Next situation',
      'btn.nextCase': 'Next case',
      'btn.finish': 'Finish mission',
      'btn.backToNetwork': 'Back to the network',
      'btn.seeHow': 'See how you did',

      // Mission 2
      'm2.kindLogin': 'Someone logging in',
      'm2.kindUpload': 'Data being sent',
      'm2.question': 'Safe or suspicious?',
      'm2.instructions': 'Drag the card into the right box, or press one of the buttons. Your answers teach the AI.',
      'm2.safe': 'Safe',
      'm2.suspicious': 'Suspicious',
      'm2.binCount': function (v) { return v.n === 1 ? '1 card' : v.n + ' cards'; },
      'm2.putSafe': 'Put it in Safe',
      'm2.putSuspicious': 'Put it in Suspicious',
      'm2.undo': 'Undo last card',
      'm2.cardAria': 'Example card: {title}. Drag it to a box, or use the buttons.',
      'm2.readyStep': 'Ready to train',
      'm2.readyTitle': 'Time to teach the AI!',
      'm2.readyText': 'You put {safe} cards in Safe and {sus} in Suspicious. The AI will learn only from your answers.',
      'm2.train': 'Train the AI',
      'm2.trainingStep': 'Training',
      'm2.trainingTitle': 'The AI is learning…',
      'm2.trainingText': 'It is studying your 8 examples so it can recognize similar ones later.',
      'm2.testingTitle': 'Now the AI sorts 6 new examples',
      'm2.testingText': 'It has never seen these. Watch where it puts each one.',
      'm2.brainCaption': 'Your 8 examples',
      'm2.resultsStep': 'Results',
      'm2.resultsTitle': 'You helped train the AI!',
      'm2.outOf': '{n} out of {total}',
      'm2.outOfText': 'new examples right. The AI had never seen these before.',
      'm2.perfect': 'Perfect! Your examples taught it well.',
      'm2.missBecause': 'It got “{test}” wrong because you put a similar example, “{train}”, in {bin}.',
      'm2.missGuess': 'It got “{test}” wrong. It looked like examples from both boxes, so the AI had to guess.',
      'm2.wrongLessons': 'Wrong examples teach the AI wrong lessons.',
      'm2.labeled': 'You sorted {n} of 8 examples the way security experts would.',
      'm2.shows': 'What this shows',
      'm2.showsText': 'An AI is only as good as the examples it learns from. That is why people who understand security are needed to train it.',
      'm2.aiSaid': 'AI said:',
      'm2.verySure': 'Very sure',
      'm2.notSure': 'Not sure',
      'm2.boardTitle': 'The AI’s answers on new examples',

      // Mission 3
      'm3.suggests': 'NEXUS suggests',
      'm3.howSure': 'How sure? {x}',
      'm3.sure.high': 'Very sure',
      'm3.sure.medium': 'Fairly sure',
      'm3.sure.low': 'Not very sure',
      'm3.question': 'Do you agree with NEXUS?',
      'm3.yes': 'Yes, follow NEXUS',
      'm3.no': 'No, do this instead',
      'm3.caught': 'You caught NEXUS’s mistake!',
      'm3.aiRightWrongChoice': 'NEXUS was right this time',
      'm3.bothWrong': 'NEXUS was wrong, and so was this choice',

      // Mission 4
      'm4.time': 'Time left',
      'm4.health': 'Network health',
      'm4.boardTitle': function (v) { return v.n === 1 ? '1 problem needs you' : v.n + ' problems need you'; },
      'm4.boardText': 'Click a flashing device to deal with it. Problems that are not stopped keep hurting the network.',
      'm4.waiting': 'More problems are on the way…',
      'm4.openProblem': '{device}: {title}',
      'm4.question': 'What should you do?',
      'm4.nexusPick': 'NEXUS suggests',
      'm4.stopped': 'Threat stopped!',
      'm4.done': 'All problems handled',

      // Results
      'res.step': 'Game complete',
      'res.title': 'You’re now: {rank}!',
      'res.sub': 'You scored {score} points in {time}.',
      'res.subBreach': 'The network went down this time, but you scored {score} points in {time}.',
      'res.rankOf': 'Rank {n} of 5',
      'res.points': '{score} points',
      'res.threats': 'Real threats you stopped',
      'res.ai': 'New examples your AI got right',
      'res.team': 'Times you and NEXUS made the right call',
      'res.health': 'Network health at the end',
      'res.of': '{a} of {b}',
      'res.next': 'Reach {points} points to become: {rank}.',
      'res.top': 'That is the highest rank. Amazing work!',
      'res.breakdown': 'See how your score was calculated',
      'res.missionLine': 'Mission {n}: {title}',
      'res.nameLabel': 'Add your name to the leaderboard',
      'res.namePlaceholder': 'Your first name or nickname',
      'res.save': 'Save',
      'res.update': 'Update name',
      'res.savedHere': 'Your score is saved on this computer.',
      'res.position': 'Your score is #{n} on this computer.',
      'res.nameSaved': 'Saved! You are #{n} on the leaderboard.',
      'res.nameSavedNoPos': 'Saved! Your name is on the leaderboard.',
      'res.nameError': 'Use letters or numbers, up to 16 characters.',
      'res.again': 'Play again',
      'res.learned': 'What you learned',
      'res.board': 'Leaderboard',
      'res.picture': 'Save result picture',
      'res.pictureSaved': 'Saved {file}',
      'res.cardFoot': 'A learning game about AI and cybersecurity. All events are made up.',
      'res.cardStats': 'Threats stopped: {a} of {b}    Time: {time}',
      'agent': 'Agent {n}',

      'rank.recruit': 'Cyber Recruit',
      'rank.hunter': 'Threat Hunter',
      'rank.analyst': 'Security Analyst',
      'rank.defender': 'Cyber Defender',
      'rank.guardian': 'Elite AI Guardian',

      // Score breakdown lines
      'ledger.missionComplete': 'Mission {n} complete',
      'ledger.decisive': 'Quick decisions ({s} seconds)',
      'ledger.m1': '{title}: {grade}',
      'ledger.labels': 'Teaching: {n} of 8 examples sorted like an expert',
      'ledger.aiTest': 'AI test: {n} of {total} new examples right',
      'ledger.m3.trusted': '{title}: trusted NEXUS when it was right',
      'ledger.m3.caught': '{title}: caught NEXUS’s mistake',
      'ledger.m3.ignored': '{title}: ignored NEXUS when it was right',
      'ledger.m3.followedWrong': '{title}: followed NEXUS when it was wrong',
      'ledger.m4': '{title}: {grade}',
      'ledger.missed': 'Ran out of time: {title}',
      'ledger.timeLeft': 'Time left: {s} seconds',
      'ledger.health': 'Network health: {n}%',
      'grade.best': 'best choice',
      'grade.acceptable': 'okay choice',
      'grade.wrong': 'wrong choice',

      // Dialogs
      'dlg.close': 'Close',
      'dlg.restartTitle': 'Start over?',
      'dlg.restartBody': 'This game will end and its score will not be saved.',
      'dlg.keepPlaying': 'Keep playing',
      'dlg.startOver': 'Start over',
      'dlg.boardTitle': 'Leaderboard',
      'dlg.boardNote': 'Top 10 scores saved on this computer.',
      'dlg.boardEmpty': 'No scores yet. Finish a game to be the first!',
      'dlg.boardReset': 'Reset leaderboard',
      'dlg.resetTitle': 'Delete all scores?',
      'dlg.resetBody': 'All {n} scores saved on this computer will be deleted. This cannot be undone.',
      'dlg.cancel': 'Cancel',
      'dlg.deleteAll': 'Delete all scores',
      'dlg.cleared': 'Leaderboard cleared.',
      'dlg.learnedTitle': 'What you learned today',
      'dlg.learnedNote': 'About the AI in this game: NEXUS follows rules that we wrote by hand. The AI you trained in Mission 2 is real machine learning that runs in your browser.',
      'dlg.idleTitle': 'Still playing?',
      'dlg.idleBody': 'The game will go back to the start in {n} seconds.',

      // Personal lines in "What you learned"
      'learn.protect': 'You stopped {a} of {b} real threats today.',
      'learn.detect': 'In Mission 1 you made the best choice in {n} of 4 situations.',
      'learn.learn': 'After learning from you, your AI got {a} of {b} new examples right.',
      'learn.mistakes': 'NEXUS was wrong 3 times today. You caught {n} of them.',
      'learn.together': 'You and NEXUS made the right call {a} of {b} times.',

      // NEXUS lines
      'nx.mission.0': 'Ready? Let’s find out what is happening on the network.',
      'nx.mission.1': 'Now you get to teach me. I learn from your answers!',
      'nx.mission.2': 'I’ll give you my advice. You decide if I’m right.',
      'nx.mission.3': 'This is the big one. I’ll help, but you’re in charge!',
      'nx.next': 'Great work! On to the next mission.',
      'nx.finalGood': 'We did it! The network is safe.',
      'nx.finalBad': 'That was tough. Let’s see how you did.',
      'nx.m1.first': 'Something looks unusual. Click the glowing devices to look for clues!',
      'nx.m1.email': 'Messages that rush you deserve a second look. Click the glowing parts.',
      'nx.m1.scan': 'This looks very unusual to me. But unusual and dangerous are not always the same.',
      'nx.m1.update': 'Someone is making changes. Is it allowed? The clues can tell you.',
      'nx.clue': 'Nice find! Clues help you decide.',
      'nx.allClues': 'You found every clue. Now make your choice.',
      'nx.praise.0': 'Nice work!',
      'nx.praise.1': 'Good thinking!',
      'nx.praise.2': 'You’re getting good at this!',
      'nx.praise.3': 'Great job!',
      'nx.comfort.0': 'Tricky one! Let’s keep going.',
      'nx.comfort.1': 'That one fools a lot of people.',
      'nx.comfort.2': 'Now you know the warning sign.',
      'nx.m2.drop': 'Got it. I’ll remember that one.',
      'nx.m2.ready': 'I’m ready to learn. Teach me!',
      'nx.m2.learning': 'Learning from your examples…',
      'nx.m2.testing': 'Let me try these new ones…',
      'nx.m2.doneGood': 'Thanks, teacher! I learned a lot from you.',
      'nx.m2.doneMixed': 'I learned what you taught me, even the mistakes!',
      'nx.m3.first': 'I’m not always right. Find the clues I can’t see before deciding!',
      'nx.m3.next': 'Here’s my suggestion. Do you agree?',
      'nx.m3.caught': 'You were right and I was wrong. That’s why people check my work!',
      'nx.m3.team': 'Teamwork! The clues agreed with me this time.',
      'nx.m3.ignored': 'Disagree with me only when the clues give you a reason.',
      'nx.m3.missed': 'I missed that one. The clues had the answer.',
      'nx.m4.start': 'Two problems already! Stop the one that spreads fastest first.',
      'nx.m4.newProblem': 'A new problem just appeared! Look for the flashing device.',
      'nx.m4.open': 'Read the clue, then choose fast.',
      'nx.m4.lastWrongPick': 'Check the clue on this one. I might be wrong.',
      'nx.m4.caught': 'You spotted my mistake. Great teamwork!',
      'nx.m4.good': 'Threat stopped! Great decision.',
      'nx.m4.goodSafe': 'Exactly right. Not every problem is an attack.',
      'nx.m4.okay': 'That works, but it caused some trouble.',
      'nx.m4.bad': 'Ouch. That problem is still hurting the network.',

      // Hints
      'hint.continue': 'Press Continue when you are ready.',
      'hint.m1.noClues': 'Not sure? Click a glowing device or press “Show a clue”.',
      'hint.m1.clues': 'Is there a good reason for this activity? If not, treat it as a threat.',
      'hint.m2.label': 'Look at the clues together. A big upload to a trusted partner is normal. A blocked website is not.',
      'hint.m2.ready': 'Press “Train the AI” to see what it learned.',
      'hint.m3': 'Do the clues explain what I saw? If they show something I missed, choose differently.',
      'hint.m4.board': 'Click the flashing device that is doing the most damage.',
      'hint.m4.open': 'Pick the choice that fixes the problem without breaking everything else.'
    },

    ar: {
      'brand': 'سايبر كويست',
      'nexus': 'نيكسس',
      'lang.label': 'اللغة',
      'lang.switchTo': 'التبديل إلى الإنجليزية',

      'intro.kicker': 'لعبة عن الذكاء الاصطناعي والأمن السيبراني',
      'intro.title': 'أنت تحمي شبكة بمساعدة الذكاء الاصطناعي.',
      'intro.sub': 'اكشف التهديدات، علّم الذكاء الاصطناعي، وأنقذ النظام!',
      'intro.start': 'ابدأ اللعبة',
      'intro.meta': '4 مهام قصيرة. حوالي 4 دقائق. بدون تسجيل.',
      'intro.board': 'عرض قائمة المتصدرين',
      'intro.hello': 'هلا! أنا نيكسس، مساعدك الذكي.',
      'intro.hello2': 'خلّنا نحمي هذه الشبكة مع بعض!',
      'intro.tag': 'نشاط غير معتاد',
      'intro.foot': 'لعبة تعليمية صُممت لتخصص الذكاء الاصطناعي والأمن السيبراني في جامعة الملك فهد للبترول والمعادن. جميع الأحداث فيها خيالية.',
      'partners.club1': 'شعار نادي الحاسب الآلي',
      'partners.club2': 'شعار نادي علوم وهندسة البيانات',

      'header.mission': 'المهمة {n} من 4: {title}',
      'header.score': 'النقاط',
      'header.soundOn': 'الصوت يعمل',
      'header.soundOff': 'الصوت مُطفأ',
      'header.soundOnAria': 'الصوت يعمل. اضغط لإطفائه',
      'header.soundOffAria': 'الصوت مُطفأ. اضغط لتشغيله',
      'header.restart': 'إعادة البدء',
      'header.restartAria': 'إعادة بدء اللعبة',
      'header.progress': 'تقدّم اللعبة',
      'stage.label': 'التحدي الحالي',

      'device.internet': 'الإنترنت',
      'device.server': 'الخادم',
      'device.computer': 'الكمبيوتر',
      'device.database': 'قاعدة البيانات',
      'state.alert': 'غير معتاد',
      'state.danger': 'في خطر',
      'state.blocked': 'مفصول',
      'state.safe': 'آمن',
      'state.stopped': 'تم الإيقاف!',
      'scene.aria': 'صورة الشبكة: {list}.',
      'scene.investigate': 'ابحث عن دليل في {device}',
      'scene.open': 'تعامل مع المشكلة في {device}',

      'card.mission': 'المهمة {n} من 4',
      'card.start': 'ابدأ المهمة',
      'card.complete': 'أكملت المهمة {n}!',
      'card.final': 'المهمة الأخيرة',
      'card.learned': 'ماذا تعلّمت',
      'card.next': 'التالي: {title}',
      'card.results': 'اعرض نتائجك',
      'card.breach': 'تعطّلت الشبكة',
      'card.timeout': 'انتهى الوقت!',
      'card.saved': 'أنقذت الشبكة!',

      'q.situation': 'الموقف {n} من {total}',
      'q.case': 'الحالة {n} من {total}',
      'q.problem': 'المشكلة {n} من {total}',
      'q.example': 'المثال {n} من {total}',
      'clues.title': 'الأدلة المكتشفة: {n} من {total}',
      'clues.hintDevices': 'اضغط على الأجهزة المضيئة لتكتشف الأدلة.',
      'clues.hintEmail': 'اضغط على الأجزاء المضيئة في الرسالة لتكتشف الأدلة.',
      'clues.more': 'اعرض دليلًا',
      'clues.aiCantSee': 'أدلة لا يراها نيكسس: اكتشفت {n} من {total}',
      'clue': 'دليل',
      'email.blocked': 'تم الإبلاغ عنها كاحتيال',
      'email.delivered': 'نجح الفخ',

      'fb.good': 'إجابة صحيحة!',
      'fb.okay': 'جيد، لكنه ليس الخيار الأفضل',
      'fb.bad': 'ليس تمامًا',
      'points': function (v) { return arPoints(v.n); },
      'pointsSigned': function (v) { return (v.n > 0 ? '+' : v.n < 0 ? '−' : '') + arPoints(v.n); },
      'btn.nextSituation': 'الموقف التالي',
      'btn.nextCase': 'الحالة التالية',
      'btn.finish': 'أنهِ المهمة',
      'btn.backToNetwork': 'ارجع إلى الشبكة',
      'btn.seeHow': 'اعرض نتيجتك',

      'm2.kindLogin': 'شخص يسجّل الدخول',
      'm2.kindUpload': 'بيانات يتم إرسالها',
      'm2.question': 'آمن أم مشبوه؟',
      'm2.instructions': 'اسحب البطاقة إلى الصندوق المناسب، أو اضغط أحد الزرين. إجاباتك هي التي تعلّم الذكاء الاصطناعي.',
      'm2.safe': 'آمن',
      'm2.suspicious': 'مشبوه',
      'm2.binCount': function (v) { return v.n === 0 ? 'لا توجد بطاقات' : v.n === 1 ? 'بطاقة واحدة' : v.n === 2 ? 'بطاقتان' : v.n + ' بطاقات'; },
      'm2.putSafe': 'ضعها في آمن',
      'm2.putSuspicious': 'ضعها في مشبوه',
      'm2.undo': 'تراجع عن آخر بطاقة',
      'm2.cardAria': 'بطاقة مثال: {title}. اسحبها إلى صندوق، أو استخدم الأزرار.',
      'm2.readyStep': 'جاهز للتدريب',
      'm2.readyTitle': 'حان وقت تعليم الذكاء الاصطناعي!',
      'm2.readyText': 'وضعت {safe} في آمن و{sus} في مشبوه. سيتعلم الذكاء الاصطناعي من إجاباتك فقط.',
      'm2.train': 'درّب الذكاء الاصطناعي',
      'm2.trainingStep': 'التدريب',
      'm2.trainingTitle': 'الذكاء الاصطناعي يتعلّم…',
      'm2.trainingText': 'يدرس أمثلتك الثمانية حتى يتعرّف على الحالات المشابهة لاحقًا.',
      'm2.testingTitle': 'الآن يصنّف الذكاء الاصطناعي 6 أمثلة جديدة',
      'm2.testingText': 'لم يرَ هذه الأمثلة من قبل. شاهد أين يضع كل واحد منها.',
      'm2.brainCaption': 'أمثلتك الثمانية',
      'm2.resultsStep': 'النتائج',
      'm2.resultsTitle': 'ساعدت في تدريب الذكاء الاصطناعي!',
      'm2.outOf': '{n} من {total}',
      'm2.outOfText': 'أمثلة جديدة صنّفها بشكل صحيح، مع أنه لم يرها من قبل.',
      'm2.perfect': 'ممتاز! أمثلتك علّمته بشكل رائع.',
      'm2.missBecause': 'أخطأ في «{test}» لأنك وضعت مثالًا مشابهًا، «{train}»، في صندوق {bin}.',
      'm2.missGuess': 'أخطأ في «{test}». كان يشبه أمثلة من الصندوقين، فاضطر الذكاء الاصطناعي للتخمين.',
      'm2.wrongLessons': 'الأمثلة الخاطئة تعلّم الذكاء الاصطناعي دروسًا خاطئة.',
      'm2.labeled': 'صنّفت {n} من 8 أمثلة كما يصنّفها خبراء الأمن.',
      'm2.shows': 'ماذا يوضّح هذا',
      'm2.showsText': 'الذكاء الاصطناعي يكون جيدًا بقدر جودة الأمثلة التي يتعلم منها. ولهذا نحتاج أشخاصًا يفهمون الأمن لتدريبه.',
      'm2.aiSaid': 'إجابته:',
      'm2.verySure': 'متأكد جدًا',
      'm2.notSure': 'غير متأكد',
      'm2.boardTitle': 'إجابات الذكاء الاصطناعي على الأمثلة الجديدة',

      'm3.suggests': 'نيكسس يقترح',
      'm3.howSure': 'ما مدى ثقته؟ {x}',
      'm3.sure.high': 'متأكد جدًا',
      'm3.sure.medium': 'متأكد إلى حدٍّ ما',
      'm3.sure.low': 'غير متأكد كثيرًا',
      'm3.question': 'هل توافق نيكسس؟',
      'm3.yes': 'نعم، اتبع نيكسس',
      'm3.no': 'لا، افعل هذا بدلًا منه',
      'm3.caught': 'اكتشفت خطأ نيكسس!',
      'm3.aiRightWrongChoice': 'كان نيكسس محقًا هذه المرة',
      'm3.bothWrong': 'أخطأ نيكسس، وكان هذا الاختيار خاطئًا أيضًا',

      'm4.time': 'الوقت المتبقي',
      'm4.health': 'صحة الشبكة',
      'm4.boardTitle': function (v) { return v.n === 1 ? 'مشكلة واحدة تحتاجك' : v.n === 2 ? 'مشكلتان تحتاجانك' : v.n + ' مشاكل تحتاجك'; },
      'm4.boardText': 'اضغط على الجهاز الذي يومض لتتعامل معه. المشاكل التي لا توقفها تستمر في إيذاء الشبكة.',
      'm4.waiting': 'مشاكل أخرى في الطريق…',
      'm4.openProblem': '{device}: {title}',
      'm4.question': 'ماذا تفعل؟',
      'm4.nexusPick': 'نيكسس يقترح',
      'm4.stopped': 'تم إيقاف التهديد!',
      'm4.done': 'تعاملت مع كل المشاكل',

      'res.step': 'انتهت اللعبة',
      'res.title': 'لقبك الآن: {rank}!',
      'res.sub': 'حصلت على {score} نقطة في {time}.',
      'res.subBreach': 'تعطّلت الشبكة هذه المرة، لكنك حصلت على {score} نقطة في {time}.',
      'res.rankOf': 'المستوى {n} من 5',
      'res.points': '{score} نقطة',
      'res.threats': 'تهديدات حقيقية أوقفتها',
      'res.ai': 'أمثلة جديدة صنّفها ذكاؤك الاصطناعي بشكل صحيح',
      'res.team': 'مرات اتخذت فيها أنت ونيكسس القرار الصحيح',
      'res.health': 'صحة الشبكة في النهاية',
      'res.of': '{a} من {b}',
      'res.next': 'اجمع {points} نقطة لتصبح: {rank}.',
      'res.top': 'هذا أعلى مستوى. عمل مذهل!',
      'res.breakdown': 'اعرض طريقة حساب نقاطك',
      'res.missionLine': 'المهمة {n}: {title}',
      'res.nameLabel': 'أضف اسمك إلى قائمة المتصدرين',
      'res.namePlaceholder': 'اسمك الأول أو لقبك',
      'res.save': 'حفظ',
      'res.update': 'تحديث الاسم',
      'res.savedHere': 'نتيجتك محفوظة على هذا الجهاز.',
      'res.position': 'ترتيبك #{n} على هذا الجهاز.',
      'res.nameSaved': 'تم الحفظ! ترتيبك #{n} في قائمة المتصدرين.',
      'res.nameSavedNoPos': 'تم الحفظ! اسمك في قائمة المتصدرين.',
      'res.nameError': 'استخدم حروفًا أو أرقامًا، بحد أقصى 16 حرفًا.',
      'res.again': 'العب مرة أخرى',
      'res.learned': 'ماذا تعلّمت',
      'res.board': 'قائمة المتصدرين',
      'res.picture': 'احفظ صورة النتيجة',
      'res.pictureSaved': 'تم حفظ {file}',
      'res.cardFoot': 'لعبة تعليمية عن الذكاء الاصطناعي والأمن السيبراني. جميع الأحداث خيالية.',
      'res.cardStats': 'تهديدات أوقفتها: {a} من {b}    الوقت: {time}',
      'agent': 'العميل {n}',

      'rank.recruit': 'مجنّد سيبراني',
      'rank.hunter': 'صائد التهديدات',
      'rank.analyst': 'محلّل أمني',
      'rank.defender': 'مدافع سيبراني',
      'rank.guardian': 'حارس الذكاء الاصطناعي النخبة',

      'ledger.missionComplete': 'إكمال المهمة {n}',
      'ledger.decisive': 'قرارات سريعة ({s} ثانية)',
      'ledger.m1': '{title}: {grade}',
      'ledger.labels': 'التعليم: صنّفت {n} من 8 أمثلة مثل الخبراء',
      'ledger.aiTest': 'اختبار الذكاء الاصطناعي: {n} من {total} أمثلة جديدة صحيحة',
      'ledger.m3.trusted': '{title}: وثقت بنيكسس عندما كان محقًا',
      'ledger.m3.caught': '{title}: اكتشفت خطأ نيكسس',
      'ledger.m3.ignored': '{title}: تجاهلت نيكسس عندما كان محقًا',
      'ledger.m3.followedWrong': '{title}: اتبعت نيكسس عندما كان مخطئًا',
      'ledger.m4': '{title}: {grade}',
      'ledger.missed': 'انتهى الوقت: {title}',
      'ledger.timeLeft': 'الوقت المتبقي: {s} ثانية',
      'ledger.health': 'صحة الشبكة: {n}%',
      'grade.best': 'الخيار الأفضل',
      'grade.acceptable': 'خيار مقبول',
      'grade.wrong': 'خيار خاطئ',

      'dlg.close': 'إغلاق',
      'dlg.restartTitle': 'تبدأ من جديد؟',
      'dlg.restartBody': 'ستنتهي هذه اللعبة ولن تُحفظ نتيجتها.',
      'dlg.keepPlaying': 'أكمل اللعب',
      'dlg.startOver': 'ابدأ من جديد',
      'dlg.boardTitle': 'قائمة المتصدرين',
      'dlg.boardNote': 'أفضل 10 نتائج محفوظة على هذا الجهاز.',
      'dlg.boardEmpty': 'لا توجد نتائج بعد. أنهِ لعبة لتكون الأول!',
      'dlg.boardReset': 'مسح قائمة المتصدرين',
      'dlg.resetTitle': 'حذف جميع النتائج؟',
      'dlg.resetBody': 'سيتم حذف جميع النتائج المحفوظة على هذا الجهاز ({n}). لا يمكن التراجع عن ذلك.',
      'dlg.cancel': 'إلغاء',
      'dlg.deleteAll': 'احذف جميع النتائج',
      'dlg.cleared': 'تم مسح قائمة المتصدرين.',
      'dlg.learnedTitle': 'ماذا تعلّمت اليوم',
      'dlg.learnedNote': 'عن الذكاء الاصطناعي في هذه اللعبة: نيكسس يتبع قواعد كتبناها بأنفسنا. أما الذكاء الاصطناعي الذي درّبته في المهمة الثانية فهو تعلّم آلي حقيقي يعمل داخل متصفحك.',
      'dlg.idleTitle': 'ما زلت تلعب؟',
      'dlg.idleBody': 'ستعود اللعبة إلى البداية بعد {n} ثانية.',

      'learn.protect': 'أوقفت {a} من {b} تهديدات حقيقية اليوم.',
      'learn.detect': 'في المهمة الأولى اخترت الخيار الأفضل في {n} من 4 مواقف.',
      'learn.learn': 'بعد أن تعلّم منك، صنّف ذكاؤك الاصطناعي {a} من {b} أمثلة جديدة بشكل صحيح.',
      'learn.mistakes': 'أخطأ نيكسس 3 مرات اليوم، واكتشفت {n} منها.',
      'learn.together': 'اتخذت أنت ونيكسس القرار الصحيح {a} من {b} مرات.',

      'nx.mission.0': 'جاهز؟ خلّنا نعرف وش يصير في الشبكة.',
      'nx.mission.1': 'الحين دورك تعلّمني. أنا أتعلم من إجاباتك!',
      'nx.mission.2': 'بعطيك نصيحتي، وأنت تقرر إذا كنت محقًا.',
      'nx.mission.3': 'هذي أهم مهمة! بساعدك، لكن القرار لك.',
      'nx.next': 'شغل ممتاز! يلا على المهمة التالية.',
      'nx.finalGood': 'سوّيناها! الشبكة الآن آمنة.',
      'nx.finalBad': 'كانت صعبة. خلّنا نشوف نتيجتك.',
      'nx.m1.first': 'فيه شي غريب. اضغط على الأجهزة المضيئة وابحث عن الأدلة!',
      'nx.m1.email': 'الرسائل اللي تستعجلك تستاهل نظرة ثانية. اضغط على الأجزاء المضيئة.',
      'nx.m1.scan': 'هذا يبدو غريبًا جدًا. لكن الغريب مو دايم خطير.',
      'nx.m1.update': 'شخص يعدّل على الموقع. هل هذا مسموح؟ الأدلة بتقول لك.',
      'nx.clue': 'اكتشاف حلو! الأدلة تساعدك تقرر.',
      'nx.allClues': 'لقيت كل الأدلة. الحين اختر قرارك.',
      'nx.praise.0': 'أحسنت!',
      'nx.praise.1': 'تفكير ممتاز!',
      'nx.praise.2': 'صرت تتقنها!',
      'nx.praise.3': 'عمل رائع!',
      'nx.comfort.0': 'كانت صعبة! نكمل.',
      'nx.comfort.1': 'هذي تخدع ناس كثير.',
      'nx.comfort.2': 'الحين صرت تعرف علامة الخطر.',
      'nx.m2.drop': 'تمام، بتذكّر هذا المثال.',
      'nx.m2.ready': 'أنا جاهز أتعلم. علّمني!',
      'nx.m2.learning': 'أتعلّم من أمثلتك…',
      'nx.m2.testing': 'خلني أجرّب هذي الأمثلة الجديدة…',
      'nx.m2.doneGood': 'شكرًا يا معلّم! تعلّمت منك كثير.',
      'nx.m2.doneMixed': 'تعلّمت اللي علّمتني إياه، حتى الأخطاء!',
      'nx.m3.first': 'أنا مو دايم صح. ابحث عن الأدلة اللي ما أشوفها قبل لا تقرر!',
      'nx.m3.next': 'هذا اقتراحي. توافقني؟',
      'nx.m3.caught': 'كنت محق وأنا غلطت. عشان كذا الناس يراجعون شغلي!',
      'nx.m3.team': 'شغل فريق! الأدلة اتفقت معي هالمرة.',
      'nx.m3.ignored': 'خالفني بس لما تعطيك الأدلة سبب.',
      'nx.m3.missed': 'فاتتني هذي. الأدلة كان فيها الجواب.',
      'nx.m4.start': 'مشكلتين من البداية! أوقف اللي تنتشر أسرع أولًا.',
      'nx.m4.newProblem': 'ظهرت مشكلة جديدة! دوّر على الجهاز اللي يومض.',
      'nx.m4.open': 'اقرأ الدليل، وبعدين اختر بسرعة.',
      'nx.m4.lastWrongPick': 'شيك على الدليل هنا. يمكن أكون غلطان.',
      'nx.m4.caught': 'اكتشفت غلطتي. شغل فريق رهيب!',
      'nx.m4.good': 'تم إيقاف التهديد! قرار ممتاز.',
      'nx.m4.goodSafe': 'بالضبط. مو كل مشكلة تكون هجوم.',
      'nx.m4.okay': 'حلّت المشكلة، بس سبّبت إزعاج.',
      'nx.m4.bad': 'أوه. المشكلة ما زالت تضر الشبكة.',

      'hint.continue': 'اضغط «متابعة» إذا كنت جاهزًا.',
      'hint.m1.noClues': 'مو متأكد؟ اضغط على جهاز مضيء أو على «اعرض دليلًا».',
      'hint.m1.clues': 'هل فيه سبب مقنع لهذا النشاط؟ إذا لا، تعامل معه كتهديد.',
      'hint.m2.label': 'انظر للأدلة مع بعض. رفع ملف كبير لشريك موثوق شي طبيعي، لكن موقع محظور لا.',
      'hint.m2.ready': 'اضغط «درّب الذكاء الاصطناعي» لتشوف وش تعلّم.',
      'hint.m3': 'هل الأدلة تفسّر اللي شفته؟ إذا كشفت شي فاتني، اختر غير اقتراحي.',
      'hint.m4.board': 'اضغط على الجهاز اللي يومض ويسبب أكبر ضرر.',
      'hint.m4.open': 'اختر الحل اللي يوقف المشكلة بدون ما يعطّل كل شي ثاني.'
    }
  };

  var lang = 'en';
  try {
    var saved = window.localStorage.getItem(KEY);
    if (SUPPORTED.indexOf(saved) >= 0) lang = saved;
  } catch (e) { /* storage blocked: stay on English */ }

  function fill(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? String(vars[k]) : m; });
  }

  function t(key, vars) {
    var entry = STRINGS[lang][key];
    if (entry == null) entry = STRINGS.en[key];
    if (entry == null) return key;
    return typeof entry === 'function' ? entry(vars || {}) : fill(entry, vars);
  }

  // Scenario text: { en, ar } objects, or plain strings (passed through).
  function pick(value, vars) {
    if (value == null) return '';
    if (typeof value === 'string') return fill(value, vars);
    var s = value[lang] != null ? value[lang] : value.en;
    return fill(String(s), vars);
  }

  function applyDocument() {
    if (typeof document === 'undefined') return;
    var root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (n) { n.setAttribute('alt', t(n.getAttribute('data-i18n-alt'))); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
    document.title = lang === 'ar' ? 'سايبر كويست' : 'CyberQuest';
  }

  function set(next) {
    if (SUPPORTED.indexOf(next) < 0 || next === lang) return false;
    lang = next;
    try { window.localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }
    applyDocument();
    listeners.slice().forEach(function (fn) { fn(lang); });
    return true;
  }

  CQ.i18n = {
    t: t,
    pick: pick,
    set: set,
    get lang() { return lang; },
    isRTL: function () { return lang === 'ar'; },
    onChange: function (fn) { listeners.push(fn); },
    apply: applyDocument,
    strings: STRINGS,
    supported: SUPPORTED,
    number: function (n) { return Number(n).toLocaleString('en-US'); },
    date: function (ts) {
      try { return new Date(ts).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
      catch (e) { return ''; }
    }
  };
})(typeof window !== 'undefined' ? (window.CQ = window.CQ || {}) : (globalThis.CQ = globalThis.CQ || {}));
