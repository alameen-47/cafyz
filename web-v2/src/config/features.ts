import { Capacitor } from "@capacitor/core";

/** Product switches for how Cafyz is sold. */

/**
 * Plan list prices in the restaurant app (License page, upgrade prompt, trial sign-up).
 * Off while Cafyz is supplied to custom clients on agreed terms; the Founder Console
 * always shows prices. Set to true to show them to restaurants again.
 */
export const SHOW_PLAN_PRICING = false;

/**
 * True inside the iPhone, iPad and Android apps. The App Store and Google Play reject apps
 * that sell, or point people at buying, outside their own billing, so the store apps only let
 * a restaurant enter a license key it already has. Requesting keys, card checkout and the plan
 * list stay on the website.
 */
export const IN_STORE_APP = Capacitor.isNativePlatform();
