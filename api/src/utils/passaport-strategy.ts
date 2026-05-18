import passport from "passport";
import passportJWT from "passport-jwt";
import { userRepository } from "@repository";

const JWTStrategy = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;

const secretOrKey = process.env.SECRET_KEY;
if (!secretOrKey) {
  throw new Error(
    "SECRET_KEY environment variable is required. " +
      "Use the app's CLIENT_SECRET in production, or 'THE_SECRET' in developer mode."
  );
}
if (process.env.NODE_ENV === "production" && secretOrKey === "THE_SECRET") {
  throw new Error(
    "SECRET_KEY=THE_SECRET is only valid in developer mode. " +
      "Set it to the app's CLIENT_SECRET in production."
  );
}

passport.use(
  new JWTStrategy(
    {
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey,
    },
    async (jwtPayload, done) => {
      try {
        const user = await userRepository.findOne(jwtPayload.storeId);
        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);
