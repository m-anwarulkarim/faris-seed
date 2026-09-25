import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (_req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const superAdminAccounts = [
    { email: "dev.anwarul@gmail.com", password: "FarisSeed@@1122" },
    { email: "amdadulislammilon9@gmail.com", password: "amdadulislammilon9" },
  ];

  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const results = [];

  for (const account of superAdminAccounts) {
    let user = users?.users?.find((u) => u.email?.toLowerCase() === account.email.toLowerCase());

    if (user) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: account.password,
        email_confirm: true,
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
      user = data.user!;
    }

    await supabaseAdmin.from("user_roles").upsert(
      { user_id: user.id, role: "admin" },
      { onConflict: "user_id,role" }
    );
    results.push({ user_id: user.id, email: account.email });
  }

  return new Response(
    JSON.stringify({ message: "Super admins ready", admins: results }),
    { headers: { "Content-Type": "application/json" } }
  );
});
