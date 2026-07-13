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
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
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
