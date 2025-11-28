import React, { useState, useEffect } from "react";
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
	const [isOpen, setIsOpen] = useState(false);
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

	// Keyboard shortcut: Ctrl+Shift+W to toggle
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === "W") {
				e.preventDefault();
				setIsOpen(prev => !prev);
			}
		};
		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, []);

	const activeWorkspace = props.workspaces.find(w => w.id === props.activeWorkspaceId);

	return (
		<div className="workspace-switcher">
			<button
				className="workspace-toggle-btn"
				onClick={() => setIsOpen(!isOpen)}
				title="Switch workspace (Ctrl+Shift+W)"
			>
				<i className="fas fa-layer-group"></i>
				<span className="workspace-current-name">{activeWorkspace?.name || "Main"}</span>
				<i className={mergeClasses("fas fa-chevron-down", isOpen && "rotate")}></i>
			</button>

			{isOpen && (
				<>
					<div className="workspace-overlay" onClick={() => setIsOpen(false)} />
					<div className={mergeClasses("workspace-panel", !props.isLocked && "unlocked")}>
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
									onClick={() => {
										props.onSwitch(workspace.id);
										setIsOpen(false);
									}}
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
							+ New Workspace
						</button>
					)}
				</div>
			</div>
				</>
			)}
		</div>
	);
}
