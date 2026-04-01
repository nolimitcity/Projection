import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { v4 as uuidv4 } from "uuid";
import {
  DataMappingRule,
  GlobalClosure,
  OfficeDefinition,
  Person,
  Project,
  ProjectAssignment,
  ProjectTemplate,
  RoleDefinition,
  UserAccount
} from "./types.js";

const now = () => new Date().toISOString();

const DOCUMENT_KEYS = ["templates", "projects", "globalClosures", "people", "assignments", "roles", "offices", "users"] as const;

type DocumentKey = (typeof DOCUMENT_KEYS)[number];

interface StoreSnapshot {
  templates: ProjectTemplate[];
  projects: Project[];
  globalClosures: GlobalClosure[];
  people: Person[];
  assignments: ProjectAssignment[];
  roles: RoleDefinition[];
  offices: OfficeDefinition[];
  users: UserAccount[];
}

export interface ProjectionStore extends StoreSnapshot {
  save(): void;
  listMappingRules(): DataMappingRule[];
  saveMappingRule(rule: DataMappingRule): void;
  deleteMappingRule(mappingId: string): void;
  listDatabaseTables(): string[];
}

const SEED_ROLES: RoleDefinition[] = [
  { code: "A", label: "Architect" },
  { code: "C", label: "Role C" },
  { code: "F", label: "Role F" },
  { code: "O", label: "Role O" },
  { code: "P", label: "Role P" },
  { code: "S", label: "Software Engineer" },
  { code: "Q", label: "QA Engineer" },
  { code: "PM", label: "Project Manager" },
  { code: "BA", label: "Business Analyst" },
  { code: "UX", label: "UX Designer" },
  { code: "DBA", label: "Database Administrator" },
  { code: "OPS", label: "DevOps / Infrastructure" }
];

const SEED_OFFICES: OfficeDefinition[] = [
  { code: "Sthlm", label: "Stockholm" },
  { code: "India", label: "India" },
  { code: "Other", label: "Other" },
  { code: "Romania", label: "Romania" },
  { code: "Malta", label: "Malta" },
  { code: "Remote", label: "Remote" }
];

const SEED_TEMPLATE_DEFINITIONS: Array<{
  canonicalName: string;
  aliases: string[];
  description: string;
  settings: ProjectTemplate["settings"];
}> = [
  {
    canonicalName: "Standard Release",
    aliases: ["Standard Release", "Standard Internal Project"],
    description: "1w exclusive, 6w certification, 12w production, 4w pre-production",
    settings: {
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
    }
  },
  {
    canonicalName: "Extended Release",
    aliases: ["Extended Release", "Customer Critical"],
    description: "1w exclusive, 6w certification, 16w production, 4w pre-production",
    settings: {
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
        productionLengthDays: 112,
        preProductionLengthDays: 28
      }
    }
  }
];

