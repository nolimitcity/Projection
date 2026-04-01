import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/projection.sqlite");
const rows = db.prepare("SELECT key, value FROM documents").all();
const docs = new Map(rows.map((r) => [r.key, JSON.parse(r.value)]));

const asArray = (value) => (Array.isArray(value) ? value : []);

const people = asArray(docs.get("people"));
const roles = asArray(docs.get("roles"));
const offices = asArray(docs.get("offices"));

const roleSet = new Set(roles.map((r) => String(r.code)));
const officeSet = new Set(offices.map((o) => String(o.code)));

const violations = people
  .filter((p) => !roleSet.has(String(p.primaryRoleCode)) || !officeSet.has(String(p.office)))
  .map((p) => ({
    id: p.id,
    name: p.name,
    primaryRoleCode: p.primaryRoleCode,
    office: p.office,
    missingRole: !roleSet.has(String(p.primaryRoleCode)),
    missingOffice: !officeSet.has(String(p.office))
  }));

console.log(
  JSON.stringify(
    {
      peopleCount: people.length,
      roleCount: roles.length,
      officeCount: offices.length,
      violationCount: violations.length,
      violations
    },
    null,
    2
  )
);
