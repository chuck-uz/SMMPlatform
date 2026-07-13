import { describe, expect, it } from "vitest";
import { setUserActive } from "./setUserActive";

function makeDeps() {
  const calls: Array<{ id: string; isActive: boolean }> = [];
  return {
    updateIsActive: async (id: string, isActive: boolean) => {
      calls.push({ id, isActive });
    },
    getCalls: () => calls,
  };
}

describe("setUserActive", () => {
  it("deactivates another user", async () => {
    const deps = makeDeps();

    const result = await setUserActive("admin_1", "user_2", false, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.getCalls()).toEqual([{ id: "user_2", isActive: false }]);
  });

  it("reactivates another user", async () => {
    const deps = makeDeps();

    const result = await setUserActive("admin_1", "user_2", true, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.getCalls()).toEqual([{ id: "user_2", isActive: true }]);
  });

  it("refuses to let a user deactivate their own account", async () => {
    const deps = makeDeps();

    const result = await setUserActive("admin_1", "admin_1", false, deps);

    expect(result).toEqual({
      ok: false,
      error: "Нельзя деактивировать свою же учётную запись",
    });
    expect(deps.getCalls()).toEqual([]);
  });

  it("allows a user to reactivate their own account", async () => {
    const deps = makeDeps();

    const result = await setUserActive("admin_1", "admin_1", true, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.getCalls()).toEqual([{ id: "admin_1", isActive: true }]);
  });
});
