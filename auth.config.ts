import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.lastEmailVerification = (
          user as { lastEmailVerification?: Date | null }
        ).lastEmailVerification;
      }

      if (trigger === "update" && session?.lastEmailVerification) {
        token.lastEmailVerification = session.lastEmailVerification;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (
          session.user as { lastEmailVerification?: Date | null }
        ).lastEmailVerification = token.lastEmailVerification as Date | null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
