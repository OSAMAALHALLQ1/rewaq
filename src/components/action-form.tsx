"use client";

import { useActionState } from "react";
import { FormSubmit } from "@/components/form-submit";
import { Badge } from "@/components/ui/badge";
import type { ActionState } from "@/server/actions/auth";

type ActionFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
};

const initialState: ActionState = { ok: false, message: "" };

export function ActionForm({ action, children, submitLabel, className }: ActionFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className={className}>
      {children}
      {state.message ? (
        <Badge tone={state.ok ? "success" : "danger"} className="mt-3">
          {state.message}
        </Badge>
      ) : null}
      <div className="mt-4">
        <FormSubmit>{submitLabel}</FormSubmit>
      </div>
    </form>
  );
}
