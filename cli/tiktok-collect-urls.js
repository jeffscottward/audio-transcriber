#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium, firefox, webkit } = require("playwright");

const BROWSER_MAP = { chromium, firefox, webkit };
const DEFAULT_SCROLL_DELAY_MS = 1200;
const DEFAULT_IDLE_LIMIT = 12;
const DEFAULT_LOAD_WAIT_MS = 3500;
const BOOLEAN_FLAGS = new Set([
	"auto-login",
	"autologin",
	"login",
	"append",
	"headless",
	"skip-login-prompt",
	"debug",
]);
const DOTENV_PATHS = [
	path.resolve(process.cwd(), ".env"),
	path.resolve(__dirname, "..", ".env"),
];

function randomBetween(min, max) {
	const low = Math.ceil(min);
	const high = Math.floor(max);
	return Math.floor(Math.random() * (high - low + 1)) + low;
}

async function typeWithHumanDelay(scope, handle, value) {
	await handle.focus().catch(() => {});
	await handle
		.evaluate((element) => {
			element.value = "";
			const event = new Event("input", { bubbles: true });
			element.dispatchEvent(event);
		})
		.catch(() => {});
	await scope.waitForTimeout(randomBetween(250, 400));
	for (const char of value) {
		await handle.type(char, { delay: randomBetween(110, 190) }).catch(() => {});
	}
	await scope.waitForTimeout(randomBetween(250, 400));
}

function loadEnvFiles() {
	for (const candidate of DOTENV_PATHS) {
		if (!candidate) continue;
		try {
			if (!fs.existsSync(candidate)) continue;
			const content = fs.readFileSync(candidate, "utf8");
			content.split(/\r?\n/).forEach((line) => {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) return;
				const eqIndex = trimmed.indexOf("=");
				if (eqIndex === -1) return;
				const key = trimmed.slice(0, eqIndex).trim();
				if (!key || Object.prototype.hasOwnProperty.call(process.env, key))
					return;
				let value = trimmed.slice(eqIndex + 1).trim();
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				process.env[key] = value;
			});
		} catch (err) {
			console.warn(`Failed to parse env file at ${candidate}:`, err.message);
		}
	}
}

loadEnvFiles();

const DEFAULT_VIEWPORT = { width: 1365, height: 768 };
const DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.88 Safari/537.36";

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function configurePage(page, timeoutMs) {
	if (!page) return;
	if (typeof page.setDefaultNavigationTimeout === "function") {
		page.setDefaultNavigationTimeout(timeoutMs);
	}
	if (typeof page.setDefaultTimeout === "function") {
		page.setDefaultTimeout(timeoutMs);
	}
}

function parseArgs(argv) {
	const parsed = { _: [] };
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === "--") {
			continue;
		}
		if (!token.startsWith("-")) {
			parsed._.push(token);
			continue;
		}

		const isLong = token.startsWith("--");
		const cleanToken = token.replace(/^--?/, "");
		if (isLong && token.includes("=")) {
			const [flag, value] = cleanToken.split(/=(.*)/, 2);
			if (BOOLEAN_FLAGS.has(flag)) {
				parsed[flag] = !/^(false|0|off|no)$/i.test(value);
			} else {
				parsed[flag] = value;
			}
			continue;
		}

		const next = argv[i + 1];
		if (!BOOLEAN_FLAGS.has(cleanToken) && next && !next.startsWith("-")) {
			parsed[cleanToken] = next;
			i += 1;
		} else {
			parsed[cleanToken] = BOOLEAN_FLAGS.has(cleanToken)
				? true
				: (parsed[cleanToken] ?? true);
		}
	}

	if (Array.isArray(parsed._) && parsed._.length) {
		const positional = [];
		for (const entry of parsed._) {
			if (typeof entry !== "string") {
				positional.push(entry);
				continue;
			}

			if (entry.startsWith("--")) {
				const key = entry.slice(2);
				if (BOOLEAN_FLAGS.has(key)) {
					if (typeof parsed[key] === "undefined") {
						parsed[key] = true;
					}
					continue;
				}
			} else if (entry.startsWith("-")) {
				const key = entry.slice(1);
				if (BOOLEAN_FLAGS.has(key)) {
					if (typeof parsed[key] === "undefined") {
						parsed[key] = true;
					}
					continue;
				}
			}

			positional.push(entry);
		}

		parsed._ = positional;
	}

	return parsed;
}

