import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { v4 as uuidv4 } from "uuid";
import XLSX from "xlsx";
import { SqliteStore } from "../domain/store.js";
import { Person, Project, ProjectAssignment, ProjectTemplate, ProjectSettings } from "../domain/types.js";

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

type SheetRows = Array<Array<string | null>>;

const ROLE_CODE_RE = /^[A-Z]$/;
const DATE_MMDD_RE = /^(\d{1,2})\/(\d{1,2})$/;

const toText = (value: unknown): string => (value == null ? "" : String(value).trim());

const toNumber = (value: unknown): number | null => {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isoDate = (year: number, month: number, day: number): string => {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toISOString().slice(0, 10);
};

const addDays = (dateIso: string, days: number): string => {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const parseWorkbookSheets = (filePath: string): Map<string, SheetRows> => {
  const workbook = XLSX.readFile(filePath, { raw: false });
  const sheets = new Map<string, SheetRows>();

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null }) as SheetRows;
    sheets.set(name, rows);
  }

  return sheets;
};

const importRoles = (rows: SheetRows): Map<string, string> => {
  const roleMap = new Map<string, string>();
  for (let i = 1; i < rows.length; i += 1) {
    const role = toText(rows[i]?.[0]).toUpperCase();
    const label = toText(rows[i]?.[1]);
    if (ROLE_CODE_RE.test(role) && label) {
      roleMap.set(role, label);
    }
  }
  return roleMap;
};

const importPeople = (rows: SheetRows, importedAt: string): { people: Person[]; byName: Map<string, Person> } => {
  const people: Person[] = [];
  const byName = new Map<string, Person>();

  for (let i = 1; i < rows.length; i += 1) {
    const name = toText(rows[i]?.[0]);
    const roleCode = toText(rows[i]?.[2]).toUpperCase();
    const office = toText(rows[i]?.[5]) || "Unknown";

    if (!name || !ROLE_CODE_RE.test(roleCode)) {
      continue;
    }

    const person: Person = {
      id: uuidv4(),
      name,
      primaryRoleCode: roleCode,
      office,
      weeklyCapacityHours: 40,
      workingDays: [1, 2, 3, 4, 5],
      isActive: true,
      createdAt: importedAt,
      createdBy: "xlsx-import",
      updatedAt: importedAt
    };

    people.push(person);
    byName.set(name.toLowerCase(), person);
  }

  return { people, byName };
};

const importTemplates = (rows: SheetRows, importedAt: string): ProjectTemplate[] => {
  const templates: ProjectTemplate[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const name = toText(rows[i]?.[0]);
    if (!name) {
      if (i > 5) {
        break;
      }
      continue;
    }

    // The first block contains template names (Long/Medium/Short/Boost98).
    if (name.toLowerCase() === "example project definitions") {
      break;
    }

    templates.push({
      id: uuidv4(),
      name,
      description: "Imported from workbook Project Templates sheet",
      isActive: true,
      settings: { ...DEFAULT_SETTINGS, workWeek: { ...DEFAULT_SETTINGS.workWeek } },
      updatedAt: importedAt,
      updatedBy: "xlsx-import"
    });
  }

  return templates;
};

interface RoadmapWeekColumn {
  index: number;
  dateIso: string;
}

