# Basic Stack

- Form handler -> [`react-hook-form`](https://www.npmjs.com/package/react-hook-form)
- Form validator -> [`zod`](https://www.npmjs.com/package/zod)
- State management -> [`zustand`](https://www.npmjs.com/package/react-hook-form)
- Asynchronous state management -> [`@tanstack/react-query`](https://www.npmjs.com/package/@tanstack/react-query)

# Project Structure

- `/app`
  This directory is used to route Expo apps. In this example, we use a user dashboard project that has a dashboard page for users, a create user page, and an update user page. Here are the routes:

  - `/app/users`
    - `/app/users/(user-dashboard)`
    - `/app/users/new`
    - `/app/users/[userId]`

  Usually, the root menu of each route or feature will be grouped (such as `(user-dashboard)`) to isolate it from its child routes.

- `/components`
  This directory is used to store global components that can be used anywhere in the project.

- `/features`
  This directory is used to store each feature in applications, such as authentication, profile, etc.

  - `/components`
    This directory is used to store any components related to the feature.
  - `/components/ui`
    This directory is used to store any global components specific to the related feature, usually used to store compound components for each feature.
    [Compound components reference](https://www.youtube.com/watch?v=N_WgBU3S9W8)
  - `/hooks`
    This directory is used to store any hooks related to the feature.
  - `/stores`
    This directory is used to store **zustand store** related to the feature.
  - `/validators`
    This directory is used to store any validators related to the feature.
  - `/utils`
    This directory is used to store any utilities related to the feature.

- `/hooks`
  This directory is used to store global hooks that can be used anywhere in the project.

- `/lib`
  This directory is used to store global libraries, such as API instances.

- `/stores`
  This directory is used to store **zustand store** that globally used.

- `/services`
  This directory is used to store any API services for each endpoint. For each service, it includes the entity, DTO, query key (for `@tanstack/query`), and query + mutation hooks.

  - `/services/*/dto.ts`
    This directory is used to store DTOs related to the service using Zod. For example:
    ```typescript
    // Zod DTO
    export const createUserDto = z.object({
      firstName: z.string(),
      lastName: z.string().optional(),
    });
    // Typing for Zod DTO above
    export type CreateUserDto = z.infer<typeof createUserDto>;
    ```
  - `/services/*/entity.ts`
    This directory is used to store entities related to the service using Zod. For example:
    ```typescript
    export const userEntity = z.object({
      firstName: z.string(),
      lastName: z.string(),
      age: z.number(),
    });
    export type UserEntity = z.infer<typeof userEntity>;
    ```
  - `/services/*/query-key.factory.ts`
    This directory is used to store query keys related to the service that extend from the shared query key factory at `/services/shared/query-key.factory.ts`. For example:
    ```typescript
    export class UserQueryKeyFactory extends QueryKeyFactory {}
    ```
  - `/services/*/hooks`
    This directory is used to store any React hooks related to querying and mutating a service. Usually, there are 5 base hooks. For example, for a `User` service:

    - `useFindUser`: This hook is used to query all users, with or without a filter.
    - `useGetUser`: This hook is used to query a user by `id`.
    - `useCreateUser`: This hook is used to create a user.
    - `useUpdateUser`: This hook is used to update a user.
    - `useDeleteUser`: This hook is used to delete a user.

    Query hooks usually return `useQuery` hooks from `@tanstack/query` (e.g., `useFindUser` and `useGetUser`), and mutation hooks usually return `useMutation` hooks from `@tanstack/query` (e.g., `useCreateUser`, `useUpdateUser`, and `useDeleteUser`). Feel free to add any hooks for other actions.

# Git Rules

1. > Maximum **20** file changes (except assets)

   If your PR is more than 20 file changes, please reduce it to smaller PRs.

2. use a simple self explain branch name, example for creating user profile page UI: `feat/user-profile-ui`, another example if you want to integrate api with the UI: `feat/user-profile-integration`

3. PR title simple self explain of feature in said PR
4. PR description must include screenshot when slicing UI

# Git Commit Message

- example feature:
  `"feat(home/dashboard): initial UI for dashboard"`
- example chore:
  `"chore(dashboard/navigation): improve code or logic ..."`
- example fix bug:
  `"fix(...): fix missing logic ..."`
- example styling:
  `"style(...): create a navigation bar"`
- example refactor: `"refactor(...): refactor missing logic"`

# Other

- use kebab-case for file and folder naming (e.g., `this-file-naming.ts`)
- do not use `export default ...` when exporting component, use regular export instead (e.g., `export const SomeComponent = () => {...}`)