function buildProfileUrl(input) {
	if (!input) return null;
	const trimmed = input.trim();
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	const username = trimmed.replace(/^@/, "");
	return `https://www.tiktok.com/@${username}`;
}

function extractProfileSlug(profileUrl) {
	const match = profileUrl.match(/\/(@[^/?]+)/);
	return match ? match[1].replace(/^@/, "") : "tiktok-user";
}

async function promptToContinue(message) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	await new Promise((resolve) => rl.question(message, resolve));
	rl.close();
}

async function detectLoginElements(page) {
	return page.evaluate(() => {
		const candidates = Array.from(document.querySelectorAll("a, button"));
		return candidates.some((node) => {
			if (!node || !node.textContent) return false;
			const text = node.textContent.trim().toLowerCase();
			if (!text) return false;
			if (text === "log in" || text === "login") return true;
			if (text.includes("sign up") || text.includes("sign in")) return true;
			const dataE2E = node.getAttribute("data-e2e") || "";
			if (dataE2E.includes("login") || dataE2E.includes("signup")) return true;
			const href = node.getAttribute("href") || "";
			return /login|signup/.test(href);
		});
	});
}

async function assertLoggedIn(
	page,
	message = "Authentication is still required.",
) {
	const loginElementsVisible = await detectLoginElements(page).catch(
		() => false,
	);
	if (loginElementsVisible) {
		throw new Error(message);
	}
}

async function applyStealthTweaks(context) {
	if (!context) return;
	await context.addInitScript(() => {
		Object.defineProperty(navigator, "webdriver", {
			get: () => undefined,
		});
		window.navigator.chrome = window.navigator.chrome || { runtime: {} };
		Object.defineProperty(navigator, "plugins", {
			get: () => [1, 2, 3],
		});
		Object.defineProperty(navigator, "languages", {
			get: () => ["en-US", "en"],
		});
		const originalQuery = window.navigator.permissions?.query;
		if (originalQuery) {
			window.navigator.permissions.query = (parameters) => {
				if (parameters && parameters.name === "notifications") {
					return Promise.resolve({ state: "denied" });
				}
				return originalQuery(parameters);
			};
		}
	});
}

async function openContext(browserChoice, headless, userDataDir) {
	const browserFactory = BROWSER_MAP[browserChoice];
	if (!browserFactory) {
		throw new Error(
			`Unsupported browser "${browserChoice}". Use chromium, firefox, or webkit.`,
		);
	}

	const launchArgs = [
		"--disable-blink-features=AutomationControlled",
		"--disable-infobars",
		"--start-maximized",
		"--disable-dev-shm-usage",
		"--no-first-run",
		"--password-store=basic",
		"--use-mock-keychain",
	];

	const contextOptions = {
		viewport: DEFAULT_VIEWPORT,
		userAgent: DEFAULT_USER_AGENT,
		locale: "en-US",
		timezoneId: "America/New_York",
		hasTouch: false,
		colorScheme: "light",
	};

	if (userDataDir) {
		const resolvedDir = path.resolve(userDataDir);
		const persistentContext = await browserFactory.launchPersistentContext(
			resolvedDir,
			{
				headless,
				viewport: DEFAULT_VIEWPORT,
				userAgent: DEFAULT_USER_AGENT,
				locale: "en-US",
				timezoneId: "America/New_York",
				args: launchArgs,
			},
		);
		await applyStealthTweaks(persistentContext);
		await persistentContext
			.grantPermissions(["clipboard-read", "clipboard-write"], {
				origin: "https://www.tiktok.com",
			})
			.catch(() => {});
		return persistentContext;
	}

	const browser = await browserFactory.launch({ headless, args: launchArgs });
	const context = await browser.newContext(contextOptions);
	context._shouldClose = true;
	await applyStealthTweaks(context);
	await context
		.grantPermissions(["clipboard-read", "clipboard-write"], {
			origin: "https://www.tiktok.com",
		})
		.catch(() => {});
	return context;
}

async function closeContext(context) {
	if (!context) return;
	if (context._shouldClose) {
		const browser = context.browser();
		await context.close();
		await browser.close();
		return;
	}

	await context.close();
}

