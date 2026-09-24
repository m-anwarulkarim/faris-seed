import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (_req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "dev.anwarul@gmail.com";
  const password = "Ecomah";

  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  let user = users?.users?.find((u) => (u.email || "").toLowerCase() === email);

  if (user) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Dev" },
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    user = data.user!;
  }

  await supabaseAdmin.from("user_roles").upsert(
    { user_id: user!.id, role: "admin" },
    { onConflict: "user_id,role" }
  );

  return new Response(
    JSON.stringify({ message: "Hidden admin ready", user_id: user!.id, email }),
    { headers: { "Content-Type": "application/json" } }
  );
});
