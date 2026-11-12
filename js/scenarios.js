/*
 * CyberQuest — scenario data
 *
 * Everything the player reads lives here, written for visitors with no
 * technical background. Every situation is fictional. External addresses
 * use the documentation-reserved ranges from RFC 5737 and domains use the
 * reserved ".example" TLD. Nothing here connects to a real system.
 *
 * Devices in the simple network picture: internet, server, computer, database.
 *
 * `telemetry` is what NEXUS (the rule-based AI) is allowed to read.
 * `clues` are what the player can see. NEXUS cannot read the clues, which
 * is why it sometimes gets things wrong.
 */
(function (CQ) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* The simple network picture                                           */
  /* ------------------------------------------------------------------ */
  var devices = [
    { id: 'internet', name: 'Internet' },
    { id: 'server', name: 'Server' },
    { id: 'computer', name: 'Computer' },
    { id: 'database', name: 'Database' }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 1: Spot the Threat                                           */
  /* answer: 'suspicious' or 'safe'                                       */
  /* ------------------------------------------------------------------ */
  var mission1 = [
    {
      id: 'm1-upload',
      title: 'A computer is sending lots of files',
      story: 'At 2 a.m., an office computer started sending 2 GB of files to a website.',
      visual: { type: 'network', from: 'computer', to: 'internet', focus: 'computer', tag: 'Sending files' },
      clue: 'The website was created just 3 days ago, and nobody is in the office.',
      nexus: 'That is a lot of data in the middle of the night. Want to check the clue?',
      answer: 'suspicious',
      truth: 'malicious',
      outcomes: {
        suspicious: { points: 100, effects: { threat: -20 }, node: 'blocked', contained: true,
          text: 'Good catch! Someone was stealing company files. We disconnected the computer.' },
        safe: { points: -80, effects: { integrity: -20, threat: 15 }, node: 'danger',
          text: 'That was a thief copying company files. Big uploads at night to a brand-new website are a warning sign.' }
      }
    },
    {
      id: 'm1-email',
      title: 'A message asks for your password',
      story: 'This email just arrived in an employee’s inbox.',
      visual: {
        type: 'email',
        from: 'IT Help Desk <support@account-check.example>',
        subject: 'Urgent: your account will be closed today',
        body: 'We found a problem with your account. Enter your password within 1 hour or you will lose access.',
        button: 'Verify my password'
      },
      clue: 'The sender is not from your organization, and real IT teams never ask for your password.',
      nexus: 'Messages that rush you deserve a second look. Check the clue?',
      answer: 'suspicious',
      truth: 'malicious',
      outcomes: {
        suspicious: { points: 100, effects: { threat: -10 }, contained: true,
          text: 'Good catch! This is phishing: a fake message designed to steal passwords. Rushing you is a classic trick.' },
        safe: { points: -60, effects: { integrity: -15, threat: 10 },
          text: 'This was phishing: a fake message built to steal your password. Real IT teams never ask for it.' }
      }
    },
    {
      id: 'm1-scan',
      title: 'The server is being tested again and again',
      story: 'A computer inside the company is testing every door into the server: 2,400 tries in 90 seconds.',
      visual: { type: 'network', from: 'computer', to: 'server', focus: 'server', tag: '2,400 tries' },
      clue: 'This is the IT team’s safety check. It is on their calendar for today.',
      nexus: 'This looks very unusual to me. But unusual and dangerous are not always the same.',
      answer: 'safe',
      truth: 'benign',
      outcomes: {
        safe: { points: 100, effects: {}, node: 'safe',
          text: 'Right! It looked strange, but it was the IT team checking for weak spots. Unusual does not always mean dangerous.' },
        suspicious: { points: -40, effects: { stability: -10 }, node: 'blocked',
          text: 'This was the IT team’s planned safety check. Blocking it stops them finding weak spots before attackers do.' }
      }
    },
    {
      id: 'm1-update',
      title: 'Someone is changing the website',
      story: 'At 11 a.m., a staff member from IT logs in to the web server and starts installing updates.',
      visual: { type: 'network', from: 'computer', to: 'server', focus: 'server', tag: 'Installing updates' },
      clue: 'The update was approved this morning, and the staff member confirmed the login on their phone.',
      nexus: 'Someone is making changes. Is it allowed? The clue can tell you.',
      answer: 'safe',
      truth: 'benign',
      outcomes: {
        safe: { points: 100, effects: {}, node: 'safe',
          text: 'Correct. This was planned, approved work. Good security also means not blocking people doing their jobs.' },
        suspicious: { points: -50, effects: { stability: -15 }, node: 'blocked',
          text: 'This was approved work. Blocking it left the website without its security updates.' }
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 2: Teach the AI                                              */
  /* x: [wrong passwords, unusual time, risky website, data amount,      */
  /*     new device], each scaled 0 to 1. The player supplies the labels.*/
  /* `truth` is only used afterwards to tell the player how they did.    */
  /* ------------------------------------------------------------------ */
  var features = [
    { id: 'failed', name: 'Wrong passwords' },
    { id: 'time', name: 'Unusual time' },
    { id: 'reputation', name: 'Risky website' },
    { id: 'volume', name: 'Amount of data' },
    { id: 'device', name: 'New device' }
  ];

  var training = [
    { id: 'T1', title: 'Morning login from a usual laptop', icon: 'login',
      x: [0.05, 0.1, 0.05, 0.1, 0.0], clues: ['8:55 a.m.', '1 wrong password', 'Usual laptop'], truth: 'benign' },
    { id: 'T2', title: '45 wrong passwords, then a login from a new device', icon: 'login',
      x: [0.9, 0.9, 0.5, 0.2, 1.0], clues: ['3:02 a.m.', '45 wrong passwords', 'Never-seen device'], truth: 'malicious' },
    { id: 'T3', title: 'Huge upload to a brand-new website', icon: 'upload',
      x: [0.1, 0.8, 0.85, 0.95, 0.3], clues: ['1:40 a.m.', '9 GB of files', 'Website made 3 days ago'], truth: 'malicious' },
    { id: 'T4', title: 'Evening login from an employee’s home', icon: 'login',
      x: [0.1, 0.6, 0.2, 0.2, 0.1], clues: ['8:15 p.m.', 'Their own laptop', 'Normal amount of data'], truth: 'benign' },
    { id: 'T5', title: 'Small messages to a known hacker website', icon: 'upload',
      x: [0.0, 0.4, 0.95, 0.15, 0.2], clues: ['4:30 p.m.', 'Website on a blocked list', 'Small amount of data'], truth: 'malicious' },
    { id: 'T6', title: 'Monthly report sent to a trusted partner', icon: 'upload',
      x: [0.0, 0.2, 0.15, 0.8, 0.0], clues: ['10:00 a.m.', '4 GB of files', 'Trusted partner company'], truth: 'benign' },
    { id: 'T7', title: 'New phone set up by the IT team', icon: 'login',
      x: [0.05, 0.2, 0.1, 0.1, 0.9], clues: ['9:20 a.m.', 'Never-seen device', 'Set up by IT'], truth: 'benign' },
    { id: 'T8', title: 'Someone guessing passwords on many accounts', icon: 'login',
      x: [1.0, 0.3, 0.6, 0.05, 0.8], clues: ['11:10 a.m.', '300+ wrong passwords', '40 different accounts'], truth: 'malicious' }
  ];

  // New examples the AI has never seen. Never used for training.
  var testSet = [
    { id: 'Q1', title: 'Many wrong passwords from an unknown laptop', x: [0.85, 0.7, 0.55, 0.1, 0.9], truth: 'malicious' },
    { id: 'Q2', title: 'Normal morning login', x: [0.0, 0.15, 0.1, 0.15, 0.05], truth: 'benign' },
    { id: 'Q3', title: 'Night-time upload to an unfamiliar website', x: [0.05, 0.85, 0.8, 0.9, 0.4], truth: 'malicious' },
    { id: 'Q4', title: 'Big design files shared with a partner', x: [0.0, 0.3, 0.3, 0.85, 0.05], truth: 'benign' },
    { id: 'Q5', title: 'New laptop given out by IT', x: [0.1, 0.3, 0.15, 0.1, 0.85], truth: 'benign' },
    { id: 'Q6', title: 'Quiet messages to a blocked website', x: [0.05, 0.5, 0.9, 0.2, 0.3], truth: 'malicious' }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 3: Can You Trust the AI?                                     */
  /* NEXUS reads `telemetry` and recommends 'contain' or 'allow'.         */
  /* ------------------------------------------------------------------ */
  var mission3 = [
    {
      id: 'm3-beacon',
      title: 'A computer keeps contacting an outside server',
      story: 'Every 60 seconds, a computer sends a tiny message to the same unknown server.',
      visual: { from: 'computer', to: 'internet', focus: 'computer', tag: 'Every 60 seconds' },
      telemetry: { periodic: true, periodSeconds: 60, destination: 'flagged', processSigned: false, volumeRatio: 1 },
      clues: ['That server is on a list of known hacker servers.', 'The program sending the messages is pretending to be part of Windows.'],
      actions: { contain: 'Disconnect the computer', allow: 'Let it continue' },
      truth: 'malicious',
      correctBand: 'contain',
      outcomes: {
        contain: { points: 100, effects: { threat: -15 }, node: 'blocked', contained: true,
          text: 'The AI was right, and the clues agreed. A hidden program was secretly checking in with hackers.' },
        allow: { points: -60, effects: { integrity: -15, threat: 15 }, node: 'danger',
          text: 'The AI was right this time. Hackers kept their secret line into the computer.' }
      }
    },
    {
      id: 'm3-backup',
      title: 'A huge amount of data is leaving the database',
      story: 'At 1 a.m., the database starts copying 38 GB to another storage system.',
      visual: { from: 'database', to: 'server', focus: 'database', tag: 'Copying 38 GB' },
      telemetry: { volumeRatio: 8, offHours: true, privileged: true, destination: 'new' },
      clues: ['This is the monthly backup. It runs on the last night of every month.', 'The storage system is new, so the AI has never seen it before.'],
      actions: { contain: 'Block the copy', allow: 'Let the backup run' },
      truth: 'benign',
      correctBand: 'allow',
      outcomes: {
        allow: { points: 150, effects: {}, node: 'safe',
          text: 'Great call! The AI only saw a big transfer at night. You saw it was the planned backup.' },
        contain: { points: -60, effects: { stability: -20 }, node: 'blocked',
          text: 'The backup was blocked, so the company has no fresh copy of its data. The AI raised an alert, but this was safe.' }
      }
    },
    {
      id: 'm3-update',
      title: 'A laptop is downloading a big file',
      story: 'A 1.8 GB file is downloading from a software company’s website.',
      visual: { from: 'internet', to: 'computer', focus: 'computer', tag: 'Downloading' },
      telemetry: { volumeRatio: 2, destination: 'known', processSigned: true },
      clues: ['The file is an official security update.', '212 other laptops installed it with no problems.'],
      actions: { contain: 'Block the download', allow: 'Allow the update' },
      truth: 'benign',
      correctBand: 'allow',
      outcomes: {
        allow: { points: 100, effects: {}, node: 'safe',
          text: 'Correct. The AI was right and the clues agreed. Disagree with the AI only when the clues give you a reason.' },
        contain: { points: -40, effects: { stability: -10 }, node: 'blocked',
          text: 'That was a real security update, so the laptop stays less protected. The AI was right this time.' }
      }
    },
    {
      id: 'm3-mfa',
      title: 'Someone signed in to a finance account',
      story: 'An employee’s account just signed in from a new laptop. The login was approved on their phone.',
      visual: { from: 'internet', to: 'server', focus: 'server', tag: 'New sign-in' },
      telemetry: { mfaPassed: true, newDevice: true },
      clues: ['Before it was approved, the phone got 14 login requests in 3 minutes. Attackers do this hoping you tap “Approve” to make it stop.', 'The employee is on holiday this week.'],
      actions: { contain: 'Lock the account', allow: 'Allow the sign-in' },
      truth: 'malicious',
      correctBand: 'contain',
      outcomes: {
        contain: { points: 150, effects: { threat: -15 }, node: 'blocked', contained: true,
          text: 'Excellent! The AI was confident and wrong. An attacker tricked the employee into approving the login.' },
        allow: { points: -80, effects: { integrity: -20, threat: 15 }, node: 'danger',
          text: 'An attacker is now inside a finance account. The AI missed it, and the clues showed why.' }
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 4: Save the Network                                          */
  /* drain: network health lost per second while the problem is active. */
  /* ------------------------------------------------------------------ */
  var mission4 = {
    duration: 60,
    incidents: [
      {
        id: 'm4-ransom',
        title: 'Files are being locked!',
        story: 'A computer is scrambling files so nobody can open them, and it is spreading.',
        visual: { from: 'computer', to: 'database', focus: 'computer', tag: 'Locking files' },
        clue: 'A message appeared demanding money to unlock the files. This is called ransomware.',
        telemetry: { lateral: 37, fileChanges: 1200, processSigned: false, privileged: true },
        truth: 'malicious',
        drain: 1.5,
        options: [
          { id: 'disconnect', label: 'Disconnect that computer', band: 'contain', grade: 'best', points: 150, effects: { threat: -25 }, node: 'blocked', contained: true,
            text: 'Fast thinking! Cutting off the infected computer stopped the spread.' },
          { id: 'shutdown', label: 'Turn off the whole network', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -20, stability: -25 }, node: 'blocked', contained: true,
            text: 'It stopped the spread, but everyone else lost their work too. Disconnecting one computer was enough.' },
          { id: 'wait', label: 'Wait and watch', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 15 }, node: 'danger',
            text: 'The ransomware kept locking files. This needed action right away.' }
        ]
      },
      {
        id: 'm4-password',
        title: 'An employee forgot their password',
        story: 'Sara from Finance cannot log in and calls the help desk for a new password.',
        visual: { from: 'computer', to: 'server', focus: 'computer', tag: 'Can’t log in' },
        clue: 'Sara is calling from her desk phone, and her manager is next to her.',
        telemetry: { failedLogins: 3 },
        truth: 'benign',
        drain: 0,
        options: [
          { id: 'verify', label: 'Check it’s really Sara, then reset it', band: 'allow', grade: 'best', points: 150, effects: {}, node: 'safe',
            text: 'Perfect. Not every problem is an attack. Checking who is asking, then helping, is good security.' },
          { id: 'lock', label: 'Lock her account until tomorrow', band: 'contain', grade: 'acceptable', points: 60, effects: { stability: -10 }, node: 'blocked',
            text: 'Safe, but Sara cannot work today. Checking her identity would have solved it now.' },
          { id: 'share', label: 'Give her a coworker’s password', band: 'investigate', grade: 'wrong', points: -80, effects: { integrity: -10 }, node: 'danger',
            text: 'Never share passwords. If that account is misused, nobody can tell who did it.' }
        ]
      },
      {
        id: 'm4-flood',
        title: 'The website is flooded with logins',
        story: 'Thousands of login attempts per minute are hitting the server from unknown places.',
        visual: { from: 'internet', to: 'server', focus: 'server', tag: '1,840 attempts' },
        clue: 'The passwords being tried come from a list stolen from another company.',
        telemetry: { failedLogins: 1840, privileged: true, geoAnomaly: true, newDevice: true },
        truth: 'malicious',
        drain: 0.8,
        options: [
          { id: 'block', label: 'Block the unknown places', band: 'contain', grade: 'best', points: 150, effects: { threat: -20 }, node: 'safe', contained: true,
            text: 'Well done! Blocking where the attack came from stopped it, and the website stayed online.' },
          { id: 'offline', label: 'Take the whole website offline', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -15, stability: -15 }, node: 'blocked', contained: true,
            text: 'The attack stopped, but so did the website for real customers.' },
          { id: 'ignore', label: 'Ignore it', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 10 }, node: 'danger',
            text: 'Some of those stolen passwords might work. Ignoring it gave the attackers more chances.' }
        ]
      },
      {
        id: 'm4-leak',
        title: 'Private files are quietly leaving',
        story: 'The database is slowly sending customer files to a popular cloud storage website.',
        visual: { from: 'database', to: 'internet', focus: 'database', tag: 'Sending files' },
        clue: 'The cloud storage account does not belong to the company.',
        telemetry: { volumeRatio: 2.2, destination: 'known', privileged: true },
        truth: 'malicious',
        drain: 1.0,
        options: [
          { id: 'block', label: 'Block the upload', band: 'contain', grade: 'best', points: 150, effects: { threat: -20 }, node: 'safe', contained: true,
            text: 'Great catch! The AI thought a famous cloud website was safe. The clue showed it was not.' },
          { id: 'shutdown', label: 'Shut down the database', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -15, stability: -25 }, node: 'blocked', contained: true,
            text: 'The leak stopped, but every app that needs the database stopped too.' },
          { id: 'watch', label: 'Keep watching', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 10 }, node: 'danger',
            text: 'Customer files kept leaking. The AI underestimated this one, and the clue showed why.' }
        ]
      }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Mission text                                                         */
  /* ------------------------------------------------------------------ */
  var missions = [
    { id: 'spot', title: 'Spot the Threat', par: 50,
      intro: 'Look at what is happening on the network. Decide if it looks safe or suspicious.',
      takeaway: 'Warning signs include strange times, unknown websites and messages that rush you. But unusual does not always mean dangerous.' },
    { id: 'teach', title: 'Teach the AI', par: 50,
      intro: 'AI learns from examples. Label 8 examples as safe or suspicious, and the AI will learn from your answers.',
      takeaway: 'AI learns from examples. Good examples make a smart AI. Wrong examples teach it the wrong lesson.' },
    { id: 'trust', title: 'Can You Trust the AI?', par: 50,
      intro: 'NEXUS, your AI helper, will suggest what to do. Check the clues and decide if you agree.',
      takeaway: 'AI is fast and helpful, but it makes mistakes. People bring the clues and common sense that AI can miss.' },
    { id: 'save', title: 'Save the Network', par: 60,
      intro: 'The network is under attack! Make quick decisions to protect it before time runs out.',
      takeaway: 'Protecting a network means acting fast, stopping real threats, and not breaking things that are working fine.' }
  ];

  var lessons = [
    { id: 'protect', title: 'Cybersecurity protects people and information',
      text: 'It keeps files, accounts and money safe from people who want to steal or break them.' },
    { id: 'detect', title: 'AI can spot unusual activity',
      text: 'AI can watch millions of events and point out the strange ones, much faster than a person could.' },
    { id: 'learn', title: 'AI learns from examples',
      text: 'The AI you trained used a method called k-nearest neighbors: it compares a new event to the most similar examples you labeled.' },
    { id: 'mistakes', title: 'AI makes mistakes',
      text: 'Sometimes it raises an alert for something safe. Sometimes it misses a real attack. Both happened today.' },
    { id: 'together', title: 'People and AI work best together',
      text: 'AI is fast. People bring clues, context and judgment. Security teams need both, and that is what the AI & Cybersecurity major teaches.' }
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
