const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

function getLanIps() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const info of nets[name] ?? []) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push({ address: info.address, name });
      }
    }
  }
  return addresses;
}

const lanIps = getLanIps();
const lanIpAddresses = lanIps.map((info) => info.address);
const physicalLanIps = lanIps
  .filter((info) => !/(vEthernet|VMware|VirtualBox|Docker|Hyper-V|Loopback)/i.test(info.name))
  .map((info) => info.address);
const env = { ...process.env };
if (lanIpAddresses.length > 0) {
  env.NEXT_ALLOWED_DEV_ORIGINS = lanIpAddresses.join(",");
  console.log("Using NEXT_ALLOWED_DEV_ORIGINS:", env.NEXT_ALLOWED_DEV_ORIGINS);
} else {
  console.warn("No LAN IPs found. NEXT_ALLOWED_DEV_ORIGINS not set.");
}

const preferredLanIp = env.ALBUMATLAS_LAN_IP
  || physicalLanIps[0]
  || lanIpAddresses[0]
  || "localhost";

// Keep browser requests same-origin (/api/...) so mobile browsers do not have
// to trust the backend certificate on :4000 separately.
env.NEXT_PUBLIC_API_URL = "";
env.INTERNAL_API_URL = env.INTERNAL_API_URL || "http://127.0.0.1:4001";
env.NODE_EXTRA_CA_CERTS = env.NODE_EXTRA_CA_CERTS || path.resolve("certs/cert.pem");

console.log("Proxying API through INTERNAL_API_URL:", env.INTERNAL_API_URL);
console.log("Trusting local dev certificate:", env.NODE_EXTRA_CA_CERTS);
console.log(`Open on this machine or phone: https://${preferredLanIp}:3000`);

const child = spawn(
  "next",
  [
    "dev",
    "--hostname",
    "0.0.0.0",
    "--experimental-https",
    "--experimental-https-key",
    "certs/key.pem",
    "--experimental-https-cert",
    "certs/cert.pem",
  ],
  { stdio: "inherit", env, shell: true },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
