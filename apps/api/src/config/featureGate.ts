import { launchFeatureForApiPath, type LaunchFeatureFlags } from "@yardmatch/contracts";
import { HttpError, type RequestContext } from "../http";

/** Disabled launch features answer like unknown routes so clients never see a partial surface. */
export function enforceLaunchFeatureFlags(context: Pick<RequestContext, "path">, features: LaunchFeatureFlags): void {
  const feature = launchFeatureForApiPath(context.path);
  if (feature && !features[feature]) {
    throw new HttpError(404, "Route not found");
  }
}
