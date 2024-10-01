export async function getCodeContext(packageInfo) {
  return `The project is named ${packageInfo.name} and uses dependencies: ${Object.keys(packageInfo.dependencies).join(", ")}. It follows the linting rules defined in ${packageInfo.scripts?.lint || "N/A"}.`;
}
