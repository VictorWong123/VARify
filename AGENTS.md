# Repository Guidelines

## Project Structure & Module Organization

VARify is a small monorepo with a React frontend and Spring Boot backend.

- `frontend/`: Vite React + TypeScript app.
- `frontend/src/`: UI source, including `App.tsx`, styles, and Vitest setup.
- `frontend/public/`: static frontend assets such as `favicon.svg`.
- `backend/`: Java Spring Boot API.
- `backend/src/main/java/com/varify/backend/`: controllers, services, DTOs, and config.
- `backend/src/test/java/`: Spring Boot and MockMvc tests.
- `README.md`: setup and API usage.
- `.env.example` files document local configuration; never commit real `.env` files.

## Build, Test, and Development Commands

Frontend commands:

```sh
cd frontend
npm install
npm run dev        # start Vite dev server
npm test           # run Vitest tests
npm run build      # typecheck and build production assets
```

Backend commands:

```sh
cd backend
mvn spring-boot:run  # start API on localhost:8080
mvn test             # run Spring Boot tests
```

Run frontend and backend in separate terminals for local demos.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and Java 17 for backend code. Keep React components in PascalCase, local functions and variables in camelCase, and DTO/service/controller Java classes named by role, for example `RefereeDecisionService` or `AnalysisController`. Follow the existing indentation style: two spaces in frontend files and four spaces in Java/XML/YAML where already used. Keep UI text concise and avoid unrelated refactors.

## Testing Guidelines

Frontend tests use Vitest with React Testing Library. Name component tests as `*.test.tsx` near the code they cover. Backend tests use JUnit with Spring Boot MockMvc under `backend/src/test/java`. Cover upload behavior, mock-mode responses, and API contract changes. Run `npm test`, `npm run build`, and `mvn test` before handing off substantial changes.

## Commit & Pull Request Guidelines

Git history is minimal, so use concise imperative commit messages, for example `Add mock analysis endpoint` or `Fix frontend upload contract`. Pull requests should include a short summary, test results, linked issue or hackathon task if applicable, and screenshots or a short screen recording for UI changes.

## Security & Configuration Tips

Keep API keys out of git. Use `backend/.env.example` and `frontend/.env.example` as templates. Missing AI provider keys should preserve mock-mode behavior so uploads still return a demo decision.
