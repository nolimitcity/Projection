import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { v4 as uuidv4 } from "uuid";
import {
  AuditEvent,
  DataMappingRule,
  GlobalClosure,
  OfficeDefinition,
  Person,
  Project,
  ProjectAssignment,
  ProjectStatus,
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
  logAuditEvent(event: { actor: string; method: string; path: string; status: number; detail?: string }): void;
  listAuditEvents(limit?: number): AuditEvent[];
  close(): void;
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

const ROADMAP_PROJECT_SEEDS: Array<{ name: string; startDate: string; releaseDate: string; status: ProjectStatus }> = [
  { name: "Creepy Carnival", startDate: "2015-05-26", releaseDate: "2015-05-26", status: "completed" },
  { name: "Creepy Carnival (mobile)", startDate: "2015-12-02", releaseDate: "2015-12-02", status: "completed" },
  { name: "Space Arcade", startDate: "2016-08-31", releaseDate: "2016-08-31", status: "completed" },
  { name: "Oktoberfest", startDate: "2016-11-15", releaseDate: "2016-11-15", status: "completed" },
  { name: "Kitchen Drama Sushi Mania", startDate: "2017-04-12", releaseDate: "2017-04-12", status: "completed" },
  { name: "Wixx", startDate: "2017-10-31", releaseDate: "2017-10-31", status: "completed" },
  { name: "Kitchen Drama BBQ Frenzy", startDate: "2017-11-29", releaseDate: "2017-11-29", status: "completed" },
  { name: "Casino Win Spin", startDate: "2018-01-31", releaseDate: "2018-01-31", status: "completed" },
  { name: "Tesla Jolt", startDate: "2018-03-29", releaseDate: "2018-03-29", status: "completed" },
  { name: "Coins of Fortune", startDate: "2018-06-28", releaseDate: "2018-06-28", status: "completed" },
  { name: "Hot Nudge", startDate: "2018-07-26", releaseDate: "2018-07-26", status: "completed" },
  { name: "Dungeon Quest", startDate: "2018-09-27", releaseDate: "2018-09-27", status: "completed" },
  { name: "Ice Ice Yeti", startDate: "2018-11-15", releaseDate: "2018-11-15", status: "completed" },
  { name: "Fruits", startDate: "2019-01-30", releaseDate: "2019-01-30", status: "completed" },
  { name: "Owls", startDate: "2019-02-27", releaseDate: "2019-02-27", status: "completed" },
  { name: "Starstruck", startDate: "2019-03-27", releaseDate: "2019-03-27", status: "completed" },
  { name: "Tombstone", startDate: "2019-05-02", releaseDate: "2019-05-02", status: "completed" },
  { name: "Mayan Magic Wildfire", startDate: "2019-06-04", releaseDate: "2019-06-04", status: "completed" },
  { name: "Tractor Beam", startDate: "2019-07-02", releaseDate: "2019-07-02", status: "completed" },
  { name: "The Creepy Carnival (remake)", startDate: "2019-07-16", releaseDate: "2019-07-16", status: "completed" },
  { name: "Thor Hammer Time", startDate: "2019-08-01", releaseDate: "2019-08-01", status: "completed" },
  { name: "Hot 4 Cash", startDate: "2019-08-15", releaseDate: "2019-08-15", status: "completed" },
  { name: "Pixies vs Pirates", startDate: "2019-09-03", releaseDate: "2019-09-03", status: "completed" },
  { name: "Manhattan Goes Wild", startDate: "2019-10-02", releaseDate: "2019-10-02", status: "completed" },
  { name: "Tomb of Nefertiti", startDate: "2019-11-05", releaseDate: "2019-11-05", status: "completed" },
  { name: "Dragon Tribe", startDate: "2019-12-12", releaseDate: "2019-12-12", status: "completed" },
  { name: "Poison Eve", startDate: "2020-01-07", releaseDate: "2020-01-07", status: "completed" },
  { name: "Punk Rocker", startDate: "2020-02-12", releaseDate: "2020-02-12", status: "completed" },
  { name: "Barbarian Fury", startDate: "2020-03-03", releaseDate: "2020-03-03", status: "completed" },
  { name: "Gaelic Gold", startDate: "2020-03-16", releaseDate: "2020-03-16", status: "completed" },
  { name: "Harlequin Carnival", startDate: "2020-04-07", releaseDate: "2020-04-07", status: "completed" },
  { name: "Deadwood xNudge", startDate: "2020-05-06", releaseDate: "2020-05-06", status: "completed" },
  { name: "Bonus Bunnies", startDate: "2020-06-09", releaseDate: "2020-06-09", status: "completed" },
  { name: "Milky Ways", startDate: "2020-06-24", releaseDate: "2020-06-24", status: "completed" },
  { name: "Golden Genie", startDate: "2020-07-07", releaseDate: "2020-07-07", status: "completed" },
  { name: "Immortal Fruits", startDate: "2020-08-04", releaseDate: "2020-08-04", status: "completed" },
  { name: "Book of Shadows", startDate: "2020-08-20", releaseDate: "2020-08-20", status: "completed" },
  { name: "Buffalo Hunter", startDate: "2020-09-08", releaseDate: "2020-09-08", status: "completed" },
  { name: "Monkey's Gold", startDate: "2020-10-13", releaseDate: "2020-10-13", status: "completed" },
  { name: "Warrior Graveyard", startDate: "2020-11-03", releaseDate: "2020-11-03", status: "completed" },
  { name: "Tomb of Akhenaten", startDate: "2020-12-15", releaseDate: "2020-12-15", status: "completed" },
  { name: "San Quentin", startDate: "2021-01-12", releaseDate: "2021-01-12", status: "completed" },
  { name: "East Coast vs West Coast", startDate: "2021-02-02", releaseDate: "2021-02-02", status: "completed" },
  { name: "Fire in the hole", startDate: "2021-03-02", releaseDate: "2021-03-02", status: "completed" },
  { name: "Bushido Ways xNudge", startDate: "2021-04-13", releaseDate: "2021-04-13", status: "completed" },
  { name: "El Paso Gunfight xNudge", startDate: "2021-05-04", releaseDate: "2021-05-04", status: "completed" },
  { name: "Infectious 5 xWays", startDate: "2021-06-01", releaseDate: "2021-06-01", status: "completed" },
  { name: "xWays Hoarder xSplit", startDate: "2021-07-06", releaseDate: "2021-07-06", status: "completed" },
  { name: "Mental", startDate: "2021-08-31", releaseDate: "2021-08-31", status: "completed" },
  { name: "Das xBoot", startDate: "2021-09-14", releaseDate: "2021-09-14", status: "completed" },
  { name: "Evil Goblins xBomb", startDate: "2021-10-12", releaseDate: "2021-10-12", status: "completed" },
  { name: "Legion X", startDate: "2021-11-30", releaseDate: "2021-11-30", status: "completed" },
  { name: "True Grit", startDate: "2021-12-21", releaseDate: "2021-12-21", status: "completed" },
  { name: "Tombstone R.I.P", startDate: "2022-01-11", releaseDate: "2022-01-11", status: "completed" },
  { name: "Punk Toilet", startDate: "2022-02-08", releaseDate: "2022-02-08", status: "completed" },
  { name: "Misery mining (FITH 2)", startDate: "2022-03-15", releaseDate: "2022-03-15", status: "completed" },
  { name: "Remember Gulag", startDate: "2022-04-19", releaseDate: "2022-04-19", status: "completed" },
  { name: "Karen Maneater (Hoarder 2)", startDate: "2022-05-10", releaseDate: "2022-05-10", status: "completed" },
  { name: "Folsom Prison (SQ 2)", startDate: "2022-06-14", releaseDate: "2022-06-14", status: "completed" },
  { name: "The Rave", startDate: "2022-07-12", releaseDate: "2022-07-12", status: "completed" },
  { name: "Road Rage", startDate: "2022-08-16", releaseDate: "2022-08-16", status: "completed" },
  { name: "The Border", startDate: "2022-09-13", releaseDate: "2022-09-13", status: "completed" },
  { name: "Little Bighorn", startDate: "2022-10-11", releaseDate: "2022-10-11", status: "completed" },
  { name: "Serial", startDate: "2022-11-08", releaseDate: "2022-11-08", status: "completed" },
  { name: "Rock Bottom", startDate: "2022-11-22", releaseDate: "2022-11-22", status: "completed" },
  { name: "Pearl Harbor (xBoot 2)", startDate: "2022-12-07", releaseDate: "2022-12-07", status: "completed" },
  { name: "Dead Canary", startDate: "2022-12-20", releaseDate: "2022-12-20", status: "completed" },
  { name: "Walk of Shame", startDate: "2023-01-17", releaseDate: "2023-01-17", status: "completed" },
  { name: "Benji killed in Vegas (EvsW2)", startDate: "2023-02-07", releaseDate: "2023-02-07", status: "completed" },
  { name: "Blood & Shadow", startDate: "2023-03-07", releaseDate: "2023-03-07", status: "completed" },
  { name: "Kiss My Chainsaw", startDate: "2023-04-11", releaseDate: "2023-04-11", status: "completed" },
  { name: "Disturbed (Mental 2 pre)", startDate: "2023-05-09", releaseDate: "2023-05-09", status: "completed" },
  { name: "Whacked!", startDate: "2023-05-23", releaseDate: "2023-05-23", status: "completed" },
  { name: "Gluttony", startDate: "2023-06-06", releaseDate: "2023-06-06", status: "completed" },
  { name: "The Cage", startDate: "2023-06-20", releaseDate: "2023-06-20", status: "completed" },
  { name: "Bounty Hunter xNudge", startDate: "2023-07-11", releaseDate: "2023-07-11", status: "completed" },
  { name: "True Kult", startDate: "2023-08-08", releaseDate: "2023-08-08", status: "completed" },
  { name: "DJ P5ychØ", startDate: "2023-08-22", releaseDate: "2023-08-22", status: "completed" },
  { name: "The Crypt", startDate: "2023-09-05", releaseDate: "2023-09-05", status: "completed" },
  { name: "Space Donkey", startDate: "2023-10-03", releaseDate: "2023-10-03", status: "completed" },
  { name: "Ugliest Catch", startDate: "2023-10-17", releaseDate: "2023-10-17", status: "completed" },
  { name: "Roadkill", startDate: "2023-11-07", releaseDate: "2023-11-07", status: "completed" },
  { name: "Nine To Five", startDate: "2023-11-21", releaseDate: "2023-11-21", status: "completed" },
  { name: "Jingle Balls", startDate: "2023-12-05", releaseDate: "2023-12-05", status: "completed" },
  { name: "Devil's Crossroad", startDate: "2024-01-09", releaseDate: "2024-01-09", status: "completed" },
  { name: "Land of the free", startDate: "2024-01-23", releaseDate: "2024-01-23", status: "completed" },
  { name: "D Day", startDate: "2024-02-13", releaseDate: "2024-02-13", status: "completed" },
  { name: "FITH 2", startDate: "2024-02-20", releaseDate: "2024-02-20", status: "completed" },
  { name: "Possessed", startDate: "2024-03-05", releaseDate: "2024-03-05", status: "completed" },
  { name: "Brick Snake 2000", startDate: "2024-03-21", releaseDate: "2024-03-21", status: "completed" },
  { name: "Tombstone No Mercy", startDate: "2024-04-16", releaseDate: "2024-04-16", status: "completed" },
  { name: "Kenneth must die", startDate: "2024-05-07", releaseDate: "2024-05-07", status: "completed" },
  { name: "Loner", startDate: "2024-05-21", releaseDate: "2024-05-21", status: "completed" },
  { name: "Deadwood RIP", startDate: "2024-06-04", releaseDate: "2024-06-04", status: "completed" },
  { name: "Beheaded", startDate: "2024-06-18", releaseDate: "2024-06-18", status: "completed" },
  { name: "Punk Rocker 2", startDate: "2024-07-09", releaseDate: "2024-07-09", status: "completed" },
  { name: "Apocalypse Super xNudge", startDate: "2024-07-23", releaseDate: "2024-07-23", status: "completed" },
  { name: "Outsourced", startDate: "2024-08-06", releaseDate: "2024-08-06", status: "completed" },
  { name: "Stockholm Syndrome", startDate: "2024-08-20", releaseDate: "2024-08-20", status: "completed" },
  { name: "Skate or Die", startDate: "2024-09-10", releaseDate: "2024-09-10", status: "completed" },
  { name: "San Quentin 2: Death Row", startDate: "2024-09-24", releaseDate: "2024-09-24", status: "completed" },
  { name: "Brute Force", startDate: "2024-10-08", releaseDate: "2024-10-08", status: "completed" },
  { name: "Blood & Shadow 2", startDate: "2024-10-22", releaseDate: "2024-10-22", status: "completed" },
  { name: "Outsourced: Slash game", startDate: "2024-11-05", releaseDate: "2024-11-05", status: "completed" },
  { name: "Munchies (Decadence), (SHORT PROD)", startDate: "2024-11-19", releaseDate: "2024-11-19", status: "completed" },
  { name: "Tanked", startDate: "2024-12-03", releaseDate: "2024-12-03", status: "completed" },
  { name: "Outsourced: Payday", startDate: "2024-12-17", releaseDate: "2024-12-17", status: "completed" },
  { name: "xWays Hoarder 2", startDate: "2025-01-14", releaseDate: "2025-01-14", status: "completed" },
  { name: "Tombstone Slaughter: El Gordos Revenge", startDate: "2025-01-28", releaseDate: "2025-01-28", status: "completed" },
  { name: "Duck Hunters", startDate: "2025-02-11", releaseDate: "2025-02-11", status: "completed" },
  { name: "Dead, Dead Or Deader", startDate: "2025-02-25", releaseDate: "2025-02-25", status: "completed" },
  { name: "Home of the Brave", startDate: "2025-03-11", releaseDate: "2025-03-11", status: "completed" },
  { name: "Mental 2", startDate: "2025-03-25", releaseDate: "2025-03-25", status: "completed" },
  { name: "Blood Diamond", startDate: "2025-04-08", releaseDate: "2025-04-08", status: "completed" },
  { name: "Highway to Hell", startDate: "2025-04-22", releaseDate: "2025-04-22", status: "completed" },
  { name: "Kill Em All", startDate: "2025-05-20", releaseDate: "2025-05-20", status: "completed" },
  { name: "Fire In The Hole 3", startDate: "2025-06-03", releaseDate: "2025-06-03", status: "completed" },
  { name: "Flight Mode", startDate: "2025-06-17", releaseDate: "2025-06-17", status: "completed" },
  { name: "Brute Force: Alien Onslaught", startDate: "2025-07-08", releaseDate: "2025-07-08", status: "completed" },
  { name: "Tsar Wars", startDate: "2025-07-22", releaseDate: "2025-07-22", status: "completed" },
  { name: "Seamen", startDate: "2025-08-05", releaseDate: "2025-08-05", status: "completed" },
  { name: "Gator Hunters", startDate: "2025-08-19", releaseDate: "2025-08-19", status: "completed" },
  { name: "Dead Men Walking", startDate: "2025-09-09", releaseDate: "2025-09-09", status: "completed" },
  { name: "Breakout", startDate: "2025-10-14", releaseDate: "2025-10-14", status: "completed" },
  { name: "Bangkok Hilton", startDate: "2025-10-28", releaseDate: "2025-10-28", status: "completed" },
  { name: "Disorder", startDate: "2025-05-08", releaseDate: "2025-11-04", status: "completed" },
  { name: "Bizarre", startDate: "2025-11-18", releaseDate: "2025-11-18", status: "completed" },
  { name: "Crazy Ex-Girlfriend", startDate: "2025-12-02", releaseDate: "2025-12-02", status: "completed" },
  { name: "Duck Hunters 16K", startDate: "2025-12-15", releaseDate: "2025-12-15", status: "completed" },
  { name: "Das xBoot Zwei!", startDate: "2025-06-19", releaseDate: "2025-12-16", status: "completed" },
  { name: "Duck Hunters: Happy Hour", startDate: "2026-01-13", releaseDate: "2026-01-13", status: "completed" },
  { name: "Golden Shower", startDate: "2026-01-27", releaseDate: "2026-01-27", status: "completed" },
  { name: "Supersized", startDate: "2026-02-10", releaseDate: "2026-02-10", status: "completed" },
  { name: "San Quentin Manhunt (Stake)", startDate: "2026-02-12", releaseDate: "2026-02-12", status: "completed" },
  { name: "The Crypt 2", startDate: "2026-03-03", releaseDate: "2026-03-03", status: "completed" },
  { name: "Catfish Hunters", startDate: "2026-03-17", releaseDate: "2026-03-17", status: "completed" },
  { name: "Pünk Rocker 3", startDate: "2026-04-07", releaseDate: "2026-04-07", status: "active" },
  { name: "San Quentin Manhunt - global release", startDate: "2026-04-21", releaseDate: "2026-04-21", status: "active" },
  { name: "Bonus Junkie", startDate: "2026-04-23", releaseDate: "2026-04-23", status: "active" },
  { name: "Tombstone Begins", startDate: "2026-05-12", releaseDate: "2026-05-12", status: "active" },
  { name: "True Grit Redemption 2", startDate: "2026-05-26", releaseDate: "2026-05-26", status: "active" },
  { name: "Tanked 3: First Blood 2", startDate: "2026-06-09", releaseDate: "2026-06-09", status: "active" },
  { name: "Soaked By Seamen", startDate: "2026-06-23", releaseDate: "2026-06-23", status: "active" },
  { name: "AFK Airport Security", startDate: "2026-07-07", releaseDate: "2026-07-07", status: "active" },
  { name: "Duck Hunters 2", startDate: "2026-07-28", releaseDate: "2026-07-28", status: "active" },
  { name: "Outsourced 2 - Balkan Engineering", startDate: "2026-08-11", releaseDate: "2026-08-11", status: "active" },
  { name: "Six Feet Under", startDate: "2026-08-25", releaseDate: "2026-08-25", status: "active" },
  { name: "Borken", startDate: "2026-09-08", releaseDate: "2026-09-08", status: "active" },
  { name: "FITH4", startDate: "2026-09-22", releaseDate: "2026-09-22", status: "active" },
  { name: "Bowel of Beelzebub", startDate: "2026-10-06", releaseDate: "2026-10-06", status: "active" },
  { name: "Feed em to the pigs (NOT BIZARRE)", startDate: "2027-01-05", releaseDate: "2027-01-05", status: "active" },
  { name: "Gator Hunters 2", startDate: "2026-11-24", releaseDate: "2026-11-24", status: "active" },
  { name: "Concept X", startDate: "2026-12-08", releaseDate: "2026-12-08", status: "active" },
  { name: "Broligarchs", startDate: "2027-01-05", releaseDate: "2027-01-05", status: "active" },
  { name: "Mental III", startDate: "2027-02-09", releaseDate: "2027-02-09", status: "active" },
  { name: "Maggot", startDate: "2027-04-20", releaseDate: "2027-04-20", status: "active" },
  { name: "TheCryptMickeyMouseClub (Exploring)", startDate: "2026-09-08", releaseDate: "2026-09-08", status: "active" },
  { name: "Bass to Mouth", startDate: "2028-01-01", releaseDate: "2028-01-01", status: "active" },
  { name: "Alien Lean", startDate: "2027-03-09", releaseDate: "2027-03-09", status: "active" },
  { name: "Medieval on your ass", startDate: "2027-03-23", releaseDate: "2027-03-23", status: "active" },
  { name: "Dental", startDate: "2027-01-05", releaseDate: "2027-01-05", status: "active" },
  { name: "Kenneth is Erected", startDate: "2028-01-01", releaseDate: "2028-01-01", status: "active" },
  { name: "Death By Bingo", startDate: "2028-01-01", releaseDate: "2028-01-01", status: "active" },
  { name: "Dead Canary Straight-Up Reels", startDate: "2027-02-23", releaseDate: "2027-02-23", status: "active" },
  { name: "Flight Mode 2 - Hijacked", startDate: "2027-01-19", releaseDate: "2027-01-19", status: "active" },
  { name: "Masked Swinger", startDate: "2027-04-06", releaseDate: "2027-04-06", status: "active" },
  { name: "Horseface", startDate: "2028-01-01", releaseDate: "2028-01-01", status: "active" },
  { name: "Skins - Per. Outsourced. DH, FITH2, SQ, Nine to Five, etc.", startDate: "2028-01-01", releaseDate: "2028-01-01", status: "active" },
  { name: "Kenneth must die light skin", startDate: "2028-01-01", releaseDate: "2028-01-01", status: "active" },
  { name: "Vanilla Duck Hunters US-skin", startDate: "2028-01-01", releaseDate: "2028-01-01", status: "active" }
];

// Increment this constant whenever a new migration block is added to loadSnapshot.
const SCHEMA_VERSION = 4;

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

  const projects: Project[] = ROADMAP_PROJECT_SEEDS.map((seedProject) => {
    const projectSettings = cloneTemplateSettings(
      seedProject.status === "active" ? templates[0].settings : templates[1].settings
    );

    return {
      id: uuidv4(),
      name: seedProject.name,
      comments: "",
      releaseDate: seedProject.releaseDate,
      startDate: seedProject.startDate,
      targetEndDate: seedProject.releaseDate,
      adjustedEndDate: seedProject.releaseDate,
      scheduleDelayDays: 0,
      settings: projectSettings,
      status: seedProject.status,
      createdAt: now(),
      createdBy: "seed-import",
      updatedAt: now(),
      source: { type: "blank" }
    };
  });

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
      isActive: true,
      createdAt: now(),
      createdBy: "seed-admin",
      updatedAt: now()
    },
    {
      id: uuidv4(),
      name: "Jasper",
      primaryRoleCode: "S",
      office: "Sthlm",
      weeklyCapacityHours: 40,
      workingDays: [1, 2, 3, 4, 5],
      isActive: true,
      createdAt: now(),
      createdBy: "seed-admin",
      updatedAt: now()
    },
    {
      id: uuidv4(),
      name: "Denis",
      primaryRoleCode: "Q",
      office: "India",
      weeklyCapacityHours: 40,
      workingDays: [1, 2, 3, 4, 5],
      isActive: true,
      createdAt: now(),
      createdBy: "seed-admin",
      updatedAt: now()
    }
  ];

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
      createdBy: "seed-owner",
      updatedAt: now()
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
      createdBy: "seed-owner",
      updatedAt: now()
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
      createdBy: "seed-owner",
      updatedAt: now()
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
  private readonly dbPath: string;

  constructor(databasePath = resolve(process.cwd(), "data", "projection.sqlite")) {
    this.dbPath = databasePath;
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA synchronous = NORMAL");
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

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER NOT NULL,
        detail TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    const currentVersion = (this.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    if (currentVersion < SCHEMA_VERSION) {
      this.backupDatabase();
    }

    const snapshot = this.loadSnapshot(currentVersion);
    this.templates = snapshot.templates;
    this.projects = snapshot.projects;
    this.globalClosures = snapshot.globalClosures;
    this.people = snapshot.people;
    this.assignments = snapshot.assignments;
    this.roles = snapshot.roles;
    this.offices = snapshot.offices;
    this.users = snapshot.users;
  }

  close(): void {
    try {
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      // best-effort
    }
    this.db.close();
  }

  private backupDatabase(): void {
    try {
      // Flush WAL into main file before copying so the backup is self-contained.
      this.db.exec("PRAGMA wal_checkpoint(PASSIVE)");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = `${this.dbPath}.bak-${timestamp}`;
      copyFileSync(this.dbPath, backupPath);
    } catch {
      // Backup is best-effort; a missing or unwritable data dir should not
      // block startup.
    }
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

  logAuditEvent(event: { actor: string; method: string; path: string; status: number; detail?: string }): void {
    this.db
      .prepare(
        `INSERT INTO audit_log(id, actor, method, path, status, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uuidv4(),
        event.actor,
        event.method,
        event.path,
        event.status,
        event.detail ?? "",
        now()
      );
  }

  listAuditEvents(limit = 200): AuditEvent[] {
    const safeLimit = Number.isFinite(limit) ? Math.min(1000, Math.max(1, Math.floor(limit))) : 200;
    const rows = this.db
      .prepare(
        `SELECT id, actor, method, path, status, detail, created_at
         FROM audit_log
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(safeLimit) as Array<{
      id: string;
      actor: string;
      method: string;
      path: string;
      status: number;
      detail: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      actor: row.actor,
      method: row.method,
      path: row.path,
      status: row.status,
      detail: row.detail,
      createdAt: row.created_at
    }));
  }

  private loadSnapshot(currentVersion: number): StoreSnapshot {
    const rows = this.db.prepare("SELECT key, value FROM documents").all() as Array<{
      key: DocumentKey;
      value: string;
    }>;

    if (rows.length === 0) {
      const seeded = createSeedSnapshot();
      this.persistSnapshot(seeded);
      this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
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

    // v1: milestone offsets on templates
    if (currentVersion < 1) {
      snapshot.templates.forEach((template) => {
        if (!template.settings.milestoneOffsets) {
          template.settings.milestoneOffsets = { ...DEFAULT_MILESTONE_OFFSETS };
          migrated = true;
        }
      });
    }

    // v2: project fields — comments, milestoneOffsets, releaseDate, status normalisation
    if (currentVersion < 2) {
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
    }

    // v3: updatedAt tracking on all mutable entities
    if (currentVersion < 3) {
      snapshot.projects.forEach((project) => {
        if (!("updatedAt" in project) || !(project as Project & { updatedAt?: string }).updatedAt) {
          (project as Project & { updatedAt: string }).updatedAt = project.createdAt || now();
          migrated = true;
        }
      });
      snapshot.people.forEach((person) => {
        if (!("updatedAt" in person) || !(person as Person & { updatedAt?: string }).updatedAt) {
          (person as Person & { updatedAt: string }).updatedAt = person.createdAt || now();
          migrated = true;
        }
      });
      snapshot.assignments.forEach((assignment) => {
        if (!("updatedAt" in assignment) || !(assignment as ProjectAssignment & { updatedAt?: string }).updatedAt) {
          (assignment as ProjectAssignment & { updatedAt: string }).updatedAt = assignment.createdAt || now();
          migrated = true;
        }
      });
    }

    // v4: person active-state support
    if (currentVersion < 4) {
      snapshot.people.forEach((person) => {
        if (!("isActive" in person) || (person as Person & { isActive?: boolean }).isActive === undefined) {
          (person as Person & { isActive: boolean }).isActive = true;
          migrated = true;
        }
      });
    }

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

    if (currentVersion < SCHEMA_VERSION) {
      this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
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
