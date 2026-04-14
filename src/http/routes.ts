import { Request, Response, Router } from "express";
import { z } from "zod";
import { ProjectionStore } from "../domain/store.js";
import { ProjectService } from "../domain/project-service.js";
import {
  AuthedRequest,
  clearSessionCookie,
  createDevBypassSession,
  createSessionFromGoogleToken,
  destroySessionFromRequest,
  establishSession,
  getCsrfTokenForRequest,
  getGoogleAuthConfig,
  resolveSessionActorFromCookie
} from "./auth.js";
import { badRequest } from "../domain/errors.js";
import { listLiveEdits, removeLiveEdit, upsertLiveEdit } from "./live-edit-hub.js";

const workWeekSchema = z.object({
  timezone: z.string().min(1),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1),
  dailyHours: z.number().positive(),
  holidayCalendar: z.string().min(1)
});

const settingsOverrideSchema = z
  .object({
    defaultCapacityHoursPerDay: z.number().min(0.5).max(16).optional(),
    notificationProfile: z.enum(["standard", "minimal", "strict"]).optional(),
    workWeek: workWeekSchema.partial().optional(),
    milestoneOffsets: z
      .object({
        exclusiveLeadDays: z.number().int().min(0).optional(),
        certificationLeadDays: z.number().int().min(0).optional(),
        productionLengthDays: z.number().int().min(1).optional(),
        preProductionLengthDays: z.number().int().min(0).optional()
      })
      .optional()
  })
  .optional();

const templateCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  settings: z.object({
    defaultCapacityHoursPerDay: z.number().min(0.5).max(16),
    notificationProfile: z.enum(["standard", "minimal", "strict"]),
    workWeek: workWeekSchema,
    milestoneOffsets: z.object({
      exclusiveLeadDays: z.number().int().min(0),
      certificationLeadDays: z.number().int().min(0),
      productionLengthDays: z.number().int().min(1),
      preProductionLengthDays: z.number().int().min(0)
    })
  })
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
  settings: z
    .object({
      defaultCapacityHoursPerDay: z.number().min(0.5).max(16).optional(),
      notificationProfile: z.enum(["standard", "minimal", "strict"]).optional(),
      workWeek: workWeekSchema.partial().optional(),
      milestoneOffsets: z
        .object({
          exclusiveLeadDays: z.number().int().min(0).optional(),
          certificationLeadDays: z.number().int().min(0).optional(),
          productionLengthDays: z.number().int().min(1).optional(),
          preProductionLengthDays: z.number().int().min(0).optional()
        })
        .optional()
    })
    .optional()
});

const previewTemplateSchema = z.object({
  templateId: z.string().uuid(),
  settingsOverride: settingsOverrideSchema
});

const previewCopySchema = z.object({
  sourceProjectId: z.string().uuid(),
  settingsOverride: settingsOverrideSchema
});

const createProjectSchema = z.object({
  mode: z.enum(["blank", "template", "copy"]),
  name: z.string().min(1),
  comments: z.string().optional(),
  releaseDate: z.string().date(),
  templateId: z.string().uuid().optional(),
  sourceProjectId: z.string().uuid().optional(),
  settingsOverride: settingsOverrideSchema
});

const updateProjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    comments: z.string().optional(),
    releaseDate: z.string().date().optional(),
    milestoneOffsetsDays: z
      .object({
        exclusiveLeadDays: z.number().int().min(0).optional(),
        certificationLeadDays: z.number().int().min(0).optional(),
        productionLengthDays: z.number().int().min(1).optional(),
        preProductionLengthDays: z.number().int().min(0).optional()
      })
      .optional(),
    status: z.enum(["active", "completed"]).optional(),
    expectedUpdatedAt: z.string().datetime().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update."
  });

const shiftProjectReleaseSchema = z.object({
  weekShift: z.number().int().refine((value) => value !== 0, {
    message: "weekShift must be a non-zero integer."
  })
});

const closureCreateSchema = z.object({
  label: z.string().min(1),
  startDate: z.string().date(),
  endDate: z.string().date()
});

const closureUpdateSchema = z
  .object({
    label: z.string().min(1).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update."
  });

const personCreateSchema = z.object({
  name: z.string().min(1),
  primaryRoleCode: z.string().min(1),
  office: z.string().min(1),
  weeklyCapacityHours: z.number().positive().max(80),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  isActive: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime().optional()
});

const assignmentCreateSchema = z.object({
  personId: z.string().uuid(),
  projectId: z.string().uuid(),
  roleCode: z.string().min(1),
  allocationPercent: z.number().positive().max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
  expectedUpdatedAt: z.string().datetime().optional()
});

