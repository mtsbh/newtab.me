import React, { useState } from 'react';
import { usePromise } from 'app/hooks';
import { mergeClasses } from 'app/utils';


export interface IconProps {
	icon: string | Promise<string | undefined>;
	requiresIcons?: boolean;
	defaultIcon?: string;
	errorIcon?: string;
	className?: string;
	title?: string;
}


export default function Icon(props: IconProps) {
	const [errored, setErrored] = useState(false);
	const requiresIcons = props.requiresIcons ?? true;

	const [icon, isLoading] = usePromise(async () => {
		if (props.icon instanceof Promise) {
			return await props.icon;
		} else {
			return props.icon;
		}
	}, [props.icon]);

	// While loading or if no icon, don't show anything if icons are not required
	if (!requiresIcons && (isLoading || !icon || icon.length == 0)) {
		return null;
	}

	// If still loading and icons are required, return null to prevent flashing
	if (isLoading) {
		return null;
	}

	if (errored) {
		return (<span title={props.title} className={props.className}><i className={`fas ${props.errorIcon ?? "fa-times"} icon`} /></span>);
	} else if (typeof icon == "string" && (icon.includes("/") || icon.startsWith("data:"))) {
		return (<img title={props.title} className={mergeClasses("icon", props.className)} src={icon} onError={() => setErrored(true)} />);
	} else if (typeof icon == "string" && icon.startsWith("fa-")) {
		return (<span title={props.title} className={props.className}><i className={`fas ${icon} icon`} /></span>);
	} else if (props.defaultIcon) {
		return (<span title={props.title} className={props.className}><i className={`fas ${props.defaultIcon} icon`} /></span>);
	} else {
		// No icon and no default, return null
		return null;
	}
}
