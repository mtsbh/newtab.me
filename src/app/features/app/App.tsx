import React, { useEffect, useState, useMemo, useCallback } from "react";
import { WidgetManager } from "app/WidgetManager";
import CreateWidgetDialog from "./CreateWidgetDialog";
import WidgetGrid, { defaultGridSettings, WidgetGridSettings } from "./WidgetGrid";
import SettingsDialog from "../settings/SettingsDialog";
import Background from "../backgrounds";
import { usePromise, useStorage } from "app/hooks";
import { defineMessage, defineMessages, IntlProvider, useIntl } from "react-intl";
import { getTranslation, detectUserLocale } from "app/locale";
import { applyTheme, ThemeConfig } from "../settings/ThemeSettings";
import ReviewRequester from "./ReviewRequester";
import { storage } from "app/storage";
import * as Sentry from "@sentry/react";
import Onboarding from "../onboarding";
import { BackgroundConfig } from "app/hooks/background";
import { GlobalSearchContext } from "app/hooks/globalSearch";
import BookmarksTopBar from "./BookmarksTopBar";
import Button, { ButtonVariant } from "app/components/Button";
import { miscMessages } from "app/locale/common";
import { WidgetManagerContext } from "app/hooks/widgetManagerContext";
import { LockedContext } from "app/hooks/useIsLocked";
import { useWorkspaces } from "app/hooks/workspaces";
import WorkspaceSwitcher from "../workspaces/WorkspaceSwitcher";
import CreateWorkspaceDialog from "../workspaces/CreateWorkspaceDialog";
import { createContext } from "react";
import { Workspace } from "app/Workspace";
import { Widget } from "app/Widget";
import deepCopy from "app/utils/deepcopy";


export interface WorkspaceActions {
	workspaces: Workspace[];
	activeWorkspaceId: string;
	moveWidgetToWorkspace: (widgetId: number, targetWorkspaceId: string) => Promise<void>;
}

export const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null);


const messages = defineMessages({
	newTab: {
		id: "app.newTab",
		defaultMessage: "New Tab",
	},

	unlockWidgets: {
		id: "app.unlockWidgets",
		defaultMessage: "Enter edit mode",
		description: "Button to enter edit mode",
	},
});


function Title() {
	const intl = useIntl();

	if (typeof browser != "undefined") {
		document.title = intl.formatMessage(messages.newTab);
	}

	return null;
}


