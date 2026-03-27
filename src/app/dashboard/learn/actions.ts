"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

export async function createQuizResultNotification(input: {
  quizTitle: string;
  score: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  const { error } = await admin.from("notifications").insert({
    user_id: user.id,
    title: "Quiz result",
    message: `You scored ${input.score.toFixed(0)}% in ${input.quizTitle}.`,
    type: "quiz_result",
    is_read: false,
  });
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

