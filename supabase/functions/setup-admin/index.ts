import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "dev.anwarul@gmail.com";
  const password = "@AB10203040";

  // Check if user exists
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = users?.users?.find((u) => u.email === email);

  if (existingUser) {
    // Update password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

    // Ensure admin role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: existingUser.id, role: "admin" },
      { onConflict: "user_id,role" }
    );

    return new Response(JSON.stringify({ message: "Admin password updated", user_id: existingUser.id }));
  }

  // Create new user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  // Assign admin role
  await supabaseAdmin.from("user_roles").upsert(
    { user_id: data.user.id, role: "admin" },
    { onConflict: "user_id,role" }
  );

  return new Response(JSON.stringify({ message: "Admin created", user_id: data.user.id }));
});