export default function App() {
	const workspaceState = useWorkspaces();
	const {
		workspaces,
		activeWorkspace,
		activeWorkspaceId,
		loaded: workspacesLoaded,
		switchWorkspace,
		createNewWorkspace,
		renameWorkspace,
		deleteWorkspace,
		updateWorkspaceWidgets,
		updateWorkspaceBackground,
		updateWorkspaceGridSettings,
	} = workspaceState;

	// Create widget manager for current workspace
	const widgetManager = useMemo(() => new WidgetManager(storage), []);

	// Load widgets from active workspace
	const [widgetsLoaded, setWidgetsLoaded] = useState(false);
	const [widgetLoadKey, setWidgetLoadKey] = useState(0);
	useEffect(() => {
		if (!workspacesLoaded || !activeWorkspace) {
			setWidgetsLoaded(false);
			return;
		}

		const loadWidgets = async () => {
			// Manually set widgets from workspace instead of calling widgetManager.load()
			// Create a copy of the widgets array to avoid shared references
			widgetManager.widgets = [...(activeWorkspace.widgets || [])];

			// Initialize widgets (same as WidgetManager.load() does)
			for (const widget of widgetManager.widgets) {
				// This calls afterLoad logic
				await (widgetManager as any).afterLoad(widget);
			}

			setWidgetsLoaded(true);
			// Increment key to force WidgetGrid remount with new widgets
			setWidgetLoadKey(prev => prev + 1);
		};

		loadWidgets();
	}, [activeWorkspaceId, workspacesLoaded]);

	// Override widget manager's save to save to workspace
	useEffect(() => {
		if (!workspacesLoaded || !activeWorkspaceId) {
			return;
		}

		const originalSave = widgetManager.save.bind(widgetManager);
		widgetManager.save = () => {
			// Get current workspace ID to avoid stale closure
			const currentWorkspaceId = activeWorkspaceId;
			// Save to workspace instead of storage
			updateWorkspaceWidgets(currentWorkspaceId, [...widgetManager.widgets]);
			// Still call original save for any other side effects
			// originalSave();
		};

		return () => {
			widgetManager.save = originalSave;
		};
	}, [widgetManager, activeWorkspaceId, workspacesLoaded, updateWorkspaceWidgets]);

	// Workspace-specific background and grid settings
	const background = activeWorkspace?.background;
	const setBackground = useCallback((newBackground: BackgroundConfig) => {
		if (activeWorkspaceId) {
			updateWorkspaceBackground(activeWorkspaceId, newBackground);
		}
	}, [activeWorkspaceId, updateWorkspaceBackground]);

	const rawGridSettings = activeWorkspace?.gridSettings || { ...defaultGridSettings };
	const setGridSettings = useCallback((newSettings: WidgetGridSettings) => {
		if (activeWorkspaceId) {
			updateWorkspaceGridSettings(activeWorkspaceId, newSettings);
		}
	}, [activeWorkspaceId, updateWorkspaceGridSettings]);

	// Rest of the app state
	const [query, setQuery] = useState("");
	const [locale, setLocale] = useStorage<string>("locale", detectUserLocale());
	const [showBookmarksBar, setShowBookmarksBar] = useStorage("showBookmarksBar", app_version.target == "chrome");
	const [localeMessages] = usePromise(() => locale ? getTranslation(locale) : Promise.reject(null), [locale]);
	const [theme, setTheme] = useStorage<ThemeConfig>("theme", {});
	const [createIsOpen, setCreateOpen] = useState(false);
	const [settingsIsOpen, setSettingsOpen] = useState(false);
	const [createWorkspaceIsOpen, setCreateWorkspaceOpen] = useState(false);
	const [widgetsHidden, setWidgetsHidden] = useState(false);
	const [isLockedRaw, setIsLocked] = useStorage<boolean>("locked", false);
	const [onboardingIsOpen, setOnboardingIsOpen] = useState<boolean | undefined>(undefined);
	const isLocked = onboardingIsOpen === true || (isLockedRaw ?? false);

	// Debug: Log lock state
	console.log('Lock state:', { isLockedRaw, onboardingIsOpen, isLocked });

	const loaded = workspacesLoaded && widgetsLoaded && localeMessages != null;

	useEffect(() => {
		if (loaded && onboardingIsOpen == undefined) {
			setOnboardingIsOpen(widgetManager.widgets.length == 0);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded]);

	const gridSettings = rawGridSettings && { ...defaultGridSettings, ...rawGridSettings };

	if (theme) {
		applyTheme(theme);
	}

	const classes: string[] = [];
	if (widgetsHidden) {
		classes.push("hidden");
	}

	classes.push(isLocked ? "locked" : "unlocked");

	// Handle workspace creation
	const handleCreateWorkspace = () => {
		setCreateWorkspaceOpen(true);
	};

	const handleWorkspaceCreate = async (name: string) => {
		await createNewWorkspace(name);
	};

	// Handle moving widget to another workspace
	const moveWidgetToWorkspace = async (widgetId: number, targetWorkspaceId: string) => {
		if (!activeWorkspaceId || targetWorkspaceId === activeWorkspaceId) {
			return;
		}

		// Find the widget in current workspace
		const widget = widgetManager.widgets.find(w => w.id === widgetId);
		if (!widget) {
			return;
		}

		// Create a deep copy of the widget to prevent mirroring between workspaces
		const widgetCopy = deepCopy(widget);

		// Remove from current workspace and update local widget manager immediately
		// to prevent the widget from being saved back to the current workspace
		const updatedCurrentWidgets = widgetManager.widgets.filter(w => w.id !== widgetId);
		widgetManager.widgets = updatedCurrentWidgets;
		await updateWorkspaceWidgets(activeWorkspaceId, updatedCurrentWidgets);

		// Add the copied widget to target workspace
		const targetWorkspace = workspaces.find(w => w.id === targetWorkspaceId);
		if (targetWorkspace) {
			const updatedTargetWidgets = [...targetWorkspace.widgets, widgetCopy];
			await updateWorkspaceWidgets(targetWorkspaceId, updatedTargetWidgets);
		}
	};

	const workspaceActions: WorkspaceActions = {
		workspaces,
		activeWorkspaceId: activeWorkspaceId || "",
		moveWidgetToWorkspace,
	};

	return (
		<IntlProvider locale={(localeMessages && locale) ? locale : "en"} defaultLocale="en" messages={localeMessages ?? undefined}>
			<LockedContext.Provider value={isLocked}>
				<WidgetManagerContext.Provider value={widgetManager}>
					<WorkspaceActionsContext.Provider value={workspaceActions}>
						<GlobalSearchContext.Provider value={{ query, setQuery }}>
						<Title />
						<main className={classes.join(" ")}>
							{workspacesLoaded && (
								<WorkspaceSwitcher
									workspaces={workspaces}
									activeWorkspaceId={activeWorkspaceId!}
									onSwitch={switchWorkspace}
									onCreateWorkspace={handleCreateWorkspace}
									onRenameWorkspace={renameWorkspace}
									onDeleteWorkspace={deleteWorkspace}
									isLocked={isLocked}
								/>
							)}
							{createWorkspaceIsOpen && (
								<CreateWorkspaceDialog
									onClose={() => setCreateWorkspaceOpen(false)}
									onCreate={handleWorkspaceCreate}
								/>
							)}
							{showBookmarksBar && !onboardingIsOpen &&
								typeof browser !== "undefined" && (
								<BookmarksTopBar onHide={() => setShowBookmarksBar(false)} />)}
							<Sentry.ErrorBoundary fallback={<div id="background"></div>}>
								{background && (
									<Background background={background} setWidgetsHidden={setWidgetsHidden} />
								)}
							</Sentry.ErrorBoundary>
							{createIsOpen && (
								<CreateWidgetDialog onClose={() => setCreateOpen(false)} />)}
							{gridSettings && (
								<SettingsDialog
									isOpen={settingsIsOpen}
									onClose={() => setSettingsOpen(false)}
									background={background!} setBackground={setBackground}
									theme={theme} setTheme={setTheme}
									locale={locale ?? "en"} setLocale={setLocale}
									showBookmarksBar={showBookmarksBar ?? false} setShowBookmarksBar={setShowBookmarksBar}
									grid={gridSettings} setGrid={setGridSettings} />)}

							{loaded && gridSettings &&
								<WidgetGrid key={widgetLoadKey} {...gridSettings} wm={widgetManager} isLocked={isLocked ?? false} />}
							{onboardingIsOpen && (
								<Onboarding
									onClose={() => setOnboardingIsOpen(false)}
									locale={locale ?? "en"} setLocale={setLocale} />)}
							<ReviewRequester />

							{isLocked && !onboardingIsOpen && (
								<Button id="unlock-widgets" onClick={() => setIsLocked(false)}
									tabIndex={0} variant={ButtonVariant.None}
									data-cy="start-editing"
									className="text-shadow" icon="fas fa-pen"
									title={messages.unlockWidgets} />)}

							{!isLocked && (
								<aside className="edit-bar" role="toolbar" data-cy="edit-bar">
									<Button href="https://renewedtab.com/help/"
										variant={ButtonVariant.Secondary}
										icon="fa fa-question" small={true}
										target="_blank"
										label={defineMessage({
											id: "app.help",
											defaultMessage: "Help",
										})} />

									<div className="col" />

									<Button onClick={() => setCreateOpen(true)}
										variant={ButtonVariant.Secondary}
										icon="fa fa-plus" small={true}
										id="add-widget"
										label={defineMessage({
											id: "app.addWidget",
											defaultMessage: "Add Widget",
										})} />

									<Button onClick={() => setSettingsOpen(true)}
										variant={ButtonVariant.Secondary}
										icon="fa fa-cog" small={true}
										id="open-settings"
										label={defineMessage({
											id: "app.settings",
											defaultMessage: "Settings",
										})} />

									<Button onClick={() => setIsLocked(true)}
										variant={ButtonVariant.Secondary}
										icon="fa fa-check" small={true}
										data-cy="finish-editing"
										label={miscMessages.finishEditing} />
								</aside>)}
						</main>
					</GlobalSearchContext.Provider>
					</WorkspaceActionsContext.Provider>
				</WidgetManagerContext.Provider>
			</LockedContext.Provider>
		</IntlProvider>);
}
