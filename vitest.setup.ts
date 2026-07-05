import "@testing-library/jest-dom";
import { afterAll, beforeAll, vi } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Keep unit tests in demo mode and prevent accidental Supabase network calls.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.RAWAQ_DEMO_MODE = "true";

// Silence console.error in tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: ReactDOM.render")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
