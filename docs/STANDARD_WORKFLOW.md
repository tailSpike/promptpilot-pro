**Refined Workflow incorporating TDD (Acceptance -> Unit -> Implement):**

1.  **Identify Next Story:** Identify the highest-priority, unstarted user story in our backlog. If there's any ambiguity, please confirm with me.
2.  **Branch Creation:** Create a new development branch from `main` (or our designated integration branch) using a descriptive naming convention (e.g., `feature/story-id-short-description`).
    *   **Action:** `git checkout main && git pull && git checkout -b feature/story-id-short-description`

3.  **Define Acceptance (E2E) Tests:**
    *   **Cypress UI Acceptance Testing:** **Before writing any production code**, write end-to-end Cypress UI acceptance tests that directly validate **every acceptance criterion** from the user story. These tests should initially fail, as the functionality doesn't exist yet. This step defines *what* needs to be built from the user's perspective. Ensure these tests are committed as failing tests.

4.  **Implement Functionality (TDD Cycle: Unit Tests -> Code -> Pass):**
    *   For each failing Cypress acceptance test or a logical chunk of the acceptance criteria:
        *   **Unit Testing:** Write comprehensive unit tests for the specific components or modules that will be needed to satisfy the current acceptance test or criterion. These unit tests should also initially fail.
        *   **Implement Core Functionality:** Write the minimal amount of production code required to make the newly written unit tests pass.
        *   **Refactor:** Refactor the code as needed, ensuring unit tests remain passing.
        *   **Repeat:** Continue this cycle (write failing unit test -> write code -> pass unit test -> refactor) until all unit tests related to the current acceptance test are passing.
    *   Once all related unit tests are passing, re-run the Cypress acceptance test. It should now pass. If not, repeat the TDD cycle, drilling down further with unit tests as necessary to address the failing acceptance test.
    *   Ensure that **every acceptance criterion** defined for the story is fully met and verifiable by passing Cypress tests.
    *   Adhere to our established coding standards and best practices.

5.  **Manual Test Cases & Verification Instructions:**
    *   **Generate Manual Test Cases from E2E Tests:** Since the Cypress tests directly validate the acceptance criteria, the manual test cases should largely mirror the steps outlined in the successful Cypress tests.
    *   **Create a clear set of manual test cases (step-by-step instructions)** for me to follow to verify that the implemented functionality meets all acceptance criteria. These should essentially be the human-executable version of your Cypress tests.
    *   **Provide explicit instructions on how to run the application locally** (e.g., `npm start`, `docker-compose up`, specific environment variables needed).
    *   These manual test cases and run instructions should be included in the Pull Request description (or linked from it).

6.  **Update Documentation:**
    *   **Update any relevant documentation, including the project's `README.md` file, to reflect changes introduced by this story.** This could include new configuration, setup steps, API endpoints, or usage instructions.

7.  **Local Verification:**
    *   Before committing, run all relevant local tests (unit and Cypress) and confirm documentation updates are accurate. Also, locally follow the manual test cases (which should be derived from the passing Cypress tests) to ensure they are accurate and the functionality works as expected.

8.  **Commit and Push:**
    *   Commit your changes with clear, descriptive commit messages, ideally linking commits to the specific acceptance criteria or unit tests they satisfy.
    *   Push your new branch and commits to the remote repository.

9.  **Open Pull Request (PR):**
    *   Open a new pull request targeting the `main` (or designated integration) branch.
    *   **Populate the PR description with a useful and descriptive message detailing the work that was done.** This should include:
        *   A link to the user story/ticket.
        *   A clear summary of the implemented functionality.
        *   A list of the acceptance criteria covered (and links to the passing Cypress tests that validate them).
        *   Any significant architectural or design decisions made.
        *   Mention of updated documentation.
        *   **The detailed manual test cases and instructions on how to run the app for verification (emphasizing they align with the e2e tests).**
        *   Instructions for reviewers on how to test the new features, including how to run the Cypress tests.

10. **CI/CD Resolution:**
    *   Actively monitor the CI/CD pipeline for your PR.
    *   **Resolve any CI errors or failing tests promptly.**

11. **Address PR Feedback:**
    *   Actively monitor your PR for reviewer comments and feedback.
    *   **Address all pull request comments and suggestions**, pushing updated commits to your branch as needed, until the PR is approved.
