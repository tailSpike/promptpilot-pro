**Objective:** Implement the next user story from our backlog, ensuring full functional coverage, robust automated and manual testing, up-to-date documentation, and a smooth, well-described pull request process with clear verification steps.

**Instructions:**

1.  **Identify Next Story:** Identify the highest-priority, unstarted user story in our backlog. If there's any ambiguity, please confirm with me.
2.  **Branch Creation:** Create a new development branch from `main` (or our designated integration branch) using a descriptive naming convention (e.g., `feature/story-id-short-description`).
    *   **Action:** `git checkout main && git pull && git checkout -b feature/story-id-short-description`
3.  **Implement Functionality:**
    *   Implement all core functionality required by the identified story.
    *   Ensure that **every acceptance criterion** defined for the story is fully met and verifiable.
    *   Adhere to our established coding standards and best practices.
4.  **Automated Testing:**
    *   **Unit Testing:** Write comprehensive unit tests that cover **all new and modified logic paths** introduced by this story. Aim for high code coverage where appropriate, focusing on critical business logic. Ensure all unit tests pass.
    *   **Cypress UI Acceptance Testing:** Write end-to-end Cypress UI acceptance tests that directly validate **every acceptance criterion** from the story. These tests should simulate user interactions to confirm the UI behaves as expected according to the requirements. Ensure all Cypress tests pass.
5.  **Manual Test Cases & Verification Instructions:**
    *   **Create a clear set of manual test cases (step-by-step instructions)** for me to follow to verify that the implemented functionality meets all acceptance criteria.
    *   **Provide explicit instructions on how to run the application locally** (e.g., `npm start`, `docker-compose up`, specific environment variables needed).
    *   These manual test cases and run instructions should be included in the Pull Request description (or linked from it).
6.  **Update Documentation:**
    *   **Update any relevant documentation, including the project's `README.md` file, to reflect changes introduced by this story.** This could include new configuration, setup steps, API endpoints, or usage instructions.
7.  **Local Verification:**
    *   Before committing, run all relevant local tests (unit and Cypress) and confirm documentation updates are accurate. Also, locally follow the manual test cases to ensure they are accurate and the functionality works as expected.
8.  **Commit and Push:**
    *   Commit your changes with clear, descriptive commit messages.
    *   Push your new branch and commits to the remote repository.
9.  **Open Pull Request (PR):**
    *   Open a new pull request targeting the `main` (or designated integration) branch.
    *   **Populate the PR description with a useful and descriptive message detailing the work that was done.** This should include:
        *   A link to the user story/ticket.
        *   A clear summary of the implemented functionality.
        *   A list of the acceptance criteria covered.
        *   Any significant architectural or design decisions made.
        *   Mention of updated documentation.
        *   **The detailed manual test cases and instructions on how to run the app for verification.**
        *   Instructions for reviewers on how to test the new features.
10. **CI/CD Resolution:**
    *   Actively monitor the CI/CD pipeline for your PR.
    *   **Resolve any CI errors or failing tests promptly.**
11. **Address PR Feedback:**
    *   Actively monitor your PR for reviewer comments and feedback.
    *   **Address all pull request comments and suggestions**, pushing updated commits to your branch as needed, until the PR is approved.

**Confirmation:** Please confirm you understand these instructions and are ready to proceed by stating "Ready to implement next story."