import { WEB_APP_URL_ENV } from "../constants/qr-code.ts";

/**
 * The web app base URL from the environment. Throws when it is missing, not an
 * absolute HTTP(S) URL, or carries credentials, a query or a fragment.
 */
export function readWebAppUrl(): URL {
  const raw = Deno.env.get(WEB_APP_URL_ENV);
  if (!raw) throw new Error(`${WEB_APP_URL_ENV} is not set.`);

  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${WEB_APP_URL_ENV} must use HTTP or HTTPS.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${WEB_APP_URL_ENV} must not contain credentials, a query or a fragment.`,
    );
  }
  return url;
}

/** `<web app>/services/<serviceId>?code=<code>`: the page a voucher QR code opens. */
export function buildRedemptionUrl(
  webAppUrl: URL,
  serviceId: string,
  code: string,
): string {
  const base = webAppUrl.href.endsWith("/")
    ? webAppUrl.href
    : `${webAppUrl.href}/`;
  const destination = new URL(`services/${serviceId}`, base);
  destination.searchParams.set("code", code);
  return destination.toString();
}
