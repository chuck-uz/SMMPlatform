import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyCredentials } from "@/lib/verifyCredentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) =>
        verifyCredentials(credentials?.email, credentials?.password, (email) =>
          prisma.user.findUnique({ where: { email } }),
        ),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        return token;
      }
      // On every subsequent request, re-validate the account against the DB so
      // that deactivating a user (or changing their role) takes effect on their
      // next request instead of persisting for the JWT's 30-day lifetime.
      // Returning null clears the session cookie (see @auth/core session action).
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
        if (!dbUser || !dbUser.isActive) return null;
        token.role = dbUser.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.role = token.role as string | undefined;
        session.user.id = token.sub;
      }
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
