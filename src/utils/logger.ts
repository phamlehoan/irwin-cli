const useColor = process.stdout.isTTY;

export const log = {
  info(msg: string) {
    console.log(msg);
  },
  success(msg: string) {
    console.log(useColor ? `\x1b[32m${msg}\x1b[0m` : msg);
  },
  warn(msg: string) {
    console.warn(useColor ? `\x1b[33m${msg}\x1b[0m` : msg);
  },
  error(msg: string) {
    console.error(useColor ? `\x1b[31m${msg}\x1b[0m` : msg);
  },
};
