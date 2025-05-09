import {
	App,
	Plugin,
	TFile,
	PluginSettingTab,
	Setting,
	Notice,
	MarkdownPostProcessorContext,
} from "obsidian";

interface FolderLinkPluginSettings {
	folderPrefix: string;
}

const DEFAULT_SETTINGS: FolderLinkPluginSettings = {
	folderPrefix: "",
};

export default class FolderLinkPlugin extends Plugin {
	settings: FolderLinkPluginSettings;

	async onload() {
		await this.loadSettings();

		// Render ||Folder/|| links in both Reading and Live Preview
		this.registerMarkdownPostProcessor(
			(element: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				const textNodes = document.createTreeWalker(
					element,
					NodeFilter.SHOW_TEXT
				);
				let current: Node | null;

				while ((current = textNodes.nextNode())) {
					const text = current.nodeValue;
					if (!text) continue;

					// Match all occurrences of ||something/||
					const matches = [
						...text.matchAll(/\|\|([^|/:*?"<>]+\/)\|\|/g),
					];
					if (matches.length === 0) continue;

					const frag = document.createDocumentFragment();
					let lastIndex = 0;

					for (const match of matches) {
						const matchText = match[0];
						const folderName = match[1];
						const matchIndex = match.index ?? 0;

						// Add preceding text
						if (matchIndex > lastIndex) {
							frag.appendChild(
								document.createTextNode(
									text.slice(lastIndex, matchIndex)
								)
							);
						}

						// Create clickable link
						const link = document.createElement("a");
						link.classList.add("folder-link");
						link.dataset.folder = folderName;
						link.dataset.sourcePath = ctx.sourcePath;
						link.innerText = folderName;
						link.style.cursor = "pointer";
						link.style.color = "var(--link-color)";
						link.style.textDecoration = "underline";

						frag.appendChild(link);
						lastIndex = matchIndex + matchText.length;
					}

					// Add any remaining text
					if (lastIndex < text.length) {
						frag.appendChild(
							document.createTextNode(text.slice(lastIndex))
						);
					}

					// Replace original text node
					current.parentNode?.replaceChild(frag, current);
				}
			}
		);

		// Handle click events on links
		document.addEventListener("click", async (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.classList.contains("folder-link")) return;

			e.preventDefault();

			const folderName = target.dataset.folder;
			const sourcePath = target.dataset.sourcePath;
			if (!folderName || !sourcePath) return;

			const currentFile =
				this.app.vault.getAbstractFileByPath(sourcePath);
			if (!currentFile || !(currentFile instanceof TFile)) {
				new Notice("⚠️ Could not determine origin note location.");
				return;
			}

			const parentFolder = sourcePath.split("/").slice(0, -1).join("/");
			const folderPath = parentFolder
				? `${parentFolder}/${folderName}`
				: folderName;

			const exists = await this.app.vault.adapter.exists(folderPath);
			if (!exists) {
				await this.app.vault.createFolder(folderPath);
				new Notice(`📁 Created folder: ${folderPath}`);
			} else {
				new Notice(`✅ Folder already exists: ${folderPath}`);
			}
		});

		this.addSettingTab(new FolderLinkSettingTab(this.app, this));
	}

	onunload() {
		console.log("FolderLinkPlugin unloaded.");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FolderLinkSettingTab extends PluginSettingTab {
	plugin: FolderLinkPlugin;

	constructor(app: App, plugin: FolderLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Optional Folder Prefix")
			.setDesc(
				"Currently unused; future support for prefixing folder paths."
			)
			.addText((text) =>
				text
					.setPlaceholder("e.g., Projects/")
					.setValue(this.plugin.settings.folderPrefix)
					.onChange(async (value) => {
						this.plugin.settings.folderPrefix = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}
