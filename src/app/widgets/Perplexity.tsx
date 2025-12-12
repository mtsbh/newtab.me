import Panel from "app/components/Panel";
import { getProbableURL } from "app/utils";
import { Vector2 } from "app/utils/Vector2";
import { WidgetProps, WidgetType } from "app/Widget";
import React, { useRef, useState } from "react";
import { defineMessages, useIntl } from "react-intl";


const messages = defineMessages({
	title: {
		defaultMessage: "Perplexity",
		description: "Perplexity Widget",
	},

	description: {
		defaultMessage: "Search with Perplexity AI",
		description: "Perplexity widget description",
	},

	searchWith: {
		defaultMessage: "Ask Perplexity anything...",
		description: "Perplexity widget: searchbox placeholder text",
	},
});


interface PerplexityProps {
	// Empty for now, but allows for future customization
}


function Perplexity(props: WidgetProps<PerplexityProps>) {
	const intl = useIntl();
	const [query, setQuery] = useState("");
	const directURL = getProbableURL(query);
	const ref = useRef<HTMLInputElement>(null);

	function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();

		if (directURL) {
			window.location.href = directURL;
		} else if (query) {
			const encoded = encodeURIComponent(query);
			window.location.href = `https://www.perplexity.ai/search?q=${encoded}`;
		}
	}

	const placeholder = intl.formatMessage(messages.searchWith);

	return (
		<Panel {...props.theme} flush={true}>
			<form onSubmit={onSubmit} style={{ position: 'relative' }}>
				<span key={directURL ?? "icon"} className="icon" style={{
					color: '#20808d',
					fontSize: '1.2em'
				}}>
					<i className={directURL !== null
						? "fas fa-globe-europe"
						: "fas fa-brain"} />
				</span>
				<input ref={ref} type="search" name="q" autoComplete="off"
						autoFocus={false} placeholder={placeholder}
						value={query} onChange={e => setQuery(e.target.value)}
						className="large invisible"
						style={{
							fontStyle: query ? 'normal' : 'italic',
						}} />
			</form>
		</Panel>);
}


const widget: WidgetType<PerplexityProps> = {
	Component: Perplexity,
	title: messages.title,
	description: messages.description,
	defaultSize: new Vector2(15, 1),
	initialProps: {},
	schema: {},
};

export default widget;
