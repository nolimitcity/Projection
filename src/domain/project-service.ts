import { v4 as uuidv4 } from "uuid";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { ProjectionStore } from "./store.js";
import {
  AccessLevel,
  ActorContext,
  DataMappingRule,
  DataMappingRuleInput,
  GlobalClosure,
  GlobalClosureCreateInput,
  GlobalClosureUpdateInput,
  OfficeDefinition,
  Person,
  PersonCreateInput,
  PersonUtilization,
  Project,
  ProjectAssignment,
  ProjectUtilizationTimeline,
  ProjectUtilizationTimelineRow,
  ProjectAssignmentCreateInput,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectSettings,
  ProjectSettingsOverride,
  ProjectTemplate,
  ProjectTemplateCreateInput,
  ProjectTemplateUpdateInput,
  Role,
  RoleDefinition,
  UserAccount,
  UserUpdateInput,
  UtilizationSnapshot,
  UtilizationTimeline,
  UtilizationTimelineRow
} from "./types.js";

const PROJECT_CREATOR_ROLES: Role[] = ["SYSTEM_ADMIN", "PROJECT_OWNER"];
const TEMPLATE_EDITOR_ROLES: Role[] = ["SYSTEM_ADMIN", "PROJECT_OWNER"];
const CLOSURE_MANAGER_ROLES: Role[] = ["SYSTEM_ADMIN", "PROJECT_OWNER"];
const MAPPING_EDITOR_ROLES: Role[] = ["SYSTEM_ADMIN", "PROJECT_OWNER"];

const DEFAULT_SETTINGS: ProjectSettings = {
  defaultCapacityHoursPerDay: 8,
  notificationProfile: "standard",
  workWeek: {
    timezone: "Europe/Copenhagen",
    workingDays: [1, 2, 3, 4, 5],
    dailyHours: 8,
    holidayCalendar: "DK"
  },
  milestoneOffsets: {
    exclusiveLeadDays: 7,
    certificationLeadDays: 42,
    productionLengthDays: 84,
    preProductionLengthDays: 28
  }
};

const hasRole = (actor: ActorContext, roles: Role[]): boolean => actor.roles.some((role) => roles.includes(role));
const nowIso = () => new Date().toISOString();

const assertAdminPermission = (actor: ActorContext) => {
  if (!hasRole(actor, ["SYSTEM_ADMIN"])) {
    throw forbidden("Only System Admin can manage users.");
  }
};

const isValidAccessLevel = (value: string): value is AccessLevel => {
  return value === "VOYEUR" || value === "DESTROYER" || value === "ADMIN";
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (value: string): Date => {
  if (!ISO_DATE_RE.test(value)) {
    throw badRequest(`${value} is not a valid YYYY-MM-DD date.`);
  }

  const [year, month, day] = value.split("-").map((entry) => Number(entry));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw badRequest(`${value} is not a valid calendar date.`);
  }

  return parsed;
};

