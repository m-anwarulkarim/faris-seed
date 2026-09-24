// 🔒 DO_NOT_MODIFY: Admin role management, user_type changes, force-logout — full file locked. Modify only with explicit user permission.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPER_ADMIN_EMAILS = ["grihanova26@gmail.com", "dev.anwarul@gmail.com", "farisseed@gmail.com"];
const HIDDEN_ADMIN_EMAILS = ["dev.anwarul@gmail.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user: caller },
  } = await supabaseAdmin.auth.getUser(token);

  if (!caller) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: callerRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .in("role", ["admin", "moderator"])
    .single();

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(caller.email as string);
  if (!callerRole && !isSuperAdmin) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  let requestBody: Record<string, any>;
  try {
    requestBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { action, ...body } = requestBody;

  // LIST all admins
  if (action === "list") {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    const userIds = roles?.map((r: any) => r.user_id) || [];

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const allUsers = usersData?.users || [];

    const admins = allUsers
      .filter((u: any) => userIds.includes(u.id) || SUPER_ADMIN_EMAILS.includes(u.email as string))
      .filter((u: any) => !HIDDEN_ADMIN_EMAILS.includes((u.email || "").toLowerCase()))
      .map((u: any) => {
        const role = roles?.find((r: any) => r.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          role: role?.role || (SUPER_ADMIN_EMAILS.includes(u.email as string) ? "admin" : "user"),
          user_metadata: u.user_metadata || {},
        };
      });

    const permissionUserIds = admins.map((a: any) => a.id);
    const { data: permissions } = permissionUserIds.length
      ? await supabaseAdmin
          .from("admin_permissions")
          .select("*")
          .in("user_id", permissionUserIds)
      : { data: [] as any[] };

    const result = admins.map((a: any) => ({
      ...a,
      permissions: permissions?.find((p: any) => p.user_id === a.id)?.permissions || [],
    }));

    return jsonResponse(result);
  }

  // CREATE new admin
  if (action === "create") {
    const { email, password, role, permissions, name, photo_url, id_card, join_date } = body;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name || "",
        avatar_url: photo_url || "",
        id_card: id_card || "",
        join_date: join_date || "",
      },
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    await supabaseAdmin.from("user_roles").insert({
      user_id: data.user.id,
      role: role || "moderator",
    });

    if (permissions && permissions.length > 0) {
      await supabaseAdmin.from("admin_permissions").insert({
        user_id: data.user.id,
        permissions,
      });
    }

    return jsonResponse({ message: "Admin created", user_id: data.user.id });
  }

  // UPDATE admin profile / metadata
  if (action === "update") {
    const { user_id, name, photo_url, id_card, join_date, role, permissions } = body;
    if (!user_id) return jsonResponse({ error: "user_id required" }, 400);

    // Update user metadata (merge with existing)
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const existingMeta = existingUser?.user?.user_metadata || {};
    const updateMeta: Record<string, any> = { ...existingMeta };
    if (name !== undefined) updateMeta.full_name = name;
    if (photo_url !== undefined) updateMeta.avatar_url = photo_url;
    if (id_card !== undefined) updateMeta.id_card = id_card;
    if (join_date !== undefined) updateMeta.join_date = join_date;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: updateMeta,
    });
    if (error) return jsonResponse({ error: error.message }, 400);

    // Update role if provided (don't change super admin role)
    if (role && !SUPER_ADMIN_EMAILS.includes(existingUser?.user?.email as string)) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id, role },
        { onConflict: "user_id,role" }
      );
    }

    // Update permissions if provided
    if (permissions !== undefined) {
      await supabaseAdmin.from("admin_permissions").upsert(
        { user_id, permissions, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }

    return jsonResponse({ message: "Admin updated" });
  }

  // UPDATE permissions
  if (action === "update_permissions") {
    const { user_id, permissions } = body;

    await supabaseAdmin.from("admin_permissions").upsert(
      { user_id, permissions, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return jsonResponse({ message: "Permissions updated" });
  }

  // DELETE admin
  if (action === "delete") {
    const { user_id } = body;

    // Don't allow deleting super admin
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (SUPER_ADMIN_EMAILS.includes(targetUser?.user?.email as string)) {
      return jsonResponse({ error: "Cannot delete super admin" }, 403);
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    await supabaseAdmin.from("admin_permissions").delete().eq("user_id", user_id);
    await supabaseAdmin.auth.admin.deleteUser(user_id);

    return jsonResponse({ message: "Admin deleted" });
  }

  // LOOKUP admin name by user_id
  if (action === "lookup") {
    const { user_id } = body;
    if (!user_id) return jsonResponse({ error: "user_id required" }, 400);
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (!targetUser?.user) return jsonResponse({ name: null, photo: null });
    const name = targetUser.user.user_metadata?.full_name || targetUser.user.email || null;
    const photo = targetUser.user.user_metadata?.avatar_url || null;
    return jsonResponse({ name, photo });
  }

  return jsonResponse({ error: "Invalid action" }, 400);
});
