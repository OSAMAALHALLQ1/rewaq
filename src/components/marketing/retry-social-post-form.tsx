"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/actions/auth";

type RetrySocialPostFormProps = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  postId: string;
  targetId?: string;
  label?: string;
};

const initialState: ActionState = { ok: false, message: "" };

export function RetrySocialPostForm({
  action,
  postId,
  targetId,
  label = "إعادة المحاولة",
}: RetrySocialPostFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="postId" value={postId} />
      {targetId ? <input type="hidden" name="targetId" value={targetId} /> : null}
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="h-8 gap-1 text-xs">
        <RotateCcw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
        {pending ? "جار الإعادة" : label}
      </Button>
      {state.message ? (
        <span className={state.ok ? "text-[10px] text-emerald-700" : "text-[10px] text-rose-700"}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