const mappingSchema = z.object({
  sourceSheet: z.string().min(1),
  sourceColumn: z.string().min(1),
  targetTable: z.string().min(1),
  targetField: z.string().min(1),
  transform: z.string().optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional()
});

const utilizationQuerySchema = z.object({
  weekStart: z.string().date()
});

const utilizationTimelineQuerySchema = z.object({
  weekStart: z.string().date(),
  weeks: z.coerce.number().int().min(1).default(12)
});

const lookupEntrySchema = z.object({
  code: z.string().min(1).max(20),
  label: z.string().min(1)
});

const lookupLabelSchema = z.object({
  label: z.string().min(1)
});

const lookupCodeParamSchema = z.object({
  code: z.string().min(1)
});

const pathIdSchema = z.object({
  id: z.string().uuid()
});

const emailParamSchema = z.object({
  email: z.string().email()
});

const updateUserSchema = z
  .object({
    nickname: z.string().min(1).optional(),
    accessLevel: z.enum(["VOYEUR", "DESTROYER", "ADMIN"]).optional(),
    expectedUpdatedAt: z.string().datetime().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update."
  });

const knightDestroyerSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional()
});

const googleSessionSchema = z.object({
  idToken: z.string().min(1)
});

const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional()
});

const liveEditUpsertSchema = z.object({
  key: z.string().trim().min(1).max(180),
  label: z.string().trim().max(120).optional()
});

const liveEditPathSchema = z.object({
  key: z.string().trim().min(1).max(260)
});

const getActor = (req: Request) => (req as AuthedRequest).actor;

