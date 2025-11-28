import { Widget } from "./Widget";
import { BackgroundConfig } from "./hooks/background";
import { WidgetGridSettings } from "./features/app/WidgetGrid";

/**
 * A workspace contains a set of widgets, background, and grid settings
 */
export interface Workspace {
	id: string;
	name: string;
	widgets: Widget<any>[];
	background?: BackgroundConfig;
	gridSettings?: WidgetGridSettings;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Creates a new empty workspace
 */
export function createWorkspace(name: string): Workspace {
	return {
		id: generateWorkspaceId(),
		name,
		widgets: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

/**
 * Generates a unique workspace ID
 */
function generateWorkspaceId(): string {
	return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
