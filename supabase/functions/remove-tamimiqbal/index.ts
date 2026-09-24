import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TARGET_EMAIL = "tamimiqbal.stepup@gmail.com";

Deno.serve(async (_req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const user = usersData?.users?.find(
    (u) => (u.email || "").toLowerCase() === TARGET_EMAIL.toLowerCase()
  );

  if (!user) {
    return new Response(
      JSON.stringify({ message: "User not found", email: TARGET_EMAIL }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id);
  await supabaseAdmin.from("admin_permissions").delete().eq("user_id", user.id);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(
    JSON.stringify({ message: "Removed", user_id: user.id, email: TARGET_EMAIL }),
    { headers: { "Content-Type": "application/json" } }
  );
});
