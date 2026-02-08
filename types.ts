
// Task priorities
export enum Priority {
  Low = 'Low',
  Normal = 'Normal',
  High = 'High',
  Urgent = 'Urgent'
}

// Unified Task Statuses - Simplified to requested set
export enum TaskStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Complete = 'complete'
}

// Helper for display labels
export const TaskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.NotStarted]: 'Not started',
  [TaskStatus.InProgress]: 'In progress',
  [TaskStatus.Complete]: 'Complete'
};

// Migration helper for existing database values
export const mapLegacyStatus = (status: string): TaskStatus => {
  const s = String(status).toLowerCase();
  if (s === 'complete' || s === 'done' || s === 'complete') return TaskStatus.Complete;
  if (s === 'in_progress' || s === 'waiting' || s === 'in progress') return TaskStatus.InProgress;
  return TaskStatus.NotStarted; // Default for 'not started', 'todo', etc.
};

// Categories for tasks
export enum TaskCategory {
  WebUpdate = 'Web update',
  ContentCreation = 'Content creation',
  GraphicDesign = 'Graphic design',
  Videography = 'Videography',
  Photography = 'Photography',
  Admin = 'Admin'
}

// Client engagement types
export enum ClientType {
  Retainer = 'Retainer',
  OneOff = 'One off'
}

// Contact information structure
export interface ContactInfo {
  name: string;
  role: string;
  phone: string;
  email: string;
}

// Client entity
export interface Client {
  id: string;
  userId: string;
  name: string;
  status: 'Active' | 'Archived';
  type: ClientType;
  notes?: string;
  mainContact: ContactInfo;
  createdAt: any;
  updatedAt: any;
}

// Additional contacts for a client
export interface ClientContact {
  id: string;
  clientId: string;
  userId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  createdAt: any;
}

// Time tracking entries
export interface TimeEntry {
  id: string;
  durationMinutes: number;
  date: string;
  note?: string;
}

// Estimation options
export enum EstimatedTime {
  Min15 = '15 minutes',
  Min30 = '30 minutes',
  Hour1 = '1 hour',
  Hour2 = '2 hours',
  HalfDay = 'Half day',
  FullDay = 'Full day',
  OneHour = '1 hour'
}

// Job related types
export enum JobStatus {
  Active = 'Active',
  Completed = 'Completed',
  Archived = 'Archived'
}

// Added missing Job interface
export interface Job {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  // Added missing title property
  title: string;
  serviceType: string;
  status: JobStatus;
  priority: Priority;
  dueDate?: string;
  startDate?: string;
  description: string;
  tags: string[];
  createdAt: any;
  updatedAt?: any;
}

// Added missing Project and ProjectStatus types
export enum ProjectStatus {
  Active = 'Active',
  Completed = 'Completed',
  Archived = 'Archived'
}

export interface Project {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  // Added missing title property
  title: string;
  serviceType: string;
  status: ProjectStatus;
  priority: Priority;
  dueDate?: string;
  startDate?: string;
  description: string;
  tags: string[];
  createdAt: any;
  updatedAt?: any;
}

// General note entity
export interface Note {
  id: string;
  userId: string;
  jobId?: string;
  projectId?: string;
  text: string;
  createdAt: any;
}

// Link types
export enum LinkType {
  Documentation = 'Documentation',
  Asset = 'Asset',
  Reference = 'Reference',
  Other = 'Other'
}

// Responsibility types for tasks
export enum ResponsibilityType {
  Internal = 'Internal',
  Client = 'Client',
  ThirdParty = 'Third Party'
}

// Waiting status for tasks
export enum WaitingOn {
  Nothing = 'Nothing',
  Client = 'Client',
  Feedback = 'Feedback',
  Assets = 'Assets',
  ThirdParty = 'Third Party'
}

// Task types
export enum TaskType {
  Creative = 'Creative',
  Technical = 'Technical',
  Admin = 'Admin',
  Communication = 'Communication'
}

