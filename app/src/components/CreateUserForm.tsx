"use client";

import { useActionState, useState } from "react";
import { createUserAction } from "@/app/panel/users/actions";

const initialState: { error?: string } = {};

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, initialState);
  // Controlled so React 19 does not clear these when the action returns a
  // validation error (uncontrolled form-action fields are auto-reset on submit).
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-user-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="new-user-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-user-password" className="text-sm font-medium text-foreground">
          Начальный пароль
        </label>
        <input
          id="new-user-password"
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-user-role" className="text-sm font-medium text-foreground">
          Роль
        </label>
        <select
          id="new-user-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="cursor-pointer rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="manager">Менеджер</option>
          <option value="admin">Администратор</option>
        </select>
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Создаём…" : "Создать"}
      </button>
    </form>
  );
}
