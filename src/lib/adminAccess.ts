import { supabase } from "@/integrations/supabase/client";

const ADMIN_ROLES = ["admin", "moderator"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminAccessResult =
  | { status: "no-session" }
  | { status: "unauthorized"; email: string; isSuperAdmin: boolean }
  | { status: "error"; message: string }
  | {
      status: "authorized";
      role: AdminRole;
      permissions: string[];
      email: string;
      isSuperAdmin: boolean;
    };

const SUPER_ADMIN_EMAILS = ["dev.anwarul@gmail.com", "amdadulislammilon9@gmail.com"];

export async function getCurrentAdminAccess(): Promise<AdminAccessResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    return { status: "error", message: error.message };
  }

  if (!session?.user) {
    return { status: "no-session" };
  }

  return getAdminAccessForUser(session.user.id, session.user.email || "");
}

async function getAdminAccessForUser(userId: string, email: string): Promise<AdminAccessResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const isSuperAdmin = SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalizedEmail);

  if (isSuperAdmin) {
    return {
      status: "authorized",
      role: "admin",
      permissions: [],
      email,
      isSuperAdmin: true,
    };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) {
    return { status: "error", message: roleError.message };
  }

  const roles = (roleRows || []).map((row) => row.role);
  const resolvedRole: AdminRole | null = roles.includes("admin")
    ? "admin"
    : roles.includes("moderator")
      ? "moderator"
      : null;

  if (!resolvedRole) {
    return { status: "unauthorized", email, isSuperAdmin: false };
  }

  if (resolvedRole === "admin") {
    return {
      status: "authorized",
      role: "admin",
      permissions: [],
      email,
      isSuperAdmin,
    };
  }

  const { data: permData, error: permError } = await supabase
    .from("admin_permissions")
    .select("permissions")
    .eq("user_id", userId)
    .maybeSingle();

  if (permError) {
    return { status: "error", message: permError.message };
  }

  return {
    status: "authorized",
    role: "moderator",
    permissions: (permData?.permissions as string[]) || [],
    email,
    isSuperAdmin,
  };
}