import React, { useState, KeyboardEvent, useContext } from "react";
import { getSchemaForWidget, WidgetProps, getThemeSchemaForWidget } from "../../Widget";
import Modal from "app/components/Modal";
import { Form } from "app/components/forms";
import ErrorView, { ErrorBoundary } from "app/components/ErrorView";
import { usePromise } from "app/hooks";
import { FormattedMessage, useIntl } from "react-intl";
import { miscMessages } from "app/locale/common";
import Button, { ButtonVariant } from "app/components/Button";
import { SchemaEntry } from "app/utils/Schema";
import { MyFormattedMessage } from "app/locale/MyMessageDescriptor";
import { WorkspaceActionsContext } from "./App";


interface WidgetDialogProps<T> extends WidgetProps<T> {
	onClose: () => void;
}


function WidgetEditor<T>(props: WidgetDialogProps<T>) {
	const intl = useIntl();
	const themeSchema = getThemeSchemaForWidget(props, props.typeDef);
	const [forceKey, setForce] = useState({});
	const forceUpdate = () => setForce({});

	const title = intl.formatMessage(
		{ id: "widget.edit.title", defaultMessage: "Edit {type}" },
		{ type: intl.formatMessage(props.typeDef.title) });

	const [schema, error] = usePromise(() => getSchemaForWidget(props, props.typeDef, intl),
			[props.type, props.id, forceKey]);
	if (!schema) {
		return (
			<Modal title={title} {...props}>
				<div className="modal-body">
					<ErrorView error={error} loading={true} />
				</div>
			</Modal>);
	}

	function onChange() {
		if (typeof props.typeDef.schema == "function") {
			forceUpdate();
		}

		props.save();
	}

	const isWide = Object.values(schema as Record<string, SchemaEntry>)
		.some(field => field.type == "array" || field.type == "unordered_array");

	const EditHeaderComponent = props.typeDef.editHeaderComponent;

	return (
		<Modal title={title} wide={isWide} {...props}>
			<div className="modal-body">
				{props.typeDef.editHint &&
					<p className="text-muted">
						<MyFormattedMessage message={props.typeDef.editHint} />
					</p>}

				{EditHeaderComponent && (
					<EditHeaderComponent {...props} onChange={onChange} />)}

				<Form
						values={props.props}
						schema={schema}
						onChange={onChange} />

				<h2 className="mt-6">
					<FormattedMessage
						id="widget.edit.styling"
						defaultMessage="Styling"
						description="Subheading for per-widget styling properties" />
				</h2>

				<Form
						values={props.theme}
						schema={themeSchema}
						onChange={onChange} />
			</div>
			<div className="modal-footer buttons">
				<Button onClick={props.onClose} label={miscMessages.ok}
					data-cy="edit-ok" />
			</div>
		</Modal>);
}


function WidgetDelete<T>(props: WidgetDialogProps<T>) {
	const intl = useIntl();
	const title = intl.formatMessage(
			{ id: "widget.delete.title", defaultMessage: "Remove {type}" },
			{ type: intl.formatMessage(props.typeDef.title) });
	return (
		<Modal title={title} {...props}>
			<div className="modal-body">
				<FormattedMessage
					id="widget.delete.confirm"
					defaultMessage="Are you sure you want to permanently remove this widget?"
					description="Delete widget modal message" />
			</div>
			<div className="modal-footer buttons">
				<Button variant={ButtonVariant.Secondary} data-cy="cancel"
					onClick={props.onClose} label={miscMessages.cancel} />
				<Button variant={ButtonVariant.Danger} autoFocus={true}
					onClick={props.remove} label={miscMessages.delete}
					data-cy="delete" />
			</div>
		</Modal>);
}


function WidgetMoveToWorkspace<T>(props: WidgetDialogProps<T>) {
	const intl = useIntl();
	const workspaceContext = useContext(WorkspaceActionsContext);
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
	const [isMoving, setIsMoving] = useState(false);

	if (!workspaceContext) {
		return null;
	}

	const { workspaces, activeWorkspaceId, moveWidgetToWorkspace } = workspaceContext;
	const availableWorkspaces = workspaces.filter(w => w.id !== activeWorkspaceId);

	const title = intl.formatMessage(
		{ id: "widget.move.title", defaultMessage: "Move {type} to Workspace" },
		{ type: intl.formatMessage(props.typeDef.title) });

	const handleMove = async () => {
		if (!selectedWorkspaceId) {
			return;
		}

		setIsMoving(true);
		try {
			await moveWidgetToWorkspace(props.id, selectedWorkspaceId);
			props.onClose();
		} catch (error) {
			console.error("Failed to move widget:", error);
			setIsMoving(false);
		}
	};

	return (
		<Modal title={title} {...props}>
			<div className="modal-body">
				<p>
					<FormattedMessage
						id="widget.move.select"
						defaultMessage="Select the workspace to move this widget to:"
						description="Move widget modal message" />
				</p>
				<div className="form-group">
					{availableWorkspaces.length === 0 ? (
						<p className="text-muted">
							<FormattedMessage
								id="widget.move.noWorkspaces"
								defaultMessage="No other workspaces available. Create a new workspace first."
								description="No workspaces available message" />
						</p>
					) : (
						<select
							className="form-control"
							value={selectedWorkspaceId || ""}
							onChange={(e) => setSelectedWorkspaceId(e.target.value)}
							disabled={isMoving}
							autoFocus={true}
						>
							<option value="">
								{intl.formatMessage({
									id: "widget.move.selectPlaceholder",
									defaultMessage: "Select workspace...",
									description: "Workspace selection placeholder"
								})}
							</option>
							{availableWorkspaces.map(workspace => (
								<option key={workspace.id} value={workspace.id}>
									{workspace.name}
								</option>
							))}
						</select>
					)}
				</div>
			</div>
			<div className="modal-footer buttons">
				<Button variant={ButtonVariant.Secondary} data-cy="cancel"
					onClick={props.onClose} label={miscMessages.cancel}
					disabled={isMoving} />
				<Button variant={ButtonVariant.Primary} autoFocus={false}
					onClick={handleMove}
					label={{ id: "widget.move.button", defaultMessage: "Move", description: "Move widget button" }}
					data-cy="move"
					disabled={!selectedWorkspaceId || isMoving} />
			</div>
		</Modal>);
}


