import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  getEvent: vi.fn(),
  listRegistrations: vi.fn(),
  addAttendeeToRegistration: vi.fn(),
  updatePrimaryAttendee: vi.fn(),
  resolveRegistrationFormConfig: vi.fn(() => ({ fields: { phone: { required: false } } })),
  recordAudit: vi.fn(),
  revalidatePath: vi.fn(),
  OCCUPATION_OPTIONS: ["wholesaler", "manufacturer", "architect-decorator", "installer-technician"],
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({
  OCCUPATION_OPTIONS: mocks.OCCUPATION_OPTIONS,
  addAttendeeToRegistration: mocks.addAttendeeToRegistration,
  getEvent: mocks.getEvent,
  listRegistrations: mocks.listRegistrations,
  updatePrimaryAttendee: mocks.updatePrimaryAttendee,
  resolveRegistrationFormConfig: mocks.resolveRegistrationFormConfig,
}));
vi.mock("@/modules/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { addInternalCompanionAction } from "./actions";

const adminUser = {
  id: "admin-1",
  profile: { organizationId: "org-1", role: "ADMIN", status: "active" },
};

function formData(fields: { company?: string } = {}) {
  const data = new FormData();
  data.set("eventId", "22222222-2222-4222-8222-222222222222");
  data.set("registrationId", "11111111-1111-4111-8111-111111111111");
  data.set("fullName", "Alan Turing");
  data.set("email", "alan@example.com");
  if (fields.company) data.set("company", fields.company);
  data.set("occupation", "architect-decorator");
  return data;
}

function mockSearchRegistration(company: string) {
  mocks.listRegistrations.mockResolvedValue([
    {
      id: "11111111-1111-4111-8111-111111111111",
       attendees: [{ company, isPrimary: true }],
    },
  ]);
}

describe("addInternalCompanionAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    mockSearchRegistration("Nau Studio");
  });

  it("surfaces duplicate email instead of hiding it behind a generic add error", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({ ok: false, reason: "duplicate_email" });

    const result = await addInternalCompanionAction(formData());

    expect(result.error).toBe("Ya existe un asistente activo con ese correo en este evento.");
  });

  it("returns the generated companion identity on success", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({
      ok: true,
      registrationStatus: "confirmed",
      attendee: { id: "att-2", fullName: "Alan Turing", backupCode: "WXYZ5678" },
    });

    const result = await addInternalCompanionAction(formData());

    expect(result).toEqual({
      error: "Acompañante agregado. Folio: WXYZ5678",
      addedCompanion: { fullName: "Alan Turing", backupCode: "WXYZ5678" },
    });
  });

  it("uses the titular company when an admin adds a companion", async () => {
    mockSearchRegistration("Nau Studio");
    mocks.addAttendeeToRegistration.mockResolvedValue({
      ok: true,
      registrationStatus: "confirmed",
      attendee: { id: "att-2", fullName: "Alan Turing", backupCode: "WXYZ5678" },
    });

    await addInternalCompanionAction(formData({ company: "Forged Company" }));

    expect(mocks.addAttendeeToRegistration).toHaveBeenCalledWith(expect.objectContaining({
      attendee: expect.objectContaining({ company: "Nau Studio" }),
    }));
  });
});
