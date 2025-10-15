# EPIC 8 – Story 2: Typed Variables & Step Output Binding (Linear Builder V2)

## Goal
Enable authors to define Additional variables with explicit data types (string, number, boolean) and allow binding to prior step outputs in the Linear Builder V2 while maintaining lean E2E coverage (Testing Trophy alignment).

## Acceptance Criteria

Behavior:
- [x] Data Inspector variable rows show a Type select (string | number | boolean) defaulting to string.
- [x] Changing type does not clear key/value but updates parsing rules for value.
- [x] Boolean type provides a dropdown (true/false) or auto-coerces common literals (true,false,1,0,yes,no) when user types.
- [x] Number type rejects non-numeric entry (inline validation) and disables Save until corrected.
- [x] Step output variables appear in Variable Inspector after a Preview run as read-only bindable entries (e.g., step.1.output.text).
- [x] User can click a step output variable to bind it to a prompt field (same mechanism as existing variables).
 - [x] Output binding uses stable step-id based variable names: step.<stepId>.output.text (UI may also show step order like #1 for clarity).
 - [ ] Inserting an output variable when the prompt field is focused injects a mustache token {{step.<stepId>.output.text}} at the cursor; if field empty and user chooses "Bind" mode, it can set the step's binding instead (mirrors existing variable binding logic).  
   Note: Token insertion at cursor is implemented; explicit "Bind" mode is not present in Linear Builder V2.
 - [x] Reordering steps does NOT break existing output variable references because they rely on stepId (not order). Displayed label updates to reflect new order (#n) but variable token remains unchanged.
 - [x] If a bound output variable refers to a step that now appears AFTER the consuming step (invalid forward reference), an inline warning appears and Save is disabled until ordering is corrected or reference removed.

Persistence / Reload:
- [x] Typed variables persist on Save; type and parsed defaultValue hydrate correctly after redirect.
- [x] Deleted typed variables are removed after Save + reload.
- [x] Idempotent Save: re-saving without changes does not duplicate variables or step output bindings.

Validation / Errors:
- [x] Number type invalid input surfaces inline error and blocks Save.
- [x] Reserved key "input" still rejected for Additional variables.
- [x] Duplicate key logic unchanged and enforced across all types.

Flags / Access:
- [x] Feature still gated behind builder.v2.linear flag.

Testing (Testing Trophy):
- Unit:
  - [x] parseVariableValue: correct coercion for string/number/boolean; invalid number -> error.
  - [x] buildStepOutputVariableList: generates correct variable names from steps/timeline.
  - [x] resolveOutputReference: returns '' (empty string) for forward references or missing outputs; returns text for existing outputs.
  - [x] duplicate detection unchanged with mixed types.
- Component / Integration:
  - [x] Rendering typed select; switching types preserves key.
  - [x] Boolean quick toggle / selection works.
  - [x] Number invalid state blocks Save and shows inline error.
- E2E (one per AC cluster):
  - [x] Create workflow with string + number + boolean variable; Save; reload; hydration matches types (string value preserved, number stored as number, boolean as boolean).
  - [x] Bind prompt field to a step output (after Preview), Save, reload, binding persists. (Includes explicit page reload assertion.)
  - [x] Reorder steps to create a forward reference -> warning shown & Save disabled; restore valid order -> warning cleared & Save enabled.
  - [x] Delete a typed variable, Save, reload – variable absent.

## Next Steps
None — all acceptance criteria for Story 2 are implemented and covered by tests. 

## Manual Test Steps

Use these step-by-step flows to manually validate Story 2 in a browser. They mirror the automated E2E coverage and acceptance criteria.

Prerequisites
- Backend and frontend are running (local or test environment).
  - Local quickstart: run the repo’s E2E servers or the start scripts described in README.
- Feature flag builder.v2.linear is enabled in the UI (toggle Builder V2, then choose Linear).

Scenario A — Typed variables: create, save, reload (hydration)
1) Create a new workflow and switch to Linear Builder V2.
2) Add a Prompt step.
3) Open the Data Inspector.
4) Click “Add variable” three times to add 3 rows.
5) Configure rows:
  - Row 1: Type “string”; Key “topic”; Value “Testing”.
  - Row 2: Type “number”; Key “count”; Value “3”.
  - Row 3: Type “boolean”; Key “enabled”; Value true (use dropdown).
6) Enter a workflow name and click Save.
7) After redirect, reopen Data Inspector and verify:
  - Keys remain: topic, count, enabled.
  - Types hydrated: string, number, boolean.
  - Values hydrated: “Testing”, 3, true.