enum WidgetMode {
	View,
	Edit,
	Delete,
	Move
}


const WidgetContainerComponent = <T,>(props: WidgetProps<T>) => {
	const [mode, setMode] = useState(WidgetMode.View);
	const close = () => setMode(WidgetMode.View);
	const intl = useIntl();

	switch (mode) {
	case WidgetMode.Edit:
		return (<WidgetEditor onClose={close} {...props} />);
	case WidgetMode.Delete:
		return (<WidgetDelete onClose={close} {...props} />);
	case WidgetMode.Move:
		return (<WidgetMoveToWorkspace onClose={close} {...props} />);
	}

	if (typeof browser === "undefined" && props.typeDef.isBrowserOnly === true) {
		return (
			<>
				<div className="widget-bar">
					<i className="widget-handle fas fa-grip-vertical" />
					<span className="widget-title widget-handle">
						<i className="fas fa-grip-vertical mr-3" />
						<FormattedMessage {...props.typeDef.title} />
					</span>
					<a className="btn" onClick={(e) => {
						e.stopPropagation();
						e.preventDefault();
						setMode(WidgetMode.Delete);
					}}>
						<i className="fas fa-trash" />
					</a>
				</div>
				<div className="panel text-muted">
					<FormattedMessage
							id="widget.browserOnly"
							defaultMessage="This widget requires the browser extension version." />
				</div>
			</>);
	}

	function onKeyPress(e: KeyboardEvent<HTMLInputElement>) {
		const currentElement = document.activeElement;
		if (currentElement?.nodeName == "INPUT" || currentElement?.nodeName == "TEXTAREA") {
			return;
		}

		if (e.key == "e") {
			setMode(WidgetMode.Edit);
		} else if (e.key == "Delete" || e.key == "d") {
			setMode(WidgetMode.Delete);
		}
	}

	const widgetTitle = intl.formatMessage(props.typeDef.title);
	const widgetTitleLabel = intl.formatMessage(miscMessages.typeWidget, { name:  widgetTitle });
	const Child = props.typeDef.Component;
	return (
		<div className="widget-inner" onKeyPress={onKeyPress} tabIndex={0}
				role="region" aria-label={widgetTitleLabel}>
			<div className="widget-bar">
				<i className="widget-handle fas fa-grip-vertical" />
				<div className="widget-title widget-handle">
					{widgetTitle}
				</div>

				<Button variant={ButtonVariant.None}
					className="widget-delete"
					onClick={(e: React.MouseEvent) => {
						e.stopPropagation();
						e.preventDefault();
						setMode(WidgetMode.Delete);
					}}
					icon="fa fa-trash"
					title={miscMessages.delete} />

				<Button variant={ButtonVariant.None}
					onClick={(e: React.MouseEvent) => {
						e.stopPropagation();
						e.preventDefault();
						props.duplicate();
					}}
					data-cy="widget-duplicate"
					icon="fas fa-clone"
					title={miscMessages.duplicate} />

				<Button variant={ButtonVariant.None}
					onClick={(e: React.MouseEvent) => {
						e.stopPropagation();
						e.preventDefault();
						setMode(WidgetMode.Move);
					}}
					data-cy="widget-move"
					icon="fas fa-arrow-right"
					title={{ id: "widget.move.tooltip", defaultMessage: "Move to workspace", description: "Move widget to another workspace" }} />

				<Button variant={ButtonVariant.None}
					className="btn widget-edit"
					onClick={(e: React.MouseEvent) => {
						e.stopPropagation();
						e.preventDefault();
						setMode(WidgetMode.Edit);
					}}
					icon="fas fa-pen"
					title={miscMessages.edit} />
			</div>
			<ErrorBoundary>
				<Child {...props} />
			</ErrorBoundary>
		</div>);
};

// Memoize to prevent unnecessary re-renders when props haven't changed
export const WidgetContainer = React.memo(WidgetContainerComponent) as typeof WidgetContainerComponent;
