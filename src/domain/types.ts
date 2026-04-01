export type Role = "SYSTEM_ADMIN" | "PROJECT_OWNER" | "TEAM_MEMBER" | "STAKEHOLDER";
export type AccessLevel = "VOYEUR" | "DESTROYER" | "ADMIN";

export interface UserAccount {
  email: string;
  nickname: string;
  accessLevel: AccessLevel;
  destroyerAccessRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDefinition {
  code: string;
  label: string;
}

export interface OfficeDefinition {
  code: string;
  label: string;
}

export type NotificationProfile = "standard" | "minimal" | "strict";

export interface WorkWeekSettings {
  timezone: string;
  workingDays: number[];
  dailyHours: number;
  holidayCalendar: string;
}

export interface ProjectSettings {
  defaultCapacityHoursPerDay: number;
  notificationProfile: NotificationProfile;
  workWeek: WorkWeekSettings;
  milestoneOffsets: MilestoneOffsets;
}

export interface MilestoneOffsets {
  exclusiveLeadDays: number;
  certificationLeadDays: number;
  productionLengthDays: number;
  preProductionLengthDays: number;
}

export type ProjectStatus = "active" | "completed";

export interface Project {
  id: string;
  name: string;
  comments: string;
  releaseDate: string;
  startDate: string;
  targetEndDate: string;
  adjustedEndDate: string;
  scheduleDelayDays: number;
  settings: ProjectSettings;
  status: ProjectStatus;
  createdAt: string;
  createdBy: string;
  source: {
    type: "blank" | "template" | "copy";
    sourceId?: string;
  };
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  settings: ProjectSettings;
  updatedAt: string;
  updatedBy: string;
}

export interface ActorContext {
  userId: string;
  roles: Role[];
  accessLevel?: AccessLevel;
}

export interface DataMappingRule {
  id: string;
  sourceSheet: string;
  sourceColumn: string;
  targetTable: string;
  targetField: string;
  transform: string;
  notes: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface DataMappingRuleInput {
  sourceSheet: string;
  sourceColumn: string;
  targetTable: string;
  targetField: string;
  transform?: string;
  notes?: string;
  enabled?: boolean;
}

export interface ProjectSettingsOverride {
  defaultCapacityHoursPerDay?: number;
  notificationProfile?: NotificationProfile;
  workWeek?: Partial<WorkWeekSettings>;
  milestoneOffsets?: Partial<MilestoneOffsets>;
}

export interface ProjectTemplateCreateInput {
  name: string;
  description: string;
  settings: ProjectSettings;
}

export interface ProjectTemplateUpdateInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  settings?: ProjectSettingsOverride;
}

export interface ProjectCreateInput {
  mode: "blank" | "template" | "copy";
  name: string;
  comments?: string;
  releaseDate: string;
  templateId?: string;
  sourceProjectId?: string;
  settingsOverride?: ProjectSettingsOverride;
}

export interface ProjectUpdateInput {
  name?: string;
  comments?: string;
  releaseDate?: string;
  milestoneOffsetsDays?: Partial<MilestoneOffsets>;
  status?: "active" | "completed";
}

export interface GlobalClosure {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  createdBy: string;
}

export interface GlobalClosureCreateInput {
  label: string;
  startDate: string;
  endDate: string;
}

export interface Person {
  id: string;
  name: string;
  primaryRoleCode: string;
  office: string;
  weeklyCapacityHours: number;
  workingDays: number[];
  createdAt: string;
  createdBy: string;
}

export interface PersonCreateInput {
  name: string;
  primaryRoleCode: string;
  office: string;
  weeklyCapacityHours: number;
  workingDays?: number[];
}

export interface ProjectAssignment {
  id: string;
  personId: string;
  projectId: string;
  roleCode: string;
  allocationPercent: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  createdBy: string;
}

export interface ProjectAssignmentCreateInput {
  personId: string;
  projectId: string;
  roleCode: string;
  allocationPercent: number;
  startDate: string;
  endDate: string;
}

export interface PersonUtilization {
  personId: string;
  personName: string;
  office: string;
  availableHours: number;
  assignedHours: number;
  utilizationPercent: number;
  overAllocated: boolean;
  assignments: Array<{
    assignmentId: string;
    projectId: string;
    projectName: string;
    allocationPercent: number;
    roleCode: string;
  }>;
}

export interface UtilizationSnapshot {
  weekStart: string;
  weekEnd: string;
  globalClosureDaysInWeek: number;
  people: PersonUtilization[];
}

export interface UtilizationTimelineCell {
  weekStart: string;
  utilizationPercent: number;
  overAllocated: boolean;
  closureDays: number;
}

export interface UtilizationTimelineRow {
  personId: string;
  personName: string;
  office: string;
  weeks: UtilizationTimelineCell[];
}

export interface UtilizationTimeline {
  rangeStart: string;
  weekCount: number;
  rows: UtilizationTimelineRow[];
}

export interface ProjectUtilizationTimelineCell {
  weekStart: string;
  assignedHours: number;
  assignedPeopleCount: number;
  closureDays: number;
  scheduled: boolean;
}

export interface ProjectUtilizationTimelineRow {
  projectId: string;
  projectName: string;
  adjustedEndDate: string;
  status: ProjectStatus;
  weeks: ProjectUtilizationTimelineCell[];
}

export interface ProjectUtilizationTimeline {
  rangeStart: string;
  weekCount: number;
  rows: ProjectUtilizationTimelineRow[];
}
