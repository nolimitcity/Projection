import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/projection.sqlite");
const rows = db.prepare("SELECT key, value FROM documents").all();
const docs = new Map(rows.map((row) => [row.key, JSON.parse(row.value)]));

const asArray = (value) => (Array.isArray(value) ? value : []);

const roles = asArray(docs.get("roles"));
const offices = asArray(docs.get("offices"));
const people = asArray(docs.get("people"));
const assignments = asArray(docs.get("assignments"));

const usedRoleCodes = new Set([
  ...people.map((person) => String(person.primaryRoleCode)),
  ...assignments.map((assignment) => String(assignment.roleCode))
]);
const usedOfficeCodes = new Set(people.map((person) => String(person.office)));

const unusedRoles = roles
  .filter((role) => !usedRoleCodes.has(String(role.code)))
  .map((role) => ({ code: role.code, label: role.label }));

const unusedOffices = offices
  .filter((office) => !usedOfficeCodes.has(String(office.code)))
  .map((office) => ({ code: office.code, label: office.label }));

console.log(
  JSON.stringify(
    {
      roleCount: roles.length,
      officeCount: offices.length,
      unusedRoles,
      unusedOffices
    },
    null,
    2
  )
);
