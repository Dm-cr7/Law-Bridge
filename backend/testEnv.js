import dotenv from "dotenv";
dotenv.config();

console.log(process.env.CLOUDFLARE_ACCESS_KEY_ID);
console.log(process.env.CLOUDFLARE_BUCKET_NAME);
console.log(process.env.CLOUDFLARE_ENDPOINT);
