import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  FileText,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageSquareText,
  Presentation,
  Target,
  UploadCloud,
  Users,
} from 'lucide-react'

export type StartupStatus = 'Applied' | 'Screening' | 'Accepted' | 'Incubating' | 'Demo Day Ready' | 'Alumni'
export type MilestoneStatus = 'done' | 'active' | 'blocked' | 'todo'

export type DeckVersion = {
  version: string
  uploadedAt: string
  score: number
  previousScore?: number
  focus: string
  summary: string
}

export type MentorComment = {
  author: string
  role: string
  date: string
  area: string
  body: string
}

export type StartupMilestone = {
  title: string
  owner: string
  due: string
  status: MilestoneStatus
}

export type UnpadStartup = {
  id: string
  name: string
  founder: string
  faculty: string
  sector: string
  stage: string
  cohort: string
  status: StartupStatus
  mentor: string
  progressScore: number
  deckScore: number
  previousDeckScore: number
  milestoneCompletion: number
  lastActivity: string
  risk: 'Low' | 'Medium' | 'High'
  nextMilestone: string
  oneLiner: string
  deckVersions: DeckVersion[]
  comments: MentorComment[]
  milestones: StartupMilestone[]
}

export const unpadNavItems = [
  { key: 'dashboard', label: 'Dashboard', href: '/unpad', icon: LayoutDashboard },
  { key: 'upload', label: 'Deck upload', href: '/unpad/upload', icon: UploadCloud },
  { key: 'insights', label: 'Insights', href: '/unpad/insights', icon: BookOpen },
  { key: 'announcements', label: 'Announcements', href: '/unpad/announcements', icon: Megaphone },
]

export const unpadCoreTools = [
  { label: 'Deck analysis', href: '/apply', icon: FileText, description: 'Upload and score a new pitch deck' },
  { label: 'Mock pitch', href: '/mock-pitch', icon: Presentation, description: 'Practice pitch or investor Q&A' },
  { label: 'CRM', href: '/crm', icon: Users, description: 'Track investor conversations' },
  { label: 'Calculator', href: '/tools/calculator', icon: BarChart3, description: 'Model dilution and financing terms' },
  { label: 'Weekly news', href: '/news', icon: LineChart, description: 'Read SEA fundraising signals' },
]

export const statusColumns: StartupStatus[] = ['Applied', 'Screening', 'Accepted', 'Incubating', 'Demo Day Ready', 'Alumni']

