import React, { useState, useEffect, useRef } from "react";
import "./CreateWorkspaceDialog.css";

interface CreateWorkspaceDialogProps {
	onClose: () => void;
	onCreate: (name: string) => void;
}

export default function CreateWorkspaceDialog(props: CreateWorkspaceDialogProps) {
	const [name, setName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim()) {
			props.onCreate(name.trim());
			props.onClose();
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			props.onClose();
		}
	};

	return (
		<div className="dialog-overlay" onClick={props.onClose}>
			<div className="create-workspace-dialog" onClick={(e) => e.stopPropagation()}>
				<div className="dialog-header">
					<h2>Create New Workspace</h2>
					<button className="dialog-close-btn" onClick={props.onClose} title="Close">
						<i className="fas fa-times"></i>
					</button>
				</div>
				<form onSubmit={handleSubmit}>
					<div className="dialog-body">
						<label htmlFor="workspace-name">Workspace Name</label>
						<input
							ref={inputRef}
							id="workspace-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="e.g., Work, Personal, Study..."
							maxLength={50}
							autoComplete="off"
						/>
					</div>
					<div className="dialog-footer">
						<button type="button" className="btn btn-secondary" onClick={props.onClose}>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary" disabled={!name.trim()}>
							<i className="fas fa-plus"></i>
							Create Workspace
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
