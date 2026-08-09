import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const requireReleaseEnvironment = process.env.YARDMATCH_REQUIRE_MOBILE_RELEASE_ENV === "1";

const allApplications = [
  {
    key: "customer",
    directory: "apps/customer-mobile",
    slug: "yardmatch-customer",
    scheme: "yardmatch-customer",
    iosBundleIdentifier: "com.patrickkopps.yardmatch.customer",
    androidPackage: "com.yardmatch.customer",
    projectIdEnvironmentKey: "YARDMATCH_CUSTOMER_EXPO_PROJECT_ID"
  },
  {
    key: "provider",
    directory: "apps/provider-mobile",
    slug: "yardmatch-provider",
    scheme: "yardmatch-provider",
    iosBundleIdentifier: "com.yardmatch.provider",
    androidPackage: "com.yardmatch.provider",
    projectIdEnvironmentKey: "YARDMATCH_PROVIDER_EXPO_PROJECT_ID"
  },
  {
    key: "crew",
    directory: "apps/crew-mobile",
    slug: "yardmatch-crew",
    scheme: "yardmatch-crew",
    iosBundleIdentifier: "com.yardmatch.crew",
    androidPackage: "com.yardmatch.crew",
    projectIdEnvironmentKey: "YARDMATCH_CREW_EXPO_PROJECT_ID"
  }
];
const selectedApplication = process.env.YARDMATCH_MOBILE_APP?.trim();
const applications = selectedApplication
  ? allApplications.filter((application) => application.key === selectedApplication)
  : allApplications;

const problems = [];
const seenSlugs = new Set();
const seenSchemes = new Set();
const seenIosBundleIdentifiers = new Set();
const seenAndroidPackages = new Set();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (selectedApplication && applications.length === 0) {
  problems.push("YARDMATCH_MOBILE_APP must be customer, provider, or crew.");
}

function check(condition, message) {
  if (!condition) {
    problems.push(message);
  }
}

function checkUnique(collection, value, label) {
  check(!collection.has(value), `${label} must be unique across YardMatch mobile apps.`);
  collection.add(value);
}

function loadAppConfig(application, projectId) {
  const configPath = resolve(repositoryRoot, application.directory, "app.config.js");
  const previousEnvironment = {
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_EXPO_PROJECT_ID: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
    EXPO_PUBLIC_YARDMATCH_ENV: process.env.EXPO_PUBLIC_YARDMATCH_ENV
  };

  process.env.EXPO_PUBLIC_API_BASE_URL =
    process.env.STAGING_API_BASE_URL ?? "https://api.staging.yardmatch.test";
  process.env.EXPO_PUBLIC_EXPO_PROJECT_ID = projectId;
  process.env.EXPO_PUBLIC_YARDMATCH_ENV = "staging";
  delete require.cache[require.resolve(configPath)];
  const config = require(configPath).expo;

  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return config;
}