export const startups: UnpadStartup[] = [
  {
    id: 'naroma',
    name: 'Naroma Indonesia',
    founder: 'Alya Fadilah',
    faculty: 'Agriculture Industrial Technology',
    sector: 'Consumer',
    stage: 'Seed',
    cohort: 'Unpad 2026 Batch A',
    status: 'Incubating',
    mentor: 'Dr. Uji Pratomo',
    progressScore: 76,
    deckScore: 72,
    previousDeckScore: 61,
    milestoneCompletion: 68,
    lastActivity: 'Jun 24, 2026',
    risk: 'Low',
    nextMilestone: 'Validate B2B hotel channel pricing',
    oneLiner: 'Aromatherapy products from Indonesian essential oils with regional storytelling and wellness positioning.',
    deckVersions: [
      {
        version: 'Deck v3',
        uploadedAt: 'Jun 24, 2026',
        score: 72,
        previousScore: 61,
        focus: 'Distribution proof',
        summary: 'Improved go-to-market and product narrative. Still needs clearer unit economics by channel.',
      },
      {
        version: 'Deck v2',
        uploadedAt: 'May 27, 2026',
        score: 61,
        previousScore: 54,
        focus: 'Market sizing',
        summary: 'Better category sizing, but investor ask and use of funds were still broad.',
      },
      {
        version: 'Deck v1',
        uploadedAt: 'Apr 29, 2026',
        score: 54,
        focus: 'Initial submission',
        summary: 'Strong product story. Weak traction evidence and unclear commercial path.',
      },
    ],
    comments: [
      {
        author: 'Hesty Nurul Utami',
        role: 'Incubator lead',
        date: 'Jun 25, 2026',
        area: 'Deck v3 / Slide 9',
        body: 'Add channel margin comparison between campus retail, hotels, and online marketplace before demo day.',
      },
      {
        author: 'Raka Permana',
        role: 'Assigned mentor',
        date: 'Jun 22, 2026',
        area: 'Milestone',
        body: 'Founder has booked three hospitality interviews. Move to demo day prep if at least one LOI lands this week.',
      },
    ],
    milestones: [
      { title: 'Customer discovery interviews', owner: 'Founder', due: 'Jun 20', status: 'done' },
      { title: 'Channel economics draft', owner: 'Founder', due: 'Jun 28', status: 'active' },
      { title: 'Demo day narrative review', owner: 'Mentor', due: 'Jul 5', status: 'todo' },
      { title: 'Investor CRM shortlist', owner: 'Founder', due: 'Jul 10', status: 'todo' },
    ],
  },
  {
    id: 'kokro',
    name: 'KOKRO',
    founder: 'M. Hanif Pradana',
    faculty: 'Pharmacy',
    sector: 'Healthtech',
    stage: 'Pre-seed',
    cohort: 'Unpad 2026 Batch A',
    status: 'Screening',
    mentor: 'Prof. Lia Amalia',
    progressScore: 58,
    deckScore: 55,
    previousDeckScore: 49,
    milestoneCompletion: 42,
    lastActivity: 'Jun 23, 2026',
    risk: 'Medium',
    nextMilestone: 'Clarify regulatory pathway and evidence plan',
    oneLiner: 'Chewable lozenges using cytisine extract aimed at reducing nicotine dependency.',
    deckVersions: [
      {
        version: 'Deck v2',
        uploadedAt: 'Jun 23, 2026',
        score: 55,
        previousScore: 49,
        focus: 'Clinical pathway',
        summary: 'Problem and product are stronger. Regulatory risk and trial plan need sharper detail.',
      },
      {
        version: 'Deck v1',
        uploadedAt: 'May 30, 2026',
        score: 49,
        focus: 'Initial submission',
        summary: 'Interesting science, but investor narrative was too research-heavy.',
      },
    ],
    comments: [
      {
        author: 'Prof. Lia Amalia',
        role: 'Scientific mentor',
        date: 'Jun 24, 2026',
        area: 'Deck v2 / Slide 6',
        body: 'Separate product efficacy evidence from market adoption proof. Investors will ask both, but they are different risks.',
      },
    ],
    milestones: [
      { title: 'Regulatory pathway memo', owner: 'Mentor', due: 'Jun 30', status: 'active' },
      { title: 'Pilot study cost estimate', owner: 'Founder', due: 'Jul 4', status: 'todo' },
      { title: 'Clinical advisor intro', owner: 'Admin', due: 'Jul 8', status: 'blocked' },
    ],
  },
  {
    id: 'emergenz',
    name: 'EmerGenZ',
    founder: 'Nadia Salma',
    faculty: 'Agriculture',
    sector: 'Foodtech',
    stage: 'Pre-seed',
    cohort: 'Unpad 2026 Batch A',
    status: 'Accepted',
    mentor: 'Mira Kartika',
    progressScore: 64,
    deckScore: 63,
    previousDeckScore: 52,
    milestoneCompletion: 55,
    lastActivity: 'Jun 21, 2026',
    risk: 'Low',
    nextMilestone: 'Run institutional buyer discovery',
    oneLiner: 'Emergency food that can be heated without additional tools or ingredients.',
    deckVersions: [
      {
        version: 'Deck v2',
        uploadedAt: 'Jun 21, 2026',
        score: 63,
        previousScore: 52,
        focus: 'Buyer segments',
        summary: 'Sharper target customer segmentation. Needs procurement cycle evidence.',
      },
    ],
    comments: [
      {
        author: 'Mira Kartika',
        role: 'Commercial mentor',
        date: 'Jun 22, 2026',
        area: 'Go-to-market',
        body: 'Prioritize disaster-response agencies and outdoor retailers separately. Do not merge their sales process.',
      },
    ],
    milestones: [
      { title: 'Buyer interview script', owner: 'Founder', due: 'Jun 27', status: 'done' },
      { title: 'Procurement map', owner: 'Founder', due: 'Jul 2', status: 'active' },
      { title: 'Packaging cost review', owner: 'Mentor', due: 'Jul 8', status: 'todo' },
    ],
  },
  {
    id: 'rhea',
    name: 'RHEA',
    founder: 'Dimas Prasetyo',
    faculty: 'Fisheries and Marine Science',
    sector: 'Deep Tech',
    stage: 'Pre-Series A',
    cohort: 'Unpad 2026 Batch A',
    status: 'Demo Day Ready',
    mentor: 'Dr. Eng. Uji Pratomo',
    progressScore: 84,
    deckScore: 81,
    previousDeckScore: 70,
    milestoneCompletion: 82,
    lastActivity: 'Jun 25, 2026',
    risk: 'Low',
    nextMilestone: 'Finalize investor narrative for hardware scale-up',
    oneLiner: 'Oceanography drifter with GPS and sensors for real-time marine monitoring.',
    deckVersions: [
      {
        version: 'Deck v4',
        uploadedAt: 'Jun 25, 2026',
        score: 81,
        previousScore: 70,
        focus: 'Scale-up financing',
        summary: 'Strong technical and validation story. Investor ask now needs sharper manufacturing milestones.',
      },
    ],
    comments: [
      {
        author: 'Hesty Nurul Utami',
        role: 'Incubator lead',
        date: 'Jun 25, 2026',
        area: 'Demo day readiness',
        body: 'Ready for the showcase. Add one slide on sales pipeline and government procurement timing.',
      },
    ],
    milestones: [
      { title: 'Prototype validation summary', owner: 'Founder', due: 'Jun 12', status: 'done' },
      { title: 'Manufacturing milestone plan', owner: 'Founder', due: 'Jun 29', status: 'active' },
      { title: 'Investor CRM shortlist', owner: 'Admin', due: 'Jul 1', status: 'done' },
    ],
  },
  {
    id: 'transgene',
    name: 'TransGENE',
    founder: 'Sinta Rahmawati',
    faculty: 'Pharmacy',
    sector: 'Biotech',
    stage: 'Seed',
    cohort: 'Unpad 2026 Batch A',
    status: 'Incubating',
    mentor: 'Dr. Rani Maheswari',
    progressScore: 71,
    deckScore: 68,
    previousDeckScore: 64,
    milestoneCompletion: 61,
    lastActivity: 'Jun 19, 2026',
    risk: 'Medium',
    nextMilestone: 'Benchmark pricing against imported reagents',
    oneLiner: 'Non-liposomal DNA transfection reagent for research labs and biotech workflows.',
    deckVersions: [
      {
        version: 'Deck v3',
        uploadedAt: 'Jun 19, 2026',
        score: 68,
        previousScore: 64,
        focus: 'Pricing and market access',
        summary: 'Scientific differentiation is clear. Commercial assumptions need local lab validation.',
      },
    ],
    comments: [
      {
        author: 'Dr. Rani Maheswari',
        role: 'Mentor',
        date: 'Jun 20, 2026',
        area: 'Slide 11',
        body: 'Add buyer persona for university labs versus private biotech labs. Purchasing authority differs.',
      },
    ],
    milestones: [
      { title: 'Imported reagent price benchmark', owner: 'Founder', due: 'Jun 30', status: 'active' },
      { title: 'Three lab buyer interviews', owner: 'Founder', due: 'Jul 6', status: 'todo' },
      { title: 'IP status note', owner: 'Admin', due: 'Jul 9', status: 'todo' },
    ],
  },
]

