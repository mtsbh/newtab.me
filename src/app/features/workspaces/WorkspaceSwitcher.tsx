import React, { useState } from "react";
import { Workspace } from "../../Workspace";
import { mergeClasses } from "../../utils";
import "./WorkspaceSwitcher.css";

interface WorkspaceSwitcherProps {
	workspaces: Workspace[];
	activeWorkspaceId: string;
	onSwitch: (workspaceId: string) => void;
	onCreateWorkspace: () => void;
	onRenameWorkspace: (workspaceId: string, newName: string) => void;
	onDeleteWorkspace: (workspaceId: string) => void;
	isLocked: boolean;
}

export default function WorkspaceSwitcher(props: WorkspaceSwitcherProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");

	const handleStartRename = (workspace: Workspace) => {
		setEditingId(workspace.id);
		setEditName(workspace.name);
	};

	const handleFinishRename = () => {
		if (editingId && editName.trim()) {
			props.onRenameWorkspace(editingId, editName.trim());
		}
		setEditingId(null);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleFinishRename();
		} else if (e.key === "Escape") {
			setEditingId(null);
		}
	};

	return (
		<div className={mergeClasses("workspace-switcher", !props.isLocked && "unlocked")}>
			<div className="workspace-tabs">
				{props.workspaces.map(workspace => (
					<div
						key={workspace.id}
						className={mergeClasses(
							"workspace-tab",
							workspace.id === props.activeWorkspaceId && "active"
						)}
					>
						{editingId === workspace.id ? (
							<input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								onBlur={handleFinishRename}
								onKeyDown={handleKeyDown}
								autoFocus
								className="workspace-tab-input"
							/>
						) : (
							<>
								<button
									className="workspace-tab-button"
									onClick={() => props.onSwitch(workspace.id)}
									title={workspace.name}
								>
									{workspace.name}
								</button>
								{!props.isLocked && (
									<div className="workspace-tab-actions">
										<button
											className="workspace-action-btn"
											onClick={() => handleStartRename(workspace)}
											title="Rename workspace"
										>
											✏️
										</button>
										{props.workspaces.length > 1 && (
											<button
												className="workspace-action-btn delete"
												onClick={() => {
													if (confirm(`Delete workspace "${workspace.name}"?`)) {
														props.onDeleteWorkspace(workspace.id);
													}
												}}
												title="Delete workspace"
											>
												🗑️
											</button>
										)}
									</div>
								)}
							</>
						)}
					</div>
				))}
				{!props.isLocked && (
					<button
						className="workspace-tab workspace-add-btn"
						onClick={props.onCreateWorkspace}
						title="Create new workspace"
					>
						+
					</button>
				)}
			</div>
		</div>
	);
}
