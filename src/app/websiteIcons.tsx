import { TippyTopImage } from "common/api/icons";
import { fetchBinaryAsDataURL, fetchCheckCors, fetchAPI } from "./hooks/http";
import { cacheStorage } from "./storage";
import { firstPromise } from "./utils";


interface CachedIcon {
	url: string;
	fetchedAt: Date;

	/**
	 * True if the icon came from a third-party favicon service, instead of
	 * from the website itself. These are refetched more often, as the website
	 * may start providing a better icon.
	 */
	isFallback?: boolean;
}


/**
 * Whether we're running as a browser extension.
 *
 * The web version can't fetch icons from websites directly, as cross-origin
 * requests are blocked by CORS. Extensions can, when granted host permissions.
 */
const IS_WEBEXT = typeof browser !== "undefined";

const ONE_DAY_MS = 60 * 60 * 24 * 1000;
const CACHE_MAX_AGE_MS = 7 * ONE_DAY_MS;
const FALLBACK_CACHE_MAX_AGE_MS = ONE_DAY_MS;

/**
 * Third-party favicon services, used as a last resort.
 *
 * These are loaded as `<img>` sources rather than fetched, so they work
 * without CORS or host permissions.
 */
const FALLBACK_ICON_SERVICES = [
	(domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
	(domain: string) => `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`,
];

const FALLBACK_TIMEOUT_MS = 5000;


function getDomain(url: string): string {
	return new URL(url).hostname;
}


let tippytops: Promise<TippyTopImage[]> | undefined = undefined;


const ICON_SELECTORS = ([
	`link[rel="apple-touch-icon"]`,
	`link[rel="apple-touch-icon-precomposed"]`,
	`link[rel="icon shortcut"]`,
	`link[rel="shortcut icon"]`,
	`link[rel="icon"]`,
	`meta[name="apple-touch-icon"]`,
]).join(", ");


function validateIcon(res: Response) {
	const mime = res.headers.get("Content-Type");
	if (mime && !mime.startsWith("image/")) {
		throw new Error("Invalid icon");
	}
}


async function fetchTippyTops(url: string): Promise<string | undefined> {
	if (!tippytops) {
		tippytops = fetchAPI("/website-icons/", {});
	}

	const data = await tippytops;
	if (data) {
		const domain = getDomain(url);
		const icon = data.find(x => x.domains.includes(domain) ||
			x.domains.includes(`www.${domain}`) ||
			x.domains.includes(domain.replace("www.", "")));
		if (icon) {
			return await fetchBinaryAsDataURL(icon.image_url, validateIcon);
		}
	}

	return undefined;
}


async function fetchIconURL(url: string): Promise<string | undefined> {
	const response = await fetchCheckCors(new Request(url, {
		method: "GET",
		headers: {
			"Accept": "text/html",
		},
	}));

	const html = new window.DOMParser().parseFromString(
		await response.text(), "text/html");

	const icons = html.querySelectorAll(ICON_SELECTORS);

	let topScore = -1;
	let topIcon: (string | null) = null;
	for (const icon of icons.values()) {
		const href = icon.tagName.toLowerCase() == "meta"
			? icon.getAttribute("content")
			: icon.getAttribute("href");
		if (!href || href.startsWith("data:")) {
			continue;
		}

		const sizes = icon.getAttribute("sizes")
			?.split(" ")?.map(
				size => size.split("x").map(x => parseInt(x))) ?? [];

		const sizeScores = sizes.map(size => Math.min(...size));

		const score =
			(icon.getAttribute("rel")?.includes("apple-touch-icon-precomposed") ? 10 : 0) +
			(icon.getAttribute("rel")?.includes("apple-touch-icon") ? 10 : 0) +
			(href.toLowerCase().endsWith(".ico") ? 0 : 10) +
			Math.max(0, ...sizeScores);

		if (score >= topScore) {
			topScore = score;
			topIcon = href;
		}
	}

	if (!topIcon) {
		return undefined;
	}

	const ret = new URL(topIcon, response.url);
	return await fetchBinaryAsDataURL(ret.toString(), validateIcon);
}


/**
 * Loads an image URL, resolving to the URL if it loaded successfully.
 *
 * Unlike fetch(), this isn't subject to CORS, as the image is never read.
 */
function loadImage(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const image = new Image();

		const timer = setTimeout(() => {
			image.src = "";
			reject(new Error("Timed out loading icon"));
		}, FALLBACK_TIMEOUT_MS);

		image.onload = () => {
			clearTimeout(timer);
			if (image.naturalWidth > 0 && image.naturalHeight > 0) {
				resolve(url);
			} else {
				reject(new Error("Empty icon"));
			}
		};

		image.onerror = () => {
			clearTimeout(timer);
			reject(new Error("Failed to load icon"));
		};

		image.src = url;
	});
}


