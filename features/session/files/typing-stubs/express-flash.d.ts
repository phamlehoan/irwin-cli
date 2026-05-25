declare module "express-flash" {
  function flash(): import("express").RequestHandler;
  export = flash;
}
