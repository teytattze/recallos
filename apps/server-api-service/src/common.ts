import {
  createCommonHttpApp,
  getCommonHttpConfig,
} from "@repo/server-platform";

const commonHttpApp = createCommonHttpApp();
const commonHttpConfig = getCommonHttpConfig();

export { commonHttpApp, commonHttpConfig };
