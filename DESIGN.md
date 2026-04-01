# Projection Project Management Application

## 1. Document Purpose
This document defines the product and system architecture for an internal project management application focused on:
- Time planning visibility
- Resource management and allocation
- Current project status transparency

It is intended to be the implementation blueprint for MVP delivery.

## 2. Product Vision
Provide a shared, trustworthy view of project plans, resource capacity, and execution status for a team of approximately 10 project owners, while allowing broader read-only visibility for stakeholders.

## 3. Scope
### 3.1 MVP In Scope
- Project and task creation
- Task assignment and due dates
- Gantt timeline with task dependencies (finish-to-start)
- Resource capacity planning (hours/day)
- Vacation/absence calendar impact on capacity
- Comments and collaboration on tasks
- Notifications
- Reporting/dashboard with emphasis on resource utilization
- Read-only stakeholder visibility
- Role-based and project-level permissions
- SSO authentication (Microsoft Entra ID and Google SSO)
- Excel import for initial migration
- EU-hosted deployment
- GDPR-aligned handling

### 3.2 Out of Scope for MVP
- Native mobile apps
- Budget/financial planning engine
- Advanced predictive analytics/forecasting
- External client portal (unless later prioritized)
- Deep third-party integrations (undecided)

## 4. Success Criteria
Primary success criterion (from business):
- The organization can confidently determine who has free capacity to join a project starting in one month.

Measurable MVP outcomes (proposed):
- Capacity forecast accuracy accepted by project owners for 4-week lookahead.
- At least 90% of active projects represented with current schedule and allocations.
- Stakeholders can self-serve read-only status without manual data consolidation.

## 5. Users and Roles
### 5.1 User Personas
- Project Owner: creates and manages projects, plans tasks, allocates resources.
- Team Member: receives assignments, updates progress, comments.
- Stakeholder (Read-only): views timelines, capacity status, and reporting.
- System Admin: manages users, access, system settings.

### 5.2 Access Model
- Role-based access control (RBAC): Admin, Project Owner, Member, Viewer.
- Project-level permissions layered on top of role.
- Read-only role for cross-functional stakeholders.

## 6. Functional Requirements
### FR-1 Project and Task Management
- Create, edit, archive projects.
- Support project creation from predefined templates with default project settings.
- Support project creation by copying base settings from an existing project the user can access.
- Create, edit, reorder tasks with owners, due dates, status.
- Track completion state and basic progress.

Project creation behavior in MVP:
- A project template may include default metadata, capacity assumptions, role defaults, and notification defaults.
- Copy-from-existing includes project-level settings only, and excludes task records, comments, notifications history, and audit logs.
- Users can review and adjust copied/template values before final creation.
- Only users with permission to create projects can use template or copy flows.

### FR-1A Create Project UI Flow
Entry point:
- From Projects view, users with Create Project permission can open a Create Project dialog.

Step 1: Choose setup mode
- Start blank
- Use template
- Copy settings from existing project

Step 2: Configure base settings
- Common fields: project name, description, start date, target end date, default capacity profile, and default notification rules.
- If Use template is selected: user selects a template and the form pre-populates with template defaults.
- If Copy settings is selected: user selects a source project from projects they can view, and the form pre-populates with copied project-level settings.
- Users can modify pre-populated values before submit.

Step 3: Review and create
- Show a compact summary of selected source (template or project) and final values.
- On submit, system creates a new project with a new identity and ownership context.

Validation and guardrails:
- Project name is required and must be unique within active projects.
- Source project list for copy excludes archived or deleted projects.
- Copy operation does not include tasks, dependencies, comments, notifications history, attachments, or audit logs.
- If source/template has settings the user cannot apply, block with explicit validation message and highlight impacted fields.

Permission behavior:
- Only users with Create Project capability can access the dialog and submit.
- Template management (create/edit/delete templates) is admin-only in MVP.

### FR-1B Create Project Dialog Wireframe (Text Mockup)
Desktop layout (modal, approximately 720-820px wide):