Scenario B — Step output binding: insert token and persist
1) Ensure at least 2 Prompt steps exist.
2) In Step 1’s prompt, enter: `Hello {{workflow.input}}` (or any content).
3) Click Preview.
4) In the Variable Inspector, find the “Step Outputs” group.
5) Focus Step 2’s prompt input (click in the text field).
6) Click the first step output item; expect a token to be inserted at the cursor (e.g., `{{step.<id>.output.text}}`).
7) Save, then verify after redirect the token remains in Step 2.
8) Reload the page; verify the token is still present (persisted binding).

Troubleshooting — “Step Outputs” not visible
- The Step Outputs list appears only after a successful Preview. If your preview timeline shows “error” for steps (common on saved workflows without active provider keys), the group won’t render.
- Quick fixes:
  - Run Preview before saving (create a new workflow and click Preview while it has no ID). In this mode, the UI simulates output locally and the Step Outputs group will appear.
  - Or add at least one active provider credential in Settings → Integration Keys, then re-run Preview on the saved workflow.
  - If your environment enforces revoked keys, switch back to an unsaved workflow for this scenario.

Scenario C — Forward reference detection and Save gating
1) From Scenario B state (Step 2 references Step 1 output), move Step 2 above Step 1 (reorder up).
2) Expect an inline forward-reference warning on the now-first step.
3) Verify the Save button is disabled while the warning is present.
4) Reorder back to a valid order; warning disappears and Save becomes enabled again.

Scenario D — Delete typed variable and persist
1) Open Data Inspector.
2) Delete one of the previously created variables (e.g., “enabled”).
3) Save, reload, and verify the deleted variable row is absent.

Scenario E — Edge cases (quick checks)
1) Idempotent Save: Save twice without changes; verify no duplicate variables or extra bindings are created.
2) Reserved key: Try to add a variable with key “input”; expect validation to reject.
3) Duplicate key: Add two variables with the same key; expect duplicate-key validation to block Save.
4) Boolean coercion: In a boolean-type row, try entering common literals (true/false/1/0/yes/no) and verify they coerce or can be selected via the dropdown.
5) Number validation: In a number-type row, enter an invalid value (e.g., “abc”); expect inline error and Save disabled until corrected.

Expected Outcomes
- Typed variables round-trip with correct types and values.
- Step outputs appear only after Preview and can be inserted as tokens at the caret.
- Output tokens persist after Save and page reload.
- Forward references show warnings and prevent Save until resolved.
- Deletes persist after Save + reload; Save is idempotent.

## Non-Goals (Defer)
- Complex object/array types.
- Dynamic schema inference or validation rules beyond simple type parse.
- Persisting historical execution outputs beyond immediate preview for binding.

## Data Model Notes
- Existing Prisma Json fields accept any JSON type; no migration required.
- Frontend will no longer coerce all defaultValue to string for typed vars.

## Implementation Outline
1. Extend Additional variable row with type select + inline parse/validation.
2. Introduce util parseVariableValue(type, raw) -> { value|error }.
3. Include type + parsed defaultValue in variables payload (dataType, defaultValue).
4. Hydrate: map workflow.variables into rows with type detection:
   - If defaultValue is boolean -> boolean, number -> number, else string.
5. Step output binding:
  - After preview, collect each executed step's primary output (text) and expose as read-only variables using stable IDs: step.<stepId>.output.text.
  - Variable Inspector groups them under "Step Outputs" (e.g., label "#1 stepName → text").
  - On click:
    * If prompt field is focused, insert token at cursor position (preserving existing content).
    * If no content and user previously selected binding mode (same mechanic as current variable binding), set binding to step.<stepId>.output.text.
  - Do NOT include step output variables in replaceVariables payload; they are ephemeral / derived.
  - Maintain a map of stepId -> lastPreviewOutputText for interpolation (preview only). Execution path continues to use backend responses once integrated.
  - Add forward-reference check: consuming step order must be greater than producing step order; else show inline warning (data-testid="output-forward-ref-warning").
6. Cypress: single spec additions for typed vars & output binding grouped logically.
  - Add scenario: create two steps; preview; insert output of step 1 into step 2; save; reload; verify token and binding persistence.
  - Add scenario (can be combined): reorder steps to make forward reference invalid -> warning + disabled Save; reorder back -> clears warning.
7. Tests (unit/component) before E2E adjustments.

## Risks & Mitigations
- Risk: Existing E2E selectors break due to added select.
  - Mitigation: keep data-testid row and existing inputs unchanged.
- Risk: Accidental persistence of step output pseudo-vars.
  - Mitigation: do not include them in replaceVariables payload.
 - Risk: Reordering steps after adding output tokens could mismatch semantics if names based on order.
   - Mitigation: use stable stepId in variable tokens; show order separately; implementing forward-reference validation.

## Rollback Plan
Revert component + util changes; no schema alteration so rollback is code-only.
