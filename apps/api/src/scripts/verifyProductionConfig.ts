import { validateRuntimeConfiguration } from "../config/productionConfig";

const configuration = validateRuntimeConfiguration();

if (!configuration.deployed) {
  throw new Error("Deployment configuration verification requires staging or production.");
}

console.log(
  JSON.stringify(
    {
      status: `${configuration.deploymentEnvironment}-configuration-ready`,
      environment: configuration.deploymentEnvironment,
      repositoryMode: configuration.repositoryMode
    },
    null,
    2
  )
);