const createSeedSnapshot = (): StoreSnapshot => {
  const seedAdminAt = now();
  const users: UserAccount[] = [
    {
      email: "bjarne@nolimitcity.com",
      nickname: "Bjarne",
      accessLevel: "ADMIN",
      destroyerAccessRequested: false,
      createdAt: seedAdminAt,
      updatedAt: seedAdminAt
    }
  ];

  const templates: ProjectTemplate[] = [
    {
      id: uuidv4(),
      name: "Standard Release",
      description: "1w exclusive, 6w certification, 12w production, 4w pre-production",
      isActive: true,
      settings: {
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
      },
      updatedAt: now(),
      updatedBy: "seed-admin"
    },
    {
      id: uuidv4(),
      name: "Extended Release",
      description: "1w exclusive, 6w certification, 16w production, 4w pre-production",
      isActive: true,
      settings: {
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
          productionLengthDays: 112,
          preProductionLengthDays: 28
        }
      },
      updatedAt: now(),
      updatedBy: "seed-owner"
    }
  ];

  const projects: Project[] = [
    {
      id: uuidv4(),
      name: "Platform Modernization",
      comments: "Core platform upgrade",
      releaseDate: "2026-09-30",
      startDate: "2026-04-22",
      targetEndDate: "2026-09-30",
      adjustedEndDate: "2026-09-30",
      scheduleDelayDays: 0,
      settings: {
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
      },
      status: "active",
      createdAt: now(),
      createdBy: "seed-owner",
      source: { type: "blank" }
    },
    {
      id: uuidv4(),
      name: "Archived ERP Rollout",
      comments: "Completed rollout",
      releaseDate: "2025-10-01",
      startDate: "2025-03-26",
      targetEndDate: "2025-10-01",
      adjustedEndDate: "2025-10-01",
      scheduleDelayDays: 0,
      settings: {
        defaultCapacityHoursPerDay: 8,
        notificationProfile: "minimal",
        workWeek: {
          timezone: "Europe/Copenhagen",
          workingDays: [1, 2, 3, 4, 5],
          dailyHours: 8,
          holidayCalendar: "DK"
        },
        milestoneOffsets: {
          exclusiveLeadDays: 7,
          certificationLeadDays: 42,
          productionLengthDays: 112,
          preProductionLengthDays: 28
        }
      },
      status: "completed",
      createdAt: now(),
      createdBy: "seed-admin",
      source: { type: "blank" }
    }
  ];

  const globalClosures: GlobalClosure[] = [
    {
      id: uuidv4(),
      label: "Company Summer Shutdown",
      startDate: "2026-07-20",
      endDate: "2026-08-02",
      createdAt: now(),
      createdBy: "seed-admin"
    },
    {
      id: uuidv4(),
      label: "Year-End Closure",
      startDate: "2026-12-24",
      endDate: "2027-01-01",
      createdAt: now(),
      createdBy: "seed-admin"
    }
  ];

  const people: Person[] = [
    {
      id: uuidv4(),
      name: "Artem",
      primaryRoleCode: "A",
      office: "Sthlm",
      weeklyCapacityHours: 40,
      workingDays: [1, 2, 3, 4, 5],
      createdAt: now(),
      createdBy: "seed-admin"
    },
    {
      id: uuidv4(),
      name: "Jasper",
      primaryRoleCode: "S",
      office: "Sthlm",
      weeklyCapacityHours: 40,
      workingDays: [1, 2, 3, 4, 5],
      createdAt: now(),
      createdBy: "seed-admin"
    },
    {
      id: uuidv4(),
      name: "Denis",
      primaryRoleCode: "Q",
      office: "India",
      weeklyCapacityHours: 40,
      workingDays: [1, 2, 3, 4, 5],
      createdAt: now(),
      createdBy: "seed-admin"
    }
  ];
    users

  const assignments: ProjectAssignment[] = [
    {
      id: uuidv4(),
      personId: people[0].id,
      projectId: projects[0].id,
      roleCode: "A",
      allocationPercent: 60,
      startDate: "2026-04-01",
      endDate: "2026-09-30",
      createdAt: now(),
      createdBy: "seed-owner"
    },
    {
      id: uuidv4(),
      personId: people[1].id,
      projectId: projects[0].id,
      roleCode: "S",
      allocationPercent: 80,
      startDate: "2026-05-01",
      endDate: "2026-09-30",
      createdAt: now(),
      createdBy: "seed-owner"
    },
    {
      id: uuidv4(),
      personId: people[2].id,
      projectId: projects[0].id,
      roleCode: "Q",
      allocationPercent: 50,
      startDate: "2026-06-01",
      endDate: "2026-09-30",
      createdAt: now(),
      createdBy: "seed-owner"
    }
  ];

  return {
    templates,
    projects,
    globalClosures,
    people,
    assignments,
    roles: SEED_ROLES.slice(),
    offices: SEED_OFFICES.slice(),
    users
  };
};

const parseDocument = <T>(rawValue: string | undefined, fallback: T): T => {
  if (!rawValue) {
    return fallback;
  }

  return JSON.parse(rawValue) as T;
};

const mergeByCode = <T extends { code: string }>(existing: T[], required: T[]): { merged: T[]; changed: boolean } => {
  const merged = existing.slice();
  const existingCodes = new Set(existing.map((entry) => entry.code));
  let changed = false;

  required.forEach((entry) => {
    if (!existingCodes.has(entry.code)) {
      merged.push(entry);
      changed = true;
    }
  });

  return { merged, changed };
};

const DEFAULT_MILESTONE_OFFSETS = {
  exclusiveLeadDays: 7,
  certificationLeadDays: 42,
  productionLengthDays: 84,
  preProductionLengthDays: 28
};

