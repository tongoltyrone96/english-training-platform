import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
});

export const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(60),
  invitationCode: z.string().trim().min(8).max(128),
});
