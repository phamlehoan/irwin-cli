import { loadDotenv } from "../loadDotenv";

loadDotenv();

const nodeEnv = process.env.NODE_ENV || "development";
const appEnv = (process.env.APP_ENV || "").trim() || nodeEnv;

export default {
  nodeEnv,
  appEnv,
  port: process.env.PORT || "8000",
  sessionSecret: process.env.SESSION_SECRET || "",
};
