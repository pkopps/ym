import { validateRuntimeConfiguration } from "../config/productionConfig";

const configuration = validateRuntimeConfiguration();

if (!configuration.production) {
  throw new Error("Production configuration verification requires NODE_ENV=production.");
}

console.log(
  JSON.stringify(
    {
      status: "production-configuration-ready",
      repositoryMode: configuration.repositoryMode
    },
    null,
    2
  )
);