export const createRouter = (store: ProjectionStore) => {
  const router = Router();
  const projectService = new ProjectService(store);
  const toProjectResponse = (project: ReturnType<ProjectService["createProject"]>) => {
    const { defaultCapacityHoursPerDay: _omitted, ...settings } = project.settings;
    const milestones = projectService.getMilestoneDates(project);

    return {
      ...project,
      settings,
      ...milestones
    };
  };

  router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  router.get("/api/v1/auth/google/config", (_req: Request, res: Response) => {
    res.status(200).json(getGoogleAuthConfig());
  });

  router.get("/api/v1/auth/session", (req: Request, res: Response) => {
    const actor = resolveSessionActorFromCookie(store, req.header("cookie"));
    res.status(200).json({
      authenticated: Boolean(actor),
      userId: actor?.userId ?? null,
      accessLevel: actor?.accessLevel ?? null
    });
  });

  router.post("/api/v1/auth/google/session", (req: Request, res: Response, next) => {
    const body = googleSessionSchema.parse(req.body);
    createSessionFromGoogleToken(store, body.idToken)
      .then(({ actor, sessionId }) => {
        establishSession(res, sessionId);
        res.status(200).json(projectService.getUserByEmail(actor.userId));
      })
      .catch((error) => next(error));
  });

  router.post("/api/v1/auth/dev-bypass", (_req: Request, res: Response, next) => {
    try {
      const { actor, sessionId } = createDevBypassSession(store);
      establishSession(res, sessionId);
      res.status(200).json(projectService.getUserByEmail(actor.userId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/auth/logout", (req: Request, res: Response) => {
    destroySessionFromRequest(req);
    clearSessionCookie(res);
    res.status(204).send();
  });

  router.get("/api/v1/auth/csrf", (req: Request, res: Response) => {
    const token = getCsrfTokenForRequest(req);
    if (!token) {
      throw badRequest("No active session available for CSRF token.");
    }
    res.status(200).json({ token });
  });

  router.get("/api/v1/users/me", (req: Request, res: Response) => {
    res.status(200).json(projectService.getCurrentUser(getActor(req)));
  });

  router.post("/api/v1/users/me/request-destroyer-access", (req: Request, res: Response) => {
    res.status(200).json(projectService.requestDestroyerAccess(getActor(req)));
  });

  router.get("/api/v1/admin/users", (req: Request, res: Response) => {
    res.status(200).json(projectService.listUsers(getActor(req)));
  });

  router.patch("/api/v1/admin/users/:email", (req: Request, res: Response) => {
    const { email } = emailParamSchema.parse(req.params);
    const body = updateUserSchema.parse(req.body);
    res.status(200).json(projectService.updateUser(getActor(req), email, body));
  });

  router.post("/api/v1/admin/users/:email/knight-destroyer", (req: Request, res: Response) => {
    const { email } = emailParamSchema.parse(req.params);
    const body = knightDestroyerSchema.parse(req.body ?? {});
    res.status(200).json(projectService.knightDestroyer(getActor(req), email, body.expectedUpdatedAt));
  });

  router.get("/api/v1/admin/audit-log", (req: Request, res: Response) => {
    const { limit } = auditLogQuerySchema.parse(req.query);
    res.status(200).json(projectService.listAuditEvents(getActor(req), limit));
  });

  router.get("/api/v1/collab/editing", (req: Request, res: Response) => {
    const actorId = getActor(req).userId;
    res.status(200).json(listLiveEdits(actorId));
  });

  router.post("/api/v1/collab/editing", (req: Request, res: Response) => {
    const body = liveEditUpsertSchema.parse(req.body);
    const actorId = getActor(req).userId;
    const result = upsertLiveEdit(body.key, actorId, body.label);
    res.status(200).json({ key: body.key, conflict: result.conflict });
  });

  router.delete("/api/v1/collab/editing/:key", (req: Request, res: Response) => {
    const { key } = liveEditPathSchema.parse(req.params);
    const decodedKey = decodeURIComponent(key);
    const actorId = getActor(req).userId;
    removeLiveEdit(decodedKey, actorId);

    res.status(204).send();
  });

  router.get("/api/v1/project-templates", (_req: Request, res: Response) => {
    res.status(200).json(projectService.listTemplates());
  });

  router.get("/api/v1/project-templates/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    const template = projectService.getTemplateById(id);
    res.status(200).json(template);
  });

  router.post("/api/v1/project-templates", (req: Request, res: Response) => {
    const body = templateCreateSchema.parse(req.body);
    const created = projectService.createTemplate(getActor(req), body);
    res.status(201).json(created);
  });

  router.patch("/api/v1/project-templates/:id", (req: Request, res: Response) => {
    const body = templateUpdateSchema.parse(req.body);
    const { id } = pathIdSchema.parse(req.params);
    const updated = projectService.updateTemplate(getActor(req), id, body);
    res.status(200).json(updated);
  });

  router.delete("/api/v1/project-templates/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    projectService.deactivateTemplate(getActor(req), id);
    res.status(204).send();
  });

  router.post("/api/v1/project-templates/preview", (req: Request, res: Response) => {
    const body = previewTemplateSchema.parse(req.body);
    const preview = projectService.previewFromTemplate(getActor(req), body.templateId, body.settingsOverride);
    res.status(200).json(preview);
  });

  router.post("/api/v1/projects/copy-settings/preview", (req: Request, res: Response) => {
    const body = previewCopySchema.parse(req.body);
    const preview = projectService.previewFromProject(getActor(req), body.sourceProjectId, body.settingsOverride);
    res.status(200).json(preview);
  });

  router.post("/api/v1/projects", (req: Request, res: Response) => {
    const body = createProjectSchema.parse(req.body);
    const created = projectService.createProject(getActor(req), body);
    res.status(201).json(toProjectResponse(created));
  });

  router.patch("/api/v1/projects/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    const body = updateProjectSchema.parse(req.body);
    const updated = projectService.updateProject(getActor(req), id, body);
    res.status(200).json(toProjectResponse(updated));
  });

  router.post("/api/v1/projects/:id/shift-release", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    const body = shiftProjectReleaseSchema.parse(req.body);
    const result = projectService.shiftProjectReleaseWithAssignments(getActor(req), id, body.weekShift);
    res.status(200).json({
      project: toProjectResponse(result.project),
      shiftedAssignments: result.shiftedAssignments
    });
  });

  router.get("/api/v1/projects", (_req: Request, res: Response) => {
    res.status(200).json(projectService.listProjects().map((project) => toProjectResponse(project)));
  });

  router.get("/api/v1/global-closures", (_req: Request, res: Response) => {
    res.status(200).json(projectService.listGlobalClosures());
  });

  router.post("/api/v1/global-closures", (req: Request, res: Response) => {
    const body = closureCreateSchema.parse(req.body);
    const created = projectService.createGlobalClosure(getActor(req), body);
    res.status(201).json(created);
  });

  router.patch("/api/v1/global-closures/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    const body = closureUpdateSchema.parse(req.body);
    const updated = projectService.updateGlobalClosure(getActor(req), id, body);
    res.status(200).json(updated);
  });

  router.delete("/api/v1/global-closures/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    projectService.deleteGlobalClosure(getActor(req), id);
    res.status(204).send();
  });

  router.get("/api/v1/roles", (_req: Request, res: Response) => {
    res.status(200).json(projectService.listRoles());
  });

  router.post("/api/v1/roles", (req: Request, res: Response) => {
    const body = lookupEntrySchema.parse(req.body);
    const created = projectService.createRole(getActor(req), body);
    res.status(201).json(created);
  });

  router.patch("/api/v1/roles/:code", (req: Request, res: Response) => {
    const { code } = lookupCodeParamSchema.parse(req.params);
    const body = lookupLabelSchema.parse(req.body);
    const updated = projectService.updateRole(getActor(req), code, body);
    res.status(200).json(updated);
  });

  router.delete("/api/v1/roles/:code", (req: Request, res: Response) => {
    const { code } = lookupCodeParamSchema.parse(req.params);
    projectService.deleteRole(getActor(req), code);
    res.status(204).send();
  });

  router.get("/api/v1/offices", (_req: Request, res: Response) => {
    res.status(200).json(projectService.listOffices());
  });

  router.post("/api/v1/offices", (req: Request, res: Response) => {
    const body = lookupEntrySchema.parse(req.body);
    const created = projectService.createOffice(getActor(req), body);
    res.status(201).json(created);
  });

  router.patch("/api/v1/offices/:code", (req: Request, res: Response) => {
    const { code } = lookupCodeParamSchema.parse(req.params);
    const body = lookupLabelSchema.parse(req.body);
    const updated = projectService.updateOffice(getActor(req), code, body);
    res.status(200).json(updated);
  });

  router.delete("/api/v1/offices/:code", (req: Request, res: Response) => {
    const { code } = lookupCodeParamSchema.parse(req.params);
    projectService.deleteOffice(getActor(req), code);
    res.status(204).send();
  });

  router.get("/api/v1/people", (_req: Request, res: Response) => {
    res.status(200).json(projectService.listPeople());
  });

  router.post("/api/v1/people", (req: Request, res: Response) => {
    const body = personCreateSchema.parse(req.body);
    const created = projectService.createPerson(getActor(req), body);
    res.status(201).json(created);
  });

  router.patch("/api/v1/people/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    const body = personCreateSchema.parse(req.body);
    const updated = projectService.updatePerson(getActor(req), id, body);
    res.status(200).json(updated);
  });

  router.delete("/api/v1/people/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    projectService.deletePerson(getActor(req), id);
    res.status(204).send();
  });

  router.get("/api/v1/assignments", (_req: Request, res: Response) => {
    res.status(200).json(projectService.listAssignments());
  });

  router.post("/api/v1/assignments", (req: Request, res: Response) => {
    const body = assignmentCreateSchema.parse(req.body);
    const created = projectService.createAssignment(getActor(req), body);
    res.status(201).json(created);
  });

  router.patch("/api/v1/assignments/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    const body = assignmentCreateSchema.parse(req.body);
    const updated = projectService.updateAssignment(getActor(req), id, body);
    res.status(200).json(updated);
  });

  router.delete("/api/v1/assignments/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    projectService.deleteAssignment(getActor(req), id);
    res.status(204).send();
  });

  router.get("/api/v1/utilization", (req: Request, res: Response) => {
    const query = utilizationQuerySchema.parse(req.query);
    const snapshot = projectService.getUtilizationSnapshot(query.weekStart);
    res.status(200).json(snapshot);
  });

  router.get("/api/v1/utilization/timeline", (req: Request, res: Response) => {
    const query = utilizationTimelineQuerySchema.parse(req.query);
    const timeline = projectService.getUtilizationTimeline(query.weekStart, query.weeks);
    res.status(200).json(timeline);
  });

  router.get("/api/v1/utilization/projects/timeline", (req: Request, res: Response) => {
    const query = utilizationTimelineQuerySchema.parse(req.query);
    const timeline = projectService.getProjectUtilizationTimeline(query.weekStart, query.weeks);
    res.status(200).json(timeline);
  });

  router.get("/api/v1/mappings/meta/tables", (req: Request, res: Response) => {
    const tables = projectService.listDatabaseTables(getActor(req));
    res.status(200).json(tables);
  });

  router.get("/api/v1/mappings", (req: Request, res: Response) => {
    const mappings = projectService.listMappingRules(getActor(req));
    res.status(200).json(mappings);
  });

  router.post("/api/v1/mappings", (req: Request, res: Response) => {
    const body = mappingSchema.parse(req.body);
    const created = projectService.createMappingRule(getActor(req), body);
    res.status(201).json(created);
  });

  router.patch("/api/v1/mappings/:id", (req: Request, res: Response) => {
    const body = mappingSchema.parse(req.body);
    const { id } = pathIdSchema.parse(req.params);
    const updated = projectService.updateMappingRule(getActor(req), id, body);
    res.status(200).json(updated);
  });

  router.delete("/api/v1/mappings/:id", (req: Request, res: Response) => {
    const { id } = pathIdSchema.parse(req.params);
    projectService.deleteMappingRule(getActor(req), id);
    res.status(204).send();
  });

  return router;
};