const cloneTemplateSettings = (settings: ProjectTemplate["settings"]): ProjectTemplate["settings"] => ({
  defaultCapacityHoursPerDay: settings.defaultCapacityHoursPerDay,
  notificationProfile: settings.notificationProfile,
  workWeek: {
    timezone: settings.workWeek.timezone,
    workingDays: [...settings.workWeek.workingDays],
    dailyHours: settings.workWeek.dailyHours,
    holidayCalendar: settings.workWeek.holidayCalendar
  },
  milestoneOffsets: {
    exclusiveLeadDays: settings.milestoneOffsets.exclusiveLeadDays,
    certificationLeadDays: settings.milestoneOffsets.certificationLeadDays,
    productionLengthDays: settings.milestoneOffsets.productionLengthDays,
    preProductionLengthDays: settings.milestoneOffsets.preProductionLengthDays
  }
});

const syncSeedTemplates = (templates: ProjectTemplate[]): boolean => {
  let changed = false;
  const normalized = (value: string) => value.trim().toLowerCase();

  SEED_TEMPLATE_DEFINITIONS.forEach((definition) => {
    const aliases = new Set(definition.aliases.map((alias) => normalized(alias)));
    const existing = templates.find((template) => aliases.has(normalized(template.name)));

    if (existing) {
      if (
        existing.name !== definition.canonicalName ||
        existing.description !== definition.description ||
        JSON.stringify(existing.settings) !== JSON.stringify(definition.settings)
      ) {
        existing.name = definition.canonicalName;
        existing.description = definition.description;
        existing.settings = cloneTemplateSettings(definition.settings);
        existing.isActive = true;
        existing.updatedAt = now();
        existing.updatedBy = "seed-sync";
        changed = true;
      }
      return;
    }

    templates.push({
      id: uuidv4(),
      name: definition.canonicalName,
      description: definition.description,
      isActive: true,
      settings: cloneTemplateSettings(definition.settings),
      updatedAt: now(),
      updatedBy: "seed-sync"
    });
    changed = true;
  });

  return changed;
};

export class SqliteStore implements ProjectionStore {
  public readonly templates: ProjectTemplate[];
  public readonly projects: Project[];
  public readonly globalClosures: GlobalClosure[];
  public readonly people: Person[];
  public readonly assignments: ProjectAssignment[];
  public readonly roles: RoleDefinition[];
  public readonly offices: OfficeDefinition[];
  public readonly users: UserAccount[];

  private readonly db: DatabaseSync;

  constructor(databasePath = resolve(process.cwd(), "data", "projection.sqlite")) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mapping_rules (
        id TEXT PRIMARY KEY,
        source_sheet TEXT NOT NULL,
        source_column TEXT NOT NULL,
        target_table TEXT NOT NULL,
        target_field TEXT NOT NULL,
        transform TEXT NOT NULL,
        notes TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
      )
    `);

    const snapshot = this.loadSnapshot();
    this.templates = snapshot.templates;
    this.projects = snapshot.projects;
    this.globalClosures = snapshot.globalClosures;
    this.people = snapshot.people;
    this.assignments = snapshot.assignments;
    this.roles = snapshot.roles;
    this.offices = snapshot.offices;
    this.users = snapshot.users;
  }

  save(): void {
    this.persistSnapshot({
      templates: this.templates,
      projects: this.projects,
      globalClosures: this.globalClosures,
      people: this.people,
      assignments: this.assignments,
      roles: this.roles,
      offices: this.offices,
      users: this.users
    });
  }

  listMappingRules(): DataMappingRule[] {
    const rows = this.db
      .prepare(
        `SELECT id, source_sheet, source_column, target_table, target_field, transform, notes, enabled, updated_at, updated_by
         FROM mapping_rules
         ORDER BY source_sheet, source_column, target_table, target_field`
      )
      .all() as Array<{
      id: string;
      source_sheet: string;
      source_column: string;
      target_table: string;
      target_field: string;
      transform: string;
      notes: string;
      enabled: number;
      updated_at: string;
      updated_by: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      sourceSheet: row.source_sheet,
      sourceColumn: row.source_column,
      targetTable: row.target_table,
      targetField: row.target_field,
      transform: row.transform,
      notes: row.notes,
      enabled: Boolean(row.enabled),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    }));
  }

  saveMappingRule(rule: DataMappingRule): void {
    this.db
      .prepare(
        `INSERT INTO mapping_rules(id, source_sheet, source_column, target_table, target_field, transform, notes, enabled, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           source_sheet = excluded.source_sheet,
           source_column = excluded.source_column,
           target_table = excluded.target_table,
           target_field = excluded.target_field,
           transform = excluded.transform,
           notes = excluded.notes,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .run(
        rule.id,
        rule.sourceSheet,
        rule.sourceColumn,
        rule.targetTable,
        rule.targetField,
        rule.transform,
        rule.notes,
        rule.enabled ? 1 : 0,
        rule.updatedAt,
        rule.updatedBy
      );
  }

