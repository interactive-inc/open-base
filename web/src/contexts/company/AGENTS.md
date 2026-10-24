# Company Context

Company is the portable company layer. It owns legal identity, people, employment,
organization, definitions, account-to-employee links, and personnel actions. It does not own
product-specific workflows or the System account implementation.

## Dependency direction

```text
interface -> application -> infrastructure
     |             |              |
     +-------------+------------> domain
```

- Domain contains only `entities/`, `values/`, `policies/`, and `errors.ts`; it is pure company policy.
- Application contains only write services that create or mutate Domain models before persistence.
  Reads, queries, simple CRUD, and HTTP conversion stay directly in Hono route handlers.
- Infrastructureの`repositories/`にはDomain Entityを永続化する`*.repository.ts`を置く。
  資格解決や複数の保存先を接続する処理は`adapters/`の`*.adapter.ts`へ置く。
  所有schema/SQLとtestもInfrastructureへ置き、RepositoryとAdapterはdatabase SDKを利用できる。
- Application must not contain Repository, Persistence, Gateway, or Port definition files.
- Interface owns Hono, route-local Zod request schemas, and semantic HTTP exceptions. Only the API
  root `onError` serializes those exceptions into response JSON.
- The API root composes routes; the context never imports a product API root.

## Explicit operations

Every URL has one concrete route file. When the same URL supports both read and write,
that file exports both `GET` and `POST` so the complete HTTP contract is readable in one place.
Zod schemas are written directly in each validator. A schema change therefore cannot silently
change unrelated endpoints through a shared schema graph.

Application classes exist only for writes that enforce Domain policy or invariants. Read/query
classes and functions are forbidden. A route handler performs its read authorization and query
validation before calling a repository directly. Shared persistence consistency mechanisms such as
revision conflicts, idempotency, canonical serialization, and the atomic audit/write transaction
remain private to a repository.

## HTTP contract

Zod schemas in each route are the request contract. Hono validators expose those inferred inputs to
`hono/client` so tests and consumers use typed path, method, header, query, and JSON values.
Application and domain code do not depend on Hono. Domain definition files may use Zod to keep one
runtime schema and its inferred type, while entities and policies remain transport-independent.

## Safety

- Organization access and capability checks fail closed before persistence.
- Writes require an idempotency key and expected organization revision.
- Resource revisions and organization revisions are enforced again by D1.
- Organization changes validate hierarchy periods, unit references, primary assignment overlap,
  management cycles, and authority scope before writing.
- Reads at an effective date use immutable revisions rather than mutating history.