export const insights = [
  {
    id: 'demo-day-readiness',
    title: 'Demo Day Readiness Checklist',
    type: 'Template',
    audience: 'All Batch A startups',
    publishedAt: 'Jun 25, 2026',
    readRate: 86,
    summary: 'Narrative, traction, ask, and investor follow-up checklist for the final two weeks before demo day.',
  },
  {
    id: 'investor-crm',
    title: 'How to Build a 30-Investor CRM',
    type: 'Workshop notes',
    audience: 'Seed and Pre-Series A teams',
    publishedAt: 'Jun 22, 2026',
    readRate: 72,
    summary: 'A practical segmentation guide for angels, government-linked funds, corporate partners, and VC targets.',
  },
  {
    id: 'ip-commercialization',
    title: 'IP and Commercialization Primer',
    type: 'Material',
    audience: 'Research-based startups',
    publishedAt: 'Jun 18, 2026',
    readRate: 64,
    summary: 'Plain-language notes on patent readiness, licensing routes, and investor questions around university IP.',
  },
]

export const announcements = [
  {
    id: 'mentor-office-hours',
    title: 'Mentor office hours open next Tuesday',
    audience: 'Batch A',
    date: 'Jun 26, 2026',
    status: 'Pinned',
    body: 'Each startup should book one 30-minute mentor slot before uploading the next deck version.',
  },
  {
    id: 'demo-day-deadline',
    title: 'Demo Day deck vFinal due July 8',
    audience: 'Demo Day teams',
    date: 'Jun 24, 2026',
    status: 'Scheduled',
    body: 'Upload your final deck through RaiseSEA so mentors can leave the last review comments before rehearsals.',
  },
  {
    id: 'crm-cleanup',
    title: 'Investor CRM cleanup sprint',
    audience: 'Incubating teams',
    date: 'Jun 21, 2026',
    status: 'Sent',
    body: 'Move every investor contact into CRM with next action and priority before the Friday progress review.',
  },
]

export const activity = [
  { icon: FileText, text: 'RHEA uploaded Deck v4 and crossed 80 deck score.', time: 'Today' },
  { icon: MessageSquareText, text: 'Mentor added two annotations to Naroma Indonesia.', time: 'Yesterday' },
  { icon: CalendarClock, text: 'KOKRO regulatory review milestone is due in 4 days.', time: 'Jun 24' },
  { icon: Bell, text: 'Demo Day vFinal announcement sent to 5 teams.', time: 'Jun 24' },
  { icon: Target, text: 'EmerGenZ moved from Screening to Accepted.', time: 'Jun 21' },
]

export function getStartup(id: string) {
  return startups.find(startup => startup.id === id)
}

export function average(values: number[]) {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}