  deleteMappingRule(mappingId: string): void {
    this.db.prepare("DELETE FROM mapping_rules WHERE id = ?").run(mappingId);
  }

  listDatabaseTables(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>;

    return rows.map((row) => row.name);
  }

  private loadSnapshot(): StoreSnapshot {
    const rows = this.db.prepare("SELECT key, value FROM documents").all() as Array<{
      key: DocumentKey;
      value: string;
    }>;

    if (rows.length === 0) {
      const seeded = createSeedSnapshot();
      this.persistSnapshot(seeded);
      return seeded;
    }

    const docs = new Map<DocumentKey, string>(rows.map((row) => [row.key, row.value]));

    const templates = parseDocument(docs.get("templates"), []);
    const projects = parseDocument(docs.get("projects"), []);
    const globalClosures = parseDocument(docs.get("globalClosures"), []);
    const people = parseDocument(docs.get("people"), []);
    const assignments = parseDocument(docs.get("assignments"), []);
    const parsedRoles = parseDocument(docs.get("roles"), [] as RoleDefinition[]);
    const parsedOffices = parseDocument(docs.get("offices"), [] as OfficeDefinition[]);
    const users = parseDocument(docs.get("users"), [] as UserAccount[]);

    const roleMerge = mergeByCode(parsedRoles, SEED_ROLES);
    const officeMerge = mergeByCode(parsedOffices, SEED_OFFICES);

    const snapshot: StoreSnapshot = {
      templates,
      projects,
      globalClosures,
      people,
      assignments,
      roles: roleMerge.merged,
      offices: officeMerge.merged,
      users
    };

    let migrated = false;
    snapshot.templates.forEach((template) => {
      if (template.settings.milestoneOffsets) {
        return;
      }
      template.settings.milestoneOffsets = { ...DEFAULT_MILESTONE_OFFSETS };
      migrated = true;
    });

    snapshot.projects.forEach((project) => {
      if (!("comments" in project)) {
        (project as Project & { description?: string }).comments = (project as Project & { description?: string }).description ?? "";
        migrated = true;
      }
      if (!project.settings.milestoneOffsets) {
        project.settings.milestoneOffsets = { ...DEFAULT_MILESTONE_OFFSETS };
        migrated = true;
      }
      if (!project.releaseDate) {
        project.releaseDate = project.targetEndDate;
        migrated = true;
      }
      const legacyStatus = String(project.status || "");
      if (legacyStatus === "archived" || legacyStatus === "deleted") {
        project.status = "completed";
        migrated = true;
      }
    });

    if (syncSeedTemplates(snapshot.templates)) {
      migrated = true;
    }

    const adminEmail = "bjarne@nolimitcity.com";
    const existingAdmin = snapshot.users.find((entry) => entry.email.toLowerCase() === adminEmail);
    if (!existingAdmin) {
      const createdAt = now();
      snapshot.users.push({
        email: adminEmail,
        nickname: "Bjarne",
        accessLevel: "ADMIN",
        destroyerAccessRequested: false,
        createdAt,
        updatedAt: createdAt
      });
      migrated = true;
    }

    if (roleMerge.changed || officeMerge.changed || migrated) {
      this.persistSnapshot(snapshot);
    }

    return snapshot;
  }

  private persistSnapshot(snapshot: StoreSnapshot): void {
    const upsert = this.db.prepare(
      "INSERT INTO documents(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );

    this.db.exec("BEGIN");
    try {
      for (const key of DOCUMENT_KEYS) {
        upsert.run(key, JSON.stringify(snapshot[key]));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