```text
+--------------------------------------------------------------------+
| Create Project                                                     |
| Set up a new project from scratch, a template, or copied settings. |
+--------------------------------------------------------------------+
| Setup Mode                                                         |
| ( ) Start blank   ( ) Use template   ( ) Copy from existing        |
|                                                                    |
| If Use template: [Template dropdown v] [Preview defaults]          |
| If Copy from existing: [Project dropdown v] [View source summary]  |
|                                                                    |
| Project Details                                                    |
| Name*               [___________________________________________]  |
| Description         [___________________________________________]  |
| Start Date*         [  YYYY-MM-DD  ]   Target End Date [YYYY-MM-DD]|
| Default Capacity    [8.0 hrs/day v]   Notification Profile [v]     |
|                                                                    |
| Review Summary                                                    |
| Source: Template - "Standard Internal Project"                    |
| Included: metadata, defaults, capacity profile, notification rules |
| Excluded: tasks, dependencies, comments, audit history             |
|                                                                    |
| [Cancel]                                         [Create Project]   |
+--------------------------------------------------------------------+
```

Mobile layout (full-screen sheet):

```text
Create Project
[Setup Mode segmented control]

1) Source
- Template or Project selector

2) Details
- Name*
- Description
- Start Date*
- Target End Date
- Default Capacity
- Notification Profile

3) Review
- Included / Excluded summary

[Create Project] (sticky footer button)
```

Interaction notes:
- Disable Create Project until required fields are valid.
- Changing setup mode prompts before clearing pre-populated fields.
- Show inline validation under each invalid field and a top-level error summary for submit failures.
- For copy mode, source selector supports search by project name.
- For template mode, show "last updated" metadata to help users trust defaults.

### FR-2 Timeline and Dependencies
- Gantt-style timeline for project tasks.
- Support finish-to-start task dependencies.
- Highlight dependency conflicts and schedule slippage.

### FR-3 Resource Capacity Planning
- Maintain per-person nominal capacity (hours/day).
- Model allocation per task over time windows.
- Include vacation/absence calendars to reduce available capacity.
- Show over-allocation and underutilization indicators.

### FR-4 Collaboration and Notifications
- Task comments and mentions.
- In-app notifications for assignment, due-date risk, dependency blocking, and mentions.

### FR-5 Reporting and Dashboard
- Core KPI in MVP: resource utilization.
- Supporting widgets: upcoming overloaded resources, timeline risk hotspots, overdue tasks.

### FR-6 Authentication and Identity
- SSO via Microsoft Entra ID and Google SSO.
- Internal user provisioning mapped to SSO identity.

### FR-7 Data Import
- Import projects/tasks/resources from Excel templates.
- Validate and report row-level import errors.

## 7. Non-Functional Requirements
### NFR-1 Performance
- Target scale: up to 100 users and fewer than 1,000 projects.
- Typical dashboard/timeline loads should feel near-interactive (target under 2 seconds for common views under normal load).

### NFR-2 Availability and Reliability
- Business-hours reliability expected.
- Daily backups with restore procedure.

### NFR-3 Security and Privacy
- EU data residency.
- GDPR-aware controls: data minimization, retention policy, export/deletion process.
- Audit logging for security-relevant actions and access changes.

### NFR-4 Maintainability
- Modular backend services with clear domain boundaries.
- API-first contracts and testable business logic.

## 8. Proposed Architecture
### 8.1 High-Level Style
- Modular monolith for MVP (single deployable backend with separated domain modules).
- Web SPA frontend + REST API backend.
- Relational database for transactional integrity and reporting queries.
- Event hooks internally for notifications and audit trail generation.

Rationale:
- Fastest path for 5-person team and ASAP timeline.
- Lower operational complexity than microservices.
- Clean upgrade path to service decomposition if scale grows.

### 8.2 Logical Components
- Frontend Web App
- API Layer
- Domain Modules:
  - Identity and Access
  - Project and Task Planning
  - Scheduling and Dependency Engine
  - Resource Capacity Engine
  - Comments and Notifications
  - Reporting
  - Import/Export
- Infrastructure Adapters:
  - SSO providers (Entra ID, Google)
  - Email or messaging provider (if notifications require external delivery)
- Data Stores:
  - PostgreSQL (primary)
  - Optional Redis cache for session/query acceleration

### 8.3 Deployment Topology (Azure, EU)
- Frontend: static web hosting or app service in EU region.
- Backend: containerized app service or Azure Container Apps in EU region.
- Database: Azure Database for PostgreSQL in EU region.
- Object storage (optional for import files): Azure Blob in EU region.
- Monitoring: centralized application logs and metrics.