async function collectVideoUrls(
	page,
	{
		scrollDelay,
		maxVideos,
		idleLimit,
		maxScrolls,
		loadTimeout,
		targetCount,
		debug,
	},
) {
	const collected = new Set();
	let scrollCount = 0;
	let stagnationCounter = 0;
	let noGrowthCounter = 0;
	let lastScrollHeight = 0;

	const normalizeUrl = (href) => {
		try {
			const url = new URL(href, "https://www.tiktok.com");
			url.search = "";
			url.hash = "";
			return url.toString();
		} catch (_err) {
			return null;
		}
	};

	const waitForLoad = async (previousAnchorCount) => {
		await page
			.waitForFunction(
				(expectedCount) => {
					const anchors =
						document.querySelectorAll('a[href*="/video/"]').length;
					const spinner = document.querySelector('[data-e2e="scroll-loading"]');
					return anchors > expectedCount || !spinner;
				},
				previousAnchorCount,
				{ timeout: loadTimeout },
			)
			.catch(() => {});
	};

	while (true) {
		scrollCount += 1;
		const snapshot = await page.evaluate(() => {
			const anchorElements = Array.from(
				document.querySelectorAll('a[href*="/video/"]'),
			);
			const scrollHeight =
				document.documentElement?.scrollHeight ||
				document.body.scrollHeight ||
				0;
			const reachedBottom =
				window.scrollY + window.innerHeight >= scrollHeight - 4;
			const loadMoreSelectors = [
				'button[data-e2e="feed-load-more"]',
				'button[data-e2e="scroll-finish"]',
			];
			let hasLoadMoreButton = loadMoreSelectors.some((selector) =>
				Boolean(document.querySelector(selector)),
			);
			if (!hasLoadMoreButton) {
				const buttons = Array.from(document.querySelectorAll("button"));
				hasLoadMoreButton = buttons.some((btn) =>
					/load more|see more|show more/i.test(btn.textContent || ""),
				);
			}
			return {
				hrefs: anchorElements.map((el) => el.href),
				anchorCount: anchorElements.length,
				scrollHeight,
				reachedBottom,
				hasSpinner: Boolean(
					document.querySelector('[data-e2e="scroll-loading"]'),
				),
				hasLoadMoreButton,
			};
		});

		const sizeBefore = collected.size;
		for (const href of snapshot.hrefs) {
			const normalized = normalizeUrl(href);
			if (normalized) {
				collected.add(normalized);
			}
		}

		const newVideos = collected.size - sizeBefore;
		if (newVideos > 0) {
			stagnationCounter = 0;
			noGrowthCounter = 0;
			if (debug) {
				console.log(
					`[scroll ${scrollCount}] new=${newVideos} total=${collected.size} anchors=${snapshot.anchorCount}`,
				);
			} else {
				console.log(
					`Discovered ${newVideos} new videos (total ${collected.size}).`,
				);
			}
		} else {
			stagnationCounter += 1;
			noGrowthCounter += 1;
			if (debug) {
				console.log(
					`[scroll ${scrollCount}] no new videos (total ${collected.size}).`,
				);
			}
		}

		if (maxVideos && collected.size >= maxVideos) {
			break;
		}
		if (targetCount && collected.size >= targetCount) {
			break;
		}
		if (maxScrolls && scrollCount >= maxScrolls) {
			console.warn(
				"Reached max scroll iterations before collecting requested number of videos.",
			);
			break;
		}

		const loadMoreButton = await page.$(
			'button[data-e2e="feed-load-more"], button[data-e2e="scroll-finish"], button:has-text("Load more"), button:has-text("See more"), button:has-text("Show more")',
		);
		if (loadMoreButton) {
			if (debug) console.log("Clicking load-more button.");
			await loadMoreButton.click().catch(() => {});
			await page.waitForTimeout(Math.max(scrollDelay, 1500));
		} else {
			await page
				.evaluate(() => {
					const cards = Array.from(
						document.querySelectorAll('[data-e2e="user-post-item"]'),
					);
					const lastCard = cards[cards.length - 1];
					if (lastCard) {
						lastCard.scrollIntoView({ behavior: "smooth", block: "end" });
					} else {
						window.scrollTo({
							top: document.body.scrollHeight,
							behavior: "smooth",
						});
					}
				})
				.catch(() => {});
		}

		await waitForLoad(snapshot.anchorCount);
		await page.waitForTimeout(scrollDelay);

		const { scrollHeight: postScrollHeight, reachedBottom: postReachedBottom } =
			await page.evaluate(() => {
				const scrollHeight =
					document.documentElement?.scrollHeight ||
					document.body.scrollHeight ||
					0;
				const reachedBottom =
					window.scrollY + window.innerHeight >= scrollHeight - 4;
				return { scrollHeight, reachedBottom };
			});

		if (
			collected.size > sizeBefore ||
			postScrollHeight > lastScrollHeight + 4
		) {
			stagnationCounter = 0;
		}

		lastScrollHeight = Math.max(lastScrollHeight, postScrollHeight);

		if (debug) {
			console.log(
				`[scroll ${scrollCount}] postScrollHeight=${postScrollHeight} stagnation=${stagnationCounter} idle=${noGrowthCounter} reachedBottom=${postReachedBottom}`,
			);
		}

		if (
			postReachedBottom &&
			stagnationCounter >= idleLimit &&
			noGrowthCounter >= idleLimit
		) {
			if (debug)
				console.log(
					"Stopping scroll loop after repeated stagnation at bottom.",
				);
			break;
		}
	}

	return Array.from(collected);
}

