// Check if server can see environment variables correctly
import "dotenv/config";

console.log("Server Environment Variables Check:");
console.log("=====================================\n");

const requiredVars = [
  "ODOO_URL",
  "ODOO_DB",
  "ODOO_LOGIN",
  "ODOO_PASSWORD",
];

let allPresent = true;

for (const varName of requiredVars) {
  const value = process.env[varName];
  if (varName === "ODOO_PASSWORD" && value) {
    console.log(`✅ ${varName}: SET (length: ${value.length})`);
  } else if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allPresent = false;
  }
}

console.log();

if (allPresent) {
  console.log("✅ All required Odoo variables are present");
  console.log("\nThe server should be able to authenticate with Odoo.");
  console.log("Make sure to restart the server if it's running.");
} else {
  console.log("❌ Some variables are missing!");
}
