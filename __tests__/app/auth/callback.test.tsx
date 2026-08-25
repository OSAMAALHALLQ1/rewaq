/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, refresh, replace, setSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { exchangeCodeForSession, setSession },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

import AuthCallbackPage from "@/app/auth/callback/page";

describe("auth callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    refresh.mockReset();
    replace.mockReset();
    setSession.mockReset();
  });

  it("stores an implicit-flow session from the URL fragment before redirecting", async () => {
    window.history.replaceState({}, "", "/auth/callback?next=/dashboard#access_token=synthetic-access-token&refresh_token=synthetic-refresh-token");
    setSession.mockResolvedValue({ error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(setSession).toHaveBeenCalledWith({
        access_token: "synthetic-access-token",
        refresh_token: "synthetic-refresh-token",
      });
    });
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("exchanges a PKCE code when Supabase returns one instead", async () => {
    window.history.replaceState({}, "", "/auth/callback?next=/dashboard&code=synthetic-auth-code");
    exchangeCodeForSession.mockResolvedValue({ error: null });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith("synthetic-auth-code");
    });
    expect(setSession).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("does not expose provider error details from an invalid link", async () => {
    window.history.replaceState({}, "", "/auth/callback#error=access_denied&error_description=synthetic-single-use-token");

    render(<AuthCallbackPage />);

    expect(await screen.findByText("تعذر تسجيل الدخول")).toBeInTheDocument();
    expect(screen.queryByText("synthetic-single-use-token")).not.toBeInTheDocument();
    expect(setSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
