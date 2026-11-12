/*
 * CyberQuest — scenario data
 *
 * Every incident here is fictional. External addresses use the
 * documentation-reserved ranges from RFC 5737 (192.0.2.0/24,
 * 198.51.100.0/24, 203.0.113.0/24) and domains use the reserved
 * ".example" TLD from RFC 2606. Internal addresses are private RFC 1918
 * space. Nothing in this file is connected to a real system.
 *
 * Scenario shape (missions 1, 3 and 4):
 *   telemetry  – machine signals that NEXUS is allowed to see
 *   facts      – what the analyst sees before inspecting
 *   evidence   – business context revealed by "Inspect evidence"
 *                (NEXUS cannot see this — that is the point)
 *   truth      – ground truth used for scoring, never shown up front
 *   outcomes   – per-action grade, points, effects and explanation
 */
(function (CQ) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Network topology                                                     */
  /* ------------------------------------------------------------------ */

  var network = {
    zones: [
      { id: 'internet', label: 'Internet' },
      { id: 'perimeter', label: 'Perimeter' },
      { id: 'internal', label: 'Internal network' },
      { id: 'data', label: 'Data centre' }
    ],
    nodes: [
      { id: 'gateway', type: 'gateway', name: 'Gateway', ip: '10.0.0.1', zone: 'perimeter', role: 'External gateway and firewall' },
      { id: 'core', type: 'switch', name: 'Core switch', ip: '10.0.0.2', zone: 'internal', role: 'Connects every internal segment' },
      { id: 'web', type: 'server', name: 'Web server', ip: '10.0.0.20', zone: 'internal', role: 'Public website (DMZ)' },
      { id: 'auth', type: 'auth', name: 'Auth server', ip: '10.0.1.10', zone: 'internal', role: 'Sign-in and passwords' },
      { id: 'itops', type: 'ops', name: 'IT operations', ip: '10.0.2.0/24', zone: 'internal', role: 'Admin jump host and security scanner' },
      { id: 'ws114', type: 'workstation', name: 'WS-114', ip: '10.0.3.114', zone: 'internal', role: 'Employee workstation' },
      { id: 'ws207', type: 'workstation', name: 'WS-207', ip: '10.0.3.207', zone: 'internal', role: 'Employee workstation' },
      { id: 'ws311', type: 'workstation', name: 'WS-311', ip: '10.0.3.31', zone: 'internal', role: 'Employee workstation' },
      { id: 'db', type: 'database', name: 'Database', ip: '10.0.4.30', zone: 'data', role: 'Customer and finance records' },
      { id: 'vault', type: 'vault', name: 'Backup vault', ip: '10.0.8.20', zone: 'data', role: 'Nightly backups' },
      { id: 'ai', type: 'ai', name: 'AI monitor', ip: '10.0.9.5', zone: 'data', role: 'NEXUS telemetry and the Defender model' }
    ],
    // Four slots for external endpoints; scenarios assign labels at runtime.
    externals: ['ext1', 'ext2', 'ext3', 'ext4'],
    links: [
      { id: 'ext1-gateway', from: 'ext1', to: 'gateway' },
      { id: 'ext2-gateway', from: 'ext2', to: 'gateway' },
      { id: 'ext3-gateway', from: 'ext3', to: 'gateway' },
      { id: 'ext4-gateway', from: 'ext4', to: 'gateway' },
      { id: 'gateway-core', from: 'gateway', to: 'core' },
      { id: 'core-web', from: 'core', to: 'web' },
      { id: 'core-auth', from: 'core', to: 'auth' },
      { id: 'core-itops', from: 'core', to: 'itops' },
      { id: 'core-ws114', from: 'core', to: 'ws114' },
      { id: 'core-ws207', from: 'core', to: 'ws207' },
      { id: 'core-ws311', from: 'core', to: 'ws311' },
      { id: 'core-db', from: 'core', to: 'db' },
      { id: 'db-vault', from: 'db', to: 'vault' },
      { id: 'core-ai', from: 'core', to: 'ai', kind: 'telemetry' }
    ],
    // Everyday traffic used for the ambient animation.
    ambientRoutes: [
      ['ext1', 'gateway', 'core', 'web'],
      ['ws114', 'core', 'auth'],
      ['ws207', 'core', 'db'],
      ['ws311', 'core', 'gateway', 'ext3'],
      ['web', 'core', 'db'],
      ['itops', 'core', 'web'],
      ['core', 'ai']
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Mission 1 — Identify the intrusion                                   */
  /* ------------------------------------------------------------------ */

  var mission1 = [
    {
      id: 'm1-exfil',
      title: 'Large overnight upload',
      time: 'Mon 02:14:07',
      source: { label: 'WS-114', ip: '10.0.3.114', node: 'ws114' },
      destination: { label: 'cdn-sync.example', ip: '198.51.100.23', node: 'ext2' },
      protocol: 'HTTPS / TCP 443',
      external: { slot: 'ext2', label: '198.51.100.23' },
      route: ['ws114', 'core', 'gateway', 'ext2'],
      focus: 'ws114',
      telemetry: { volumeRatio: 40, offHours: true, destination: 'new', processSigned: false },
      facts: ['2.3 GB uploaded in 11 minutes', 'This workstation normally sends about 60 MB a day', 'Started at 02:14 while the office was closed'],
      evidence: [
        'The domain cdn-sync.example was registered three days ago.',
        'The upload comes from “updater.exe” in the user’s Downloads folder, not from approved software.',
        'Building access log: the owner of WS-114 badged out at 18:05 and has not returned.'
      ],
      truth: 'malicious',
      actionText: {
        investigate: 'Open a case, let the upload continue',
        isolate: 'Disconnect WS-114 from the network',
        allow: 'Mark the upload as approved',
        dismiss: 'Close the alert as noise'
      },
      outcomes: {
        isolate: { grade: 'best', points: 100, effects: { threat: -20 }, node: 'isolated', contained: true,
          text: 'Correct. Unknown software sending gigabytes to a three-day-old domain at 2 a.m. is data theft (exfiltration). Isolating WS-114 stopped it.' },
        investigate: { grade: 'partial', points: 30, effects: { integrity: -10 }, node: 'compromised',
          text: 'Investigating is never wrong in itself, but here the evidence was already strong. Data kept leaving while the case stayed open.' },
        allow: { grade: 'wrong', points: -80, effects: { integrity: -20, threat: 15 }, node: 'compromised',
          text: 'That upload was data theft. Unsigned software, a brand-new domain and a 40× jump in volume all pointed the same way.' },
        dismiss: { grade: 'wrong', points: -80, effects: { integrity: -20, threat: 15 }, node: 'compromised',
          text: 'Dismissing it let 2.3 GB of company data leave. This was exfiltration, not noise.' }
      }
    },
    {
      id: 'm1-scan',
      title: 'Burst of connections to servers',
      time: 'Mon 09:30:02',
      source: { label: 'IT operations', ip: '10.0.2.40', node: 'itops' },
      destination: { label: 'Web, auth and database servers', ip: 'multiple', node: 'core' },
      protocol: 'TCP, 1,000+ ports',
      route: ['itops', 'core', 'db'],
      focus: 'itops',
      telemetry: { connections: 2400, lateral: 12, privileged: true },
      facts: ['2,400 connection attempts in 90 seconds', 'Targets: web, authentication and database servers', 'Source: 10.0.2.40, inside IT operations'],
      evidence: [
        '10.0.2.40 is the security team’s registered vulnerability scanner.',
        'The quarterly scan is on the security calendar for today at 09:30.',
        'Every request carries the scanner’s agreed identification header.'
      ],
      truth: 'benign',
      actionText: {
        investigate: 'Open a case and keep watching',
        isolate: 'Block 10.0.2.40 from the servers',
        allow: 'Mark as the approved security scan',
        dismiss: 'Close the alert as a false alarm'
      },
      outcomes: {
        allow: { grade: 'best', points: 100, effects: {}, node: 'secure',
          text: 'Correct. It looked like an attacker mapping the network, but it was your own scheduled vulnerability scan. Unusual is not the same as malicious.' },
        dismiss: { grade: 'acceptable', points: 70, effects: {}, node: 'normal',
          text: 'Right call: it was a false positive. Marking it as approved, rather than just closing it, also helps tune future alerts.' },
        investigate: { grade: 'partial', points: 20, effects: {}, node: 'normal',
          text: 'Harmless, but the security calendar already answered the question. Escalating approved work costs analyst time.' },
        isolate: { grade: 'wrong', points: -40, effects: { stability: -10 }, node: 'isolated',
          text: 'You blocked the security team’s own scanner. Any real weaknesses on those servers now go undiscovered.' }
      }
    },
    {
      id: 'm1-spray',
      title: 'Sign-in failures across many accounts',
      time: 'Mon 10:41:52',
      source: { label: 'Unknown host', ip: '203.0.113.47', node: 'ext1' },
      destination: { label: 'Auth server', ip: '10.0.1.10', node: 'auth' },
      protocol: 'HTTPS / TCP 443 (sign-in portal)',
      external: { slot: 'ext1', label: '203.0.113.47' },
      route: ['ext1', 'gateway', 'core', 'auth'],
      focus: 'auth',
      telemetry: { failedLogins: 312, distinctAccounts: 41, geoAnomaly: true, newDevice: true },
      facts: ['312 failed sign-ins in 4 minutes', '41 different usernames tried', 'No successful sign-in so far'],
      evidence: [
        'The source address has never contacted the organisation before.',
        'Attempts arrive every 0.8 seconds, faster than a person can type.',
        'Each account was tried with a few very common passwords. This pattern is called password spraying.'
      ],
      truth: 'malicious',
      actionText: {
        investigate: 'Open a case, keep the portal open to it',
        isolate: 'Block 203.0.113.47 at the gateway',
        allow: 'Treat as normal sign-in traffic',
        dismiss: 'Close the alert as noise'
      },
      outcomes: {
        isolate: { grade: 'best', points: 100, effects: { threat: -15 }, node: 'secure', contained: true,
          text: 'Correct. Automated guessing against 41 accounts is password spraying. Blocking the source stopped it before any account fell.' },
        investigate: { grade: 'partial', points: 30, effects: { integrity: -5 }, node: 'alert',
          text: 'A reasonable instinct, but the pattern was already clear. While the case sat open, the attacker kept guessing passwords.' },
        allow: { grade: 'wrong', points: -60, effects: { integrity: -15, threat: 10 }, node: 'compromised',
          text: 'This is how accounts get taken over. 312 failures across 41 accounts from a stranger is an attack, not normal traffic.' },
        dismiss: { grade: 'wrong', points: -60, effects: { integrity: -15, threat: 10 }, node: 'compromised',
          text: 'Dismissed as noise, but it was password spraying. One weak password would have let the attacker in.' }
      }
    },
    {
      id: 'm1-admin',
      title: 'Administrator session on web server',
      time: 'Mon 11:03:20',
      source: { label: 'IT jump host', ip: '10.0.2.5', node: 'itops' },
      destination: { label: 'Web server', ip: '10.0.0.20', node: 'web' },
      protocol: 'SSH / TCP 22',
      route: ['itops', 'core', 'web'],
      focus: 'web',
      telemetry: { privileged: true },
      facts: ['Administrator session opened on the web server', 'Account: r.alqahtani (IT operations)', 'Origin: the IT jump host'],
      evidence: [
        'Change ticket CHG-2291 approves web server patching today, 11:00–12:00.',
        'Multi-factor authentication passed on the administrator’s registered phone.',
        'Commands so far match the documented patch procedure.'
      ],
      truth: 'benign',
      actionText: {
        investigate: 'Open a case and keep watching',
        isolate: 'End the session and block the jump host',
        allow: 'Mark as approved maintenance',
        dismiss: 'Close the alert'
      },
      outcomes: {
        allow: { grade: 'best', points: 100, effects: {}, node: 'secure',
          text: 'Correct. A planned, approved and verified admin session. Recognising legitimate work keeps the business running.' },
        dismiss: { grade: 'acceptable', points: 70, effects: {}, node: 'normal',
          text: 'Fine, it was legitimate. Recording it as approved maintenance gives the next analyst more context.' },
        investigate: { grade: 'partial', points: 20, effects: {}, node: 'normal',
          text: 'Not harmful, but the change ticket already explained it. Every unnecessary case takes time from real threats.' },
        isolate: { grade: 'wrong', points: -50, effects: { stability: -15 }, node: 'isolated',
          text: 'You cut off an approved patch session. The web server stays unpatched and IT loses its maintenance window.' }
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 2 — Train the AI defender                                    */
  /* ------------------------------------------------------------------ */

  // Feature order for the classifier. Values are normalised to 0–1.
  var features = [
    { id: 'failed', name: 'Failed logins' },
    { id: 'time', name: 'Unusual hour' },
    { id: 'reputation', name: 'Destination risk' },
    { id: 'volume', name: 'Data volume' },
    { id: 'device', name: 'Unfamiliar device' }
  ];

  // Training examples: the player supplies the labels. `truth` is used only
  // to score labelling quality after training, never fed to the model.
  var training = [
    { id: 'T1', title: 'Morning sign-in from a known office laptop',
      x: [0.05, 0.1, 0.05, 0.1, 0.0], display: ['1', '08:55', 'Trusted', '40 MB', 'Known'], truth: 'benign' },
    { id: 'T2', title: '45 failed logins, then success from a new device at 03:00',
      x: [0.9, 0.9, 0.5, 0.2, 1.0], display: ['45', '03:02', 'Unknown', '80 MB', 'Never seen'], truth: 'malicious' },
    { id: 'T3', title: 'Huge upload to a newly registered site at night',
      x: [0.1, 0.8, 0.85, 0.95, 0.3], display: ['2', '01:40', 'New domain', '9 GB', 'Rarely used'], truth: 'malicious' },
    { id: 'T4', title: 'Evening VPN sign-in from an employee’s home laptop',
      x: [0.1, 0.6, 0.2, 0.2, 0.1], display: ['2', '20:15', 'Trusted', '90 MB', 'Known'], truth: 'benign' },
    { id: 'T5', title: 'Small messages to a known malware server',
      x: [0.0, 0.4, 0.95, 0.15, 0.2], display: ['0', '16:30', 'Blocklisted', '6 MB', 'Known'], truth: 'malicious' },
    { id: 'T6', title: 'Monthly report sent to a trusted partner',
      x: [0.0, 0.2, 0.15, 0.8, 0.0], display: ['0', '10:00', 'Trusted', '4 GB', 'Known'], truth: 'benign' },
    { id: 'T7', title: 'New phone enrolled by IT, first sign-in',
      x: [0.05, 0.2, 0.1, 0.1, 0.9], display: ['1', '09:20', 'Trusted', '15 MB', 'Never seen'], truth: 'benign' },
    { id: 'T8', title: 'Password guessing across many accounts',
      x: [1.0, 0.3, 0.6, 0.05, 0.8], display: ['300+', '11:10', 'Unknown', '2 MB', 'Never seen'], truth: 'malicious' }
  ];

  // Held-out test set: never shown during labelling, never used in training.
  var testSet = [
    { id: 'Q1', title: 'Repeated failed logins from an unknown laptop',
      x: [0.85, 0.7, 0.55, 0.1, 0.9], display: ['38', '23:48', 'Unknown', '20 MB', 'Never seen'], truth: 'malicious' },
    { id: 'Q2', title: 'Routine sign-in, ordinary email traffic',
      x: [0.0, 0.15, 0.1, 0.15, 0.05], display: ['0', '09:05', 'Trusted', '55 MB', 'Known'], truth: 'benign' },
    { id: 'Q3', title: 'Night-time upload to an unfamiliar site',
      x: [0.05, 0.85, 0.8, 0.9, 0.4], display: ['1', '02:30', 'New domain', '7 GB', 'Rarely used'], truth: 'malicious' },
    { id: 'Q4', title: 'Large design files shared with a trusted supplier',
      x: [0.0, 0.3, 0.3, 0.85, 0.05], display: ['0', '14:20', 'Partner', '6 GB', 'Known'], truth: 'benign' },
    { id: 'Q5', title: 'Replacement laptop issued by IT',
      x: [0.1, 0.3, 0.15, 0.1, 0.85], display: ['2', '10:40', 'Trusted', '30 MB', 'Never seen'], truth: 'benign' },
    { id: 'Q6', title: 'Quiet connections to a blocklisted server',
      x: [0.05, 0.5, 0.9, 0.2, 0.3], display: ['1', '17:55', 'Blocklisted', '8 MB', 'Rarely used'], truth: 'malicious' }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 3 — Human vs. AI                                             */
  /* ------------------------------------------------------------------ */

  // follow / override describe what each button actually does.
  var mission3 = [
    {
      id: 'm3-beacon',
      title: 'Regular connections to an outside server',
      time: 'Mon 13:12:40',
      source: { label: 'WS-207', ip: '10.0.3.207', node: 'ws207' },
      destination: { label: 'Unknown server', ip: '192.0.2.66', node: 'ext3' },
      protocol: 'HTTPS / TCP 443',
      external: { slot: 'ext3', label: '192.0.2.66' },
      route: ['ws207', 'core', 'gateway', 'ext3'],
      focus: 'ws207',
      telemetry: { periodic: true, periodSeconds: 60, destination: 'flagged', processSigned: false, volumeRatio: 1 },
      facts: ['A small connection every 60 seconds', 'Running since 12:48', 'Very little data each time'],
      evidence: [
        '192.0.2.66 is listed in two threat-intelligence feeds as a malware command server.',
        'The process is “svch0st.exe”, with a zero, imitating the real Windows file svchost.exe.',
        'No business application on WS-207 needs this address.'
      ],
      actions: { contain: 'Isolate WS-207', allow: 'Allow the connections' },
      truth: 'malicious',
      correctBand: 'contain',
      outcomes: {
        contain: { points: 100, effects: { threat: -15 }, node: 'isolated', contained: true,
          text: 'NEXUS was right, and the evidence backs it up: a disguised program checking in with a known malware server every minute. This is called beaconing.' },
        allow: { points: -60, effects: { integrity: -15, threat: 15 }, node: 'compromised',
          text: 'Overriding NEXUS here let malware keep its line to the attacker open. When the evidence agrees with the AI, trust both.' }
      }
    },
    {
      id: 'm3-backup',
      title: 'Very large transfer from the database',
      time: 'Tue 01:00:04',
      source: { label: 'Database', ip: '10.0.4.30', node: 'db' },
      destination: { label: 'Backup vault vault-02', ip: '10.0.8.20', node: 'vault' },
      protocol: 'TLS / TCP 443',
      route: ['db', 'vault'],
      focus: 'db',
      telemetry: { volumeRatio: 8, offHours: true, privileged: true, destination: 'new' },
      facts: ['38 GB leaving the database server', '8× the nightly average', 'Started at 01:00, office closed'],
      evidence: [
        'The scheduled job “db-full-backup” started it, as it does on the last day of every month.',
        'Month-end jobs are full backups, so 8× the nightly size is expected.',
        'vault-02 was commissioned last week under change ticket CHG-2270, which is why NEXUS has never seen it.'
      ],
      actions: { contain: 'Block the transfer', allow: 'Allow the backup' },
      truth: 'benign',
      correctBand: 'allow',
      outcomes: {
        allow: { points: 150, effects: {}, node: 'secure',
          text: 'Well caught. NEXUS saw size, time and a new destination. It could not see the schedule or the change ticket. This was a false positive, and you overrode it for the right reasons.' },
        contain: { points: -60, effects: { stability: -20 }, node: 'isolated',
          text: 'The backup was blocked. If the database fails tonight, there is no recent copy. NEXUS raised a false positive; the evidence showed an approved job.' }
      }
    },
    {
      id: 'm3-update',
      title: 'Big download to a laptop',
      time: 'Tue 13:40:15',
      source: { label: 'updates.vendor.example', ip: '198.51.100.10', node: 'ext4' },
      destination: { label: 'WS-311', ip: '10.0.3.31', node: 'ws311' },
      protocol: 'HTTPS / TCP 443',
      external: { slot: 'ext4', label: '198.51.100.10' },
      route: ['ext4', 'gateway', 'core', 'ws311'],
      focus: 'ws311',
      telemetry: { volumeRatio: 2, destination: 'known', processSigned: true },
      facts: ['1.8 GB downloaded to WS-311', 'From updates.vendor.example', 'Started at 13:40'],
      evidence: [
        'The package is signed by the software vendor and the signature checks out.',
        'IT’s patch policy pushes this update to every laptop this week.',
        'The same download finished on 212 other laptops without problems.'
      ],
      actions: { contain: 'Block the download', allow: 'Allow the update' },
      truth: 'benign',
      correctBand: 'allow',
      outcomes: {
        allow: { points: 100, effects: {}, node: 'secure',
          text: 'Correct. NEXUS and the evidence agree: a signed security update. Overriding the AI only makes sense when the evidence disagrees with it.' },
        contain: { points: -40, effects: { stability: -10 }, node: 'isolated',
          text: 'You blocked a genuine security patch, leaving WS-311 more exposed. NEXUS was right this time; checking the evidence would have shown it.' }
      }
    },
    {
      id: 'm3-mfa',
      title: 'Sign-in to a finance account',
      time: 'Tue 15:22:31',
      source: { label: 'VPN user', ip: '198.51.100.77', node: 'ext1' },
      destination: { label: 'Auth server', ip: '10.0.1.10', node: 'auth' },
      protocol: 'HTTPS / TCP 443 (VPN sign-in)',
      external: { slot: 'ext1', label: '198.51.100.77' },
      route: ['ext1', 'gateway', 'core', 'auth'],
      focus: 'auth',
      telemetry: { mfaPassed: true, newDevice: true },
      facts: ['Successful sign-in as s.otaibi (Finance)', 'Multi-factor approval received', 'Signed in from a new laptop'],
      evidence: [
        'The account got 14 multi-factor push requests in 3 minutes before one was approved. Attackers do this hoping the user taps “Approve” to make it stop.',
        'HR records show s.otaibi is on annual leave this week.',
        'This account’s password appeared in a public breach list last month.'
      ],
      actions: { contain: 'Lock the account and end the session', allow: 'Allow the sign-in' },
      truth: 'malicious',
      correctBand: 'contain',
      outcomes: {
        contain: { points: 150, effects: { threat: -15 }, node: 'secure', contained: true,
          text: 'Excellent. NEXUS was confident and wrong. A passed MFA check looked reassuring, but the push flood, the leave record and the leaked password show an account takeover (MFA fatigue). This was a false negative.' },
        allow: { points: -80, effects: { integrity: -20, threat: 15 }, node: 'compromised',
          text: 'An attacker is now inside a finance account. NEXUS missed it, a false negative, because an approved MFA prompt looks safe in the telemetry. The context told a different story.' }
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Mission 4 — Final defense                                            */
  /* ------------------------------------------------------------------ */

  // drain: integrity lost per second while the threat is active.
  // arrival: seconds after the mission starts that the alert appears.
  var mission4 = {
    duration: 90,
    incidents: [
      {
        id: 'm4-payroll',
        arrival: 0,
        title: 'Huge outbound file transfer',
        time: 'Wed 14:00:03',
        source: { label: 'Database', ip: '10.0.4.30', node: 'db' },
        destination: { label: 'sftp.bank-partner.example', ip: '192.0.2.150', node: 'ext4' },
        protocol: 'SFTP / TCP 22',
        external: { slot: 'ext4', label: '192.0.2.150' },
        route: ['db', 'core', 'gateway', 'ext4'],
        focus: 'db',
        telemetry: { volumeRatio: 12, destination: 'new', privileged: true },
        facts: ['1.2 GB leaving for an outside server', '12× this account’s usual volume', 'Held by policy until an analyst decides'],
        evidence: [
          'Payroll run PR-2026-11 was approved by the finance director this morning.',
          'The bank announced its new transfer server, 192.0.2.150, in a signed notice last month.',
          'The file holds 1,900 salary records, the same as every month.'
        ],
        truth: 'benign',
        drain: 0,
        unresolvedEffects: { stability: -10 },
        unresolvedText: 'The payroll transfer was still on hold when time ran out. Salaries will be late.',
        options: [
          { id: 'allow', label: 'Release the payroll transfer', band: 'allow', grade: 'best', points: 150, effects: {}, node: 'secure',
            text: 'Correct. It looked like data theft, but it was approved payroll going to the bank’s announced server. Keeping the business running is part of security.' },
          { id: 'hold', label: 'Keep holding for manual verification', band: 'investigate', grade: 'acceptable', points: 60, effects: { stability: -5 }, node: 'alert',
            text: 'Cautious and not wrong, but the evidence already confirmed it. Payroll is delayed while someone re-checks.' },
          { id: 'block', label: 'Block the transfer permanently', band: 'contain', grade: 'wrong', points: -80, effects: { stability: -25 }, node: 'isolated',
            text: 'You stopped payroll for 1,900 employees. Blocking legitimate business activity is a real cost, not a safe default.' }
        ]
      },
      {
        id: 'm4-stuffing',
        arrival: 3,
        title: 'Attack on administrator sign-ins',
        time: 'Wed 14:00:06',
        source: { label: 'Many addresses', ip: '203.0.113.0/24', node: 'ext1' },
        destination: { label: 'Auth server', ip: '10.0.1.10', node: 'auth' },
        protocol: 'HTTPS / TCP 443 (sign-in portal)',
        external: { slot: 'ext1', label: '203.0.113.0/24' },
        route: ['ext1', 'gateway', 'core', 'auth'],
        focus: 'auth',
        telemetry: { failedLogins: 1840, privileged: true, geoAnomaly: true, newDevice: true },
        facts: ['1,840 failed sign-ins in 2 minutes', 'Only administrator accounts targeted', 'Coming from 200+ addresses at once'],
        evidence: [
          'The passwords being tried match a list leaked from another company.',
          'Every source address belongs to one hosting range, 203.0.113.0/24.',
          'Two administrators reused passwords that appear on that leaked list.'
        ],
        truth: 'malicious',
        drain: 0.5,
        options: [
          { id: 'block', label: 'Block 203.0.113.0/24 at the gateway', band: 'contain', grade: 'best', points: 150, effects: { threat: -20 }, node: 'secure', contained: true,
            text: 'Correct. Blocking the whole source range stopped this credential-stuffing attack without locking out your own team.' },
          { id: 'lock', label: 'Lock every administrator account', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -15, stability: -15 }, node: 'secure', contained: true,
            text: 'It stopped the attack, but it also locked out the IT team in the middle of an incident. Blocking the source was more precise.' },
          { id: 'monitor', label: 'Keep monitoring', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 10 }, node: 'compromised',
            text: 'Watching is not containing. Two admins reused leaked passwords, so this attack can succeed.' }
        ]
      },
      {
        id: 'm4-exfil',
        arrival: 6,
        title: 'Steady transfer to cloud storage',
        time: 'Wed 14:00:09',
        source: { label: 'Database', ip: '10.0.4.30', node: 'db' },
        destination: { label: 'storage.cloudshare.example', ip: '198.51.100.140', node: 'ext2' },
        protocol: 'HTTPS / TCP 443',
        external: { slot: 'ext2', label: '198.51.100.140' },
        route: ['db', 'core', 'gateway', 'ext2'],
        focus: 'db',
        telemetry: { volumeRatio: 2.2, destination: 'known', privileged: true },
        facts: ['Slow, steady upload to a cloud storage service', 'About 2× normal volume', 'Running under the reporting service account'],
        evidence: [
          'The storage account receiving the data is not owned by the organisation.',
          'The database query exported the entire customer table, including national ID numbers.',
          'This service account normally reads only one small reporting view.'
        ],
        truth: 'malicious',
        drain: 0.7,
        options: [
          { id: 'block', label: 'Block the outbound connection', band: 'contain', grade: 'best', points: 150, effects: { threat: -20 }, node: 'secure', contained: true,
            text: 'Correct. NEXUS rated this low because the cloud provider is well known. The evidence showed customer data flowing to an account you don’t own. A false negative caught.' },
          { id: 'shutdown', label: 'Shut down the database server', band: 'contain', grade: 'acceptable', points: 60, effects: { threat: -15, stability: -25 }, node: 'isolated', contained: true,
            text: 'The leak stopped, but every application that needs the database went down with it. Blocking one connection was enough.' },
          { id: 'monitor', label: 'Keep monitoring', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 10 }, node: 'compromised',
            text: 'Customer records kept leaving. A known cloud provider does not mean a trusted destination; the account belonged to someone else.' }
        ]
      },
      {
        id: 'm4-ransom',
        arrival: 9,
        title: 'Files changing fast on a workstation',
        time: 'Wed 14:00:12',
        source: { label: 'WS-311', ip: '10.0.3.31', node: 'ws311' },
        destination: { label: 'File shares on 37 machines', ip: 'multiple', node: 'core' },
        protocol: 'SMB / TCP 445',
        route: ['ws311', 'core', 'ws114'],
        focus: 'ws311',
        telemetry: { lateral: 37, fileChanges: 1200, processSigned: false, privileged: true },
        facts: ['1,200 files rewritten every minute', 'Connecting to file shares on 37 machines', 'Started 40 seconds ago'],
        evidence: [
          'Rewritten files now end in “.locked” and cannot be opened.',
          'A ransom note, README_RESTORE.txt, appeared on the shared drive.',
          'It uses an administrator password stolen earlier in the week.'
        ],
        truth: 'malicious',
        drain: 1.2,
        options: [
          { id: 'isolate', label: 'Isolate WS-311 from the network', band: 'contain', grade: 'best', points: 150, effects: { threat: -25 }, node: 'isolated', contained: true,
            text: 'Correct. This was ransomware spreading across file shares, the most urgent threat on the board. Isolating the source stopped the spread.' },
          { id: 'smb', label: 'Block file sharing for WS-311 only', band: 'investigate', grade: 'acceptable', points: 60, effects: { threat: -15, integrity: -5 }, node: 'alert', contained: true,
            text: 'That slowed the spread, but the infected machine is still on the network and can try other routes. Full isolation was safer.' },
          { id: 'monitor', label: 'Keep monitoring', band: 'allow', grade: 'wrong', points: -80, effects: { threat: 15 }, node: 'compromised',
            text: 'Ransomware kept encrypting files across 37 machines. This needed immediate containment.' }
        ]
      }
    ],
    // Which incident should be handled first, and how much a first choice is worth.
    priorityBonus: { 'm4-ransom': 100, 'm4-exfil': 30, 'm4-stuffing': 30, 'm4-payroll': -50 }
  };

  /* ------------------------------------------------------------------ */
  /* Copy: briefings, takeaways, concepts                                 */
  /* ------------------------------------------------------------------ */

  var missions = [
    { id: 'intrusion', short: 'Intrusion', title: 'Identify the intrusion', par: 60,
      briefing: 'Four alerts are waiting from the overnight shift. Inspect each one, then decide how to respond.',
      goal: 'Resolve all four alerts.',
      takeaway: 'Unusual is not the same as malicious. The second-highest anomaly score belonged to your own security scan, and the admin session was approved work. Good analysts check context before acting.' },
    { id: 'train', short: 'Train', title: 'Train the AI defender', par: 60,
      briefing: 'You will teach a small machine-learning model to spot threats. Label eight examples. The model learns only from your labels, then faces six events it has never seen.',
      goal: 'Label all eight examples, then train.',
      takeaway: 'A model is only as good as its training data. Wrong labels become wrong predictions, and even a good model is unsure near the boundary between classes.' },
    { id: 'versus', short: 'Human vs. AI', title: 'Human vs. AI', par: 60,
      briefing: 'NEXUS will recommend an action for four incidents. NEXUS sees network telemetry but not business records. Follow it or override it.',
      goal: 'Decide on all four incidents.',
      takeaway: 'AI is a decision-support tool, not an authority. NEXUS was confident and wrong twice, once raising a false alarm and once missing a real attack.' },
    { id: 'defense', short: 'Final defense', title: 'Final defense', par: 90,
      briefing: 'A coordinated attack has started. Four alerts will arrive within seconds. Active threats damage the network every second until you contain them. Choose what to handle first.',
      goal: 'Contain the threats before the clock runs out.',
      takeaway: 'Incident response is about priorities: stop what spreads fastest, protect what matters most, and don’t break the business while doing it.' }
  ];

  var concepts = [
    { id: 'anomaly', title: 'Anomaly detection',
      text: 'Systems learn what normal looks like and flag what doesn’t fit. That catches attacks, but also catches unusual and legitimate work.' },
    { id: 'ml', title: 'Machine learning',
      text: 'Instead of writing every rule by hand, a model learns patterns from labelled examples. Your Defender used k-nearest neighbours: it labels a new event by looking at the most similar examples it was trained on.' },
    { id: 'fp', title: 'False positives',
      text: 'An alert that turns out to be harmless, like the security scan and the month-end backup. Too many of them bury real threats and wear out analysts.' },
    { id: 'fn', title: 'False negatives',
      text: 'A real attack that the system scores as safe, like the MFA-fatigue sign-in and the slow leak to cloud storage. These are the most dangerous mistakes because nobody is looking.' },
    { id: 'hai', title: 'Human–AI collaboration',
      text: 'AI is fast at scoring thousands of signals. People bring context: schedules, tickets, HR records and judgement. The strongest defence uses both.' },
    { id: 'ir', title: 'Incident response',
      text: 'Detect, analyse, contain, recover. Under pressure, the skill is deciding what to do first, and containing a threat without shutting down the business.' }
  ];

  CQ.scenarios = {
    network: network,
    mission1: mission1,
    features: features,
    training: training,
    testSet: testSet,
    mission3: mission3,
    mission4: mission4,
    missions: missions,
    concepts: concepts
  };
})(typeof window !== 'undefined' ? (window.CQ = window.CQ || {}) : (globalThis.CQ = globalThis.CQ || {}));
