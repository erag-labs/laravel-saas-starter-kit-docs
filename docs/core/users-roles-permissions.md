---
title: "Laravel Users, Roles & Permissions"
description: "User management, queued invitations, system and custom roles, config-driven Spatie permissions and permission checks on routes, menus and buttons."
head:
  - - link
    - rel: canonical
      href: https://saas-laravel.com/docs/core/users-roles-permissions.html
  - - meta
    - property: og:title
      content: "Laravel Users, Roles & Permissions"
  - - meta
    - property: og:description
      content: "User management, queued invitations, system and custom roles, config-driven Spatie permissions and permission checks on routes, menus and buttons."
  - - meta
    - property: og:url
      content: https://saas-laravel.com/docs/core/users-roles-permissions.html
  - - meta
    - name: twitter:title
      content: "Laravel Users, Roles & Permissions"
  - - meta
    - name: twitter:description
      content: "User management, queued invitations, system and custom roles, config-driven Spatie permissions and permission checks on routes, menus and buttons."
---

# Users, roles & permissions

Authorization uses **spatie/laravel-permission** (`^8.3`). The same screens work on the central domain (guard `web`) and inside every tenant (guard `tenant`), each with its own users, roles and permissions.

How the pieces fit together:

```text
config/permissions/*.php  → defines permissions + default roles for each
Role (system or custom)   → picked on the user form
PermissionService         → gives the user the role's default permissions directly
permission middleware / can() → checks the user's permissions
```

## Users

`/users` (module `Modules/User`):

- List with search, pagination and stats (total, verified, unverified)
- Create, edit and delete users (you cannot delete yourself)
- Pick a role when creating or editing
- **Send invitation email** instead of setting a password
- **Assign permissions** dialog: permissions grouped by config file, with a role selector that checks the role's default permissions

| Action | Central permission | Tenant permission |
| --- | --- | --- |
| View list | `View Users` | `View Tenant Users` |
| Create | `Create User` | `Create Tenant User` |
| Edit | `Edit User` | `Edit Tenant User` |
| Delete | `Delete User` | `Delete Tenant User` |
| Assign permissions | `Assign Permissions` | `Assign Tenant Permissions` |

### Invitations

An invitation lets the new user choose their own password. When **Send invitation email** is on:

```text
UserService::createUser()
  → creates the user with a random password, sets invited_at
  → assigns the selected role
  → queues an email with a signed link (valid 7 days)
User opens the link
  → sets a password (auth/AcceptInvitation)
  → is verified and signed in, invited_at is cleared
```

The list shows an **Invitation pending** badge while `invited_at` is set.

