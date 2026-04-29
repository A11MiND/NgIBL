import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { verifyOneForAllLaunchToken } from "@/lib/oneforall-launch-token"
import { provisionOneForAllUser } from "@/lib/oneforall-jit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const ssoToken = typeof credentials?.ssoToken === "string" ? credentials.ssoToken : ""
        if (ssoToken) {
          try {
            const claims = verifyOneForAllLaunchToken(ssoToken)
            const { user } = await provisionOneForAllUser(claims)
            return user
          } catch (error) {
            console.log("SSO launch failed:", error instanceof Error ? error.message : error)
            return null
          }
        }

        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);
 
        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            console.log("User not found:", email);
            return null;
          }
          const passwordsMatch = await bcrypt.compare(password, user.password);
 
          if (passwordsMatch) return user;
          console.log("Password mismatch for user:", email);
        } else {
          console.log("Invalid credentials format");
        }
 
        return null;
      },
    }),
  ],
})
