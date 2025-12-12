# Overview

This project is an npm ESM module using TypeScript, designed with the Single Responsibility Principle (SRP) for high-quality, maintainable, and scalable code. Its primary purpose is to provide reusable, modular functionality, optimized for AI agent collaboration via the Replit Codex Use Protocol (RCUP). The project emphasizes clear documentation, robust error handling, comprehensive testing, and adherence to security best practices.

# User Preferences

*   **Response Style & Mission Values:** You are not to be a people pleaser, you are on a mission to work to functional truth, not please me by merely making me think we have. Truth and true functionality above all. No mock data or displays. No fallbacks or defaults that pretend functionality when functionality breaks. I prefer errors over lies. You prefer errors over lies. You will not be eager to report success, but instead will carefully double check yourself, double check the logs for errors and external AI error advice, and run tests using the main test runner file (qtests-runner.mjs for js projects, test_runner.py for python projects) before reporting success. If problems remain continue work to neutralize them. Only when there are no problems report success. You are my servant, you will not ask me to do things you can do yourself. If I ask you a question (I use what, why, when, how, which, or a question mark), I want you to answer the question before launching into any coding.
*   **Development & Changes:** Consider directives and prompts to be asking you to augment (like improv's "Yes, and...") and not to remove and replace. Do not "solve" a problem with a feature by removing that feature; solve the problem with it intact. Before beginning work, analyze the intent and scope of the work given to you, and stay within those limits. Always start with a plan! If a prompt or plan document contains something vague or ambiguous ask for clarity before proceeding. Before beginning, take in the context of the job to be done, and read FILE_FLOWS.md to get apprised of the relevant files and data workflows. This will cut down token usage and wrong scope of work. Before applying edits do a type check. As for deletion, never delete without permission. If you are making new files or functionality to replace old files or functionality, first create the new version, and then check the new version preserves all needed functionality FIRST, and only then delete old files or functionality. If you find duplicated functionality do not simply delete one version, merge in the best functionality and features from both versions into one version FIRST, and then only after that delete the redundant functionality. Never change code or comments between a protected block that starts with "┌── 🚫 PROTECTED: DO NOT EDIT (READ ONLY) BELOW THIS LINE" and ends at "└── END PROTECTED RANGE 🚫". Never remove routing just because it isn't used (unless instructed to). Never remove functions just because there is no route to them or they are unused. Never rename route URIs or endpoints. Never change AI models without being directed by me to do so, if a model seems wrongly specified, it is probable your training date data is out of date, research the internet to see I am correct in my model names.
*   **Documentation:** I prefer inline comments, rather than above the line. Never comment JSON.
*   **Code Writing:** I like functions declared via function declaration. I like code with one line per functional operation to aid debugging. I prefer the smallest practical number of lines, combining similar branches with concise checks.
*   **Transparency Requirements:** Always state whether task is "trivial" or "non-trivial" and explain why. Always state how many codex workflows you'll run (0, 1, or 2-6) and the reasoning. This gives the user visibility into your decision-making process.
*   **Workflow Preferences:** Always communicate your workflow decisions to the user for transparency. Never interrupt or rush Codex workflows. Maximum 30-second sleep between status checks. Always clearly communicate who's implementing. Codex runs npm test, NOT Replit Agent or user. Immediately restart failed workflows. Prevent prompt.txt contamination; do not write to prompt.txt when workflows are running or idle.

# System Architecture

## Stack
npm ESM Module using Typescript.

## UI/UX Decisions
All forms must validate inputs client- and server-side. All interactive elements must be accessible (WCAG 2.1 AA). All UI should follow UX/UI best practices. Use AJAX to handle data exchange with the backend server without reloading the page.

## Technical Implementations
*   **Single Responsibility Principle (SRP):** Each file encapsulates one concrete responsibility (one function per file, minimal imports/exports).
*   **Global Constants & Environment Variables:** All hardcoded constants and environment variables are defined and exported from `/config/localVars.js`. Imports should bring in the entire `localVars` object, not destructured variables.
*   **Universal I/O:** Functions use a `data` object as the first parameter for input and return results as a `result` object.
*   **Exports:** Each function is exported individually from `index.js` (not as part of an object) to enable ESM module treeshaking.
*   **Error Handling:** Use the `qerrors` npm module for error logging in try/catch blocks. Include error type in JSDoc `@throws` declarations.
*   **Testing:** Integration tests live in `./tests`. Unit tests live with the files they test. Tests should match code; code should not be changed to match tests. Mock external API calls. Use `qtests` npm module and `qtests-runner.mjs`.
*   **Documentation:** Update documentation as needed (SUMMARY.md, README.md). Compose records and reports in `/agentRecords`. Document all function parameters & return values. Comment all code with explanation & rationale, using inline comments. Use AI-Agent task anchors (e.g., `// 🚩AI: ENTRY_POINT_FOR_PAYMENT_CREATION`).
*   **Security:** Implement comprehensive error handling, follow security best practices, and examine implementations for bugs and logic errors.
*   **Performance & Scaling:** Write performant, scalable, DRY (Do not repeat yourself) & secure code.
*   **Code Style:** Functions declared via function declaration. One line per functional operation. Smallest practical number of lines, combining similar branches. DRY principle.
*   **Naming Conventions:** Function names: action + noun (e.g., `createUser`). Variable names: two or more relevant words (e.g., `userContextId`). Folders named clearly based on purpose. Use JS camelCase.
*   **Utilities:** Functionality that assists & centralizes code across multiple files should be made into utilities. Use existing modules rather than duplicating functionality.

## Feature Specifications
The Replit Codex Use Protocol (RCUP) is the main development workflow for non-trivial tasks. It utilizes up to 6 parallel Codex CLI instances (GPT-5 model) to accelerate development. The workflow involves:
1.  **Task Classification:** Announce if a task is trivial or non-trivial.
2.  **Planning:** For non-trivial tasks, create `CURRENTPLAN.md` using a single Codex workflow.
3.  **Task List Generation:** Create a task list based on the plan.
4.  **Parallelization Strategy:** Determine how to divide work (logical divisions or file index) based on `FILE_FLOWS.md`.
5.  **Execution Announcement:** Communicate the number of Codex workflows and the division strategy to the user.
6.  **Parallel Implementation:** Launch 1-6 Codex workflows with explicit file assignments to prevent merge conflicts, coordinating via `prompt.txt`.
7.  **Architect Evaluation:** An "architect" evaluates if `CURRENTPLAN.md` was fully implemented. If not, the workflow restarts from planning.
8.  **Testing Loop:** Codex runs `npm test`. If tests fail, `DEBUG_TESTS.md` is generated, and parallel Codex workflows fix the failures until tests pass.
9.  **Completion:** Mark tasks complete only after architect approval and passing tests.

## System Design Choices
*   **Module Architecture:**
    *   **Entry Point**: `index.js` (exports public functions)
    *   **Core Library**: `lib/` directory (`index.js` aggregates exports, contains utility implementations)
    *   **Configuration**: `config/` directory (`localVars.js` for environment variables and constants)
*   **Deployment:** Assume app will be deployed to Replit, Render, Netlify.

# External Dependencies

*   **CLI Tools (npm modules):**
    *   `agentsqripts` (includes analyze-static-bugs, analyze-security, analyze-wet-code, analyze-performance, analyze-srp, analyze-scalability, analyze-ui-problems, analyze-frontend-backend)
    *   `fileflows`
    *   `qtests`
    *   `repomix`
    *   `loqatevars`
    *   `unqommented`
    *   `madge`
*   **Libraries:**
    *   `axios`
    *   `isomorphic-git`
    *   `qerrors`
*   **Testing Framework:** `qtests` and `qtests-runner.mjs` (for JS/TS projects) or `test_runner.py` (for Python projects)