async function attemptLogin(page, username, password, timeoutMs) {
	if (!username || !password) {
		return { success: false, reason: "missing_credentials" };
	}

	console.log("Attempting automatic TikTok login with supplied credentials...");
	try {
		await page.goto("https://www.tiktok.com/login/phone-or-email/email", {
			waitUntil: "domcontentloaded",
		});

		await page.waitForTimeout(4000);
		await page
			.evaluate(() => {
				const dismissButton = document.querySelector(
					'button[data-e2e="gdpr-accept-button"], button.tiktok-btn-pc',
				);
				if (dismissButton) dismissButton.click();
			})
			.catch(() => {});
		await page.waitForTimeout(1200);

		const discoverLoginFrame = async () => {
			const frameByUrl = page
				.frames()
				.find((frame) => /passport|account|login/i.test(frame.url()));
			if (frameByUrl) return frameByUrl;

			const iframeSelectors = [
				'iframe[id="login-pc-iframe"]',
				'iframe[src*="tiktok.com"]',
				'iframe[src*="passport"]',
			];

			for (const selector of iframeSelectors) {
				const handle = await page.$(selector);
				if (handle) {
					const frame = await handle.contentFrame();
					if (frame) return frame;
				}
			}

			const fallbackHandle = await page
				.waitForSelector("iframe", { timeout: 2000 })
				.catch(() => null);
			return fallbackHandle ? await fallbackHandle.contentFrame() : null;
		};

		const loginScope = (await discoverLoginFrame()) || page;
		console.log(
			loginScope === page
				? "Interacting with top-level login form."
				: `Interacting with login iframe: ${loginScope.url()}`,
		);

		const findField = async (selectors) => {
			for (const selector of selectors) {
				const handle = await loginScope
					.waitForSelector(selector, { timeout: 2500 })
					.catch(() => null);
				if (handle) {
					console.log(`Located field via selector: ${selector}`);
					return handle;
				}
			}
			return null;
		};

		const togglePasswordOption = await loginScope.$(
			'button:has-text("Log in with password"), button:has-text("Use password")',
		);
		if (togglePasswordOption) {
			await togglePasswordOption.click().catch(() => {});
			await page.waitForTimeout(1200);
			console.log("Activated password-based login form.");
		}

		const usernameSelectors = [
			'input[name="username"]',
			'input[name="account"]',
			'input[name="email"]',
			'input[type="text"][placeholder*="Email" i]',
			'input[type="text"][placeholder*="Phone" i]',
		];
		const passwordSelectors = [
			'input[name="password"]',
			'input[type="password"]',
		];

		let usernameField = await findField(usernameSelectors);
		if (!usernameField)
			throw new Error("Could not locate TikTok username field.");
		await usernameField.click({ delay: 50 }).catch(() => {});
		await page.waitForTimeout(600);
		await typeWithHumanDelay(loginScope, usernameField, username);

		let passwordField = await findField(passwordSelectors);
		if (!passwordField)
			throw new Error("Could not locate TikTok password field.");
		await passwordField.click({ delay: 50 }).catch(() => {});
		await page.waitForTimeout(600);
		await typeWithHumanDelay(loginScope, passwordField, password);
		await page.waitForTimeout(1000);

		const submitButton =
			(await loginScope.$('button[type="submit"]')) ||
			(await loginScope.$('button:has-text("Log in")')) ||
			(await loginScope.$('button:has-text("Login")'));
		if (!submitButton)
			throw new Error("Could not find TikTok login submit button.");
		await submitButton.hover().catch(() => {});
		await page.waitForTimeout(900);
		await submitButton.click();
		await page.waitForTimeout(3000);

		await page
			.waitForLoadState("networkidle", { timeout: timeoutMs })
			.catch(() => {});
		await page.waitForTimeout(3500);

		const maxAttemptsWarning = await page
			.$('text="Maximum number of attempts reached. Try again later."')
			.catch(() => null);
		if (maxAttemptsWarning) {
			console.warn(
				"TikTok reports the maximum login attempts warning. Waiting before retrying...",
			);
			return { success: false, reason: "rate_limited" };
		}

		try {
			await assertLoggedIn(
				page,
				"TikTok still shows the login UI after submission.",
			);
		} catch (authErr) {
			console.warn(authErr.message);
			const screenshotPath = path.resolve(
				`results/tiktok/login-debug-${Date.now()}.png`,
			);
			await page
				.screenshot({ path: screenshotPath, fullPage: true })
				.catch(() => {});
			console.warn(`Captured login debug screenshot at ${screenshotPath}`);
			return { success: false, reason: "auth_ui_present" };
		}

		const currentUrl = page.url();
		if (/\/login/gi.test(currentUrl)) {
			const warning =
				"Redirected back to login after submission; authentication may have failed.";
			console.warn(warning);
			const screenshotPath = path.resolve(
				`results/tiktok/login-debug-${Date.now()}.png`,
			);
			await page
				.screenshot({ path: screenshotPath, fullPage: true })
				.catch(() => {});
			console.warn(`Captured login debug screenshot at ${screenshotPath}`);
			return { success: false, reason: "redirected_to_login" };
		}

		console.log("Login attempt completed.");
		return { success: true };
	} catch (err) {
		console.warn("Automatic login failed:", err.message);
		return { success: false, reason: "exception", message: err.message };
	}
}