// Activity notes for tasks
export interface TaskActivityNote {
  id: string;
  text: string;
  createdAt: number;
}

// --- Freelancer Related ---

export enum FreelancerRole {
  WebDesigner = 'Web designer',
  WebDeveloper = 'Web developer',
  FrontendDeveloper = 'Front end developer',
  BackendDeveloper = 'Back end developer',
  GraphicDesigner = 'Graphic designer',
  BrandDesigner = 'Brand designer',
  UIDesigner = 'UI designer',
  UXDesigner = 'UX designer',
  Photographer = 'Photographer',
  Videographer = 'Videographer',
  Editor = 'Editor',
  Animator = 'Animator',
  MotionDesigner = 'Motion designer',
  SocialMediaManager = 'Social media manager',
  PaidAdsSpecialist = 'Paid ads specialist',
  SEOSpecialist = 'SEO specialist',
  Copywriter = 'Copywriter',
  ContentCreator = 'Content creator',
  Illustrator = 'Illustrator',
  MarketingStrategist = 'Marketing strategist',
  Other = 'Other'
}

export enum FreelancerStatus {
  Available = 'Available',
  Busy = 'Busy',
  Unknown = 'Unknown'
}

export interface Freelancer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  role: FreelancerRole;
  customRole?: string;
  portfolioUrl: string;
  dayRate?: number;
  currency?: string;
  notes: string;
  status: FreelancerStatus;
  isFavorite: boolean;
  rating: number; // 1-5
  createdAt: any;
  updatedAt: any;
}

// --- Library Related ---

export enum LibraryItemType {
  WebsiteInspiration = 'Website inspiration',
  AIPrompt = 'AI prompt',
  DesignReference = 'Design reference',
  CopySnippet = 'Copy snippet',
  CodeSnippet = 'Code snippet',
  ArticleTutorial = 'Article or tutorial',
  Video = 'Video',
  IdeaConcept = 'Idea or concept'
}

export interface LibraryItem {
  id: string;
  userId: string;
  title: string;
  type: LibraryItemType;
  content: string; // URL or text body
  notes?: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: any;
  updatedAt: any;
}

// --- Pomodoro Related ---

export enum PomodoroMode {
  Work = 'work',
  Break = 'break'
}

export interface PomodoroSession {
  id: string;
  userId: string;
  mode: PomodoroMode;
  durationSeconds: number;
  startedAt: any;
  endedAt: any;
  taskId?: string;
  completed: boolean;
}

export interface PomodoroSettings {
  userId: string;
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  autoStartNext: boolean;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
}

/**
 * Interface representing a resource link associated with an entity.
 */
export interface Link {
  id: string;
  userId: string;
  title: string;
  url: string;
  type: LinkType;
  isPinned: boolean;
  parentId?: string;
  parentType?: string;
  entityId?: string;
  entityType?: string;
  createdAt: any;
}

/**
 * Interface representing a task or action item.
 */
export interface Task {
  id: string;
  userId: string;
  clientId: string;
  jobId?: string;
  projectId?: string;
  title: string;
  description: string;
  brief?: string;
  status: TaskStatus;
  priority: Priority;
  category: TaskCategory;
  taskType: TaskType;
  dueDate?: string;
  startDate?: string;
  receivedDate?: string;
  sentDate?: string;
  clientContactId?: string;
  freelancerId?: string;
  responsibilityType: ResponsibilityType;
  estimatedTime: EstimatedTime;
  waitingOn: WaitingOn;
  blockedReason?: string;
  timeSpent?: string;
  totalTimeMinutes: number;
  timeEntries: TimeEntry[];
  activityNotes: TaskActivityNote[];
  driveLink?: string;
  createdAt: any;
  updatedAt?: any;
}

// --- Password Manager Related ---

export interface PasswordEntry {
  id: string;
  userId: string;
  softwareName: string;
  purpose: string;
  websiteUrl: string;
  usernameEmail: string;
  password: string;
  createdAt: any;
  updatedAt: any;
}