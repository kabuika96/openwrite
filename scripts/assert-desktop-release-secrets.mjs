const requiredSigning = ["CSC_LINK", "CSC_KEY_PASSWORD"];
const missingSigning = requiredSigning.filter((name) => !process.env[name]);

const hasAppleIdCredentials =
  Boolean(process.env.APPLE_ID) &&
  Boolean(process.env.APPLE_APP_SPECIFIC_PASSWORD) &&
  Boolean(process.env.APPLE_TEAM_ID);

const hasApiKeyCredentials =
  Boolean(process.env.APPLE_API_KEY) &&
  Boolean(process.env.APPLE_API_KEY_ID) &&
  Boolean(process.env.APPLE_API_ISSUER);

const hasKeychainCredentials = Boolean(process.env.APPLE_KEYCHAIN_PROFILE);

const missing = [...missingSigning];
if (!hasAppleIdCredentials && !hasApiKeyCredentials && !hasKeychainCredentials) {
  missing.push(
    "APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER, or APPLE_KEYCHAIN_PROFILE",
  );
}

if (missing.length > 0) {
  console.error("Missing required desktop release signing/notarization environment:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Desktop release signing/notarization environment is present.");