for (const application of applications) {
  const configuredProjectId = process.env[application.projectIdEnvironmentKey]?.trim();
  if (requireReleaseEnvironment) {
    check(
      Boolean(configuredProjectId && uuidPattern.test(configuredProjectId)),
      `${application.projectIdEnvironmentKey} must be a valid Expo project UUID.`
    );
  }
  const projectId = configuredProjectId && uuidPattern.test(configuredProjectId)
    ? configuredProjectId
    : `00000000-0000-4000-8000-00000000000${allApplications.indexOf(application) + 1}`;
  const config = loadAppConfig(application, projectId);
  const eas = JSON.parse(
    readFileSync(resolve(repositoryRoot, application.directory, "eas.json"), "utf8")
  );

  check(config.slug === application.slug, `${application.key} app slug must remain ${application.slug}.`);
  check(config.scheme === application.scheme, `${application.key} OAuth scheme must remain ${application.scheme}.`);
  check(
    config.ios?.bundleIdentifier === application.iosBundleIdentifier,
    `${application.key} iOS bundle identifier must match its checked-in native project.`
  );
  check(
    config.android?.package === application.androidPackage,
    `${application.key} Android application ID is missing or unexpected.`
  );
  check(/^\d+\.\d+\.\d+$/.test(config.version ?? ""), `${application.key} version must be semantic.`);
  check(config.extra?.eas?.projectId === projectId, `${application.key} must expose its EAS project ID.`);
  const imagePickerPlugin = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker"
  );
  check(
    Array.isArray(imagePickerPlugin) && imagePickerPlugin[1]?.microphonePermission === false,
    `${application.key} photo capture must not request microphone access.`
  );
  checkUnique(seenSlugs, config.slug, "Expo slug");
  checkUnique(seenSchemes, config.scheme, "OAuth scheme");
  checkUnique(seenIosBundleIdentifiers, config.ios.bundleIdentifier, "iOS bundle identifier");
  checkUnique(seenAndroidPackages, config.android.package, "Android application ID");

  const profiles = eas.build ?? {};
  check(profiles.development?.environment === "development", `${application.key} development profile needs the development EAS environment.`);
  check(profiles.development?.env?.YARDMATCH_APS_ENVIRONMENT === "development", `${application.key} development profile must use APNs development.`);
  check(profiles.preview?.distribution === "internal", `${application.key} preview profile must use internal distribution.`);
  check(profiles.preview?.environment === "preview", `${application.key} preview profile needs the preview EAS environment.`);
  check(profiles.preview?.env?.YARDMATCH_APS_ENVIRONMENT === "production", `${application.key} signed preview profile must use APNs production.`);
  check(profiles.preview?.android?.buildType === "apk", `${application.key} preview Android build must be an installable APK.`);
  check(profiles["preview-simulator"]?.ios?.simulator === true, `${application.key} needs an iOS simulator preview profile.`);
  check(profiles["store-test"]?.distribution === "store", `${application.key} store-test profile must create store binaries.`);
  check(profiles["store-test"]?.environment === "preview", `${application.key} store-test profile must use staging/preview variables.`);
  check(profiles["store-test"]?.env?.EXPO_PUBLIC_YARDMATCH_ENV === "staging", `${application.key} store-test profile must target YardMatch staging.`);
  check(profiles["store-test"]?.env?.YARDMATCH_APS_ENVIRONMENT === "production", `${application.key} store-test profile must use APNs production.`);
  check(profiles.production?.environment === "production", `${application.key} production profile needs the production EAS environment.`);
  check(profiles.production?.env?.EXPO_PUBLIC_YARDMATCH_ENV === "production", `${application.key} production profile must target YardMatch production.`);
  check(profiles.production?.env?.YARDMATCH_APS_ENVIRONMENT === "production", `${application.key} production profile must use APNs production.`);
  check(profiles.production?.autoIncrement === true, `${application.key} production versions must auto-increment.`);
  check(eas.submit?.["store-test"]?.android?.track === "internal", `${application.key} Android store-test submissions must target the internal track.`);
  check(eas.submit?.["store-test"]?.android?.releaseStatus === "draft", `${application.key} Android store-test submissions must remain draft until reviewed.`);

  const nativeProductName = `YardMatch${application.key[0].toUpperCase()}${application.key.slice(1)}`;
  const nativeProjectPath = resolve(
    repositoryRoot,
    application.directory,
    "ios",
    `${nativeProductName}.xcodeproj`,
    "project.pbxproj"
  );
  const nativeProject = readFileSync(nativeProjectPath, "utf8");
  check(
    nativeProject.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${application.iosBundleIdentifier};`),
    `${application.key} native iOS bundle identifier disagrees with app.config.js.`
  );
  check(
    nativeProject.includes("APS_ENVIRONMENT = development;") &&
      nativeProject.includes("APS_ENVIRONMENT = production;"),
    `${application.key} native iOS project must separate debug and signed-build APNs environments.`
  );
  const nativeInfo = readFileSync(
    resolve(repositoryRoot, application.directory, "ios", nativeProductName, "Info.plist"),
    "utf8"
  );
  check(nativeInfo.includes("NSCameraUsageDescription"), `${application.key} iOS camera permission copy is missing.`);
  check(nativeInfo.includes("NSPhotoLibraryUsageDescription"), `${application.key} iOS photo-library permission copy is missing.`);
  check(!nativeInfo.includes("NSMicrophoneUsageDescription"), `${application.key} iOS must not request unused microphone access.`);
  const nativeEntitlements = readFileSync(
    resolve(repositoryRoot, application.directory, "ios", nativeProductName, `${nativeProductName}.entitlements`),
    "utf8"
  );
  check(
    nativeEntitlements.includes("$(APS_ENVIRONMENT)"),
    `${application.key} push entitlement must follow the Xcode build environment.`
  );
}

if (requireReleaseEnvironment) {
  const stagingApiBaseUrl = process.env.STAGING_API_BASE_URL?.trim() ?? "";
  check(stagingApiBaseUrl.startsWith("https://"), "STAGING_API_BASE_URL must be HTTPS for mobile release builds.");
}

if (problems.length > 0) {
  throw new Error(`Unsafe mobile release configuration:\n- ${problems.join("\n- ")}`);
}

console.log(JSON.stringify({
  status: requireReleaseEnvironment ? "mobile-release-environment-ready" : "mobile-release-config-ready",
  apps: applications.map((application) => application.key),
  profiles: ["development", "preview", "preview-simulator", "store-test", "production"]
}, null, 2));