::: warning Invitations need a queue worker
Invitation emails are queued. Without a running worker no email is sent. See [Local development → Queue worker](/docs/getting-started/local-development#queue-worker).
:::

**Related files**: `Modules/User/Services/UserService.php`, `Modules/User/Notifications/UserInvitationNotification.php` (`EXPIRES_IN_DAYS`), `Modules/User/Http/Controllers/UserInvitationController.php` (route `users.invitation.show`).

## Roles

`/roles` (module `Modules/RolePermission`) lists roles with search and stats (total, system, custom) and lets you create, rename and delete roles.

| Action | Central permission | Tenant permission |
| --- | --- | --- |
| View | `View Roles` | `View Tenant Roles` |
| Create | `Create Role` | `Create Tenant Role` |
| Edit | `Edit Role` | `Edit Tenant Role` |
| Delete | `Delete Role` | `Delete Tenant Role` |

There are two kinds of roles:

| | System roles | Custom roles |
| --- | --- | --- |
| Defined in | `Modules\RolePermission\Enums\RoleEnum` | The Roles page |
| Default permissions | From `config/permissions` | None |
| Edit or delete in the UI | No (marked as system) | Yes |

System roles:

| Value | Label |
| --- | --- |
| `super-admin` | Super Admin |
| `admin` | Admin |
| `manager` | Manager |
| `employee` | Employee |
| `user` | User |

The backend also refuses to delete `super-admin`.

### Super admin

Users with the `super-admin` role pass every check:

- **Backend**: `AppServiceProvider` registers a `Gate::before` that grants every ability.
- **Frontend**: `auth.isSuperAdmin` makes every `can()` check pass.

## Permissions

Permissions are defined in PHP config files, one file per group. The file tells the kit which permissions exist and which system roles get each one by default.

```text
config/permissions/            # central (guard web)
├── dashboard.php  menus.php  roles.php  settings.php  tenants.php  users.php
└── tenant/                    # tenant (guard tenant)
    └── dashboard.php  menus.php  roles.php  settings.php  users.php
```

```php
// config/permissions/tenants.php
return [
    [
        'permission_name' => 'View Tenants',
        'associated_roles' => ['Super Admin', 'Admin', 'Manager'],
    ],
];
```

| Key | Meaning |
| --- | --- |
| `permission_name` | The permission stored in the database |
| `associated_roles` | **Role labels** (from `RoleEnum::label()`), not values, that get this permission by default |

`PermissionService::getGroupedPermissions()` reads the central or tenant folder depending on context. Group names are translated with `modules/role.permission_groups.<file name>`.

### How permissions are assigned

Permissions are assigned **directly to users**, not to roles. This lets you fine-tune one user without creating a new role. `PermissionService::assignRole($user, $roleName)` works like this:

| Role type | Result |
| --- | --- |
| System role | Syncs the role **and** replaces the user's permissions with those whose `associated_roles` include the role's label |
| Custom role | Syncs only the role; the user's permissions are not changed. Use the **Assign permissions** dialog |

Changing a user's role in the edit form re-applies that role's default permissions.

### Adding a permission

1. Add an entry to the right file in `config/permissions/` (and `config/permissions/tenant/` if tenants need it).
2. Create it in the database:

   ```bash
   php artisan db:seed --class=PermissionSeeder      # central
   php artisan tenants:seed                           # all tenants (runs TenantDatabaseSeeder)
   ```

3. Assign it to users in the UI, or re-assign the role.
4. If you created a new file, add a group label to `lang/<locale>/modules/role.php` under `permission_groups`.

::: warning `tenants:seed` runs the full tenant seeder
`TenantDatabaseSeeder` also runs `DefaultUserSeeder`, which creates (or updates) the `<role>@gmail.com` users in every tenant. Remove it from `database/seeders/tenant/TenantDatabaseSeeder.php` if you do not want those accounts, or seed only permissions with `php artisan tenants:seed --class="Database\\Seeders\\PermissionSeeder"`.
:::

## Checking permissions

| Where | How |
| --- | --- |
| Routes | `permission` middleware |
| PHP | `$user->can('Edit User')` or `Gate::allows(...)` (super admins always pass) |
| Menus | The `permission` column on each `menus` row; `MenuService` hides items the user cannot access |
| Frontend | `can()` helper, powered by the shared props `auth.permissions` and `auth.isSuperAdmin` |

**Routes**: when a route serves both contexts, pipe-separate the central and tenant names:

```php
Route::get('users', [UserController::class, 'index'])
    ->middleware('permission:View Users|View Tenant Users')
    ->name('users.index');
```

**Frontend**: `can(...names)` returns `true` if the user has **any** of the given permissions.

::: code-group

```vue [Vue]
<script setup lang="ts">
import { usePermission } from '@/composables/usePermission';

const { can } = usePermission();
</script>

<template>
    <Button v-if="can('Create User', 'Create Tenant User')">New user</Button>
</template>
```

```tsx [React]
import { usePermission } from '@/hooks/use-permission';

export default function UsersToolbar() {
    const { can } = usePermission();

    return can('Create User', 'Create Tenant User') ? <Button>New user</Button> : null;
}
```

```svelte [Svelte]
<script lang="ts">
    import { usePermission } from '@/lib/permission';

    const { can } = usePermission();
</script>

{#if can('Create User', 'Create Tenant User')}
    <Button>New user</Button>
{/if}
```

:::

::: tip Hiding is not securing
Frontend checks only hide UI. Always protect the route with `permission:` middleware too.
:::