/**
 * Gets an icon URL from a third-party favicon service.
 *
 * Used as a last resort, as it requires sending the domain to a third-party.
 */
async function fetchFallbackIcon(url: string): Promise<string | undefined> {
	const domain = getDomain(url);
	if (domain == "" || domain == "localhost" || !domain.includes(".")) {
		return undefined;
	}

	return await firstPromise(FALLBACK_ICON_SERVICES.map(
		makeURL => () => loadImage(makeURL(domain))));
}


const SUBDOMAIN_REMOVAL = new Set([
	"feeds", "rss", "feedrss", "feedsrss", "rssfeeds", "atom"]);


function getParentDomainIfWhitelisted(urlStr: string): string | undefined {
	const url = new URL(urlStr);
	const first = url.host.split(".")[0];
	if (SUBDOMAIN_REMOVAL.has(first)) {
		url.host = url.host.substring(first.length + 1);
		url.pathname = "/";
		return url.toString();
	}

	return undefined;
}

async function fetchIcon(url: string): Promise<string | undefined> {
	const key = "favicon-" + new URL(url).hostname;

	const rootURL = new URL(url);
	rootURL.pathname = "/";

	const parentURL = getParentDomainIfWhitelisted(url)

	// Requests to other websites are blocked by CORS on the web version,
	// so don't bother making them.
	const data = await firstPromise([
		() => fetchTippyTops(url),
		IS_WEBEXT && (() => fetchIconURL(url)),
		IS_WEBEXT && url != rootURL.toString() && (() => fetchIconURL(rootURL.toString())),
		parentURL ? (() => fetchTippyTops(parentURL)) : undefined,
		IS_WEBEXT && parentURL ? (() => fetchIconURL(parentURL)) : undefined,
		IS_WEBEXT && (() => fetchBinaryAsDataURL(new URL("/favicon.ico", url).toString(), validateIcon)),
	]);
	if (data) {
		await cacheStorage.set(key, {
			url: data,
			fetchedAt: new Date(),
		});
		return data;
	}

	// Last resort: a third-party favicon service. This is loaded as an image
	// URL rather than a data URL, so that it works without CORS.
	const fallback = await fetchFallbackIcon(parentURL ?? url);
	if (fallback) {
		await cacheStorage.set(key, {
			url: fallback,
			fetchedAt: new Date(),
			isFallback: true,
		});
		return fallback;
	}
}


async function fetchIconCached(url: string): Promise<string | undefined> {
	const key = "favicon-" + new URL(url).hostname;
	const value = await cacheStorage.get<CachedIcon>(key);
	if (value) {
		const now = new Date();
		const maxAge = value.isFallback
			? FALLBACK_CACHE_MAX_AGE_MS
			: CACHE_MAX_AGE_MS;
		if (now.valueOf() > value.fetchedAt.valueOf() + maxAge) {
			// Update cache in background
			console.log("Website icon is stale, updating in the background")
			cacheStorage.remove(key);
			fetchIcon(url).catch(console.error);
		}
		return value.url;
	}

	return await fetchIcon(url);
}


const cache = new Map<string, Promise<string | undefined>>();

function getWebsiteIcon(url: string): Promise<string | undefined> {
	try {
		const key = getDomain(url);
		if (!cache.has(key)) {
			cache.set(key, fetchIconCached(url));
		}

		return cache.get(key)!;
	} catch (e) {
		return Promise.reject(e);
	}
}


export async function getWebsiteIconOrNull(url: (string | undefined)): Promise<(string | undefined)> {
	if (url == "" || url == undefined) {
		return undefined;
	}

	try {
		return await getWebsiteIcon(url);
	} catch (e) {
		console.error(e);
		return undefined;
	}
}


export function clearWebsiteIcons() {
	cache.clear();
}
