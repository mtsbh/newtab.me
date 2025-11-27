import { MessageFormatElement } from "react-intl";

type Translation = Record<string, MessageFormatElement[]>;

const locales : { [key: string]: Translation } = {
	"en": require("./compiled/en.json"),
	"bg": require("./compiled/bg.json"),
};


// Set fallbacks
for (const lang in locales) {
	if (lang != "en") {
		for (const [key, value] of Object.entries(locales["en"])) {
			if (typeof locales[lang][key] === "undefined" && key != "languageName") {
				locales[lang][key] = value;
			}
		}
	}
}


export default locales