const getRoadmapWeekColumns = (rows: SheetRows): RoadmapWeekColumn[] => {
  const yearRow = rows[0] ?? [];
  const dateRow = rows[2] ?? [];

  const columns: RoadmapWeekColumn[] = [];
  let currentYear = 0;

  for (let c = 4; c < dateRow.length; c += 1) {
    const yearCell = toText(yearRow[c]);
    if (/^\d{4}$/.test(yearCell)) {
      currentYear = Number(yearCell);
    }

    const dateCell = toText(dateRow[c]);
    const match = dateCell.match(DATE_MMDD_RE);
    if (!match || currentYear <= 0) {
      continue;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    columns.push({ index: c, dateIso: isoDate(currentYear, month, day) });
  }

  return columns;
};

const importRoadmap = (
  rows: SheetRows,
  weekColumns: RoadmapWeekColumn[],
  templateNames: Set<string>,
  peopleByName: Map<string, Person>,
  importedAt: string
): { projects: Project[]; assignments: ProjectAssignment[]; peopleAdded: number } => {
  const projects: Project[] = [];
  const assignments: ProjectAssignment[] = [];
  let currentProject: Project | null = null;
  let peopleAdded = 0;

  const ensurePerson = (name: string, roleCode: string): Person => {
    const key = name.toLowerCase();
    const existing = peopleByName.get(key);
    if (existing) {
      return existing;
    }

    const person: Person = {
      id: uuidv4(),
      name,
      primaryRoleCode: roleCode,
      office: "Unknown",
      weeklyCapacityHours: 40,
      workingDays: [1, 2, 3, 4, 5],
      isActive: true,
      createdAt: importedAt,
      createdBy: "xlsx-import",
      updatedAt: importedAt
    };

    peopleByName.set(key, person);
    peopleAdded += 1;
    return person;
  };

  const activeDateSpan = (row: Array<string | null>): { start: string; end: string; avgLoad: number } | null => {
    const active = weekColumns
      .map((col) => ({ col, value: toNumber(row[col.index]) ?? 0 }))
      .filter((entry) => entry.value > 0);

    if (!active.length) {
      return null;
    }

    const start = active[0].col.dateIso;
    const end = addDays(active[active.length - 1].col.dateIso, 6);
    const avgLoad = active.reduce((sum, entry) => sum + entry.value, 0) / active.length;
    return { start, end, avgLoad };
  };

  for (let i = 4; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const col0 = toText(row[0]);
    const col1 = toText(row[1]);
    const col2 = toText(row[2]);

    if (!col0 && !col1 && !col2) {
      continue;
    }

    const isProjectRow = Boolean(col0) && templateNames.has(col1);

    if (isProjectRow) {
      const span = activeDateSpan(row);
      if (!span) {
        currentProject = null;
        continue;
      }

      const project: Project = {
        id: uuidv4(),
        name: col0,
        comments: `Imported from Roadmap (${col1} template)` ,
        releaseDate: span.end,
        startDate: span.start,
        targetEndDate: span.end,
        adjustedEndDate: span.end,
        scheduleDelayDays: 0,
        settings: { ...DEFAULT_SETTINGS, workWeek: { ...DEFAULT_SETTINGS.workWeek } },
        status: "active",
        createdAt: importedAt,
        createdBy: "xlsx-import",
        updatedAt: importedAt,
        source: { type: "blank" }
      };

      projects.push(project);
      currentProject = project;
      continue;
    }

    if (!currentProject || !col1 || !ROLE_CODE_RE.test(col2)) {
      continue;
    }

    const span = activeDateSpan(row);
    if (!span) {
      continue;
    }

    const person = ensurePerson(col1, col2);
    const allocationPercent = Math.max(1, Math.min(100, Math.round(span.avgLoad * 1000) / 10));

    assignments.push({
      id: uuidv4(),
      personId: person.id,
      projectId: currentProject.id,
      roleCode: col2,
      allocationPercent,
      startDate: span.start,
      endDate: span.end,
      createdAt: importedAt,
      createdBy: "xlsx-import",
      updatedAt: importedAt
    });
  }

  return { projects, assignments, peopleAdded };
};

const persistLegacySheets = (dbPath: string, sourceFile: string, sheets: Map<string, SheetRows>) => {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS legacy_workbook_sheets (
      sheet_name TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    )
  `);

  const upsert = db.prepare(
    `INSERT INTO legacy_workbook_sheets(sheet_name, source_file, imported_at, row_count, payload_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(sheet_name) DO UPDATE SET
       source_file = excluded.source_file,
       imported_at = excluded.imported_at,
       row_count = excluded.row_count,
       payload_json = excluded.payload_json`
  );

  const importedAt = new Date().toISOString();
  db.exec("BEGIN");
  try {
    for (const [sheetName, rows] of sheets.entries()) {
      upsert.run(sheetName, sourceFile, importedAt, rows.length, JSON.stringify(rows));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

const main = () => {
  const sourceFile = process.argv[2] || resolve(process.cwd(), "temp", "Nolimit Development Roadmap(Dev).xlsx");
  const dbPath = resolve(process.cwd(), "data", "projection.sqlite");
  const importedAt = new Date().toISOString();

  const sheets = parseWorkbookSheets(sourceFile);
  const peopleRows = sheets.get("People") ?? [];
  const roleRows = sheets.get("Roles") ?? [];
  const templateRows = sheets.get("Project Templates") ?? [];
  const roadmapRows = sheets.get("Roadmap") ?? [];

  const roleMap = importRoles(roleRows);
  const { people, byName } = importPeople(peopleRows, importedAt);
  const templates = importTemplates(templateRows, importedAt);
  const templateNames = new Set(templates.map((template) => template.name));
  const weekColumns = getRoadmapWeekColumns(roadmapRows);
  const roadmapImport = importRoadmap(roadmapRows, weekColumns, templateNames, byName, importedAt);

  const importedPrimaryIds = new Set(people.map((person) => person.id));
  const additionalPeople = Array.from(byName.values()).filter((person) => !importedPrimaryIds.has(person.id));
  const allPeople = [...people, ...additionalPeople];

  const store = new SqliteStore(dbPath);
  store.templates.splice(0, store.templates.length, ...templates);
  store.projects.splice(0, store.projects.length, ...roadmapImport.projects);
  store.people.splice(0, store.people.length, ...allPeople);
  store.assignments.splice(0, store.assignments.length, ...roadmapImport.assignments);
  store.globalClosures.splice(0, store.globalClosures.length);
  store.save();

  persistLegacySheets(dbPath, sourceFile, sheets);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        sourceFile,
        importedAt,
        imported: {
          templates: templates.length,
          projects: roadmapImport.projects.length,
          people: allPeople.length,
          assignments: roadmapImport.assignments.length,
          closures: 0,
          roles: roleMap.size,
          roadmapWeekColumns: weekColumns.length,
          addedPeopleFromRoadmap: roadmapImport.peopleAdded,
          legacySheetsCaptured: sheets.size
        }
      },
      null,
      2
    )
  );
};

main();