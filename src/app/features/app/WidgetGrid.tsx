import React, { CSSProperties, useEffect, useState, useMemo, useRef } from "react";
import { WidgetContainer } from "./WidgetContainer";
import { WidgetManager } from "app/WidgetManager";
import { WidgetTypes } from "app/widgets";
import { ErrorBoundary } from "app/components/ErrorView";
import WidgetLayouter from "app/WidgetLayouter";
import { Vector2 } from "app/utils/Vector2";
import GridLayout, { Layout, WidthProvider } from "react-grid-layout";
import { WidgetProps } from "app/Widget";
import Schema, { type } from "app/utils/Schema";
import { defineMessages } from "react-intl";
import { bindValuesToDescriptor } from "app/locale/MyMessageDescriptor";
import { mergeClasses } from "app/utils";


export interface WidgetGridSettings {
	fullPage: boolean;
	columns: number;
	spacing: number;
}


const messages = defineMessages({
	fullPageLabel: {
		defaultMessage: "Full Page Grid",
		description: "Widget grid: form label for grid full width",
	},

	fullPageHint1: {
		defaultMessage: "Stretch grid to cover the entire page.",
		description: "Widget grid: form label 1 for grid full width",
	},

	fullPageHint2: {
		defaultMessage: "You should increase \"Grid Columns\" to at least {cols} to make best use of space.",
		description: "Widget grid: form label 2 for grid full width",
	},

	fullPageHint3: {
		defaultMessage: "Note that other widgets won't move out of the way when dragging.",
		description: "Widget grid: form label 3 for grid full width",
	},

	fullPageHint4: {
		defaultMessage: "This is <b>experimental and may be harder to use</b>.",
		description: "Widget grid: form label 4 for grid full width",
	},

	columnsLabel: {
		defaultMessage: "Grid Columns",
		description: "Widget grid: form label for grid columns",
	},

	columnsHint: {
		defaultMessage: "Number of columns in the widget grid. You can fit {max} columns in the current window width ({res}px).",
		description: "Widget grid: form hint for grid columns",
	},

	spacingLabel: {
		defaultMessage: "Grid Spacing",
		description: "Widget grid: form label for grid spacing",
	},

	spacingHint: {
		defaultMessage: "The spacing between widgets, in pixels.",
		description: "Widget grid: form hint for grid spacing",
	},
});


interface WidgetGridProps extends WidgetGridSettings {
	wm: WidgetManager;
	isLocked: boolean;
}

const ReactGridLayout = WidthProvider(GridLayout);

