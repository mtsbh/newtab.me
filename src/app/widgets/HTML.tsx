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

	// Check if HTML contains external scripts (requires sandbox)
	// Calculate during render, not in useEffect, to ensure it's synchronous
	const useSandbox = /<script[^>]*src=["']https?:\/\//.test(props.props.html);
	console.log('HTML Widget: External script detected?', useSandbox, 'Will use sandbox:', useSandbox);

	useEffect(() => {
		if (!useSandbox && containerRef.current) {
			// Standard mode: inject HTML directly
			console.log('HTML Widget: Using DIRECT injection (no sandbox)');
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
			console.log('HTML Widget: Using SANDBOX iframe for external scripts');
			const iframe = iframeRef.current;

			const sendHTML = () => {
				if (iframe.contentWindow) {
					console.log('HTML Widget: Sending HTML to sandbox');
					iframe.contentWindow.postMessage({
						type: 'setHTML',
						html: props.props.html
					}, '*');
				}
			};

			const handleMessage = (event: MessageEvent) => {
				if (event.data && event.data.type === 'sandboxReady') {
					console.log('HTML Widget: Sandbox ready, sending HTML');
					sendHTML();
				}
			};

			// Listen for sandbox ready message
			window.addEventListener('message', handleMessage);

			// Also listen for load event as a fallback
			const handleLoad = () => {
				console.log('HTML Widget: Sandbox loaded');
				// Give the sandbox script time to initialize
				setTimeout(sendHTML, 100);
			};

			iframe.addEventListener('load', handleLoad);

			return () => {
				window.removeEventListener('message', handleMessage);
				iframe.removeEventListener('load', handleLoad);
			};
		}
	}, [props.props.html, useSandbox]);

	return (
		<Panel {...props.theme} scrolling={false}>
			{useSandbox ? (
				<iframe
					ref={iframeRef}
					src="../sandbox.html"
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
