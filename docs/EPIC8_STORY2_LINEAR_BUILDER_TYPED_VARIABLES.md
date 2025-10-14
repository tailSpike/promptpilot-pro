# EPIC 8 – Story 2: Typed Variables & Step Output Binding (Linear Builder V2)

## Goal
Enable authors to define Additional variables with explicit data types (string, number, boolean) and allow binding to prior step outputs in the Linear Builder V2 while maintaining lean E2E coverage (Testing Trophy alignment).

## Acceptance Criteria

Behavior:
- [ ] Data Inspector variable rows show a Type select (string | number | boolean) defaulting to string.
- [ ] Changing type does not clear key/value but updates parsing rules for value.
- [ ] Boolean type provides a dropdown (true/false) or auto-coerces common literals (true,false,1,0,yes,no) when user types.
- [ ] Number type rejects non-numeric entry (inline validation) and disables Save until corrected.
- [ ] Step output variables appear in Variable Inspector after a Preview run as read-only bindable entries (e.g., step.1.output.text).
- [ ] User can click a step output variable to bind it to a prompt field (same mechanism as existing variables).
 - [ ] Output binding uses stable step-id based variable names: step.<stepId>.output.text (UI may also show step order like #1 for clarity).
 - [ ] Inserting an output variable when the prompt field is focused injects a mustache token {{step.<stepId>.output.text}} at the cursor; if field empty and user chooses "Bind" mode, it can set the step's binding instead (mirrors existing variable binding logic).
 - [ ] Reordering steps does NOT break existing output variable references because they rely on stepId (not order). Displayed label updates to reflect new order (#n) but variable token remains unchanged.
 - [ ] If a bound output variable refers to a step that now appears AFTER the consuming step (invalid forward reference), an inline warning appears and Save is disabled until ordering is corrected or reference removed.

Persistence / Reload:
- [ ] Typed variables persist on Save; type and parsed defaultValue hydrate correctly after redirect.
- [ ] Deleted typed variables are removed after Save + reload.
- [ ] Idempotent Save: re-saving without changes does not duplicate variables or step output bindings.

Validation / Errors:
- [ ] Number type invalid input surfaces inline error and blocks Save.
- [ ] Reserved key "input" still rejected for Additional variables.
- [ ] Duplicate key logic unchanged and enforced across all types.

Flags / Access:
- [ ] Feature still gated behind builder.v2.linear flag.

Testing (Testing Trophy):
- Unit:
  - [ ] parseVariableValue: correct coercion for string/number/boolean; invalid number -> error.
  - [ ] buildStepOutputVariableList: generates correct variable names from steps/timeline.
  - [ ] resolveOutputReference: returns '' (empty string) for forward references or missing outputs; returns text for existing outputs.
  - [ ] duplicate detection unchanged with mixed types.
- Component / Integration:
  - [ ] Rendering typed select; switching types preserves key.
  - [ ] Boolean quick toggle / selection works.
  - [ ] Number invalid state blocks Save and shows inline error.
- E2E (one per AC cluster):
  - [ ] Create workflow with string + number + boolean variable; Save; reload; hydration matches types (string value preserved, number stored as number, boolean as boolean).
  - [ ] Bind prompt field to a step output (after Preview), Save, reload, binding persists.
  - [ ] Reorder steps to create a forward reference -> warning shown & Save disabled; restore valid order -> warning cleared & Save enabled.
  - [ ] Delete a typed variable, Save, reload – variable absent.

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
