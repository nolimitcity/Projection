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

const roleMissingCounts = new Map();
const officeMissingCounts = new Map();
let bothMissing = 0;

for (const p of people) {
  const roleCode = String(p.primaryRoleCode);
  const officeCode = String(p.office);
  const missingRole = !roleSet.has(roleCode);
  const missingOffice = !officeSet.has(officeCode);

  if (missingRole) {
    roleMissingCounts.set(roleCode, (roleMissingCounts.get(roleCode) || 0) + 1);
  }
  if (missingOffice) {
    officeMissingCounts.set(officeCode, (officeMissingCounts.get(officeCode) || 0) + 1);
  }
  if (missingRole && missingOffice) {
    bothMissing += 1;
  }
}

const sortEntries = (map) =>
  Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));

const result = {
  peopleCount: people.length,
  roleCount: roles.length,
  officeCount: offices.length,
  missingRoleByCode: sortEntries(roleMissingCounts),
  missingOfficeByCode: sortEntries(officeMissingCounts),
  bothMissing
};

console.log(JSON.stringify(result, null, 2));
