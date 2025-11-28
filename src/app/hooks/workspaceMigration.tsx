import { storage } from "../storage";
import { Workspace, createWorkspace } from "../Workspace";
import { Widget } from "../Widget";
import { BackgroundConfig } from "./background";
import { WidgetGridSettings } from "../features/app/WidgetGrid";

const MIGRATION_KEY = "workspaces_migrated";
const WORKSPACES_KEY = "workspaces";
const ACTIVE_WORKSPACE_KEY = "activeWorkspaceId";

/**
 * Migrates existing widgets, background, and grid settings to the workspace system
 */
export async function migrateToWorkspaces(): Promise<boolean> {
	const migrated = await storage.get<boolean>(MIGRATION_KEY);
	if (migrated) {
		return false; // Already migrated
	}

	// Check if workspaces already exist
	const existingWorkspaces = await storage.get<Workspace[]>(WORKSPACES_KEY);
	if (existingWorkspaces && existingWorkspaces.length > 0) {
		await storage.set(MIGRATION_KEY, true);
		return false; // Workspaces already set up
	}

	// Get existing data
	const widgets = await storage.get<Widget<any>[]>("widgets");
	const background = await storage.get<BackgroundConfig>("background");
	const gridSettings = await storage.get<WidgetGridSettings>("grid_settings");

	// Create default workspace with existing data
	const defaultWorkspace = createWorkspace("Main");
	defaultWorkspace.widgets = widgets || [];
	defaultWorkspace.background = background ?? undefined;
	defaultWorkspace.gridSettings = gridSettings ?? undefined;

	// Save to new workspace system
	await storage.set(WORKSPACES_KEY, [defaultWorkspace]);
	await storage.set(ACTIVE_WORKSPACE_KEY, defaultWorkspace.id);
	await storage.set(MIGRATION_KEY, true);

	return true; // Migration completed
}
