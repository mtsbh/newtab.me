import { useState, useEffect } from "react";
import { storage } from "../storage";
import { Workspace, createWorkspace } from "../Workspace";
import { Widget } from "../Widget";
import { BackgroundConfig } from "./background";
import { WidgetGridSettings } from "../features/app/WidgetGrid";
import { migrateToWorkspaces } from "./workspaceMigration";

const WORKSPACES_KEY = "workspaces";
const ACTIVE_WORKSPACE_KEY = "activeWorkspaceId";

/**
 * Hook to manage workspaces
 */
export function useWorkspaces() {
	const [workspaces, setWorkspacesState] = useState<Workspace[]>([]);
	const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);

	// Load workspaces from storage
	useEffect(() => {
		const load = async () => {
			// Run migration from old system to workspaces
			await migrateToWorkspaces();

			const storedWorkspaces = await storage.get<Workspace[]>(WORKSPACES_KEY);
			const storedActiveId = await storage.get<string>(ACTIVE_WORKSPACE_KEY);

			if (storedWorkspaces && storedWorkspaces.length > 0) {
				setWorkspacesState(storedWorkspaces);
				setActiveWorkspaceIdState(storedActiveId || storedWorkspaces[0].id);
			} else {
				// Create default workspace (shouldn't happen after migration)
				const defaultWorkspace = createWorkspace("Main");
				setWorkspacesState([defaultWorkspace]);
				setActiveWorkspaceIdState(defaultWorkspace.id);
				await storage.set(WORKSPACES_KEY, [defaultWorkspace]);
				await storage.set(ACTIVE_WORKSPACE_KEY, defaultWorkspace.id);
			}
			setLoaded(true);
		};
		load();
	}, []);

	// Save workspaces to storage
	const saveWorkspaces = async (newWorkspaces: Workspace[]) => {
		await storage.set(WORKSPACES_KEY, newWorkspaces);
		setWorkspacesState(newWorkspaces);
	};

	// Get active workspace
	const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

	// Switch to a different workspace
	const switchWorkspace = async (workspaceId: string) => {
		await storage.set(ACTIVE_WORKSPACE_KEY, workspaceId);
		setActiveWorkspaceIdState(workspaceId);
	};

	// Create a new workspace
	const createNewWorkspace = async (name: string) => {
		const newWorkspace = createWorkspace(name);
		const newWorkspaces = [...workspaces, newWorkspace];
		await saveWorkspaces(newWorkspaces);
		await switchWorkspace(newWorkspace.id);
		return newWorkspace;
	};

	// Rename a workspace
	const renameWorkspace = async (workspaceId: string, newName: string) => {
		const newWorkspaces = workspaces.map(w =>
			w.id === workspaceId
				? { ...w, name: newName, updatedAt: new Date() }
				: w
		);
		await saveWorkspaces(newWorkspaces);
	};

	// Delete a workspace
	const deleteWorkspace = async (workspaceId: string) => {
		if (workspaces.length <= 1) {
			throw new Error("Cannot delete the last workspace");
		}

		const newWorkspaces = workspaces.filter(w => w.id !== workspaceId);
		await saveWorkspaces(newWorkspaces);

		// If deleting active workspace, switch to first workspace
		if (activeWorkspaceId === workspaceId) {
			await switchWorkspace(newWorkspaces[0].id);
		}
	};

	// Update workspace widgets
	const updateWorkspaceWidgets = async (workspaceId: string, widgets: Widget<any>[]) => {
		const newWorkspaces = workspaces.map(w =>
			w.id === workspaceId
				? { ...w, widgets, updatedAt: new Date() }
				: w
		);
		await saveWorkspaces(newWorkspaces);
	};

	// Update workspace background
	const updateWorkspaceBackground = async (workspaceId: string, background: BackgroundConfig) => {
		const newWorkspaces = workspaces.map(w =>
			w.id === workspaceId
				? { ...w, background, updatedAt: new Date() }
				: w
		);
		await saveWorkspaces(newWorkspaces);
	};

	// Update workspace grid settings
	const updateWorkspaceGridSettings = async (workspaceId: string, gridSettings: WidgetGridSettings) => {
		const newWorkspaces = workspaces.map(w =>
			w.id === workspaceId
				? { ...w, gridSettings, updatedAt: new Date() }
				: w
		);
		await saveWorkspaces(newWorkspaces);
	};

	return {
		workspaces,
		activeWorkspace,
		activeWorkspaceId,
		loaded,
		switchWorkspace,
		createNewWorkspace,
		renameWorkspace,
		deleteWorkspace,
		updateWorkspaceWidgets,
		updateWorkspaceBackground,
		updateWorkspaceGridSettings,
	};
}
