import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const NEW_EMAIL = "grihanova26@gmail.com";
const NEW_PASSWORD = "Grihanova@@1122";

Deno.serve(async (_req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Ensure new super admin exists with correct password
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = usersData?.users || [];
  let newUser = allUsers.find((u) => u.email === NEW_EMAIL);

  if (newUser) {
    await supabaseAdmin.auth.admin.updateUserById(newUser.id, {
      password: NEW_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: NEW_EMAIL,
      password: NEW_PASSWORD,
      email_confirm: true,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    newUser = created.user!;
  }

  // 2. Ensure admin role
  await supabaseAdmin.from("user_roles").upsert(
    { user_id: newUser.id, role: "admin" },
    { onConflict: "user_id,role" }
  );

  // 3. Delete every other admin/moderator (user_roles + auth user)
  const { data: otherRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "moderator"])
    .neq("user_id", newUser.id);

  const deletedIds: string[] = [];
  for (const r of otherRoles || []) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", r.user_id);
    await supabaseAdmin.from("admin_permissions").delete().eq("user_id", r.user_id);
    await supabaseAdmin.auth.admin.deleteUser(r.user_id);
    deletedIds.push(r.user_id);
  }

  // 4. Also delete the legacy hard-coded super admin auth user if it still exists
  const legacy = allUsers.find((u) => u.email === "abrakibislam92@gmail.com");
  if (legacy && legacy.id !== newUser.id) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", legacy.id);
    await supabaseAdmin.from("admin_permissions").delete().eq("user_id", legacy.id);
    await supabaseAdmin.auth.admin.deleteUser(legacy.id);
    deletedIds.push(legacy.id);
  }

  return new Response(
    JSON.stringify({
      message: "Super admin reset complete",
      new_admin: { id: newUser.id, email: NEW_EMAIL },
      deleted_user_ids: deletedIds,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