function ensureOutputPath(outputPath) {
	const resolved = path.resolve(outputPath);
	fs.mkdirSync(path.dirname(resolved), { recursive: true });
	return resolved;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const targetInput = args.url || args._[0];

	if (!targetInput) {
		console.error(
			"Usage: node cli/tiktok-collect-urls.js <profile | url> [--output path] [--max 100] [--headless] [--browser chromium] [--user-data-dir path]",
		);
		process.exit(1);
	}

	const profileUrl = buildProfileUrl(targetInput);
	if (!profileUrl) {
		console.error("Unable to determine TikTok profile URL.");
		process.exit(1);
	}

	const profileSlug = extractProfileSlug(profileUrl);
	const outputPath = ensureOutputPath(
		args.output || path.join("results", "tiktok", profileSlug, "urls.txt"),
	);
	const browserChoice = (args.browser || "chromium").toLowerCase();
	const headless = Boolean(args.headless);
	const userDataDir = args["user-data-dir"] || args["userDataDir"];
	const scrollDelay =
		Number.parseInt(args.delay || args.wait || DEFAULT_SCROLL_DELAY_MS, 10) ||
		DEFAULT_SCROLL_DELAY_MS;
	const idleLimit =
		Number.parseInt(
			args["idle-limit"] || args.idle || DEFAULT_IDLE_LIMIT,
			10,
		) || DEFAULT_IDLE_LIMIT;
	const maxVideos = args.max ? Number.parseInt(args.max, 10) : undefined;
	const maxScrolls = args["max-scrolls"]
		? Number.parseInt(args["max-scrolls"], 10)
		: undefined;
	const loadTimeout =
		Number.parseInt(
			args["load-timeout"] || args["load-wait"] || DEFAULT_LOAD_WAIT_MS,
			10,
		) || DEFAULT_LOAD_WAIT_MS;
	const targetCount = args["target-count"]
		? Number.parseInt(args["target-count"], 10)
		: undefined;
	const appendMode = Boolean(args.append);
	const autoLogin = Boolean(args["auto-login"] || args.autologin || args.login);
	const username = process.env.TIKTOK_USERNAME || process.env.tiktok_username;
	const password = process.env.TIKTOK_PASSWORD || process.env.tiktok_password;
	const loginRequested = autoLogin && username && password;
	const timeoutMs = Number.parseInt(args.timeout || 45000, 10);
	const debugMode = Boolean(args.debug);
	const maxLoginAttempts =
		Number.parseInt(
			args["login-attempts"] || args["login-max-attempts"] || 10,
			10,
		) || 10;
	const loginRetryDelayMs =
		Number.parseInt(args["login-retry-delay"] || 120000, 10) || 120000;

	let context;
	try {
		context = await openContext(browserChoice, headless, userDataDir);
		let page = await context.newPage();
		configurePage(page, timeoutMs);

		if (loginRequested) {
			let attempt = 0;
			let loginOutcome = { success: false, reason: "not_attempted" };
			while (attempt < maxLoginAttempts) {
				attempt += 1;
				if (!page || page.isClosed()) {
					page = await context.newPage();
					configurePage(page, timeoutMs);
				}
				await delay(randomBetween(1200, 2400));
				console.log(
					`Starting TikTok login attempt ${attempt}/${maxLoginAttempts}...`,
				);
				loginOutcome = await attemptLogin(
					page,
					username,
					password,
					timeoutMs,
				);
				if (loginOutcome.success) {
					await delay(randomBetween(800, 1600));
					break;
				}

				if (attempt >= maxLoginAttempts) {
					break;
				}

				const waitMs =
					loginOutcome.reason === "rate_limited"
						? Math.max(loginRetryDelayMs, 60000)
						: loginRetryDelayMs;
				const waitSeconds = Math.round(waitMs / 1000);
				console.warn(
					`Login attempt ${attempt} failed (${loginOutcome.reason || "unknown"}). Waiting ${waitSeconds}s before retrying...`,
				);
				await delay(waitMs);
				await context.clearCookies().catch(() => {});
				if (page && !page.isClosed()) {
					await page.close().catch(() => {});
				}
				page = await context.newPage();
				configurePage(page, timeoutMs);
			}

			if (!loginOutcome.success) {
				console.error(
					"Unable to authenticate with TikTok after multiple attempts. Aborting run.",
				);
				process.exitCode = 1;
				return;
			}
			console.log("Successfully authenticated with TikTok.");
		} else if (autoLogin) {
			console.warn(
				"Auto-login requested but TikTok credentials were not found in environment variables.",
			);
		}

		console.log(`Navigating to ${profileUrl} ...`);
		await page.goto(profileUrl, { waitUntil: "domcontentloaded" });

		if (loginRequested) {
			try {
				await assertLoggedIn(
					page,
					"TikTok still displays the login button after navigation. Automatic login likely failed.",
				);
			} catch (authErr) {
				console.warn(authErr.message);
				process.exitCode = 1;
				return;
			}
		}

		if (
			!headless &&
			!userDataDir &&
			!args["skip-login-prompt"] &&
			!loginRequested
		) {
			console.log(
				"If TikTok requires authentication, log in using the opened window.",
			);
			await promptToContinue(
				"Press Enter to begin scrolling once the profile grid is visible...",
			);
		}

		// Dismiss cookie modals when possible.
		await page
			.evaluate(() => {
				const dismissButton = document.querySelector(
					'button[data-e2e="gdpr-accept-button"], button.tiktok-btn-pc',
				);
				if (dismissButton) dismissButton.click();
			})
			.catch(() => {});

		await page
			.waitForSelector('a[href*="/video/"]', {
				timeout: Number.parseInt(args.timeout || 45000, 10),
			})
			.catch(() =>
				console.warn(
					"Timed out waiting for the video grid to appear. Scrolling anyway.",
				),
			);

		console.log("Scrolling to load all available videos...");
		const videoUrls = await collectVideoUrls(page, {
			scrollDelay,
			maxVideos,
			idleLimit,
			maxScrolls,
			loadTimeout,
			targetCount,
			debug: debugMode,
		});

		if (videoUrls.length === 0) {
			console.warn(
				"No video URLs were discovered. Verify the profile is accessible and try again.",
			);
		} else {
			const fileFlag = appendMode ? "a" : "w";
			const fileContent = `${videoUrls.join("\n")}\n`;
			fs.writeFileSync(outputPath, fileContent, {
				flag: fileFlag,
				encoding: "utf8",
			});
			console.log(
				`Saved ${videoUrls.length} unique video URLs to ${outputPath}`,
			);
		}
	} catch (error) {
		console.error("Failed to collect TikTok video URLs:", error.message);
		process.exitCode = 1;
	} finally {
		await closeContext(context).catch(() => {});
	}
}

main();
