import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rawHostname =
  String(process.env.API_HOSTNAME || "").trim();

if (!rawHostname) {
  throw new Error(
    "API_HOSTNAME 환경변수가 없습니다. Render Blueprint 설정을 확인하세요."
  );
}

const apiBaseUrl =
  /^https?:\/\//i.test(rawHostname)
    ? rawHostname.replace(/\/$/, "")
    : `https://${rawHostname.replace(/\/$/, "")}`;

const configPath =
  fileURLToPath(
    new URL("./config.js", import.meta.url)
  );

writeFileSync(
  configPath,
  `window.APP_CONFIG = ${JSON.stringify(
    { API_BASE_URL: apiBaseUrl },
    null,
    2
  )};\n`,
  "utf8"
);

console.log(
  `Frontend API URL configured: ${apiBaseUrl}`
);
