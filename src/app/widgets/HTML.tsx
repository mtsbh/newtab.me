import Panel from 'app/components/Panel';
import { type } from 'app/utils/Schema';
import { Vector2 } from 'app/utils/Vector2';
import { WidgetProps, WidgetType } from 'app/Widget';
import React, { useEffect, useRef } from 'react';
import { defineMessages } from 'react-intl';


const messages = defineMessages({
	title: {
		defaultMessage: "HTML",
		description: "HTML Widget",
	},

	description: {
		defaultMessage: "Custom HTML",
		description: "HTML widget description",
	},

	html: {
		defaultMessage: "HTML",
		description: "HTML widget: form field label",
	},

	jsEnabled: {
		defaultMessage: "JavaScript is now supported. Only use trusted code.",
		description: "HTML widget: form field description",
	}
});

interface HTMLProps {
	html: string;
}

function HTML(props: WidgetProps<HTMLProps>) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		// Clear previous content
		containerRef.current.innerHTML = props.props.html;

		// Execute scripts manually to enable JavaScript
		const scripts = containerRef.current.querySelectorAll('script');
		scripts.forEach((oldScript) => {
			const newScript = document.createElement('script');

			// Copy attributes
			Array.from(oldScript.attributes).forEach(attr => {
				newScript.setAttribute(attr.name, attr.value);
			});

			// Copy inline script content
			if (oldScript.textContent) {
				newScript.textContent = oldScript.textContent;
			}

			// Replace old script with new one to execute it
			oldScript.parentNode?.replaceChild(newScript, oldScript);
		});

		// Cleanup function
		return () => {
			// Remove scripts on unmount to prevent memory leaks
			if (containerRef.current) {
				const scripts = containerRef.current.querySelectorAll('script');
				scripts.forEach(script => script.remove());
			}
		};
	}, [props.props.html]);

	return (
		<Panel {...props.theme} scrolling={false}>
			<div ref={containerRef} />
		</Panel>);
}


const widget: WidgetType<HTMLProps> = {
	Component: HTML,
	title: messages.title,
	description: messages.description,
	defaultSize: new Vector2(5, 4),
	initialProps: {
		html: "Hello <b>World</b>"
	},
	schema: {
		html: type.textarea(messages.html, messages.jsEnabled),
	},
};
export default widget;
