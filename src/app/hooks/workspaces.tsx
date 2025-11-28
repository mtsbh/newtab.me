import { useState, useEffect, useCallback } from "react";
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

	// Save workspaces to storage - memoized to prevent recreation
	const saveWorkspaces = useCallback(async (newWorkspaces: Workspace[]) => {
		await storage.set(WORKSPACES_KEY, newWorkspaces);
		setWorkspacesState(newWorkspaces);
	}, []);

	// Get active workspace
	const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

	// Switch to a different workspace - memoized
	const switchWorkspace = useCallback(async (workspaceId: string) => {
		await storage.set(ACTIVE_WORKSPACE_KEY, workspaceId);
		setActiveWorkspaceIdState(workspaceId);
	}, []);

	// Create a new workspace - memoized with functional update
	const createNewWorkspace = useCallback(async (name: string) => {
		const newWorkspace = createWorkspace(name);

		// Use functional state update to avoid dependency on workspaces
		setWorkspacesState(prevWorkspaces => {
			const newWorkspaces = [...prevWorkspaces, newWorkspace];
			storage.set(WORKSPACES_KEY, newWorkspaces);
			return newWorkspaces;
		});

		await switchWorkspace(newWorkspace.id);
		return newWorkspace;
	}, [switchWorkspace]);

	// Rename a workspace - memoized with functional update
	const renameWorkspace = useCallback(async (workspaceId: string, newName: string) => {
		setWorkspacesState(prevWorkspaces => {
			const newWorkspaces = prevWorkspaces.map(w =>
				w.id === workspaceId
					? { ...w, name: newName, updatedAt: new Date() }
					: w
			);
			storage.set(WORKSPACES_KEY, newWorkspaces);
			return newWorkspaces;
		});
	}, []);

	// Delete a workspace - memoized with functional update
	const deleteWorkspace = useCallback(async (workspaceId: string) => {
		setWorkspacesState(prevWorkspaces => {
			if (prevWorkspaces.length <= 1) {
				throw new Error("Cannot delete the last workspace");
			}

			const newWorkspaces = prevWorkspaces.filter(w => w.id !== workspaceId);
			storage.set(WORKSPACES_KEY, newWorkspaces);

			// If deleting active workspace, switch to first workspace
			if (activeWorkspaceId === workspaceId) {
				switchWorkspace(newWorkspaces[0].id);
			}

			return newWorkspaces;
		});
	}, [activeWorkspaceId, switchWorkspace]);

	// Update workspace widgets - memoized with functional update
	const updateWorkspaceWidgets = useCallback(async (workspaceId: string, widgets: Widget<any>[]) => {
		setWorkspacesState(prevWorkspaces => {
			const newWorkspaces = prevWorkspaces.map(w =>
				w.id === workspaceId
					? { ...w, widgets, updatedAt: new Date() }
					: w
			);
			storage.set(WORKSPACES_KEY, newWorkspaces);
			return newWorkspaces;
		});
	}, []);

	// Update workspace background - memoized with functional update
	const updateWorkspaceBackground = useCallback(async (workspaceId: string, background: BackgroundConfig) => {
		setWorkspacesState(prevWorkspaces => {
			const newWorkspaces = prevWorkspaces.map(w =>
				w.id === workspaceId
					? { ...w, background, updatedAt: new Date() }
					: w
			);
			storage.set(WORKSPACES_KEY, newWorkspaces);
			return newWorkspaces;
		});
	}, []);

	// Update workspace grid settings - memoized with functional update
	const updateWorkspaceGridSettings = useCallback(async (workspaceId: string, gridSettings: WidgetGridSettings) => {
		setWorkspacesState(prevWorkspaces => {
			const newWorkspaces = prevWorkspaces.map(w =>
				w.id === workspaceId
					? { ...w, gridSettings, updatedAt: new Date() }
					: w
			);
			storage.set(WORKSPACES_KEY, newWorkspaces);
			return newWorkspaces;
		});
	}, []);

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
