import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth.ts";

type AuthEnv = {
  Variables: {
    session: typeof auth.$Infer.Session;
  };
};

export const requireSession = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  c.set("session", session);
  await next();
});