export default function WidgetGrid(props: WidgetGridProps) {
	const widgetManager = props.wm;
	const [gridClassNames, setGridClassNames] = useState("layout");
	const gridColumns = props.columns;
	const cellSize = 50;
	const cellSpacing = props.spacing;
	const gridWidth = gridColumns*(cellSize+cellSpacing);
	const maxRows = props.fullPage ? Math.floor(document.body.clientHeight / (cellSize+cellSpacing)) : undefined;

	useEffect(() => {
		const timer = setTimeout(() => setGridClassNames("layout animated"), 1000);
		return () => clearTimeout(timer);
	}, []);

	function handleRemove(id: number) {
		widgetManager.removeWidget(id);
	}

	// Track which widgets have had their positions saved
	const savedWidgetIdsRef = useRef<Set<number>>(new Set());

	// Memoize layout processing to avoid recreating on every render
	const { sortedWidgets, layout } = useMemo(() => {
		console.log('WidgetGrid: Computing layout for', widgetManager.widgets.length, 'widgets');
		console.log('WidgetGrid: isLocked =', props.isLocked);

		// Get widgets that need positioning before layouter runs
		const widgetsNeedingPosition = widgetManager.widgets.filter(w => !w.position);
		console.log('WidgetGrid: Widgets needing position:', widgetsNeedingPosition.map(w => `${w.type}#${w.id}`));

		const layouter = new WidgetLayouter(new Vector2(gridColumns, maxRows ?? 0));
		const wasRepositioned = layouter.resolveAll(widgetManager.widgets);

		// Check if any NEW widgets got positions and need to be saved
		const newlyPositionedWidgets = widgetsNeedingPosition.filter(
			w => w.position && !savedWidgetIdsRef.current.has(w.id)
		);

		if (newlyPositionedWidgets.length > 0) {
			console.log('WidgetGrid: Newly positioned widgets:', newlyPositionedWidgets.map(w => `${w.type}#${w.id} at ${w.position}`));
			// Mark these widgets as saved
			newlyPositionedWidgets.forEach(w => savedWidgetIdsRef.current.add(w.id));
			// Save asynchronously to avoid render cycle issues
			setTimeout(() => {
				console.log('WidgetGrid: Saving positions for newly positioned widgets');
				widgetManager.save();
			}, 0);
		}

		// Sort widgets to allow predictable focus order
		const sorted = [...widgetManager.widgets].sort((a, b) =>
			(a.position!.x + 100 * a.position!.y) -
			(b.position!.x + 100 * b.position!.y));

		const layout : Layout[] = sorted.map(widget => ({
			i: widget.id.toString(),
			x: widget.position?.x ?? 0,
			y: widget.position?.y ?? 0,
			w: widget.size.x,
			h: widget.size.y,
		}));

		return { sortedWidgets: sorted, layout };
	}, [widgetManager.widgets, gridColumns, maxRows, props.isLocked]);

	// Memoize widgets to prevent unnecessary re-renders
	const widgets = useMemo(() => sortedWidgets.map(widget => {
		const props : WidgetProps<unknown> = {
			...widget,
			typeDef: WidgetTypes[widget.type],
			save: () => widgetManager.save(),
			remove: () => handleRemove(widget.id),
			duplicate: () => {
				widgetManager.clone(widget);
			},
		};

		return (
			<div key={widget.id}
					className={mergeClasses("widget",
						widget.position?.y == 0 && "widget-bar-bottom",
						`widget-${widget.type.toLowerCase()}`)}
					data-widget-id={widget.id}>
				<ErrorBoundary>
					<WidgetContainer {...props} />
				</ErrorBoundary>
			</div>);
	}), [sortedWidgets, widgetManager]);

	function onLayoutChange(layouts: Layout[]) {
		const lut = new Map<string, Layout>();
		layouts.forEach(layout => lut.set(layout.i, layout));

		// Create new array with updated widgets instead of mutating
		widgetManager.widgets = widgetManager.widgets.map(widget => {
			const layout = lut.get(widget.id.toString());
			if (layout) {
				return {
					...widget,
					position: new Vector2(layout.x, layout.y),
					size: new Vector2(layout.w, layout.h),
				};
			}
			return widget;
		});

		widgetManager.save();
	}

	const wrapStyle: CSSProperties = {
		height: props.fullPage ? "100%" : undefined,
		padding: props.fullPage ? "0 0 40px 0" : undefined,
	};

	const gridStyle: CSSProperties = props.fullPage
		? { minWidth: Math.ceil(gridWidth / 2), width: "100%", height: "100%" }
		: { width: Math.ceil(gridWidth / 2) * 2 };

	return (
		<section className="widget-grid">
			<div className="scroll-wrap" style={wrapStyle}>
				<ReactGridLayout
						// Clear cache when fullPage changes
						key={props.fullPage ? "one" : "two"}

						className={mergeClasses(gridClassNames, props.fullPage && "grid-full-page")}
						style={gridStyle}
						isDraggable={!props.isLocked}
						isResizable={!props.isLocked}
						resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
						layout={layout} onLayoutChange={onLayoutChange}
						cols={gridColumns} rowHeight={cellSize}
						margin={[cellSpacing, cellSpacing]}
						draggableHandle=".widget-handle"

						// Mode specific options
						isBounded={props.fullPage}
						width={!props.fullPage ? gridWidth : undefined}
						autoSize={!props.fullPage}
						preventCollision={props.fullPage}
						maxRows={maxRows}
						compactType={props.fullPage ? null : "vertical"}>
					{widgets}
				</ReactGridLayout>
			</div>
		</section>);
}

export function makeGridSettingsSchema(values: WidgetGridSettings): Schema<WidgetGridSettings> {
	const screenWidth = document.body.clientWidth;
	const maxColumns = Math.floor((screenWidth - 10 + values.spacing) / (50 + values.spacing));

	return {
		fullPage: type.boolean(messages.fullPageLabel, [
			messages.fullPageHint1,
			messages.fullPageHint3,
			bindValuesToDescriptor(messages.fullPageHint4, {
				b: (chunk: any) => (<b key={Math.random()}>{chunk}</b>),
			}),
			bindValuesToDescriptor(messages.fullPageHint2, {
				cols: Math.floor(maxColumns * 0.85),
			}),
		]),
		columns: type.number(messages.columnsLabel, bindValuesToDescriptor(messages.columnsHint, {
			max: maxColumns,
			res: screenWidth,
		}), 5),
		spacing: type.unit_number(messages.spacingLabel, "px", messages.spacingHint, 0),
	};
}

export const defaultGridSettings: WidgetGridSettings = {
	fullPage: false,
	columns: 15,
	spacing: 15,
};