## 9. Data Model (Conceptual)
Core entities:
- User
- Role
- Project
- ProjectMembership
- Task
- TaskDependency
- ResourceAllocation
- CapacityProfile
- Absence
- Comment
- Notification
- AuditLog
- ImportJob

Key relationships:
- Project has many Tasks.
- Task can depend on many Tasks via TaskDependency.
- Task has assigned User and many ResourceAllocations.
- User has CapacityProfile and many Absences.
- ProjectMembership binds User to Project with role/permission scope.

## 10. API Surface (MVP)
Representative endpoint groups:
- /auth/* (SSO callback/session)
- /users/*
- /projects/*
- /project-templates/*
- /projects/{id}/copy-settings
- /projects/{id}/tasks/*
- /tasks/{id}/dependencies/*
- /resources/capacity/*
- /resources/allocations/*
- /reports/utilization
- /comments/*
- /notifications/*
- /imports/excel/*

API design principles:
- Versioned endpoints (for example, /api/v1).
- Consistent pagination/filtering.
- Explicit permission checks per route.

## 11. Scheduling and Capacity Logic
MVP algorithm behavior:
- Available capacity per user/day = nominal capacity - absence hours.
- Planned load per user/day = sum of task allocations.
- Utilization ratio per user/day = planned load / available capacity.
- Overload when ratio exceeds 1.0.
- 4-week lookahead view for staffing decisions.

Dependency behavior:
- Finish-to-start constraint enforced in timeline calculations.
- Changes to predecessor end date trigger downstream schedule recalculation.

## 12. Security and Compliance Controls
- SSO tokens validated server-side.
- Least-privilege authorization checks at API and query level.
- Audit logs for:
  - Permission changes
  - Project membership changes
  - Critical plan changes (dates, allocations, dependencies)
- Audit logs retained for 90 days.
- Deleted project data is soft-deleted and retained until manually purged by an administrator.
- Data retention policy and subject-access/deletion operational procedures for GDPR.

## 13. Reporting Strategy
MVP reporting artifacts:
- Resource utilization dashboard (primary KPI)
- Over-allocation heatmap by week
- Capacity availability for next 4 weeks
- Project timeline risk list

Data approach:
- Start with transactional queries + indexed views/materialized queries if needed.
- Introduce analytical replica only after proven need.

## 14. Delivery Plan
### Phase 0: Foundations (Week 1-2)
- Repo setup, CI/CD, environment setup
- SSO integration baseline
- RBAC and project-level permission skeleton
- Core data schema

### Phase 1: Planning Core (Week 3-5)
- Projects/tasks CRUD
- Gantt timeline basic rendering
- Dependency management

### Phase 2: Capacity Engine (Week 6-8)
- Capacity profiles and absences
- Allocations and utilization calculations
- Overload indicators

### Phase 3: Collaboration and Reporting (Week 9-10)
- Comments/mentions
- Notifications
- Utilization dashboard and risk widgets

### Phase 4: Import and Hardening (Week 11-12)
- Excel import
- Audit logging
- Security, performance, and UAT hardening

## 15. Testing Strategy
- Unit tests for scheduling and capacity calculations.
- Integration tests for permissions and API contracts.
- End-to-end tests for critical workflows:
  - Plan project with dependencies
  - Allocate resources and detect overload
  - Stakeholder read-only access
  - Excel import happy-path and invalid-row handling

## 16. Risks and Mitigations
- Risk: Timeline complexity becomes too high for MVP.
  - Mitigation: Keep dependency model limited to finish-to-start only in MVP.
- Risk: Data quality issues in initial import.
  - Mitigation: Strict template and validation report with retry.
- Risk: Notification channels unclear.
  - Mitigation: MVP uses in-app notifications only; email or Teams can be added later if adoption requires them.

## 17. Resolved Product Decisions
- Notification channels for MVP: in-app only.
- Team Member permissions: Team Members may update status, comments, effort, and progress fields, but may not edit task dates or dependencies.
- Audit log retention: 90 days.
- Deleted data retention: project data is soft-deleted and retained until manual purge by an administrator.

Implementation implications:
- Notification delivery is limited to the product notification center in MVP, which reduces integration complexity and operational dependencies.
- Schedule integrity remains controlled by Project Owners, while Team Members can still provide execution updates needed for progress tracking.
- Audit storage sizing can be based on a 90-day rolling window.
- Soft delete requires recoverable delete state, admin restore/purge tools, and exclusion of deleted records from normal application queries.

## 18. Recommended Tech Stack (No user constraints provided)
- Frontend: React + TypeScript
- Backend: Node.js (NestJS or Express with modular architecture) + TypeScript
- Database: PostgreSQL
- Auth: OpenID Connect/OAuth2 via Entra ID and Google
- Infra: Azure (EU region)
- CI/CD: GitHub Actions

This stack balances delivery speed, maintainability, and strong ecosystem support for scheduling-heavy internal apps.

## 19. Role and Permission Matrix
Authorization model:
- System Admin is a global role.
- Project Owner, Team Member, and Stakeholder are project-scoped roles via ProjectMembership.
- A user may hold different project-scoped roles in different projects.
- If a user has multiple effective roles in the same project, the highest applicable permission wins.

### 19.1 Permission Definitions
- View: can see the data in the UI and API responses.
- Edit execution: can update status, comments, effort, progress, and personal task execution fields.
- Edit plan: can update dates, dependencies, allocations, and project planning structure.
- Administer: can manage users, roles, global settings, retention operations, and restore/purge deleted data.

### 19.2 Matrix
| Capability | System Admin | Project Owner | Team Member | Stakeholder |
| --- | --- | --- | --- | --- |
| Sign in via SSO | Yes | Yes | Yes | Yes |
| View assigned projects | Yes | Yes | Yes | Yes |
| View all projects | Yes | No | No | No |
| Create project | Yes | Yes | No | No |
| Edit project metadata | Yes | Yes | No | No |
| Archive project | Yes | Yes | No | No |
| Delete/soft-delete project | Yes | Yes | No | No |
| Restore soft-deleted project | Yes | No | No | No |
| Permanently purge deleted project | Yes | No | No | No |
| Manage project membership | Yes | Yes | No | No |
| Assign project roles | Yes | Yes | No | No |
| Create tasks | Yes | Yes | No | No |
| Edit task title/description | Yes | Yes | No | No |
| Edit task dates | Yes | Yes | No | No |
| Edit task dependencies | Yes | Yes | No | No |
| Assign task owner | Yes | Yes | No | No |
| Update task status | Yes | Yes | Yes | No |
| Update task progress | Yes | Yes | Yes | No |
| Update task effort fields | Yes | Yes | Yes | No |
| Comment on tasks | Yes | Yes | Yes | No |
| Mention users in comments | Yes | Yes | Yes | No |
| View comments | Yes | Yes | Yes | Yes |
| Manage resource allocations | Yes | Yes | No | No |
| View utilization dashboards | Yes | Yes | Yes | Yes |
| View capacity availability | Yes | Yes | Yes | Yes |
| View audit logs | Yes | No | No | No |
| Manage absence calendars | Yes | Yes | No | No |
| Submit own absence request/data | Yes | Yes | Yes | No |
| Import Excel data | Yes | Yes | No | No |
| Configure notification rules | Yes | No | No | No |
| Receive in-app notifications | Yes | Yes | Yes | Yes |
| Manage global settings | Yes | No | No | No |

### 19.3 Rules and Constraints
- Team Members cannot change planned start date, planned end date, dependencies, or resource allocations.
- Stakeholders are strictly read-only in MVP and do not create comments.
- Project Owners can act only within projects where they hold Project Owner membership.
- System Admin can access all projects, all audit logs, and all deleted-record administration functions.
- Changes to dates, dependencies, allocations, project membership, and deletes must generate audit log entries.

### 19.4 API Enforcement Guidance
- Enforce authorization in both route guards and domain services.
- Filter query results at the database/query layer so users only see permitted projects.
- Do not rely on frontend role checks for security.
- Use explicit capability checks such as `canEditPlan`, `canEditExecution`, and `canAdministerProject` in backend code.

### 19.5 Testing Implications
- Add integration tests for each role against project read, task update, planning update, allocation update, and import endpoints.
- Add negative tests to verify Team Members cannot modify dates/dependencies and Stakeholders cannot comment.
- Add admin-only tests for audit log access, restore, and purge operations.
