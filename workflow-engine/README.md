# Workflow Engine — Halleyx Full Stack Challenge

A dynamic workflow automation system supporting step-based execution, rule-driven branching, approvals, and notifications — with a full-featured single-page UI.

## Demo

[Watch the demo video](https://youtu.be/5X1fLYYtDXM)

---

## Quick Start

### Option A — With MySQL (default)

1. Ensure MySQL is running and accessible at `localhost:3306`
2. Update credentials in `src/main/resources/application.properties` if needed (default: `root`/`root`)
3. Run:
   ```bash
   ./mvnw spring-boot:run
   ```
   Or on Windows:
   ```bat
   mvnw.cmd spring-boot:run
   ```
4. Open `http://localhost:8080`

### Option B — With H2 In-Memory (no MySQL needed)

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

H2 console available at `http://localhost:8080/h2-console`  
(JDBC URL: `jdbc:h2:mem:workflowdb`, user: `sa`, no password)

---

## Dependencies

- Java 17+
- Maven 3.6+ (wrapper included)
- MySQL 8 (or use H2 dev profile above)

---

## Login

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | `admin`  | `admin123`|

**Guests (not logged in)** can only access the **Execute** page.  
**Admin** has access to: Dashboard, Workflows, Execute, and Audit Log.

---

## Features

### Workflow Management (Admin)
- Create, edit, delete, activate/deactivate workflows
- **Form-based input schema editor** — define fields with type, required flag, and allowed values — no manual JSON editing required
- Version tracking on each update

### Step Management (Admin)
- Add/remove steps per workflow: `approval`, `notification`, `task`
- Steps execute in order, redirected by rules

### Rule Engine
- Rules evaluate in priority order (lowest number first)
- Supports: `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `contains()`, `startsWith()`, `endsWith()`
- `DEFAULT` rule acts as catch-all fallback
- Correct operator precedence: `||` < `&&` < comparisons
- Numbers are parsed from input and compared numerically

### Workflow Execution
- Input fields generated from the workflow's schema (with dropdowns for allowed values)
- Input data type-coerced properly: numbers stay numbers (fixes rule comparisons)
- Step progress visualised with green/red signals
- Full execution log with rule-by-rule results

### Audit Log (Admin only)
- Full history of all executions with status, timestamps, triggered-by
- View detailed logs for any execution
- Cancel in-progress or retry failed executions

---

## Sample Workflows (auto-seeded on first run)

### 1. Expense Approval
**Input fields:** `amount` (number), `country` (string), `department` (string), `priority` (High/Medium/Low)

| Step | Rules |
|------|-------|
| Manager Approval | `amount >= 100` → Finance Notification; `amount < 100` → CEO Approval; `DEFAULT` → Task Rejection |
| Finance Notification | `amount >= 100` → CEO Approval; `DEFAULT` → CEO Approval |
| CEO Approval | `DEFAULT` → END |
| Task Rejection | `DEFAULT` → END |

**Sample execution:** `amount=250, country=US, department=Finance, priority=High`  
→ Manager Approval → Finance Notification → CEO Approval → END ✅

### 2. Employee Onboarding
**Input fields:** `employee_id` (string), `department` (string), `salary` (number)

| Step | Rules |
|------|-------|
| HR Review | `salary >= 50000` → IT Setup; `DEFAULT` → IT Setup |
| IT Setup Notification | `DEFAULT` → END |

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | `{"username":"admin","password":"admin123"}` |

### Workflows
| Method | Endpoint |
|--------|----------|
| GET | `/api/workflows?page=0&size=10&search=` |
| POST | `/api/workflows` |
| GET | `/api/workflows/:id` |
| PUT | `/api/workflows/:id` |
| DELETE | `/api/workflows/:id` |
| PATCH | `/api/workflows/:id/toggle` |

### Steps
| Method | Endpoint |
|--------|----------|
| GET/POST | `/api/workflows/:wfId/steps` |
| PUT/DELETE | `/api/steps/:id` |

### Rules
| Method | Endpoint |
|--------|----------|
| GET/POST | `/api/steps/:stepId/rules` |
| PUT/DELETE | `/api/rules/:id` |

### Execution
| Method | Endpoint |
|--------|----------|
| POST | `/api/workflows/:wfId/execute` — body: `{"data":{...},"triggeredBy":"user"}` |
| GET | `/api/executions/:id` |
| GET | `/api/executions?page=0&size=15` |
| POST | `/api/executions/:id/cancel` |
| POST | `/api/executions/:id/retry` |

---

## Architecture

```
Frontend (Vanilla JS SPA)
    └── /static/index.html + js/app.js + css/style.css

Backend (Spring Boot 3 / Java 17)
    ├── WorkflowController   — REST API layer
    ├── WorkflowService      — Business logic + execution engine
    ├── RuleEngine           — Dynamic expression evaluator
    ├── DataSeeder           — Seeds 2 sample workflows on first run
    └── Models: Workflow, Step, Rule, Execution

Database
    └── MySQL (or H2 in-memory for dev)
        Tables: workflows, steps, rules, executions
```

---

## Fixes Applied (v1.1)

1. **Input Schema** — Replaced raw JSON textarea with a form-based field editor. Users add fields by name, type, required flag, and allowed values. JSON is built automatically.
2. **Guest Access** — Unauthenticated users see only the Execute page. Admin Login button shown in sidebar.
3. **Audit Log** — Hidden from guests; only visible to admin.
4. **Rule Evaluation Bug** — Fixed operator precedence (`||` < `&&`) and number parsing so `amount >= 100` works correctly when amount is typed as `250`.
5. **Type Coercion** — Execution input values are coerced to their declared types (number, boolean, string) before being sent to the engine.
6. **Backend Data Unwrap** — Execute endpoint now correctly handles both `{"data":{...}}` and flat `{...}` body formats.
7. **Null Safety** — `createWorkflow` and `updateWorkflow` handle null `isActive` and null/blank `inputSchema` gracefully.
8. **Comparison Operators** — Fixed `<=` / `>=` vs `<` / `>` detection order to avoid false matches.


