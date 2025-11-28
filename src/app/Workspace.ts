import { Widget } from "./Widget";
import { BackgroundConfig } from "./hooks/background";
import { WidgetGridSettings } from "./features/app/WidgetGrid";
import { getBackgroundProvider } from "./features/backgrounds/providers";

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
 * Creates a new empty workspace with default background
 */
export function createWorkspace(name: string): Workspace {
	// Set default background using the Curated provider
	const provider = getBackgroundProvider<any>("Curated");
	const defaultBackground: BackgroundConfig = {
		mode: "Curated",
		values: { ...provider!.defaultValues },
	};

	return {
		id: generateWorkspaceId(),
		name,
		widgets: [],
		background: defaultBackground,
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
