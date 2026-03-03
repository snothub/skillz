# CLAUDE.md - A Claude template

## Overview
A claude template when developing .NET backends

## Tech Stack
- .NET 10, ASP.NET Core Minimal APIs and Carter Modules
- Mediator for CQRS (source-generated, https://github.com/martinothamar/Mediator)
- FluentValidation for request validation
- Scalar for OpenAPI documentation
- xUnit + Shoudly for testing

## Project Structure
- `src/Api/` — Endpoints, middleware, DI configuration
- `src/Application/` — Commands, queries, handlers, validators
- `src/Domain/` — Entities, value objects, enums, domain events
- `src/Infrastructure/` — EF Core, external services, repositories
- `tests/UnitTests/` — Domain and application layer tests
- `tests/IntegrationTests/` — API and database tests

## Commands
- Build: `dotnet build`
- Test: `dotnet test`
- Run API: `dotnet run --project src/Api`
- Update Database: `dotnet ef database update -p src/Infrastructure -s src/Api`
- Format: `dotnet format`

## Architecture Rules
- Domain layer has ZERO external dependencies
- Application layer defines interfaces, Infrastructure implements them
- All database access goes through EF Core DbContext (no repository pattern)
- Use Mediator for all command/query handling
- API layer is thin — endpoint definitions only

## Code Conventions

### Naming
- Commands: `Create[Entity]Command`, `Update[Entity]Command`
- Queries: `Get[Entity]Query`, `List[Entities]Query`
- Handlers: `[Command/Query]Handler`
- DTOs: `[Entity]Dto`, `Create[Entity]Request`

### Patterns We Use
- Primary constructors for DI
- Records for DTOs and commands
- Result<T> pattern for error handling (no exceptions for flow control) using CSharpFunctionalExtensions
- File-scoped namespaces
- Always pass CancellationToken to async methods

### Patterns We DON'T Use (Never Suggest)
- Repository pattern (use EF Core directly)
- AutoMapper (write explicit mappings)
- Exceptions for business logic errors
- Stored procedures

## Validation
- All request validation in FluentValidation validators
- Validators auto-registered via assembly scanning
- Validation runs in Mediator pipeline behavior
- API Returns ProblemDetails using RFC9457

## Testing
- Unit tests: Domain logic and handlers
- Integration tests: Full API endpoint testing with WebApplicationFactory
- Use FluentAssertions for readable assertions
- Test naming: `[Method]_[Scenario]_[ExpectedResult]`

## Git Workflow
- Branch naming: `feature/`, `bugfix/`, `hotfix/`
- Commit format: `type: description` (feat, fix, refactor, test, docs)
- Always create a branch before changes
- Always write tests before the feature. Use TDD. 
- Run tests before committing