const formatIsoDate = (value: Date): string => {
  const yyyy = value.getUTCFullYear().toString().padStart(4, "0");
  const mm = (value.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = value.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (value: Date, days: number): Date => {
  const copy = new Date(value.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const isDateBefore = (left: string, right: string): boolean => parseIsoDate(left) < parseIsoDate(right);

const diffDays = (start: string, end: string): number => {
  const startTime = parseIsoDate(start).getTime();
  const endTime = parseIsoDate(end).getTime();
  return Math.round((endTime - startTime) / (24 * 60 * 60 * 1000));
};

const rangesOverlap = (startA: string, endA: string, startB: string, endB: string): boolean => {
  return startA <= endB && endA >= startB;
};

const weekWindowFromStart = (weekStart: string): { weekStart: string; weekEnd: string } => {
  const start = parseIsoDate(weekStart);
  const end = addDays(start, 6);
  return {
    weekStart: formatIsoDate(start),
    weekEnd: formatIsoDate(end)
  };
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

const dayNumber = (value: Date): number => {
  const jsDay = value.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
};

const isWorkingDate = (value: Date, workingDays: number[]): boolean => workingDays.includes(dayNumber(value));

const isDateInClosures = (value: string, closures: GlobalClosure[]): boolean =>
  closures.some((closure) => value >= closure.startDate && value <= closure.endDate);

const workingDaysBetween = (startDate: string, endDate: string, workingDays: number[]): number => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  let cursor = start;
  let count = 0;

  while (cursor <= end) {
    if (isWorkingDate(cursor, workingDays)) {
      count += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return count;
};

const calculateAdjustedEndDate = (
  startDate: string,
  targetEndDate: string,
  workingDays: number[],
  closures: GlobalClosure[]
): string => {
  const plannedWorkDays = workingDaysBetween(startDate, targetEndDate, workingDays);
  if (plannedWorkDays <= 0) {
    return targetEndDate;
  }

  let cursor = parseIsoDate(startDate);
  let completed = 0;

  while (completed < plannedWorkDays) {
    const currentIso = formatIsoDate(cursor);
    if (isWorkingDate(cursor, workingDays) && !isDateInClosures(currentIso, closures)) {
      completed += 1;
      if (completed === plannedWorkDays) {
        break;
      }
    }
    cursor = addDays(cursor, 1);
  }

  const adjusted = formatIsoDate(cursor);
  return isDateBefore(adjusted, targetEndDate) ? targetEndDate : adjusted;
};

const mergeSettings = (base: ProjectSettings, override?: ProjectSettingsOverride): ProjectSettings => {
  if (!override) {
    return base;
  }

  return {
    defaultCapacityHoursPerDay: override.defaultCapacityHoursPerDay ?? base.defaultCapacityHoursPerDay,
    notificationProfile: override.notificationProfile ?? base.notificationProfile,
    workWeek: {
      timezone: override.workWeek?.timezone ?? base.workWeek.timezone,
      workingDays: override.workWeek?.workingDays ?? base.workWeek.workingDays,
      dailyHours: override.workWeek?.dailyHours ?? base.workWeek.dailyHours,
      holidayCalendar: override.workWeek?.holidayCalendar ?? base.workWeek.holidayCalendar
    },
    milestoneOffsets: {
      exclusiveLeadDays: override.milestoneOffsets?.exclusiveLeadDays ?? base.milestoneOffsets.exclusiveLeadDays,
      certificationLeadDays:
        override.milestoneOffsets?.certificationLeadDays ?? base.milestoneOffsets.certificationLeadDays,
      productionLengthDays: override.milestoneOffsets?.productionLengthDays ?? base.milestoneOffsets.productionLengthDays,
      preProductionLengthDays:
        override.milestoneOffsets?.preProductionLengthDays ?? base.milestoneOffsets.preProductionLengthDays
    }
  };
};

const deriveStartDateFromRelease = (releaseDate: string, settings: ProjectSettings): string => {
  const totalLeadDays =
    settings.milestoneOffsets.exclusiveLeadDays +
    settings.milestoneOffsets.certificationLeadDays +
    settings.milestoneOffsets.productionLengthDays +
    settings.milestoneOffsets.preProductionLengthDays;
  return formatIsoDate(addDays(parseIsoDate(releaseDate), -totalLeadDays));
};

const deriveCertificationDateFromRelease = (releaseDate: string, settings: ProjectSettings): string => {
  const leadDays = settings.milestoneOffsets.exclusiveLeadDays + settings.milestoneOffsets.certificationLeadDays;
  return formatIsoDate(addDays(parseIsoDate(releaseDate), -leadDays));
};

const deriveExclusiveDateFromRelease = (releaseDate: string, settings: ProjectSettings): string => {
  return formatIsoDate(addDays(parseIsoDate(releaseDate), -settings.milestoneOffsets.exclusiveLeadDays));
};

const normalizeName = (name: string): string => name.trim().toLowerCase();

const getNameSuggestions = (name: string, existingNames: string[]): string[] => {
  const suggestions: string[] = [];
  const base = name.trim();

  for (let i = 1; i <= 3; i += 1) {
    const candidate = `${base} (${i})`;
    if (!existingNames.includes(normalizeName(candidate))) {
      suggestions.push(candidate);
    }
  }

  return suggestions;
};

const assertCreatePermission = (actor: ActorContext) => {
  if (!hasRole(actor, PROJECT_CREATOR_ROLES)) {
    throw forbidden("Only System Admin and Project Owner can create projects.");
  }
};

const assertTemplateEditPermission = (actor: ActorContext) => {
  if (!hasRole(actor, TEMPLATE_EDITOR_ROLES)) {
    throw forbidden("Only System Admin and Project Owner can manage templates.");
  }
};

const assertClosureEditPermission = (actor: ActorContext) => {
  if (!hasRole(actor, CLOSURE_MANAGER_ROLES)) {
    throw forbidden("Only System Admin and Project Owner can manage global closures.");
  }
};

const assertMappingEditPermission = (actor: ActorContext) => {
  if (!hasRole(actor, MAPPING_EDITOR_ROLES)) {
    throw forbidden("Only System Admin and Project Owner can manage data mappings.");
  }
};

const validateSettings = (settings: ProjectSettings) => {
  if (settings.defaultCapacityHoursPerDay < 0.5 || settings.defaultCapacityHoursPerDay > 16) {
    throw badRequest("defaultCapacityHoursPerDay must be between 0.5 and 16.0.");
  }

  if (Math.round(settings.defaultCapacityHoursPerDay * 10) !== settings.defaultCapacityHoursPerDay * 10) {
    throw badRequest("defaultCapacityHoursPerDay supports one decimal place.");
  }

  if (settings.workWeek.dailyHours <= 0 || settings.workWeek.dailyHours > 16) {
    throw badRequest("workWeek.dailyHours must be greater than 0 and no more than 16.");
  }

  if (!settings.workWeek.workingDays.length) {
    throw badRequest("workWeek.workingDays must contain at least one day.");
  }

  const offsets = settings.milestoneOffsets;
  const fields: Array<[string, number]> = [
    ["exclusiveLeadDays", offsets.exclusiveLeadDays],
    ["certificationLeadDays", offsets.certificationLeadDays],
    ["productionLengthDays", offsets.productionLengthDays],
    ["preProductionLengthDays", offsets.preProductionLengthDays]
  ];

  fields.forEach(([fieldName, fieldValue]) => {
    if (!Number.isInteger(fieldValue) || fieldValue < 0) {
      throw badRequest(`${fieldName} must be an integer >= 0.`);
    }
  });

  if (offsets.productionLengthDays < 1) {
    throw badRequest("productionLengthDays must be at least 1.");
  }
};

const validateWorkingDays = (workingDays: number[]) => {
  if (!workingDays.length) {
    throw badRequest("workingDays must contain at least one day.");
  }

  const unique = new Set(workingDays);
  if (unique.size !== workingDays.length) {
    throw badRequest("workingDays cannot contain duplicates.");
  }

  if (workingDays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw badRequest("workingDays must contain values 1-7.");
  }
};

const validatePersonInput = (input: PersonCreateInput) => {
  if (!input.name.trim()) {
    throw badRequest("Person name is required.");
  }
  if (!input.primaryRoleCode.trim()) {
    throw badRequest("primaryRoleCode is required.");
  }
  if (input.weeklyCapacityHours <= 0 || input.weeklyCapacityHours > 80) {
    throw badRequest("weeklyCapacityHours must be > 0 and <= 80.");
  }
  if (Math.round(input.weeklyCapacityHours * 10) !== input.weeklyCapacityHours * 10) {
    throw badRequest("weeklyCapacityHours supports one decimal place.");
  }
  validateWorkingDays(input.workingDays ?? [1, 2, 3, 4, 5]);
};

const validateAssignmentInput = (input: ProjectAssignmentCreateInput) => {
  validateDates(input.startDate, input.endDate);
  if (!input.roleCode.trim()) {
    throw badRequest("roleCode is required.");
  }
  if (input.allocationPercent <= 0 || input.allocationPercent > 100) {
    throw badRequest("allocationPercent must be > 0 and <= 100.");
  }
  if (Math.round(input.allocationPercent * 10) !== input.allocationPercent * 10) {
    throw badRequest("allocationPercent supports one decimal place.");
  }
};

const validateAssignmentWithinProjectWindow = (project: Project, startDate: string, endDate: string) => {
  const projectEnd = project.adjustedEndDate || project.targetEndDate || project.releaseDate;
  if (startDate < project.startDate || endDate > projectEnd) {
    throw badRequest("Assignment dates must be within the project schedule.", {
      assignmentStartDate: startDate,
      assignmentEndDate: endDate,
      projectStartDate: project.startDate,
      projectEndDate: projectEnd
    });
  }
};

const clampAssignmentToProjectWindow = (
  project: Project,
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } => {
  const projectStart = project.startDate;
  const projectEnd = project.adjustedEndDate || project.targetEndDate || project.releaseDate;

  const clampedStart = startDate < projectStart ? projectStart : startDate;
  const clampedEnd = endDate > projectEnd ? projectEnd : endDate;

  if (clampedEnd < clampedStart) {
    return { startDate: projectEnd, endDate: projectEnd };
  }

  return { startDate: clampedStart, endDate: clampedEnd };
};

const validateDates = (startDate: string, targetEndDate: string) => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(targetEndDate);

  if (end < start) {
    throw badRequest("targetEndDate must be on or after startDate.");
  }
};

const validateClosureDates = (startDate: string, endDate: string) => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (end < start) {
    throw badRequest("Closure endDate must be on or after startDate.");
  }
};

export class ProjectService {
  constructor(private readonly store: ProjectionStore) {
    this.migrateProjectReleaseDates();
    this.recalculateAllProjects();
  }

  private countClosureDaysBetween(startInclusive: string, endExclusive: string): number {
    if (startInclusive >= endExclusive) {
      return 0;
    }

    let count = 0;
    let cursor = parseIsoDate(startInclusive);
    const end = parseIsoDate(endExclusive);

    while (cursor < end) {
      const iso = formatIsoDate(cursor);
      if (isDateInClosures(iso, this.store.globalClosures)) {
        count += 1;
      }
      cursor = addDays(cursor, 1);
    }

    return count;
  }

  private derivePhaseStartWithClosures(endExclusive: string, durationDays: number): string {
    let start = formatIsoDate(addDays(parseIsoDate(endExclusive), -durationDays));

    for (let i = 0; i < 32; i += 1) {
      const blockedDays = this.countClosureDaysBetween(start, endExclusive);
      const adjustedStart = formatIsoDate(addDays(parseIsoDate(endExclusive), -(durationDays + blockedDays)));
      if (adjustedStart === start) {
        return start;
      }
      start = adjustedStart;
    }

    return start;
  }

  getMilestoneDates(project: Project): {
    releaseDate: string;
    exclusiveDate: string;
    certificationDate: string;
    productionStartDate: string;
    preProductionStartDate: string;
  } {
    const releaseDate = project.releaseDate || project.targetEndDate;
    const exclusiveDate = deriveExclusiveDateFromRelease(releaseDate, project.settings);
    const certificationDate = deriveCertificationDateFromRelease(releaseDate, project.settings);
    const productionStartDate = this.derivePhaseStartWithClosures(
      certificationDate,
      project.settings.milestoneOffsets.productionLengthDays
    );
    const preProductionStartDate = this.derivePhaseStartWithClosures(
      productionStartDate,
      project.settings.milestoneOffsets.preProductionLengthDays
    );

    return {
      releaseDate,
      exclusiveDate,
      certificationDate,
      productionStartDate,
      preProductionStartDate
    };
  }

  private migrateProjectReleaseDates(): void {
    let changed = false;

    this.store.projects.forEach((project) => {
      if (project.releaseDate && ISO_DATE_RE.test(project.releaseDate)) {
        return;
      }

      project.releaseDate = project.targetEndDate;
      changed = true;
    });

    if (changed) {
      this.store.save();
    }
  }

  private applyScheduleAdjustment(project: Project): void {
    if (!project.releaseDate) {
      project.releaseDate = project.targetEndDate;
    }

    validateSettings(project.settings);
    const milestones = this.getMilestoneDates(project);
    project.startDate = milestones.preProductionStartDate;
    project.targetEndDate = project.releaseDate;
    project.adjustedEndDate = project.targetEndDate;
    project.scheduleDelayDays = 0;
  }

  private recalculateAllProjects(): void {
    this.store.projects.forEach((project) => this.applyScheduleAdjustment(project));
  }

  listGlobalClosures(): GlobalClosure[] {
    return [...this.store.globalClosures].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  createGlobalClosure(actor: ActorContext, input: GlobalClosureCreateInput): GlobalClosure {
    assertClosureEditPermission(actor);
    validateClosureDates(input.startDate, input.endDate);

    const created: GlobalClosure = {
      id: uuidv4(),
      label: input.label.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: new Date().toISOString(),
      createdBy: actor.userId
    };

    this.store.globalClosures.push(created);
    this.store.save();
    return created;
  }

  updateGlobalClosure(actor: ActorContext, closureId: string, input: GlobalClosureUpdateInput): GlobalClosure {
    assertClosureEditPermission(actor);
    const closure = this.store.globalClosures.find((entry) => entry.id === closureId);
    if (!closure) {
      throw notFound("Global closure not found.", { closureId });
    }

    const nextLabel = input.label === undefined ? closure.label : input.label.trim();
    if (!nextLabel) {
      throw badRequest("Closure label is required.");
    }

    const nextStartDate = input.startDate ?? closure.startDate;
    const nextEndDate = input.endDate ?? closure.endDate;
    validateClosureDates(nextStartDate, nextEndDate);

    closure.label = nextLabel;
    closure.startDate = nextStartDate;
    closure.endDate = nextEndDate;
    this.store.save();
    return closure;
  }

  deleteGlobalClosure(actor: ActorContext, closureId: string): void {
    assertClosureEditPermission(actor);
    const index = this.store.globalClosures.findIndex((entry) => entry.id === closureId);
    if (index < 0) {
      throw notFound("Global closure not found.", { closureId });
    }

    this.store.globalClosures.splice(index, 1);
    this.store.save();
  }

  listRoles(): RoleDefinition[] {
    return this.store.roles;
  }

  createRole(actor: ActorContext, input: { code: string; label: string }): RoleDefinition {
    assertCreatePermission(actor);
    const code = input.code.trim().toUpperCase();
    if (!code) throw badRequest("Role code is required.");
    if (!input.label.trim()) throw badRequest("Role label is required.");
    if (this.store.roles.find((r) => r.code === code)) throw conflict("Role code already exists.", { code });

    const role: RoleDefinition = {
      code,
      label: input.label.trim()
    };

    this.store.roles.push(role);
    this.store.save();
    return role;
  }

  updateRole(actor: ActorContext, code: string, input: { label: string }): RoleDefinition {
    assertCreatePermission(actor);
    const role = this.store.roles.find((r) => r.code === code);
    if (!role) {
      throw notFound("Role not found.", { code });
    }
    if (!input.label.trim()) throw badRequest("Role label is required.");

    role.label = input.label.trim();
    this.store.save();
    return role;
  }

  deleteRole(actor: ActorContext, code: string): void {
    assertCreatePermission(actor);
    const normalizedCode = code.trim().toUpperCase();
    const index = this.store.roles.findIndex((r) => r.code === normalizedCode);
    if (index < 0) {
      throw notFound("Role not found.", { code: normalizedCode });
    }

    const usedByPerson = this.store.people.some((person) => person.primaryRoleCode === normalizedCode);
    const usedByAssignment = this.store.assignments.some((assignment) => assignment.roleCode === normalizedCode);
    if (usedByPerson || usedByAssignment) {
      throw conflict("Role is in use and cannot be removed.", {
        code: normalizedCode,
        usedByPeople: usedByPerson,
        usedByAssignments: usedByAssignment
      });
    }

    this.store.roles.splice(index, 1);
    this.store.save();
  }

  listOffices(): OfficeDefinition[] {
    return this.store.offices;
  }

  createOffice(actor: ActorContext, input: { code: string; label: string }): OfficeDefinition {
    assertCreatePermission(actor);
    const code = input.code.trim();
    if (!code) throw badRequest("Office code is required.");
    if (!input.label.trim()) throw badRequest("Office label is required.");
    if (this.store.offices.find((o) => o.code === code)) throw conflict("Office code already exists.", { code });

    const office: OfficeDefinition = {
      code,
      label: input.label.trim()
    };

    this.store.offices.push(office);
    this.store.save();
    return office;
  }

  updateOffice(actor: ActorContext, code: string, input: { label: string }): OfficeDefinition {
    assertCreatePermission(actor);
    const office = this.store.offices.find((o) => o.code === code);
    if (!office) {
      throw notFound("Office not found.", { code });
    }
    if (!input.label.trim()) throw badRequest("Office label is required.");

    office.label = input.label.trim();
    this.store.save();
    return office;
  }

  deleteOffice(actor: ActorContext, code: string): void {
    assertCreatePermission(actor);
    const normalizedCode = code.trim();
    const index = this.store.offices.findIndex((o) => o.code === normalizedCode);
    if (index < 0) {
      throw notFound("Office not found.", { code: normalizedCode });
    }

    const usedByPerson = this.store.people.some((person) => person.office === normalizedCode);
    if (usedByPerson) {
      throw conflict("Office is in use and cannot be removed.", {
        code: normalizedCode,
        usedByPeople: true
      });
    }

    this.store.offices.splice(index, 1);
    this.store.save();
  }

  listPeople(): Person[] {
    return this.store.people;
  }

  createPerson(actor: ActorContext, input: PersonCreateInput): Person {
    assertCreatePermission(actor);
    validatePersonInput(input);

    const roleCode = input.primaryRoleCode.trim().toUpperCase();
    const officeCode = input.office.trim();
    if (!this.store.roles.some((role) => role.code === roleCode)) {
      throw badRequest("primaryRoleCode must reference an existing role.", { primaryRoleCode: roleCode });
    }
    if (!this.store.offices.some((office) => office.code === officeCode)) {
      throw badRequest("office must reference an existing office.", { office: officeCode });
    }

    const person: Person = {
      id: uuidv4(),
      name: input.name.trim(),
      primaryRoleCode: roleCode,
      office: officeCode,
      weeklyCapacityHours: input.weeklyCapacityHours,
      workingDays: input.workingDays ?? [1, 2, 3, 4, 5],
      isActive: input.isActive ?? true,
      createdAt: nowIso(),
      createdBy: actor.userId,
      updatedAt: nowIso()
    };

    this.store.people.push(person);
    this.store.save();
    return person;
  }

  updatePerson(actor: ActorContext, personId: string, input: PersonCreateInput): Person {
    assertCreatePermission(actor);
    validatePersonInput(input);

    const roleCode = input.primaryRoleCode.trim().toUpperCase();
    const officeCode = input.office.trim();
    if (!this.store.roles.some((role) => role.code === roleCode)) {
      throw badRequest("primaryRoleCode must reference an existing role.", { primaryRoleCode: roleCode });
    }
    if (!this.store.offices.some((office) => office.code === officeCode)) {
      throw badRequest("office must reference an existing office.", { office: officeCode });
    }

    const person = this.store.people.find((entry) => entry.id === personId);
    if (!person) {
      throw notFound("Person not found.", { personId });
    }

    if (input.expectedUpdatedAt && person.updatedAt !== input.expectedUpdatedAt) {
      throw conflict("Person was updated by someone else. Reload and try again.", {
        personId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        currentUpdatedAt: person.updatedAt
      });
    }

    person.name = input.name.trim();
    person.primaryRoleCode = roleCode;
    person.office = officeCode;
    person.weeklyCapacityHours = input.weeklyCapacityHours;
    person.workingDays = input.workingDays ?? [1, 2, 3, 4, 5];
    person.isActive = input.isActive ?? person.isActive;
    person.updatedAt = nowIso();

    this.store.save();
    return person;
  }

  deletePerson(actor: ActorContext, personId: string): void {
    assertCreatePermission(actor);
    const index = this.store.people.findIndex((entry) => entry.id === personId);
    if (index < 0) {
      throw notFound("Person not found.", { personId });
    }
    const hasAssignments = this.store.assignments.some((a) => a.personId === personId);
    if (hasAssignments) {
      throw badRequest("Cannot delete a person who has project assignments. Remove their assignments first.", { personId });
    }
    this.store.people.splice(index, 1);
    this.store.save();
  }

  listAssignments(): ProjectAssignment[] {
    return this.store.assignments;
  }

  createAssignment(actor: ActorContext, input: ProjectAssignmentCreateInput): ProjectAssignment {
    assertCreatePermission(actor);
    validateAssignmentInput(input);

    const roleCode = input.roleCode.trim().toUpperCase();
    if (!this.store.roles.some((role) => role.code === roleCode)) {
      throw badRequest("roleCode must reference an existing role.", { roleCode });
    }

    const person = this.store.people.find((entry) => entry.id === input.personId);
    if (!person) {
      throw notFound("Person not found.", { personId: input.personId });
    }
    if (!person.isActive) {
      throw badRequest("Cannot assign inactive person.", { personId: input.personId });
    }

    const project = this.store.projects.find((entry) => entry.id === input.projectId);
    if (!project) {
      throw notFound("Project not found.", { projectId: input.projectId });
    }

    if (project.status !== "active") {
      throw badRequest("Assignments can only be created for active projects.", { projectId: input.projectId });
    }

    validateAssignmentWithinProjectWindow(project, input.startDate, input.endDate);

    const assignment: ProjectAssignment = {
      id: uuidv4(),
      personId: input.personId,
      projectId: input.projectId,
      roleCode,
      allocationPercent: input.allocationPercent,
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: nowIso(),
      createdBy: actor.userId,
      updatedAt: nowIso()
    };

    this.store.assignments.push(assignment);
    this.store.save();
    return assignment;
  }

  updateAssignment(actor: ActorContext, assignmentId: string, input: ProjectAssignmentCreateInput): ProjectAssignment {
    assertCreatePermission(actor);
    validateAssignmentInput(input);

    const roleCode = input.roleCode.trim().toUpperCase();
    if (!this.store.roles.some((role) => role.code === roleCode)) {
      throw badRequest("roleCode must reference an existing role.", { roleCode });
    }

    const assignment = this.store.assignments.find((entry) => entry.id === assignmentId);
    if (!assignment) {
      throw notFound("Assignment not found.", { assignmentId });
    }

    if (input.expectedUpdatedAt && assignment.updatedAt !== input.expectedUpdatedAt) {
      throw conflict("Assignment was updated by someone else. Reload and try again.", {
        assignmentId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        currentUpdatedAt: assignment.updatedAt
      });
    }

    const person = this.store.people.find((entry) => entry.id === input.personId);
    if (!person) {
      throw notFound("Person not found.", { personId: input.personId });
    }
    if (!person.isActive) {
      throw badRequest("Cannot assign inactive person.", { personId: input.personId });
    }

    const project = this.store.projects.find((entry) => entry.id === input.projectId);
    if (!project) {
      throw notFound("Project not found.", { projectId: input.projectId });
    }

    if (project.status !== "active") {
      throw badRequest("Assignments can only be created for active projects.", { projectId: input.projectId });
    }

    validateAssignmentWithinProjectWindow(project, input.startDate, input.endDate);

    assignment.personId = input.personId;
    assignment.projectId = input.projectId;
    assignment.roleCode = roleCode;
    assignment.allocationPercent = input.allocationPercent;
    assignment.startDate = input.startDate;
    assignment.endDate = input.endDate;
    assignment.updatedAt = nowIso();

    this.store.save();
    return assignment;
  }

  deleteAssignment(actor: ActorContext, assignmentId: string): void {
    assertCreatePermission(actor);
    const index = this.store.assignments.findIndex((entry) => entry.id === assignmentId);
    if (index < 0) {
      throw notFound("Assignment not found.", { assignmentId });
    }
    this.store.assignments.splice(index, 1);
    this.store.save();
  }

  getUtilizationSnapshot(weekStart: string): UtilizationSnapshot {
    const window = weekWindowFromStart(weekStart);
    const closuresInWeek = this.store.globalClosures.filter((closure) =>
      rangesOverlap(closure.startDate, closure.endDate, window.weekStart, window.weekEnd)
    );
    let closureDayCount = 0;
    for (let i = 0; i < 7; i += 1) {
      const dateIso = formatIsoDate(addDays(parseIsoDate(window.weekStart), i));
      if (isDateInClosures(dateIso, closuresInWeek)) {
        closureDayCount += 1;
      }
    }

    const people: PersonUtilization[] = this.store.people.map((person) => {
        const plannedWorkingDays = person.workingDays.length;
        let openWorkingDays = 0;

        for (let i = 0; i < 7; i += 1) {
          const date = addDays(parseIsoDate(window.weekStart), i);
          const dateIso = formatIsoDate(date);
          if (!person.workingDays.includes(dayNumber(date))) {
            continue;
          }
          if (isDateInClosures(dateIso, closuresInWeek)) {
            continue;
          }
          openWorkingDays += 1;
        }

        const capacityFactor = plannedWorkingDays > 0 ? openWorkingDays / plannedWorkingDays : 0;
        const availableHours = round1(person.weeklyCapacityHours * capacityFactor);

        const activeAssignments = this.store.assignments.filter(
          (assignment) =>
            assignment.personId === person.id &&
            rangesOverlap(assignment.startDate, assignment.endDate, window.weekStart, window.weekEnd)
        );

        const assignedHours = round1(
          activeAssignments.reduce((sum, assignment) => sum + availableHours * (assignment.allocationPercent / 100), 0)
        );

        const utilizationPercent = availableHours > 0 ? round1((assignedHours / availableHours) * 100) : 0;

        return {
          personId: person.id,
          personName: person.name,
          office: person.office,
          availableHours,
          assignedHours,
          utilizationPercent,
          overAllocated: utilizationPercent > 100,
          assignments: activeAssignments.map((assignment) => {
            const project = this.store.projects.find((entry) => entry.id === assignment.projectId);
            return {
              assignmentId: assignment.id,
              projectId: assignment.projectId,
              projectName: project?.name ?? "Unknown Project",
              allocationPercent: assignment.allocationPercent,
              roleCode: assignment.roleCode
            };
          })
        };
      });

    return {
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      globalClosureDaysInWeek: closureDayCount,
      people
    };
  }

  getUtilizationTimeline(weekStart: string, weekCount: number): UtilizationTimeline {
    if (!Number.isInteger(weekCount) || weekCount < 1) {
      throw badRequest("weekCount must be a positive integer.");
    }

    const snapshots = Array.from({ length: weekCount }, (_, index) => {
      const offsetStart = formatIsoDate(addDays(parseIsoDate(weekStart), index * 7));
      return this.getUtilizationSnapshot(offsetStart);
    });

    const personMap = new Map<string, UtilizationTimelineRow>();

    for (const snapshot of snapshots) {
      for (const person of snapshot.people) {
        const row = personMap.get(person.personId) ?? {
          personId: person.personId,
          personName: person.personName,
          office: person.office,
          weeks: []
        };

        row.weeks.push({
          weekStart: snapshot.weekStart,
          utilizationPercent: person.utilizationPercent,
          overAllocated: person.overAllocated,
          closureDays: snapshot.globalClosureDaysInWeek
        });

        personMap.set(person.personId, row);
      }
    }

    return {
      rangeStart: weekStart,
      weekCount,
      rows: [...personMap.values()]
    };
  }

  getProjectUtilizationTimeline(weekStart: string, weekCount: number): ProjectUtilizationTimeline {
    if (!Number.isInteger(weekCount) || weekCount < 1) {
      throw badRequest("weekCount must be a positive integer.");
    }

    const rangeEnd = formatIsoDate(addDays(parseIsoDate(weekStart), weekCount * 7 - 1));
    const visibleProjects = this.store.projects.filter((project) =>
      rangesOverlap(project.startDate, project.adjustedEndDate, weekStart, rangeEnd)
    );
    const rowMap = new Map<string, ProjectUtilizationTimelineRow>(
      visibleProjects.map((project) => [
        project.id,
        {
          projectId: project.id,
          projectName: project.name,
          adjustedEndDate: project.adjustedEndDate,
          status: project.status,
          weeks: []
        }
      ])
    );

    for (let index = 0; index < weekCount; index += 1) {
      const offsetStart = formatIsoDate(addDays(parseIsoDate(weekStart), index * 7));
      const window = weekWindowFromStart(offsetStart);
      const closuresInWeek = this.store.globalClosures.filter((closure) =>
        rangesOverlap(closure.startDate, closure.endDate, window.weekStart, window.weekEnd)
      );
      let closureDayCount = 0;
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const dateIso = formatIsoDate(addDays(parseIsoDate(window.weekStart), dayIndex));
        if (isDateInClosures(dateIso, closuresInWeek)) {
          closureDayCount += 1;
        }
      }

      for (const project of visibleProjects) {
        const scheduled = rangesOverlap(project.startDate, project.adjustedEndDate, window.weekStart, window.weekEnd);
        const projectAssignments = this.store.assignments.filter(
          (assignment) =>
            assignment.projectId === project.id &&
            rangesOverlap(assignment.startDate, assignment.endDate, window.weekStart, window.weekEnd)
        );

        const assignedHours = round1(
          projectAssignments.reduce((sum, assignment) => {
            const person = this.store.people.find((entry) => entry.id === assignment.personId);
            if (!person) {
              return sum;
            }

            const plannedWorkingDays = person.workingDays.length;
            let openWorkingDays = 0;

            for (let i = 0; i < 7; i += 1) {
              const date = addDays(parseIsoDate(window.weekStart), i);
              const dateIso = formatIsoDate(date);
              if (!person.workingDays.includes(dayNumber(date))) {
                continue;
              }
              if (isDateInClosures(dateIso, closuresInWeek)) {
                continue;
              }
              openWorkingDays += 1;
            }

            const capacityFactor = plannedWorkingDays > 0 ? openWorkingDays / plannedWorkingDays : 0;
            const availableHours = round1(person.weeklyCapacityHours * capacityFactor);
            return sum + availableHours * (assignment.allocationPercent / 100);
          }, 0)
        );

        const row = rowMap.get(project.id);
        if (!row) {
          continue;
        }

        row.weeks.push({
          weekStart: window.weekStart,
          assignedHours,
          assignedPeopleCount: new Set(projectAssignments.map((assignment) => assignment.personId)).size,
          closureDays: closureDayCount,
          scheduled
        });
      }
    }

    return {
      rangeStart: weekStart,
      weekCount,
      rows: [...rowMap.values()]
    };
  }

  listTemplates(): ProjectTemplate[] {
    return this.store.templates.filter((template) => template.isActive);
  }

  getUserByEmail(email: string): UserAccount {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.store.users.find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (!user) {
      throw notFound("User not found.", { email: normalizedEmail });
    }
    return user;
  }

  getCurrentUser(actor: ActorContext): UserAccount {
    return this.getUserByEmail(actor.userId);
  }

  requestDestroyerAccess(actor: ActorContext): UserAccount {
    const user = this.getCurrentUser(actor);
    if (user.accessLevel !== "VOYEUR") {
      return user;
    }

    if (!user.destroyerAccessRequested) {
      user.destroyerAccessRequested = true;
      user.updatedAt = new Date().toISOString();
      this.store.save();
    }

    return user;
  }

  listUsers(actor: ActorContext): UserAccount[] {
    assertAdminPermission(actor);
    return [...this.store.users].sort((a, b) => a.email.localeCompare(b.email));
  }

  updateUser(actor: ActorContext, email: string, input: UserUpdateInput): UserAccount {
    assertAdminPermission(actor);
    const user = this.getUserByEmail(email);

    if (input.expectedUpdatedAt && user.updatedAt !== input.expectedUpdatedAt) {
      throw conflict("User was updated by someone else. Reload and try again.", {
        email: user.email,
        expectedUpdatedAt: input.expectedUpdatedAt,
        currentUpdatedAt: user.updatedAt
      });
    }

    if (typeof input.nickname === "string") {
      const trimmed = input.nickname.trim();
      if (!trimmed) {
        throw badRequest("nickname cannot be empty.");
      }
      user.nickname = trimmed;
    }

    if (typeof input.accessLevel === "string") {
      const normalized = input.accessLevel.toUpperCase();
      if (!isValidAccessLevel(normalized)) {
        throw badRequest("accessLevel must be one of VOYEUR, DESTROYER, ADMIN.");
      }

      user.accessLevel = normalized;
      if (normalized !== "VOYEUR") {
        user.destroyerAccessRequested = false;
      }
    }

    user.updatedAt = new Date().toISOString();
    this.store.save();
    return user;
  }

  knightDestroyer(actor: ActorContext, email: string, expectedUpdatedAt?: string): UserAccount {
    assertAdminPermission(actor);
    const user = this.getUserByEmail(email);

    if (expectedUpdatedAt && user.updatedAt !== expectedUpdatedAt) {
      throw conflict("User was updated by someone else. Reload and try again.", {
        email: user.email,
        expectedUpdatedAt,
        currentUpdatedAt: user.updatedAt
      });
    }

    if (user.accessLevel !== "VOYEUR" || !user.destroyerAccessRequested) {
      throw badRequest("User must be a Voyeur with a pending Destroyer access request.");
    }

    user.accessLevel = "DESTROYER";
    user.destroyerAccessRequested = false;
    user.updatedAt = new Date().toISOString();
    this.store.save();
    return user;
  }

  listAuditEvents(actor: ActorContext, limit?: number) {
    assertAdminPermission(actor);
    return this.store.listAuditEvents(limit);
  }

  getTemplateById(templateId: string): ProjectTemplate {
    const template = this.store.templates.find((entry) => entry.id === templateId);
    if (!template) {
      throw notFound("Template not found.", { templateId });
    }
    return template;
  }

  createTemplate(actor: ActorContext, payload: ProjectTemplateCreateInput): ProjectTemplate {
    assertTemplateEditPermission(actor);
    validateSettings(payload.settings);

    const created: ProjectTemplate = {
      id: uuidv4(),
      name: payload.name,
      description: payload.description,
      settings: payload.settings,
      isActive: true,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId
    };

    this.store.templates.push(created);
    this.store.save();
    return created;
  }

  updateTemplate(actor: ActorContext, templateId: string, payload: ProjectTemplateUpdateInput): ProjectTemplate {
    assertTemplateEditPermission(actor);
    const template = this.getTemplateById(templateId);

    if (payload.expectedUpdatedAt && template.updatedAt !== payload.expectedUpdatedAt) {
      throw conflict("Template was updated by someone else. Reload and try again.", {
        templateId,
        expectedUpdatedAt: payload.expectedUpdatedAt,
        currentUpdatedAt: template.updatedAt
      });
    }

    template.name = payload.name ?? template.name;
    template.description = payload.description ?? template.description;
    template.isActive = payload.isActive ?? template.isActive;

    if (payload.settings) {
      const merged = mergeSettings(template.settings, payload.settings);
      validateSettings(merged);
      template.settings = merged;
    }

    template.updatedAt = new Date().toISOString();
    template.updatedBy = actor.userId;

    this.store.save();

    return template;
  }

  deactivateTemplate(actor: ActorContext, templateId: string): void {
    assertTemplateEditPermission(actor);
    const template = this.getTemplateById(templateId);
    template.isActive = false;
    template.updatedAt = new Date().toISOString();
    template.updatedBy = actor.userId;
    this.store.save();
  }

  previewFromTemplate(actor: ActorContext, templateId: string, settingsOverride?: ProjectSettingsOverride) {
    assertCreatePermission(actor);
    const template = this.getTemplateById(templateId);

    if (!template.isActive) {
      throw badRequest("Template is inactive.", { templateId });
    }

    const settings = mergeSettings(template.settings, settingsOverride);
    validateSettings(settings);

    return {
      sourceType: "template",
      sourceId: templateId,
      settings,
      exclusions: [
        "tasks and dependencies",
        "comments and mentions",
        "notification history",
        "audit logs",
        "attachments/files",
        "project memberships/users",
        "external integration links/webhooks"
      ]
    };
  }

  previewFromProject(actor: ActorContext, sourceProjectId: string, settingsOverride?: ProjectSettingsOverride) {
    assertCreatePermission(actor);
    const sourceProject = this.store.projects.find((project) => project.id === sourceProjectId);
    if (!sourceProject) {
      throw notFound("Source project not found.", { sourceProjectId });
    }

    const settings = mergeSettings(sourceProject.settings, settingsOverride);
    validateSettings(settings);

    return {
      sourceType: "copy",
      sourceId: sourceProjectId,
      sourceProjectStatus: sourceProject.status,
      settings,
      exclusions: [
        "tasks and dependencies",
        "comments and mentions",
        "notification history",
        "audit logs",
        "attachments/files",
        "project memberships/users",
        "external integration links/webhooks"
      ]
    };
  }

  createProject(actor: ActorContext, input: ProjectCreateInput): Project {
    assertCreatePermission(actor);
    parseIsoDate(input.releaseDate);

    const name = input.name.trim();
    const existing = this.store.projects.map((project) => normalizeName(project.name));

    if (existing.includes(normalizeName(name))) {
      throw conflict("Project name already exists. Please choose another name.", {
        field: "name",
        suggestions: getNameSuggestions(name, existing)
      });
    }

    let baseSettings = DEFAULT_SETTINGS;
    let source: Project["source"] = { type: "blank" };

    if (input.mode === "template") {
      if (!input.templateId) {
        throw badRequest("templateId is required when mode is template.");
      }
      const preview = this.previewFromTemplate(actor, input.templateId, input.settingsOverride);
      baseSettings = preview.settings;
      source = { type: "template", sourceId: input.templateId };
    }

    if (input.mode === "copy") {
      if (!input.sourceProjectId) {
        throw badRequest("sourceProjectId is required when mode is copy.");
      }
      const preview = this.previewFromProject(actor, input.sourceProjectId, input.settingsOverride);
      baseSettings = preview.settings;
      source = { type: "copy", sourceId: input.sourceProjectId };
    }

    if (input.mode === "blank") {
      baseSettings = mergeSettings(DEFAULT_SETTINGS, input.settingsOverride);
      validateSettings(baseSettings);
    }

    const project: Project = {
      id: uuidv4(),
      name,
      comments: input.comments?.trim() ?? "",
      releaseDate: input.releaseDate,
      startDate: input.releaseDate,
      targetEndDate: input.releaseDate,
      adjustedEndDate: input.releaseDate,
      scheduleDelayDays: 0,
      settings: baseSettings,
      status: "active",
      createdAt: nowIso(),
      createdBy: actor.userId,
      updatedAt: nowIso(),
      source
    };

    this.applyScheduleAdjustment(project);
    this.store.projects.push(project);
    this.store.save();
    return project;
  }

  updateProject(actor: ActorContext, projectId: string, input: ProjectUpdateInput): Project {
    assertCreatePermission(actor);
    const project = this.store.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw notFound("Project not found.", { projectId });
    }

    if (input.expectedUpdatedAt && project.updatedAt !== input.expectedUpdatedAt) {
      throw conflict("Project was updated by someone else. Reload and try again.", {
        projectId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        currentUpdatedAt: project.updatedAt
      });
    }

    const nextName = input.name?.trim() ?? project.name;
    const nameChanged = normalizeName(nextName) !== normalizeName(project.name);
    if (nameChanged) {
      const existing = this.store.projects
        .filter((entry) => entry.id !== projectId)
        .map((entry) => normalizeName(entry.name));
      if (existing.includes(normalizeName(nextName))) {
        throw conflict("Project name already exists. Please choose another name.", {
          field: "name",
          suggestions: getNameSuggestions(nextName, existing)
        });
      }
    }

    const nextReleaseDate = input.releaseDate ?? project.releaseDate;
    parseIsoDate(nextReleaseDate);

    project.name = nextName;
    project.comments = input.comments?.trim() ?? project.comments;
    project.releaseDate = nextReleaseDate;
    if (input.milestoneOffsetsDays) {
      project.settings = mergeSettings(project.settings, {
        milestoneOffsets: input.milestoneOffsetsDays
      });
      validateSettings(project.settings);
    }
    project.status = input.status ?? project.status;
    project.updatedAt = nowIso();

    this.applyScheduleAdjustment(project);
    this.store.save();
    return project;
  }

  shiftProjectReleaseWithAssignments(actor: ActorContext, projectId: string, weekShift: number): {
    project: Project;
    shiftedAssignments: number;
  } {
    assertCreatePermission(actor);
    if (!Number.isInteger(weekShift) || weekShift === 0) {
      throw badRequest("weekShift must be a non-zero integer.");
    }

    const project = this.store.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw notFound("Project not found.", { projectId });
    }

    const shiftDays = weekShift * 7;
    project.releaseDate = formatIsoDate(addDays(parseIsoDate(project.releaseDate), shiftDays));
    this.applyScheduleAdjustment(project);
    project.updatedAt = nowIso();

    const assignmentsForProject = this.store.assignments.filter((assignment) => assignment.projectId === projectId);
    assignmentsForProject.forEach((assignment) => {
      const shiftedStartDate = formatIsoDate(addDays(parseIsoDate(assignment.startDate), shiftDays));
      const shiftedEndDate = formatIsoDate(addDays(parseIsoDate(assignment.endDate), shiftDays));
      const clamped = clampAssignmentToProjectWindow(project, shiftedStartDate, shiftedEndDate);
      assignment.startDate = clamped.startDate;
      assignment.endDate = clamped.endDate;
      assignment.updatedAt = nowIso();
    });

    this.store.save();
    return {
      project,
      shiftedAssignments: assignmentsForProject.length
    };
  }

  listProjects(): Project[] {
    this.recalculateAllProjects();
    return this.store.projects.map((project) => {
      const milestones = this.getMilestoneDates(project);
      return {
        ...project,
        certificationDate: milestones.certificationDate,
        exclusiveDate: milestones.exclusiveDate,
        productionStartDate: milestones.productionStartDate,
        preProductionStartDate: milestones.preProductionStartDate
      } as Project;
    });
  }

  listDatabaseTables(actor: ActorContext): string[] {
    assertMappingEditPermission(actor);
    return this.store.listDatabaseTables();
  }

  listMappingRules(actor: ActorContext): DataMappingRule[] {
    assertMappingEditPermission(actor);
    return this.store.listMappingRules();
  }

  createMappingRule(actor: ActorContext, input: DataMappingRuleInput): DataMappingRule {
    assertMappingEditPermission(actor);

    const sourceSheet = input.sourceSheet.trim();
    const sourceColumn = input.sourceColumn.trim();
    const targetTable = input.targetTable.trim();
    const targetField = input.targetField.trim();
    if (!sourceSheet || !sourceColumn || !targetTable || !targetField) {
      throw badRequest("sourceSheet, sourceColumn, targetTable, and targetField are required.");
    }

    const allowedTables = new Set(this.store.listDatabaseTables());
    if (!allowedTables.has(targetTable)) {
      throw badRequest("targetTable must reference an existing table.", {
        targetTable,
        allowedTables: [...allowedTables]
      });
    }

    const rule: DataMappingRule = {
      id: uuidv4(),
      sourceSheet,
      sourceColumn,
      targetTable,
      targetField,
      transform: input.transform?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      enabled: input.enabled ?? true,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId
    };

    this.store.saveMappingRule(rule);
    return rule;
  }

  updateMappingRule(actor: ActorContext, mappingId: string, input: DataMappingRuleInput): DataMappingRule {
    assertMappingEditPermission(actor);
    const existing = this.store.listMappingRules().find((entry) => entry.id === mappingId);
    if (!existing) {
      throw notFound("Mapping rule not found.", { mappingId });
    }

    const sourceSheet = input.sourceSheet.trim();
    const sourceColumn = input.sourceColumn.trim();
    const targetTable = input.targetTable.trim();
    const targetField = input.targetField.trim();
    if (!sourceSheet || !sourceColumn || !targetTable || !targetField) {
      throw badRequest("sourceSheet, sourceColumn, targetTable, and targetField are required.");
    }

    const allowedTables = new Set(this.store.listDatabaseTables());
    if (!allowedTables.has(targetTable)) {
      throw badRequest("targetTable must reference an existing table.", {
        targetTable,
        allowedTables: [...allowedTables]
      });
    }

    const updated: DataMappingRule = {
      ...existing,
      sourceSheet,
      sourceColumn,
      targetTable,
      targetField,
      transform: input.transform?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      enabled: input.enabled ?? existing.enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId
    };

    this.store.saveMappingRule(updated);
    return updated;
  }

  deleteMappingRule(actor: ActorContext, mappingId: string): void {
    assertMappingEditPermission(actor);
    const existing = this.store.listMappingRules().find((entry) => entry.id === mappingId);
    if (!existing) {
      throw notFound("Mapping rule not found.", { mappingId });
    }
    this.store.deleteMappingRule(mappingId);
  }
}
