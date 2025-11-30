import Panel from 'app/components/Panel';
import { type } from 'app/utils/Schema';
import { Vector2 } from 'app/utils/Vector2';
import { WidgetProps, WidgetType } from 'app/Widget';
import React, { useEffect, useRef, useState } from 'react';
import { defineMessages } from 'react-intl';


const messages = defineMessages({
	title: {
		id: 'widget.html.title',
		defaultMessage: "HTML",
		description: "HTML Widget",
	},

	description: {
		id: 'widget.html.description',
		defaultMessage: "Custom HTML",
		description: "HTML widget description",
	},

	html: {
		id: 'widget.html.html',
		defaultMessage: "HTML",
		description: "HTML widget: form field label",
	},

	jsEnabled: {
		id: 'widget.html.jsEnabled',
		defaultMessage: "JavaScript is now supported. Only use trusted code.",
		description: "HTML widget: form field description",
	}
});

interface HTMLProps {
	html: string;
}

function HTML(props: WidgetProps<HTMLProps>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [useSandbox, setUseSandbox] = useState(false);

	useEffect(() => {
		// Check if HTML contains external scripts (requires sandbox)
		const hasExternalScript = /<script[^>]*src=["']https?:\/\//.test(props.props.html);
		setUseSandbox(hasExternalScript);
	}, [props.props.html]);

	useEffect(() => {
		if (!useSandbox && containerRef.current) {
			// Standard mode: inject HTML directly
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
				if (containerRef.current) {
					const scripts = containerRef.current.querySelectorAll('script');
					scripts.forEach(script => script.remove());
				}
			};
		} else if (useSandbox && iframeRef.current) {
			// Sandbox mode: use iframe for external scripts
			const handleLoad = () => {
				if (iframeRef.current?.contentWindow) {
					iframeRef.current.contentWindow.postMessage({
						type: 'setHTML',
						html: props.props.html
					}, '*');
				}
			};

			if (iframeRef.current.contentWindow) {
				handleLoad();
			} else {
				iframeRef.current.addEventListener('load', handleLoad);
			}

			return () => {
				if (iframeRef.current) {
					iframeRef.current.removeEventListener('load', handleLoad);
				}
			};
		}
	}, [props.props.html, useSandbox]);

	return (
		<Panel {...props.theme} scrolling={false}>
			{useSandbox ? (
				<iframe
					ref={iframeRef}
					src="sandbox.html"
					style={{ width: '100%', height: '100%', border: 'none' }}
					sandbox="allow-scripts allow-same-origin"
				/>
			) : (
				<div ref={containerRef} />
			)}
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
